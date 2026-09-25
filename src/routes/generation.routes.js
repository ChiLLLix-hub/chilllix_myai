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
const IMAGE_RATIOS = new Set(['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16']);
const IMAGE_RESOLUTIONS = new Set(['1k', '2k', '4k']);
const IMAGE_QUALITIES = new Set(['low', 'medium', 'high']);

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
  aspectRatio: z.string().max(20).optional().transform((value) => (value === undefined ? undefined : cleanString(value))),
  ratio: z.string().max(20).optional().transform((value) => (value === undefined ? undefined : cleanString(value))),
  resolution: z.string().max(12).optional().transform((value) => (value === undefined ? undefined : cleanString(value).toLowerCase())),
  quality: z.string().max(20).optional().transform((value) => (value === undefined ? undefined : cleanString(value).toLowerCase())),
}).superRefine((body, ctx) => {
  if (body.type !== 'image') return;

  const normalizedRatio = body.ratio || body.aspectRatio;
  if (normalizedRatio && !IMAGE_RATIOS.has(normalizedRatio)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Unsupported image ratio',
      path: ['ratio'],
    });
  }
  if (body.resolution && !IMAGE_RESOLUTIONS.has(body.resolution)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Unsupported image resolution',
      path: ['resolution'],
    });
  }
  if (body.quality && !IMAGE_QUALITIES.has(body.quality)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Unsupported image quality',
      path: ['quality'],
    });
  }
});

// 1. All routes below this line require the user to be logged in
router.use(requireAuth);

// 2. Your existing standard routes
router.get('/', auditAction('generation.list'), asyncHandler(listGenerations));
router.post('/', generationRateLimiter, auditAction('generation.create'), validate(z.object({
  body: generationBodySchema,
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
})), asyncHandler(createGeneration));

module.exports = router;
