const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Serve a beautiful dark-mode error page for expired or invalid links
 */
function serveErrorPage(res, title, message, status) {
    res.status(status).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title} | URL Shortener</title>
            <style>
                body {
                    font-family: system-ui, -apple-system, sans-serif;
                    background-color: #0f172a;
                    color: #f8fafc;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    padding: 2.5rem;
                    background: rgba(30, 41, 59, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                    max-width: 450px;
                    backdrop-filter: blur(10px);
                }
                h1 {
                    font-size: 2rem;
                    margin-bottom: 1rem;
                    background: linear-gradient(135deg, #ef4444, #f87171);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                p {
                    color: #94a3b8;
                    font-size: 1.1rem;
                    line-height: 1.6;
                    margin-bottom: 2rem;
                }
                .btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: white;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: transform 0.2s, opacity 0.2s;
                }
                .btn:hover {
                    transform: translateY(-2px);
                    opacity: 0.95;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${title}</h1>
                <p>${message}</p>
                <a href="/" class="btn">Go to Dashboard</a>
            </div>
        </body>
        </html>
    `);
}

/**
 * Route handler to redirect from short URL to original URL
 * Regex matches exactly 4 characters from the custom character set
 */
router.get('/:code([abcdefghjkmnpqrstuvwxyz23456789]{4})', async (req, res) => {
    const { code } = req.params;

    try {
        const result = await db.query(
            'SELECT id, original_url, expires_at FROM short_urls WHERE short_code = $1',
            [code]
        );

        if (result.rows.length === 0) {
            return serveErrorPage(
                res, 
                "Link Not Found", 
                "The short URL you are looking for does not exist or has been deleted.", 
                404
            );
        }

        const link = result.rows[0];
        const now = new Date();
        const expiresAt = new Date(link.expires_at);

        // Check if the URL has expired
        if (now > expiresAt) {
            return serveErrorPage(
                res, 
                "Link Expired", 
                `This short link expired at ${expiresAt.toLocaleString()}. Short URLs have a maximum lifespan of 24 hours.`, 
                410
            );
        }

        // Increment click count asynchronously (non-blocking for the redirect speed)
        db.query('UPDATE short_urls SET clicks = clicks + 1 WHERE id = $1', [link.id])
            .catch(err => console.error(`Error incrementing click count for link ${link.id}:`, err));

        // Use a 302 Temporary Redirect to prevent browser caching of expired URLs
        return res.redirect(302, link.original_url);
    } catch (err) {
        console.error('Redirection error:', err);
        return serveErrorPage(
            res, 
            "Redirection Error", 
            "An error occurred while redirecting you to the target website.", 
            500
        );
    }
});

module.exports = router;
