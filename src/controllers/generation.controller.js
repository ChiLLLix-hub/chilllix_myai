const { Generation } = require('../models');
const { queueGenerationRequest } = require('../services/generation.service');
const { HttpError } = require('../utils/http-error');

const listGenerations = async (req, res) => {
  if (!Generation) throw new HttpError(503, 'Database is not configured');
  const generations = await Generation.findAll({ where: { userId: req.user.sub, isDeleted: false }, order: [['createdAt', 'DESC']] });
  res.json(generations);
};

const createGeneration = async (req, res) => {
  const { prompt, type, model, aspectRatio } = req.validated.body;
  const generation = await queueGenerationRequest({ userId: req.user.sub, prompt, type, model, aspectRatio });
  res.status(202).json(generation);
};

module.exports = { listGenerations, createGeneration };
