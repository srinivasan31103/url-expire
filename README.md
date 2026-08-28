# ⚡ ShrinkURL - URL Shortener with Custom Bloom Filter

A complete, end-to-end URL shortening service featuring multi-user accounts, customizable link expiration (1–24 hours), redirection tracking (clicks), and a custom Bloom filter for space-efficient collision avoidance.

---

## 🚀 Live Demo & Repository
- **GitHub Repository:** [srinivasan31103/url-expire](https://github.com/srinivasan31103/url-expire)
- **Live Application URL:** (Once you deploy to Render, paste the URL here)

### One-Click Deployment
To deploy this project directly to Render, click the button below:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/srinivasan31103/url-expire)

---

## 🛠️ Technology Stack
- **Frontend:** React.js (Vite, clean Vanilla CSS for a sleek dark mode UI)
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (SQL pool, remote connection)
- **Authentication:** JSON Web Tokens (JWT) & `bcryptjs` password hashing
- **Testing:** Node.js native Test Runner (`node:test`, `node:assert`)

---

## 🧠 Core Architecture & Custom Bloom Filter

### 1. Custom Bloom Filter (`server/bloomFilter.js`)
We implemented a custom **Bloom Filter** from scratch using a `Uint8Array` as a bit array:
- **Bit Array Size ($m$):** 1,000,000 bits (~125 KB footprint).
- **Hash Functions ($k$):** 5 distinct hashes.
- **Double Hashing (Kirsch-Mitzenmacher Optimization):** Rather than running 5 separate hash algorithms (which is computationally expensive), we generate two base hashes using FNV-1a (with different seeds) and compute the $k$ hashes using:
  $$g_i(x) = (h_1(x) + i \cdot h_2(x)) \pmod m$$
- **Initialization:** On server startup, all active short codes are fetched from the database and loaded into the Bloom filter to prime it.

### 2. Collision Handling Strategy
Our short codes are randomly generated 4-character strings using a non-confusable, single-case character set of size 31: `abcdefghjkmnpqrstuvwxyz23456789` (omitting `0`, `O`, `1`, `I`, `l`). This yields $31^4 = 923,521$ possible unique short codes.

Because the key space is relatively small, collisions *will* occur. We resolve them using a hybrid Bloom Filter + Database check:
```
           [ Generate Random 4-Char Code ]
                          │
                          ▼
             [ Check Bloom Filter (BF) ]
              /                       \
      BF returns FALSE         BF returns TRUE (Probable Member)
            /                           \
[Guaranteed Unique]             [ Query DB for Active Link ]
          │                               /              \
          │                      Link Exists in DB    Link Not Found
          │                        (Real Collision)   (False Positive)
          │                               │                      │
          ▼                               ▼                      ▼
  [ Insert into DB ] <────────────────────┼──────────────────────┘
          │                               │
  [ Add to Bloom Filter ]                 ▼
          │                   [ Try a New Random Code ]
          ▼
   [ Return Code ]
```
- **Concurrency Guard:** If multiple requests try to allocate the same code at the same millisecond, the database's `UNIQUE` constraint on `short_code` acts as the final line of defense. The backend catches unique key violations (error code `23505`), retries the generation loop once, and allocates a new code.

### 3. Expiration Logic
- Every link has an `expires_at` timestamp (default: 6 hours, range: 1 to 24 hours).
- Redirection is performed using **`302 Temporary Redirect`** to prevent browsers from caching redirects, ensuring redirection stops instantly when the link expires.
- Expired links are clearly badged in red on the dashboard. If visited, they serve a clean **410 Gone** error page.

---

## 📈 Stress Test Results
We simulated generating **500,000 unique codes** (~54.14% occupancy of the 923,521 key space) using our Bloom Filter and collision logic:
- **Average attempts per code:** remains extremely low at **1.44 attempts** even at 54% occupancy.
- **Correction validation:** When the Bloom filter returned a false positive (meaning it said a code existed when it didn't), the database double-check successfully caught the false positive and allocated the code, confirming that the system is **100% correct**.
- **Report file:** Details can be viewed in [`stress_test_results.md`](./stress_test_results.md).

---

## ⚙️ How to Setup and Run Locally

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **PostgreSQL** database (local or cloud hosted like Neon/Supabase)

### 2. Installation
Install all dependencies in both the root directory and the frontend subdirectory:
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
npm run client:install
```

### 3. Environment Variables
Create a `.env` file in the root directory based on `.env.example`:
```env
PORT=5000
DATABASE_URL=postgresql://username:password@hostname:5432/dbname?sslmode=require
JWT_SECRET=your_jwt_signing_secret_here
```

### 4. Running the Application
Start both the Express backend and the Vite React frontend concurrently:
```bash
npm run dev
```
- Frontend will run on: `http://localhost:5173`
- Backend will run on: `http://localhost:5000`

### 5. Running Tests
Run the unit test suite verifying Bloom filter, URL generator, collision resolution, and expiration checks:
```bash
npm run test
```

### 6. Running Stress Test
Execute the 500,000 code allocation simulation and generate the markdown report:
```bash
node stress-test/run.js
```
