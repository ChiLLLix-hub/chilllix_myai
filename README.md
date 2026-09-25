# chilllix_myai

Secure full-stack AI platform scaffold powered by Wiro.ai APIs.

## Stack

- **Frontend**: Static SPA in `/public` (Tailwind CSS + vanilla JS), suitable for cPanel hosting
- **Backend**: Express + Socket.IO server in `/src`, suitable for Railway deployment
- **Queue/Realtime**: BullMQ + Redis with inline local fallback for development
- **Storage**: S3-compatible deletion service for generated assets
- **Database**: PostgreSQL schema via SQL migration in `/database/migrations/001_init.sql` and Sequelize models in `/src/models`

## Key Security Controls

- Strict single-origin CORS via `FRONTEND_ORIGIN`
- JWT auth with role-restricted admin routes
- Prompt/profile/search sanitization via `sanitize-html`
- Request validation via `zod`
- Audit logging for auth, profile, generation, prompt, transaction, and admin actions
- Redis-backed or in-memory fallback rate limiting on auth and generation routes
- Atomic credit reservation with automatic refund on failed generation jobs
- Daily cleanup job for expired assets based on `system_settings`

## Project Structure

```text
src/
  config/
  controllers/
  jobs/
  middleware/
  models/
  routes/
  scripts/
  services/
  utils/
public/
database/migrations/
tests/
```

## Quick Start

```bash
cp .env.example .env
npm install
npm test
npm start
```

## Deployment Notes

- **cPanel**: Deploy the contents of `/public` as a static frontend, pointing API requests to the Railway backend domain.
- **Railway**: Set the environment variables from `.env.example`, attach PostgreSQL + Redis + S3-compatible storage, then deploy using the included `Dockerfile`.
- Run the SQL migration in `database/migrations/001_init.sql` against PostgreSQL before first production boot.

## Railway Deployment Guide

1. Create a new Railway project.
2. Add a **PostgreSQL** service and copy its connection string into `DATABASE_URL`.
3. Add a **Redis** service and copy its connection string into `REDIS_URL`.
4. Create a backend service from this repository.
5. Set these required backend variables in Railway:
   - `NODE_ENV=production`
   - `FRONTEND_ORIGIN`
   - `JWT_SECRET`
   - `DATABASE_URL`
   - `REDIS_URL`
6. Add the rest of the variables from `.env.example` if you use Wiro or S3 features.
7. Run the database migration before the first production boot:

   ```bash
   export DATABASE_URL="your-railway-postgres-connection-string"
   npm install
   npm run db:migrate
   ```

   This applies `database/migrations/001_init.sql` to the PostgreSQL database referenced by `DATABASE_URL`.

8. Verify production config locally if needed:

   ```bash
   NODE_ENV=production npm run db:verify
   ```

9. Deploy or redeploy the Railway backend service.
10. Check the Railway logs for:
    - `Database connection verified`
    - `Server listening on port ...`

## cPanel Node.js App Setup (Express Routes Enabled)

Use this mode when you want `/api`, `/admin-login`, `/admin`, and `/admin-assets/*` to be served by this repository's Express server on cPanel.

1. In cPanel, open **Setup Node.js App** and create an app with:
   - **Node.js version**: `20+`
   - **Application mode**: `production`
   - **Application root**: repository root (where `package.json` exists)
   - **Startup file**: `src/server.js`
2. Set environment variables in cPanel app settings:
   - `NODE_ENV=production`
   - `PORT=<cpanel-assigned-port>`
   - `FRONTEND_ORIGIN=https://agromar.com.my` (or your exact frontend origin)
   - `JWT_SECRET=<strong-random-secret>`
   - `DATABASE_URL=<postgres-connection-string>`
   - `REDIS_URL=<redis-connection-string>` (if Redis is enabled)
   - plus any optional values from `.env.example` you use (Wiro/S3/etc.)
3. From cPanel terminal (inside app root), run:

   ```bash
   npm install
   npm run db:migrate
   ```

4. Restart the Node.js app from cPanel.
5. Map your domain/path to the Node.js app URL (do not serve `admin/*.html` directly from `public_html` as static files).
6. Open admin via Express routes:
   - `/admin-login`
   - `/admin`

### cPanel Node.js Troubleshooting

- If DevTools shows `GET https://<domain>/app.js` -> `404` while opening `/myai-main/admin/`, your page is being served as static HTML from the wrong location/path mapping.
- In Express mode, admin assets should load from `/admin-assets/app.js` and `/admin-assets/styles.css`.
- If login POST is blocked with `CSRF protection blocked the request`, verify `FRONTEND_ORIGIN` exactly matches browser origin (`https`, host, and subdomain must match).

## cPanel Frontend -> Railway Backend Setup

1. Deploy `/public` to cPanel `public_html`.
2. Deploy backend on Railway and confirm health:

   ```text
   https://<your-app>.up.railway.app/health
   ```

3. In Railway variables, set at least:
   - `NODE_ENV=production`
   - `FRONTEND_ORIGIN=https://agromar.com.my`
   - `JWT_SECRET=<strong-random-secret>`
   - `DATABASE_URL=<railway-postgres-url>`
   - `REDIS_URL=<railway-redis-url>` (if used)
4. Run migration against Railway PostgreSQL:

   ```bash
   export DATABASE_URL="<railway-postgres-url>"
   npm run db:migrate
   ```

   Run this in Railway shell/CLI or in a local shell where `DATABASE_URL` is explicitly set to the Railway PostgreSQL connection string.

### Option A: Apache vhost reverse proxy `/api` and `/socket.io` to Railway

1. Use `/deploy/apache-vhost-proxy.conf.example` in Apache vhost config.
2. Replace `YOUR_RAILWAY_APP` with your Railway app hostname.
3. Ensure Apache modules are enabled: `mod_proxy`, `mod_proxy_http`, `mod_proxy_wstunnel`, `mod_rewrite`.
4. This option requires vhost-level access (WHM/root or managed host support).

### Option B (fallback): use API subdomain directly

If your hosting plan does not allow vhost proxy rules, point `api.agromar.com.my` directly to Railway and set frontend API base:

- Edit `/public/index.html` and set:

  ```html
  <meta name="myai-api-base" content="https://api.agromar.com.my" />
  ```

  You can set either an origin (`https://api.agromar.com.my`) or an origin plus `/api` (`https://api.agromar.com.my/api`).

You can also set `window.MYAI_API_BASE_URL` before loading `/public/app.js`; this takes priority over the meta tag (`window.CHILLLIX_API_BASE_URL` remains supported for backward compatibility).

`FRONTEND_ORIGIN` remains your SPA URL (`https://agromar.com.my`) in both modes:
- Reverse-proxy mode: API stays under the same origin via `/api`.
- Direct-subdomain mode: browser calls `https://api...`, but backend CORS/CSRF must still trust the frontend origin (`https://agromar.com.my`).

## `.env` Placement

- **Railway production backend**: set environment variables in Railway dashboard (do not upload `.env`).
- **Local development only**: keep `.env` in repository root.
- **cPanel static frontend (`public_html`)**: do not keep `.env` in web-accessible directories.

## End-to-End Verification Checklist

1. Open browser DevTools -> Network.
2. Reverse-proxy mode: confirm `/api/auth/register` and `/api/profile` return backend responses (not cPanel 404).
3. Direct-subdomain mode: confirm requests go to your configured API base (for example `https://api.agromar.com.my/api/auth/register`) and return backend responses.
4. Confirm signup and login both succeed.
5. Confirm Socket.IO connects (no repeated websocket/transport errors).
