import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { generateWithRetry } from "@/lib/geminiRetry";

export const dynamic = "force-dynamic";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface RequestBody {
  description?: string;
  image?: string;
}

interface ListingOutput {
  title: string;
  description: string;
  price: number;
  suggestedTags: string[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body: RequestBody = await req.json();
    const { description: userPrompt, image } = body;

    if (!userPrompt && !image) {
      return NextResponse.json({ error: "Provide an image or short text note." }, { status: 400 });
    }

    const promptText = `You are an expert marketplace assistant for Our Lady of Fatima University (OLFU).
Analyze the provided item details or image and generate an optimized listing.

User note: "${userPrompt || "None provided"}"

Return ONLY valid JSON matching this exact structure:
{
  "title": "Concise product title",
  "description": "Engaging 2-3 sentence student sales description.",
  "price": 350,
  "suggestedTags": ["textbook", "medicine", "olfu"]
}

Price must be a realistic number in Philippine Pesos (PHP). Do not wrap in backticks or markdown formatting.`;

    const contents: any[] = [promptText];

    if (image && typeof image === "string") {
      if (image.startsWith("data:")) {
        const matches = image.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          contents.push({
            inlineData: { mimeType: matches[1], data: matches[2] },
          });
        }
      } else {
        contents.push(image);
      }
    }

    const run = (model: string) =>
      ai.models.generateContent({
        model,
        contents,
        config: { responseMimeType: "application/json" },
      });

    const response = await generateWithRetry(
      () => run(process.env.GEMINI_MODEL || "gemini-3.6-flash"),
      { fallbackFn: () => run(process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash") }
    );
    const parsed: ListingOutput = JSON.parse(response.text);
    return NextResponse.json({ success: true, listing: parsed, provider: "gemini" });
  } catch (error: any) {
    console.error("Listing generation error:", error);
    const msg = String(error?.message || "");
    const busy =
      error?.status === 503 || error?.status === 429 ||
      /UNAVAILABLE|high demand|RESOURCE_EXHAUSTED/i.test(msg);
    return NextResponse.json(
      { error: busy ? "The AI is busy right now. Please try again in a minute." : "Couldn't generate details. Please try again." },
      { status: busy ? 503 : 500 }
    );
  }
}