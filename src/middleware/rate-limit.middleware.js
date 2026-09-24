const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const IORedis = require('ioredis');
const { HttpError } = require('../utils/http-error');

const redis = env.redisEnabled ? new IORedis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false }) : null;
const memoryStore = new Map();

const makeKey = (req, prefix) => `${prefix}:${req.ip}`;

const createRedisBackedRateLimiter = ({ prefix, windowMs, max }) => async (req, _res, next) => {
  const key = makeKey(req, prefix);
  const now = Date.now();

  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, windowMs);
    if (count > max) return next(new HttpError(429, 'Too many requests'));
    return next();
  }

  const entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  entry.count += 1;
  if (entry.count > max) return next(new HttpError(429, 'Too many requests'));
  return next();
};

const createKnownLimiter = ({ windowMs, max }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const authRateLimiter = [
  createKnownLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
  createRedisBackedRateLimiter({ prefix: 'auth', windowMs: 15 * 60 * 1000, max: 10 }),
];
const generationRateLimiter = [
  createKnownLimiter({ windowMs: 60 * 1000, max: 20 }),
  createRedisBackedRateLimiter({ prefix: 'generation', windowMs: 60 * 1000, max: 20 }),
];
const generalKnownApiRateLimiter = createKnownLimiter({ windowMs: 60 * 1000, max: 120 });
const generalApiRedisRateLimiter = createRedisBackedRateLimiter({ prefix: 'api', windowMs: 60 * 1000, max: 120 });
const pageRateLimiter = createKnownLimiter({ windowMs: 60 * 1000, max: 240 });

module.exports = { authRateLimiter, generationRateLimiter, generalKnownApiRateLimiter, generalApiRedisRateLimiter, pageRateLimiter };
