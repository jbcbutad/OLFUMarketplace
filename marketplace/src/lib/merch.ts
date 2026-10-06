// ONE place that decides "is this listing official merch?" in the app.
// Mirrors the database rule: public.is_merch_listing(category_id, tags).

const MERCH_TAG_KEY = "officialmerch";

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

type MerchLike = {
    tags?: unknown;
    is_merch?: boolean | null;
    categories?: unknown;
};

export function isMerch(p: MerchLike | null | undefined): boolean {
    if (!p) return false;
    return p.is_merch === true || tagsHaveMerch(p.tags);
}