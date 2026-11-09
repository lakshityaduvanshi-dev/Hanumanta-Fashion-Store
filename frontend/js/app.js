let P = [];
const by = id => P.find(p => p.id === id);
const CATS = ["All", "Pink", "Yellow", "Blue", "Green", "Maroon", "Lilac", "Black", "Multi"];
const CC = { Pink: "#e0709a", Yellow: "#e5b92f", Blue: "#2f6fb5", Green: "#6fae5a", Maroon: "#8a2338", Lilac: "#a894dd", Black: "#1b1b1f", Multi: "#b8863b" };
const HP = [21, 19, 13];
const $ = s => document.querySelector(s), inr = n => "₹" + n.toLocaleString("en-IN");
let S = { cat: "All", q: "", sort: "f", cart: [], wish: [], coupon: "", pct: 0 }, hi = 0, sel = {};
try { const d = JSON.parse(localStorage.getItem("hs3") || "{}"); S.cart = d.cart || []; S.wish = d.wish || []; S.coupon = d.coupon || ""; S.pct = d.pct || 0; S.cmin = d.cmin || 0; } catch (e) {}
const save = () => { try { localStorage.setItem("hs3", JSON.stringify({ cart: S.cart, wish: S.wish, coupon: S.coupon, pct: S.pct, cmin: S.cmin })); } catch (e) {} };
const img = p => `<img src="${p.img}" alt="${p.name}" loading="lazy" style="object-position:${p.pos || "50% 55%"}">`;
const heart = on => `<svg viewBox="0 0 24 24" width="18" height="18" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/></svg>`;
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2300); }

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = async (path, method = "GET", body) => {
  const r = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) throw Object.assign(new Error(d.error || "Something went wrong. Please try again."), { status: r.status });
  return d;
};
const fmt = d => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const PIN = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
const STL = { new: "Placed", confirmed: "Confirmed", packed: "Packed", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled", failed: "Not delivered" };
let trkMap = null, trkMarkers = {};
let CFG = { deliveryPins: [], store: {}, returnDays: 7, returnReasons: [], freeShippingMin: 999, shippingFee: 99, sizeChart: [], banner: "", failReasons: [] };
let trkHold = false, TRK = null;
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const RSTL = { requested: "Requested", approved: "Approved", received: "Item received", refunded: "Refunded", rejected: "Rejected" };
const shrinkPhoto = f => new Promise((ok, no) => {
  const i = new Image();
  i.onload = () => { const k = Math.min(1, 900 / Math.max(i.width, i.height)), c = document.createElement("canvas"); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", .82)); };
  i.onerror = () => no(new Error("Could not read that photo.")); i.src = URL.createObjectURL(f);
});
let U = null, afterLogin = null, AM = "login", authMsg = "", trkT = null;
function setUser(u) {
  U = u; const b = $("#ab");
  b.classList.toggle("in", !!u);
  b.innerHTML = u ? `<span>${esc(u.name.trim()[0].toUpperCase())}</span>` : '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>';
}
$("#ab").onclick = () => U ? openAcct() : openAuth();

// Fade-in on scroll
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 }) : null;
const watch = () => document.querySelectorAll(".rv:not(.in)").forEach(el => io ? io.observe(el) : el.classList.add("in"));
addEventListener("scroll", () => $("#hd").classList.toggle("sc", scrollY > 8), { passive: true });

function list() {
  const l = P.filter(p => (S.cat === "All" || (S.cat === "Saved" ? S.wish.includes(p.id) : p.cat === S.cat)) && (p.name + " " + p.cat).toLowerCase().includes(S.q.toLowerCase()));
  return S.sort === "n" ? l.slice().reverse() : l;
}
function render() {
  const l = list(), tabs = [...CATS, "Saved"];
  $("#st").textContent = S.cat === "All" ? "All kurtis" : S.cat === "Saved" ? "Saved kurtis" : S.cat + " kurtis";
  $("#cnt").textContent = l.length + (l.length === 1 ? " kurti" : " kurtis");
  $("#tabs").innerHTML = tabs.map(c => `<button class="chip ${c === S.cat ? "on" : ""}" onclick="setCat('${c}')">${CC[c] ? `<i style="background:${CC[c]}"></i>` : ""}${c === "Saved" ? "Saved (" + S.wish.length + ")" : c}</button>`).join("");
  $("#grid").innerHTML = l.length ? l.map((p, i) => `<article class="card rv ${p.stock <= 0 ? "so" : ""}" style="transition-delay:${(i % 4) * 70}ms"><div class="pic" onclick="quick(${p.id})">${img(p)}${p.stock <= 0 ? '<span class="soldout">Sold out</span>' : p.stock <= 5 ? `<span class="low">Only ${p.stock} left</span>` : ""}<button class="heart ${S.wish.includes(p.id) ? "on" : ""}" onclick="event.stopPropagation();wish(${p.id})" aria-label="Save ${p.name}">${heart(S.wish.includes(p.id))}</button><div class="qv">Quick view</div></div><div class="info"><h3><span class="dot" style="background:${p.pal[0] || "#ccc"}"></span>${p.name}</h3><span>${inr(p.price)}</span></div></article>`).join("")
    : `<p class="empty">${S.cat === "Saved" && !S.q ? "Nothing saved yet. Tap the heart on any kurti to keep it here." : "No kurtis match your search. Try another colour or word."}</p>`;
  $("#wc").textContent = S.wish.length; $("#cc").textContent = S.cart.reduce((n, i) => n + i.q, 0);
  watch();
}
function setCat(c) { S.cat = c; render(); $("#shop").scrollIntoView(); }
function wish(id) { const i = S.wish.indexOf(id); i < 0 ? (S.wish.push(id), toast("Saved")) : (S.wish.splice(i, 1), toast("Removed from saved")); save(); render(); if ($("#modal").classList.contains("on")) drawQ(); }
$("#wb").onclick = () => setCat("Saved");

function hero() {
  const a = by(HP[hi % 3]), b = by(HP[(hi + 1) % 3]), c = by(HP[(hi + 2) % 3]);
  const set = (s, p) => { $(s).innerHTML = img(p); $(s).onclick = () => quick(p.id); };
  set("#hi", a); set("#m1", b); set("#m2", c); $("#hn").textContent = a.name;
  const h = $("#hi"); h.classList.remove("fd"); void h.offsetWidth; h.classList.add("fd");
}
function extras() {
  const lo = Math.min(...P.map(p => p.price)), hi = Math.max(...P.map(p => p.price));
  const m = [lo === hi ? `Every kurti ₹${lo}` : `Kurtis from ₹${lo}`, `Free shipping above ₹${CFG.freeShippingMin}`, "Cash on delivery", "Sizes XS to XXL", "New prints every Friday", `Easy ${CFG.returnDays}-day returns`];
  const row = m.map(t => `<span>${t}</span>`).join(""); $("#mq").innerHTML = row + row + row + row;
  const looks = [[19, "With jeans", "Easy and relaxed for every day"], [3, "With white palazzos", "Fresh and light for brunch"], [10, "For festivals", "Bright prints with white pants"]];
  $("#looks").innerHTML = looks.map(([id, t, s]) => `<div class="look rv" onclick="quick(${id})">${img(by(id))}<div><h3>${t}</h3><p>${s}</p></div></div>`).join("");
  $("#fl").innerHTML = CATS.slice(1).map(c => `<a href="#shop" onclick="S.cat='${c}';render()">${c}</a>`).join("");
}

function quick(id) { sel = { id, size: "" }; drawQ(); $("#modal").classList.add("on"); $("#veil").classList.add("on"); }
function drawQ() {
  const p = by(sel.id), imgs = [p.img, ...(p.photos || [])], cur = Math.min(sel.ph || 0, imgs.length - 1);
  $("#box").innerHTML = `<button class="x" onclick="closeAll()" aria-label="Close">×</button>
  <div class="mp"><img src="${imgs[cur]}" alt="${esc(p.name)}" style="object-position:${p.pos || "50% 55%"}">${imgs.length > 1 ? `<div class="thumbs2">${imgs.map((u, i) => `<button class="${i === cur ? "on" : ""}" onclick="sel.ph=${i};drawQ()" aria-label="Photo ${i + 1}"><img src="${u}" alt=""></button>`).join("")}</div>` : ""}</div>
  <div class="det"><div><span class="dot" style="background:${p.pal[0] || "#ccc"}"></span><small style="color:var(--mut)">${p.cat}</small></div><h2>${esc(p.name)}</h2><div class="pr">${inr(p.price)}</div>${p.stock > 0 && p.stock <= 5 ? `<small style="color:var(--acc)">Only ${p.stock} left</small>` : ""}
  ${p.description ? `<p>${esc(p.description)}</p>` : ""}${p.details ? `<p style="font-size:.9rem"><b style="color:var(--ink);font-weight:500">Fabric and care</b><br>${esc(p.details).replace(/\n/g, "<br>")}</p>` : ""}
  <div class="orow"><b style="font-weight:500;font-size:.9rem">Select size</b>${CFG.sizeChart.length ? '<button type="button" class="del" onclick="openSizeGuide()">Size guide</button>' : ""}</div>
  <div class="sizes">${p.sizes.map(s => `<button class="${sel.size === s ? "on" : ""}" onclick="sel.size='${s}';drawQ()">${s}</button>`).join("")}</div><span class="err"></span>
  ${p.stock <= 0 ? '<button class="btn" disabled>Sold out</button>' : '<button class="btn" onclick="add()">Add to bag</button>'}<button class="ghost" style="align-self:flex-start" onclick="wish(${p.id})">${S.wish.includes(p.id) ? "♥ Saved" : "♡ Save for later"}</button>
  <div class="perks"><span>Cash on delivery</span><span>${CFG.returnDays}-day returns</span><span>Free shipping ₹${CFG.freeShippingMin}+</span></div></div>`;
}
function add() {
  if (!sel.size) { drawQ(); $("#box .err").textContent = "Choose a size to continue."; return; }
  const have = S.cart.filter(i => i.id === sel.id).reduce((n, i) => n + i.q, 0), left = by(sel.id).stock;
  if (have + 1 > left) { toast(left > 0 ? "Only " + left + " available." : "Sorry, this is sold out."); return; }
  const k = sel.id + "-" + sel.size, f = S.cart.find(i => i.k === k); f ? f.q++ : S.cart.push({ k, id: sel.id, size: sel.size, q: 1 });
  save(); closeAll(); toast("Added to bag"); openCart();
}
function totals() {
  const sub = S.cart.reduce((n, i) => n + by(i.id).price * i.q, 0), disc = sub >= (S.cmin || 0) ? Math.round(sub * (S.pct || 0) / 100) : 0, ship = !sub || sub - disc >= CFG.freeShippingMin ? 0 : CFG.shippingFee;
  return { sub, disc, ship, tot: sub - disc + ship };
}
function renderCart() {
  const t = totals(), n = S.cart.reduce((a, i) => a + i.q, 0), left = CFG.freeShippingMin - (t.sub - t.disc);
  $("#dt").textContent = "Your bag (" + n + ")";
  $("#prog").innerHTML = S.cart.length ? (left > 0 ? `Add <b>${inr(left)}</b> more for free shipping` : "You’ve unlocked <b>free shipping</b>") + `<div class="bar"><i style="width:${Math.min(100, Math.max(0, (t.sub - t.disc) / CFG.freeShippingMin * 100))}%"></i></div>` : "";
  $("#dbody").innerHTML = S.cart.length ? S.cart.map(i => { const p = by(i.id); return `<div class="line"><div class="th">${img(p)}</div><div><h3>${p.name}</h3><small>Size ${i.size}</small><br><span class="qty"><button onclick="qty('${i.k}',-1)" aria-label="Less">−</button><span>${i.q}</span><button onclick="qty('${i.k}',1)" aria-label="More">+</button></span></div><div style="text-align:right;font-size:.95rem">${inr(p.price * i.q)}<br><button class="rm" onclick="qty('${i.k}',-99)">Remove</button></div></div>`; }).join("")
    : `<p class="empty" style="padding:60px 0">Your bag is empty.<br><br><button class="btn" onclick="closeAll();setCat('All')">Continue shopping</button></p>`;
  $("#dfoot").innerHTML = S.cart.length ? `<div class="coupon"><input id="cp" placeholder="Coupon code" value="${S.coupon}" aria-label="Coupon code"><button class="btn" onclick="coupon()">Apply</button></div><div class="row"><span>Subtotal</span><span>${inr(t.sub)}</span></div>${S.coupon && t.sub < (S.cmin || 0) ? `<div class="m" style="color:var(--acc)">Coupon ${esc(S.coupon)} works on orders above ₹${S.cmin}. Add ₹${S.cmin - t.sub} more.</div>` : ""}${t.disc ? `<div class="row"><span>Discount</span><span>−${inr(t.disc)}</span></div>` : ""}<div class="row"><span>Shipping</span><span>${t.ship ? inr(t.ship) : "Free"}</span></div><div class="row t"><span>Total</span><span>${inr(t.tot)}</span></div><button class="btn" onclick="checkout()">Checkout</button>` : "";
  render();
}
function qty(k, d) {
  const i = S.cart.find(x => x.k === k);
  if (d > 0) { const p = by(i.id), tot = S.cart.filter(x => x.id === i.id).reduce((n, x) => n + x.q, 0); if (tot + d > p.stock) { toast("Only " + p.stock + " available."); return; } }
  i.q += d; if (i.q < 1) S.cart = S.cart.filter(x => x.k !== k); save(); renderCart(); }
async function coupon() {
  const v = $("#cp").value.trim();
  try {
    const r = await (await fetch("/api/coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: v }) })).json();
    if (r.valid) { S.coupon = r.code; S.pct = r.percent; S.cmin = r.minOrder || 0; toast("Coupon applied: " + r.percent + "% off" + (r.minOrder ? " on orders above ₹" + r.minOrder : "")); } else { S.coupon = ""; S.pct = 0; toast("That code isn’t valid."); }
  } catch (e) { toast("Could not check the coupon. Try again."); }
  save(); renderCart();
}
function openCart() { renderCart(); $("#drawer").classList.add("on"); $("#veil").classList.add("on"); }
function closeAll() { ["#drawer", "#acct", "#modal", "#sg", "#co", "#auth", "#trk", "#veil"].forEach(s => $(s).classList.remove("on")); clearInterval(trkT); if (trkMap) { trkMap.remove(); trkMap = null; trkMarkers = {}; } }
$("#cb").onclick = openCart; $("#ax").onclick = closeAll; $("#dx").onclick = closeAll; $("#veil").onclick = closeAll;
addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });


// ---------- login / sign up ----------
function openAuth(msg, cb) { authMsg = msg || ""; afterLogin = cb || null; drawAuth("login"); closeAll(); $("#auth").classList.add("on"); $("#veil").classList.add("on"); }
function drawAuth(mode) {
  if (mode === "reset") return drawReset();
  AM = mode; const su = mode === "signup";
  $("#af").innerHTML = `<button type="button" class="x" style="position:absolute;top:16px;right:18px" onclick="closeAll()" aria-label="Close">×</button><h2>${su ? "Create your account" : "Welcome back"}</h2>${authMsg ? `<p class="note">${esc(authMsg)}</p>` : ""}
  <div class="seg"><button type="button" class="${su ? "" : "on"}" onclick="drawAuth('login')">Log in</button><button type="button" class="${su ? "on" : ""}" onclick="drawAuth('signup')">Sign up</button></div>
  ${su ? '<input name="name" placeholder="Your name" autocomplete="name">' : ""}<input name="phone" placeholder="Mobile number" inputmode="numeric" maxlength="10" autocomplete="tel">
  ${su ? '<input name="email" type="email" placeholder="Email (optional)" autocomplete="email">' : ""}<input name="password" type="password" placeholder="Password${su ? " (6+ characters)" : ""}" autocomplete="${su ? "new-password" : "current-password"}">
  <span class="err" id="aerr"></span><button class="btn">${su ? "Create account" : "Log in"}</button>${su ? "" : `<button type="button" class="ghost" style="justify-self:start" onclick="drawAuth('reset')">Forgot password?</button>`}`;
}
function drawReset() {
  AM = "reset";
  $("#af").innerHTML = `<button type="button" class="x" style="position:absolute;top:16px;right:18px" onclick="closeAll()" aria-label="Close">×</button><h2>Reset password</h2><p class="note">Enter your mobile number and ask the store for a code. The store will call or message you the code. Then enter it below with your new password.</p>
  <input name="phone" placeholder="Mobile number" inputmode="numeric" maxlength="10" autocomplete="tel"><button type="button" class="locbtn" onclick="askCode()">Ask the store for a code</button>
  <input name="code" placeholder="6-digit code from the store" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><input name="password" type="password" placeholder="New password (6+ characters)" autocomplete="new-password">
  <span class="err" id="aerr"></span><button class="btn">Set new password</button><button type="button" class="ghost" style="justify-self:start" onclick="drawAuth('login')">Back to log in</button>`;
}
async function askCode() {
  const p = $("#af").phone.value.trim();
  if (!/^[6-9]\d{9}$/.test(p)) { $("#aerr").textContent = "Enter your 10-digit mobile number first."; return; }
  try { await api("/api/auth/forgot", "POST", { phone: p }); $("#aerr").textContent = ""; toast("Request sent. The store will contact you with a code."); } catch (e) { $("#aerr").textContent = e.message; }
}
$("#af").onsubmit = async e => {
  e.preventDefault(); const f = e.target, v = n => f[n] ? f[n].value.trim() : "", btn = f.querySelector(".btn"); btn.disabled = true;
  try {
    if (AM === "reset") { await api("/api/auth/reset", "POST", { phone: v("phone"), code: v("code"), password: f.password.value }); toast("Password changed. Please log in."); authMsg = ""; drawAuth("login"); return; }
    const d = await api(AM === "login" ? "/api/auth/login" : "/api/auth/signup", "POST", { name: v("name"), phone: v("phone"), email: v("email"), password: f.password.value });
    if (d.user.role !== "customer") { await api("/api/auth/logout", "POST"); throw new Error("This login is for delivery partners. Please use the delivery partner page."); }
    setUser(d.user); closeAll(); toast("Welcome, " + d.user.name.split(" ")[0]);
    const cb = afterLogin; afterLogin = null; if (cb) cb();
  } catch (err) { btn.disabled = false; $("#aerr").textContent = err.message; }
};
async function logout() { await api("/api/auth/logout", "POST").catch(() => {}); setUser(null); closeAll(); toast("Logged out"); }

// ---------- address form with live location ----------
function addrForm() {
  return `<div class="afields"><div class="two"><input name="an" placeholder="Receiver’s full name" value="${esc(U.name)}"><input name="ap" placeholder="Mobile number" inputmode="numeric" maxlength="10" value="${esc(U.phone)}"></div>
  <button type="button" class="locbtn" onclick="locate(this)">${PIN} Use my current location</button>
  <div class="pinmap"></div><small class="locnote pinhint">Tap the map or drag the pin to your door, so the delivery partner can find you easily.</small>
  <textarea name="al" rows="2" placeholder="House no., street, area"></textarea><div class="two"><input name="ac" placeholder="City"><input name="az" placeholder="PIN code" inputmode="numeric" maxlength="6"></div>
  ${CFG.deliveryPins.length ? `<small class="locnote">We deliver to PIN codes starting with ${esc(CFG.deliveryPins.join(", "))}.</small>` : ""}
  <select name="lb" aria-label="Address type"><option>Home</option><option>Work</option><option>Other</option></select><input type="hidden" name="lat"><input type="hidden" name="lng"></div>`;
}
const readAddr = f => ({ label: f.lb.value, name: f.an.value, phone: f.ap.value, line1: f.al.value, city: f.ac.value, pin: f.az.value, lat: f.lat.value || null, lng: f.lng.value || null });
async function fillFromPin(f, la, ln) { // best effort: fill empty address fields from the pin (free OpenStreetMap service)
  try {
    const a = (await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${ln}`)).json()).address || {};
    const fill = (el, val) => { if (val && !el.value.trim()) el.value = val; };
    fill(f.al, [a.house_number, a.road, a.neighbourhood || a.suburb].filter(Boolean).join(", "));
    fill(f.ac, a.city || a.town || a.village || a.county || a.state_district); fill(f.az, a.postcode);
  } catch (e) {}
}
async function initPin(f) { // map with a draggable pin; the customer drops it on their door
  const el = f.querySelector(".pinmap"); if (!el || el._ready) return; el._ready = true;
  try { await loadLeaflet(); } catch (e) { el.innerHTML = '<p class="note" style="padding:14px">The map could not load. You can still type your address.</p>'; return; }
  const has = f.lat.value !== "", m = L.map(el).setView(has ? [+f.lat.value, +f.lng.value] : [22.5, 79], has ? 17 : 5);
  L.tileLayer(TILES, { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(m); el._m = m;
  el._put = (la, ln, zoom, geo) => {
    f.lat.value = +la.toFixed(6); f.lng.value = +ln.toFixed(6);
    if (!el._mk) {
      el._mk = L.marker([la, ln], { draggable: true, icon: L.divIcon({ className: "mkpin", html: "<i></i>", iconSize: [24, 24], iconAnchor: [12, 24] }) }).addTo(m);
      el._mk.on("dragend", () => { const p = el._mk.getLatLng(); el._put(p.lat, p.lng, 0, true); });
    } else el._mk.setLatLng([la, ln]);
    if (zoom) m.setView([la, ln], zoom);
    const h = f.querySelector(".pinhint"); if (h) h.textContent = "Pin placed. Drag it if it is not exactly at your door.";
    if (geo) fillFromPin(f, la, ln);
  };
  m.on("click", e => el._put(e.latlng.lat, e.latlng.lng, 0, true));
  if (has) el._put(+f.lat.value, +f.lng.value, 17, false);
}
function locate(btn) {
  const f = btn.closest("form");
  if (!navigator.geolocation) { toast("Location is not available on this device. Please tap the map to place the pin."); return; }
  btn.textContent = "Finding your location…";
  navigator.geolocation.getCurrentPosition(async pos => {
    const la = pos.coords.latitude, ln = pos.coords.longitude;
    btn.classList.add("got"); btn.innerHTML = PIN + " Location added";
    await initPin(f); const el = f.querySelector(".pinmap");
    if (el._put) el._put(la, ln, 17, true); else { f.lat.value = +la.toFixed(6); f.lng.value = +ln.toFixed(6); fillFromPin(f, la, ln); }
  }, err => { btn.classList.remove("got"); btn.innerHTML = PIN + " Use my current location"; toast(err.code === 1 ? "Location permission was denied. Tap the map to place the pin instead." : "Could not get your location. Tap the map to place the pin."); }, { enableHighAccuracy: true, timeout: 12000 });
}

// ---------- checkout ----------
let ADDRS = [], selA = "new";
async function checkout() {
  if (!U) { openAuth("Log in to place your order.", checkout); return; }
  try { ADDRS = (await api("/api/addresses")).addresses; }
  catch (e) { if (e.status === 401) { setUser(null); openAuth("Please log in again.", checkout); } else toast(e.message); return; }
  selA = ADDRS.length ? (ADDRS.find(a => a.isDefault) || ADDRS[0]).id : "new";
  $("#drawer").classList.remove("on"); drawCO(); $("#co").classList.add("on"); $("#veil").classList.add("on");
}
function drawCO() {
  const t = totals();
  $("#cf").innerHTML = `<button type="button" class="x" style="position:absolute;top:16px;right:18px" onclick="closeAll()" aria-label="Close">×</button><h2>Checkout</h2><b style="font-weight:500">Deliver to</b>
  ${ADDRS.map(a => `<label class="acard"><input type="radio" name="ad" value="${a.id}" ${selA === a.id ? "checked" : ""} onchange="togA()"><span><b>${esc(a.label)}</b> · ${esc(a.name)}<br><small>${esc(a.line1)}, ${esc(a.city)} ${esc(a.pin)}${a.lat != null ? " · location saved" : ""}</small></span></label>`).join("")}
  <label class="acard"><input type="radio" name="ad" value="new" ${selA === "new" ? "checked" : ""} onchange="togA()"><span><b>${ADDRS.length ? "+ Add a new address" : "Add your delivery address"}</b></span></label>
  <div id="newa" ${selA === "new" ? "" : "hidden"}>${addrForm()}<label class="chk" style="margin-top:10px"><input type="checkbox" name="sv" checked> Save this address for next time</label></div>
  <div class="infob"><b>Payment: Cash on delivery</b><br><small style="color:var(--mut)">Pay in cash when your order arrives.</small></div>
  <div class="sum"><div class="row"><span>Subtotal</span><span>${inr(t.sub)}</span></div>${t.disc ? `<div class="row"><span>Discount</span><span>−${inr(t.disc)}</span></div>` : ""}<div class="row"><span>Shipping</span><span>${t.ship ? inr(t.ship) : "Free"}</span></div></div>
  <span class="err" id="ce"></span><button class="btn">Place order · ${inr(t.tot)}</button>`;
  if (selA === "new") initPin($("#cf"));
}
function togA() {
  $("#newa").hidden = $("#cf").ad.value !== "new";
  if (!$("#newa").hidden) { initPin($("#cf")).then(() => { const m = $("#newa .pinmap")._m; if (m) m.invalidateSize(); }); }
}
$("#cf").onsubmit = async e => {
  e.preventDefault(); const f = e.target, btn = f.querySelector(".btn"), label = btn.textContent, ad = f.ad.value;
  btn.disabled = true; btn.textContent = "Placing order…"; $("#ce").textContent = "";
  try {
    const body = { payment: "Cash on delivery", coupon: totals().disc ? S.coupon : "", items: S.cart.map(i => ({ id: i.id, size: i.size, qty: i.q })) };
    if (ad === "new") { body.address = readAddr(f); body.saveAddress = f.sv.checked; } else body.addressId = Number(ad);
    const d = await api("/api/orders", "POST", body);
    S.cart = []; S.coupon = ""; S.pct = 0; save(); renderCart();
    showDone(d);
  } catch (err) {
    btn.disabled = false; btn.textContent = label;
    if (err.status === 401) { setUser(null); openAuth("Please log in again.", checkout); }
    else { $("#ce").textContent = err.message; if (/coupon/i.test(err.message)) { S.coupon = ""; S.pct = 0; save(); renderCart(); } }
  }
};

function showDone(d) {
  $("#cf").innerHTML = `<div class="ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-7"/></svg><h2>Thank you, ${esc(U.name.split(" ")[0])}.</h2><p style="color:var(--mut)">Order <b style="color:var(--ink)">${d.orderId}</b> is placed. Total ${inr(d.total)}.<br>We will confirm it shortly. Please keep cash ready at delivery.</p><div style="display:grid;gap:10px"><button type="button" class="btn" onclick="openTrack('${d.orderId}')">Track my order</button><button type="button" class="ghost" onclick="closeAll()">Continue shopping</button></div></div>`;
}

// ---------- my account ----------
async function openAcct(tab) { closeAll(); $("#acct").classList.add("on"); $("#veil").classList.add("on"); drawAcct(tab || "orders"); }
async function drawAcct(tab) {
  $("#an").textContent = U.name; $("#afoot").innerHTML = `<small style="color:var(--mut)">${esc(U.phone)}</small><button class="ghost" style="justify-self:start" onclick="logout()">Log out</button>`;
  $("#atabs").innerHTML = [["orders", "My orders"], ["addresses", "Addresses"], ["password", "Profile"]].map(([k, l]) => `<button class="${k === tab ? "on" : ""}" onclick="drawAcct('${k}')">${l}</button>`).join("");
  const body = $("#abody"); body.innerHTML = '<p class="empty">Loading…</p>';
  try {
    if (tab === "orders") {
      const { orders } = await api("/api/orders/mine");
      body.innerHTML = orders.length ? orders.map(o => `<div class="ocard"><div class="orow"><b>${o.orderId}</b><span class="st st-${o.status}">${STL[o.status]}</span></div><small>${fmt(o.createdAt)} · ${inr(o.total)}${o.returnStatus ? ` · Return: ${esc(RSTL[o.returnStatus])}` : ""}</small><div class="oitems">${o.items.map(i => `${esc(i.name)} (${esc(i.size)}) × ${i.qty}`).join(", ")}</div><button class="ghost" onclick="openTrack('${o.orderId}')">Track order →</button></div>`).join("")
        : '<p class="empty">You have not placed any orders yet.</p>';
    } else if (tab === "password") {
      body.innerHTML = `<form id="cpf" class="afields" style="margin-top:6px"><b style="font-weight:500">Your details</b><input name="name" value="${esc(U.name)}" placeholder="Name"><input name="email" type="email" value="${esc(U.email || "")}" placeholder="Email for order updates (optional)" autocomplete="email"><small style="color:var(--mut)">Mobile number: ${esc(U.phone)}${CFG.emailEnabled ? ". We email you when your order is confirmed, out for delivery and delivered." : ""}</small><span class="err" id="cpfe"></span><button class="btn">Save</button></form>
      <form id="cpw" class="afields" style="margin-top:28px"><b style="font-weight:500">Change your password</b><input name="cur" type="password" placeholder="Current password" autocomplete="current-password"><input name="np" type="password" placeholder="New password (6+ characters)" autocomplete="new-password"><span class="err" id="cpe"></span><button class="btn">Change password</button></form>`;
      $("#cpf").onsubmit = async e => { e.preventDefault(); try { const d = await api("/api/auth/profile", "POST", { name: e.target.name.value, email: e.target.email.value }); setUser(d.user); $("#an").textContent = d.user.name; toast("Saved"); } catch (err) { $("#cpfe").textContent = err.message; } };
      $("#cpw").onsubmit = async e => { e.preventDefault(); try { await api("/api/auth/change-password", "POST", { current: e.target.cur.value, password: e.target.np.value }); toast("Password changed"); e.target.reset(); } catch (err) { $("#cpe").textContent = err.message; } };
    } else {
      const { addresses } = await api("/api/addresses");
      body.innerHTML = addresses.map(a => `<div class="ocard"><div class="orow"><b>${esc(a.label)}${a.isDefault ? " · default" : ""}</b><button class="del" onclick="delAddr(${a.id})">Delete</button></div><div class="oitems" style="margin:4px 0 0">${esc(a.name)}, ${esc(a.phone)}<br>${esc(a.line1)}, ${esc(a.city)} ${esc(a.pin)}${a.lat != null ? `<br><a target="_blank" rel="noopener" style="text-decoration:underline" href="https://www.google.com/maps?q=${a.lat},${a.lng}">Saved location</a>` : ""}</div></div>`).join("")
        + `<form id="nad" class="afields" style="margin-top:14px"><b style="font-weight:500">Add an address</b>${addrForm()}<span class="err" id="nade"></span><button class="btn">Save address</button></form>`;
      initPin($("#nad"));
      $("#nad").onsubmit = async e => { e.preventDefault(); try { await api("/api/addresses", "POST", readAddr(e.target)); toast("Address saved"); drawAcct("addresses"); } catch (err) { $("#nade").textContent = err.message; } };
    }
  } catch (e) { if (e.status === 401) { setUser(null); closeAll(); openAuth("Please log in again."); } else body.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
async function delAddr(id) { try { await api("/api/addresses/" + id, "DELETE"); drawAcct("addresses"); } catch (e) { toast(e.message); } }

// ---------- order tracking ----------
const STEPS = [["new", "Order placed"], ["confirmed", "Confirmed"], ["packed", "Packed"], ["out_for_delivery", "Out for delivery"], ["delivered", "Delivered"]];
function openTrack(id) { trkHold = false; closeAll(); $("#trk").classList.add("on"); $("#veil").classList.add("on"); $("#tbox").innerHTML = '<p class="empty">Loading…</p>'; drawTrack(id); trkT = setInterval(() => drawTrack(id), 8000); }
async function drawTrack(id) {
  if (trkHold) return; // the return form is open: do not redraw over it
  try {
    const o = (await api("/api/orders/" + id)).order; TRK = o; const c = o.customer, idx = STEPS.findIndex(s => s[0] === o.status);
    const when = s => { const e = o.events.find(x => x.status === s); return e ? fmt(e.createdAt) : ""; };
    const tl = (o.status === "cancelled" || o.status === "failed")
      ? `<div class="step done"><i></i><div>Order placed<small>${when("new")}</small></div></div><div class="step bad"><i></i><div>${o.status === "failed" ? "Delivery failed" : "Cancelled"}<small>${when(o.status)}${o.status === "failed" ? "<br>" + esc(((o.events.find(x => x.status === "failed") || {}).note || "").replace("Delivery failed: ", "")) : ""}</small></div></div>`
      : STEPS.map(([s, l], i) => `<div class="step ${i <= idx ? "done" : ""} ${i === idx ? "now" : ""}"><i></i><div>${l}<small>${i <= idx ? when(s) : ""}</small></div></div>`).join("");
    const map = c.lat != null ? `https://www.google.com/maps?q=${c.lat},${c.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address + " " + c.city + " " + c.pin)}`;
    const keep = $("#tmap"); if (keep) keep.remove(); // keep the map alive between refreshes
    $("#tbox").innerHTML = `<button type="button" class="x" style="position:absolute;top:16px;right:18px" onclick="closeAll()" aria-label="Close">×</button>
    <div><small style="color:var(--mut)">Order</small><h2>${o.orderId}</h2></div><div class="tl">${tl}</div>
    ${o.otp ? `<div class="otp">Delivery code<b>${o.otp}</b><small style="color:var(--mut)">Give this code to the delivery partner only when you receive your order.</small></div>` : ""}
    ${o.partner ? `<div class="pcard">Your delivery partner<br><b>${esc(o.partner.name)}</b> · <a href="tel:${esc(o.partner.phone)}" style="text-decoration:underline">${esc(o.partner.phone)}</a></div>` : ""}
    ${o.status === "out_for_delivery" ? `<div id="tmap" class="tmap"></div>${o.partner && o.partner.location ? `<small style="color:var(--mut)">Live location updated ${fmt(o.partner.location.updatedAt)}</small>` : ""}` : ""}
    <div class="infob"><b>Delivering to</b><br>${esc(c.name)}, ${esc(c.phone)}<br>${esc(c.address)}, ${esc(c.city)} ${esc(c.pin)}<br><a target="_blank" rel="noopener" href="${map}">${c.lat != null ? "View saved location" : "Open in Maps"}</a></div>
    <div class="infob">${o.items.map(i => `${esc(i.name)} (${esc(i.size)}) × ${i.qty}`).join("<br>")}<hr style="border:0;border-top:1px solid var(--line);margin:10px 0"><div class="row"><span>Total · ${esc(o.payment)}</span><b>${inr(o.total)}</b></div></div>
    <div class="infob" style="display:flex;gap:18px;flex-wrap:wrap"><a href="/bill.html?id=${o.orderId}" target="_blank" rel="noopener" style="text-decoration:underline">View bill</a>${waLink(o)}</div>
    ${returnBlock(o)}
    ${["new", "confirmed"].includes(o.status) ? `<button class="ghost" style="justify-self:start" onclick="cancelOrder('${o.orderId}')">Cancel this order</button>` : ""}`;
    const ph = $("#tmap"); if (keep && ph) ph.replaceWith(keep);
    updateMap(o);
  } catch (e) { $("#tbox").innerHTML = `<button type="button" class="x" style="position:absolute;top:16px;right:18px" onclick="closeAll()">×</button><p class="empty">${esc(e.message)}</p>`; }
}
const waLink = o => { const w = String((CFG.store && CFG.store.phone) || "").replace(/\D/g, "").slice(-10); return w.length === 10 ? `<a target="_blank" rel="noopener" style="text-decoration:underline" href="https://wa.me/91${w}?text=${encodeURIComponent("Hello, about my order " + o.orderId)}">Chat with the store on WhatsApp</a>` : ""; };
function openSizeGuide() {
  $("#sgbox").innerHTML = `<button type="button" class="x" style="position:absolute;top:16px;right:18px" onclick="$('#sg').classList.remove('on')" aria-label="Close">×</button><h2>Size guide</h2><div style="overflow:auto"><table class="sgt"><tr><th>Size</th><th>Bust</th><th>Waist</th><th>Length</th></tr>${CFG.sizeChart.map(r => `<tr><td><b>${esc(r.size)}</b></td><td>${esc(r.bust)}</td><td>${esc(r.waist)}</td><td>${esc(r.length)}</td></tr>`).join("")}</table></div><p class="note">How to measure: wrap a tape around the fullest part of your chest (bust) and the narrowest part of your waist. If you are between two sizes, choose the bigger one.</p>`;
  $("#sg").classList.add("on");
}
function applyConfig() { // shop rules and prices that the owner can change from the admin page
  document.querySelectorAll(".js-fs").forEach(e => { e.textContent = CFG.freeShippingMin; });
  document.querySelectorAll(".js-rd").forEach(e => { e.textContent = CFG.returnDays; });
  const bn = $("#bn"); if (CFG.banner) { bn.textContent = CFG.banner; bn.hidden = false; } else bn.hidden = true;
  if (P.length) { const prices = P.map(p => p.price), lo = Math.min(...prices), hi = Math.max(...prices); $("#fp").textContent = "₹" + lo; $("#fpl").textContent = lo === hi ? "every kurti" : "starting price"; }
}

// ---------- returns and refunds ----------
function returnBlock(o) {
  const r = o.return;
  if (r) return `<div class="infob"><div class="orow"><b>Return request</b><span class="st st-${r.status === "refunded" ? "delivered" : r.status === "rejected" ? "cancelled" : "confirmed"}">${RSTL[r.status]}</span></div>
    <div style="margin:8px 0">${r.items.map(i => `${esc(i.name)} (${esc(i.size)}) × ${i.qty}`).join("<br>")}</div><small style="color:var(--mut)">Reason: ${esc(r.reason)}</small>
    ${r.status === "refunded" ? `<div style="margin-top:8px"><b>Refund of ${inr(r.amount)}</b> sent to ${esc(r.refundTo)}.<br><small style="color:var(--mut)">Reference: ${esc(r.adminNote)}</small></div>` : r.adminNote ? `<div style="margin-top:8px"><small style="color:var(--mut)">Note from the store:</small><br>${esc(r.adminNote)}</div>` : ""}
    <div class="tl" style="margin-top:12px">${r.history.map(h => `<div class="step done"><i></i><div>${RSTL[h.status]}<small>${fmt(h.at)}</small></div></div>`).join("")}</div></div>`;
  if (o.canReturn) return `<div class="infob">Not happy with your order? You can return it until <b>${new Date(o.returnUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</b>.<button class="btn" style="margin-top:10px;width:100%" onclick="drawReturnForm()">Return or refund</button></div>`;
  return "";
}
function drawReturnForm() {
  trkHold = true; const o = TRK;
  $("#tbox").innerHTML = `<button type="button" class="x" style="position:absolute;top:16px;right:18px" onclick="closeAll()" aria-label="Close">×</button>
  <div><small style="color:var(--mut)">Order ${o.orderId}</small><h2>Return or refund</h2></div>
  <form id="rf" class="afields"><b style="font-weight:500">Which items do you want to return?</b>
  ${o.items.map((i, k) => `<label class="acard"><input type="checkbox" name="it" value="${k}"><span style="flex:1">${esc(i.name)} (${esc(i.size)}) · ${inr(i.price)}</span>${i.qty > 1 ? `<select name="q${k}" aria-label="Quantity" style="width:auto">${Array.from({ length: i.qty }, (_, n) => `<option value="${i.qty - n}">${i.qty - n}</option>`).join("")}</select>` : `<input type="hidden" name="q${k}" value="1">`}</label>`).join("")}
  <select name="reason" aria-label="Reason">${CFG.returnReasons.map(r => `<option>${esc(r)}</option>`).join("")}</select>
  <textarea name="comment" rows="2" maxlength="500" placeholder="Tell us what happened (optional)"></textarea>
  <label class="chk" style="display:block">Photo of the item (helps for damaged or wrong items)<input type="file" name="photo" accept="image/*" style="margin-top:6px"></label>
  <input name="refundTo" placeholder="UPI ID for your refund (or bank account no. + IFSC)" autocomplete="off">
  <small style="color:var(--mut)">After we approve the return, we send the price of the returned items to this UPI ID. You will see the status here.</small>
  <span class="err" id="rerr"></span><button class="btn">Send return request</button><button type="button" class="ghost" style="justify-self:start" onclick="trkHold=false;drawTrack('${o.orderId}')">Back</button></form>`;
  $("#rf").onsubmit = async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector(".btn"); $("#rerr").textContent = ""; btn.disabled = true;
    try {
      const items = [...f.querySelectorAll('[name=it]:checked')].map(c => { const it = o.items[+c.value]; return { id: it.id, size: it.size, qty: +f["q" + c.value].value }; });
      if (!items.length) throw new Error("Choose the items you want to return.");
      let photo = ""; const file = f.photo.files[0];
      if (file) photo = (await api("/api/photos", "POST", { data: await shrinkPhoto(file) })).url;
      await api("/api/orders/" + o.orderId + "/return", "POST", { items, reason: f.reason.value, comment: f.comment.value, refundTo: f.refundTo.value.trim(), photo });
      toast("Return request sent"); trkHold = false; drawTrack(o.orderId);
    } catch (err) { btn.disabled = false; $("#rerr").textContent = err.message; }
  };
}

// Live map (Leaflet + OpenStreetMap, loaded only when needed)
const loadLeaflet = () => new Promise((ok, no) => {
  if (window.L) return ok();
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"; document.head.appendChild(l);
  const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s);
});
async function updateMap(o) {
  const el = $("#tmap");
  if (!el) { if (trkMap) { trkMap.remove(); trkMap = null; trkMarkers = {}; } return; }
  const loc = o.partner && o.partner.location, c = o.customer, pts = [];
  if (loc) pts.push([loc.lat, loc.lng]);
  if (c.lat != null) pts.push([c.lat, c.lng]);
  if (!pts.length) { el.innerHTML = '<p class="note" style="padding:16px">Waiting for the delivery partner’s location…</p>'; return; }
  try { await loadLeaflet(); } catch (e) { el.innerHTML = '<p class="note" style="padding:16px">The map could not load. Check your internet connection.</p>'; return; }
  if (!trkMap || trkMap.getContainer() !== el) {
    if (trkMap) trkMap.remove();
    el.innerHTML = ""; trkMarkers = {};
    trkMap = L.map(el).setView(pts[0], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(trkMap);
  }
  const mark = (k, p, label, cls) => {
    if (!p) { if (trkMarkers[k]) { trkMarkers[k].remove(); delete trkMarkers[k]; } return; }
    if (trkMarkers[k]) trkMarkers[k].setLatLng(p);
    else trkMarkers[k] = L.marker(p, { icon: L.divIcon({ className: "mk " + cls, html: "<b>" + label + "</b>", iconSize: [0, 0] }) }).addTo(trkMap);
  };
  mark("p", loc ? [loc.lat, loc.lng] : null, "Delivery partner", "mkp");
  mark("c", c.lat != null ? [c.lat, c.lng] : null, "Your address", "mkc");
  if (pts.length > 1) trkMap.fitBounds(pts, { padding: [50, 50], maxZoom: 16 }); else trkMap.setView(pts[0], 15);
}
async function cancelOrder(id) { if (!confirm("Cancel this order?")) return; try { await api("/api/orders/" + id + "/cancel", "POST"); toast("Order cancelled"); drawTrack(id); } catch (e) { toast(e.message); } }

$("#q").oninput = e => { S.q = e.target.value; render(); };
$("#sort").onchange = e => { S.sort = e.target.value; render(); };
$("#nf").onsubmit = async e => {
  e.preventDefault(); const f = e.target;
  try { const r = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: $("#ne").value }) }), d = await r.json(); if (!r.ok) throw new Error(d.error); toast("You’re on the list. Use HANUMAN10 at checkout."); f.reset(); }
  catch (err) { toast(err.message || "Could not subscribe. Try again."); }
};

const cfgP = api("/api/config").then(d => { CFG = d; }).catch(() => {});
api("/api/me").then(d => setUser(d.user)).catch(() => setUser(null));
fetch("/api/products").then(r => r.json()).then(async d => {
  await cfgP; P = d; applyConfig(); hero(); extras(); render(); renderCart(); watch();
  if (!reduce) setInterval(() => { if (!document.querySelector(".modal.on")) { hi = (hi + 1) % 3; hero(); } }, 5500);
}).catch(() => { $("#grid").innerHTML = '<p class="empty">Could not load products. Start the server with npm start.</p>'; });
