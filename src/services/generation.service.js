const { Op, col, where, literal } = require('sequelize');
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
  let committed = false;
  try {
    const [updatedCount] = await User.update(
      { creditsBalance: literal(`credits_balance - ${Number(costCredits)}`) },
      {
        where: {
          id: userId,
          isSuspended: false,
          [Op.and]: [where(col('credits_balance'), { [Op.gte]: costCredits })],
        },
        transaction,
      },
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
    committed = true;
    try {
      await enqueueGeneration({ generationId: generation.id, userId, prompt, type, aspectRatio, stylePreset, costCredits });
    } catch (error) {
      await failGenerationAndRefund({ generationId: generation.id, userId, reason: 'Queue submission failed' });
      throw error;
    }
    emitGenerationUpdate(userId, { id: generation.id, status: 'queued', progress: 0 });
    return generation;
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};

const markGenerationProcessing = async ({ generationId, userId }) => {
  if (!Generation) return null;
  await Generation.update({ status: 'processing' }, { where: { id: generationId } });
  emitGenerationUpdate(userId, { id: generationId, status: 'processing', progress: 35 });
};

const persistCompletedGeneration = async (
  { generationModel = Generation, emitUpdate = emitGenerationUpdate },
  { generationId, userId, outputUrl, storageKey },
) => {
  if (!generationModel) return null;
  const generation = await generationModel.findByPk(generationId);
  if (!generation) return null;
  generation.status = 'completed';
  generation.outputUrl = outputUrl;
  generation.storageKey = storageKey;
  await generation.save();
  emitUpdate(userId, { id: generationId, status: 'completed', progress: 100, outputUrl, storageKey });
  return generation;
};

const refundFailedGeneration = async (
  { generationModel = Generation, userModel = User, sequelizeInstance = sequelize, emitUpdate = emitGenerationUpdate },
  { generationId, userId, reason },
) => {
  if (!generationModel || !userModel || !sequelizeInstance) return null;
  const transaction = await sequelizeInstance.transaction();
  try {
    const generation = await generationModel.findByPk(generationId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!generation) {
      await transaction.rollback();
      return null;
    }

    if (generation.status === 'failed') {
      await transaction.rollback();
      return generation;
    }

    generation.status = 'failed';
    await generation.save({ transaction });
    await userModel.update({ creditsBalance: literal(`credits_balance + ${Number(generation.costCredits)}`) }, { where: { id: userId }, transaction });
    await transaction.commit();
    emitUpdate(userId, { id: generationId, status: 'failed', progress: 100, reason });
    return generation;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const completeGeneration = (payload) => persistCompletedGeneration({}, payload);
const failGenerationAndRefund = (payload) => refundFailedGeneration({}, payload);

module.exports = {
  resolveGenerationCosts,
  calculateExpiryDate,
  queueGenerationRequest,
  markGenerationProcessing,
  completeGeneration,
  failGenerationAndRefund,
  persistCompletedGeneration,
  refundFailedGeneration,
};
