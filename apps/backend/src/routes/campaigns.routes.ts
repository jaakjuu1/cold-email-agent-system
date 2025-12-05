import { Router } from 'express';
import { CampaignController } from '../controllers/campaign.controller.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { CreateCampaignSchema } from '@cold-outreach/shared';

const router = Router();
const controller = new CampaignController();

// Get all campaigns
router.get('/', controller.list);

// Create a new campaign
router.post(
  '/',
  validateBody(CreateCampaignSchema),
  controller.create
);

// Get a single campaign
router.get('/:id', controller.getById);

// Update a campaign
router.put('/:id', controller.update);

// Delete a campaign
router.delete('/:id', controller.delete);

// Start a campaign (begin sending emails)
router.post('/:id/start', controller.start);

// Pause a campaign
router.post('/:id/pause', controller.pause);

// Resume a paused campaign
router.post('/:id/resume', controller.resume);

// Get campaign statistics
router.get('/:id/stats', controller.getStats);

// Get prospects in a campaign
router.get('/:id/prospects', controller.getProspects);

// Get emails in a campaign
router.get('/:id/emails', controller.getEmails);

// Generate emails for campaign (using AI)
router.post('/:id/generate-emails', controller.generateEmails);

// Generate AI-powered personalized emails (new)
router.post('/generate-ai-emails', controller.generateAIEmails);

// Validate placeholders for templates against prospects
router.post('/validate-placeholders', controller.validatePlaceholders);

export default router;

