import { Router } from 'express';
import { EmailController } from '../controllers/emailController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createEmailRoutes(emailController: EmailController): Router {
  const router = Router();

  // Public tracking endpoints (no auth required)
  router.get('/track/open/:trackingId', (req, res) => emailController.handleEmailOpen(req, res));
  router.get('/track/click/:trackingId', (req, res) => emailController.handleLinkClick(req, res));

  // OAuth authorization endpoints (no auth required)
  router.get('/oauth/gmail/authorize', (req, res) => emailController.oauthGmailAuthorize(req, res));
  router.get('/oauth/outlook/authorize', (req, res) => emailController.oauthOutlookAuthorize(req, res));

  // OAuth status check endpoints (no auth required)
  router.get('/oauth/gmail/status', (req, res) => emailController.oauthGmailStatus(req, res));
  router.get('/oauth/outlook/status', (req, res) => emailController.oauthOutlookStatus(req, res));

  // OAuth callback endpoints (no auth required)
  router.get('/oauth/gmail/callback', (req, res) => emailController.oauthGmailCallback(req, res));
  router.get('/oauth/outlook/callback', (req, res) => emailController.oauthOutlookCallback(req, res));

  // Protected routes (require authentication)
  (router as any).use(authMiddleware);

  // Thread summary routes
  router.post('/threads/:threadId/summarize', (req, res) => emailController.summarizeThread(req, res));
  router.get('/threads/:threadId/summary', (req, res) => emailController.getThreadSummary(req, res));

  // Email sending
  router.post('/send', (req: any, res) => emailController.sendEmail(req, res));

  // Email retrieval for CRM entities
  router.get('/contacts/:contactId/emails', (req: any, res) => emailController.getEmailsForContact(req, res));
  router.get('/deals/:dealId/emails', (req: any, res) => emailController.getEmailsForDeal(req, res));

  // Email account management
  router.get('/accounts', (req: any, res) => emailController.getEmailAccounts(req, res));
  router.post('/accounts', (req: any, res) => emailController.connectEmailAccount(req, res));
  router.put('/accounts/:accountId', (req: any, res) => emailController.updateEmailAccount(req, res));
  router.get('/accounts/validate', (req: any, res) => emailController.validateEmailAccount(req, res));

  // Email sync management
  router.post('/accounts/:accountId/sync', (req: any, res) => emailController.triggerEmailSync(req, res));
  router.get('/queue/status', (req: any, res) => emailController.getQueueStatus(req, res));
  router.get('/notifications/stats', (req: any, res) => emailController.getNotificationStats(req, res));

  // Email retrieval and management
  router.get('/list', (req: any, res) => emailController.getEmails(req, res));
  router.get('/:emailId', (req: any, res) => emailController.getEmailById(req, res));
  router.patch('/:emailId/read', (req: any, res) => emailController.markEmailAsRead(req, res));

  return router;
}
