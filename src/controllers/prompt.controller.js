const { Op } = require('sequelize');
const { SavedPrompt } = require('../models');
const { HttpError } = require('../utils/http-error');

const listPrompts = async (req, res) => {
  if (!SavedPrompt) throw new HttpError(503, 'Database is not configured');
  const search = req.query.search?.trim();
  const prompts = await SavedPrompt.findAll({
    where: {
      userId: req.user.sub,
      ...(search ? { [Op.or]: [{ title: { [Op.iLike]: `%${search}%` } }, { promptText: { [Op.iLike]: `%${search}%` } }] } : {}),
    },
    order: [['createdAt', 'DESC']],
  });
  res.json(prompts);
};

const createPrompt = async (req, res) => {
  if (!SavedPrompt) throw new HttpError(503, 'Database is not configured');
  const { title, promptText, category, tags } = req.validated.body;
  const prompt = await SavedPrompt.create({ userId: req.user.sub, title, promptText, category, tags });
  res.status(201).json(prompt);
};

module.exports = { listPrompts, createPrompt };
