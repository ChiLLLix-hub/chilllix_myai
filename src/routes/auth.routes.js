const express = require('express');
const { z } = require('zod');
const { register, login, logout, session } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { authRateLimiter } = require('../middleware/rate-limit.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditAction } = require('../middleware/audit.middleware');
const { cleanString } = require('../utils/sanitize');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
}).nullable().optional();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email().transform((value) => cleanString(value).toLowerCase()),
    password: z.string().min(12).max(128),
    location: locationSchema,
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email().transform((value) => cleanString(value).toLowerCase()),
    password: z.string().min(1).max(128),
    location: locationSchema,
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

router.post('/register', authRateLimiter, auditAction('auth.register'), validate(registerSchema), asyncHandler(register));
router.post('/login', authRateLimiter, auditAction('auth.login'), validate(loginSchema), asyncHandler(login));
router.post('/logout', auditAction('auth.logout'), asyncHandler(logout));
router.get('/session', requireAuth, auditAction('auth.session'), asyncHandler(session));

module.exports = router;
