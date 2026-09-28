import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

sharp.cache(false);

export const dynamic = "force-dynamic";

const IMAGE_SEARCH_PROMPT = `
Look at this image and identify the primary item.

Your job is to generate 1 or 2 core search keywords for an online student marketplace.

Return ONLY valid JSON in exactly this format:
{
  "query": "core product keywords"
}

QUERY RULES:
- Maximum 1 to 2 words only.
- Focus ONLY on the primary product noun (e.g., "calculator", "uniform", "stethoscope", "backpack", "shoes").
- Omit descriptive adjectives (color, size, material) unless essential to identify the object (e.g. "nursing uniform").
- Do NOT include filler words, brand names, or full sentences.
- Return raw JSON only.
`;

async function analyzeWithGemini(base64Image) {
    const model = process.env.GEMINI_MODEL || process.env.GEMINI_IMAGE_SEARCH_MODEL || "gemini-3.6-flash";

    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    const response = await ai.models.generateContent({
        model,
        contents: [
            {
                parts: [
                    { text: IMAGE_SEARCH_PROMPT },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: base64Image
                        }
                    }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json"
        }
    });

    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty response");

    const parsed = JSON.parse(text);
    if (!parsed.query || typeof parsed.query !== "string") {
        throw new Error(`Gemini response did not contain a valid query: ${text}`);
    }

    return parsed.query.trim().replace(/\s+/g, " ").toLowerCase();
}

async function analyzeWithGroq(base64Image, groqKey) {
    const model = process.env.GROQ_IMAGE_SEARCH_MODEL || "qwen/qwen3.8-27b";
    // ... rest of function remains identical


    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: IMAGE_SEARCH_PROMPT },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 100 // Capped to stay well below Groq's 1,000 OTPM free tier limit
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Groq returned an empty response");

    const parsed = JSON.parse(text);
    if (!parsed.query || typeof parsed.query !== "string") {
        throw new Error(`Groq response did not contain a valid query: ${text}`);
    }

    return parsed.query.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get("image");

        if (!file) {
            return Response.json({ error: "No image provided" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        let base64Image;
        try {
            const compressedBuffer = await sharp(buffer)
                .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
            base64Image = compressedBuffer.toString("base64");
        } catch (sharpError) {
            base64Image = buffer.toString("base64");
        }

        let geminiError = null;
        if (process.env.GEMINI_API_KEY) {
            try {
                const query = await analyzeWithGemini(base64Image);
                console.log("Gemini image search succeeded:", query);
                return Response.json({ query, provider: "gemini" });
            } catch (error) {
                geminiError = error?.message || String(error);
                console.warn("Gemini image search failed, trying Groq fallback:", geminiError);
            }
        }

        let groqError = null;
        if (process.env.GROQ_API_KEY) {
            try {
                const query = await analyzeWithGroq(base64Image, process.env.GROQ_API_KEY);
                console.log("Groq image search succeeded:", query);
                return Response.json({ query, provider: "groq" });
            } catch (error) {
                groqError = error?.message || String(error);
                console.error("Groq image search failed:", groqError);
            }
        }

        return Response.json(
            { error: "Both vision services failed", geminiError, groqError },
            { status: 500 }
        );
    } catch (error) {
        console.error("Unhandled image search error:", error);
        return Response.json(
            { error: error?.message || "Unexpected image search error" },
            { status: 500 }
        );
    }
}