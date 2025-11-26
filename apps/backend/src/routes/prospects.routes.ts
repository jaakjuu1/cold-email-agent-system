import { Router } from 'express';
import { ProspectController } from '../controllers/prospect.controller.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { z } from 'zod';

const router = Router();
const controller = new ProspectController();

// Get all prospects (with filtering)
router.get('/', controller.list);

// Start lead discovery
router.post(
  '/discover',
  validateBody(z.object({
    clientId: z.string(),
    phase: z.string().optional(),
    locations: z.array(z.object({
      city: z.string(),
      state: z.string(),
      country: z.string(),
    })).optional(),
    industries: z.array(z.string()).optional(),
    limit: z.number().optional(),
  })),
  controller.discover
);

// Get a single prospect
router.get('/:id', controller.getById);

// Update a prospect
router.put('/:id', controller.update);

// Delete a prospect
router.delete('/:id', controller.delete);

// Enrich a prospect (fetch additional data)
router.post('/:id/enrich', controller.enrich);

// Get prospect's tracking history
router.get('/:id/tracking', controller.getTracking);

// Manually update prospect status
router.put('/:id/status', controller.updateStatus);

export default router;

