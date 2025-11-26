import { Orchestrator } from '../orchestrator.js';
import { AgentFSManager } from '../storage/agentfs-manager.js';
import type {
  ProspectData,
  ICPResult,
  EmailSequence,
  EmailData,
} from '../types/index.js';

/**
 * Outreach Agent
 * Responsible for generating personalized email sequences
 */
export class OutreachAgent {
  private orchestrator: Orchestrator;
  private storage: AgentFSManager | null = null;
  private clientId: string;

  constructor(orchestrator: Orchestrator, clientId: string) {
    this.orchestrator = orchestrator;
    this.clientId = clientId;
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.storage = await this.orchestrator.getStorage(this.clientId);
  }

  /**
   * Generate email sequences for a list of prospects
   */
  async generateCampaignEmails(
    campaignId: string,
    prospects: ProspectData[],
    icp: ICPResult
  ): Promise<EmailSequence[]> {
    if (!this.storage) {
      await this.initialize();
    }

    const sequences: EmailSequence[] = [];

    for (const prospect of prospects) {
      console.log(`[Outreach] Generating emails for: ${prospect.companyName}`);
      
      const sequence = await this.generateEmailSequence(prospect, icp);
      sequences.push(sequence);

      // Save each email
      for (const email of sequence.emails) {
        await this.storage!.saveEmail(
          campaignId,
          prospect.id,
          email.sequence,
          email
        );
      }
    }

    return sequences;
  }

  /**
   * Generate email sequence for a single prospect
   */
  async generateEmailSequence(
    prospect: ProspectData,
    icp: ICPResult
  ): Promise<EmailSequence> {
    const emails = await this.orchestrator.generateEmailSequence(
      this.clientId,
      prospect,
      icp
    ) as Array<Record<string, unknown>>;

    const emailData: EmailData[] = emails.map((email) => ({
      sequence: Number(email.sequence || 1),
      subject: String(email.subject || ''),
      body: String(email.body || ''),
      delayDays: Number(email.delay_days || 0),
    }));

    return {
      prospectId: prospect.id,
      emails: emailData,
    };
  }

  /**
   * Personalize an email template for a specific prospect
   */
  async personalizeEmail(
    template: { subject: string; body: string },
    prospect: ProspectData,
    _icp: ICPResult
  ): Promise<{ subject: string; body: string }> {
    const systemPrompt = `You are an expert at personalizing cold emails.
Take the template and customize it specifically for the prospect.
Keep the core message but add personalization based on the prospect's company details.`;

    const prompt = `Personalize this email template for the prospect:

Template:
Subject: ${template.subject}
Body: ${template.body}

Prospect Details:
Company: ${prospect.companyName}
Industry: ${prospect.industry}
Location: ${prospect.location.city}, ${prospect.location.state}
Contact: ${prospect.contacts[0]?.name || 'Decision Maker'} (${prospect.contacts[0]?.title || 'Executive'})
${prospect.description ? `Description: ${prospect.description}` : ''}
${prospect.painPoints?.length ? `Pain Points: ${prospect.painPoints.join(', ')}` : ''}
${prospect.recentNews ? `Recent News: ${prospect.recentNews}` : ''}

Return the personalized email in JSON format:
{
  "subject": "Personalized subject line",
  "body": "Personalized email body"
}`;

    const result = await this.orchestrator.runPrompt(prompt, { systemPrompt });

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const personalized = JSON.parse(jsonMatch[0]) as { subject: string; body: string };
        return personalized;
      }
    } catch {
      // Return template if personalization fails
    }

    return template;
  }

  /**
   * Check email quality and suggest improvements
   */
  async checkEmailQuality(
    email: { subject: string; body: string }
  ): Promise<{
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    const systemPrompt = `You are an expert at evaluating cold email effectiveness.
Analyze the email and provide a quality score and feedback.`;

    const prompt = `Evaluate this cold email:

Subject: ${email.subject}
Body: ${email.body}

Provide evaluation in JSON format:
{
  "score": 0-100,
  "issues": ["List of problems with the email"],
  "suggestions": ["List of improvement suggestions"]
}

Consider:
- Subject line effectiveness
- Personalization level
- Value proposition clarity
- Call to action strength
- Length appropriateness
- Spam trigger words
- Professional tone`;

    const result = await this.orchestrator.runPrompt(prompt, { systemPrompt });

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const evaluation = JSON.parse(jsonMatch[0]) as {
          score: number;
          issues: string[];
          suggestions: string[];
        };
        return evaluation;
      }
    } catch {
      // Return default if evaluation fails
    }

    return {
      score: 70,
      issues: [],
      suggestions: ['Unable to evaluate email'],
    };
  }

  /**
   * Generate A/B test variants
   */
  async generateVariants(
    email: { subject: string; body: string },
    numVariants: number = 2
  ): Promise<Array<{ subject: string; body: string; variant: string }>> {
    const systemPrompt = `You are an expert at A/B testing cold emails.
Create variants that test different approaches while maintaining the core message.`;

    const prompt = `Create ${numVariants} A/B test variants of this email:

Original:
Subject: ${email.subject}
Body: ${email.body}

Return variants in JSON format:
[
  {
    "subject": "Variant subject",
    "body": "Variant body",
    "variant": "A/B test hypothesis being tested"
  }
]

Test different:
- Subject line styles (question vs statement, personalization)
- Opening hooks
- Value proposition angles
- Call to action approaches`;

    const result = await this.orchestrator.runPrompt(prompt, { systemPrompt });

    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Array<{
          subject: string;
          body: string;
          variant: string;
        }>;
      }
    } catch {
      // Return empty array if generation fails
    }

    return [];
  }
}

