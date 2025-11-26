import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

const router = Router();
const controller = new WebhookController();

// Email delivery webhook (from Resend/SendGrid)
router.post('/email/delivered', controller.emailDelivered);

// Email bounce webhook
router.post('/email/bounced', controller.emailBounced);

// Email open tracking webhook
router.post('/email/opened', controller.emailOpened);

// Email click tracking webhook
router.post('/email/clicked', controller.emailClicked);

// Email complaint/spam webhook
router.post('/email/complained', controller.emailComplained);

export default router;

