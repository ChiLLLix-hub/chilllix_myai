const express = require('express');
const { z } = require('zod');
const { listGenerations, createGeneration } = require('../controllers/generation.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { generationRateLimiter } = require('../middleware/rate-limit.middleware');
const { auditAction } = require('../middleware/audit.middleware');
const { cleanString } = require('../utils/sanitize');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();
const generationBodySchema = z.object({
  prompt: z.string().min(5).max(4000).transform(cleanString),
  type: z.enum(['image', 'video', 'chat']),
  model: z.string().max(120).optional().transform((value, ctx) => {
    if (value === undefined) return undefined;
    const cleaned = cleanString(value);
    if (cleaned.length < 3) {
      ctx.addIssue({ code: 'custom', message: 'Model must be at least 3 characters long' });
      return z.NEVER;
    }
    return cleaned;
  }),
  aspectRatio: z.string().max(20).default('auto').transform(cleanString).refine(
    (value) => value === 'auto' || /^\d{1,2}:\d{1,2}$/.test(value),
    'Aspect ratio must be auto or in N:N format',
  ),
});

router.use(requireAuth);
router.get('/', auditAction('generation.list'), asyncHandler(listGenerations));
router.post('/', generationRateLimiter, auditAction('generation.create'), validate(z.object({
  body: generationBodySchema,
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
})), asyncHandler(createGeneration));

module.exports = router;
