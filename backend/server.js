"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const cfg = require("./config"), db = require("./lib/db"), auth = require("./lib/auth"), repo = require("./lib/repo");
const { routes, bad } = require("./lib/routes"), notify = require("./lib/notify");
const PUB = path.join(__dirname, "..", "frontend");

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(obj)); };
const bodyOf = req => new Promise((ok, no) => {
  let b = "";
  req.on("data", c => { b += c; if (b.length > 1.6e6) { no(bad("Request too large", 413)); req.destroy(); } });
  req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch { no(bad("Invalid JSON")); } });
});
const ipOf = req => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

async function handle(req, res, p, url) {
  const m = req.method, route = routes.find(r => r.m === m && r.re.test(p));
  if (!route) throw bad("Not found", 404);
  if (m !== "GET") { // block requests coming from other websites
    const o = req.headers.origin; let h = ""; try { h = o ? new URL(o).host : ""; } catch {}
    if (o && h !== req.headers.host) throw bad("Blocked request origin.", 403);
  }
  let user = null;
  if (["optional", "customer", "delivery"].includes(route.auth)) {
    const tok = auth.verify(auth.parseCookies(req.headers.cookie).hs_session);
    if (tok) { user = await repo.getUserById(tok.uid); if (user && !user.active) user = null; }
  }
  if (route.auth === "customer" && (!user || user.role !== "customer")) throw bad("Please log in to continue.", 401);
  if (route.auth === "delivery" && (!user || user.role !== "delivery")) throw bad("Delivery partner login required.", 401);
  if (route.auth === "admin" && !auth.isAdmin(req)) throw bad("Wrong admin key.", 401);
  const out = await route.fn({ req, res, user, ip: ipOf(req), params: p.match(route.re).groups || {}, query: Object.fromEntries(url.searchParams), body: m === "GET" ? {} : await bodyOf(req) });
  const [code, obj] = out && out.__status ? [out.__status, out.body] : [200, out];
  send(res, code, obj);
}

function serveStatic(req, res, p) {
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  let f = path.normalize(decodeURIComponent(p));
  if (f.endsWith(path.sep)) f = path.join(f, "index.html");
  const full = path.join(PUB, f);
  if (!full.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, d) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream",
      "Cache-Control": /\.(jpg|png|webp)$/.test(full) ? "public, max-age=86400" : "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(d);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost"), p = url.pathname;
    if (p.startsWith("/api/")) return await handle(req, res, p, url);
    const im = /^\/img\/(\d+)$/.exec(p); // photos uploaded from the admin page
    if (im) {
      const img = await repo.getImage(Number(im[1]));
      if (!img) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
      return res.end(img.data);
    }
    serveStatic(req, res, p);
  } catch (e) {
    if (!e.status) { console.error(e); notify.error(e, req.method + " " + req.url.split("?")[0]); } // tell the owner about real server errors
    send(res, e.status || 500, { error: e.status ? e.message : "Something went wrong. Please try again." });
  }
});

if (cfg.isProd && cfg.sessionSecret === "dev-only-secret-change-me") { console.error("Could not start: set SESSION_SECRET (any long random text) when NODE_ENV=production."); process.exit(1); }
process.on("unhandledRejection", e => { console.error("Unhandled:", e); notify.error(e, "background task"); });
process.on("uncaughtException", e => { console.error("Crash:", e); notify.error(e, "crash"); setTimeout(() => process.exit(1), 1500); });
let dbDown = false; // watch the database every 5 minutes and alert once when it stops answering
setInterval(async () => {
  try { await db.query("SELECT 1"); if (dbDown) { dbDown = false; notify.send("✅ The database is back."); } }
  catch (e) { if (!dbDown) { dbDown = true; notify.send("🛑 The shop cannot reach its database. Customers cannot order right now.\n" + String(e.message).slice(0, 150)); } }
}, 5 * 60 * 1000).unref();
db.init().then(() => {
  if (cfg.isProd && cfg.adminKey === "change-me-now") console.warn("WARNING: set a strong ADMIN_KEY before going live.");
  server.listen(cfg.port, () => console.log(`Hanumanta Store running at http://localhost:${cfg.port}`));
}).catch(e => { console.error("Could not start:", e.message); process.exit(1); });
