import { Router } from "express";
import { SuggestionController } from "../controllers/suggestionController";
import { AIConfigController } from "../controllers/aiConfigController";
import { authMiddleware } from "../../../shared/middleware/auth";
import {
    getStructuredKB,
    updateKBCategory,
    getKBCompletion,
    getKBCategory
} from "../controllers/structuredKBController";

export function createSuggestionRoutes(
    suggestionController: SuggestionController,
    configController: AIConfigController
): Router {
    const router = Router();

    // Suggestions
    router.post("/suggest", authMiddleware, (req, res) => suggestionController.generateSuggestion(req, res));
    router.get("/suggestions/deal/:dealId", authMiddleware, (req, res) => suggestionController.getDealSuggestions(req, res));
    router.get("/suggestions/person/:personId", authMiddleware, (req, res) => suggestionController.getPersonSuggestions(req, res));

    // Config/Management




    // Structured Knowledge Base
    router.get("/kb", authMiddleware, getStructuredKB);
    router.patch("/kb/:category", authMiddleware, updateKBCategory);
    router.get("/kb/completion", authMiddleware, getKBCompletion);
    router.get("/kb/category/:category", authMiddleware, getKBCategory);

    return router;
}
