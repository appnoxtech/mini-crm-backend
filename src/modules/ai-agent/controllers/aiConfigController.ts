import { Request, Response } from "express";
import { PricingModel } from "../models/PricingModel";
import { BrandGuidelinesModel } from "../models/BrandGuidelinesModel";
import { KnowledgeBaseModel } from "../models/KnowledgeBaseModel";




export class AIConfigController {

    constructor(
        private pricingModel: PricingModel,
        private guidelinesModel: BrandGuidelinesModel,
        private knowledgeBaseModel: KnowledgeBaseModel
    ) {
        this.pricingModel = pricingModel;
        this.guidelinesModel = guidelinesModel;
        this.knowledgeBaseModel = knowledgeBaseModel;
    }

    // Pricing
    async getAllTiers(req: Request, res: Response): Promise<void> {
        try {
            const tiers = await this.pricingModel.getAllTiers();
            res.json(tiers);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async createTier(req: Request, res: Response): Promise<void> {
        try {
            const tierId = await this.pricingModel.createTier(req.body);
            res.status(201).json({ id: tierId, ...req.body });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async createDiscountRule(req: Request, res: Response): Promise<void> {
        try {
            await this.pricingModel.createDiscountRule(req.body);
            res.status(201).json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteTier(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Tier ID is required' });
                return;
            }
            await this.pricingModel.deleteTier(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateTier(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Tier ID is required' });
                return;
            }
            await this.pricingModel.updateTier(id, req.body);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    // Guidelines
    async getGuidelines(req: Request, res: Response): Promise<void> {
        try {
            const guidelines = await this.guidelinesModel.getGuidelines();
            res.json(guidelines);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateGuidelines(req: Request, res: Response): Promise<void> {
        try {
            await this.guidelinesModel.updateGuidelines(req.body);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    // Knowledge Base
    async getKnowledgeBase(req: Request, res: Response): Promise<void> {
        try {
            const items = await this.knowledgeBaseModel.getAllItems();
            res.json(items);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async addToKnowledgeBase(req: Request, res: Response): Promise<void> {
        try {
            const id = await this.knowledgeBaseModel.addItem(req.body);
            res.status(201).json({ id, ...req.body });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateKnowledgeBaseItem(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Item ID is required' });
                return;
            }
            const updates = req.body;
            await this.knowledgeBaseModel.updateItem(id, updates);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteKnowledgeBaseItem(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Item ID is required' });
                return;
            }
            await this.knowledgeBaseModel.deleteItem(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
