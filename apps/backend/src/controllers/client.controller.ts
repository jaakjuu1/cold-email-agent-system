import type { Request, Response, NextFunction } from 'express';
import { OrchestratorService } from '../services/orchestrator.service.js';
import { AppError } from '../middleware/error.middleware.js';
import type { CreateClientInput, DiscoveryPhase, DiscoveryStatus, DiscoveryProgressEvent } from '@cold-outreach/shared';
import { broadcastToClient } from '../websocket/server.js';

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
    const { id } = req.params;
    const { websiteUrl } = req.body;

    if (!id) {
      return next(new AppError('Client ID is required', 400));
    }

    const clientId = id;

    try {
      // Create progress callback that broadcasts via WebSocket
      const onProgress = (
        phase: DiscoveryPhase,
        status: DiscoveryStatus,
        message?: string
      ) => {
        const event: DiscoveryProgressEvent = {
          type: 'discovery_progress',
          clientId,
          phase,
          status,
          message,
          timestamp: new Date().toISOString(),
        };

        // Broadcast to all clients subscribed to this client's room
        broadcastToClient(clientId, event);

        // Structured logging
        console.log(JSON.stringify({
          timestamp: event.timestamp,
          level: 'info',
          component: 'ClientController',
          event: 'discovery_progress',
          clientId,
          phase,
          status,
          message,
        }));
      };

      // Trigger discovery with progress callback
      const icp = await orchestrator.discoverClient(clientId, websiteUrl, onProgress);

      res.json({
        success: true,
        data: icp,
        message: 'Business discovery completed',
      });
    } catch (error) {
      // Emit failed status before passing to error handler
      const failEvent: DiscoveryProgressEvent = {
        type: 'discovery_progress',
        clientId,
        phase: 'generating_icp',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Discovery failed',
        timestamp: new Date().toISOString(),
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
      broadcastToClient(clientId, failEvent);

      console.log(JSON.stringify({
        timestamp: failEvent.timestamp,
        level: 'error',
        component: 'ClientController',
        event: 'discovery_failed',
        clientId,
        error: failEvent.message,
      }));

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

