# CMS Backend — Node.js + Express + MySQL

Production-style REST API for the Coaching Management System: auth (JWT),
students, teachers, courses, batches, attendance, exams & results, fees
(with SSLCommerz online payment), notifications (email + SMS), LMS, and
HR/payroll.

## 1. Requirements
- Node.js 18+
- MySQL 8+ (or MariaDB 10.5+)

## 2. Setup

```bash
cd cms-backend
npm install
cp .env.example .env      # then edit .env with your real values
mysql -u root -p < database/schema.sql
npm run dev                # starts on http://localhost:4000
```

## 3. First login

The schema seeds one admin account:
- email: `admin@cms.com`
- password: `Admin@123`

Log in, then immediately call `POST /api/auth/change-password`, or create a
fresh admin via `POST /api/auth/register-admin` before anyone else does
(that route only works while zero admins exist).

## 4. Authentication

`POST /api/auth/login` returns a JWT. Send it on every other request:

```
Authorization: Bearer <token>
```

Roles: `admin`, `staff`, `teacher`, `student`, `parent`. Each route file
lists which roles may write; everyone authenticated may read the routes
that don't set `authorize(...)`.

## 5. Connecting third-party services

Nothing below requires code changes — just fill in `.env`:

**Email** — any SMTP account (Gmail with an App Password, SendGrid SMTP,
Mailgun SMTP, your own mail server). Set `SMTP_HOST/PORT/USER/PASS`.

**SMS** — `utils/sms.js` calls a generic HTTP API that matches most
Bangladeshi providers (BulkSMSBD, SSL Wireless, Alpha SMS). Set
`SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`. For Twilio instead, swap the
function body for the `twilio` npm package — the comment in the file shows
how.

**Payment** — `utils/payment.js` integrates SSLCommerz (the most common
gateway for coaching centers in Bangladesh, and it also supports bKash/
Nagad/cards under one hood). Get sandbox credentials free at
https://developer.sslcommerz.com, set `SSLCOMMERZ_STORE_ID` and
`SSLCOMMERZ_STORE_PASSWORD`, keep `SSLCOMMERZ_IS_LIVE=false` until you're
ready to go live. If you'd rather use Stripe or a different local gateway,
this file is the only place that needs rewriting — every route already
calls `initPayment()` / `validateTransaction()` generically.

## 6. Key endpoints

| Area | Endpoint |
|---|---|
| Login | `POST /api/auth/login` |
| Students | `GET/POST /api/students`, `PUT/DELETE /api/students/:id` |
| Attendance | `POST /api/attendance/mark`, `GET /api/attendance?batch_id=&date=` |
| Exams | `POST /api/exams`, `POST /api/exams/:id/results` |
| Fees | `GET /api/fees`, `POST /api/fees/:id/pay` (manual), `POST /api/fees/:id/pay/online` (SSLCommerz) |
| Notifications | `POST /api/notifications` `{ title, message, audience, channel: ["app","email","sms"] }` |
| LMS | `GET/POST /api/lms` |
| Payroll | `GET /api/payroll?month=YYYY-MM`, `POST /api/payroll/:id/pay` |

## 7. Deploying

Any Node host works (Railway, Render, a VPS with PM2 + Nginx, etc.). Point
`DB_HOST` at a managed MySQL instance (PlanetScale, AWS RDS, DigitalOcean
Managed MySQL). Set `CORS_ORIGIN` to your real frontend/app domain and put
this API behind HTTPS before going live — payment and login traffic must
not run over plain HTTP in production.

## 8. What's intentionally left open

- File storage for LMS uploads (`file_url` column) — plug in S3, DigitalOcean
  Spaces, or local disk + `express.static`, whichever you prefer.
- A `parent_links` table exists in the schema to connect a parent's login
  to one or more students — wire this up when you build parent
  self-registration.
- Role permission matrix (`role_permissions` table) is scaffolded but not
  yet enforced per-field; the current `authorize()` middleware is
  role-based, which covers most coaching centers' needs day one.
