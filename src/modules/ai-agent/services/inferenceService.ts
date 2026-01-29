import { groqApiService } from "./groqApiService";
import { ClientProfile } from "../types";

export interface InferenceResult {
    emailType: 'pricing_proposal' | 'check_in' | 'objection_handling' | 'renewal' | 're_engagement' | 'follow_up' | 'proactive_outreach' | 'refinement';
    confidence: number;
    reasoning: string;
    requiredContent: string[];
    informationNeeds: string[]; // Keywords/Topics to search in Knowledge Base
    suggestedTone: string;
    urgency: 'low' | 'medium' | 'high';
}

export class InferenceService {
    async inferNextEmailNeed(
        profile: ClientProfile,
        recentActivity: any[]
    ): Promise<InferenceResult> {
        const inferencePrompt = `
      Based on the following client profile and recent activities, determine what type of email should be sent next.

      CLIENT PROFILE:
      ${JSON.stringify(profile, null, 2)}

      RECENT ACTIVITY (last 5 interactions):
      ${JSON.stringify(recentActivity, null, 2)}

      ANALYZE:
      1. What implicit or explicit need does the client have now?
      2. What is the most appropriate email type?
      3. What specific content is required in this email?
      4. What should be the tone?
      5. How urgent is this communication?
      6. What specific company knowledge/facts are needed? (output keywords for search, e.g. 'price', 'office address', 'refund policy')

      Select from these email types: pricing_proposal, check_in, objection_handling, renewal, re_engagement, follow_up, proactive_outreach, refinement.
    `;

        const schema = {
            emailType: "string",
            confidence: "number",
            reasoning: "string",
            requiredContent: ["string"],
            informationNeeds: ["string"],
            suggestedTone: "string",
            urgency: "string"
        };

        return await groqApiService.extractStructured<InferenceResult>(
            inferencePrompt,
            schema
        );
    }
}

export const inferenceService = new InferenceService();
