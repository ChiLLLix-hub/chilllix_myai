const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const promptRoutes = require('./routes/prompt.routes');
const generationRoutes = require('./routes/generation.routes');
const transactionRoutes = require('./routes/transaction.routes');
const adminRoutes = require('./routes/admin.routes');
const { generalApiRateLimiter, pageRateLimiter } = require('./middleware/rate-limit.middleware');
const { auditLogger } = require('./middleware/audit.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.frontendOrigin, credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '1mb' }));
app.use(auditLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', redisEnabled: env.redisEnabled, databaseEnabled: env.databaseEnabled, s3Enabled: env.s3Enabled });
});

app.use('/api', generalApiRateLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/generate', generationRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', notFoundHandler);
app.use(pageRateLimiter);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
