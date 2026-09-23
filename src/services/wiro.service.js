const env = require('../config/env');

const fakeGenerationResult = async ({ generationId, type, prompt }) => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (type === 'chat') {
    return {
      outputUrl: '',
      content: `Wiro.ai demo response for: ${prompt}`,
      storageKey: `${type}/${generationId}.json`,
    };
  }

  return {
    outputUrl: `${env.assetBaseUrl}/${type}/${generationId}.${type === 'video' ? 'mp4' : 'png'}`,
    storageKey: `${type}/${generationId}.${type === 'video' ? 'mp4' : 'png'}`,
  };
};

const submitGeneration = async ({ generationId, type, prompt, aspectRatio, stylePreset }) => {
  if (!env.wiroApiKey) {
    return fakeGenerationResult({ generationId, type, prompt, aspectRatio, stylePreset });
  }

  const response = await fetch(`${env.wiroApiBaseUrl.replace(/\/$/, '')}/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + env.wiroApiKey,
    },
    body: JSON.stringify({ type, prompt, aspectRatio, stylePreset }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Wiro request failed: ${response.status} ${text}`);
  }

  return response.json();
};

module.exports = { submitGeneration };
