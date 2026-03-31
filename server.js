// =============================================
//  KING-YOUTH | GREATER — Node.js/Express API
// =============================================
const express    = require('express');
const mysql      = require('mysql2/promise');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const helmet     = require('helmet');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'greater2025_secret_change_in_production';

// ── Middleware ─────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '20mb' })); // large for base64 images
app.use(express.static('public')); // serve HTML files

// ── DB Pool ────────────────────────────────────
const db = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  connectTimeout:     60000,
  keepAliveInitialDelay: 10000,
  enableKeepAlive: true,
  // Aiven requires SSL — ignored safely if not needed
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Favicon for browser tab
app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml');
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

// Increase packet size for base64 image storage
db.getConnection().then(conn => {
  conn.query("SET GLOBAL max_allowed_packet=67108864").catch(()=>{});
  conn.query("SET SESSION max_allowed_packet=67108864").catch(()=>{});
  conn.release();
}).catch(()=>{});


// ── Auth Middleware ────────────────────────────
function authRequired(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────────────
//  AUTH ROUTES
// ─────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, username: rows[0].username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authRequired, async (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE admins SET username=?, password_hash=? WHERE id=?',
      [newUsername || rows[0].username, hash, req.admin.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  EVENTS ROUTES
// ─────────────────────────────────────────────

// GET /api/events
app.get('/api/events', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events ORDER BY date ASC');
    res.json(rows.map(parseJSON(['media'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/events/slim — no media column, for dashboard/calendar (no auth needed)
app.get('/api/events/slim', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id,name,date,end_date,time,deadline,location,description,max_participants,fee,status,created_at FROM events ORDER BY date ASC'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/registrations/slim — no heavy fields, for dashboard (admin only)
app.get('/api/registrations/slim', authRequired, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id, r.first_name, r.last_name, r.church_name, r.registered_at, r.event_id,
       e.name as event_name
       FROM registrations r
       LEFT JOIN events e ON r.event_id = e.id
       ORDER BY r.registered_at DESC LIMIT 50`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/events/:id
app.get('/api/events/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(parseJSON(['media'])(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/events (admin only)
app.post('/api/events', authRequired, async (req, res) => {
  const { name, date, end_date, time, deadline, location, description, max_participants, fee, status, media } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO events (name,date,end_date,time,deadline,location,description,max_participants,fee,status,media)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [name, date, end_date||null, time, deadline||null, location, description,
       max_participants||100, fee||0, status||'upcoming', JSON.stringify(media||[])]
    );
    const [rows] = await db.query('SELECT * FROM events WHERE id=?', [result.insertId]);
    res.status(201).json(parseJSON(['media'])(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/events/:id (admin only)
app.put('/api/events/:id', authRequired, async (req, res) => {
  const { name, date, end_date, time, deadline, location, description, max_participants, fee, status, media } = req.body;
  try {
    await db.query(
      `UPDATE events SET name=?,date=?,end_date=?,time=?,deadline=?,location=?,description=?,
       max_participants=?,fee=?,status=?,media=? WHERE id=?`,
      [name, date, end_date||null, time, deadline||null, location, description,
       max_participants||100, fee||0, status||'upcoming', JSON.stringify(media||[]), req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM events WHERE id=?', [req.params.id]);
    res.json(parseJSON(['media'])(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/events/:id (admin only)
app.delete('/api/events/:id', authRequired, async (req, res) => {
  try {
    await db.query('DELETE FROM events WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/events/:id/registration-count
app.get('/api/events/:id/registration-count', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM registrations WHERE event_id=?', [req.params.id]);
    res.json({ count: rows[0].count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  REGISTRATIONS ROUTES
// ─────────────────────────────────────────────

// GET /api/registrations (admin only)
app.get('/api/registrations', authRequired, async (req, res) => {
  try {
    const { event_id } = req.query;
    let sql = `SELECT r.*, e.name as event_name,
               (SELECT GROUP_CONCAT(s.name ORDER BY s.session_order SEPARATOR ', ') FROM event_sessions s WHERE FIND_IN_SET(s.id, r.session_id)) as session_name
               FROM registrations r
               LEFT JOIN events e ON r.event_id = e.id`;
    const params = [];
    if (event_id) { sql += ' WHERE r.event_id=?'; params.push(event_id); }
    sql += ' ORDER BY r.registered_at DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/registrations (public)
app.post('/api/registrations', async (req, res) => {
  const f = req.body;
  try {
    // Capacity check
    if (f.event_id) {
      const [ev] = await db.query('SELECT max_participants FROM events WHERE id=?', [f.event_id]);
      const [cnt] = await db.query('SELECT COUNT(*) as c FROM registrations WHERE event_id=?', [f.event_id]);
      if (ev.length && cnt[0].c >= ev[0].max_participants) {
        return res.status(409).json({ error: 'This event is full' });
      }
    }
    const [result] = await db.query(
      `INSERT INTO registrations
       (event_id,session_id,first_name,last_name,age,gender,phone,email,address,city,province,postal_code,
        church_name,pastor_name,church_phone,emergency_contact_name,emergency_contact_phone,
        emergency_contact_relation,medical_conditions,consent_liability,consent_photo,consent_rules)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [f.event_id||null, f.session_id||null, f.first_name, f.last_name, f.age||null, f.gender, f.phone, f.email,
       f.address, f.city, f.province, f.postal_code, f.church_name, f.pastor_name, f.church_phone,
       f.emergency_contact_name, f.emergency_contact_phone, f.emergency_contact_relation,
       f.medical_conditions||'', f.consent_liability?1:0, f.consent_photo?1:0, f.consent_rules?1:0]
    );
    res.status(201).json({ id: result.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/registrations/:id (admin only)
app.delete('/api/registrations/:id', authRequired, async (req, res) => {
  try {
    await db.query('DELETE FROM registrations WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/registrations/export — CSV download (admin only)
app.get('/api/registrations/export', authRequired, async (req, res) => {
  try {
    const { event_id } = req.query;
    let sql = `SELECT r.*, e.name as event_name,
               (SELECT GROUP_CONCAT(s.name ORDER BY s.session_order SEPARATOR ', ') FROM event_sessions s WHERE FIND_IN_SET(s.id, r.session_id)) as session_name
               FROM registrations r
               LEFT JOIN events e ON r.event_id = e.id`;
    const params = [];
    if (event_id) { sql += ' WHERE r.event_id=?'; params.push(event_id); }
    const [rows] = await db.query(sql, params);
    const cols = ['id','event_name','session_name','first_name','last_name','age','gender','phone','email',
                  'address','city','province','postal_code','church_name','pastor_name','church_phone',
                  'emergency_contact_name','emergency_contact_phone','emergency_contact_relation',
                  'medical_conditions','consent_liability','consent_photo','consent_rules','registered_at'];
    const csv = [cols.join(','), ...rows.map(r =>
      cols.map(c => `"${String(r[c]??'').replace(/"/g,'""')}"`).join(',')
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="registrations_${Date.now()}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/registrations/export-json — for Excel download on client side (admin only)
app.get('/api/registrations/export-json', authRequired, async (req, res) => {
  try {
    const { event_id } = req.query;
    let sql = `SELECT r.*, e.name as event_name,
               (SELECT GROUP_CONCAT(s.name ORDER BY s.session_order SEPARATOR ', ') FROM event_sessions s WHERE FIND_IN_SET(s.id, r.session_id)) as session_name
               FROM registrations r
               LEFT JOIN events e ON r.event_id = e.id`;
    const params = [];
    if (event_id) { sql += ' WHERE r.event_id=?'; params.push(event_id); }
    sql += ' ORDER BY r.registered_at DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ─────────────────────────────────────────────
//  SESSIONS ROUTES (divided sessions per event)
// ─────────────────────────────────────────────

// GET /api/events/:id/sessions
app.get('/api/events/:id/sessions', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM event_sessions WHERE event_id=? ORDER BY session_order ASC, id ASC', [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/events/:id/sessions (admin only)
app.post('/api/events/:id/sessions', authRequired, async (req, res) => {
  const { name, description, date, time, max_participants, session_order } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO event_sessions (event_id, name, description, date, time, max_participants, session_order) VALUES (?,?,?,?,?,?,?)',
      [req.params.id, name, description||'', date||null, time||null, max_participants||null, session_order||0]
    );
    const [rows] = await db.query('SELECT * FROM event_sessions WHERE id=?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sessions/:id (public — needed for session name lookup)
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM event_sessions WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/sessions/:id (admin only)
app.put('/api/sessions/:id', authRequired, async (req, res) => {
  const { name, description, date, time, max_participants, session_order } = req.body;
  try {
    await db.query(
      'UPDATE event_sessions SET name=?, description=?, date=?, time=?, max_participants=?, session_order=? WHERE id=?',
      [name, description||'', date||null, time||null, max_participants||null, session_order||0, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM event_sessions WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/sessions/:id (admin only)
app.delete('/api/sessions/:id', authRequired, async (req, res) => {
  try {
    await db.query('DELETE FROM event_sessions WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sessions/:id/count
app.get('/api/sessions/:id/count', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM registrations WHERE FIND_IN_SET(?, session_id)', [req.params.id]);
    res.json({ count: rows[0].count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  PRODUCTS ROUTES
// ─────────────────────────────────────────────

// GET /api/products
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows.map(parseJSON(['sizes','images'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/products (admin only)
app.post('/api/products', authRequired, async (req, res) => {
  const { name, description, price, stock, sizes, category, images } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO products (name,description,price,stock,sizes,category,images)
       VALUES (?,?,?,?,?,?,?)`,
      [name, description, price, stock||0, JSON.stringify(sizes||[]), category, JSON.stringify(images||[])]
    );
    const [rows] = await db.query('SELECT * FROM products WHERE id=?', [result.insertId]);
    res.status(201).json(parseJSON(['sizes','images'])(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/products/:id (admin only)
app.put('/api/products/:id', authRequired, async (req, res) => {
  const { name, description, price, stock, sizes, category, images } = req.body;
  try {
    await db.query(
      `UPDATE products SET name=?,description=?,price=?,stock=?,sizes=?,category=?,images=? WHERE id=?`,
      [name, description, price, stock||0, JSON.stringify(sizes||[]), category, JSON.stringify(images||[]), req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM products WHERE id=?', [req.params.id]);
    res.json(parseJSON(['sizes','images'])(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/products/:id (admin only)
app.delete('/api/products/:id', authRequired, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  ORDERS ROUTES
// ─────────────────────────────────────────────

// GET /api/orders (admin only)
app.get('/api/orders', authRequired, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM orders ORDER BY ordered_at DESC');
    res.json(rows.map(parseJSON(['items'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/orders (public)
app.post('/api/orders', async (req, res) => {
  const { customer_name, customer_email, customer_phone, customer_address, items, total } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO orders (customer_name,customer_email,customer_phone,customer_address,items,total)
       VALUES (?,?,?,?,?,?)`,
      [customer_name, customer_email, customer_phone, customer_address, JSON.stringify(items), total]
    );
    res.status(201).json({ id: result.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/orders/:id/status (admin only)
app.put('/api/orders/:id/status', authRequired, async (req, res) => {
  try {
    await db.query('UPDATE orders SET status=? WHERE id=?', [req.body.status, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/orders/:id (admin only)
app.delete('/api/orders/:id', authRequired, async (req, res) => {
  try {
    await db.query('DELETE FROM orders WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/orders/export — CSV (admin only)
app.get('/api/orders/export', authRequired, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM orders ORDER BY ordered_at DESC');
    const parsed = rows.map(parseJSON(['items']));
    const csv = [
      'id,customer_name,customer_email,customer_phone,items,total,status,ordered_at',
      ...parsed.map(o =>
        `"${o.id}","${o.customer_name}","${o.customer_email}","${o.customer_phone}",` +
        `"${(o.items||[]).map(i=>`${i.name} x${i.qty}`).join('; ')}",` +
        `"${o.total}","${o.status}","${o.ordered_at}"`
      )
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders_${Date.now()}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  SETTINGS ROUTES
// ─────────────────────────────────────────────

// GET /api/settings/public — logo and ministry name (no auth needed)
app.get('/api/settings/public', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM settings WHERE setting_key IN ('site_logo','ministry_name','ministry_email','ministry_phone','ministry_address')");
    const obj = {};
    rows.forEach(r => { obj[r.setting_key] = r.setting_value; });
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/settings (admin only)
app.get('/api/settings', authRequired, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM settings');
    const obj = {};
    rows.forEach(r => { obj[r.setting_key] = r.setting_value; });
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings (admin only)
app.put('/api/settings', authRequired, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await db.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?',
        [key, value, value]
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  STATS ROUTE
// ─────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [[{events}]]         = await db.query('SELECT COUNT(*) as events FROM events');
    const [[{registrations}]]  = await db.query('SELECT COUNT(*) as registrations FROM registrations');
    const [[{products}]]       = await db.query('SELECT COUNT(*) as products FROM products');
    const [[{orders}]]         = await db.query('SELECT COUNT(*) as orders FROM orders');
    res.json({ events, registrations, products, orders });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function parseJSON(fields) {
  return (row) => {
    const r = { ...row };
    fields.forEach(f => {
      if (typeof r[f] === 'string') {
        try { r[f] = JSON.parse(r[f]); } catch { r[f] = []; }
      }
    });
    return r;
  };
}

// ─────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────
// Keep DB alive
setInterval(async () => {
  try { await db.query('SELECT 1'); } catch(e) {}
}, 4 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`✅ GREATER API running on port ${PORT}`);
});

module.exports = app;
