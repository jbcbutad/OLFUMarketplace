import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
    try {
        // Only signed-in users may use the AI (protects the Groq quota)
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

        const completion = await groq.chat.completions.create({
            model: process.env.GROQ_TEXT_MODEL || "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a sentiment analyzer and profanity detector for a student marketplace (English, Tagalog, Taglish). You MUST respond strictly with a valid JSON object.",
                },
                {
                    role: "user",
                    content: `Analyze this review: "${original}".
Respond with valid JSON:
{
  "label": "Positive",
  "score": 0.95,
  "profane_terms": []
}
Rules:
- "label" must be strictly "Positive", "Neutral", or "Negative".
- "score" must be a number between 0.00 and 1.00.
- "profane_terms" lists profanity, slurs, or insults in English, Tagalog, or Taglish that appear in the review, including disguised spellings (spaced letters, symbols, repeated letters). Copy each one EXACTLY as written in the review. Use [] if there are none. Never include normal words, food names, product names, or people's names.`,
                },
            ],
            response_format: { type: "json_object" },
            max_tokens: 150,
            temperature: 0.1,
        });

        const rawContent = completion.choices?.[0]?.message?.content;
        if (!rawContent) throw new Error("Empty completion from Groq");

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