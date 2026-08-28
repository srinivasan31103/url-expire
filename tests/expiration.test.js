const test = require('node:test');
const assert = require('node:assert');

// Simple utility to determine if a URL is expired
function isExpired(expiresAtString) {
    const now = new Date();
    const expiresAt = new Date(expiresAtString);
    return now > expiresAt;
}

test('Expiration Logic - Expired Links', () => {
    // 1 hour in the past
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    assert.strictEqual(isExpired(oneHourAgo.toISOString()), true, "Link from 1 hour ago should be expired");
    
    // 1 second in the past
    const oneSecondAgo = new Date();
    oneSecondAgo.setSeconds(oneSecondAgo.getSeconds() - 1);
    
    assert.strictEqual(isExpired(oneSecondAgo.toISOString()), true, "Link from 1 second ago should be expired");
});

test('Expiration Logic - Active Links', () => {
    // 1 hour in the future
    const oneHourHence = new Date();
    oneHourHence.setHours(oneHourHence.getHours() + 1);
    
    assert.strictEqual(isExpired(oneHourHence.toISOString()), false, "Link for 1 hour in the future should be active");
    
    // 24 hours in the future
    const oneDayHence = new Date();
    oneDayHence.setHours(oneDayHence.getHours() + 24);
    
    assert.strictEqual(isExpired(oneDayHence.toISOString()), false, "Link for 24 hours in the future should be active");
});
