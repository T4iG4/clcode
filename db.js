const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data', 'portal.db');

function initDatabase() {
  const fs = require('fs');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      invited_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (invited_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      used_by TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (used_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      area TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      budget TEXT,
      description TEXT,
      image_url TEXT,
      posted_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (posted_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      title TEXT NOT NULL,
      comment TEXT NOT NULL,
      visit_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      restaurant_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, restaurant_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    );
  `);

  // Seed admin user if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const adminId = uuidv4();
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO users (id, username, display_name, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    ).run(adminId, 'admin', '管理者', passwordHash, 'admin');

    // Create initial invitation codes
    for (let i = 0; i < 5; i++) {
      const code = generateInviteCode();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(
        'INSERT INTO invitations (id, code, created_by, expires_at) VALUES (?, ?, ?, ?)'
      ).run(uuidv4(), code, adminId, expiresAt);
    }

    // Seed sample restaurants
    seedSampleData(db, adminId);
  }

  return db;
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function seedSampleData(db, adminId) {
  const restaurants = [
    {
      name: '鮨 さいとう',
      category: '寿司',
      area: '東京・六本木',
      address: '東京都港区六本木1-4-5',
      phone: '03-0000-0001',
      budget: '¥30,000〜¥50,000',
      description: '厳選されたネタと繊細な技が光る名店。完全予約制で、カウンター8席のみの贅沢な空間。シャリの温度、ネタの仕込みにこだわり抜いた至極の一貫を堪能できます。',
      image_url: '',
    },
    {
      name: 'レフェルヴェソンス',
      category: 'フレンチ',
      area: '東京・西麻布',
      address: '東京都港区西麻布2-26-4',
      phone: '03-0000-0002',
      budget: '¥20,000〜¥35,000',
      description: '革新的なフランス料理と日本の食材の融合。季節ごとに変わるコースメニューは、五感すべてで楽しめるガストロノミー体験。ミシュラン三ツ星の実力を体感してください。',
      image_url: '',
    },
    {
      name: '龍吟',
      category: '日本料理',
      area: '東京・六本木',
      address: '東京都港区六本木7-17-24',
      phone: '03-0000-0003',
      budget: '¥25,000〜¥40,000',
      description: '伝統的な日本料理に革新を加えた唯一無二の世界。素材の持ち味を最大限に引き出す調理法と、驚きのある盛り付けが特徴。',
      image_url: '',
    },
    {
      name: '焼鳥 市松',
      category: '焼鳥',
      area: '東京・銀座',
      address: '東京都中央区銀座8-10-17',
      phone: '03-0000-0004',
      budget: '¥10,000〜¥15,000',
      description: '備長炭で丁寧に焼き上げる極上の焼鳥。希少部位も含めた品揃えと、鳥の旨味を最大限に引き出す塩加減が絶妙。日本酒のペアリングも秀逸。',
      image_url: '',
    },
    {
      name: 'トラットリア・ダ・フェリーチェ',
      category: 'イタリアン',
      area: '東京・目黒',
      address: '東京都目黒区下目黒3-1-22',
      phone: '03-0000-0005',
      budget: '¥8,000〜¥12,000',
      description: 'イタリア各地で修業したシェフが作る本格イタリアン。自家製パスタと季節の食材を活かしたシンプルながら奥深い料理。アットホームな雰囲気も魅力。',
      image_url: '',
    },
    {
      name: '蕎麦 ほそ川',
      category: '蕎麦',
      area: '東京・両国',
      address: '東京都墨田区亀沢1-6-2',
      phone: '03-0000-0006',
      budget: '¥2,000〜¥4,000',
      description: '石臼挽きの自家製粉で打つ十割蕎麦の名店。蕎麦の香りと喉越しは他では味わえない逸品。天ぷらも軽い衣でカラリと揚がり、蕎麦との相性抜群。',
      image_url: '',
    },
  ];

  const insertRestaurant = db.prepare(`
    INSERT INTO restaurants (id, name, category, area, address, phone, budget, description, image_url, posted_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReview = db.prepare(`
    INSERT INTO reviews (id, restaurant_id, user_id, rating, title, comment, visit_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of restaurants) {
    const restaurantId = uuidv4();
    insertRestaurant.run(
      restaurantId, r.name, r.category, r.area, r.address, r.phone, r.budget, r.description, r.image_url, adminId
    );

    // Add a sample review
    insertReview.run(
      uuidv4(), restaurantId, adminId,
      Math.floor(Math.random() * 2) + 4,
      '素晴らしいお店です',
      '会員の皆さんにぜひおすすめしたい一軒です。味、雰囲気、サービスすべてが高水準でした。',
      '2025-12-15'
    );
  }
}

module.exports = { initDatabase, generateInviteCode };
