import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key in environment variables.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
    try {
        const { sellerId } = await req.json();

        if (!sellerId) {
            return NextResponse.json(
                { success: false, error: "Seller ID required" },
                { status: 400 }
            );
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("ai_summary")
            .eq("id", sellerId)
            .single();

        if (profileError && profileError.code !== "PGRST116") {
            throw profileError;
        }

        const existingSummary = profile?.ai_summary || null;

        const { data: reviews, error: fetchError } = await supabaseAdmin
            .from("reviews")
            .select("rating, comment, sentiment_label, sentiment_score")
            .eq("reviewee_id", sellerId)
            .eq("role_reviewed", "seller")
            .order("created_at", { ascending: true });

        if (fetchError) throw fetchError;

        if (!reviews || reviews.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No reviews to summarize",
            });
        }

        const prunedReviews = reviews
            .map((review) => {
                const rating = Number(review.rating) || 0;
                const sentiment = review.sentiment_label || "Unknown";
                const comment = review.comment?.trim() || "No written comment";
                return `[${rating}/5 - ${sentiment}] "${comment}"`;
            })
            .join("\n");

        const existingSummaryText = existingSummary
            ? `Existing AI Summary:\n${JSON.stringify(existingSummary)}\n`
            : "There is no existing AI summary yet.";

        const prompt = `
${existingSummaryText}

Seller Reviews:
${prunedReviews}

Based ONLY on the seller reviews above, generate or update the seller's review summary.

Return STRICTLY valid JSON using exactly this structure:

{
  "summary": "1 to 2 concise sentences describing the overall buyer experience.",
  "pros": [
    "Short recurring strength"
  ],
  "cons": [
    "Short recurring complaint"
  ]
}

Rules:
- "summary" must be a string.
- "pros" must contain a maximum of 3 items.
- "cons" must contain a maximum of 3 items.
- Use [] when there are no meaningful pros or cons.
- Do not use markdown.
        `.trim();

        const completion = await groq.chat.completions.create({
            model: process.env.GROQ_TEXT_MODEL || "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: "You are an AI review summarizer for a student marketplace. Return strictly valid raw JSON.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
            max_tokens: 500,
            temperature: 0.2,
        });

        const rawContent = completion.choices?.[0]?.message?.content;
        if (!rawContent) throw new Error("Groq returned an empty response");

        const summaryData = JSON.parse(rawContent);

        if (
            typeof summaryData.summary !== "string" ||
            !Array.isArray(summaryData.pros) ||
            !Array.isArray(summaryData.cons)
        ) {
            throw new Error("Groq returned an invalid summary structure");
        }

        summaryData.pros = summaryData.pros
            .filter((item) => typeof item === "string")
            .slice(0, 3);

        summaryData.cons = summaryData.cons
            .filter((item) => typeof item === "string")
            .slice(0, 3);

        const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update({ ai_summary: summaryData })
            .eq("id", sellerId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, summaryData });
    } catch (error) {
        console.error("Groq Summary API error:", error?.message || error);
        return NextResponse.json(
            { success: false, error: error?.message || "Review summary generation failed" },
            { status: 500 }
        );
    }
}