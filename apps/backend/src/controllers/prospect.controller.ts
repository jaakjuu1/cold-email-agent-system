import type { Request, Response, NextFunction } from 'express';
import { OrchestratorService } from '../services/orchestrator.service.js';
import { AppError } from '../middleware/error.middleware.js';

const orchestrator = new OrchestratorService();

export class ProspectController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientId, status, industry, location, page, pageSize } = req.query;
      
      const prospects = await orchestrator.listProspects({
        clientId: clientId as string,
        status: status as string,
        industry: industry as string,
        location: location as string,
        page: page ? parseInt(page as string, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : 20,
      });
      
      res.json({
        success: true,
        data: prospects,
      });
    } catch (error) {
      next(error);
    }
  }

  async discover(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientId, phase, locations, industries, limit } = req.body;
      
      // This will trigger the lead discovery agent
      const result = await orchestrator.discoverLeads({
        clientId,
        phase,
        locations,
        industries,
        limit,
      });
      
      res.json({
        success: true,
        data: result,
        message: 'Lead discovery started',
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const prospect = await orchestrator.getProspect(id);
      
      if (!prospect) {
        throw new AppError('Prospect not found', 404);
      }
      
      res.json({
        success: true,
        data: prospect,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const prospect = await orchestrator.updateProspect(id, req.body);
      
      res.json({
        success: true,
        data: prospect,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await orchestrator.deleteProspect(id);
      
      res.json({
        success: true,
        message: 'Prospect deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async enrich(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const prospect = await orchestrator.enrichProspect(id);
      
      res.json({
        success: true,
        data: prospect,
        message: 'Prospect enriched successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getTracking(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tracking = await orchestrator.getProspectTracking(id);
      
      res.json({
        success: true,
        data: tracking,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const prospect = await orchestrator.updateProspectStatus(id, status);

      res.json({
        success: true,
        data: prospect,
      });
    } catch (error) {
      next(error);
    }
  }

  async deepResearch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { phases, depth, breadth, focus } = req.body;

      console.log(`[DeepResearch] Received phases from frontend:`, phases);
      console.log(`[DeepResearch] Request body:`, req.body);

      // Build config from request body
      const config = {
        phases: phases || ['company', 'contacts', 'contact_discovery', 'market'],
        depth: depth ?? 2,
        breadth: breadth ?? 3,
        focus: focus || 'sales',
      };

      console.log(`[DeepResearch] Final config phases:`, config.phases);

      const result = await orchestrator.startDeepResearch(id, config);

      res.json({
        success: true,
        data: result,
        message: 'Deep research started',
      });
    } catch (error) {
      next(error);
    }
  }

  async getDeepResearch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const result = await orchestrator.getDeepResearchResults(id);

      if (!result) {
        res.json({
          success: true,
          data: null,
          message: 'No deep research results available',
        });
        return;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

