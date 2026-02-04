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
    knowledgeBaseContext?: string[];
    // New: Structured KB context
    structuredKBContext?: string;
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

        // Detect if this is a refinement request (contains refinement markers in customPrompt)
        const isRefinementRequest = context?.customPrompt?.toLowerCase().includes('refine') ||
            context?.customPrompt?.toLowerCase().includes('current draft to refine:');

        if (context?.lastEmailContent) {
            if (isRefinementRequest) {
                // For refinement: present as draft to improve, NOT as email to reply to
                replyToContext = `
CURRENT DRAFT TO REFINE (improve this, don't reply to it):
Subject: ${context.lastEmailSubject || 'No subject'}
Content:
${context.lastEmailContent}
`;
            } else {
                replyToContext = `
EMAIL TO REPLY TO:
Subject: ${context.lastEmailSubject || 'No subject'}
Content:
${context.lastEmailContent}
`;
            }
        }

        // Custom prompt instructions
        const customInstructions = context?.customPrompt
            ? `\nUSER'S SPECIFIC INSTRUCTIONS:\n${context.customPrompt}\n`
            : '';

        // Detect if this is a first-contact/new outreach (no email to reply to, or empty draft)
        const isFirstContact = !context?.lastEmailContent || context.lastEmailContent.trim().length === 0;

        const modeDescription = isRefinementRequest
            ? 'You are a professional email assistant helping REFINE and IMPROVE an existing email draft. Do NOT treat the draft as a previous email to reply to.'
            : (isFirstContact
                ? 'You are a professional email assistant helping compose a NEW OUTREACH EMAIL to a potential client.'
                : 'You are a professional email assistant helping write a DIRECT REPLY to an email.');

        const modeInstructions = isFirstContact && !isRefinementRequest
            ? `
CRITICAL INSTRUCTIONS FOR NEW OUTREACH:
1. Write a professional FIRST CONTACT email for initial client outreach.
2. Introduce yourself/company professionally.
3. Clearly state the purpose of reaching out.
4. If a specific company or project is mentioned, acknowledge and reference it.
5. Be concise, professional, and action-oriented.
6. End with a clear call-to-action (e.g., schedule a call, request a meeting).
6. End with a clear call-to-action (e.g., schedule a call, request a meeting).
7. Use the pricing/plan information if it's relevant to the outreach.`
            : `
CRITICAL INSTRUCTIONS:
1. Write a DIRECT REPLY that specifically addresses the content of the email being replied to.
2. Reference specific points, concerns, or topics from the email you're replying to.
3. Be concise and actionable - no generic fluff or filler content.
4. If the original email expresses frustration or concern, acknowledge it empathetically first.
5. Provide specific solutions or next steps relevant to what was mentioned.
6. Keep the reply professional but conversational.
7. The subject line should be appropriate for a reply (start with "Re:" if replying).`;

        const generationPrompt = `
${modeDescription}

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
- SIGNATURE TEMPLATE: ${guidelines?.signatureTemplate || 'None'}

SENDER'S NAME FOR SIGNATURE: ${context?.userName || '{insert name}'}

${context?.knowledgeBaseContext && context.knowledgeBaseContext.length > 0 ? `
RELEVANT COMPANY KNOWLEDGE (Use these facts if applicable):
${context.knowledgeBaseContext.map(k => `- ${k}`).join('\n')}
` : ''}

${context?.structuredKBContext ? `
STRUCTURED KNOWLEDGE BASE CONTEXT:
${context.structuredKBContext}
` : ''}



${modeInstructions}
8. CALCULATION INSTRUCTIONS: If the user asks for a project quote or pricing, and you have component costs in the 'RELEVANT COMPANY KNOWLEDGE' section:
   - You MUST calculate the total estimated price by summing the relevant items.
   - Break down the cost: List each component and its price found in the knowledge base.
   - Show the final total clearly (e.g., "Total Estimated Cost: $X").
   - Do NOT say "it depends" or "let's get on a call" if you have the necessary pricing data to give an estimate. Use the provided facts.


EMAIL STRUCTURE (VERY IMPORTANT - FOLLOW THIS EXACTLY):
The email body MUST be formatted as a professional email with the following structure:

1. GREETING: Start with "Hi [Name]," or "Hello [Name]," or "Dear [Name]," on its own line, followed by a blank line.

2. BODY PARAGRAPHS: 
   - Each paragraph should be SHORT (2-3 sentences max).
   - Separate each paragraph with a BLANK LINE (\\n\\n).
   - If listing items, use bullet points or numbered list with each item on a new line.
   - Break long content into multiple paragraphs for readability.

3. CLOSING: 
   - Use the SIGNATURE TEMPLATE defined above if it is not 'None'.
   - If the template is used, do NOT add another closing phrase or name unless the template is incomplete.
   - If no template is provided, add "Best regards," followed by "${context?.userName || '{insert name}'}" on new lines.

EXAMPLE FORMAT:
Hi Team,

Thank you for sharing the document. I have reviewed it and found the content to be well-structured.

I have a few suggestions:
- Point 1
- Point 2
- Point 3

Please let me know if you need any further clarification.

${guidelines?.signatureTemplate ? guidelines.signatureTemplate : `Best regards,
${context?.userName || '{insert name}'}`}

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
