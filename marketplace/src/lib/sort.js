export const SORT_OPTIONS = [
    { value: "newest", label: "Newest first" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "title", label: "Name: A to Z" },
];

const SORT_KEYS = SORT_OPTIONS.map((o) => o.value);

// Returns a valid sort key from the URL ("newest" if missing or unknown)
export const parseSort = (v) => (SORT_KEYS.includes(v) ? v : "newest");

// Returns a sorted copy. "newest" keeps the order the query already returned.
export function sortProducts(list, sort) {
    const price = (p) => Number(p.price) || 0;
    if (sort === "price-asc") return [...list].sort((a, b) => price(a) - price(b));
    if (sort === "price-desc") return [...list].sort((a, b) => price(b) - price(a));
    if (sort === "title") {
        return [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    return list;
}