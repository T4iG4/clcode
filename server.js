const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, generateInviteCode } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const db = initDatabase();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'exclusive-restaurant-portal-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  next();
}

// ============ AUTH ROUTES ============

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
  }
  req.session.userId = user.id;
  res.json({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, display_name, password, invite_code } = req.body;

  // Validate invite code
  const invitation = db
    .prepare('SELECT * FROM invitations WHERE code = ? AND used_by IS NULL AND expires_at > datetime(?)')
    .get(invite_code, new Date().toISOString());

  if (!invitation) {
    return res.status(400).json({ error: '招待コードが無効または期限切れです' });
  }

  // Check username uniqueness
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'このユーザー名は既に使われています' });
  }

  const userId = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  const insertUser = db.prepare(
    'INSERT INTO users (id, username, display_name, password_hash, invited_by) VALUES (?, ?, ?, ?, ?)'
  );
  const markInvitation = db.prepare('UPDATE invitations SET used_by = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    insertUser.run(userId, username, display_name, passwordHash, invitation.created_by);
    markInvitation.run(userId, invitation.id);
  });
  transaction();

  req.session.userId = userId;
  res.json({ id: userId, username, display_name, role: 'member' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '未認証' });
  }
  const user = db
    .prepare('SELECT id, username, display_name, role, created_at FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'ユーザーが見つかりません' });
  }
  res.json(user);
});

// ============ INVITATION ROUTES ============

app.get('/api/invitations', requireAuth, (req, res) => {
  const invitations = db
    .prepare(
      `SELECT i.*, u.display_name as used_by_name
       FROM invitations i
       LEFT JOIN users u ON i.used_by = u.id
       WHERE i.created_by = ?
       ORDER BY i.created_at DESC`
    )
    .all(req.session.userId);
  res.json(invitations);
});

app.post('/api/invitations', requireAuth, (req, res) => {
  const code = generateInviteCode();
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO invitations (id, code, created_by, expires_at) VALUES (?, ?, ?, ?)').run(
    id,
    code,
    req.session.userId,
    expiresAt
  );

  res.json({ id, code, expires_at: expiresAt });
});

// ============ RESTAURANT ROUTES ============

app.get('/api/restaurants', requireAuth, (req, res) => {
  const { category, area, search, sort } = req.query;
  let query = `
    SELECT r.*,
      u.display_name as posted_by_name,
      COALESCE(AVG(rv.rating), 0) as avg_rating,
      COUNT(rv.id) as review_count,
      EXISTS(SELECT 1 FROM favorites f WHERE f.restaurant_id = r.id AND f.user_id = ?) as is_favorite
    FROM restaurants r
    JOIN users u ON r.posted_by = u.id
    LEFT JOIN reviews rv ON rv.restaurant_id = r.id
  `;
  const params = [req.session.userId];
  const conditions = [];

  if (category) {
    conditions.push('r.category = ?');
    params.push(category);
  }
  if (area) {
    conditions.push('r.area LIKE ?');
    params.push(`%${area}%`);
  }
  if (search) {
    conditions.push('(r.name LIKE ? OR r.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY r.id';

  if (sort === 'rating') {
    query += ' ORDER BY avg_rating DESC';
  } else if (sort === 'name') {
    query += ' ORDER BY r.name ASC';
  } else {
    query += ' ORDER BY r.created_at DESC';
  }

  const restaurants = db.prepare(query).all(...params);
  res.json(restaurants);
});

app.get('/api/restaurants/:id', requireAuth, (req, res) => {
  const restaurant = db
    .prepare(
      `SELECT r.*,
        u.display_name as posted_by_name,
        COALESCE(AVG(rv.rating), 0) as avg_rating,
        COUNT(rv.id) as review_count,
        EXISTS(SELECT 1 FROM favorites f WHERE f.restaurant_id = r.id AND f.user_id = ?) as is_favorite
       FROM restaurants r
       JOIN users u ON r.posted_by = u.id
       LEFT JOIN reviews rv ON rv.restaurant_id = r.id
       WHERE r.id = ?
       GROUP BY r.id`
    )
    .get(req.session.userId, req.params.id);

  if (!restaurant) {
    return res.status(404).json({ error: 'レストランが見つかりません' });
  }

  const reviews = db
    .prepare(
      `SELECT rv.*, u.display_name as user_name
       FROM reviews rv
       JOIN users u ON rv.user_id = u.id
       WHERE rv.restaurant_id = ?
       ORDER BY rv.created_at DESC`
    )
    .all(req.params.id);

  res.json({ ...restaurant, reviews });
});

app.post('/api/restaurants', requireAuth, (req, res) => {
  const { name, category, area, address, phone, budget, description, image_url } = req.body;
  const id = uuidv4();

  db.prepare(
    `INSERT INTO restaurants (id, name, category, area, address, phone, budget, description, image_url, posted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, category, area, address || '', phone || '', budget || '', description || '', image_url || '', req.session.userId);

  res.json({ id, name });
});

app.put('/api/restaurants/:id', requireAuth, (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
  if (!restaurant) {
    return res.status(404).json({ error: 'レストランが見つかりません' });
  }

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (restaurant.posted_by !== req.session.userId && user.role !== 'admin') {
    return res.status(403).json({ error: '編集権限がありません' });
  }

  const { name, category, area, address, phone, budget, description, image_url } = req.body;
  db.prepare(
    `UPDATE restaurants SET name=?, category=?, area=?, address=?, phone=?, budget=?, description=?, image_url=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(name, category, area, address || '', phone || '', budget || '', description || '', image_url || '', req.params.id);

  res.json({ success: true });
});

app.delete('/api/restaurants/:id', requireAuth, (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
  if (!restaurant) {
    return res.status(404).json({ error: 'レストランが見つかりません' });
  }

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (restaurant.posted_by !== req.session.userId && user.role !== 'admin') {
    return res.status(403).json({ error: '削除権限がありません' });
  }

  db.prepare('DELETE FROM restaurants WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============ REVIEW ROUTES ============

app.post('/api/restaurants/:id/reviews', requireAuth, (req, res) => {
  const { rating, title, comment, visit_date } = req.body;
  const id = uuidv4();

  db.prepare(
    'INSERT INTO reviews (id, restaurant_id, user_id, rating, title, comment, visit_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.params.id, req.session.userId, rating, title, comment, visit_date || null);

  res.json({ id });
});

app.delete('/api/reviews/:id', requireAuth, (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) {
    return res.status(404).json({ error: 'レビューが見つかりません' });
  }

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (review.user_id !== req.session.userId && user.role !== 'admin') {
    return res.status(403).json({ error: '削除権限がありません' });
  }

  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============ FAVORITE ROUTES ============

app.post('/api/restaurants/:id/favorite', requireAuth, (req, res) => {
  const existing = db
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND restaurant_id = ?')
    .get(req.session.userId, req.params.id);

  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND restaurant_id = ?').run(
      req.session.userId,
      req.params.id
    );
    res.json({ favorited: false });
  } else {
    db.prepare('INSERT INTO favorites (user_id, restaurant_id) VALUES (?, ?)').run(
      req.session.userId,
      req.params.id
    );
    res.json({ favorited: true });
  }
});

app.get('/api/favorites', requireAuth, (req, res) => {
  const favorites = db
    .prepare(
      `SELECT r.*,
        u.display_name as posted_by_name,
        COALESCE(AVG(rv.rating), 0) as avg_rating,
        COUNT(rv.id) as review_count,
        1 as is_favorite
       FROM favorites f
       JOIN restaurants r ON f.restaurant_id = r.id
       JOIN users u ON r.posted_by = u.id
       LEFT JOIN reviews rv ON rv.restaurant_id = r.id
       WHERE f.user_id = ?
       GROUP BY r.id
       ORDER BY f.created_at DESC`
    )
    .all(req.session.userId);
  res.json(favorites);
});

// ============ CATEGORY/AREA ROUTES ============

app.get('/api/categories', requireAuth, (req, res) => {
  const categories = db
    .prepare('SELECT DISTINCT category FROM restaurants ORDER BY category')
    .all()
    .map((r) => r.category);
  res.json(categories);
});

app.get('/api/areas', requireAuth, (req, res) => {
  const areas = db
    .prepare('SELECT DISTINCT area FROM restaurants ORDER BY area')
    .all()
    .map((r) => r.area);
  res.json(areas);
});

// ============ ADMIN ROUTES ============

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role, u.created_at,
        inv.display_name as invited_by_name
       FROM users u
       LEFT JOIN users inv ON u.invited_by = inv.id
       ORDER BY u.created_at DESC`
    )
    .all();
  res.json(users);
});

app.get('/api/admin/invitations', requireAdmin, (req, res) => {
  const invitations = db
    .prepare(
      `SELECT i.*,
        c.display_name as created_by_name,
        u.display_name as used_by_name
       FROM invitations i
       JOIN users c ON i.created_by = c.id
       LEFT JOIN users u ON i.used_by = u.id
       ORDER BY i.created_at DESC`
    )
    .all();
  res.json(invitations);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Exclusive Restaurant Portal running on http://localhost:${PORT}`);
  console.log('Admin login: admin / admin123');
  const codes = db.prepare("SELECT code FROM invitations WHERE used_by IS NULL AND expires_at > datetime('now')").all();
  if (codes.length > 0) {
    console.log('Available invite codes:');
    codes.forEach((c) => console.log(`  ${c.code}`));
  }
});
