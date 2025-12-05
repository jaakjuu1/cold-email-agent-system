/**
 * IMAP Monitor Service - Polls inbox for email responses and detects replies
 * Supports per-client IMAP configuration from database
 */

import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import { nanoid } from 'nanoid';
import { timestamp, type ImapConfig } from '@cold-outreach/shared';
import { OrchestratorService } from './orchestrator.service.js';
import { broadcastToClient } from '../websocket/server.js';

interface DetectedResponse {
  id: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  inReplyTo?: string;
  messageId?: string;
  prospectId?: string;
  sentEmailId?: string;
}

interface ClientImapState {
  clientId: string;
  config: ImapConfig;
  connection: imaps.ImapSimple | null;
  lastPoll: Date | null;
  processedMessageIds: Set<string>;
  isPolling: boolean;
}

export class ImapMonitorService {
  private clientStates: Map<string, ClientImapState> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private orchestrator: OrchestratorService;
  private globalPollIntervalSeconds: number;

  constructor() {
    this.orchestrator = new OrchestratorService();
    // Default poll interval, can be overridden per-client
    this.globalPollIntervalSeconds = parseInt(process.env.IMAP_POLL_INTERVAL || '60', 10);
  }

  /**
   * Load IMAP configurations for all clients from database
   */
  private async loadClientConfigs(): Promise<void> {
    try {
      const clients = await this.orchestrator.listClients();

      for (const client of clients) {
        const emailSettings = await this.orchestrator.getEmailSettings(client.id);

        if (emailSettings?.imapConfig) {
          const existingState = this.clientStates.get(client.id);

          // Only update if config changed or doesn't exist
          if (!existingState || this.configChanged(existingState.config, emailSettings.imapConfig)) {
            // Close existing connection if config changed
            if (existingState?.connection) {
              existingState.connection.end();
            }

            this.clientStates.set(client.id, {
              clientId: client.id,
              config: emailSettings.imapConfig,
              connection: null,
              lastPoll: existingState?.lastPoll || null,
              processedMessageIds: existingState?.processedMessageIds || new Set(),
              isPolling: false,
            });

            console.log(`[ImapMonitor] Loaded config for client ${client.id}: ${emailSettings.imapConfig.host}`);
          }
        } else {
          // Remove state if IMAP is no longer configured
          const existingState = this.clientStates.get(client.id);
          if (existingState) {
            if (existingState.connection) {
              existingState.connection.end();
            }
            this.clientStates.delete(client.id);
            console.log(`[ImapMonitor] Removed config for client ${client.id} (IMAP no longer configured)`);
          }
        }
      }
    } catch (error) {
      console.error('[ImapMonitor] Failed to load client configs:', error);
    }
  }

  private configChanged(oldConfig: ImapConfig, newConfig: ImapConfig): boolean {
    return (
      oldConfig.host !== newConfig.host ||
      oldConfig.port !== newConfig.port ||
      oldConfig.username !== newConfig.username ||
      oldConfig.password !== newConfig.password ||
      oldConfig.mailbox !== newConfig.mailbox
    );
  }

  /**
   * Check if any client has IMAP configured
   */
  hasConfiguredClients(): boolean {
    return this.clientStates.size > 0;
  }

  /**
   * Get number of monitored clients
   */
  getMonitoredClientCount(): number {
    return this.clientStates.size;
  }

  /**
   * Start polling for new emails across all configured clients
   */
  async start(): Promise<void> {
    if (this.pollInterval) {
      console.log('[ImapMonitor] Already running');
      return;
    }

    console.log('[ImapMonitor] Starting email monitoring...');

    // Load initial configs
    await this.loadClientConfigs();

    if (!this.hasConfiguredClients()) {
      console.log('[ImapMonitor] No clients with IMAP configured');
    }

    // Poll immediately on start
    await this.pollAllClients();

    // Set up recurring poll
    this.pollInterval = setInterval(
      async () => {
        // Reload configs periodically to pick up new clients
        await this.loadClientConfigs();
        await this.pollAllClients();
      },
      this.globalPollIntervalSeconds * 1000
    );
  }

  /**
   * Stop polling for new emails
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Close all connections
    for (const state of this.clientStates.values()) {
      if (state.connection) {
        state.connection.end();
        state.connection = null;
      }
    }

    console.log('[ImapMonitor] Stopped');
  }

  /**
   * Poll all configured clients
   */
  private async pollAllClients(): Promise<void> {
    const pollPromises: Promise<void>[] = [];

    for (const state of this.clientStates.values()) {
      if (!state.isPolling) {
        pollPromises.push(this.pollClient(state));
      }
    }

    await Promise.allSettled(pollPromises);
  }

  /**
   * Poll a single client's inbox
   */
  private async pollClient(state: ClientImapState): Promise<void> {
    state.isPolling = true;

    try {
      await this.connectClient(state);
      const newEmails = await this.fetchNewEmails(state);

      for (const email of newEmails) {
        await this.processEmail(email, state.clientId);
      }

      if (newEmails.length > 0) {
        console.log(`[ImapMonitor] Client ${state.clientId}: Processed ${newEmails.length} new emails`);
      }

      state.lastPoll = new Date();
    } catch (error) {
      console.error(`[ImapMonitor] Client ${state.clientId} poll error:`, error);
      // Reset connection on error
      state.connection = null;
    } finally {
      state.isPolling = false;
    }
  }

  /**
   * Connect to IMAP server for a client
   */
  private async connectClient(state: ClientImapState): Promise<void> {
    if (state.connection) {
      return;
    }

    const config: imaps.ImapSimpleOptions = {
      imap: {
        user: state.config.username,
        password: state.config.password,
        host: state.config.host,
        port: state.config.port,
        tls: state.config.secure,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000,
      },
    };

    state.connection = await imaps.connect(config);
    await state.connection.openBox(state.config.mailbox || 'INBOX');

    console.log(`[ImapMonitor] Client ${state.clientId}: Connected to ${state.config.host}`);
  }

  /**
   * Fetch new emails from the inbox
   */
  private async fetchNewEmails(state: ClientImapState): Promise<ParsedMail[]> {
    if (!state.connection) {
      return [];
    }

    // Search for unseen emails from the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const searchCriteria = ['UNSEEN', ['SINCE', yesterday]];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false, // Don't mark as seen automatically
    };

    const messages = await state.connection.search(searchCriteria, fetchOptions);
    const emails: ParsedMail[] = [];

    for (const message of messages) {
      try {
        const all = message.parts.find((part: { which: string }) => part.which === '');
        if (!all?.body) continue;

        const parsed = await simpleParser(all.body);

        // Skip if we've already processed this message
        if (parsed.messageId && state.processedMessageIds.has(parsed.messageId)) {
          continue;
        }

        emails.push(parsed);

        // Mark as processed
        if (parsed.messageId) {
          state.processedMessageIds.add(parsed.messageId);
          // Keep set size manageable
          if (state.processedMessageIds.size > 10000) {
            const toDelete = Array.from(state.processedMessageIds).slice(0, 5000);
            toDelete.forEach(id => state.processedMessageIds.delete(id));
          }
        }
      } catch (err) {
        console.error(`[ImapMonitor] Client ${state.clientId}: Failed to parse email:`, err);
      }
    }

    return emails;
  }

  /**
   * Process a single email to detect if it's a campaign response
   */
  private async processEmail(email: ParsedMail, clientId: string): Promise<void> {
    const fromAddress = email.from?.value?.[0]?.address?.toLowerCase();
    if (!fromAddress) {
      return;
    }

    const subject = email.subject || '';
    const textBody = email.text || '';
    const inReplyTo = email.inReplyTo;
    const receivedAt = email.date?.toISOString() || timestamp();

    console.log(`[ImapMonitor] Client ${clientId}: Processing email from ${fromAddress}: ${subject}`);

    // Try to find matching prospect by email
    const prospect = await this.findProspectByEmail(fromAddress, clientId);
    if (!prospect) {
      console.log(`[ImapMonitor] Client ${clientId}: No matching prospect for ${fromAddress}`);
      return;
    }

    // Try to find matching sent email (by In-Reply-To header or by prospect)
    const sentEmail = await this.findMatchingSentEmail(prospect.id, inReplyTo);

    // Create response record
    const response: DetectedResponse = {
      id: `response-${nanoid(10)}`,
      fromEmail: fromAddress,
      subject,
      body: textBody.substring(0, 5000), // Limit body length
      receivedAt,
      inReplyTo,
      messageId: email.messageId || undefined,
      prospectId: prospect.id,
      sentEmailId: sentEmail?.id,
    };

    // Save response and classify
    await this.saveAndClassifyResponse(response, clientId);
  }

  /**
   * Find a prospect by their email address (for a specific client)
   */
  private async findProspectByEmail(email: string, clientId: string): Promise<{ id: string; clientId: string } | null> {
    // Search prospects by contact email, filtered by client
    const result = await this.orchestrator.listProspects({ clientId, pageSize: 10000 });

    for (const prospect of result.data) {
      const hasMatchingContact = prospect.contacts?.some(
        (c: { email?: string }) => c.email?.toLowerCase() === email
      );
      if (hasMatchingContact) {
        // clientId is passed as a parameter, we know the prospect belongs to this client
        return { id: prospect.id, clientId };
      }
    }

    return null;
  }

  /**
   * Find a sent email that this response is replying to
   */
  private async findMatchingSentEmail(
    prospectId: string,
    inReplyTo?: string
  ): Promise<{ id: string; campaignId: string } | null> {
    const trackingEmails = await this.orchestrator.getProspectTracking(prospectId);

    if (trackingEmails.length === 0) {
      return null;
    }

    // If we have an In-Reply-To header, try to match by message ID
    if (inReplyTo) {
      const matched = trackingEmails.find(e => e.messageId === inReplyTo);
      if (matched) {
        return { id: matched.id, campaignId: matched.campaignId };
      }
    }

    // Otherwise, return the most recent sent email to this prospect
    const sorted = trackingEmails
      .filter(e => e.status === 'sent' || e.status === 'delivered' || e.status === 'opened')
      .sort((a, b) => {
        const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
        const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
        return dateB - dateA;
      });

    return sorted[0] ? { id: sorted[0].id, campaignId: sorted[0].campaignId } : null;
  }

  /**
   * Save response and classify it using the response classifier
   */
  private async saveAndClassifyResponse(
    response: DetectedResponse,
    clientId: string
  ): Promise<void> {
    try {
      // Classify the response using the AI orchestrator
      const classification = await this.orchestrator.classifyEmailResponse(
        response.id,
        {
          subject: response.subject,
          body: response.body,
          from: response.fromEmail,
        }
      );

      // Save response to database
      await this.saveResponse({
        ...response,
        sentiment: classification.sentiment,
        requiresAction: classification.requiresAction,
        suggestedReply: classification.suggestedReply,
      });

      // Update sent email status to 'replied' if we have a matching sent email
      if (response.sentEmailId) {
        await this.orchestrator.markEmailReplied(response.sentEmailId, response.receivedAt);
      }

      // Update prospect status
      if (response.prospectId) {
        await this.orchestrator.updateProspectStatus(response.prospectId, 'responded');
      }

      // Broadcast response via WebSocket (only if we have prospect info)
      if (response.prospectId) {
        broadcastToClient(clientId, {
          type: 'new_response',
          response: {
            id: response.id,
            prospectId: response.prospectId,
            fromEmail: response.fromEmail,
            subject: response.subject,
            sentiment: classification.sentiment,
            requiresAction: classification.requiresAction,
            receivedAt: response.receivedAt,
          },
          timestamp: timestamp(),
        });
      }

      console.log(
        `[ImapMonitor] Client ${clientId}: Response classified as ${classification.sentiment}`,
        classification.requiresAction ? '(requires action)' : ''
      );
    } catch (error) {
      console.error(`[ImapMonitor] Client ${clientId}: Failed to classify response:`, error);
    }
  }

  /**
   * Save response to database
   */
  private async saveResponse(response: DetectedResponse & {
    sentiment?: string;
    requiresAction?: boolean;
    suggestedReply?: string;
  }): Promise<void> {
    await this.orchestrator.saveResponse({
      id: response.id,
      sentEmailId: response.sentEmailId,
      prospectId: response.prospectId || '',
      fromEmail: response.fromEmail,
      subject: response.subject,
      body: response.body,
      sentiment: response.sentiment,
      requiresAction: response.requiresAction,
      suggestedReply: response.suggestedReply,
      receivedAt: response.receivedAt,
    });

    console.log('[ImapMonitor] Response saved:', {
      id: response.id,
      prospectId: response.prospectId,
      sentiment: response.sentiment,
    });
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    running: boolean;
    clientCount: number;
    clients: Array<{
      clientId: string;
      host: string;
      connected: boolean;
      lastPoll: Date | null;
      processedCount: number;
    }>;
  } {
    const clients = Array.from(this.clientStates.values()).map(state => ({
      clientId: state.clientId,
      host: state.config.host,
      connected: state.connection !== null,
      lastPoll: state.lastPoll,
      processedCount: state.processedMessageIds.size,
    }));

    return {
      running: this.pollInterval !== null,
      clientCount: this.clientStates.size,
      clients,
    };
  }

  /**
   * Manually trigger a poll for a specific client
   */
  async pollClientById(clientId: string): Promise<{ success: boolean; error?: string }> {
    const state = this.clientStates.get(clientId);
    if (!state) {
      // Try to load config
      const emailSettings = await this.orchestrator.getEmailSettings(clientId);
      if (!emailSettings?.imapConfig) {
        return { success: false, error: 'No IMAP configuration for this client' };
      }

      this.clientStates.set(clientId, {
        clientId,
        config: emailSettings.imapConfig,
        connection: null,
        lastPoll: null,
        processedMessageIds: new Set(),
        isPolling: false,
      });
    }

    const clientState = this.clientStates.get(clientId)!;
    if (clientState.isPolling) {
      return { success: false, error: 'Already polling' };
    }

    await this.pollClient(clientState);
    return { success: true };
  }
}

// Singleton instance
let imapMonitorInstance: ImapMonitorService | null = null;

export function getImapMonitor(): ImapMonitorService {
  if (!imapMonitorInstance) {
    imapMonitorInstance = new ImapMonitorService();
  }
  return imapMonitorInstance;
}
