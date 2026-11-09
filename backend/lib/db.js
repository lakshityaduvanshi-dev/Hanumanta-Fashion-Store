// One small interface over two Postgres options:
//  - DATABASE_URL set  -> real PostgreSQL through the "pg" package (use this online)
//  - DATABASE_URL empty -> embedded Postgres (PGlite) stored in data/pgdata (use this on your computer)
const fs = require("fs"), path = require("path");
const cfg = require("../config");

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS products (id INT PRIMARY KEY, name TEXT NOT NULL, cat TEXT NOT NULL, price INT NOT NULL, sizes JSONB NOT NULL, pal JSONB, img TEXT NOT NULL, pos TEXT)`,
  // version 4: stock, hide/show, and photos uploaded from the admin page
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INT NOT NULL DEFAULT 20`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`,
  `CREATE TABLE IF NOT EXISTS images (id SERIAL PRIMARY KEY, mime TEXT NOT NULL, b64 TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, role TEXT NOT NULL DEFAULT 'customer', name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, email TEXT,
    password_hash TEXT NOT NULL, vehicle TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  // version 3: password reset codes and the delivery partner's live location
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_hash TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_requested_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS addresses (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, label TEXT NOT NULL DEFAULT 'Home',
    name TEXT NOT NULL, phone TEXT NOT NULL, line1 TEXT NOT NULL, city TEXT NOT NULL, pin TEXT NOT NULL, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
    is_default BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS orders (order_id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), status TEXT NOT NULL DEFAULT 'new',
    customer_name TEXT NOT NULL, phone TEXT NOT NULL, pin TEXT NOT NULL, address TEXT NOT NULL, payment TEXT NOT NULL, coupon TEXT NOT NULL DEFAULT '',
    subtotal INT NOT NULL, discount INT NOT NULL, shipping INT NOT NULL, total INT NOT NULL)`,
  // columns added in version 2 (safe to run on a database created by version 1)
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_id INT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
  `CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INT NOT NULL, name TEXT NOT NULL, size_label TEXT NOT NULL, qty INT NOT NULL, price INT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS order_events (id SERIAL PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  // version 5: returns and refunds
  `CREATE TABLE IF NOT EXISTS returns (id SERIAL PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE, user_id INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested', reason TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '', items JSONB NOT NULL, refund_to TEXT NOT NULL, photo TEXT,
    amount INT NOT NULL, admin_note TEXT NOT NULL DEFAULT '', restocked BOOLEAN NOT NULL DEFAULT FALSE, history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS returns_status_idx ON returns (status)`,
  `CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id)`,
  `CREATE INDEX IF NOT EXISTS orders_partner_idx ON orders (partner_id)`,
  `CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id)`,
  `CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id)`,
  // version 6: settings, product details and photos, COD cash settlement, refused-delivery count
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS refused_count INT NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS settlement_id INT`,
  `CREATE TABLE IF NOT EXISTS cash_settlements (id SERIAL PRIMARY KEY, partner_id INT NOT NULL, amount INT NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL)`
];

let impl = null;
const query = (text, params = []) => impl.query(text, params);

async function init() {
  if (cfg.databaseUrl) {
    const { Pool } = require("pg");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(cfg.databaseUrl);
    const opts = { connectionString: cfg.databaseUrl, max: 5 };
    if (cfg.pgssl === "disable" || local) opts.ssl = false;
    else if (!/sslmode=/.test(cfg.databaseUrl)) opts.ssl = { rejectUnauthorized: false };
    const pool = new Pool(opts);
    impl = { mode: "postgres", query: async (t, p) => (await pool.query(t, p)).rows };
    console.log("Database: PostgreSQL (DATABASE_URL)");
  } else {
    if (cfg.isProd) throw new Error("DATABASE_URL is required when NODE_ENV=production.");
    let mod;
    try { mod = await import("@electric-sql/pglite"); }
    catch { throw new Error("Local database package is missing. Run: npm install"); }
    fs.mkdirSync(path.dirname(cfg.pgliteDir), { recursive: true });
    const db = mod.PGlite.create ? await mod.PGlite.create(cfg.pgliteDir) : new mod.PGlite(cfg.pgliteDir);
    if (db.waitReady) await db.waitReady;
    impl = { mode: "local", query: async (t, p) => (await db.query(t, p)).rows };
    console.log("Database: local embedded Postgres in data/pgdata (set DATABASE_URL to use a real server)");
  }
  for (const s of SCHEMA) await query(s);
  await seedProducts();
}

// data/products.json only fills an EMPTY catalogue (first start). After that, products are managed from the admin page.
async function seedProducts() {
  if ((await query("SELECT COUNT(*)::int AS n FROM products"))[0].n > 0) return;
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "products.json"), "utf8"));
  for (const p of list) {
    await query(`INSERT INTO products (id,name,cat,price,sizes,pal,img,pos) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)
      ON CONFLICT (id) DO NOTHING`,
      [p.id, p.name, p.cat, p.price, JSON.stringify(p.sizes), JSON.stringify(p.pal || []), p.img, p.pos || null]);
  }
}

module.exports = { init, query, mode: () => impl && impl.mode };
