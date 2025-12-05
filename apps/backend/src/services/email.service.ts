import { Resend } from 'resend';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { SentEmail, EmailTemplate, Prospect } from '@cold-outreach/shared';
import { timestamp } from '@cold-outreach/shared';

// Transport type for email sending
type TransportType = 'resend' | 'smtp' | 'simulation';

// Rate limiting configuration
interface RateLimitConfig {
  maxPerHour: number;
  maxPerDay: number;
  minDelayMs: number;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  metadata: {
    campaignId: string;
    prospectId: string;
    sequenceNumber: number;
  };
  replyTo?: string;
}

// Client-specific email configuration (from database)
export interface ClientEmailConfig {
  provider: 'resend' | 'sendgrid' | 'smtp' | 'mailgun';
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  apiKey?: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  signature?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface QueuedEmail {
  id: string;
  options: SendEmailOptions;
  scheduledAt: Date;
  attempts: number;
}

export class EmailService {
  private resend: Resend | null = null;
  private smtpTransport: Transporter | null = null;
  private transportType: TransportType = 'simulation';
  private sentThisHour = 0;
  private sentToday = 0;
  private hourResetTime = Date.now() + 3600000;
  private dayResetTime = Date.now() + 86400000;
  private queue: QueuedEmail[] = [];
  private processing = false;

  private config: RateLimitConfig = {
    maxPerHour: 50,
    maxPerDay: 200,
    minDelayMs: 5000, // 5 seconds between emails
  };

  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'outreach@yourdomain.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Outreach';

    // Try to configure Resend first
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      this.transportType = 'resend';
      console.log('[EmailService] Configured with Resend transport');
    }
    // Fall back to SMTP if Resend not configured
    else if (process.env.SMTP_HOST) {
      this.smtpTransport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
      this.transportType = 'smtp';
      console.log('[EmailService] Configured with SMTP transport');
    } else {
      this.transportType = 'simulation';
      console.log('[EmailService] No email transport configured, using simulation mode');
    }
  }

  /**
   * Get the current transport type
   */
  getTransportType(): TransportType {
    return this.transportType;
  }

  /**
   * Configure rate limits
   */
  setRateLimits(config: Partial<RateLimitConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if we can send an email now
   */
  private canSend(): { allowed: boolean; waitTime?: number; reason?: string } {
    this.resetCountersIfNeeded();

    if (this.sentToday >= this.config.maxPerDay) {
      return {
        allowed: false,
        waitTime: this.dayResetTime - Date.now(),
        reason: 'Daily limit reached',
      };
    }

    if (this.sentThisHour >= this.config.maxPerHour) {
      return {
        allowed: false,
        waitTime: this.hourResetTime - Date.now(),
        reason: 'Hourly limit reached',
      };
    }

    return { allowed: true };
  }

  private resetCountersIfNeeded() {
    const now = Date.now();
    
    if (now >= this.hourResetTime) {
      this.sentThisHour = 0;
      this.hourResetTime = now + 3600000;
    }
    
    if (now >= this.dayResetTime) {
      this.sentToday = 0;
      this.dayResetTime = now + 86400000;
    }
  }

  /**
   * Send a single email immediately (respecting rate limits)
   */
  async sendEmail(options: SendEmailOptions): Promise<SendResult> {
    const canSendResult = this.canSend();

    if (!canSendResult.allowed) {
      return {
        success: false,
        error: canSendResult.reason,
      };
    }

    // Route to appropriate transport
    switch (this.transportType) {
      case 'resend':
        return this.sendViaResend(options);
      case 'smtp':
        return this.sendViaSMTP(options);
      case 'simulation':
      default:
        console.log('[EmailService] Simulating send:', options.to);
        return this.simulateSend(options);
    }
  }

  /**
   * Send email using client-specific configuration (from database)
   * This method creates a dynamic transport based on the client's email settings
   */
  async sendWithClientConfig(
    options: SendEmailOptions,
    clientConfig: ClientEmailConfig
  ): Promise<SendResult> {
    const canSendResult = this.canSend();

    if (!canSendResult.allowed) {
      return {
        success: false,
        error: canSendResult.reason,
      };
    }

    const from = `${clientConfig.fromName} <${clientConfig.fromEmail}>`;
    const replyTo = options.replyTo || clientConfig.replyToEmail;

    // Append signature if configured
    let html = options.html;
    let text = options.text;
    if (clientConfig.signature) {
      html = `${html}<br><br>${clientConfig.signature}`;
      text = text ? `${text}\n\n${clientConfig.signature}` : undefined;
    }

    // Route based on client's configured provider
    switch (clientConfig.provider) {
      case 'resend':
        return this.sendViaResendWithConfig(options, from, replyTo, html, text, clientConfig.apiKey);
      case 'smtp':
        return this.sendViaSMTPWithConfig(options, from, replyTo, html, text, clientConfig.smtpConfig);
      case 'sendgrid':
      case 'mailgun':
        // These could be implemented similarly if needed
        console.log(`[EmailService] Provider ${clientConfig.provider} not implemented, using simulation`);
        return this.simulateSend(options);
      default:
        console.log('[EmailService] No valid provider, simulating send');
        return this.simulateSend(options);
    }
  }

  /**
   * Send via Resend with client-specific API key
   */
  private async sendViaResendWithConfig(
    options: SendEmailOptions,
    from: string,
    replyTo: string | undefined,
    html: string,
    text: string | undefined,
    apiKey?: string
  ): Promise<SendResult> {
    if (!apiKey) {
      return { success: false, error: 'Resend API key not configured for this client' };
    }

    try {
      // Create a new Resend instance with client's API key
      const clientResend = new Resend(apiKey);

      const result = await clientResend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html,
        text,
        replyTo,
        headers: {
          'X-Campaign-ID': options.metadata.campaignId,
          'X-Prospect-ID': options.metadata.prospectId,
          'X-Sequence-Number': options.metadata.sequenceNumber.toString(),
        },
      });

      this.sentThisHour++;
      this.sentToday++;

      if (result.error) {
        return {
          success: false,
          error: result.error.message,
        };
      }

      console.log(`[EmailService] Sent via Resend to ${options.to} (client config)`);
      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      console.error('[EmailService] Resend (client config) failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send via SMTP with client-specific configuration
   */
  private async sendViaSMTPWithConfig(
    options: SendEmailOptions,
    from: string,
    replyTo: string | undefined,
    html: string,
    text: string | undefined,
    smtpConfig?: ClientEmailConfig['smtpConfig']
  ): Promise<SendResult> {
    if (!smtpConfig) {
      return { success: false, error: 'SMTP configuration not provided for this client' };
    }

    try {
      // Create a dynamic transport with client's SMTP settings
      const transport = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.username,
          pass: smtpConfig.password,
        },
      });

      const info = await transport.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html,
        text,
        replyTo,
        headers: {
          'X-Campaign-ID': options.metadata.campaignId,
          'X-Prospect-ID': options.metadata.prospectId,
          'X-Sequence-Number': options.metadata.sequenceNumber.toString(),
        },
      });

      // Close the transport after sending
      transport.close();

      this.sentThisHour++;
      this.sentToday++;

      console.log(`[EmailService] Sent via SMTP to ${options.to} (client config: ${smtpConfig.host})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('[EmailService] SMTP (client config) failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send email via Resend API
   */
  private async sendViaResend(options: SendEmailOptions): Promise<SendResult> {
    if (!this.resend) {
      return { success: false, error: 'Resend not configured' };
    }

    try {
      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        headers: {
          'X-Campaign-ID': options.metadata.campaignId,
          'X-Prospect-ID': options.metadata.prospectId,
          'X-Sequence-Number': options.metadata.sequenceNumber.toString(),
        },
      });

      this.sentThisHour++;
      this.sentToday++;

      if (result.error) {
        return {
          success: false,
          error: result.error.message,
        };
      }

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      console.error('[EmailService] Resend failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send email via SMTP (nodemailer)
   */
  private async sendViaSMTP(options: SendEmailOptions): Promise<SendResult> {
    if (!this.smtpTransport) {
      return { success: false, error: 'SMTP not configured' };
    }

    try {
      const info = await this.smtpTransport.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        headers: {
          'X-Campaign-ID': options.metadata.campaignId,
          'X-Prospect-ID': options.metadata.prospectId,
          'X-Sequence-Number': options.metadata.sequenceNumber.toString(),
        },
      });

      this.sentThisHour++;
      this.sentToday++;

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('[EmailService] SMTP failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Simulate sending for development/testing
   */
  private simulateSend(options: SendEmailOptions): SendResult {
    this.sentThisHour++;
    this.sentToday++;
    
    return {
      success: true,
      messageId: `sim-${nanoid(20)}`,
    };
  }

  /**
   * Queue an email for later sending
   */
  queueEmail(options: SendEmailOptions, scheduledAt?: Date): string {
    const id = `email-${nanoid(10)}`;
    
    this.queue.push({
      id,
      options,
      scheduledAt: scheduledAt || new Date(),
      attempts: 0,
    });

    if (!this.processing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Process queued emails
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      const canSendResult = this.canSend();
      
      if (!canSendResult.allowed) {
        // Wait until we can send again
        const waitTime = canSendResult.waitTime || 60000;
        console.log(`[EmailService] Rate limited, waiting ${waitTime}ms`);
        await this.delay(Math.min(waitTime, 60000));
        continue;
      }

      // Get next email that's ready to send
      const now = new Date();
      const readyIndex = this.queue.findIndex(e => e.scheduledAt <= now);
      
      if (readyIndex === -1) {
        // No emails ready, wait a bit
        await this.delay(1000);
        continue;
      }

      const email = this.queue.splice(readyIndex, 1)[0];
      
      const result = await this.sendEmail(email.options);
      
      if (!result.success && email.attempts < 3) {
        // Retry with exponential backoff
        email.attempts++;
        email.scheduledAt = new Date(Date.now() + Math.pow(2, email.attempts) * 60000);
        this.queue.push(email);
      }

      // Wait minimum delay between sends
      await this.delay(this.config.minDelayMs);
    }

    this.processing = false;
  }

  /**
   * Send a batch of emails for a campaign
   */
  async sendCampaignBatch(
    campaignId: string,
    emails: Array<{
      prospect: Prospect;
      template: EmailTemplate;
      sequenceNumber: number;
    }>,
    options?: { delayMs?: number }
  ): Promise<Array<{ prospectId: string; result: SendResult }>> {
    const results: Array<{ prospectId: string; result: SendResult }> = [];
    const delayMs = options?.delayMs || this.config.minDelayMs;

    for (const emailData of emails) {
      const { prospect, template, sequenceNumber } = emailData;
      
      const primaryContact = prospect.contacts.find(c => c.isPrimary) || prospect.contacts[0];
      if (!primaryContact?.email) {
        results.push({
          prospectId: prospect.id,
          result: { success: false, error: 'No email address' },
        });
        continue;
      }

      const result = await this.sendEmail({
        to: primaryContact.email,
        subject: template.subject,
        html: template.bodyHtml,
        text: template.bodyText,
        metadata: {
          campaignId,
          prospectId: prospect.id,
          sequenceNumber,
        },
      });

      results.push({ prospectId: prospect.id, result });

      // Delay between sends
      await this.delay(delayMs);
    }

    return results;
  }

  /**
   * Generate personalized email from template
   */
  generateEmail(
    template: EmailTemplate,
    prospect: Prospect,
    variables: Record<string, string> = {}
  ): { subject: string; bodyHtml: string; bodyText: string } {
    const contact = prospect.contacts.find(c => c.isPrimary) || prospect.contacts[0];
    
    const defaultVars: Record<string, string> = {
      first_name: contact?.name?.split(' ')[0] || 'there',
      full_name: contact?.name || 'there',
      company_name: prospect.companyName || 'your company',
      company: prospect.companyName || 'your company', // Alias for company_name
      title: contact?.title || 'your role',
      industry: prospect.industry || 'your industry',
      city: prospect.location?.city || 'your area',
      state: prospect.location?.state || '',
    };

    const allVars = { ...defaultVars, ...variables };

    let subject = template.subject;
    let bodyHtml = template.bodyHtml;
    let bodyText = template.bodyText || '';

    // Replace variables in template
    for (const [key, value] of Object.entries(allVars)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      subject = subject.replace(regex, value);
      bodyHtml = bodyHtml.replace(regex, value);
      bodyText = bodyText.replace(regex, value);
    }

    return { subject, bodyHtml, bodyText };
  }

  /**
   * Create a SentEmail record
   */
  createSentEmailRecord(
    options: SendEmailOptions,
    result: SendResult
  ): SentEmail {
    const now = timestamp();
    
    return {
      id: `email-${nanoid(10)}`,
      campaignId: options.metadata.campaignId,
      prospectId: options.metadata.prospectId,
      messageId: result.messageId || '',
      sequenceNumber: options.metadata.sequenceNumber,
      subject: options.subject,
      status: result.success ? 'sent' : 'failed',
      sentAt: now,
      ...(result.error && { error: result.error }),
    };
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus() {
    this.resetCountersIfNeeded();
    
    return {
      sentThisHour: this.sentThisHour,
      maxPerHour: this.config.maxPerHour,
      sentToday: this.sentToday,
      maxPerDay: this.config.maxPerDay,
      queueSize: this.queue.length,
      canSend: this.canSend().allowed,
    };
  }

  /**
   * Clear the email queue
   */
  clearQueue() {
    this.queue = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

