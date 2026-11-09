// All SQL lives here. Every function returns plain JavaScript objects.
const db = require("./db"), q = db.query;
const json = v => typeof v === "string" ? JSON.parse(v) : v;
const iso = d => d ? new Date(d).toISOString() : null;

const mapUser = r => r && { id: r.id, role: r.role, name: r.name, phone: r.phone, email: r.email || "", vehicle: r.vehicle || "", active: r.active, createdAt: iso(r.created_at), passwordHash: r.password_hash, resetCodeHash: r.reset_code_hash, resetExpires: iso(r.reset_expires), resetRequestedAt: iso(r.reset_requested_at), refusedCount: r.refused_count || 0 };
const mapAddr = r => r && { id: r.id, label: r.label, name: r.name, phone: r.phone, line1: r.line1, city: r.city, pin: r.pin, lat: r.lat, lng: r.lng, isDefault: r.is_default };
const mapOrder = r => r && ({ orderId: r.order_id, createdAt: iso(r.created_at), status: r.status, userId: r.user_id, otp: r.delivery_otp,
  customer: { name: r.customer_name, phone: r.phone, address: r.address, city: r.city, pin: r.pin, lat: r.lat, lng: r.lng },
  partner: r.partner_id ? { id: r.partner_id, name: r.partner_name, phone: r.partner_phone, lat: r.last_lat, lng: r.last_lng, seen: iso(r.last_seen) } : null,
  returnStatus: r.return_status || null, payment: r.payment, coupon: r.coupon, items: json(r.items) || [], subtotal: r.subtotal, discount: r.discount, shipping: r.shipping, total: r.total });

const mapReturn = r => r && { id: r.id, orderId: r.order_id, userId: r.user_id, status: r.status, reason: r.reason, comment: r.comment, items: json(r.items) || [], refundTo: r.refund_to, photo: r.photo || null,
  amount: r.amount, adminNote: r.admin_note, restocked: r.restocked, history: json(r.history) || [], createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) };

const ORDER_SELECT = `SELECT o.*, p.name AS partner_name, p.phone AS partner_phone, p.last_lat, p.last_lng, p.last_seen,
  (SELECT rt.status FROM returns rt WHERE rt.order_id = o.order_id) AS return_status,
  COALESCE((SELECT json_agg(json_build_object('id', i.product_id, 'name', i.name, 'size', i.size_label, 'qty', i.qty, 'price', i.price) ORDER BY i.id)
            FROM order_items i WHERE i.order_id = o.order_id), '[]'::json) AS items
  FROM orders o LEFT JOIN users p ON p.id = o.partner_id`;

module.exports = {
  // products and stock
  async getProducts({ all = false } = {}) {
    const rows = await q("SELECT id, name, cat, price, sizes, pal, img, pos, stock, active, description, details, photos FROM products" + (all ? "" : " WHERE active") + " ORDER BY id");
    return rows.map(r => ({ id: r.id, name: r.name, cat: r.cat, price: r.price, sizes: json(r.sizes), pal: json(r.pal) || [], img: r.img, pos: r.pos || undefined, stock: r.stock, active: r.active, description: r.description || "", details: r.details || "", photos: json(r.photos) || [] }));
  },
  async addProduct(p) {
    const id = (await q("SELECT COALESCE(MAX(id) + 1, 0) AS id FROM products"))[0].id;
    await q("INSERT INTO products (id, name, cat, price, sizes, pal, img, stock, active, description, details, photos) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,TRUE,$9,$10,$11::jsonb)", [id, p.name, p.cat, p.price, JSON.stringify(p.sizes), JSON.stringify(p.pal), p.img, p.stock, p.description || "", p.details || "", JSON.stringify(p.photos || [])]);
    return id;
  },
  async updateProduct(id, f) { // f: any of name, cat, price, stock, active
    const set = [], v = [id];
    for (const k of ["name", "cat", "price", "stock", "active", "description", "details"]) if (f[k] !== undefined) { v.push(f[k]); set.push(`${k} = $${v.length}`); }
    if (f.photos !== undefined) { v.push(JSON.stringify(f.photos)); set.push(`photos = $${v.length}::jsonb`); }
    if (!set.length) return true;
    return (await q(`UPDATE products SET ${set.join(", ")} WHERE id = $1 RETURNING id`, v)).length > 0;
  },
  async takeStock(id, qty) { return (await q("UPDATE products SET stock = stock - $2 WHERE id = $1 AND active AND stock >= $2 RETURNING id", [id, qty])).length > 0; },
  async giveStock(id, qty) { await q("UPDATE products SET stock = stock + $2 WHERE id = $1", [id, qty]); },
  async addImage(mime, b64) { return (await q("INSERT INTO images (mime, b64) VALUES ($1,$2) RETURNING id", [mime, b64]))[0].id; },
  async getImage(id) { const r = (await q("SELECT mime, b64 FROM images WHERE id = $1", [id]))[0]; return r && { mime: r.mime, data: Buffer.from(r.b64, "base64") }; },
  // users (customers and delivery partners)
  async createUser(u) { return mapUser((await q("INSERT INTO users (role, name, phone, email, password_hash, vehicle) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [u.role, u.name, u.phone, u.email || null, u.hash, u.vehicle || null]))[0]); },
  async getUserByPhone(phone) { return mapUser((await q("SELECT * FROM users WHERE phone = $1", [phone]))[0]); },
  async getUserById(id) { return mapUser((await q("SELECT * FROM users WHERE id = $1", [id]))[0]); },
  async listUsers(role) {
    const rows = await q(`SELECT u.*, (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS orders,
      (SELECT COUNT(*)::int FROM orders o WHERE o.partner_id = u.id AND o.status = 'delivered') AS delivered
      FROM users u WHERE u.role = $1 ORDER BY u.created_at DESC LIMIT 500`, [role]);
    return rows.map(r => ({ ...mapUser(r), passwordHash: undefined, resetCodeHash: undefined, orders: r.orders, delivered: r.delivered }));
  },
  async markResetRequested(id) { await q("UPDATE users SET reset_requested_at = now() WHERE id = $1", [id]); },
  async setResetCode(id, hash, expiresIso) { await q("UPDATE users SET reset_code_hash = $2, reset_expires = $3::timestamptz, reset_requested_at = NULL WHERE id = $1", [id, hash, expiresIso]); },
  async setPassword(id, hash) { await q("UPDATE users SET password_hash = $2, reset_code_hash = NULL, reset_expires = NULL, reset_requested_at = NULL WHERE id = $1", [id, hash]); },
  async setLocation(id, lat, lng) { await q("UPDATE users SET last_lat = $2, last_lng = $3, last_seen = now() WHERE id = $1", [id, lat, lng]); },
  async setUserActive(id, active, role = "delivery") { return (await q("UPDATE users SET active = $2 WHERE id = $1 AND role = $3 RETURNING id", [id, active, role])).length > 0; },
  async bumpRefused(id) { return (await q("UPDATE users SET refused_count = refused_count + 1 WHERE id = $1 RETURNING refused_count", [id]))[0].refused_count; },
  async clearRefused(id) { await q("UPDATE users SET refused_count = 0 WHERE id = $1", [id]); },
  async updateProfile(id, f) { await q("UPDATE users SET name = $2, email = $3 WHERE id = $1", [id, f.name, f.email || null]); },
  // addresses
  async listAddresses(uid) { return (await q("SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC", [uid])).map(mapAddr); },
  async getAddress(uid, id) { return mapAddr((await q("SELECT * FROM addresses WHERE user_id = $1 AND id = $2", [uid, id]))[0]); },
  async addAddress(uid, a, makeDefault) {
    const n = (await q("SELECT COUNT(*)::int AS n FROM addresses WHERE user_id = $1", [uid]))[0].n;
    if (n >= 10) throw Object.assign(new Error("You can save up to 10 addresses. Delete one first."), { status: 400 });
    const def = makeDefault || n === 0;
    if (def) await q("UPDATE addresses SET is_default = FALSE WHERE user_id = $1", [uid]);
    return mapAddr((await q("INSERT INTO addresses (user_id, label, name, phone, line1, city, pin, lat, lng, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [uid, a.label, a.name, a.phone, a.line1, a.city, a.pin, a.lat, a.lng, def]))[0]);
  },
  async deleteAddress(uid, id) { return (await q("DELETE FROM addresses WHERE user_id = $1 AND id = $2 RETURNING id", [uid, id])).length > 0; },
  // orders. One statement saves the order, its items and its first timeline event (all or nothing).
  async createOrder(o) {
    await q(`WITH o AS (
        INSERT INTO orders (order_id, user_id, customer_name, phone, pin, address, city, lat, lng, payment, coupon, subtotal, discount, shipping, total, delivery_otp)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING order_id),
      e AS (INSERT INTO order_events (order_id, status, note) SELECT order_id, 'new', 'Order placed' FROM o)
      INSERT INTO order_items (order_id, product_id, name, size_label, qty, price)
      SELECT o.order_id, (i->>'id')::int, i->>'name', i->>'size', (i->>'qty')::int, (i->>'price')::int FROM o, jsonb_array_elements($17::jsonb) AS i`,
      [o.orderId, o.userId, o.address.name, o.address.phone, o.address.pin, o.address.line1, o.address.city, o.address.lat, o.address.lng, o.payment, o.coupon,
       o.subtotal, o.discount, o.shipping, o.total, o.otp, JSON.stringify(o.lines)]);
  },
  async listOrders({ userId, partnerId, status, limit = 300 } = {}) {
    const w = [], p = [];
    if (userId != null) { p.push(userId); w.push(`o.user_id = $${p.length}`); }
    if (partnerId != null) { p.push(partnerId); w.push(`o.partner_id = $${p.length}`); }
    if (status) { p.push(status); w.push(`o.status = $${p.length}`); }
    return (await q(ORDER_SELECT + (w.length ? " WHERE " + w.join(" AND ") : "") + " ORDER BY o.created_at DESC LIMIT " + Number(limit), p)).map(mapOrder);
  },
  async countOpenOrders(userId) { return (await q("SELECT COUNT(*)::int AS n FROM orders WHERE user_id = $1 AND status IN ('new','confirmed','packed','out_for_delivery')", [userId]))[0].n; },
  async countRecentOrders(userId) { return (await q("SELECT COUNT(*)::int AS n FROM orders WHERE user_id = $1 AND created_at > now() - interval '24 hours'", [userId]))[0].n; },
  // cash on delivery: money the delivery partners collected and still have to hand over
  async cashPending(partnerId) {
    const w = ["status = 'delivered'", "payment = 'Cash on delivery'", "settlement_id IS NULL", "partner_id IS NOT NULL"], p = [];
    if (partnerId != null) { p.push(partnerId); w.push(`partner_id = $${p.length}`); }
    return (await q(`SELECT order_id, partner_id, total, customer_name, created_at FROM orders WHERE ${w.join(" AND ")} ORDER BY created_at`, p)).map(r => ({ orderId: r.order_id, partnerId: r.partner_id, total: r.total, customer: r.customer_name, createdAt: iso(r.created_at) }));
  },
  async settleCash(partnerId, orderIds, note) {
    const id = (await q("INSERT INTO cash_settlements (partner_id, amount, note) VALUES ($1, 0, $2) RETURNING id", [partnerId, note || ""]))[0].id;
    const ph = orderIds.map((_, i) => `$${i + 3}`).join(",");
    const rows = await q(`UPDATE orders SET settlement_id = $1 WHERE partner_id = $2 AND status = 'delivered' AND payment = 'Cash on delivery' AND settlement_id IS NULL AND order_id IN (${ph}) RETURNING total`, [id, partnerId, ...orderIds]);
    if (!rows.length) { await q("DELETE FROM cash_settlements WHERE id = $1", [id]); return null; }
    const amount = rows.reduce((n, r) => n + r.total, 0);
    await q("UPDATE cash_settlements SET amount = $2 WHERE id = $1", [id, amount]);
    return { id, amount, count: rows.length };
  },
  async listSettlements(partnerId, limit = 10) {
    const p = [], w = partnerId != null ? (p.push(partnerId), "WHERE partner_id = $1") : "";
    return (await q(`SELECT id, partner_id, amount, note, created_at FROM cash_settlements ${w} ORDER BY id DESC LIMIT ${Number(limit)}`, p)).map(r => ({ id: r.id, partnerId: r.partner_id, amount: r.amount, note: r.note, createdAt: iso(r.created_at) }));
  },
  async summary() { // numbers for the admin dashboard
    const n = async (sql) => (await q(sql))[0].n, today = "(created_at AT TIME ZONE 'Asia/Kolkata') >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')";
    return {
      newOrders: await n("SELECT COUNT(*)::int AS n FROM orders WHERE status = 'new'"), toPack: await n("SELECT COUNT(*)::int AS n FROM orders WHERE status = 'confirmed'"),
      ready: await n("SELECT COUNT(*)::int AS n FROM orders WHERE status = 'packed'"), outForDelivery: await n("SELECT COUNT(*)::int AS n FROM orders WHERE status = 'out_for_delivery'"),
      todayOrders: await n(`SELECT COUNT(*)::int AS n FROM orders WHERE ${today}`), todaySales: await n(`SELECT COALESCE(SUM(total), 0)::int AS n FROM orders WHERE ${today} AND status NOT IN ('cancelled','failed')`),
      returnsOpen: await n("SELECT COUNT(*)::int AS n FROM returns WHERE status IN ('requested','approved','received')"),
      cashPending: await n("SELECT COALESCE(SUM(total), 0)::int AS n FROM orders WHERE status = 'delivered' AND payment = 'Cash on delivery' AND settlement_id IS NULL AND partner_id IS NOT NULL"),
      lowStock: (await q("SELECT id, name, stock FROM products WHERE active AND stock <= 5 ORDER BY stock, id LIMIT 20")).map(r => ({ id: r.id, name: r.name, stock: r.stock }))
    };
  },
  async getSettingsRaw() { const r = (await q("SELECT value FROM settings WHERE key = 'store'"))[0]; return r ? json(r.value) : null; },
  async saveSettingsRaw(v) { await q("INSERT INTO settings (key, value) VALUES ('store', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(v)]); },
  async getOrder(orderId) { return mapOrder((await q(ORDER_SELECT + " WHERE o.order_id = $1", [orderId]))[0]); },
  async getEvents(orderId) { return (await q("SELECT status, note, created_at FROM order_events WHERE order_id = $1 ORDER BY id", [orderId])).map(r => ({ status: r.status, note: r.note, createdAt: iso(r.created_at) })); },
  async setStatus(orderId, status, note) {
    await q("UPDATE orders SET status = $2 WHERE order_id = $1", [orderId, status]);
    await q("INSERT INTO order_events (order_id, status, note) VALUES ($1,$2,$3)", [orderId, status, note || ""]);
  },
  async setPartner(orderId, partnerId, status, note) {
    await q("UPDATE orders SET partner_id = $2 WHERE order_id = $1", [orderId, partnerId]);
    await q("INSERT INTO order_events (order_id, status, note) VALUES ($1,$2,$3)", [orderId, status, note || ""]);
  },
  // returns and refunds
  async createReturn(r) {
    await q(`INSERT INTO returns (order_id, user_id, reason, comment, items, refund_to, photo, amount, history) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb)`,
      [r.orderId, r.userId, r.reason, r.comment, JSON.stringify(r.items), r.refundTo, r.photo || null, r.amount, JSON.stringify([{ status: "requested", note: "Return requested", at: new Date().toISOString() }])]);
  },
  async getReturnByOrder(orderId) { return mapReturn((await q("SELECT * FROM returns WHERE order_id = $1", [orderId]))[0]); },
  async getReturn(id) { return mapReturn((await q("SELECT * FROM returns WHERE id = $1", [id]))[0]); },
  async listReturns() {
    const rows = await q(`SELECT r.*, o.customer_name, o.phone, o.total AS order_total FROM returns r JOIN orders o ON o.order_id = r.order_id ORDER BY r.created_at DESC LIMIT 300`);
    return rows.map(r => ({ ...mapReturn(r), customer: { name: r.customer_name, phone: r.phone }, orderTotal: r.order_total }));
  },
  async updateReturn(id, f) { // f: status, note, amount, restocked (all values already decided by the caller)
    await q(`UPDATE returns SET status = $2, admin_note = $3, amount = $4, restocked = $5, updated_at = now(), history = history || $6::jsonb WHERE id = $1`,
      [id, f.status, f.note, f.amount, f.restocked, JSON.stringify([{ status: f.status, note: f.note || "", at: new Date().toISOString() }])]);
  },
  // newsletter
  async addSubscriber(email) { await q("INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT DO NOTHING", [email]); },
  async listSubscribers() { return (await q("SELECT email, created_at FROM subscribers ORDER BY created_at DESC LIMIT 2000")).map(r => ({ email: r.email, createdAt: iso(r.created_at) })); }
};
