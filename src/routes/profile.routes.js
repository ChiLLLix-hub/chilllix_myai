const express = require('express');
const { z } = require('zod');
const { getProfile, getDashboard, updateProfile } = require('../controllers/profile.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditAction } = require('../middleware/audit.middleware');
const { cleanString } = require('../utils/sanitize');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

router.use(requireAuth);
router.get('/', auditAction('profile.view'), asyncHandler(getProfile));
router.get('/dashboard', auditAction('profile.dashboard'), asyncHandler(getDashboard));
router.put('/', auditAction('profile.update'), validate(z.object({ body: z.object({ avatarUrl: z.string().url().optional().transform((value) => value ? cleanString(value) : value) }), query: z.object({}).passthrough(), params: z.object({}).passthrough() })), asyncHandler(updateProfile));

module.exports = router;
