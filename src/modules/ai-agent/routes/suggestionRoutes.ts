import { Router } from "express";
import { SuggestionController } from "../controllers/suggestionController";
import { AIConfigController } from "../controllers/aiConfigController";
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
    router.post("/suggest", (req, res) => suggestionController.generateSuggestion(req, res));
    router.get("/suggestions/deal/:dealId", (req, res) => suggestionController.getDealSuggestions(req, res));
    router.get("/suggestions/person/:personId", (req, res) => suggestionController.getPersonSuggestions(req, res));

    // Config/Management




    // Structured Knowledge Base
    router.get("/kb", getStructuredKB);
    router.patch("/kb/:category", updateKBCategory);
    router.get("/kb/completion", getKBCompletion);
    router.get("/kb/category/:category", getKBCategory);

    return router;
}
