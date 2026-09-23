const { UserLog } = require('../models');

const writeAuditLog = async ({ userId = null, action, details = {}, ipAddress = '', userAgent = '' }) => {
  if (!UserLog || !action) return null;
  return UserLog.create({ userId, action, details, ipAddress, userAgent });
};

module.exports = { writeAuditLog };
