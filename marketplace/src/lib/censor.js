import { Filter } from "bad-words";

const filipinoBadWords = [
    "tangina", "taena", "gago", "gaga", "bobo", "tarantado",
    "kupal", "ulol", "punyeta", "bwisit", "leche", "pucha",
    "puchangina", "potangina", "putangina", "pokpok", "kantot",
    "bayag", "pepe", "titi", "Putaena"
];

let filter;

try {
    filter = new Filter();
    filter.addWords(...filipinoBadWords);
} catch (err) {
    console.warn("Failed to initialize bad-words filter instance:", err?.message);
}

export function sanitizeText(text) {
    if (!text || typeof text !== "string") return "";

    if (filter?.clean) {
        try {
            return filter.clean(text);
        } catch (err) {
            console.error("Sanitization error:", err?.message);
        }
    }

    // Fallback profanity replacement if filter instance fails
    let cleanedText = text;
    filipinoBadWords.forEach((word) => {
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        cleanedText = cleanedText.replace(regex, "***");
    });

    return cleanedText;
}