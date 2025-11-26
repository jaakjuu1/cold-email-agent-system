import type { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service.js';

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  async getDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const dashboard = await analyticsService.getDashboardMetrics();
      
      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const analytics = await analyticsService.getCampaignAnalytics(id);
      
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDailyMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      
      const metrics = await analyticsService.getDailyMetrics(
        id,
        startDate as string,
        endDate as string
      );
      
      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getResponseAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { campaignId } = req.query;
      const analytics = await analyticsService.getResponseAnalytics(campaignId as string);
      
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getFunnelData(req: Request, res: Response, next: NextFunction) {
    try {
      const { campaignId } = req.query;
      const funnel = await analyticsService.getFunnelData(campaignId as string);
      
      res.json({
        success: true,
        data: funnel,
      });
    } catch (error) {
      next(error);
    }
  }
}

