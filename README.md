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
6. Add the rest of the variables from `/home/runner/work/chilllix_myai/chilllix_myai/.env.example` if you use Wiro or S3 features.
7. Run the database migration before the first production boot:

   ```bash
   npm install
   npm run db:migrate
   ```

   This applies `/home/runner/work/chilllix_myai/chilllix_myai/database/migrations/001_init.sql` to the database in `DATABASE_URL`.

8. Verify production config locally if needed:

   ```bash
   NODE_ENV=production npm run db:verify
   ```

9. Deploy or redeploy the Railway backend service.
10. Check the Railway logs for:
    - `Database connection verified`
    - `Server listening on port ...`
