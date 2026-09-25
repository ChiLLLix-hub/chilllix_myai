const { Generation } = require('../models');
const { queueGenerationRequest } = require('../services/generation.service');
const { HttpError } = require('../utils/http-error');

const resolveAuthenticatedUserId = (req) => req.user?.sub || req.user?.id || null;

const listGenerations = async (req, res) => {
  const userId = resolveAuthenticatedUserId(req);
  if (!userId) throw new HttpError(401, 'Authentication required');
  if (!Generation) throw new HttpError(503, 'Database is not configured');
  const generations = await Generation.findAll({ where: { userId, isDeleted: false }, order: [['createdAt', 'DESC']] });
  res.json(generations);
};

const createGeneration = async (req, res) => {
  const userId = resolveAuthenticatedUserId(req);
  if (!userId) throw new HttpError(401, 'Authentication required');
  const { prompt, type, model, aspectRatio, ratio, resolution, quality } = req.validated.body;
  const generation = await queueGenerationRequest({
    userId,
    prompt,
    type,
    model,
    aspectRatio,
    ratio,
    resolution,
    quality,
  });
  res.status(202).json(generation);
};

module.exports = { listGenerations, createGeneration };
