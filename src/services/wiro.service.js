const env = require('../config/env');
const { getDefaultGenerationModel, getGenerationModelConfig } = require('./model-catalog.service');

const RUNNING_TASK_STATUSES = new Set([
  'task_queue',
  'task_accept',
  'task_assign',
  'task_preprocess_start',
  'task_preprocess_end',
  'task_start',
  'task_output',
]);
const SUCCESS_TASK_STATUSES = new Set(['task_postprocess_end']);
const FAILED_TASK_STATUSES = new Set(['task_cancel', 'task_fail', 'task_error']);

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const fakeGenerationResult = async ({ generationId, type, prompt }) => {
  await sleep(50);
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

const buildMultipartBody = (fields) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    form.append(key, String(value));
  });
  return form;
};

const getApiBaseUrl = () => env.wiroApiBaseUrl.replace(/\/$/, '');

const getAuthHeaders = () => ({ 'x-api-key': env.wiroApiKey });

const parseJsonResponse = async (response, label) => {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON`);
  }
};

const buildImageFields = ({ modelConfig, prompt, ratio, resolution, quality }) => {
  const fieldMode = modelConfig.fields?.fieldMode || 'ratio-quality';
  if (fieldMode === 'resolution-ratio-quality') {
    return {
      prompt,
      resolution,
      ratio,
      quality,
    };
  }
  return {
    prompt,
    size: ratio,
    quality,
  };
};

const ensureSupportedImageOptions = (modelConfig, { aspectRatio, ratio, resolution, quality }) => {
  const ratioOptions = modelConfig.fields?.ratioOptions || ['1:1'];
  const qualityOptions = modelConfig.fields?.qualityOptions || ['medium'];
  const resolutionOptions = modelConfig.fields?.resolutionOptions || [];
  const selectedRatioRaw = ratio || aspectRatio || modelConfig.fields?.defaultRatio || ratioOptions[0];
  const selectedRatio = selectedRatioRaw === 'auto'
    ? (modelConfig.fields?.defaultRatio || ratioOptions[0])
    : selectedRatioRaw;
  const selectedQuality = quality || modelConfig.fields?.defaultQuality || qualityOptions[0];
  const selectedResolution = resolution || modelConfig.fields?.defaultResolution || resolutionOptions[0];

  if (selectedRatio && !ratioOptions.includes(selectedRatio)) {
    throw new Error(`Unsupported image ratio ${selectedRatio} for ${modelConfig.id}`);
  }
  if (selectedQuality && !qualityOptions.includes(selectedQuality)) {
    throw new Error(`Unsupported image quality ${selectedQuality} for ${modelConfig.id}`);
  }
  if (resolutionOptions.length && selectedResolution && !resolutionOptions.includes(selectedResolution)) {
    throw new Error(`Unsupported image resolution ${selectedResolution} for ${modelConfig.id}`);
  }

  return {
    ratio: selectedRatio,
    resolution: resolutionOptions.length ? selectedResolution : undefined,
    quality: selectedQuality,
  };
};

const submitAsyncRun = async ({ model, fields, fetchImpl = fetch }) => {
  const response = await fetchImpl(`${getApiBaseUrl()}/Run/${model}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: buildMultipartBody(fields),
  });
  const payload = await parseJsonResponse(response, `Wiro Run ${model}`);
  if (Array.isArray(payload.errors) && payload.errors.length) {
    throw new Error(`Wiro Run ${model} failed: ${payload.errors[0].message || payload.errors[0]}`);
  }
  if (!payload.taskid) {
    throw new Error(`Wiro Run ${model} did not return a task id`);
  }
  return payload;
};

const submitSyncRun = async ({ model, fields, stream = false, fetchImpl = fetch }) => {
  const streamQuery = stream ? '?stream=true' : '';
  const response = await fetchImpl(`${getApiBaseUrl()}/Run/${model}/sync${streamQuery}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: buildMultipartBody(fields),
  });

  if (stream) return response;
  return parseJsonResponse(response, `Wiro Sync Run ${model}`);
};

const extractTask = (payload) => {
  const task = Array.isArray(payload?.tasklist) ? payload.tasklist[0] : null;
  if (!task) {
    throw new Error('Wiro Task Detail did not return a task');
  }
  return task;
};

const extractOutputUrl = (task) => {
  const outputs = Array.isArray(task.outputs) ? task.outputs : [];
  const output = outputs.find((item) => typeof item?.url === 'string' && item.url);
  if (!output) {
    throw new Error('Wiro task completed without an output URL');
  }
  return output.url;
};

const pollTaskDetail = async ({ taskId, fetchImpl = fetch, pollIntervalMs = 2500, maxAttempts = 120 }) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetchImpl(`${getApiBaseUrl()}/Task/Detail`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskid: taskId }),
    });
    const payload = await parseJsonResponse(response, `Wiro Task Detail ${taskId}`);
    if (Array.isArray(payload.errors) && payload.errors.length) {
      throw new Error(`Wiro Task Detail ${taskId} failed: ${payload.errors[0].message || payload.errors[0]}`);
    }

    const task = extractTask(payload);
    if (SUCCESS_TASK_STATUSES.has(task.status)) {
      return task;
    }
    if (FAILED_TASK_STATUSES.has(task.status)) {
      throw new Error(task.debugerror || `Wiro task failed with status ${task.status}`);
    }
    if (!RUNNING_TASK_STATUSES.has(task.status)) {
      throw new Error(`Wiro task returned unknown status ${task.status}`);
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`Wiro task ${taskId} timed out`);
};

const submitImageGeneration = async ({ model, prompt, aspectRatio, ratio, resolution, quality }, options = {}) => {
  const selectedModel = model === undefined ? getDefaultGenerationModel('image')?.id : model;
  const modelConfig = getGenerationModelConfig('image', selectedModel);
  if (!modelConfig || !selectedModel) {
    throw new Error('Unsupported image model');
  }

  const selectedFields = ensureSupportedImageOptions(modelConfig, { aspectRatio, ratio, resolution, quality });
  const fields = buildImageFields({ modelConfig, prompt, ...selectedFields });
  const run = await submitAsyncRun({ model: selectedModel, fields, fetchImpl: options.fetchImpl });
  const task = await pollTaskDetail({ taskId: run.taskid, fetchImpl: options.fetchImpl, pollIntervalMs: options.pollIntervalMs, maxAttempts: options.maxAttempts });

  return {
    outputUrl: extractOutputUrl(task),
    storageKey: '',
    taskId: run.taskid,
  };
};

const submitLegacyGeneration = async ({ type, prompt, aspectRatio, ratio, resolution, quality, fetchImpl = fetch }) => {
  const response = await fetchImpl(`${getApiBaseUrl()}/generations`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type, prompt, aspectRatio, ratio, resolution, quality }),
  });

  return parseJsonResponse(response, 'Wiro legacy generations');
};

const submitGeneration = async ({ generationId, type, model, prompt, aspectRatio, ratio, resolution, quality }, options = {}) => {
  if (!env.wiroApiKey) {
    return fakeGenerationResult({ generationId, type, prompt, aspectRatio });
  }

  if (type === 'image') {
    return submitImageGeneration({ model, prompt, aspectRatio, ratio, resolution, quality }, options);
  }

  return submitLegacyGeneration({ type, prompt, aspectRatio, ratio, resolution, quality, fetchImpl: options.fetchImpl });
};

module.exports = {
  RUNNING_TASK_STATUSES,
  SUCCESS_TASK_STATUSES,
  FAILED_TASK_STATUSES,
  fakeGenerationResult,
  buildImageFields,
  ensureSupportedImageOptions,
  submitAsyncRun,
  submitSyncRun,
  extractTask,
  extractOutputUrl,
  pollTaskDetail,
  submitImageGeneration,
  submitLegacyGeneration,
  submitGeneration,
};
