const express = require('express');
const { z } = require('zod');
const { register, login } = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate.middleware');
const { authRateLimiter } = require('../middleware/rate-limit.middleware');
const { auditAction } = require('../middleware/audit.middleware');
const { cleanString } = require('../utils/sanitize');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

const authSchema = z.object({
  body: z.object({
    email: z.string().email().transform(cleanString),
    password: z.string().min(12).max(128),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

router.post('/register', authRateLimiter, auditAction('auth.register'), validate(authSchema), asyncHandler(register));
router.post('/login', authRateLimiter, auditAction('auth.login'), validate(authSchema), asyncHandler(login));

module.exports = router;
