const test = require('node:test');
const assert = require('node:assert');
const { generateRandomCode, CHARACTER_SET, CODE_LENGTH, allocateShortCode } = require('../server/utils/urlGenerator');

test('URL Generator - Basic Constraints', () => {
    const code = generateRandomCode();
    
    // Length check
    assert.strictEqual(code.length, CODE_LENGTH);

    // Character set check
    for (const char of code) {
        assert.ok(CHARACTER_SET.includes(char), `Character '${char}' is not in the allowed character set`);
    }
});

test('URL Generator - Collision Resolution Logic', async () => {
    // Mock Bloom Filter
    const mockBloomFilter = {
        checks: [],
        check(code) {
            this.checks.push(code);
            // Simulate that the first two generated codes are already in the filter
            if (this.checks.length <= 2) {
                return true; 
            }
            return false;
        }
    };

    // Mock DB queries
    // We'll require db in urlGenerator. So we can override it temporarily or mock its queries.
    const db = require('../server/db');
    const originalQuery = db.query;

    let queryCount = 0;
    db.query = async (text, params) => {
        queryCount++;
        // First query: Bloom filter says true, and DB returns an active URL (actual collision)
        if (queryCount === 1) {
            return { rows: [{ 1: 1 }] }; // Collision
        }
        // Second query: Bloom filter says true, but DB returns no active URL (false positive)
        return { rows: [] }; // No collision
    };

    try {
        const code = await allocateShortCode(mockBloomFilter);
        
        // Assertions
        assert.strictEqual(code.length, CODE_LENGTH);
        // It should have checked the Bloom Filter at least 2 times (1st: collision, 2nd: false positive)
        assert.ok(mockBloomFilter.checks.length >= 2, "Bloom filter should have been checked multiple times");
        // DB query should have been run for the first checks that returned true
        assert.strictEqual(queryCount, 2, "DB query should have run exactly twice (once for collision, once for false positive)");
    } finally {
        // Restore db.query
        db.query = originalQuery;
    }
});
