# King-Youth GREATER — Setup Guide
## Node.js + MySQL Backend

---

## 📁 Project Structure

```
greater-backend/
├── server.js          ← Node.js API server
├── package.json       ← Dependencies
├── .env.example       ← Environment variables template
├── schema.sql         ← MySQL database structure
└── public/            ← All website files (18 HTML/CSS/JS files)
    ├── index.html
    ├── events.html
    ├── register.html
    ├── shop.html
    ├── about.html
    ├── admin-login.html
    ├── admin-dashboard.html
    ├── admin-events.html
    ├── admin-calendar.html
    ├── admin-registrations.html
    ├── admin-merch.html
    ├── admin-orders.html
    ├── admin-settings.html
    ├── nav.html
    ├── admin-nav.html
    ├── footer.html
    ├── shared.css
    └── shared.js        ← API client (replaces localStorage)
```

---

## 🚀 Hosting Options (Free)

### Option A: Railway (Recommended — easiest)
Railway hosts both your Node.js server AND MySQL database for free.

1. Go to **railway.app** → Sign up (free)
2. Click **New Project** → **Deploy from GitHub**
3. Upload your code to a GitHub repo first, then connect it
4. Railway will auto-detect Node.js and deploy it
5. Add a **MySQL plugin** in Railway → it auto-creates the database
6. Set environment variables (see below)
7. Railway gives you a URL like `https://greater.railway.app`

### Option B: Render + PlanetScale
- **Render.com** → Free Node.js hosting
- **PlanetScale.com** → Free MySQL database (5GB free)

### Option C: Your Own cPanel Hosting (GoDaddy, Hostinger, etc.)
If your host has Node.js support (most do now):
1. Upload files via File Manager or FTP
2. Create MySQL database via cPanel → phpMyAdmin
3. Import `schema.sql` into phpMyAdmin
4. Set up Node.js app in cPanel

---

## ⚙️ Environment Variables

Create a `.env` file (copy from `.env.example`):

```env
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_db_username
DB_PASS=your_db_password
DB_NAME=kingyouth
JWT_SECRET=make_this_a_long_random_string_like_50_chars
PORT=3000
FRONTEND_URL=https://your-site-url.com
```

> **Important:** Change `JWT_SECRET` to something long and random before going live!

---

## 🗄️ Database Setup (phpMyAdmin)

1. Open **phpMyAdmin**
2. Create a new database called `kingyouth`
3. Click the database → **Import** tab
4. Upload `schema.sql` → Click **Go**
5. Done! Tables are created with default admin account.

---

## 💻 Running Locally (for testing)

```bash
# Install Node.js from nodejs.org first

cd greater-backend
npm install
cp .env.example .env
# Edit .env with your database details

npm start
# Visit http://localhost:3000
```

---

## 🌐 Connecting Frontend to Backend

In `public/shared.js`, the API URL is configured at the top:

```javascript
const API_BASE = window.GREATER_API_URL || 'http://localhost:3000/api';
```

To change the API URL without editing `shared.js`, add this **before** loading `shared.js` in each HTML file:

```html
<script>window.GREATER_API_URL = 'https://your-api-url.com/api';</script>
<script src="shared.js"></script>
```

Or simply edit `shared.js` directly and replace `http://localhost:3000/api` with your live server URL.

---

## 🔐 Default Login

- **Username:** `admin`
- **Password:** `greater2025`

> **Change this immediately** after first login via Admin → Settings.

---

## 📊 phpMyAdmin — Viewing Your Data

Once deployed, connect phpMyAdmin to your database to:
- View all registrations in the `registrations` table
- Export data as Excel/CSV directly from phpMyAdmin
- Run SQL queries
- Back up your entire database

The `registrations` table can hold **millions of records** — 400 is nothing.

---

## 🔑 API Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | Public | Admin login |
| GET | `/api/events` | Public | List all events |
| POST | `/api/events` | Admin | Create event |
| PUT | `/api/events/:id` | Admin | Update event |
| DELETE | `/api/events/:id` | Admin | Delete event |
| GET | `/api/registrations` | Admin | List registrations |
| POST | `/api/registrations` | Public | Submit registration |
| DELETE | `/api/registrations/:id` | Admin | Delete registration |
| GET | `/api/registrations/export` | Admin | Download CSV |
| GET | `/api/products` | Public | List products |
| POST | `/api/products` | Admin | Create product |
| GET | `/api/orders` | Admin | List orders |
| POST | `/api/orders` | Public | Place order |
| GET | `/api/orders/export` | Admin | Download CSV |
| GET | `/api/stats` | Public | Site stats |
| GET | `/api/settings` | Admin | Get settings |
| PUT | `/api/settings` | Admin | Update settings |

---

## ❓ Troubleshooting

**"Cannot connect to database"**
→ Check your `.env` DB_HOST, DB_USER, DB_PASS, DB_NAME values

**"401 Unauthorized" on admin pages**
→ Your session expired — log in again at `admin-login.html`

**"CORS error" in browser**
→ Set `FRONTEND_URL` in `.env` to your exact frontend domain

**CSV export not downloading**
→ The export links append your auth token — make sure you're logged in

---

## 📞 Capacity

- MySQL can handle **millions of registrations** with no issues
- The server supports **10 simultaneous database connections** (adjustable in `server.js`)
- For very high traffic events, upgrade to a paid Railway/Render plan for more memory
