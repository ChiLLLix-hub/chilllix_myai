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
