import { Request, Response } from 'express';
import { ActivityService } from '../services/ActivityService';

export class ActivityController {
    private service: ActivityService;

    constructor(service: ActivityService) {
        this.service = service;
    }

    getActivities = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const filters = {
                fromDate: req.query.fromDate as string,
                toDate: req.query.toDate as string,
                status: req.query.status as any,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined
            };

            const result = await this.service.getActivities(userId, filters);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    };

    createActivity = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const activity = await this.service.createActivity(userId, req.body);
            res.status(201).json({
                message: "Activity created successfully",
                activity
            });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };

    searchActivities = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const query = req.query.query as string;
            const type = req.query.type as string;

            const results = await this.service.searchActivities(userId, query, type);
            res.json(results);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };

    updateActivity = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const { activityId } = req.params;
            if (!activityId) throw new Error('Activity ID is required');

            const updated = await this.service.updateActivity(activityId, userId, req.body);
            res.json(updated);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };

    deleteActivity = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const { activityId } = req.params;
            if (!activityId) throw new Error('Activity ID is required');

            await this.service.deleteActivity(activityId, userId);
            res.status(200).json({ message: "Activity deleted successfully" });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };

    markAsDone = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const { activityId } = req.params;
            if (!activityId) throw new Error('Activity ID is required');

            const updated = await this.service.markAsDone(activityId, userId);
            res.json(updated);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };

    getMetadata = async (req: Request, res: Response) => {
        res.json(this.service.getMetadata());
    };

    checkAvailability = async (req: Request, res: Response) => {
        try {
            const { startAt, endAt, userIds } = req.body;
            const result = await this.service.checkAvailability(startAt, endAt, userIds || []);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };

    getCalendarView = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const date = req.query.date as string;
            if (!date) {
                return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
            }
            const result = await this.service.getCalendarView(userId, date);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };
}
