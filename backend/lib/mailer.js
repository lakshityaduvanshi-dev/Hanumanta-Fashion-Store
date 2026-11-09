// Optional emails to customers (only if SMTP settings are in .env and the customer gave an email).
const cfg = require("../config");
const enabled = () => !!(cfg.smtpHost && cfg.smtpUser && cfg.smtpPass);
let tx = null;
function send(to, subject, text) { // fire and forget: a failed email never blocks an order
  if (!enabled() || !to) return;
  try {
    tx = tx || require("nodemailer").createTransport({ host: cfg.smtpHost, port: cfg.smtpPort, secure: cfg.smtpPort === 465, auth: { user: cfg.smtpUser, pass: cfg.smtpPass } });
    tx.sendMail({ from: cfg.mailFrom || cfg.smtpUser, to, subject, text }).catch(e => console.error("Email failed:", e.message));
  } catch (e) { console.error("Email failed:", e.message); }
}
module.exports = { enabled, send };
