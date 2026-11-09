// Passwords (scrypt), signed login cookies (HMAC), admin key check. No extra packages.
const crypto = require("crypto"), { promisify } = require("util"), cfg = require("../config");
const scrypt = promisify(crypto.scrypt);
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await scrypt(pw, salt, 64)).toString("hex")}`;
}
async function verifyPassword(pw, stored) {
  const [t, salt, h] = String(stored).split("$");
  if (t !== "scrypt" || !salt || !h) return false;
  return same(await scrypt(pw, salt, 64), Buffer.from(h, "hex"));
}
const mac = body => crypto.createHmac("sha256", cfg.sessionSecret).update(body).digest("base64url");
function sign(payload) { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); return body + "." + mac(body); }
function verify(tok) {
  if (!tok || !tok.includes(".")) return null;
  const [body, sig] = tok.split(".");
  if (!same(Buffer.from(sig || ""), Buffer.from(mac(body)))) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
const parseCookies = h => Object.fromEntries(String(h || "").split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const flags = "; HttpOnly; SameSite=Lax; Path=/" + (cfg.isProd ? "; Secure" : "");
const setSession = (res, user) => res.setHeader("Set-Cookie", `hs_session=${sign({ uid: user.id, exp: Date.now() + 30 * 864e5 })}${flags}; Max-Age=${30 * 86400}`);
const clearSession = res => res.setHeader("Set-Cookie", `hs_session=${flags}; Max-Age=0`);
// Password reset codes: only a keyed hash of the 6-digit code is stored.
const resetCodeHash = (id, code) => crypto.createHmac("sha256", cfg.sessionSecret).update("reset:" + id + ":" + code).digest("hex");
const verifyResetCode = (id, code, hash) => same(Buffer.from(resetCodeHash(id, code)), Buffer.from(String(hash)));
const isAdmin = req => same(Buffer.from(String(req.headers["x-admin-key"] || "")), Buffer.from(cfg.adminKey));

module.exports = { resetCodeHash, verifyResetCode, hashPassword, verifyPassword, verify, parseCookies, setSession, clearSession, isAdmin };
