"use strict";
const crypto = require("crypto"), cfg = require("../config"), repo = require("./repo"), auth = require("./auth"), notify = require("./notify"), settings = require("./settings"), mailer = require("./mailer"), messages = require("./messages");

const bad = (m, s = 400) => Object.assign(new Error(m), { status: s });
const str = v => String(v == null ? "" : v).trim();
const PHONE = /^[6-9]\d{9}$/;
const pub = u => ({ id: u.id, name: u.name, phone: u.phone, email: u.email || "", role: u.role, vehicle: u.vehicle || "" });

const routes = [];
const withStatus = (code, body) => ({ __status: code, body }); // for non-200 replies
// auth modes: none | optional | customer | delivery | admin
const route = (m, p, a, fn) => routes.push({ m, re: new RegExp("^" + p.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), auth: a, fn });

// small in-memory limiter (login attempts, OTP guesses)
const hits = new Map();
const limited = k => { const n = hits.get(k); return !!n && n.reset > Date.now() && n.n >= 8; };
const hit = k => { const n = hits.get(k); if (!n || n.reset <= Date.now()) hits.set(k, { n: 1, reset: Date.now() + 10 * 60 * 1000 }); else n.n++; };
setInterval(() => { for (const [k, v] of hits) if (v.reset <= Date.now()) hits.delete(k); }, 60 * 1000).unref();

const CATS = ["Pink", "Yellow", "Blue", "Green", "Maroon", "Lilac", "Black", "Multi"];
const CAT_COLOR = { Pink: "#e0709a", Yellow: "#e5b92f", Blue: "#2f6fb5", Green: "#6fae5a", Maroon: "#8a2338", Lilac: "#a894dd", Black: "#1b1b1f", Multi: "#b8863b" };
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const checkPin = (pin, pins) => { if (pins.length && !pins.some(p => pin.startsWith(p))) throw bad(`Sorry, we do not deliver to PIN code ${pin} yet. We deliver to PIN codes starting with ${pins.join(", ")}.`); };
const REASONS = ["Damaged or defective", "Wrong item received", "Size does not fit", "Not as shown in the photo", "Changed my mind"];
const RETURN_NEXT = { requested: ["approved", "rejected"], approved: ["received", "refunded", "rejected"], received: ["refunded"] };
const deliveredAt = (events, o) => { const e = events.filter(x => x.status === "delivered").pop(); return new Date(e ? e.createdAt : o.createdAt); };
const returnUntil = (events, o, days) => new Date(deliveredAt(events, o).getTime() + days * 864e5);
const saveImage = async data => { // photo sent as a data URL (the page shrinks it first)
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(str(data));
  if (!m || m[2].length > 1.3e6) throw bad("Upload a JPG, PNG or WebP photo under 900 KB.");
  const head = Buffer.from(m[2].slice(0, 24), "base64"), ok = (m[1] === "image/jpeg" && head[0] === 0xff && head[1] === 0xd8) || (m[1] === "image/png" && head.toString("latin1", 1, 4) === "PNG") || (m[1] === "image/webp" && head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP");
  if (!ok) throw bad("That file is not a valid photo.");
  return "/img/" + await repo.addImage(m[1], m[2]);
};
const restock = async items => { const need = {}; for (const i of items) need[i.id] = (need[i.id] || 0) + i.qty; for (const [id, q] of Object.entries(need)) await repo.giveStock(Number(id), q); };
const int = (v, lo, hi, msg) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw bad(msg); return n; };
const num = (v, lo, hi) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) throw bad("Invalid location."); return n; };
const FAIL_REASONS = [{ text: "Customer refused to accept the order", counts: true }, { text: "Customer not reachable", counts: true }, { text: "Wrong or incomplete address", counts: false }, { text: "Customer asked to cancel", counts: false }];
// email to the customer (only if the shop has email set up and the customer gave an email)
const tell = async (o, kind, extra = {}) => {
  if (!mailer.enabled() || !o.userId) return;
  try {
    const u = await repo.getUserById(o.userId); if (!u || !u.email) return;
    const [subject, body] = messages[kind](o, (await settings.get()).store.name, extra); mailer.send(u.email, subject, body);
  } catch (e) { console.error("Email failed:", e.message); }
};
// A delivery that could not be completed: the stock goes back, and customers who keep refusing get blocked.
async function failOrder(o, why, byName) {
  await repo.setStatus(o.orderId, "failed", "Delivery failed: " + why.text); await restock(o.items);
  notify.failedDelivery(o.orderId, byName, why.text); tell(o, "failed", { reason: why.text });
  if (why.counts && o.userId) {
    const n = await repo.bumpRefused(o.userId), S = await settings.get();
    if (S.autoBlockAfter > 0 && n >= S.autoBlockAfter) { await repo.setUserActive(o.userId, false, "customer"); notify.blocked({ name: o.customer.name, phone: o.customer.phone }, n); }
  }
}
const photosOf = v => {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > 6) throw bad("You can add up to 6 photos.");
  const out = v.map(str); if (out.some(u => !/^\/(img|images)\/[\w.\-]+$/.test(u))) throw bad("Invalid photo."); return out;
};
function cleanAddress(a, S) {
  const o = { label: str(a.label).slice(0, 20) || "Home", name: str(a.name), phone: str(a.phone), line1: str(a.line1), city: str(a.city), pin: str(a.pin), lat: num(a.lat, -90, 90), lng: num(a.lng, -180, 180) };
  if (o.name.length < 3 || o.name.length > 80) throw bad("Enter the receiver’s full name.");
  if (!PHONE.test(o.phone)) throw bad("Enter a valid 10-digit mobile number.");
  if (o.line1.length < 8 || o.line1.length > 200) throw bad("Enter your full address (house, street, area).");
  if (o.city.length < 2 || o.city.length > 60) throw bad("Enter your city.");
  if (!/^\d{6}$/.test(o.pin)) throw bad("Enter a 6-digit PIN code.");
  checkPin(o.pin, S.deliveryPins);
  if ((o.lat === null) !== (o.lng === null)) o.lat = o.lng = null;
  return o;
}

// Prices are always calculated on the server so the browser cannot change them.
async function price(items, code, S) {
  const products = await repo.getProducts(), want = {}; let sub = 0; const lines = [];
  for (const it of items) {
    const p = products.find(x => x.id === Number(it.id)), qty = Number(it.qty);
    if (!p) throw bad("One of the items in your bag is no longer available.");
    if (!p.sizes.includes(it.size)) throw bad("Invalid size for " + p.name + ".");
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw bad("Invalid quantity.");
    want[p.id] = (want[p.id] || 0) + qty;
    if (want[p.id] > p.stock) throw bad(p.stock > 0 ? `Only ${p.stock} left of ${p.name}. Please reduce the quantity.` : `${p.name} is sold out.`);
    sub += p.price * qty; lines.push({ id: p.id, name: p.name, size: it.size, qty, price: p.price });
  }
  const key = code ? str(code).toUpperCase() : "", c = S.coupons.find(x => x.active && x.code === key);
  if (key && !c) throw bad("That coupon code is not valid any more. Please remove it and try again.");
  if (c && sub < c.minOrder) throw bad(`This coupon needs an order of at least ₹${c.minOrder}.`);
  const discount = c ? Math.round(sub * c.percent / 100) : 0;
  const shipping = sub - discount >= S.freeShippingMin ? 0 : S.shippingFee, total = sub - discount + shipping;
  const items2 = lines.reduce((n, l) => n + l.qty, 0);
  if (items2 > S.maxItemsPerOrder) throw bad(`You can order up to ${S.maxItemsPerOrder} items at a time.`);
  if (total > S.maxOrderValue) throw bad(`Cash on delivery orders are limited to ₹${S.maxOrderValue}. Please place a smaller order, or contact the store for a bigger one.`);
  return { lines, subtotal: sub, discount, shipping, total, coupon: c ? key : "" };
}
// What each viewer may see of an order: the delivery code only for the customer while out for delivery,
// the partner's live location only while the order is out for delivery (and fresh, under 10 minutes old).
const FRESH = 10 * 60 * 1000;
const clean = (o, { otp: showOtp = false, loc = false } = {}) => {
  const { otp, partner, ...out } = o;
  if (showOtp && o.status === "out_for_delivery") out.otp = otp;
  out.partner = partner ? { id: partner.id, name: partner.name, phone: partner.phone } : null;
  if (partner && loc) {
    const fresh = o.status === "out_for_delivery" && partner.lat != null && partner.seen && Date.now() - new Date(partner.seen) < FRESH;
    out.partner.location = fresh ? { lat: partner.lat, lng: partner.lng, updatedAt: partner.seen } : null;
  }
  return out;
};

// ---------- public ----------
route("GET", "/api/health", "none", async () => { await require("./db").query("SELECT 1"); return { ok: true, database: require("./db").mode() }; });
route("GET", "/api/config", "none", async () => {
  const S = await settings.get();
  return { deliveryPins: S.deliveryPins, store: S.store, returnDays: S.returnDays, returnReasons: REASONS, failReasons: FAIL_REASONS.map(r => r.text), freeShippingMin: S.freeShippingMin, shippingFee: S.shippingFee, sizeChart: S.sizeChart, banner: S.banner, maxOrderValue: S.maxOrderValue, emailEnabled: mailer.enabled() };
});
route("GET", "/api/products", "none", async () => repo.getProducts());
route("POST", "/api/coupon", "none", async c => { const S = await settings.get(), key = str(c.body.code).toUpperCase(), p = S.coupons.find(x => x.active && x.code === key); return p ? { valid: true, code: key, percent: p.percent, minOrder: p.minOrder } : { valid: false }; });
route("POST", "/api/subscribe", "none", async c => {
  const e = str(c.body.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 120) throw bad("Enter a valid email address.");
  await repo.addSubscriber(e); return { ok: true };
});

// ---------- login (customers and delivery partners) ----------
route("POST", "/api/auth/signup", "none", async c => {
  const b = c.body, name = str(b.name), phone = str(b.phone), email = str(b.email).toLowerCase(), pw = String(b.password || "");
  if (name.length < 2 || name.length > 60) throw bad("Enter your name.");
  if (!PHONE.test(phone)) throw bad("Enter a valid 10-digit mobile number.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw bad("Enter a valid email address or leave it empty.");
  if (pw.length < 6 || pw.length > 72) throw bad("Password must be 6 to 72 characters.");
  if (await repo.getUserByPhone(phone)) throw bad("This mobile number is already registered. Please log in.", 409);
  let u;
  try { u = await repo.createUser({ role: "customer", name, phone, email, hash: await auth.hashPassword(pw) }); }
  catch (e) { if (e.code === "23505") throw bad("This mobile number is already registered. Please log in.", 409); throw e; }
  auth.setSession(c.res, u); return { user: pub(u) };
});
route("POST", "/api/auth/login", "none", async c => {
  const phone = str(c.body.phone), pw = String(c.body.password || ""), key = "login:" + c.ip + ":" + phone;
  if (limited(key)) throw bad("Too many attempts. Please wait a few minutes and try again.", 429);
  const u = await repo.getUserByPhone(phone);
  if (!u || !(await auth.verifyPassword(pw, u.passwordHash))) { hit(key); throw bad("Wrong mobile number or password.", 401); }
  if (!u.active) throw bad("This account is not active. Please contact the store.", 403);
  auth.setSession(c.res, u); return { user: pub(u) };
});
route("POST", "/api/auth/logout", "none", async c => { auth.clearSession(c.res); return { ok: true }; });
route("POST", "/api/auth/forgot", "none", async c => { // customer or partner asks the store for a reset code
  const phone = str(c.body.phone), key = "forgot:" + c.ip;
  if (limited(key)) throw bad("Too many requests. Please try again later.", 429);
  hit(key);
  const u = PHONE.test(phone) ? await repo.getUserByPhone(phone) : null;
  if (u && u.active) { await repo.markResetRequested(u.id); notify.resetRequest(u); }
  return { ok: true }; // same answer whether or not the number is registered
});
route("POST", "/api/auth/reset", "none", async c => {
  const phone = str(c.body.phone), code = str(c.body.code), pw = String(c.body.password || ""), key = "reset:" + phone;
  if (limited(key)) throw bad("Too many attempts. Please ask the store for a new code.", 429);
  if (pw.length < 6 || pw.length > 72) throw bad("Password must be 6 to 72 characters.");
  const u = await repo.getUserByPhone(phone);
  const ok = u && u.active && u.resetCodeHash && u.resetExpires && new Date(u.resetExpires) > new Date() && auth.verifyResetCode(u.id, code, u.resetCodeHash);
  if (!ok) { hit(key); throw bad("That code is wrong or has expired. Ask the store for a new one."); }
  await repo.setPassword(u.id, await auth.hashPassword(pw)); return { ok: true };
});
route("POST", "/api/auth/change-password", "optional", async c => {
  if (!c.user) throw bad("Please log in to continue.", 401);
  const cur = String(c.body.current || ""), pw = String(c.body.password || ""), key = "chpw:" + c.user.id;
  if (limited(key)) throw bad("Too many attempts. Please try again later.", 429);
  if (pw.length < 6 || pw.length > 72) throw bad("New password must be 6 to 72 characters.");
  if (!(await auth.verifyPassword(cur, c.user.passwordHash))) { hit(key); throw bad("Your current password is wrong.", 400); }
  await repo.setPassword(c.user.id, await auth.hashPassword(pw)); return { ok: true };
});
route("GET", "/api/me", "optional", async c => ({ user: c.user ? pub(c.user) : null }));

// ---------- customer: addresses ----------
route("GET", "/api/addresses", "customer", async c => ({ addresses: await repo.listAddresses(c.user.id) }));
route("POST", "/api/addresses", "customer", async c => ({ address: await repo.addAddress(c.user.id, cleanAddress(c.body, await settings.get()), !!c.body.isDefault) }));
route("DELETE", "/api/addresses/:id", "customer", async c => { if (!(await repo.deleteAddress(c.user.id, Number(c.params.id)))) throw bad("Address not found.", 404); return { ok: true }; });

// ---------- customer: orders ----------
route("POST", "/api/orders", "customer", async c => {
  const b = c.body, S = await settings.get(); let a;
  if (b.addressId) { a = await repo.getAddress(c.user.id, Number(b.addressId)); if (!a) throw bad("Choose a delivery address."); }
  else { a = cleanAddress(b.address && typeof b.address === "object" ? b.address : {}, S); }
  if (!cfg.payments.includes(b.payment)) throw bad("Choose a payment method.");
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) throw bad("Your bag is empty.");
  // limits against fake or careless cash-on-delivery orders (the owner can change them in admin → Settings)
  if ((await repo.countOpenOrders(c.user.id)) >= S.maxOpenOrders) throw bad(`You already have ${S.maxOpenOrders} orders on the way. Please wait until they are delivered before ordering again.`);
  if ((await repo.countRecentOrders(c.user.id)) >= S.ordersPerDay) throw bad("You have placed many orders today. Please try again tomorrow, or contact the store.");
  const t = await price(b.items, b.coupon, S);
  if (b.addressId) checkPin(a.pin, S.deliveryPins);
  if (!b.addressId && b.saveAddress) await repo.addAddress(c.user.id, a, true);
  const need = {}, taken = []; for (const l of t.lines) need[l.id] = (need[l.id] || 0) + l.qty;
  try {
    for (const [id, q] of Object.entries(need)) { // reserve stock; if anything fails, give it back
      if (!(await repo.takeStock(Number(id), q))) throw bad("Sorry, an item in your bag has just sold out. Please check your bag and try again.");
      taken.push([Number(id), q]);
    }
  for (let n = 0; n < 5; n++) {
    const orderId = "HS" + crypto.randomInt(100000, 1000000), otp = String(crypto.randomInt(1000, 10000));
    try {
      await repo.createOrder({ orderId, userId: c.user.id, address: a, payment: b.payment, coupon: t.coupon, subtotal: t.subtotal, discount: t.discount, shipping: t.shipping, total: t.total, otp, lines: t.lines });
      notify.newOrder(orderId, a, t.lines, t.total);
      return withStatus(201, { orderId, total: t.total });
    } catch (e) { if (e.code !== "23505") throw e; }
  }
  throw bad("Could not create the order. Please try again.", 500);
  } catch (e) { for (const [id, q] of taken) await repo.giveStock(id, q); throw e; }
});
route("GET", "/api/orders/mine", "customer", async c => ({ orders: (await repo.listOrders({ userId: c.user.id })).map(o => clean(o)) }));
route("GET", "/api/orders/:id", "customer", async c => {
  const o = await repo.getOrder(c.params.id);
  if (!o || o.userId !== c.user.id) throw bad("Order not found.", 404);
  const events = await repo.getEvents(o.orderId), ret = await repo.getReturnByOrder(o.orderId), until = o.status === "delivered" ? returnUntil(events, o, (await settings.get()).returnDays) : null;
  return { order: { ...clean(o, { otp: true, loc: true }), events, return: ret, canReturn: !!until && !ret && until > new Date(), returnUntil: until } };
});
route("POST", "/api/photos", "customer", async c => { // photo for a return request (damaged item etc.)
  const key = "photo:" + c.user.id; if (limited(key)) throw bad("Too many uploads. Please try again later.", 429); hit(key);
  return withStatus(201, { url: await saveImage(c.body.data) });
});
route("POST", "/api/orders/:id/return", "customer", async c => {
  const o = await repo.getOrder(c.params.id), b = c.body;
  if (!o || o.userId !== c.user.id) throw bad("Order not found.", 404);
  if (o.status !== "delivered") throw bad("You can request a return only after the order is delivered.");
  if (await repo.getReturnByOrder(o.orderId)) throw bad("A return request already exists for this order.", 409);
  const S = await settings.get();
  if (returnUntil(await repo.getEvents(o.orderId), o, S.returnDays) < new Date()) throw bad(`The ${S.returnDays}-day return period for this order is over. Please contact the store.`);
  const reason = str(b.reason), comment = str(b.comment).slice(0, 500), refundTo = str(b.refundTo), photo = str(b.photo);
  if (!REASONS.includes(reason)) throw bad("Choose a reason for the return.");
  if (refundTo.length < 5 || refundTo.length > 200) throw bad("Enter your UPI ID (or bank account number and IFSC) so we can send your refund.");
  if (photo && !/^\/img\/\d+$/.test(photo)) throw bad("Invalid photo.");
  if (!Array.isArray(b.items) || !b.items.length) throw bad("Choose the items you want to return.");
  const items = [], seen = new Set(); let amount = 0;
  for (const it of b.items) {
    const line = o.items.find(x => x.id === Number(it.id) && x.size === it.size), qty = Number(it.qty), key = it.id + "/" + it.size;
    if (!line || seen.has(key)) throw bad("One of the selected items is not in this order.");
    if (!Number.isInteger(qty) || qty < 1 || qty > line.qty) throw bad("Choose a valid quantity to return.");
    seen.add(key); items.push({ id: line.id, name: line.name, size: line.size, qty, price: line.price }); amount += line.price * qty;
  }
  try { await repo.createReturn({ orderId: o.orderId, userId: c.user.id, reason, comment, items, refundTo, photo, amount }); }
  catch (e) { if (e.code === "23505") throw bad("A return request already exists for this order.", 409); throw e; }
  notify.returnRequested(o, { reason, items, amount });
  return withStatus(201, { ok: true, amount });
});
route("POST", "/api/orders/:id/cancel", "customer", async c => {
  const o = await repo.getOrder(c.params.id);
  if (!o || o.userId !== c.user.id) throw bad("Order not found.", 404);
  if (!["new", "confirmed"].includes(o.status)) throw bad("This order can no longer be cancelled. Please contact the store.");
  await repo.setStatus(o.orderId, "cancelled", "Cancelled by customer"); await restock(o.items); notify.cancelled(o.orderId, c.user.name); tell(o, "cancelled"); return { ok: true };
});

// ---------- delivery partner ----------
route("GET", "/api/delivery/orders", "delivery", async c => ({ orders: (await repo.listOrders({ partnerId: c.user.id, limit: 100 })).map(o => clean(o)) }));
route("POST", "/api/delivery/location", "delivery", async c => { // the partner's phone shares its position while delivering
  const lat = num(c.body.lat, -90, 90), lng = num(c.body.lng, -180, 180);
  if (lat === null || lng === null) throw bad("Invalid location.");
  if (!(await repo.listOrders({ partnerId: c.user.id, status: "out_for_delivery", limit: 1 })).length) return { ok: true, tracking: false }; // only shared while delivering
  await repo.setLocation(c.user.id, lat, lng); return { ok: true, tracking: true };
});
route("POST", "/api/delivery/orders/:id/status", "delivery", async c => {
  const o = await repo.getOrder(c.params.id);
  if (!o || !o.partner || o.partner.id !== c.user.id) throw bad("Order not found.", 404);
  const s = str(c.body.status);
  if (s === "out_for_delivery") {
    if (o.status !== "packed") throw bad("This order is not packed yet.");
    await repo.setStatus(o.orderId, s, "Out for delivery with " + c.user.name); tell(o, "out", { partner: c.user, otp: o.otp });
  } else if (s === "delivered") {
    if (o.status !== "out_for_delivery") throw bad("Start the delivery first.");
    const key = "otp:" + o.orderId; if (limited(key)) throw bad("Too many wrong OTPs. Contact the store.", 429);
    if (str(c.body.otp) !== o.otp) { hit(key); throw bad("Wrong OTP. Ask the customer for the 4-digit code."); }
    await repo.setStatus(o.orderId, s, "Delivered to customer"); notify.delivered(o.orderId, c.user.name, o.total); tell(o, "delivered");
  } else if (s === "failed") { // customer refused, was not reachable, wrong address...
    if (o.status !== "out_for_delivery") throw bad("Only an order that is out for delivery can be marked as not delivered.");
    const why = FAIL_REASONS.find(r => r.text === str(c.body.reason)); if (!why) throw bad("Choose why the delivery failed.");
    await failOrder(o, why, c.user.name);
  } else throw bad("Invalid status.");
  return { ok: true };
});
route("GET", "/api/delivery/cash", "delivery", async c => { // cash this partner collected and has not handed over yet
  const orders = await repo.cashPending(c.user.id);
  return { pending: orders.reduce((n, o) => n + o.total, 0), orders, recent: await repo.listSettlements(c.user.id, 5) };
});

// ---------- admin (x-admin-key header) ----------
const NEXT = { new: ["confirmed", "cancelled"], confirmed: ["packed", "cancelled"], packed: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered", "cancelled", "failed"] };
route("GET", "/api/admin/orders", "admin", async c => ({ orders: (await repo.listOrders({ status: str(c.query.status) || undefined })).map(o => clean(o, { loc: true })) }));
route("GET", "/api/admin/orders/:id", "admin", async c => { // one order with prices, for printing the bill or packing slip
  const o = await repo.getOrder(c.params.id); if (!o) throw bad("Order not found.", 404);
  return { order: { ...clean(o, { loc: true }), events: await repo.getEvents(o.orderId) } };
});
route("PATCH", "/api/admin/orders/:id", "admin", async c => {
  const o = await repo.getOrder(c.params.id); if (!o) throw bad("Order not found.", 404);
  const { status, partnerId } = c.body; let cur = o.status, partner = o.partner;
  if (partnerId !== undefined) {
    if (["delivered", "cancelled", "failed"].includes(cur)) throw bad("This order is already closed.");
    if (partnerId === null) { await repo.setPartner(o.orderId, null, cur, "Delivery partner removed"); partner = null; }
    else {
      const p = await repo.getUserById(Number(partnerId));
      if (!p || p.role !== "delivery" || !p.active) throw bad("Choose an active delivery partner.");
      await repo.setPartner(o.orderId, p.id, cur, "Assigned to delivery partner " + p.name); partner = p;
    }
  }
  if (status !== undefined) {
    if (!(NEXT[cur] || []).includes(status)) throw bad(`Cannot move an order from "${cur}" to "${status}".`);
    if (status === "out_for_delivery" && !partner) throw bad("Assign a delivery partner first.");
    if (status === "failed") {
      const why = FAIL_REASONS.find(r => r.text === str(c.body.reason)); if (!why) throw bad("Choose why the delivery failed.");
      await failOrder(o, why, "the store");
    } else {
      await repo.setStatus(o.orderId, status, "Updated by store");
      if (status === "cancelled") { await restock(o.items); tell(o, "cancelled"); }
      if (status === "confirmed") tell(o, "confirmed");
      if (status === "out_for_delivery") tell(o, "out", { partner, otp: o.otp });
      if (status === "delivered") tell(o, "delivered");
    }
    cur = status;
  }
  return { ok: true, status: cur };
});
// ---- admin: products, stock, photos ----
route("GET", "/api/admin/products", "admin", async () => ({ products: await repo.getProducts({ all: true }), cats: CATS }));
route("POST", "/api/admin/images", "admin", async c => withStatus(201, { url: await saveImage(c.body.data) }));
route("POST", "/api/admin/products", "admin", async c => {
  const b = c.body, name = str(b.name), cat = str(b.cat), img = str(b.img);
  if (name.length < 3 || name.length > 80) throw bad("Enter the product name (3 to 80 characters).");
  if (!CATS.includes(cat)) throw bad("Choose a colour group.");
  if (!/^\/(img|images)\/[\w.\-]+$/.test(img)) throw bad("Upload a photo first.");
  const sizes = Array.isArray(b.sizes) && b.sizes.length ? b.sizes.map(str).filter(s => SIZES.includes(s)) : SIZES;
  if (!sizes.length) throw bad("Choose at least one size.");
  const id = await repo.addProduct({ name, cat, price: int(b.price, 1, 100000, "Enter a price between 1 and 100000."), stock: int(b.stock, 0, 100000, "Enter the stock (0 or more)."), sizes, pal: [CAT_COLOR[cat], "#ffffff"], img, description: str(b.description).slice(0, 1500), details: str(b.details).slice(0, 600), photos: photosOf(b.photos) || [] });
  return withStatus(201, { id });
});
route("PATCH", "/api/admin/products/:id", "admin", async c => {
  const b = c.body, f = {};
  if (b.name !== undefined) { f.name = str(b.name); if (f.name.length < 3 || f.name.length > 80) throw bad("Enter the product name (3 to 80 characters)."); }
  if (b.cat !== undefined) { f.cat = str(b.cat); if (!CATS.includes(f.cat)) throw bad("Choose a colour group."); }
  if (b.price !== undefined) f.price = int(b.price, 1, 100000, "Enter a price between 1 and 100000.");
  if (b.stock !== undefined) f.stock = int(b.stock, 0, 100000, "Enter the stock (0 or more).");
  if (b.active !== undefined) f.active = !!b.active;
  if (b.description !== undefined) f.description = str(b.description).slice(0, 1500);
  if (b.details !== undefined) f.details = str(b.details).slice(0, 600);
  if (b.photos !== undefined) f.photos = photosOf(b.photos);
  if (b.img !== undefined) { f.img = str(b.img); if (!/^\/(img|images)\/[\w.\-]+$/.test(f.img)) throw bad("Invalid photo."); }
  if (!(await repo.updateProduct(Number(c.params.id), f))) throw bad("Product not found.", 404);
  return { ok: true };
});
// ---- admin: returns and refunds ----
route("GET", "/api/admin/returns", "admin", async () => ({ returns: await repo.listReturns() }));
route("PATCH", "/api/admin/returns/:id", "admin", async c => {
  const r = await repo.getReturn(Number(c.params.id)); if (!r) throw bad("Return not found.", 404);
  const b = c.body, status = str(b.status), note = str(b.note).slice(0, 300);
  if (!(RETURN_NEXT[r.status] || []).includes(status)) throw bad(`Cannot move a return from "${r.status}" to "${status}".`);
  if (status === "rejected" && !note) throw bad("Write the reason for rejecting, so the customer knows why.");
  let amount = r.amount, restocked = r.restocked;
  if (status === "refunded") {
    if (!note) throw bad("Write the payment reference (UPI transaction id) as a note.");
    amount = int(b.amount === undefined ? r.amount : b.amount, 0, 1000000, "Enter the refund amount in rupees.");
  }
  if (status === "received" && b.restock) { await restock(r.items); restocked = true; }
  await repo.updateReturn(r.id, { status, note, amount, restocked });
  const ord = await repo.getOrder(r.orderId);
  if (ord) { if (status === "approved") tell(ord, "returnApproved", { note }); if (status === "rejected") tell(ord, "returnRejected", { note }); if (status === "refunded") tell(ord, "returnRefunded", { amount, refundTo: r.refundTo, note }); }
  return { ok: true, status, amount, restocked };
});
route("GET", "/api/admin/partners", "admin", async () => ({ partners: await repo.listUsers("delivery") }));
route("POST", "/api/admin/partners", "admin", async c => {
  const b = c.body, name = str(b.name), phone = str(b.phone), vehicle = str(b.vehicle).slice(0, 40), pw = String(b.password || "");
  if (name.length < 2 || name.length > 60) throw bad("Enter the partner’s name.");
  if (!PHONE.test(phone)) throw bad("Enter a valid 10-digit mobile number.");
  if (pw.length < 6 || pw.length > 72) throw bad("Password must be 6 to 72 characters.");
  if (await repo.getUserByPhone(phone)) throw bad("This mobile number is already registered.", 409);
  const u = await repo.createUser({ role: "delivery", name, phone, vehicle, hash: await auth.hashPassword(pw) });
  return withStatus(201, { partner: pub(u) });
});
route("PATCH", "/api/admin/partners/:id", "admin", async c => { if (!(await repo.setUserActive(Number(c.params.id), !!c.body.active))) throw bad("Partner not found.", 404); return { ok: true }; });
route("POST", "/api/admin/users/:id/reset-code", "admin", async c => { // owner gives the code to the customer or partner (by phone / WhatsApp)
  const u = await repo.getUserById(Number(c.params.id));
  if (!u) throw bad("User not found.", 404);
  const code = String(crypto.randomInt(100000, 1000000));
  await repo.setResetCode(u.id, auth.resetCodeHash(u.id, code), new Date(Date.now() + 30 * 60 * 1000).toISOString());
  return { code, minutes: 30, name: u.name, phone: u.phone };
});
route("GET", "/api/admin/customers", "admin", async () => ({ customers: await repo.listUsers("customer") }));
route("GET", "/api/admin/subscribers", "admin", async () => ({ subscribers: await repo.listSubscribers() }));

// ---- admin: customers (block), cash settlement, settings, dashboard ----
route("PATCH", "/api/admin/customers/:id", "admin", async c => {
  const id = Number(c.params.id), active = !!c.body.active;
  if (!(await repo.setUserActive(id, active, "customer"))) throw bad("Customer not found.", 404);
  if (active) await repo.clearRefused(id); // a fresh start
  return { ok: true };
});
route("GET", "/api/admin/cash", "admin", async () => {
  const [pend, partners, recent] = [await repo.cashPending(), await repo.listUsers("delivery"), await repo.listSettlements(null, 15)];
  return { partners: partners.map(p => { const orders = pend.filter(o => o.partnerId === p.id); return { id: p.id, name: p.name, phone: p.phone, pending: orders.reduce((n, o) => n + o.total, 0), orders }; }), recent };
});
route("POST", "/api/admin/cash/settle", "admin", async c => { // the partner handed the cash for these orders to the owner
  const pid = Number(c.body.partnerId), ids = Array.isArray(c.body.orderIds) ? c.body.orderIds.map(str).filter(x => /^HS\d+$/.test(x)) : [];
  if (!pid || !ids.length) throw bad("Choose the orders whose cash you received.");
  const r = await repo.settleCash(pid, ids, str(c.body.note).slice(0, 200));
  if (!r) throw bad("Those orders are already settled, or do not belong to this partner.");
  const p = await repo.getUserById(pid); notify.cashHandedOver(p ? p.name : "the partner", r.amount); return r;
});
route("GET", "/api/admin/settings", "admin", async () => ({ settings: await settings.get() }));
route("PUT", "/api/admin/settings", "admin", async c => ({ settings: await settings.save(c.body) }));
route("GET", "/api/admin/summary", "admin", async () => repo.summary());
route("POST", "/api/auth/profile", "optional", async c => {
  if (!c.user) throw bad("Please log in to continue.", 401);
  const name = str(c.body.name) || c.user.name, email = str(c.body.email).toLowerCase();
  if (name.length < 2 || name.length > 60) throw bad("Enter your name.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw bad("Enter a valid email address or leave it empty.");
  await repo.updateProfile(c.user.id, { name, email }); return { user: pub({ ...c.user, name, email }) };
});

module.exports = { routes, bad };
