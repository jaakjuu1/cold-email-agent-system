import { Router } from 'express';
import { ClientController } from '../controllers/client.controller.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { CreateClientSchema, CreateEmailSettingsSchema, UpdateEmailSettingsSchema } from '@cold-outreach/shared';
import { z } from 'zod';

const router = Router();
const controller = new ClientController();

// Create a new client
router.post(
  '/',
  validateBody(CreateClientSchema),
  controller.create
);

// Get all clients
router.get('/', controller.list);

// Get a single client
router.get('/:id', controller.getById);

// Update a client
router.put('/:id', controller.update);

// Delete a client
router.delete('/:id', controller.delete);

// Discover client business (analyze website, generate ICP)
router.post(
  '/:id/discover',
  validateBody(z.object({ websiteUrl: z.string().url() })),
  controller.discoverBusiness
);

// Get client's ICP
router.get('/:id/icp', controller.getICP);

// Update/refine ICP
router.put('/:id/icp', controller.updateICP);

// Approve ICP
router.post('/:id/icp/approve', controller.approveICP);

// Email Settings routes
router.get('/:id/email-settings', controller.getEmailSettings);
router.post(
  '/:id/email-settings',
  validateBody(CreateEmailSettingsSchema.omit({ clientId: true })),
  controller.createEmailSettings
);
router.put(
  '/:id/email-settings',
  validateBody(UpdateEmailSettingsSchema),
  controller.updateEmailSettings
);
router.delete('/:id/email-settings', controller.deleteEmailSettings);

export default router;

