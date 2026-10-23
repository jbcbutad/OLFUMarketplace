import { NextResponse } from "next/server";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { createClient as createSessionClient } from "@/lib/supabase/server";

// Created lazily so a missing key can never crash the module at import/build time
let aiClient = null;
function getAi() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set");
    }
    if (!aiClient) {
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
}

// Review text can contain profanity/slurs. Without this, Gemini may refuse to
// answer and the route would silently fall back to "Neutral".
const SAFETY_SETTINGS = [
    HarmCategory.HARM_CATEGORY_HARASSMENT,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_NONE }));

const GEMINI_MODEL =
    process.env.GEMINI_TEXT_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-3.6-flash";

const SYSTEM_INSTRUCTION =
    "You are a sentiment analyzer and profanity detector for a student marketplace (English, Tagalog, Taglish). You MUST respond strictly with a valid JSON object.";

export async function POST(req) {
    try {
        // Only signed-in users may use the AI (protects the Gemini quota)
        const session = await createSessionClient();
        const {
            data: { user },
        } = await session.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { success: false, label: null, score: null, profane_terms: [] },
                { status: 401 }
            );
        }

        const { comment } = await req.json();

        if (!comment || typeof comment !== "string" || !comment.trim()) {
            return NextResponse.json({
                success: true,
                label: null,
                score: null,
                profane_terms: [],
            });
        }

        const original = comment.trim().slice(0, 1000);

        const prompt = `Analyze this review: "${original}".
Respond with valid JSON:
{
  "label": "Positive",
  "score": 0.95,
  "profane_terms": []
}
Rules:
- "label" must be strictly "Positive", "Neutral", or "Negative".
- "score" must be a number between 0.00 and 1.00.
- "profane_terms" lists profanity, slurs, or insults in English, Tagalog, or Taglish that appear in the review, including disguised spellings (spaced letters, symbols, repeated letters). Copy each one EXACTLY as written in the review. Use [] if there are none. Never include normal words, food names, product names, or people's names.`;

        const response = await getAi().models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                temperature: 0.1,
                maxOutputTokens: 1024,
                safetySettings: SAFETY_SETTINGS,
            },
        });

        const rawContent = response.text;
        if (!rawContent) {
            throw new Error(
                `Empty completion from Gemini (block: ${response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason || "unknown"})`
            );
        }

        const result = JSON.parse(rawContent);

        const validLabels = ["Positive", "Neutral", "Negative"];
        const label = validLabels.includes(result.label) ? result.label : "Neutral";
        const score = typeof result.score === "number" ? result.score : 0.5;

        // Only accept terms that really appear in the comment
        const lower = original.toLowerCase();
        const profane_terms = Array.isArray(result.profane_terms)
            ? [
                ...new Set(
                    result.profane_terms
                        .filter((t) => typeof t === "string")
                        .map((t) => t.trim())
                        .filter(
                            (t) =>
                                t.length >= 2 &&
                                t.length <= 40 &&
                                lower.includes(t.toLowerCase())
                        )
                ),
            ].slice(0, 10)
            : [];

        return NextResponse.json({
            success: true,
            label,
            score,
            profane_terms,
        });
    } catch (error) {
        console.error("Sentiment analysis error:", error?.message || error);
        return NextResponse.json({
            success: false,
            label: "Neutral",
            score: 0.5,
            profane_terms: [],
        });
    }
}