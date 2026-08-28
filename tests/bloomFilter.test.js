const test = require('node:test');
const assert = require('node:assert');
const BloomFilter = require('../server/bloomFilter');

test('BloomFilter - Basic Operations', () => {
    const bf = new BloomFilter(1000, 4);

    // Initial state: nothing should match
    assert.strictEqual(bf.check('abc'), false);
    assert.strictEqual(bf.check('xyz'), false);

    // Add and check
    bf.add('abc');
    assert.strictEqual(bf.check('abc'), true);
    assert.strictEqual(bf.check('xyz'), false);

    bf.add('xyz');
    assert.strictEqual(bf.check('abc'), true);
    assert.strictEqual(bf.check('xyz'), true);
});

test('BloomFilter - False Positive Probability', () => {
    // With 10,000 bits and 4 hashes, for 500 inserted elements,
    // the false positive rate should be quite low (~1%).
    const bf = new BloomFilter(10000, 4);
    const inserted = new Set();

    // Insert 500 random keys
    for (let i = 0; i < 500; i++) {
        const key = `key_${i}`;
        bf.add(key);
        inserted.add(key);
    }

    // Verify all inserted keys are found (No false negatives)
    for (const key of inserted) {
        assert.strictEqual(bf.check(key), true);
    }

    // Check false positive rate on 10,000 uninserted keys
    let falsePositives = 0;
    const testCount = 10000;
    for (let i = 0; i < testCount; i++) {
        const key = `test_${i}`;
        if (bf.check(key)) {
            falsePositives++;
        }
    }

    const falsePositiveRate = falsePositives / testCount;
    console.log(`Bloom Filter False Positive Rate with m=10000, k=4, n=500: ${(falsePositiveRate * 100).toFixed(2)}% (${falsePositives}/${testCount})`);
    
    // It should be well below 5% for these parameters
    assert.ok(falsePositiveRate < 0.05, `False positive rate ${falsePositiveRate} was too high`);
});

test('BloomFilter - Clear Operations', () => {
    const bf = new BloomFilter(1000, 3);
    bf.add('test');
    assert.strictEqual(bf.check('test'), true);

    bf.clear();
    assert.strictEqual(bf.check('test'), false);
});
