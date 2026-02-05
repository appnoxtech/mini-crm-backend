import { Router } from 'express';
import { EmailController } from '../controllers/emailController';
import { EmailTrackingController } from '../controllers/emailTrackingController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createEmailRoutes(
  emailController: EmailController,
  trackingController: EmailTrackingController
): Router {
  const router = Router();

  router.get('/proxy-image', (req, res) => emailController.proxyImage(req, res));

  // Tracking endpoints (no auth required)
  router.get('/track/open/:emailId', (req, res) => trackingController.trackOpen(req, res));
  router.get('/track/click/:emailId', (req, res) => trackingController.trackClick(req, res));

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
  router.use(authMiddleware);

  // Thread summary routes
  router.post('/threads/:threadId/summarize', (req, res) => emailController.summarizeThread(req, res));
  router.get('/threads/:threadId/summary', (req, res) => emailController.getThreadSummary(req, res));
  router.get('/threads/:threadId/emails', (req: any, res) => emailController.getThreadEmails(req, res));

  // Email sending
  router.post('/send', (req: any, res) => emailController.sendEmail(req, res));

  // Email retrieval for CRM entities
  router.get('/contacts/:contactId/emails', (req: any, res) => emailController.getEmailsForContact(req, res));
  router.get('/deals/:dealId/emails', (req: any, res) => emailController.getEmailsForDeal(req, res));

  // Email account management
  router.get('/accounts', (req: any, res) => emailController.getEmailAccounts(req, res));
  router.post('/accounts/test-connection', (req: any, res) => emailController.testConnection(req, res));
  router.post('/accounts', (req: any, res) => emailController.connectEmailAccount(req, res));
  router.put('/accounts/:accountId', (req: any, res) => emailController.updateEmailAccount(req, res));
  router.delete('/accounts/:accountId', (req: any, res) => emailController.deleteEmailAccount(req, res));
  router.get('/accounts/validate', (req: any, res) => emailController.validateEmailAccount(req, res));

  // Email sync management
  router.post('/accounts/:accountId/sync', (req: any, res) => emailController.triggerEmailSync(req, res));
  router.get('/queue/status', (req: any, res) => emailController.getQueueStatus(req, res));
  router.get('/notifications/stats', (req: any, res) => emailController.getNotificationStats(req, res));
  router.get('/notifications/test', (req: any, res) => emailController.testNotification(req, res));

  // Email retrieval and management
  router.post('/sync-archive', (req: any, res) => emailController.triggerArchiveSync(req, res));
  router.get('/list', (req: any, res) => emailController.getEmails(req, res));
  router.get('/inbox', (req: any, res) => emailController.getInbox(req, res));
  router.get('/sent', (req: any, res) => emailController.getSent(req, res));
  router.get('/drafts', (req: any, res) => emailController.getDrafts(req, res));
  router.get('/spam', (req: any, res) => emailController.getSpam(req, res));
  router.get('/trash', (req: any, res) => emailController.getTrash(req, res));
  router.get('/archive', (req: any, res) => emailController.getArchive(req, res));

  // Batch Operations (MUST be before singular routes to avoid shadowing)
  router.post('/batch/archive', (req: any, res) => emailController.batchArchive(req, res));
  router.post('/batch/restore', (req: any, res) => emailController.batchRestore(req, res));
  router.post('/batch/trash', (req: any, res) => emailController.batchTrash(req, res));
  router.delete('/batch/delete', (req: any, res) => emailController.batchDelete(req, res));
  router.patch('/batch/read', (req: any, res) => emailController.batchMarkAsRead(req, res));

  router.post('/:emailId/archive', (req: any, res) => emailController.archiveEmail(req, res));
  router.post('/:emailId/unarchive', (req: any, res) => emailController.unarchiveEmail(req, res));

  // Trash (soft delete) and permanent delete routes
  router.post('/:emailId/trash', (req: any, res) => emailController.trashEmail(req, res));
  router.post('/:emailId/restore', (req: any, res) => emailController.restoreFromTrash(req, res));
  router.post('/:emailId/spam', (req: any, res) => emailController.markAsSpam(req, res));
  router.post('/:emailId/unspam', (req: any, res) => emailController.unmarkAsSpam(req, res));
  router.delete('/trash/all', (req: any, res) => emailController.deleteAllTrash(req, res));
  router.delete('/:emailId', (req: any, res) => emailController.deleteEmailPermanently(req, res));

  router.get('/:emailId', (req: any, res) => emailController.getEmailById(req, res));

  // Unified Read/Unread Status
  router.patch('/:emailId/read', (req: any, res) => emailController.markEmailAsRead(req, res));


  return router;
}
