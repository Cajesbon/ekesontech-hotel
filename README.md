# EK Hotel — Website & Guest Booking Management System

A complete, production-ready hotel website and booking platform: a guest-only booking
engine (no customer accounts), a real-time availability system backed by MongoDB, and a
full admin dashboard for managing rooms, bookings, promotions, and hotel content.

## Table of contents

1. [Project overview](#project-overview)
2. [Technology stack](#technology-stack)
3. [Project structure](#project-structure)
4. [Installation](#installation)
5. [MongoDB setup](#mongodb-setup)
6. [Environment variables](#environment-variables)
7. [Running locally](#running-locally)
8. [Creating the first admin account](#creating-the-first-admin-account)
9. [Payment gateway setup (Paystack / Flutterwave)](#payment-gateway-setup)
10. [Email configuration](#email-configuration)
11. [Image storage configuration (Cloudinary)](#image-storage-configuration)
12. [How availability & booking work](#how-availability--booking-work)
13. [API reference](#api-reference)
14. [Production deployment](#production-deployment)
15. [Security considerations](#security-considerations)

---

## Project overview

Guests can browse rooms, check live availability, and complete a booking entirely as a
guest — no account, login, or password required. Every booking is checked against
MongoDB for date-overlap conflicts before it is accepted, and payments are verified
server-side (never trusted from the browser) before a booking is marked confirmed.

Hotel staff manage everything — rooms, bookings, promotions, gallery, testimonials,
contact messages, and hotel-wide settings — from a separate `/admin` dashboard protected
by JWT authentication.

## Technology stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript (no framework), Fetch API
- **Backend:** Node.js, Express.js, REST APIs
- **Database:** MongoDB with Mongoose
- **Auth:** JWT (admin only) + bcrypt password hashing
- **Email:** Nodemailer (SMTP)
- **Images:** Multer + Cloudinary (falls back to local disk storage in development)
- **Payments:** Paystack or Flutterwave (configurable)
- **Security:** Helmet, express-rate-limit, express-mongo-sanitize, xss-clean, CORS

## Project structure

```
hotel-booking-system/
├── server/
│   ├── config/         # DB + Cloudinary configuration
│   ├── controllers/    # Route handlers / business logic
│   ├── middleware/     # Auth, error handling, uploads, rate limiting, validation
│   ├── models/         # Mongoose schemas
│   ├── routes/         # Public routes + routes/admin for admin-only routes
│   ├── services/       # Availability engine, email templates, payment gateway abstraction
│   ├── utils/          # Small shared helpers (errors, async wrapper, references, audit log)
│   ├── seed/           # Database seed script with demo data
│   ├── uploads/        # Local image storage fallback (used only without Cloudinary)
│   ├── app.js
│   └── server.js
├── public/              # Guest-facing website (static, no build step)
│   ├── css/style.css
│   ├── js/              # api.js (shared) + one file per page
│   ├── index.html, rooms.html, room-details.html, booking.html,
│   │   confirmation.html, about.html, gallery.html, contact.html
├── admin/               # Admin dashboard (static, no build step)
│   ├── css/admin.css
│   ├── js/              # admin-api.js (shared) + one file per page
│   └── login.html, dashboard.html, bookings.html, rooms.html,
│       promotions.html, gallery.html, testimonials.html, messages.html, settings.html
├── .env.example
├── package.json
└── README.md
```

## Installation

Requires Node.js 18+ (for native `fetch`) and a MongoDB instance (local or Atlas).

```bash
git clone <your-repo-url>
cd hotel-booking-system
npm install
cp .env.example .env
```

Then fill in `.env` with real values (see below).

## MongoDB setup

**Option A — local MongoDB**

```bash
# macOS (Homebrew)
brew install mongodb-community
brew services start mongodb-community
```

Then set in `.env`:
```
MONGODB_URI=mongodb://localhost:27017/hotel-booking
```

**Option B — MongoDB Atlas (recommended for production)**

1. Create a free cluster at https://www.mongodb.com/atlas
2. Create a database user and allow your IP (or `0.0.0.0/0` for quick testing)
3. Copy the connection string into `.env`:
```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/hotel-booking
```

## Environment variables

All variables are documented in `.env.example`. Key ones:

| Variable | Purpose |
|---|---|
| `PORT` | Port the server listens on (default `5000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign admin session tokens |
| `PAYMENT_PROVIDER` | `paystack` or `flutterwave` |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | Paystack API keys |
| `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_PUBLIC_KEY` | Flutterwave API keys (if used instead) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Outgoing email (booking confirmations) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image hosting (optional in dev) |
| `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` | Used only by the seed script to create the first admin |

Generate strong secrets, e.g.:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Running locally

```bash
npm run seed   # populates demo rooms, amenities, testimonials, settings, and an admin account
npm run dev    # starts the server with nodemon on http://localhost:5000
# or
npm start      # production start (no auto-reload)
```

- Guest website: http://localhost:5000
- Admin dashboard: http://localhost:5000/admin/login.html

## Creating the first admin account

The seed script (`npm run seed`) creates one **super admin** account using
`FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` from your `.env` (defaults to
`admin@hotel.com` / `ChangeMe123!` if unset), already approved and active.
**Change this password immediately after your first login** via
Admin → Settings → Change Password.

### Adding managers / receptionists (staff) afterwards

There are two ways to add more admin users, both restricted to super admins:

1. **Self-service request + approval (recommended for real staff onboarding):**
   A new staff member visits `/admin/signup.html`, enters their name, email,
   password, and requested role (Manager or Staff/Receptionist). This creates
   an account with `status: "pending"` — it **cannot log in yet**. A super
   admin then goes to **Admin → Staff Accounts**, where all pending requests
   appear with **Approve** / **Reject** buttons. Only after approval can that
   person sign in. Rejected or not-yet-approved accounts are blocked at login
   with a clear message explaining why.

2. **Direct creation by a super admin:** From **Admin → Staff Accounts → Add
   Staff Directly**, a super admin can create an already-approved account
   immediately (no pending review), useful for onboarding trusted staff
   in person. This calls:
   ```
   POST /api/admin/auth/create-admin
   { "name": "...", "email": "...", "password": "...", "role": "manager" }
   ```

From the same **Staff Accounts** page, a super admin can also change a staff
member's role, suspend/reactivate an approved account, or delete an account
entirely (a super admin can't delete their own account, suspend themselves,
or delete the last remaining super admin — this prevents accidental
lockouts). Only super admins can see or use this page; everyone else gets an
"access restricted" notice, and the backend enforces this regardless of what
the frontend shows.

Only accounts created through `/admin/signup.html` start out pending — every
other account (seeded, or created via "Add Staff Directly") is approved
immediately, so upgrading an existing deployment never locks out admins you
already created.

## Payment gateway setup

The system integrates with **Paystack** by default, with a **Flutterwave** adapter also
implemented (`server/services/paymentService.js`). Switch providers with:

```
PAYMENT_PROVIDER=paystack   # or flutterwave
```

**Paystack**
1. Create an account at https://dashboard.paystack.com
2. Copy your test (or live) secret/public keys into `.env`
3. In your Paystack dashboard, set the webhook URL to:
   `https://yourdomain.com/api/payments/webhook`

**Flutterwave**
1. Create an account at https://dashboard.flutterwave.com
2. Copy your secret/public keys into `.env`

Payments are always verified server-side — the frontend never marks a booking as paid.
The webhook is the authoritative source of truth in production; the redirect-based
verification (`POST /api/payments/verify`) is a convenience for the browser after the
gateway redirects back to `/confirmation.html`.

Without real gateway credentials, `POST /api/payments/initialize` will return an error.
The booking itself is still created as `pending` — an admin can manually mark it as
confirmed/paid from the dashboard if you're testing without live payment credentials.

### The payment callback URL, and testing across devices

The URL Paystack/Flutterwave redirects the guest back to after payment is built from
`CLIENT_URL` if you've set it in `.env`, or otherwise **derived automatically from the
request that initialized the payment** (its protocol + host). This matters if you're
testing from a phone or another device through a tunnel (VS Code port forwarding,
ngrok, devtunnels, etc.) rather than from the same machine running the server: without
this, a hardcoded `localhost` fallback would send the gateway's redirect to the guest's
own device's loopback address, which it can never reach, showing "This site can't be
reached" right after payment — the payment itself would still have gone through, but
the browser would never load the page that confirms it.

For **production**, set `CLIENT_URL` explicitly to your real domain — don't rely on the
automatic detection there, since you want a predictable, fixed callback URL.

**If a booking is ever stuck on "pending" after a guest has actually paid** (e.g. their
connection dropped right after payment, or the redirect never completed for any other
reason), there are two ways to recover it without waiting on anything:
1. Have the guest (or you) revisit `/confirmation.html?ref=<their booking reference>`,
   or use **Find My Booking** on the Contact page — this re-attempts verification
   against the gateway automatically using the payment reference already stored on the
   booking.
2. From **Admin → Bookings → Manage** on that booking, click **Re-verify Payment with
   Gateway** — this checks the transaction's real status directly with Paystack/
   Flutterwave and confirms the booking if it actually succeeded, without you having to
   blindly flip the status by hand.

Configuring the webhook (step 3 above) is still the most reliable long-term fix, since
it's pushed to your server directly by the gateway and doesn't depend on the guest's
browser successfully completing the redirect at all.

## Email configuration

Uses Nodemailer over SMTP. Any SMTP provider works (Gmail, SendGrid, Mailgun, Amazon
SES, etc.). Example for Gmail (use an App Password, not your regular password):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-app-password
```

If SMTP variables are not set, the app logs emails to the console instead of sending
them, so the booking flow still works end-to-end in development.

## Image storage configuration

If `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are all
set, uploaded images (room photos, gallery, hotel logo) are stored on Cloudinary. If not
set, images are stored locally under `server/uploads/` and served at `/uploads/...` —
convenient for local development, but you should configure Cloudinary (or another
persistent object store) before deploying, since most hosting platforms do not persist
local disk storage across deploys.

## Admin notifications

The admin dashboard shows a notification bell (top-right of every admin
page) that polls `GET /api/admin/dashboard/notifications` roughly every 45
seconds for anything created since the last check — new bookings, new
contact messages, and reviews awaiting approval. New items appear in the
dropdown with an unread badge, as an in-page toast, and — if the browser
grants permission — as a native OS-level browser notification (the browser
will prompt for permission on first dashboard load, or when the bell is
clicked). This is a simple poll, not a websocket/push service, which is
enough for a small hotel admin team and requires no extra infrastructure.

## How availability & booking work

- Every room has a `totalUnits` count (how many physical rooms of that type exist).
- `server/services/availabilityService.js` computes, for any date range, how many units
  of a room are already held by bookings whose status is `pending` (and not expired),
  `confirmed`, `checked_in`, or `checked_out`, using the standard overlap rule:
  `existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn`.
  A check-out on the same day as another guest's check-in is **not** treated as an
  overlap.
- This check runs **server-side** at three points: when browsing rooms with dates
  selected, when creating a booking, and again immediately before initializing payment
  — and once more before finalizing a successful payment — to minimize race conditions
  between two guests booking the same room at the same time.
- A `pending` booking (created but not yet paid) holds its room for 30 minutes
  (`PENDING_BOOKING_TTL_MINUTES` in `bookingController.js`), after which it no longer
  counts against availability. Consider adding a scheduled job (cron, or a MongoDB TTL
  index) to actively clean up expired pending bookings if you want them removed from the
  database entirely.

## API reference

All endpoints are prefixed with `/api`. Admin endpoints additionally require a valid
admin session (cookie or `Authorization: Bearer <token>` header).

**Public**
```
GET    /api/rooms                       List rooms (filters: type, minPrice, maxPrice, guests, checkIn, checkOut)
GET    /api/rooms/:id                   Room details (by id or slug)
GET    /api/rooms/availability          Check availability for a room + date range
GET    /api/rooms/types/all             List room types
GET    /api/amenities                   List amenities
GET    /api/gallery                     List gallery images
GET    /api/testimonials                List approved testimonials
POST   /api/testimonials                Submit a testimonial (goes to pending review)
GET    /api/facilities                  List active hotel facilities (with photo + description)
GET    /api/settings                    Public hotel settings
POST   /api/contact                     Submit a contact message
POST   /api/promotions/validate         Validate a promo code
POST   /api/bookings                    Create a guest booking (status: pending)
GET    /api/bookings/:reference         Look up a booking by reference
POST   /api/payments/initialize         Start a payment for a booking
POST   /api/payments/verify             Verify a payment after gateway redirect
POST   /api/payments/webhook            Payment gateway webhook (Paystack)
POST   /api/admin/auth/login            Admin login
POST   /api/admin/auth/signup           Request a staff/manager account (starts as "pending")
```

**Admin** (all under `/api/admin`, JWT-protected)
```
GET    /admin/dashboard/stats
GET    /admin/dashboard/revenue-chart
GET    /admin/dashboard/audit-logs
GET    /admin/dashboard/notifications?since=<ISO timestamp>
GET    /admin/bookings            PUT /admin/bookings/:id            DELETE /admin/bookings/:id
PATCH  /admin/bookings/:id/status PATCH /admin/bookings/:id/payment-status
POST   /admin/bookings/:id/reverify-payment  Manually re-check a booking's payment against the gateway
GET    /admin/rooms               POST /admin/rooms (multipart)      PUT /admin/rooms/:id (multipart)
DELETE /admin/rooms/:id           PATCH /admin/rooms/:id/status
POST   /admin/rooms/types         PUT /admin/rooms/types/:id         DELETE /admin/rooms/types/:id
GET    /admin/promotions          POST /admin/promotions             PUT/DELETE /admin/promotions/:id
GET    /admin/amenities           POST /admin/amenities              PUT/DELETE /admin/amenities/:id
GET    /admin/gallery             POST /admin/gallery (multipart)    DELETE /admin/gallery/:id
GET    /admin/facilities          POST /admin/facilities (multipart) PUT/DELETE /admin/facilities/:id
GET    /admin/testimonials        POST /admin/testimonials           PATCH /admin/testimonials/:id/status
GET    /admin/messages            PATCH /admin/messages/:id/status   DELETE /admin/messages/:id
GET    /admin/settings            PUT /admin/settings (multipart, for logo upload)
GET    /admin/payments
GET    /admin/auth/pending        List staff accounts awaiting approval (superadmin only)
GET    /admin/auth/all            List all staff accounts (superadmin only)
PATCH  /admin/auth/:id/approve    Approve a pending account (superadmin only)
PATCH  /admin/auth/:id/reject     Reject a pending account (superadmin only)
PATCH  /admin/auth/:id/active     Suspend/reactivate an approved account (superadmin only)
PATCH  /admin/auth/:id/role       Change a staff member's role (superadmin only)
DELETE /admin/auth/:id            Delete a staff account (superadmin only)
POST   /admin/auth/create-admin   Create an already-approved account directly (superadmin only)
```

## Production deployment

1. Set `NODE_ENV=production` and use strong, unique values for `JWT_SECRET` and
   `COOKIE_SECRET`.
2. Use MongoDB Atlas or another managed MongoDB instance.
3. Configure Cloudinary (or another persistent object store) for image uploads.
4. Set `CLIENT_URL` to your real domain (used for payment callback URLs).
5. Put the app behind HTTPS (e.g. via a reverse proxy like Nginx, or your hosting
   platform's built-in TLS) — cookies are marked `secure` in production and require
   HTTPS to be sent by the browser.
6. Point your payment gateway's webhook at `https://yourdomain.com/api/payments/webhook`.
7. Consider adding a process manager (PM2) or containerizing with Docker for resilience.
8. Set up a scheduled task to expire/clean old `pending` bookings if desired.

## Security considerations

- Passwords are hashed with bcrypt (12 salt rounds); plaintext passwords are never
  stored or logged.
- Admin sessions use JWTs stored in an httpOnly, `secure` (in production), `sameSite=lax`
  cookie, so they aren't accessible to client-side JavaScript.
- All admin routes are protected by `protectAdmin` middleware; sensitive actions
  (deleting bookings, creating admins) are further restricted by role.
- MongoDB queries are sanitized against operator injection (`express-mongo-sanitize`)
  and output is sanitized against XSS (`xss-clean`).
- Rate limiting is applied globally and more strictly to `/auth/login` and booking
  creation endpoints to slow down brute-force and abuse attempts.
- Payment status is only ever changed by server-side verification against the gateway
  (or webhook), never by trusting a value sent from the browser.
- Errors shown to guests never include stack traces or internal details — see
  `server/middleware/errorHandler.js`.
- No secrets (DB connection string, JWT secret, payment keys, SMTP password) are ever
  sent to the frontend; they only exist in `.env` on the server.
#   e k e s o n t e c h - h o t e l  
 