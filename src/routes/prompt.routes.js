const express = require('express');
const { z } = require('zod');
const { listPrompts, createPrompt } = require('../controllers/prompt.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditAction } = require('../middleware/audit.middleware');
const { cleanString, cleanStringArray } = require('../utils/sanitize');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

router.use(requireAuth);
router.get('/', auditAction('prompt.list'), asyncHandler(listPrompts));
router.post('/', auditAction('prompt.create'), validate(z.object({
  body: z.object({
    title: z.string().min(2).max(120).transform(cleanString),
    promptText: z.string().min(5).max(4000).transform(cleanString),
    category: z.enum(['image', 'video', 'chat']),
    tags: z.array(z.string()).default([]).transform(cleanStringArray),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
})), asyncHandler(createPrompt));

module.exports = router;
