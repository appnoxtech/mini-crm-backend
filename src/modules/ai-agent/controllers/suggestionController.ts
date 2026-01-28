import { Request, Response } from "express";
import { SuggestionOrchestratorService } from "../services/suggestionOrchestratorService";

export class SuggestionController {
    private orchestrator: SuggestionOrchestratorService;

    constructor(orchestrator: SuggestionOrchestratorService) {
        this.orchestrator = orchestrator;
    }

    async generateSuggestion(req: Request, res: Response): Promise<void> {
        try {
            const { dealId, personId, threadId, messageId, email, forceRefresh, customPrompt, lastEmailContent, lastEmailSubject, userName } = req.body;

            // Allow either: context identifiers OR customPrompt with content (for refinement)
            const hasContextIdentifier = dealId || personId || email || threadId || messageId;
            const isRefinementRequest = customPrompt && lastEmailContent;

            if (!hasContextIdentifier && !isRefinementRequest) {
                res.status(400).json({ error: "Either dealId, personId, threadId, messageId, email, or customPrompt with content is required" });
                return;
            }


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
                userName
            });

            res.status(201).json(suggestion);
        } catch (error: any) {
            console.error("Controller Error (generate):", error.message);
            console.error("Full error stack:", error.stack);
            res.status(500).json({ error: error.message });
        }
    }

    async getDealSuggestions(req: Request, res: Response): Promise<void> {
        try {
            const { dealId } = req.params;
            const suggestions = await this.orchestrator.getSuggestionsForDeal(Number(dealId));
            res.json(suggestions);
        } catch (error: any) {
            console.error("Controller Error (getDeal):", error.message);
            res.status(500).json({ error: error.message });
        }
    }

    async getPersonSuggestions(req: Request, res: Response): Promise<void> {
        try {
            const { personId } = req.params;
            const suggestions = await this.orchestrator.getSuggestionsForPerson(Number(personId));
            res.json(suggestions);
        } catch (error: any) {
            console.error("Controller Error (getPerson):", error.message);
            res.status(500).json({ error: error.message });
        }
    }
}
