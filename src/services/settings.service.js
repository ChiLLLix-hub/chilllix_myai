const env = require('../config/env');
const { SystemSetting } = require('../models');

const DEFAULT_SETTINGS = {
  auto_cleanup_enabled: env.autoCleanupEnabled,
  asset_retention_days: env.assetRetentionDays,
  wiro_api_key: env.wiroApiKey,
  credit_cost_image: env.creditCostImage,
  credit_cost_video: env.creditCostVideo,
  credit_cost_chat: env.creditCostChat,
};

const getSettingsMap = async () => {
  if (!SystemSetting) return { ...DEFAULT_SETTINGS };
  const settings = await SystemSetting.findAll();
  return settings.reduce((acc, setting) => ({ ...acc, [setting.key]: setting.value }), { ...DEFAULT_SETTINGS });
};

const upsertSettings = async (entries) => {
  if (!SystemSetting) return { ...DEFAULT_SETTINGS, ...entries };
  await Promise.all(Object.entries(entries).map(([key, value]) => SystemSetting.upsert({ key, value })));
  return getSettingsMap();
};

module.exports = { DEFAULT_SETTINGS, getSettingsMap, upsertSettings };
