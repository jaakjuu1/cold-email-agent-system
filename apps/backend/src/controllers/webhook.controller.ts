import type { Request, Response, NextFunction } from 'express';
import { OrchestratorService } from '../services/orchestrator.service.js';
import { broadcastToCampaign } from '../websocket/server.js';

const orchestrator = new OrchestratorService();

export class WebhookController {
  async emailDelivered(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId, timestamp } = req.body;
      
      const email = await orchestrator.markEmailDelivered(messageId, timestamp);
      
      if (email) {
        broadcastToCampaign(email.campaignId, {
          type: 'email_sent',
          email,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async emailBounced(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId, bounceType, bounceReason, timestamp } = req.body;
      
      const email = await orchestrator.markEmailBounced(
        messageId,
        bounceType,
        bounceReason,
        timestamp
      );
      
      if (email) {
        broadcastToCampaign(email.campaignId, {
          type: 'email_bounced',
          email,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async emailOpened(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId, timestamp, userAgent, ip } = req.body;
      
      await orchestrator.markEmailOpened(messageId, timestamp, { userAgent, ip });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async emailClicked(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId, timestamp, link, userAgent, ip } = req.body;
      
      await orchestrator.markEmailClicked(messageId, timestamp, link, { userAgent, ip });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async emailComplained(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId, timestamp, complaintType } = req.body;
      
      await orchestrator.markEmailComplained(messageId, timestamp, complaintType);
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

