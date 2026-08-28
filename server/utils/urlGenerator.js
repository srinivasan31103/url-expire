const db = require('../db');

// 31 characters: standard lowercase alphabet and numbers, omitting confusable ones:
// 'o', '0', 'i', 'l', '1' are removed.
const CHARACTER_SET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 4;

/**
 * Generate a random 4-character short code.
 * @returns {string}
 */
function generateRandomCode() {
    let result = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * CHARACTER_SET.length);
        result += CHARACTER_SET[randomIndex];
    }
    return result;
}

/**
 * Allocate a unique short code for a new active URL.
 * Relies on the Bloom filter for fast checks, and queries the database for double-checking.
 * 
 * @param {BloomFilter} bloomFilter - The custom Bloom filter instance
 * @returns {Promise<string>} A unique short code
 */
async function allocateShortCode(bloomFilter) {
    const maxRetries = 15;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const code = generateRandomCode();

        // 1. Check the Bloom Filter (probabilistic check)
        const isPresentProbable = bloomFilter.check(code);

        if (isPresentProbable) {
            // The Bloom filter says the code might be active.
            // We MUST double-check the database for any active links with this code.
            const result = await db.query(
                `SELECT 1 FROM short_urls WHERE short_code = $1 AND expires_at > NOW()`,
                [code]
            );

            if (result.rows.length > 0) {
                // Actual collision: code is active in the database.
                console.log(`[Collision] Active code collision in DB: ${code}. Retrying...`);
                continue;
            }
            
            // False positive: Bloom filter returned true, but it's not active in the database.
            // We can safely use this code!
            console.log(`[False Positive] Bloom filter false positive for: ${code}. Reusing code.`);
        }

        // The code is either not in the Bloom filter, or was a false positive.
        // It is free to use.
        return code;
    }

    throw new Error("Unable to generate a unique short code. Capacity limit reached or high collision rate.");
}

module.exports = {
    CHARACTER_SET,
    CODE_LENGTH,
    generateRandomCode,
    allocateShortCode
};
