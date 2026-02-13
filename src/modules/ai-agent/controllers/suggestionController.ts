import { Request, Response } from "express";
import { SuggestionOrchestratorService } from "../services/suggestionOrchestratorService";
import { AuthenticatedRequest } from "../../../shared/types";

export class SuggestionController {
    private orchestrator: SuggestionOrchestratorService;

    constructor(orchestrator: SuggestionOrchestratorService) {
        this.orchestrator = orchestrator;
    }

    async generateSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { dealId, personId, threadId, messageId, email, forceRefresh, customPrompt, lastEmailContent, lastEmailSubject, userName } = req.body;

            // Allow either: context identifiers OR customPrompt (for refinement/compose)
            const hasContextIdentifier = dealId || personId || email || threadId || messageId;
            const hasCustomPrompt = customPrompt && customPrompt.trim().length > 0;

            if (!hasContextIdentifier && !hasCustomPrompt) {
                res.status(400).json({ error: "Either dealId, personId, threadId, messageId, email, or customPrompt is required" });
                return;
            }

            const userId = req.user?.id;
            const companyId = req.user?.companyId;

            const suggestion = await this.orchestrator.generateSuggestion({
                dealId: dealId ? Number(dealId) : undefined,
                personId: personId ? Number(personId) : undefined,
                threadId,
                messageId,
                email,
                forceRefresh,
                customPrompt,
                lastEmailContent,
                lastEmailSubject,
                userName,
                companyId,
                userId
            });

            res.status(201).json(suggestion);
        } catch (error: any) {
            console.error("Controller Error (generate):", error.message);
            console.error("Full error stack:", error.stack);
            res.status(500).json({ error: error.message });
        }
    }

    async getDealSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { dealId } = req.params;
            const companyId = req.user?.companyId;
            if (!companyId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const suggestions = await this.orchestrator.getSuggestionsForDeal(Number(dealId), companyId);
            res.json(suggestions);
        } catch (error: any) {
            console.error("Controller Error (getDeal):", error.message);
            res.status(500).json({ error: error.message });
        }
    }

    async getPersonSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { personId } = req.params;
            const companyId = req.user?.companyId;
            if (!companyId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const suggestions = await this.orchestrator.getSuggestionsForPerson(Number(personId), companyId);
            res.json(suggestions);
        } catch (error: any) {
            console.error("Controller Error (getPerson):", error.message);
            res.status(500).json({ error: error.message });
        }
    }
}
