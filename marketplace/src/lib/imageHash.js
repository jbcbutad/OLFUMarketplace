// 64-bit "difference hash": a fingerprint of what a photo looks like.
// Resized / re-saved / slightly cropped copies get nearly the same fingerprint.
export const computeDHash = (file) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = 9;
                canvas.height = 8;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, 9, 8);
                const { data } = ctx.getImageData(0, 0, 9, 8);
                URL.revokeObjectURL(url);

                const gray = [];
                for (let i = 0; i < data.length; i += 4) {
                    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                }
                let bits = 0n;
                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        bits = (bits << 1n) | (gray[y * 9 + x] > gray[y * 9 + x + 1] ? 1n : 0n);
                    }
                }
                resolve(BigInt.asIntN(64, bits).toString()); // string: JS numbers can't hold 64 bits
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("hash: load failed"));
        };
        img.src = url;
    });

// Number of differing bits between two hashes (0 = identical, <= 5 = same photo)
export const hammingDistance = (a, b) => {
    let x = BigInt.asUintN(64, BigInt(a) ^ BigInt(b));
    let count = 0;
    while (x) {
        count += Number(x & 1n);
        x >>= 1n;
    }
    return count;
};