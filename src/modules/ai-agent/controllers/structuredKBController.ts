import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../../shared/types";
import { StructuredKBModel } from "../models/StructuredKBModel";
import { StructuredKBService } from "../services/structuredKBService";

let structuredKBModel: StructuredKBModel | null = null;
let structuredKBService: StructuredKBService | null = null;

export const initStructuredKBController = async () => {
    structuredKBModel = new StructuredKBModel();
    // Removed explicit global initialization as companyId is required per request
    structuredKBService = new StructuredKBService(structuredKBModel);
};

/**
 * GET /ai/kb
 * Get the full structured knowledge base
 */
export const getStructuredKB = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!structuredKBService) {
            return res.status(500).json({ error: "Structured KB service not initialized" });
        }

        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const kb = await structuredKBService.getFullKB(req.user.companyId);
        if (!kb) {
            return res.status(404).json({ error: "Knowledge base not found" });
        }

        res.json(kb);
    } catch (error) {
        console.error("Error fetching structured KB:", error);
        res.status(500).json({ error: "Failed to fetch knowledge base" });
    }
};

/**
 * PATCH /ai/kb/:category
 * Update a specific category (1-9)
 */
export const updateKBCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!structuredKBService) {
            return res.status(500).json({ error: "Structured KB service not initialized" });
        }

        const categoryNumber = parseInt(req.params.category || '', 10);
        if (isNaN(categoryNumber) || categoryNumber < 1 || categoryNumber > 9) {
            return res.status(400).json({ error: "Invalid category number. Must be 1-9." });
        }

        const data = req.body;
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ error: "No data provided for update" });
        }

        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const success = await structuredKBService.updateCategory(categoryNumber, data, req.user.companyId);
        if (!success) {
            return res.status(500).json({ error: "Failed to update category" });
        }

        // Return updated KB
        const updatedKB = await structuredKBService.getFullKB(req.user.companyId);
        res.json({
            success: true,
            message: `Category ${categoryNumber} updated successfully`,
            kb: updatedKB
        });
    } catch (error) {
        console.error("Error updating KB category:", error);
        res.status(500).json({ error: "Failed to update category" });
    }
};

/**
 * GET /ai/kb/completion
 * Get KB completion status
 */
export const getKBCompletion = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!structuredKBService) {
            return res.status(500).json({ error: "Structured KB service not initialized" });
        }

        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const status = await structuredKBService.getCompletionStatus(req.user.companyId);
        res.json(status);
    } catch (error) {
        console.error("Error fetching KB completion:", error);
        res.status(500).json({ error: "Failed to fetch completion status" });
    }
};

/**
 * GET /ai/kb/category/:category
 * Get a specific category
 */
export const getKBCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!structuredKBService) {
            return res.status(500).json({ error: "Structured KB service not initialized" });
        }

        const categoryNumber = parseInt(req.params.category || '', 10);
        if (isNaN(categoryNumber) || categoryNumber < 1 || categoryNumber > 9) {
            return res.status(400).json({ error: "Invalid category number. Must be 1-9." });
        }

        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const kb = await structuredKBService.getFullKB(req.user.companyId);
        if (!kb) {
            return res.status(404).json({ error: "Knowledge base not found" });
        }

        const categoryMap: Record<number, string> = {
            1: 'category_1_company_profile',
            2: 'category_2_products_services',
            3: 'category_3_sales_process',
            4: 'category_4_customers_markets',
            5: 'category_5_common_scenarios',
            6: 'category_6_communication',
            7: 'category_7_operations',
            8: 'category_8_resources',
            9: 'category_9_pricing'
        };

        const categoryKey = categoryMap[categoryNumber];
        if (!categoryKey) {
            return res.status(400).json({ error: "Invalid category number" });
        }

        res.json({
            category: categoryNumber,
            data: (kb as any)[categoryKey]
        });
    } catch (error) {
        console.error("Error fetching KB category:", error);
        res.status(500).json({ error: "Failed to fetch category" });
    }
};

export { structuredKBService };
