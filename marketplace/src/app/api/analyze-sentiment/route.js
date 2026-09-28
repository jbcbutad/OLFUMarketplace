import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
    try {
        const { comment } = await req.json();

        if (!comment || !comment.trim()) {
            return NextResponse.json({
                success: true,
                label: null,
                score: null,
            });
        }

        const completion = await groq.chat.completions.create({
            model: process.env.GROQ_TEXT_MODEL || "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: "You are a sentiment analyzer for a student marketplace (English, Tagalog, Taglish). You MUST respond strictly with a valid JSON object.",
                },
                {
                    role: "user",
                    content: `Analyze the sentiment of this review: "${comment.trim()}".
Respond with valid JSON:
{
  "label": "Positive",
  "score": 0.95
}
Rules:
- "label" must be strictly "Positive", "Neutral", or "Negative".
- "score" must be a number between 0.00 and 1.00.`,
                },
            ],
            response_format: { type: "json_object" },
            max_tokens: 100,
            temperature: 0.1,
        });

        const rawContent = completion.choices?.[0]?.message?.content;
        if (!rawContent) throw new Error("Empty completion from Groq");

        const result = JSON.parse(rawContent);

        const validLabels = ["Positive", "Neutral", "Negative"];
        const label = validLabels.includes(result.label) ? result.label : "Neutral";
        const score = typeof result.score === "number" ? result.score : 0.50;

        return NextResponse.json({
            success: true,
            label,
            score,
        });
    } catch (error) {
        console.error("Sentiment analysis error:", error?.message || error);
        return NextResponse.json({
            success: false,
            label: "Neutral",
            score: 0.50,
        });
    }
}