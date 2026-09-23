const cron = require('node-cron');
const { Op } = require('sequelize');
const { Generation } = require('../models');
const { getSettingsMap } = require('../services/settings.service');
const { deleteAsset } = require('../services/storage.service');

const shouldCleanupGeneration = (generation, now = new Date()) => Boolean(generation && !generation.isDeleted && generation.expiresAt && new Date(generation.expiresAt) <= now);

const runCleanup = async () => {
  const settings = await getSettingsMap();
  if (!settings.auto_cleanup_enabled || !Generation) return { cleaned: 0 };

  const expired = await Generation.findAll({
    where: {
      isDeleted: false,
      expiresAt: { [Op.lte]: new Date() },
    },
  });

  for (const generation of expired) {
    await deleteAsset(generation.storageKey);
    generation.isDeleted = true;
    await generation.save();
  }

  return { cleaned: expired.length };
};

const startCleanupJob = () => cron.schedule('0 3 * * *', () => {
  runCleanup().catch((error) => {
    console.error('Cleanup job failed', error);
  });
});

module.exports = { shouldCleanupGeneration, runCleanup, startCleanupJob };
