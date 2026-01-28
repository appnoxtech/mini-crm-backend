import { groqApiService } from "./groqApiService";
import { ClientProfile, PricingTier, BrandGuidelines, EmailSuggestion } from "../types";
import { InferenceResult } from "./inferenceService";

export interface GenerationContext {
    lastEmailContent?: string;
    lastEmailSubject?: string;
    customPrompt?: string;
    senderName?: string;
    userName?: string;
    conversationHistory?: Array<{ from: string; subject: string; body: string; date: string }>;
}

export class ContentGenerationService {
    async generateEmail(
        profile: ClientProfile,
        inference: InferenceResult,
        pricingTiers: PricingTier[],
        guidelines: BrandGuidelines,
        context?: GenerationContext
    ): Promise<{ subject: string; body: string }> {

        // Find relevant pricing if needed
        const relevantTier = this.selectRelevantTier(profile, pricingTiers);

        // Build conversation context
        let conversationContext = '';
        if (context?.conversationHistory && context.conversationHistory.length > 0) {
            conversationContext = `\nCONVERSATION HISTORY (most recent last):\n${context.conversationHistory.map(e =>
                `---\nFrom: ${e.from}\nDate: ${e.date}\nSubject: ${e.subject}\n${e.body}\n`
            ).join('\n')}`;
        }

        // Build email to reply to context
        let replyToContext = '';
        if (context?.lastEmailContent) {
            replyToContext = `
EMAIL TO REPLY TO:
Subject: ${context.lastEmailSubject || 'No subject'}
Content:
${context.lastEmailContent}
`;
        }

        // Custom prompt instructions
        const customInstructions = context?.customPrompt
            ? `\nUSER'S SPECIFIC INSTRUCTIONS:\n${context.customPrompt}\n`
            : '';

        const generationPrompt = `
You are a professional email assistant helping write a DIRECT REPLY to an email.

${replyToContext}
${conversationContext}
${customInstructions}

RECIPIENT CONTEXT:
- Name: ${context?.senderName || 'the recipient'}
- Relationship Stage: ${profile?.relationshipStage || 'general'}
- Known Requirements: ${profile?.requirements?.length > 0 ? profile.requirements.join(', ') : 'None specified'}
- Known Objections: ${profile?.objections?.length > 0 ? profile.objections.join(', ') : 'None'}

INFERRED EMAIL GOAL:
- Type: ${inference.emailType}
- Purpose: ${inference.reasoning}
- Key Points to Address: ${inference.requiredContent?.join(', ') || 'General email response'}

BRAND VOICE:
- Tone: ${guidelines?.tone || 'professional'} (${guidelines?.voiceCharacteristics?.join(', ') || 'clear, helpful'})
- Closing Phrases Options: ${guidelines?.closingPhrases?.join(', ') || 'Best regards, Thanks, Kind regards'}
- Phrases to AVOID: ${guidelines?.avoidPhrases?.join(', ') || 'None specified'}

SENDER'S NAME FOR SIGNATURE: ${context?.userName || '[Name]'}

${relevantTier ? `
PRICING CONTEXT (if relevant to include):
- Tier: ${relevantTier.name}
- Price: ${relevantTier.basePrice} ${relevantTier.currency}
- Features: ${relevantTier.features.join(', ')}
` : ''}

CRITICAL INSTRUCTIONS:
1. Write a DIRECT REPLY that specifically addresses the content of the email being replied to.
2. Reference specific points, concerns, or topics from the email you're replying to.
3. Be concise and actionable - no generic fluff or filler content.
4. If the original email expresses frustration or concern, acknowledge it empathetically first.
5. Provide specific solutions or next steps relevant to what was mentioned.
6. Keep the reply professional but conversational.
7. The subject line should be appropriate for a reply (start with "Re:" if replying).

EMAIL STRUCTURE (VERY IMPORTANT - FOLLOW THIS EXACTLY):
The email body MUST be formatted as a professional email with the following structure:

1. GREETING: Start with "Hi [Name]," or "Hello [Name]," or "Dear [Name]," on its own line, followed by a blank line.

2. BODY PARAGRAPHS: 
   - Each paragraph should be SHORT (2-3 sentences max).
   - Separate each paragraph with a BLANK LINE (\\n\\n).
   - If listing items, use bullet points or numbered list with each item on a new line.
   - Break long content into multiple paragraphs for readability.

3. CLOSING: 
   - Add a blank line before the closing phrase.
   - Put the closing phrase (e.g., "Best regards," or "Thanks," or "Kind regards,") on its own line.
   - Put the sender's name "${context?.userName || '[Name]'}" on the NEXT line.

EXAMPLE FORMAT:
Hi Team,

Thank you for sharing the document. I have reviewed it and found the content to be well-structured.

I have a few suggestions:
- Point 1
- Point 2
- Point 3

Please let me know if you need any further clarification.

Best regards,
${context?.userName || '[Name]'}

Respond ONLY with a JSON object containing:
{
  "subject": "The email subject line",
  "body": "The complete email body with proper formatting using \\n for line breaks"
}
`;

        const schema = {
            subject: "string",
            body: "string"
        };

        return await groqApiService.extractStructured<{ subject: string; body: string }>(
            generationPrompt,
            schema
        );
    }

    private selectRelevantTier(profile: ClientProfile, tiers: PricingTier[]): PricingTier | null {
        if (tiers.length === 0) return null;

        const firstTier = tiers[0]!;
        if (profile.budgetRange) {
            const minBudget = profile.budgetRange.min;
            // Simple logic: find tier closest to budget min
            return tiers.reduce((prev, curr) => {
                const prevDist = Math.abs((prev?.basePrice || 0) - minBudget);
                const currDist = Math.abs(curr.basePrice - minBudget);
                return (currDist < prevDist ? curr : prev);
            }, firstTier);
        }
        return firstTier;
    }
}

export const contentGenerationService = new ContentGenerationService();
