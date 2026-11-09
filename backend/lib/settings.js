// Shop rules the owner can change from the admin page (stored in the database).
// Anything not saved yet falls back to the defaults below (which come from config.js / .env).
const cfg = require("../config"), repo = require("./repo");
const bad = m => Object.assign(new Error(m), { status: 400 });

const defaults = () => ({
  freeShippingMin: cfg.freeShippingMin, shippingFee: cfg.shippingFee, returnDays: cfg.returnDays,
  maxOpenOrders: 3, maxOrderValue: 5000, maxItemsPerOrder: 10, ordersPerDay: 5, autoBlockAfter: 2,
  deliveryPins: cfg.deliveryPins,
  coupons: Object.entries(cfg.coupons).map(([code, c]) => ({ code, percent: c.percent, minOrder: 0, active: true })),
  store: { name: "Hanumanta Store", phone: cfg.store.phone, email: cfg.store.email, address: cfg.store.address, gstin: "" },
  sizeChart: [], banner: ""
});

let cache = null, at = 0;
async function get() {
  if (cache && Date.now() - at < 10000) return cache;
  const raw = (await repo.getSettingsRaw()) || {}, d = defaults();
  cache = { ...d, ...raw, store: { ...d.store, ...(raw.store || {}) } }; at = Date.now();
  return cache;
}

const int = (v, lo, hi, label) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw bad(`${label} must be a whole number from ${lo} to ${hi}.`); return n; };
const text = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

function sanitize(b) {
  const out = {
    freeShippingMin: int(b.freeShippingMin, 0, 100000, "Free shipping amount"), shippingFee: int(b.shippingFee, 0, 5000, "Shipping fee"), returnDays: int(b.returnDays, 0, 60, "Return days"),
    maxOpenOrders: int(b.maxOpenOrders, 1, 20, "Orders on the way per customer"), maxOrderValue: int(b.maxOrderValue, 100, 1000000, "Highest order value"),
    maxItemsPerOrder: int(b.maxItemsPerOrder, 1, 50, "Items per order"), ordersPerDay: int(b.ordersPerDay, 1, 50, "Orders per customer per day"), autoBlockAfter: int(b.autoBlockAfter, 0, 10, "Block after refused deliveries"),
    banner: text(b.banner, 120)
  };
  out.deliveryPins = (Array.isArray(b.deliveryPins) ? b.deliveryPins : String(b.deliveryPins || "").split(",")).map(s => String(s).trim()).filter(Boolean);
  if (out.deliveryPins.some(p => !/^\d{1,6}$/.test(p))) throw bad("Delivery PIN codes must be numbers (or the first digits of a PIN), separated by commas.");
  const coupons = Array.isArray(b.coupons) ? b.coupons : [], seen = new Set();
  if (coupons.length > 20) throw bad("Too many coupons.");
  out.coupons = coupons.map(c => {
    const code = text(c.code, 20).toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) throw bad("Coupon codes must be 3 to 20 letters or numbers, with no spaces.");
    if (seen.has(code)) throw bad("Two coupons have the same code: " + code); seen.add(code);
    return { code, percent: int(c.percent, 1, 90, "Coupon percent"), minOrder: int(c.minOrder || 0, 0, 100000, "Coupon minimum order"), active: c.active !== false };
  });
  const rows = Array.isArray(b.sizeChart) ? b.sizeChart : [];
  if (rows.length > 12) throw bad("The size chart can have up to 12 rows.");
  out.sizeChart = rows.map(r => ({ size: text(r.size, 8), bust: text(r.bust, 14), waist: text(r.waist, 14), length: text(r.length, 14) })).filter(r => r.size);
  const s = b.store || {};
  out.store = { name: text(s.name, 60) || "Hanumanta Store", phone: text(s.phone, 20), email: text(s.email, 80), address: text(s.address, 200), gstin: text(s.gstin, 20) };
  return out;
}
async function save(b) { await repo.saveSettingsRaw(sanitize(b)); cache = null; return get(); }

module.exports = { get, save, defaults };
