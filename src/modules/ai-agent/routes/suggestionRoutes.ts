import { Router } from "express";
import { SuggestionController } from "../controllers/suggestionController";
import { AIConfigController } from "../controllers/aiConfigController";

export function createSuggestionRoutes(
    suggestionController: SuggestionController,
    configController: AIConfigController
): Router {
    const router = Router();

    // Suggestions
    router.post("/suggest", (req, res) => suggestionController.generateSuggestion(req, res));
    router.get("/suggestions/deal/:dealId", (req, res) => suggestionController.getDealSuggestions(req, res));
    router.get("/suggestions/person/:personId", (req, res) => suggestionController.getPersonSuggestions(req, res));

    // Config/Management
    router.get("/config/pricing", (req, res) => configController.getAllTiers(req, res));
    router.post("/config/pricing", (req, res) => configController.createTier(req, res));
    router.post("/config/discount", (req, res) => configController.createDiscountRule(req, res));
    router.get("/config/guidelines", (req, res) => configController.getGuidelines(req, res));
    router.patch("/config/guidelines", (req, res) => configController.updateGuidelines(req, res));

    return router;
}
