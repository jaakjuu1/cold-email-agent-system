import type { Request, Response, NextFunction } from 'express';
import { OrchestratorService } from '../services/orchestrator.service.js';
import { AppError } from '../middleware/error.middleware.js';
import type { CreateCampaignInput } from '@cold-outreach/shared';

const orchestrator = new OrchestratorService();

export class CampaignController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input: CreateCampaignInput = req.body;
      const campaign = await orchestrator.createCampaign(input);
      
      res.status(201).json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientId, status } = req.query;
      const campaigns = await orchestrator.listCampaigns({
        clientId: clientId as string,
        status: status as string,
      });
      
      res.json({
        success: true,
        data: campaigns,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const campaign = await orchestrator.getCampaign(id);
      
      if (!campaign) {
        throw new AppError('Campaign not found', 404);
      }
      
      res.json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const campaign = await orchestrator.updateCampaign(id, req.body);
      
      res.json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await orchestrator.deleteCampaign(id);
      
      res.json({
        success: true,
        message: 'Campaign deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const campaign = await orchestrator.startCampaign(id);
      
      res.json({
        success: true,
        data: campaign,
        message: 'Campaign started successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const campaign = await orchestrator.pauseCampaign(id);
      
      res.json({
        success: true,
        data: campaign,
        message: 'Campaign paused',
      });
    } catch (error) {
      next(error);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const campaign = await orchestrator.resumeCampaign(id);
      
      res.json({
        success: true,
        data: campaign,
        message: 'Campaign resumed',
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const stats = await orchestrator.getCampaignStats(id);
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProspects(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const prospects = await orchestrator.getCampaignProspects(id);
      
      res.json({
        success: true,
        data: prospects,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEmails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const emails = await orchestrator.getCampaignEmails(id);
      
      res.json({
        success: true,
        data: emails,
      });
    } catch (error) {
      next(error);
    }
  }

  async generateEmails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await orchestrator.generateCampaignEmails(id);
      
      res.json({
        success: true,
        message: 'Email generation started',
      });
    } catch (error) {
      next(error);
    }
  }
}

