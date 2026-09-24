const IMAGE_MODEL_CONFIGS = Object.freeze({
  'openai/gpt-image-2-5-flare': Object.freeze({
    id: 'openai/gpt-image-2-5-flare',
    type: 'image',
    provider: 'OpenAI',
    label: 'GPT Image 2.5 Flare',
    supportsSync: true,
    supportsStreaming: true,
    fields: Object.freeze({
      sizeOptions: Object.freeze(['auto', '1:1', '3:2', '2:3']),
    }),
  }),
  'openai/gpt-image-2': Object.freeze({
    id: 'openai/gpt-image-2',
    type: 'image',
    provider: 'OpenAI',
    label: 'GPT Image 2',
    supportsSync: true,
    supportsStreaming: true,
    fields: Object.freeze({
      sizeOptions: Object.freeze(['auto', '1:1', '3:2', '2:3']),
    }),
  }),
});

const SUPPORTED_MODELS_BY_TYPE = Object.freeze({
  image: IMAGE_MODEL_CONFIGS,
  video: Object.freeze({}),
  chat: Object.freeze({}),
});

const getGenerationModelConfig = (type, model) => SUPPORTED_MODELS_BY_TYPE[type]?.[model] || null;

const assertSupportedGenerationModel = (type, model) => {
  if (type !== 'image') return null;
  return getGenerationModelConfig(type, model);
};

module.exports = {
  IMAGE_MODEL_CONFIGS,
  SUPPORTED_MODELS_BY_TYPE,
  getGenerationModelConfig,
  assertSupportedGenerationModel,
};
