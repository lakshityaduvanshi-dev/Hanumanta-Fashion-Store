# Hanumanta Store

One folder with everything: the website (`frontend/`) and the server with PostgreSQL (`backend/`).

## What the shop can do

**Customers**
- Sign up and log in with mobile number and password
- Saved addresses with a **map pin**: tap the map or drag the pin to the exact door (or press "Use my current location"). The delivery partner gets the exact point
- Change their own password from My account
- **Return or refund** for delivered orders (within 7 days): choose the items, reason, an optional photo, and the UPI ID for the refund. They can follow the status: Requested, Approved, Item received, Refunded (or Rejected, with the reason)
- Checkout with a saved or new address, coupon, and **Cash on delivery** (the only payment option)
- **My orders** with live tracking: Placed → Confirmed → Packed → Out for delivery → Delivered
- A 4-digit **delivery code** shown when the order is out for delivery, plus the delivery partner's name and phone
- A **live map** while the order is out for delivery: the customer sees the delivery partner moving towards their address
- **Forgot password?** Ask the store for a reset code, then set a new password
- Cancel an order before it is packed

**Delivery partners** (`/delivery.html`)
- Log in on their phone, see only the orders assigned to them
- Call the customer, open the address in Google Maps, see the cash to collect
- "Start delivery", then "Mark delivered" with the customer's 4-digit code
- While delivering, the phone shares its live location with the customer (only while the order is out for delivery)

**Store owner** (`/admin.html`, needs `ADMIN_KEY`)
- Orders: move each order along (confirmed → packed → out for delivery → delivered), assign a delivery partner, see the customer's map point
- Delivery partners: add, enable or disable (they get a mobile number and password)
- **Returns and refunds:** see every request with the reason, photo and the customer's UPI ID. Approve or reject, mark the item received (and put it back in stock if it can be sold again), then mark it refunded with the payment reference
- **Products and stock:** add a new kurti with a photo, change name, colour group and price, set stock, hide a kurti. Stock 0 shows "Sold out"
- **Download orders as CSV** (opens in Excel / Google Sheets)
- Reset codes for customers and delivery partners who forgot their password
- Customers and newsletter emails

**Phone alerts for you (Telegram):** new order, cancelled order, delivered order, and password reset requests

### New in this version

- **Admin dashboard:** today's orders and sales, orders waiting to be confirmed or packed, open returns, cash with delivery partners, low stock.
- **Settings page (no code needed):** free-shipping amount, shipping fee, return days, coupons (with minimum order), delivery PIN codes, shop banner, size guide, shop details and the fake-order limits. Everything takes effect right away.
- **Protection against fake cash-on-delivery orders:** limits per customer, an order-value cap, and automatic blocking of customers who keep refusing deliveries.
- **Bills and packing slips** you can print (also for many orders at once). Customers can open their own bill.
- **Cash from delivery partners:** how much cash each partner collected and still has to give you, and a record when they hand it over.
- **"Could not deliver":** the delivery partner can mark an order as not delivered with a reason. The items go back to stock.
- **Product pages:** description, fabric and care, up to 7 photos, and a size guide.
- **Order updates for customers:** emails (optional), and one-tap WhatsApp messages from the admin page.
- **Alerts for you:** Telegram message when the server has a problem or the database stops answering.

## Run on your computer

1. Install Node.js 18 or newer from https://nodejs.org
2. Open a terminal in this folder and run:

```bash
npm install
npm start
```

3. Open http://localhost:3000

No Postgres install needed. When `DATABASE_URL` is empty, the app uses a built-in Postgres (PGlite) and stores data in `backend/data/pgdata/`. Tables are created automatically. If you already used an older version with Neon, the new columns are added automatically too.

Settings (optional): copy `.env.example` to `.env`. Default admin key is `change-me-now`.

## Try the whole flow

1. Open `/admin.html`, enter the admin key, go to **Delivery partners** and add one (name, mobile, password).
2. On the shop, click the person icon, sign up, add a kurti and check out (try "Use my current location").
3. In admin, open **Orders**: move the order to *confirmed*, then *packed*, and assign your delivery partner.
4. Open `/delivery.html` (a phone or another browser), log in as the partner, press **Start delivery**.
5. In the shop, open My orders → Track. You will see the delivery code. Enter it on the partner page to finish.

## Folder structure

```
package.json            npm start runs the backend
.env.example            Settings you can copy to .env
Dockerfile              For Docker hosting
backend/
  server.js             HTTP server, login check, serves the website
  config.js             Shipping rules, coupons, payments, secrets
  lib/routes.js         All API endpoints and the order rules
  lib/notify.js         Telegram alerts
  lib/settings.js       Shop rules you change in admin → Settings
  lib/mailer.js         Optional customer emails (lib/messages.js has their text)
  lib/repo.js           All SQL queries
  lib/auth.js           Password hashing and login cookies
  lib/db.js             Postgres connection and tables
  data/products.json    Starting product list (used only on the first start)
frontend/
  index.html, css/, js/ The shop (login, cart, checkout, tracking)
  delivery.html         Delivery partner page
  policies.html         Shipping, returns, privacy and terms
  bill.html             Printable bill and packing slip
  admin.html            Admin page
  images/               Product photos
```

## Deploy later (real Postgres)

1. Create a Postgres database (Neon, Supabase, or Render/Railway Postgres) and copy its connection string.
2. Deploy this folder on a host that runs Node.js (Render, Railway, Fly.io, a VPS). Start command: `npm start`.
3. Set environment variables on the host:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | your Postgres connection string |
| `ADMIN_KEY` | a long secret password |
| `SESSION_SECRET` | long random text (the server will not start in production without it) |
| `NODE_ENV` | `production` |

4. Open `https://YOUR-SITE/api/health`. It should show `{"ok":true,"database":"postgres"}`.

Use HTTPS (hosts like Render do this for you): the browser only shares the location when the site is on HTTPS or localhost. If your Postgres has no SSL, also set `PGSSL=disable`. This version is for hosts that run a normal Node server, not for Vercel.

## Order alerts on Telegram (free)

1. In Telegram, open **@BotFather**, send `/newbot`, choose a name. It gives you a **token** like `123456:ABC-DEF...`
2. Open your new bot and press **Start** (send it any message).
3. Open this address in a browser (put your token in): `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   Find `"chat":{"id":123456789` in the result. That number is your **chat id**. (To get alerts in a group, add the bot to the group, send a message there, and use the group's id, which starts with `-`.)
4. Put both in `.env` (or the host's environment variables) and restart:

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=123456789
APP_URL=https://your-site.com
```

You will get a message like "New order HS123456, total, customer, address, map link and items" on your phone. Alerts never include the customer's delivery code. WhatsApp alerts need the paid WhatsApp Business API, so Telegram is used instead.

## Password reset (how it works)

There is no SMS or email in this shop, so the store gives the code:

1. The customer taps **Log in → Forgot password?**, enters their mobile number and presses **Ask the store for a code**. You get a Telegram alert, and admin shows "Reset requested" next to their name.
2. In `/admin.html` open **Customers** (or **Delivery partners**) and press **Reset code**. A 6-digit code appears, valid for 30 minutes. Tell it to them by phone or WhatsApp.
3. They enter the code and a new password. The code works once.

Delivery partners use the same steps on `/delivery.html`.

## Live map

- The delivery partner's phone sends its location every few seconds, but only while an order is **out for delivery**. It stops after delivery.
- The partner must keep the delivery page open (browsers pause location when the screen is off). The page asks the phone to keep the screen on.
- The customer sees a map (Leaflet with OpenStreetMap) in Track order, updating every 8 seconds. If the partner's location is older than 10 minutes it is hidden.
- Location needs **HTTPS** (or localhost) and the partner must tap **Allow** when the phone asks.
- Map tiles come from the free OpenStreetMap server. That is fine for a small shop; for heavy traffic use a map provider with an API key (for example MapTiler or Mapbox) by changing the tile address in `frontend/js/app.js`.

## Settings (admin → Settings)

Change these without touching any code; they apply immediately:

| Setting | What it does |
| --- | --- |
| Free shipping from / Shipping fee | The bag, bills and policies page all use these |
| Return period | Days after delivery a customer can ask for a return |
| Coupons | Code, percent off, minimum order, on/off. Customers must meet the minimum |
| Delivery area | PIN code starts you deliver to (empty = everywhere) |
| Banner | One line shown at the very top of the shop (for example a sale) |
| Size guide | One line per size: size, bust, waist, length. Empty = no size guide shown |
| Shop details | Name, phone, address, GSTIN: printed on bills, shown on the policies page |

The values in `backend/config.js` and `.env` are only the starting defaults for a brand-new shop.

## Protection against fake cash-on-delivery orders

Cash on delivery invites fake orders, so the shop has these guards (all adjustable in **Settings**):

- A customer can have only a few orders **on the way** at one time (default 3).
- Limit on **orders per customer per day** (default 5), **items per order** (default 10), and the **highest order value** (default ₹5000).
- If a delivery partner marks an order **"Customer refused"** or **"Customer not reachable"**, it counts against the customer. After 2 such deliveries (default) the customer is **blocked automatically**: they cannot log in or order. You get a Telegram alert, and you can unblock them in **Customers**.
- "Wrong or incomplete address" and "Customer asked to cancel" do not count against the customer.
- You can also block or unblock any customer by hand in **Customers**.

## Cash from delivery partners

When a partner delivers a cash-on-delivery order, the cash is theirs to hand over to you. In **admin → Cash from partners** you see how much each partner still has. When a partner gives you the cash, tick those orders and press **Cash received**: it is recorded with the date. Partners can see the same number ("Cash with you") on their page.

## Bills and packing slips

- In **Orders**, each order has **Bill**, **Packing slip** and **WhatsApp** links. **Print packing slips** prints one slip for every confirmed or packed order.
- Packing slip: big address, items with sizes to tick off, and "COLLECT ₹X CASH" for the delivery partner.
- Bill: your shop details (name, address, phone, GSTIN if you added it), items and totals. It is an **order receipt**. Ask your accountant whether you need a GST tax invoice with tax shown separately; this page does not calculate tax.
- Customers see **View bill** on their order page.
- The bill and slip pages ask for the admin key once per browser tab.

## Updates to customers (no SMS needed)

- **WhatsApp:** in **Orders**, the **WhatsApp** link opens a WhatsApp chat with the customer and a ready message for the order's current status (confirmed, out for delivery, delivered...). You just press send. It is free and needs no account.
- **Email (optional):** customers who gave an email get emails when the order is confirmed, out for delivery (with the delivery code), delivered, cancelled or not delivered, and when a return is approved, rejected or refunded. To turn it on, add an SMTP account to `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourshop@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=Hanumanta Store <yourshop@gmail.com>
```

For Gmail, turn on 2-step verification and create an **App password** (do not use your normal password). Other services such as Brevo or Zoho Mail also work with their SMTP details. Customers add their email in **My account → Profile**.

## Know when something breaks

- **Telegram alert** when the server has an error, and when the database stops answering (checked every 5 minutes). The same error is not repeated more than once in 10 minutes.
- For "is the site up?" alerts, add `https://your-site/api/health` to a free monitor such as UptimeRobot. It should answer `{"ok":true,...}`.

## Returns and refunds

1. A customer opens **My orders** → the delivered order → **Return or refund**. They choose the items, a reason, add a photo (optional) and type their UPI ID. This works for 7 days after delivery (change with `RETURN_DAYS` in `.env`). You get a Telegram alert.
2. In `/admin.html` open **Returns & refunds**:
   - **Approve** (add a note such as how the pickup will happen) or **Reject** (the reason is shown to the customer).
   - After you collect the item, press **Mark item received**. It asks whether to put the items back in stock (press OK only if they can be sold again).
   - Send the refund from your own UPI app to the customer's UPI ID, then press **Mark refunded**, confirm the amount and type the payment reference (UPI transaction id). The customer sees "Refund of ₹X sent" with that reference.
   - For low-value items you can use **Refund without pickup** instead of collecting the item.
3. The refund amount starts as the price of the returned items. You can change it when marking it refunded, for example to add back the shipping fee for a damaged item.

The shop does not move money by itself: you pay the refund yourself and record it. There is one return request per order. Customers are not sent an SMS; they see the status on their order page, so call or message them if you need to.

## Products and stock

Use `/admin.html` → **Products & stock**:

- **Add a kurti:** choose a photo (it is shrunk automatically), type the name, colour group, price and stock, press **Add kurti**.
- **Edit:** change the name, colour, price or stock in the row and press **Save**.
- **Sold out:** set stock to 0. The shop shows "Sold out" and nobody can order it. At 5 or fewer, customers see "Only N left".
- **Hide:** untick **Visible** to remove a kurti from the shop without deleting it.
- Stock goes down when an order is placed, and comes back if the order is cancelled (by the customer or by you).
- Stock is counted per kurti, not per size.

Use **Details** on a product row to write the description and fabric & care text, and to add more photos (up to 7). Customers see them in the quick view, with a photo strip and the **Size guide** link (when you filled the size guide in Settings).

`backend/data/products.json` is used only the very first time, to fill an empty shop. After that, manage everything from the admin page (changes in that file are ignored).

Uploaded photos are saved in the database, so they are not lost when you redeploy.

## Delivery area

To deliver only to some areas, set the PIN code starts you serve, for example `DELIVERY_PINS=302,303`. Customers outside get a clear message at checkout. Leave it empty to deliver everywhere.

## Policies

`/policies.html` has Shipping, Returns, Privacy and Terms pages, linked in the footer. They are a **starting template** that matches how this shop works (cash on delivery, 7-day returns, free shipping above ₹999). **Read and edit them so they match your real policy** (open `frontend/policies.html`), and get them checked by an advisor if needed. Set `STORE_PHONE`, `STORE_EMAIL` and `STORE_ADDRESS` to show your contact details there.

## Common changes

- **Add or edit a kurti:** use the admin page (see "Products and stock").
- **Coupons, shipping, return days, limits, banner, size guide:** use admin → **Settings**.

## Not included yet (ideas for next steps)

- **Online payments (UPI / cards):** the shop takes Cash on delivery only. A gateway such as Razorpay can be added later.
- **SMS and WhatsApp messages sent automatically:** needs a paid provider (MSG91, Twilio, WhatsApp Business API). Today you can send WhatsApp messages with one tap from the admin page.
- **Different stock for each size**, product reviews, and a wishlist shared between devices.
- **One admin only:** the admin page uses a single `ADMIN_KEY`; there are no separate staff logins.
- Login attempts are limited, but there is no general rate limit on other requests. Add your host's firewall for a busy shop.
