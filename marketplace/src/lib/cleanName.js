export function cleanName(raw) {
    if (!raw) return "";
    const original = String(raw).trim();

    // drop class-number prefixes like "2 - ", "23 - ", "A10 – "
    let n = original.replace(/^[A-Za-z]?\d+\s*[-–—.:)]\s*/, "");

    // "Last, First" -> "First Last" (skips suffixes like ", Jr.")
    const parts = n.split(",");
    if (
        parts.length === 2 &&
        parts[0].trim() &&
        parts[1].trim() &&
        !/^(jr|sr|ii|iii|iv)\.?$/i.test(parts[1].trim())
    ) {
        n = `${parts[1].trim()} ${parts[0].trim()}`;
    }

    n = n.replace(/\s+/g, " ").trim();
    return n || original;
}