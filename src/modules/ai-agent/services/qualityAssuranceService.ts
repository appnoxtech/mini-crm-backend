import { groqApiService } from "./groqApiService";
import { SuggestionIssue } from "../types";

export interface QAResult {
    qualityScore: number;
    issues: SuggestionIssue[];
}

export class QualityAssuranceService {
    async verifyDraft(
        subject: string,
        body: string,
        context: any
    ): Promise<QAResult> {
        const qaPrompt = `
      Review this generated email draft for quality and accuracy.

      CONTEXT:
      ${JSON.stringify(context, null, 2)}

      EMAIL DRAFT:
      Subject: ${subject}
      Body:
      ${body}

      TASKS:
      1. Verify factual accuracy (ensure it aligns with the provided context, especially pricing if mentioned).
      2. Check for personalization level (does it mention specific client needs?).
      3. Check tone and brand consistency.
      4. Detect generic or robotic phrasing.
      5. Identify potential compliance or legal issues.

      SCORING:
      - 0 to 1 (1 being perfect).
      
      ISSUES:
      - Categorize as red (blocker), yellow (review needed), or green (suggestion).
    `;

        const schema = {
            qualityScore: "number",
            issues: [
                {
                    severity: "string", // red, yellow, green
                    issue: "string",
                    suggestion: "string"
                }
            ]
        };

        return await groqApiService.extractStructured<QAResult>(
            qaPrompt,
            schema
        );
    }
}

export const qualityAssuranceService = new QualityAssuranceService();
