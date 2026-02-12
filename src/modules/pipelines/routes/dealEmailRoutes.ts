/**
 * Deal Email Routes
 * 
 * API routes for email-deal linking functionality
 */

import { Router } from 'express';
import { dealEmailController } from '../controllers/dealEmailController';

const router = Router();

// Get emails linked to a deal
router.get('/deals/:dealId/emails', (req, res) =>
    dealEmailController.getDealEmails(req, res)
);

// Get full email details
router.get('/emails/:emailId', (req, res) =>
    dealEmailController.getEmailDetails(req, res)
);

// Sync/link emails for a specific deal
router.post('/deals/:dealId/emails/sync', (req, res) =>
    dealEmailController.syncDealEmails(req, res)
);

// Manually link an email to a deal
router.post('/deals/:dealId/emails/link', (req, res) =>
    dealEmailController.linkEmail(req, res)
);

// Unlink an email from a deal
router.delete('/deals/:dealId/emails/:emailId', (req, res) =>
    dealEmailController.unlinkEmail(req, res)
);

// Verify/unverify a deal-email link
router.put('/deal-emails/:dealId/:emailId/verify', (req, res) =>
    dealEmailController.verifyLink(req, res)
);

// Bulk sync emails for multiple deals
router.post('/deals/emails/bulk-sync', (req, res) =>
    dealEmailController.bulkSyncEmails(req, res)
);

// Get bulk sync operation logs
router.get('/email-link-logs', (req, res) =>
    dealEmailController.getLinkLogs(req, res)
);

export default router;
