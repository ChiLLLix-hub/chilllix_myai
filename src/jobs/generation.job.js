const { submitGeneration } = require('../services/wiro.service');
const { markGenerationProcessing, completeGeneration, failGenerationAndRefund } = require('../services/generation.service');

const processGenerationJob = async ({ generationId, userId, prompt, type, model, aspectRatio, ratio, resolution, quality }) => {
  try {
    await markGenerationProcessing({ generationId, userId });
    const result = await submitGeneration({ generationId, type, model, prompt, aspectRatio, ratio, resolution, quality });
    await completeGeneration({ generationId, userId, outputUrl: result.outputUrl || '', storageKey: result.storageKey || '' });
  } catch (error) {
    await failGenerationAndRefund({ generationId, userId, reason: error.message });
  }
};

module.exports = { processGenerationJob };
