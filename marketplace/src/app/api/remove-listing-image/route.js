import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MARKER = `/storage/v1/object/public/${BUCKET}/`;

export async function POST(req) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { productId, imageUrl } = await req.json();
        if (typeof productId !== "string" || typeof imageUrl !== "string") {
            return Response.json({ error: "Invalid request." }, { status: 400 });
        }

        // Runs as the signed-in user; the function checks ownership itself
        const { data, error } = await supabase.rpc("remove_listing_image", {
            p_product_id: productId,
            p_image_url: imageUrl,
        });
        if (error) return Response.json({ error: error.message }, { status: 400 });

        // Best effort: never fails the request, the listing is already updated
        if (data?.safe_to_delete) {
            const i = imageUrl.indexOf(MARKER);
            const path = i === -1 ? "" : decodeURIComponent(imageUrl.slice(i + MARKER.length).split("?")[0]);
            if (path.startsWith("listings/") && !path.includes("..")) {
                const { error: rmError } = await createAdminClient().storage.from(BUCKET).remove([path]);
                if (rmError) console.error("[remove-listing-image] storage delete failed:", rmError.message);
            }
        }

        return Response.json({ success: true, remaining: data?.remaining ?? null });
    } catch (err) {
        console.error("[remove-listing-image] failed:", err?.message);
        return Response.json({ error: "Couldn't remove the photo. Please try again." }, { status: 500 });
    }
}