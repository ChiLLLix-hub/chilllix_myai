const express = require('express');
const { z } = require('zod');
const { getOverview, getSettings, updateSettings, listUsers, updateUser } = require('../controllers/admin.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditAction } = require('../middleware/audit.middleware');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));
router.get('/overview', auditAction('admin.overview'), asyncHandler(getOverview));
router.get('/settings', auditAction('admin.settings.view'), asyncHandler(getSettings));
router.put('/settings', auditAction('admin.settings.update'), validate(z.object({
  body: z.object({
    auto_cleanup_enabled: z.boolean().optional(),
    asset_retention_days: z.number().int().min(1).max(365).optional(),
    wiro_api_key: z.string().max(500).optional(),
    credit_cost_image: z.number().int().min(1).max(1000).optional(),
    credit_cost_video: z.number().int().min(1).max(1000).optional(),
    credit_cost_chat: z.number().int().min(1).max(1000).optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
})), asyncHandler(updateSettings));
router.get('/users', validate(z.object({
  body: z.object({}).passthrough(),
  query: z.object({ search: z.string().max(120).optional() }).passthrough(),
  params: z.object({}).passthrough(),
})), auditAction('admin.users.list'), asyncHandler(listUsers));
router.patch('/users/:id', auditAction('admin.users.update'), validate(z.object({
  body: z.object({
    creditsBalance: z.number().int().min(0).optional(),
    role: z.enum(['user', 'admin']).optional(),
    isSuspended: z.boolean().optional(),
    clearLoginLock: z.boolean().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() }),
})), asyncHandler(updateUser));

module.exports = router;
