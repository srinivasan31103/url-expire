/**
 * A custom Bloom Filter implementation.
 * It uses a Uint8Array as a bit array and simulates k hash functions using FNV-1a
 * and double hashing (Kirsch-Mitzenmacher technique).
 */
class BloomFilter {
    /**
     * @param {number} size - Number of bits in the filter (m)
     * @param {number} numHashes - Number of hash functions (k)
     */
    constructor(size = 1000000, numHashes = 5) {
        this.size = size;
        this.numHashes = numHashes;
        // Calculate number of bytes needed to store 'size' bits
        this.numBytes = Math.ceil(size / 8);
        this.bitArray = new Uint8Array(this.numBytes);
    }

    /**
     * 32-bit FNV-1a hash function.
     * @param {string} str - String to hash
     * @param {number} seed - Offset basis / seed
     * @returns {number} 32-bit unsigned integer hash
     */
    _fnv1a(str, seed) {
        let hash = seed;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    /**
     * Get the bit indices for a given string.
     * Uses double hashing: g_i(x) = (h1(x) + i * h2(x)) % m
     * @param {string} str 
     * @returns {number[]} Array of bit indices
     */
    _getIndices(str) {
        // Compute two base hashes
        const h1 = this._fnv1a(str, 2166136261);
        const h2 = this._fnv1a(str, 1540483477);
        const indices = [];

        for (let i = 0; i < this.numHashes; i++) {
            // Compute combined hash and ensure positive unsigned value
            const index = (h1 + i * h2) >>> 0;
            indices.push(index % this.size);
        }

        return indices;
    }

    /**
     * Add an item to the Bloom filter.
     * @param {string} item 
     */
    add(item) {
        if (typeof item !== 'string') {
            item = String(item);
        }
        const indices = this._getIndices(item);
        for (const index of indices) {
            const byteIndex = Math.floor(index / 8);
            const bitOffset = index % 8;
            this.bitArray[byteIndex] |= (1 << bitOffset);
        }
    }

    /**
     * Check if an item is in the Bloom filter.
     * Returns false if definitely not present, true if probably present.
     * @param {string} item 
     * @returns {boolean}
     */
    check(item) {
        if (typeof item !== 'string') {
            item = String(item);
        }
        const indices = this._getIndices(item);
        for (const index of indices) {
            const byteIndex = Math.floor(index / 8);
            const bitOffset = index % 8;
            if ((this.bitArray[byteIndex] & (1 << bitOffset)) === 0) {
                return false; // Definitely not present
            }
        }
        return true; // Probably present (or false positive)
    }

    /**
     * Clear all bits in the Bloom filter.
     */
    clear() {
        this.bitArray.fill(0);
    }
}

module.exports = BloomFilter;
