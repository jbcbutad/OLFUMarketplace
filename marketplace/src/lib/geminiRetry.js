export async function generateWithRetry(generateFn, options = {}) {
    const maxAttempts = options.maxAttempts ?? 5;
    const baseDelayMs = options.baseDelayMs ?? 1000;
    const fallbackFn = options.fallbackFn;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            // Last attempt: switch to the fallback model if one was given
            if (attempt === maxAttempts && fallbackFn) return await fallbackFn();
            return await generateFn();
        } catch (error) {
            lastError = error;
            const status = error?.status || error?.code;
            const shouldRetry = [429, 500, 502, 503, 504].includes(status);

            if (!shouldRetry || attempt === maxAttempts) throw error;

            const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
            console.warn(`[Gemini] Attempt ${attempt} failed (${status}). Retrying in ${Math.round(delay)}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}