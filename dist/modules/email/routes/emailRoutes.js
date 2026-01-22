"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmailRoutes = createEmailRoutes;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
function createEmailRoutes(emailController) {
    const router = (0, express_1.Router)();
    // Public tracking endpoints (no auth required)
    router.post('/track/open/:trackingId', (req, res) => emailController.handleEmailOpen(req, res));
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
    router.use(auth_1.authMiddleware);
    // Thread summary routes
    router.post('/threads/:threadId/summarize', (req, res) => emailController.summarizeThread(req, res));
    router.get('/threads/:threadId/summary', (req, res) => emailController.getThreadSummary(req, res));
    // Email sending
    router.post('/send', (req, res) => emailController.sendEmail(req, res));
    // Email retrieval for CRM entities
    router.get('/contacts/:contactId/emails', (req, res) => emailController.getEmailsForContact(req, res));
    router.get('/deals/:dealId/emails', (req, res) => emailController.getEmailsForDeal(req, res));
    // Email account management
    router.get('/accounts', (req, res) => emailController.getEmailAccounts(req, res));
    router.post('/accounts/test-connection', (req, res) => emailController.testConnection(req, res));
    router.post('/accounts', (req, res) => emailController.connectEmailAccount(req, res));
    router.put('/accounts/:accountId', (req, res) => emailController.updateEmailAccount(req, res));
    router.delete('/accounts/:accountId', (req, res) => emailController.deleteEmailAccount(req, res));
    router.get('/accounts/validate', (req, res) => emailController.validateEmailAccount(req, res));
    // Email sync management
    router.post('/accounts/:accountId/sync', (req, res) => emailController.triggerEmailSync(req, res));
    router.get('/queue/status', (req, res) => emailController.getQueueStatus(req, res));
    router.get('/notifications/stats', (req, res) => emailController.getNotificationStats(req, res));
    // Email retrieval and management
    router.post('/sync-archive', (req, res) => emailController.triggerArchiveSync(req, res));
    router.get('/list', (req, res) => emailController.getEmails(req, res));
    router.get('/inbox', (req, res) => emailController.getInbox(req, res));
    router.get('/sent', (req, res) => emailController.getSent(req, res));
    router.get('/drafts', (req, res) => emailController.getDrafts(req, res));
    router.get('/spam', (req, res) => emailController.getSpam(req, res));
    router.get('/trash', (req, res) => emailController.getTrash(req, res));
    router.get('/archive', (req, res) => emailController.getArchive(req, res));
    router.post('/:emailId/archive', (req, res) => emailController.archiveEmail(req, res));
    router.post('/:emailId/unarchive', (req, res) => emailController.unarchiveEmail(req, res));
    router.patch('/:emailId/read', (req, res) => emailController.markEmailAsRead(req, res));
    return router;
}
//# sourceMappingURL=emailRoutes.js.map