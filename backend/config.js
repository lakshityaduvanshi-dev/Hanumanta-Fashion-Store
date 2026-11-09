const fs = require("fs"), path = require("path");
// Tiny .env loader (no extra package). Real environment variables always win.
try {
  for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !m[1].startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

module.exports = {
  port: process.env.PORT || 3000,
  isProd: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL || "",
  pgssl: process.env.PGSSL || "",                       // set PGSSL=disable if your Postgres has no SSL
  pgliteDir: path.join(__dirname, "data", "pgdata"),    // used only when DATABASE_URL is empty
  adminKey: process.env.ADMIN_KEY || "change-me-now",   // password for /admin.html
  sessionSecret: process.env.SESSION_SECRET || "dev-only-secret-change-me", // signs login cookies. REQUIRED in production
  freeShippingMin: 999,   // free shipping at or above this amount (₹, after discount)
  shippingFee: 99,        // shipping fee below that amount (₹)
  coupons: { HANUMAN10: { percent: 10 } },
  // Order alerts on your phone through Telegram (optional, free). See README.
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  appUrl: (process.env.APP_URL || "").replace(/\/+$/, ""), // your website address, used in alert messages
  // Deliver only to these PIN code starts, e.g. DELIVERY_PINS=302,303 (empty = deliver everywhere)
  deliveryPins: (process.env.DELIVERY_PINS || "").split(",").map(s => s.trim()).filter(Boolean),
  // Shown on the policies page (optional)
  store: { phone: process.env.STORE_PHONE || "", email: process.env.STORE_EMAIL || "", address: process.env.STORE_ADDRESS || "" },
  returnDays: Number(process.env.RETURN_DAYS || 7), // customers can request a return within this many days of delivery
  // Optional emails to customers who gave their email (any SMTP service: Gmail app password, Brevo, Zoho...)
  smtpHost: process.env.SMTP_HOST || "", smtpPort: Number(process.env.SMTP_PORT || 587), smtpUser: process.env.SMTP_USER || "", smtpPass: process.env.SMTP_PASS || "",
  mailFrom: process.env.MAIL_FROM || "",
  payments: ["Cash on delivery"] // the shop takes Cash on delivery only
};
