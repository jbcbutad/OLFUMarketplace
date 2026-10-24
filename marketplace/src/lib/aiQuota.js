import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns { userId } on success, or { error: NextResponse } to return immediately.
export async function requireAiUser(bucket, dailyLimit) {
    const supabase = await createClient();

    // getClaims verifies the JWT locally, same as your proxy, so no extra network hop
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub ?? null;
    if (!userId) {
        return {
            error: NextResponse.json(
                { error: "Please log in to use this feature." },
                { status: 401 }
            ),
        };
    }

    const { data: allowed, error } = await supabase.rpc("consume_ai_quota", {
        p_bucket: bucket,
        p_limit: dailyLimit,
    });

    if (error) {
        // Fail closed: if the counter is down, don't hand out free AI calls
        console.error("[aiQuota] rpc failed:", error.message);
        return {
            error: NextResponse.json(
                { error: "The AI is unavailable right now. Please try again later." },
                { status: 503 }
            ),
        };
    }

    if (!allowed) {
        return {
            error: NextResponse.json(
                { error: "You've reached today's limit for this feature. Try again tomorrow." },
                { status: 429 }
            ),
        };
    }

    return { userId };
}