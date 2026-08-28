const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const BloomFilter = require('./bloomFilter');
const authRouter = require('./routes/auth');
const urlsRouter = require('./routes/urls');
const redirectRouter = require('./routes/redirect');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse JSON and form-urlencoded requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve built React files if we are in production
// The React build output directory will be ../client/dist
app.use(express.static(path.join(__dirname, '../client/dist')));

// Initialize Bloom Filter and Database
const bloomFilter = new BloomFilter(1000000, 5); // 1M bits, 5 hashes
app.set('bloomFilter', bloomFilter);

async function startServer() {
    try {
        // Initialize DB tables
        await db.initDb();

        // Populate Bloom Filter with all current active short codes
        console.log("Populating Bloom filter with active short codes...");
        const result = await db.query(
            "SELECT short_code FROM short_urls WHERE expires_at > NOW()"
        );
        
        result.rows.forEach(row => {
            bloomFilter.add(row.short_code);
        });
        
        console.log(`Bloom filter populated with ${result.rows.length} active short codes.`);

        // Setup API Routes
        app.use('/api/auth', authRouter);
        app.use('/api/urls', urlsRouter);

        // Redirection route (handles /:code)
        app.use('/', redirectRouter);

        // Fallback for React routing (serves single page app index.html)
        app.get(/.*/, (req, res) => {
            // Check if the request is not for API before serving React
            if (!req.path.startsWith('/api/')) {
                res.sendFile(path.join(__dirname, '../client/dist/index.html'));
            } else {
                res.status(404).json({ error: 'API endpoint not found' });
            }
        });

        // Start listening
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
}

startServer();
