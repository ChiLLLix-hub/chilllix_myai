const { Transaction } = require('../models');
const { HttpError } = require('../utils/http-error');

const listTransactions = async (req, res) => {
  if (!Transaction) throw new HttpError(503, 'Database is not configured');
  const transactions = await Transaction.findAll({ where: { userId: req.user.sub }, order: [['createdAt', 'DESC']] });
  res.json(transactions);
};

module.exports = { listTransactions };
