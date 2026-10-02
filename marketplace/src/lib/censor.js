import { Filter } from "bad-words"; // v4+. If `npm ls bad-words` shows v3, use: import Filter from "bad-words"

// Matched as whole words only
const wholeWords = [
    "burat", "bayag", "betlog", "pekpek", "pepe", "puke", "puki", "tamod", "semilya",
    "puta", "putang", "putangina", "pucha", "puchangina", "potangina", "putaena", "taena",
    "tangina", "punyeta", "punyemas", "gago", "gaga", "gagong", "tanga", "bobo", "ulol",
    "tarantado", "tarantada", "lintik", "bwisit", "buwisit", "hinayupak", "siraulo",
    "pisti", "yawa", "buang", "mokong", "ampota", "inutil", "pokpok",
    "libog", "malibog", "kalibugan", "malaswa", "kahalayan",
    "masturbate", "masturbation", "nagsasalsal",
];

// Matched even inside longer words (makipagkantot, nagkakantutan, magjakol...)
const stems = ["kantot", "kantut", "iyot", "jakol", "salsal", "tangina"];

// Spaced or hyphenated spellings. Spaces match any run of spaces or hyphens.
const phrases = ["tang ina", "putang ina", "puta ina", "walang hiya", "sira ulo", "naghahanap ng sex"];

const L = "\\p{L}\\p{N}";
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stars = (s) => "*".repeat(Math.min(s.length, 8));

const phraseRe = new RegExp(
    `(^|[^${L}])(${phrases.map((p) => escapeRegex(p).replace(/\s+/g, "[\\s-]*")).join("|")})(?![${L}])`,
    "giu"
);
const stemRe = new RegExp(`(^|[^${L}])(\\p{L}*(?:${stems.join("|")})\\p{L}*)`, "giu");
const wordRe = new RegExp(`(^|[^${L}])(${wholeWords.join("|")})(?![${L}])`, "giu");

let filter;
try {
    filter = new Filter(); // English list only
} catch (err) {
    console.warn("Failed to initialize bad-words filter instance:", err?.message);
}

export function sanitizeText(text) {
    if (!text || typeof text !== "string") return "";

    let out = text;
    for (const re of [phraseRe, stemRe, wordRe]) {
        out = out.replace(re, (_m, pre, hit) => pre + stars(hit));
    }

    if (filter?.clean) {
        try {
            return filter.clean(out);
        } catch (err) {
            console.error("Sanitization error:", err?.message);
        }
    }
    return out;
}

export function maskTerms(text, terms) {
    if (!text || typeof text !== "string") return "";
    if (!Array.isArray(terms)) return text;

    let out = text;
    for (const term of terms) {
        if (typeof term !== "string" || term.length < 2) continue;
        try {
            const re = new RegExp(`(?<![${L}])${escapeRegex(term)}(?![${L}])`, "giu");
            out = out.replace(re, stars(term));
        } catch {
            // Skip this term if the browser can't build the pattern
        }
    }
    return out;
}