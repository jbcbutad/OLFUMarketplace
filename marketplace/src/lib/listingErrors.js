// Turns raw database errors into messages sellers can act on
export function friendlyListingError(err) {
    const msg = String(err?.message || "");
    if (err?.code === "23505" && msg.includes("products_one_live_title_per_seller")) {
        return "You already have a live listing with this title. Change the title or remove the existing one first.";
    }
    return msg || "Something went wrong.";
}