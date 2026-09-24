const IORedis = require('ioredis');
const { Queue, Worker } = require('bullmq');
const env = require('../config/env');

let queue;
let worker;
let redis;
let inlineProcessor;

const registerProcessor = (processor) => {
  inlineProcessor = processor;

  if (!env.redisEnabled) return;

  redis = redis || new IORedis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
  queue = queue || new Queue('generations', { connection: redis });
  worker = worker || new Worker('generations', async (job) => processor(job.data), { connection: redis });
};

const enqueueGeneration = async (payload) => {
  if (queue) {
    await queue.add('generation', payload, { removeOnComplete: 100, removeOnFail: 100 });
    return { provider: 'bullmq' };
  }

  if (inlineProcessor) {
    setImmediate(() => {
      inlineProcessor(payload).catch((error) => {
        console.error('Inline generation job failed', error);
      });
    });
  }

  return { provider: 'inline' };
};

module.exports = { registerProcessor, enqueueGeneration };
