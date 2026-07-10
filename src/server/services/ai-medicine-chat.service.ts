import { GoogleGenAI } from "@google/genai";
import { ApiError } from "@/server/utils/api-response";

export interface MedicineContext {
    name: string;
    manufacturer: string;
    batchNumber: string;
    expiry: string;
    status: string;
    category?: string;
    activeIngredients?: string;
    genericName?: string;
    approvalStatus?: string;
}

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export class AIMedicineChatService {
    /**
     * Streams a chat response from Gemini given a message, prior history,
     * and medicine context injected as a system prompt.
     *
     * Yields text chunks as they arrive from the Gemini streaming API.
     */
    static async *streamChatResponse(params: {
        message: string;
        history: ChatMessage[];
        medicineContext: MedicineContext;
    }): AsyncGenerator<string> {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new ApiError(
                503,
                "AI assistant is not configured. Please contact support."
            );
        }

        const { message, history, medicineContext } = params;
        const {
            name,
            manufacturer,
            batchNumber,
            expiry,
            status,
            category,
            activeIngredients,
            genericName,
            approvalStatus,
        } = medicineContext;

        const systemPrompt = `You are MediVerify AI Assistant — a helpful medical information assistant for Pakistani patients.

CURRENT SCAN RESULT:
Medicine: ${name}
Result: ${status}
Manufacturer: ${manufacturer}
Batch: ${batchNumber}
Expiry: ${expiry}
Category: ${category ?? "Not specified"}
Active Ingredients: ${activeIngredients ?? "Not specified"}
Generic Name: ${genericName ?? "Not specified"}
DRAP Approval Status: ${approvalStatus ?? "Not specified"}

RULES:
- Always respond in the same language/style as the user (if they write in Roman Urdu, respond in Roman Urdu; if English, respond in English)
- Never give definitive medical advice or dosing instructions — always suggest consulting a doctor or pharmacist for anything beyond general information
- If the scan result is FAKE/suspected/invalid, prioritize patient safety: advise them not to consume it, and mention they can report it to DRAP at helpline 1223
- Keep responses short, simple, and readable (roughly 8th-grade reading level), using short paragraphs
- Use Pakistan-relevant context where natural (DRAP, local pharmacy norms) but do not fabricate specific pharmacy names, addresses, or phone numbers you don't actually have data for`;

        const ai = new GoogleGenAI({ apiKey });

        // Map our chat history format to the SDK's Content format.
        // The @google/genai SDK uses "model" for assistant turns.
        const sdkHistory = history.map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        const chat = ai.chats.create({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: systemPrompt,
            },
            history: sdkHistory,
        });

        const resultStream = await chat.sendMessageStream({ message });

        for await (const chunk of resultStream) {
            const text = chunk.text;
            if (text) {
                yield text;
            }
        }
    }
}
