const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { allocateShortCode } = require('../utils/urlGenerator');

// Protect all URL routes
router.use(authMiddleware);

/**
 * Helper to validate if a string is a valid URL
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * POST /api/urls
 * Create a new short URL
 */
router.post('/', async (req, res) => {
    const { original_url, expiry_hours } = req.body;
    const userId = req.user.id;

    if (!original_url) {
        return res.status(400).json({ error: 'Original URL is required' });
    }

    if (!isValidUrl(original_url)) {
        return res.status(400).json({ error: 'Invalid URL format. Make sure to include http:// or https://' });
    }

    // Default expiry is 6 hours; must be between 1 and 24 hours
    let hours = 6;
    if (expiry_hours !== undefined) {
        hours = parseInt(expiry_hours, 10);
        if (isNaN(hours) || hours < 1 || hours > 24) {
            return res.status(400).json({ error: 'Expiration must be between 1 and 24 hours' });
        }
    }

    const bloomFilter = req.app.get('bloomFilter');
    if (!bloomFilter) {
        return res.status(500).json({ error: 'System error: Bloom Filter is not initialized' });
    }

    try {
        // Generate unique short code
        const code = await allocateShortCode(bloomFilter);
        
        // Calculate expiration timestamp
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + hours);

        // Insert into database. Wrap in try-catch to handle rare concurrent collision errors
        let newLink;
        try {
            const result = await db.query(
                `INSERT INTO short_urls (user_id, short_code, original_url, expires_at)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, short_code, original_url, created_at, expires_at, clicks`,
                [userId, code, original_url, expiresAt]
            );
            newLink = result.rows[0];
        } catch (dbErr) {
            // Check for unique key violation (Postgres code 23505)
            if (dbErr.code === '23505') {
                console.warn(`[Collision] Unique constraint race condition for code: ${code}. Retrying once.`);
                // If it was a concurrent collision, try one more time
                const retryCode = await allocateShortCode(bloomFilter);
                const result = await db.query(
                    `INSERT INTO short_urls (user_id, short_code, original_url, expires_at)
                     VALUES ($1, $2, $3, $4)
                     RETURNING id, short_code, original_url, created_at, expires_at, clicks`,
                    [userId, retryCode, original_url, expiresAt]
                );
                newLink = result.rows[0];
            } else {
                throw dbErr;
            }
        }

        // Add code to the Bloom Filter (to prevent reuse while active)
        bloomFilter.add(newLink.short_code);

        return res.status(201).json({
            message: 'Short URL created successfully',
            link: newLink
        });
    } catch (err) {
        console.error('Create URL error:', err);
        return res.status(500).json({ error: 'Failed to create short URL' });
    }
});

/**
 * GET /api/urls
 * Get all short URLs for the logged-in user
 */
router.get('/', async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await db.query(
            `SELECT id, short_code, original_url, created_at, expires_at, clicks,
                    (expires_at > NOW()) AS is_active
             FROM short_urls
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        return res.status(200).json({ links: result.rows });
    } catch (err) {
        console.error('Fetch URLs error:', err);
        return res.status(500).json({ error: 'Failed to retrieve short URLs' });
    }
});

/**
 * PUT /api/urls/:id
 * Update the expiration time of a short URL (extend or shorten it)
 */
router.put('/:id', async (req, res) => {
    const linkId = req.params.id;
    const { expiry_hours } = req.body;
    const userId = req.user.id;

    let hours = 6;
    if (expiry_hours !== undefined) {
        hours = parseInt(expiry_hours, 10);
        if (isNaN(hours) || hours < 1 || hours > 24) {
            return res.status(400).json({ error: 'Expiration must be between 1 and 24 hours' });
        }
    }

    try {
        // Double check ownership before updating (Non-negotiable requirement!)
        const ownerCheck = await db.query(
            'SELECT id, short_code FROM short_urls WHERE id = $1 AND user_id = $2',
            [linkId, userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Short URL not found or unauthorized' });
        }

        const shortUrl = ownerCheck.rows[0];

        // Set the new expiration from NOW
        const newExpiresAt = new Date();
        newExpiresAt.setHours(newExpiresAt.getHours() + hours);

        const result = await db.query(
            `UPDATE short_urls 
             SET expires_at = $1 
             WHERE id = $2 AND user_id = $3
             RETURNING id, short_code, original_url, created_at, expires_at, clicks`,
            [newExpiresAt, linkId, userId]
        );

        // Re-add to Bloom filter (since it is now active, just in case it had expired)
        const bloomFilter = req.app.get('bloomFilter');
        if (bloomFilter) {
            bloomFilter.add(shortUrl.short_code);
        }

        return res.status(200).json({
            message: 'Expiration time updated successfully',
            link: result.rows[0]
        });
    } catch (err) {
        console.error('Update URL error:', err);
        return res.status(500).json({ error: 'Failed to update short URL expiration' });
    }
});

/**
 * DELETE /api/urls/:id
 * Delete a short URL
 */
router.delete('/:id', async (req, res) => {
    const linkId = req.params.id;
    const userId = req.user.id;

    try {
        // Check ownership before deleting
        const ownerCheck = await db.query(
            'SELECT id FROM short_urls WHERE id = $1 AND user_id = $2',
            [linkId, userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Short URL not found or unauthorized' });
        }

        await db.query('DELETE FROM short_urls WHERE id = $1 AND user_id = $2', [linkId, userId]);

        return res.status(200).json({ message: 'Short URL deleted successfully' });
    } catch (err) {
        console.error('Delete URL error:', err);
        return res.status(500).json({ error: 'Failed to delete short URL' });
    }
});

module.exports = router;
