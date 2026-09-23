const express = require('express');
const { listTransactions } = require('../controllers/transaction.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { auditAction } = require('../middleware/audit.middleware');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

router.use(requireAuth);
router.get('/', auditAction('transaction.list'), asyncHandler(listTransactions));

module.exports = router;
