import type { Request, Response, NextFunction } from 'express';
import { OrchestratorService } from '../services/orchestrator.service.js';
import { AppError } from '../middleware/error.middleware.js';
import type { CreateClientInput } from '@cold-outreach/shared';

const orchestrator = new OrchestratorService();

export class ClientController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input: CreateClientInput = req.body;
      const client = await orchestrator.createClient(input);
      
      res.status(201).json({
        success: true,
        data: client,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const clients = await orchestrator.listClients();
      
      res.json({
        success: true,
        data: clients,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const client = await orchestrator.getClient(id);
      
      if (!client) {
        throw new AppError('Client not found', 404);
      }
      
      res.json({
        success: true,
        data: client,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const client = await orchestrator.updateClient(id, req.body);
      
      res.json({
        success: true,
        data: client,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await orchestrator.deleteClient(id);
      
      res.json({
        success: true,
        message: 'Client deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async discoverBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { websiteUrl } = req.body;
      
      // This will trigger the client discovery agent
      const icp = await orchestrator.discoverClient(id, websiteUrl);
      
      res.json({
        success: true,
        data: icp,
        message: 'Business discovery completed',
      });
    } catch (error) {
      next(error);
    }
  }

  async getICP(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const icp = await orchestrator.getClientICP(id);
      
      if (!icp) {
        throw new AppError('ICP not found. Please run business discovery first.', 404);
      }
      
      res.json({
        success: true,
        data: icp,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateICP(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const icp = await orchestrator.updateClientICP(id, req.body);
      
      res.json({
        success: true,
        data: icp,
        message: 'ICP updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async approveICP(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const icp = await orchestrator.approveClientICP(id);
      
      res.json({
        success: true,
        data: icp,
        message: 'ICP approved successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

