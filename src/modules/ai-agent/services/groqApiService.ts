import Groq from "groq-sdk";
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GROQ_API_KEY || "";
const MODEL_NAME = process.env.AI_SUGGESTION_MODEL || "llama-3.3-70b-versatile";

export interface Message {
    role: 'user' | 'assistant' | 'system' | 'model';
    content: string;
}

export class GroqApiService {
    private client: Groq;

    constructor() {
        this.client = new Groq({
            apiKey: API_KEY,
        });
    }

    async chat(messages: Message[]): Promise<string> {
        try {
            if (!messages || messages.length === 0) {
                throw new Error("No messages provided to chat");
            }

            // Convert messages to Groq format
            const groqMessages = messages.map(msg => ({
                role: msg.role === 'model' ? 'assistant' as const : msg.role,
                content: msg.content,
            }));

            const response = await this.client.chat.completions.create({
                model: MODEL_NAME,
                messages: groqMessages,
                temperature: parseFloat(process.env.AI_SUGGESTION_TEMPERATURE || "0.7"),
                max_tokens: 8192,
            });

            return response.choices[0]?.message?.content || "";
        } catch (error: any) {
            console.error("Groq API Error (chat):", error.message);
            throw new Error(`Groq API failed: ${error.message}`);
        }
    }

    async extractStructured<T>(prompt: string, schema: any): Promise<T> {
        try {
            const fullPrompt = `${prompt}\n\nRespond only with a valid JSON object matching this schema: ${JSON.stringify(schema)}\n\nDo not include any text before or after the JSON. Only output the JSON object.`;

            const response = await this.client.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: "user", content: fullPrompt }],
                temperature: parseFloat(process.env.AI_SUGGESTION_TEMPERATURE || "0.7"),
                max_tokens: 8192,
                response_format: { type: "json_object" },
            });

            const text = response.choices[0]?.message?.content || "{}";

            try {
                return JSON.parse(text) as T;
            } catch (e) {
                // Fallback: try to extract JSON from text if it's not pure JSON
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]) as T;
                }
                throw e;
            }
        } catch (error: any) {
            console.error("Groq API Error (structured):", error.message);
            throw new Error(`Groq API structured extraction failed: ${error.message}`);
        }
    }

    async processLongContext(content: string, instruction: string): Promise<string> {
        try {
            const response = await this.client.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: instruction },
                    { role: "user", content: content }
                ],
                temperature: parseFloat(process.env.AI_SUGGESTION_TEMPERATURE || "0.7"),
                max_tokens: 8192,
            });

            return response.choices[0]?.message?.content || "";
        } catch (error: any) {
            console.error("Groq API Error (long context):", error.message);
            throw new Error(`Groq API long context processing failed: ${error.message}`);
        }
    }
}

export const groqApiService = new GroqApiService();
