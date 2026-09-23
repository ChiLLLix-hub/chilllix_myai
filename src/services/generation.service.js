const { Op, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const { User, Generation } = require('../models');
const { DEFAULT_SETTINGS, getSettingsMap } = require('./settings.service');
const { enqueueGeneration } = require('./queue.service');
const { emitGenerationUpdate } = require('./socket.service');
const { HttpError } = require('../utils/http-error');

const resolveGenerationCosts = (settings) => ({
  image: Number(settings.credit_cost_image ?? DEFAULT_SETTINGS.credit_cost_image),
  video: Number(settings.credit_cost_video ?? DEFAULT_SETTINGS.credit_cost_video),
  chat: Number(settings.credit_cost_chat ?? DEFAULT_SETTINGS.credit_cost_chat),
});

const calculateExpiryDate = (retentionDays) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(retentionDays || DEFAULT_SETTINGS.asset_retention_days));
  return expiresAt;
};

const queueGenerationRequest = async ({ userId, prompt, type, aspectRatio, stylePreset }) => {
  const settings = await getSettingsMap();
  const costs = resolveGenerationCosts(settings);
  const costCredits = costs[type];

  if (!costCredits) {
    throw new HttpError(400, 'Unsupported generation type');
  }

  if (!User || !Generation || !sequelize) {
    throw new HttpError(503, 'Database is not configured');
  }

  const transaction = await sequelize.transaction();
  try {
    const [updatedCount] = await User.update(
      { creditsBalance: literal(`credits_balance - ${Number(costCredits)}`) },
      { where: { id: userId, creditsBalance: { [Op.gte]: costCredits }, isSuspended: false }, transaction },
    );

    if (!updatedCount) {
      throw new HttpError(402, 'Insufficient credits or suspended account');
    }

    const generation = await Generation.create({
      userId,
      type,
      prompt,
      status: 'queued',
      costCredits,
      expiresAt: calculateExpiryDate(settings.asset_retention_days),
    }, { transaction });

    await transaction.commit();
    await enqueueGeneration({ generationId: generation.id, userId, prompt, type, aspectRatio, stylePreset, costCredits });
    emitGenerationUpdate(userId, { id: generation.id, status: 'queued', progress: 0 });
    return generation;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const markGenerationProcessing = async ({ generationId, userId }) => {
  if (!Generation) return null;
  await Generation.update({ status: 'processing' }, { where: { id: generationId } });
  emitGenerationUpdate(userId, { id: generationId, status: 'processing', progress: 35 });
};

const completeGeneration = async ({ generationId, userId, outputUrl, storageKey }) => {
  if (!Generation) return null;
  const generation = await Generation.findByPk(generationId);
  if (!generation) return null;
  generation.status = 'completed';
  generation.outputUrl = outputUrl;
  generation.storageKey = storageKey;
  await generation.save();
  emitGenerationUpdate(userId, { id: generationId, status: 'completed', progress: 100, outputUrl, storageKey });
  return generation;
};

const failGenerationAndRefund = async ({ generationId, userId, reason }) => {
  if (!Generation || !User || !sequelize) return null;
  const transaction = await sequelize.transaction();
  try {
    const generation = await Generation.findByPk(generationId, { transaction });
    if (!generation) {
      await transaction.rollback();
      return null;
    }

    generation.status = 'failed';
    await generation.save({ transaction });
    await User.update({ creditsBalance: literal(`credits_balance + ${Number(generation.costCredits)}`) }, { where: { id: userId }, transaction });
    await transaction.commit();
    emitGenerationUpdate(userId, { id: generationId, status: 'failed', progress: 100, reason });
    return generation;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  resolveGenerationCosts,
  calculateExpiryDate,
  queueGenerationRequest,
  markGenerationProcessing,
  completeGeneration,
  failGenerationAndRefund,
};
