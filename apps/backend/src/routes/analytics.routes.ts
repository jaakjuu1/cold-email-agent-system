import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const router = Router();
const controller = new AnalyticsController();

// Get dashboard overview
router.get('/dashboard', controller.getDashboard);

// Get campaign analytics
router.get('/campaign/:id', controller.getCampaignAnalytics);

// Get daily metrics for a campaign
router.get('/campaign/:id/daily', controller.getDailyMetrics);

// Get response analytics
router.get('/responses', controller.getResponseAnalytics);

// Get prospect funnel data
router.get('/funnel', controller.getFunnelData);

export default router;

