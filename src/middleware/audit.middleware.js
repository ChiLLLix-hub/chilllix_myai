const { writeAuditLog } = require('../services/audit.service');

const auditAction = (action) => (req, _res, next) => {
  req.audit = { ...(req.audit || {}), action };
  next();
};

const auditLogger = (req, res, next) => {
  res.on('finish', () => {
    if (!req.audit?.action || res.statusCode >= 500) return;
    writeAuditLog({
      userId: req.user?.sub || null,
      action: req.audit.action,
      details: { method: req.method, path: req.originalUrl, statusCode: res.statusCode, ...(req.audit.details || {}) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || '',
    }).catch((error) => {
      console.error('Audit log failed', error);
    });
  });
  next();
};

module.exports = { auditAction, auditLogger };
