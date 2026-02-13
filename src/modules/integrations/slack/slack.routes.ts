import { Router } from 'express';
import { slackController } from './slack.controller';
import { authMiddleware } from '../../../shared/middleware/auth';

const router = Router();

// OAuth flow routes
router.get('/install', authMiddleware, (req, res) => slackController.getInstallUrl(req, res));
router.get('/callback', (req, res) => slackController.handleCallback(req, res));

// Slack events webhook (no auth - verified via signing secret)
router.post('/events', (req, res) => slackController.handleEvents(req, res));

// Protected routes
router.get('/status', authMiddleware, (req, res) => slackController.getStatus(req, res));
router.get('/channels', authMiddleware, (req, res) => slackController.getChannels(req, res));
router.put('/channel', authMiddleware, (req, res) => slackController.updateChannel(req, res));
router.post('/disconnect', authMiddleware, (req, res) => slackController.disconnect(req, res));
router.get('/test', authMiddleware, (req, res) => slackController.testConnection(req, res));
router.get('/queue/health', authMiddleware, (req, res) => slackController.getQueueHealth(req, res));

export const createSlackRoutes = (): Router => router;

export default router;
