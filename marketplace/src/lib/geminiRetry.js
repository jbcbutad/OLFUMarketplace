export async function generateWithRetry(generateFn, options = {}) {
    const maxAttempts = options.maxAttempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 1000;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await generateFn();
        } catch (error) {
            lastError = error;

            const status = error?.status || error?.code;

            // Only retry temporary/server/rate-limit errors.
            const shouldRetry =
                status === 429 ||
                status === 500 ||
                status === 502 ||
                status === 503 ||
                status === 504;

            if (!shouldRetry || attempt === maxAttempts) {
                throw error;
            }

            const delay = baseDelayMs * Math.pow(2, attempt - 1);

            console.warn(
                `[Gemini] Attempt ${attempt} failed (${status}). Retrying in ${delay}ms...`
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}