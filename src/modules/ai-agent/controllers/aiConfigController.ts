import { Request, Response } from "express";
import { PricingModel } from "../models/PricingModel";
import { BrandGuidelinesModel } from "../models/BrandGuidelinesModel";

export class AIConfigController {
    private pricingModel: PricingModel;
    private guidelinesModel: BrandGuidelinesModel;

    constructor(pricingModel: PricingModel, guidelinesModel: BrandGuidelinesModel) {
        this.pricingModel = pricingModel;
        this.guidelinesModel = guidelinesModel;
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
}
