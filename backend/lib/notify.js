// Alerts to the shop owner's phone through a Telegram bot. Does nothing if Telegram is not set up.
const cfg = require("../config");
const enabled = () => !!(cfg.telegramToken && cfg.telegramChatId);

function send(text) { // fire and forget: a failed alert never blocks an order
  if (!enabled()) return;
  fetch(`https://api.telegram.org/bot${cfg.telegramToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ chat_id: cfg.telegramChatId, text, disable_web_page_preview: true })
  }).then(async r => { if (!r.ok) console.error("Telegram alert failed:", r.status, await r.text().catch(() => "")); })
    .catch(e => console.error("Telegram alert failed:", e.message));
}
const admin = () => cfg.appUrl ? `\nOpen admin: ${cfg.appUrl}/admin.html` : "";
const where = a => `${a.line1}, ${a.city} ${a.pin}` + (a.lat != null ? `\nMap: https://www.google.com/maps?q=${a.lat},${a.lng}` : "");

const lastError = new Map(); // do not repeat the same error alert more than once in 10 minutes
function error(e, where) {
  const key = String(e && e.message || e).slice(0, 120);
  if (Date.now() - (lastError.get(key) || 0) < 10 * 60 * 1000) return;
  lastError.set(key, Date.now());
  send(`⚠️ Server problem${where ? " (" + where + ")" : ""}\n${key}` + admin());
}

module.exports = {
  enabled, send, error,
  failedDelivery: (id, partner, reason) => send(`🚫 Delivery failed for order ${id}\nBy ${partner}. Reason: ${reason}.\nThe items went back to stock.` + admin()),
  blocked: (u, n) => send(`⛔ Customer blocked automatically\n${u.name}, ${u.phone}\nReason: ${n} failed COD deliveries. You can unblock them in admin → Customers.` + admin()),
  cashHandedOver: (partner, amount) => send(`💵 Cash received from ${partner}: ₹${amount}`),
  newOrder: (id, a, lines, total) => send(`🛍 New order ${id}\nTotal ₹${total} · Cash on delivery\n\n${a.name}, ${a.phone}\n${where(a)}\n\n` + lines.map(l => `• ${l.name} (${l.size}) × ${l.qty}`).join("\n") + admin()),
  cancelled: (id, name) => send(`❌ Order ${id} was cancelled by ${name}.` + admin()),
  delivered: (id, partner, total) => send(`✅ Order ${id} delivered by ${partner}. Cash to collect from partner: ₹${total}.`),
  returnRequested: (o, r) => send(`↩️ Return requested for order ${o.orderId}\n${o.customer.name}, ${o.customer.phone}\nReason: ${r.reason}\nItems: ` + r.items.map(i => `${i.name} (${i.size}) × ${i.qty}`).join(", ") + `\nRefund amount: ₹${r.amount}` + admin()),
  resetRequest: u => send(`🔑 Password reset requested\n${u.name} (${u.role === "delivery" ? "delivery partner" : "customer"}), ${u.phone}\nOpen admin → ${u.role === "delivery" ? "Delivery partners" : "Customers"} → Reset code, then tell them the code.` + admin())
};
