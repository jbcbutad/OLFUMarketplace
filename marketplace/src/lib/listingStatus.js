// Single place that decides what state a listing is in.
// Every page (details, My Listings, profiles, banners) should use this
// instead of doing its own date math.

export const MERCH_CATEGORY = "Merchandise";

export const isMerch = (product) => product?.categories?.name === MERCH_CATEGORY;

/**
 * Returns one of:
 *  "flagged" | "rejected" | "pending_approval" | "expired" | "unavailable" | "active"
 *
 * Needs these fields on the product: status, is_available, expires_at, tags.
 */
export function getListingState(product, now = new Date()) {
    if (!product) return "unavailable";
    const { status, is_available, expires_at, tags } = product;

    if (status === "flagged") return "flagged";
    if (status === "rejected") return "rejected";
    if (status === "pending") return "pending_approval";
    if (status === "expired") return "expired";

    // Older rows: the client used to mark expired merch as "unavailable" + an "Expired" tag.
    if (Array.isArray(tags) && tags.includes("Expired") && status !== "active") {
        return "expired";
    }

    // The hourly job can lag up to an hour behind expires_at, so check the date too.
    if (status === "active" && expires_at && new Date(expires_at) <= now) {
        return "expired";
    }

    if (status === "unavailable" || !is_available) return "unavailable";
    return "active";
}

/** Whole days left until expires_at (0 = today), or null if there is no clock. */
export function daysLeft(product, now = new Date()) {
    if (!product?.expires_at) return null;
    const ms = new Date(product.expires_at) - now;
    return Math.max(0, Math.ceil(ms / 86400000));
}