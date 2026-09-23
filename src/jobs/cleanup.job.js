const cron = require('node-cron');
const { Op } = require('sequelize');
const { Generation } = require('../models');
const { getSettingsMap } = require('../services/settings.service');
const { deleteAsset } = require('../services/storage.service');

const shouldCleanupGeneration = (generation, now = new Date()) => Boolean(generation && !generation.isDeleted && generation.expiresAt && new Date(generation.expiresAt) <= now);

const runCleanup = async () => {
  const settings = await getSettingsMap();
  if (!settings.auto_cleanup_enabled || !Generation) return { cleaned: 0, skipped: 0 };

  const expired = await Generation.findAll({
    where: {
      isDeleted: false,
      expiresAt: { [Op.lte]: new Date() },
    },
  });

  let cleaned = 0;
  let skipped = 0;

  for (const generation of expired) {
    try {
      let result = { deleted: false };
      if (!generation.storageKey) {
        result = { deleted: true };
      } else {
        result = await deleteAsset(generation.storageKey);
      }

      if (!result.deleted) {
        skipped += 1;
        continue;
      }

      generation.isDeleted = true;
      await generation.save();
      cleaned += 1;
    } catch (error) {
      skipped += 1;
      console.error('Cleanup item failed', { generationId: generation.id, error: error.message });
    }
  }

  return { cleaned, skipped };
};

const startCleanupJob = () => cron.schedule('0 3 * * *', () => {
  runCleanup().catch((error) => {
    console.error('Cleanup job failed', error);
  });
});

module.exports = { shouldCleanupGeneration, runCleanup, startCleanupJob };
