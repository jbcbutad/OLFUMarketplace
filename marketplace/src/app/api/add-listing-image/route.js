import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAiUser } from "@/lib/aiQuota";
import { sniffImageType } from "@/lib/imageValidation";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "product-images";
const MAX_PHOTOS = 10;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // browser sends a compressed JPEG; Vercel caps bodies near 4.5 MB
const EDITABLE_STATUS = ["active", "unavailable", "expired"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESERVED_TAGS = ["official-merch", "flagged", "pending", "expired"];

const fail = (error, status = 400) => Response.json({ error }, { status });

// Same 64-bit difference hash the browser computes (src/lib/imageHash.js), done on the server
// so it can't be faked. The browser draws onto a canvas; here sharp does the resize.
async function computeDHashServer(buf) {
    const { data } = await sharp(buf)
        .rotate()
        .flatten({ background: "#000000" })
        .toColourspace("srgb")
        .resize(9, 8, { fit: "fill" })
        .raw()
        .toBuffer({ resolveWithObject: true });

    const gray = [];
    for (let i = 0; i < data.length; i += 3) {
        gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    let bits = 0n;
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            bits = (bits << 1n) | (gray[y * 9 + x] > gray[y * 9 + x + 1] ? 1n : 0n);
        }
    }
    return BigInt.asIntN(64, bits);
}

function hamming(a, b) {
    let x = BigInt.asUintN(64, a ^ b);
    let n = 0;
    while (x) {
        n += Number(x & 1n);
        x >>= 1n;
    }
    return n;
}

export async function POST(req) {
    let uploadedPath = null;
    const admin = createAdminClient();

    try {
        // 1. Who is asking
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return fail("Unauthorized", 401);

        // 2. Basic input checks
        const form = await req.formData();
        const productId = String(form.get("productId") || "");
        const file = form.get("image");
        // Set by the edit screen after the seller says "add anyway" to the look-alike warning
        const confirmSimilar = form.get("confirmSimilar") === "true";

        if (!UUID_RE.test(productId)) return fail("Invalid request.");
        if (!file || typeof file === "string") return fail("Choose a photo to add.");
        if (file.size > MAX_UPLOAD_BYTES) return fail("That photo is too large.", 413);

        const buf = Buffer.from(await file.arrayBuffer());
        if (!sniffImageType(buf)) return fail("Only JPG, PNG or WEBP photos are allowed.");

        // 3. The listing must be the caller's and in an editable state
        const { data: product } = await supabase
            .from("products")
            .select("id, seller_id, status, title, description, tags, image_urls")
            .eq("id", productId)
            .maybeSingle();

        if (!product || product.seller_id !== user.id) return fail("Not your listing.", 403);
        if (!EDITABLE_STATUS.includes(product.status)) {
            return fail("Photos can't be changed while this listing is under review.", 409);
        }
        if ((product.image_urls?.length ?? 0) >= MAX_PHOTOS) {
            return fail(`A listing can have at most ${MAX_PHOTOS} photos.`);
        }

        const tags = Array.isArray(product.tags) ? product.tags : [];
        const isMerch = tags.some((t) => String(t).toLowerCase() === "official-merch");

        // 4. Fingerprint + duplicate check (done before spending an AI call)
        let hash;
        try {
            hash = await computeDHashServer(buf);
        } catch (err) {
            console.error("[add-listing-image] hash failed:", err?.message);
            return fail("Couldn't read that photo. Try a different one.");
        }

        const { data: dup, error: dupError } = await admin.rpc("check_new_photo", {
            p_user_id: user.id,
            p_product_id: productId,
            p_hash: hash.toString(),
        });
        if (dupError) {
            console.error("[add-listing-image] duplicate check failed:", dupError.message);
            return fail("Couldn't check that photo right now. Please try again.", 503);
        }

        const crossSeller = !!dup?.other_seller_image;

        // The same photo twice on one listing is always a mistake (merch variants are exempt).
        // Stored fingerprints may have been made by the browser, so compare against the real files.
        if (!isMerch) {
            const supaHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
            const marker = `/storage/v1/object/public/${BUCKET}/`;
            const existing = (product.image_urls || []).filter((u) => {
                try {
                    return typeof u === "string" && u.includes(marker) && new URL(u).host === supaHost;
                } catch {
                    return false;
                }
            });
            const results = await Promise.allSettled(
                existing.map(async (u) => {
                    const r = await fetch(u);
                    if (!r.ok) throw new Error("fetch failed");
                    return computeDHashServer(Buffer.from(await r.arrayBuffer()));
                })
            );
            const sameHere = results.some((r) => r.status === "fulfilled" && hamming(r.value, hash) <= 4);
            if (sameHere) return fail("That photo is already on this listing.", 409);

            const maxSame = Number(dup?.max_same_photo) || 5;
            if ((dup?.own_lookalike_count ?? 0) >= maxSame) {
                return fail(`You've already used this photo on ${maxSame} of your listings. Please use a different photo.`, 409);
            }

            // Looks like a photo on ANOTHER listing of this seller: ask first, don't block.
            // (Reusing a photo across your own listings can be legitimate, e.g. a different color.)
            if (dup?.own_other_title && !confirmSimilar) {
                return Response.json(
                    {
                        code: "similar_own_listing",
                        title: String(dup.own_other_title),
                        error: `This photo looks like one on your listing "${dup.own_other_title}".`,
                    },
                    { status: 409 }
                );
            }
        }

        // 5. Daily AI limit (after the cheap checks, before the AI call)
        const gate = await requireAiUser("edit-photo", 30);
        if (gate.error) return gate.error;

        // 6. AI moderation: reuse /api/moderate-listing so there is one set of rules
        const small = await sharp(buf)
            .rotate()
            .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();

        const modForm = new FormData();
        modForm.append("title", String(product.title || ""));
        modForm.append("description", String(product.description || ""));
        modForm.append(
            "tags",
            JSON.stringify(tags.filter((t) => !RESERVED_TAGS.includes(String(t).toLowerCase())))
        );
        modForm.append("merch", isMerch ? "true" : "false");
        modForm.append("images", new Blob([small], { type: "image/jpeg" }), "photo.jpg");

        const modRes = await fetch(new URL("/api/moderate-listing", req.url), {
            method: "POST",
            headers: { cookie: req.headers.get("cookie") || "" },
            body: modForm,
        });
        const mod = await modRes.json().catch(() => null);

        if (!modRes.ok || !mod) {
            return fail(
                mod?.error || "Couldn't check that photo right now. Please try again.",
                modRes.status === 429 ? 429 : 503
            );
        }
        // Moderation outage: don't attach, and don't punish the listing either
        if (mod.reason === "moderation_unavailable") {
            return fail("Couldn't check that photo right now. Please try again.", 503);
        }

        // Judge the photo only; the listing text was already moderated when it was posted
        if (mod.image_verdict === "rejected") {
            return fail(
                `This photo can't be used: ${mod.reason || "it appears to break our posting rules"}`,
                422
            );
        }
        const aiFlagged = mod.image_verdict === "flagged";
        const needsReview = aiFlagged || crossSeller;

        // 7. Re-encode (also strips camera metadata such as GPS) and upload
        const finalJpeg = await sharp(buf)
            .rotate()
            .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

        uploadedPath = `listings/${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.jpg`;
        const { error: uploadError } = await admin.storage
            .from(BUCKET)
            .upload(uploadedPath, finalJpeg, { contentType: "image/jpeg" });
        if (uploadError) {
            uploadedPath = null;
            throw uploadError;
        }
        const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(uploadedPath);

        // 8. Attach it (and hide the listing for review if needed)
        const categories = [
            ...(Array.isArray(mod.categories) ? mod.categories.slice(0, 5).map(String) : []),
            ...(crossSeller ? ["Duplicate photo"] : []),
        ];
        const reason =
            crossSeller && aiFlagged
                ? `DUPLICATE PHOTO: a photo added to this listing looks the same as a photo from another seller. Please check if it was copied. Also flagged by AI: ${mod.reason || "needs review"}`
                : crossSeller
                    ? "DUPLICATE PHOTO: a photo added to this listing looks the same as a photo from another seller's listing. Please check if the seller copied or stole it. Nothing else was wrong with the photo."
                    : mod.reason || null;

        const { data: added, error: addError } = await admin.rpc("add_listing_image", {
            p_user_id: user.id,
            p_product_id: productId,
            p_image_url: publicUrl,
            p_hash: hash.toString(),
            p_flag: needsReview,
            p_categories: categories,
            p_reason: reason,
        });
        if (addError) {
            // Nothing was attached, so don't leave the file behind
            await admin.storage.from(BUCKET).remove([uploadedPath]).catch(() => { });
            uploadedPath = null;
            return fail(addError.message || "Couldn't add the photo.", 400);
        }

        return Response.json({
            success: true,
            imageUrl: publicUrl,
            flagged: !!added?.flagged,
            count: added?.count ?? null,
        });
    } catch (err) {
        console.error("[add-listing-image] failed:", err?.message);
        if (uploadedPath) {
            await admin.storage.from(BUCKET).remove([uploadedPath]).catch(() => { });
        }
        return fail("Couldn't add the photo. Please try again.", 500);
    }
}