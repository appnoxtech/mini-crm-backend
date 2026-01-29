import { Request, Response } from "express";
import { PricingModel } from "../models/PricingModel";
import { BrandGuidelinesModel } from "../models/BrandGuidelinesModel";
import { KnowledgeBaseModel } from "../models/KnowledgeBaseModel";

export class AIConfigController {
    private pricingModel: PricingModel;
    private guidelinesModel: BrandGuidelinesModel;
    private knowledgeBaseModel: KnowledgeBaseModel;

    constructor(
        pricingModel: PricingModel,
        guidelinesModel: BrandGuidelinesModel,
        knowledgeBaseModel: KnowledgeBaseModel
    ) {
        this.pricingModel = pricingModel;
        this.guidelinesModel = guidelinesModel;
        this.knowledgeBaseModel = knowledgeBaseModel;
    }

    // Pricing
    getAllTiers(req: Request, res: Response): void {
        try {
            const tiers = this.pricingModel.getAllTiers();
            res.json(tiers);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    createTier(req: Request, res: Response): void {
        try {
            const tier = this.pricingModel.createTier(req.body);
            res.status(201).json(tier);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    createDiscountRule(req: Request, res: Response): void {
        try {
            const rule = this.pricingModel.createDiscountRule(req.body);
            res.status(201).json(rule);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    deleteTier(req: Request, res: Response): void {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Tier ID is required' });
                return;
            }
            const success = this.pricingModel.deleteTier(id);
            if (success) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Tier not found' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    updateTier(req: Request, res: Response): void {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Tier ID is required' });
                return;
            }
            const tier = this.pricingModel.updateTier(id, req.body);
            if (tier) {
                res.json(tier);
            } else {
                res.status(404).json({ error: 'Tier not found' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    // Guidelines
    getGuidelines(req: Request, res: Response): void {
        try {
            const guidelines = this.guidelinesModel.getGuidelines();
            res.json(guidelines);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    updateGuidelines(req: Request, res: Response): void {
        try {
            const success = this.guidelinesModel.updateGuidelines('default', req.body);
            res.json({ success });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    // Knowledge Base
    getKnowledgeBase(req: Request, res: Response): void {
        try {
            const items = this.knowledgeBaseModel.getAll();
            res.json(items);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    addToKnowledgeBase(req: Request, res: Response): void {
        try {
            const { category, topic, content, keywords } = req.body;
            const id = this.knowledgeBaseModel.addToKnowledgeBase(category, topic, content, keywords);
            res.status(201).json({ id, category, topic, content, keywords });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
    updateKnowledgeBaseItem(req: Request, res: Response): void {
        try {
            const { id } = req.params;
            const updates = req.body;
            const success = this.knowledgeBaseModel.update(Number(id), updates);
            if (success) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Item not found' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    deleteKnowledgeBaseItem(req: Request, res: Response): void {
        try {
            const { id } = req.params;
            const success = this.knowledgeBaseModel.delete(Number(id));
            if (success) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Item not found' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
