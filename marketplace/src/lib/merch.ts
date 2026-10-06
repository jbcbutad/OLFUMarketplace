// src/lib/merch.ts
// ONE place that decides "is this listing official merch?" in the app.
// Mirrors the database rule: public.is_merch_listing(category_id, tags).

const MERCH_TAG_KEY = "officialmerch";

// PHASE 2: delete this line and the category check at the bottom of isMerch()
const LEGACY_MERCH_CATEGORY = "merchandise";

/**
 * "official-merch", "Official Merch", "#official_merch" -> true.
 * Same normalisation as tags_have_merch() in SQL: lowercase, drop spaces _ # -
 */
export function tagsHaveMerch(tags: unknown): boolean {
    if (!Array.isArray(tags)) return false;
    return tags.some(
        (t) => String(t).toLowerCase().replace(/[\s_#-]+/g, "") === MERCH_TAG_KEY
    );
}

type CategoryLike = { name?: string | null };

type MerchLike = {
    tags?: unknown;
    is_merch?: boolean | null;
    categories?: CategoryLike | CategoryLike[] | null;
};

export function isMerch(p: MerchLike | null | undefined): boolean {
    if (!p) return false;
    if (p.is_merch === true || tagsHaveMerch(p.tags)) return true;

    // PHASE 2: remove these three lines
    const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories;
    return (cat?.name ?? "").toLowerCase() === LEGACY_MERCH_CATEGORY;
}