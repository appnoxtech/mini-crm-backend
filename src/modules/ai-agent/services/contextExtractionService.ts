import { groqApiService } from "./groqApiService";
import { Email } from "../../email/models/types";
import { ClientProfile } from "../types";
import { v4 as uuidv4 } from "uuid";

export class ContextExtractionService {
    async extractClientProfile(
        emails: Email[],
        dealDetails: any,
        existingProfile: ClientProfile | null
    ): Promise<ClientProfile> {
        const emailContent = this.formatEmailsForExtraction(emails);

        const extractionPrompt = `
      You are an expert CRM analyst. Given the following email conversation history (1.5 years) and deal details, 
      extract a structured client profile. Focus on high-confidence facts.

      DEAL DETAILS:
      ${JSON.stringify(dealDetails, null, 2)}

      EMAIL HISTORY:
      ${emailContent}

      ${existingProfile ? `CURRENT KNOWN PROFILE (to be updated): ${JSON.stringify(existingProfile, null, 2)}` : ''}

      EXTRACT:
      1. Key requirements mentioned by the client.
      2. Budget parameters or constraints mentioned.
      3. Timeline, deadlines, or milestones discussed.
      4. Key decision-makers and their roles.
      5. Objections, concerns, or blockers raised.
      6. Client preferences (tone, communication style, etc.).
      7. Current relationship stage (exploration, evaluation, negotiation, implementation, renewal, or churn_risk).
      8. Relationship maturity score (0-1, where 1 is a very strong relationship).

      Format your response as a JSON object matching the ClientProfile schema.
    `;

        const schema = {
            requirements: ["string"],
            budgetRange: { min: "number", max: "number" },
            timeline: "string",
            decisionMakers: ["string"],
            objections: ["string"],
            preferences: "Record<string, any>",
            relationshipStage: "string",
            maturityScore: "number"
        };

        const extracted = await groqApiService.extractStructured<Partial<ClientProfile>>(
            extractionPrompt,
            schema
        );

        return {
            id: existingProfile?.id || uuidv4(),
            dealId: dealDetails?.id || dealDetails?.dealId,
            personId: dealDetails?.personId || dealDetails?.id, // fallback if dealDetails IS the person
            organizationId: dealDetails?.organizationId,
            requirements: extracted.requirements || [],
            budgetRange: extracted.budgetRange || null,
            timeline: extracted.timeline || null,
            decisionMakers: extracted.decisionMakers || [],
            objections: extracted.objections || [],
            preferences: extracted.preferences || {},
            relationshipStage: (extracted.relationshipStage as any) || 'exploration',
            maturityScore: extracted.maturityScore || 0.5,
            lastUpdated: new Date()
        };
    }

    private formatEmailsForExtraction(emails: Email[]): string {
        return emails.map((email, idx) => `
      --- Message ${idx + 1} ---
      Date: ${email.sentAt}
      From: ${email.from}
      To: ${email.to.join(', ')}
      Subject: ${email.subject}
      Body: ${email.body.substring(0, 3000)}
    `).join('\n');
    }
}

export const contextExtractionService = new ContextExtractionService();
