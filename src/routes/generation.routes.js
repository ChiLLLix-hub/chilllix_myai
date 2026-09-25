const express = require('express');
const { z } = require('zod');
const { listGenerations, createGeneration } = require('../controllers/generation.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { generationRateLimiter } = require('../middleware/rate-limit.middleware');
const { auditAction } = require('../middleware/audit.middleware');
const { cleanString } = require('../utils/sanitize');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();
const IMAGE_ASPECT_RATIOS = new Set(['auto', '1:1', '3:2', '2:3']);

const generationBodySchema = z.object({
  prompt: z.string().min(5).max(4000).transform(cleanString),
  type: z.enum(['image', 'video', 'chat']),
  model: z.string().max(120).optional().transform((value, ctx) => {
    if (value === undefined) return undefined;
    const cleaned = cleanString(value);
    if (cleaned.length < 3) {
      ctx.addIssue({ code: 'custom', message: 'Model must be at least 3 characters long' });
      return z.NEVER;
    }
    return cleaned;
  }),
  aspectRatio: z.string().max(20).default('auto').transform(cleanString).refine(
    (value) => value === 'auto' || /^\d{1,2}:\d{1,2}$/.test(value),
    'Aspect ratio must be auto or in N:N format',
  ),
}).superRefine((body, ctx) => {
  if (body.type === 'image' && !IMAGE_ASPECT_RATIOS.has(body.aspectRatio)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Unsupported aspect ratio for the selected image models',
      path: ['aspectRatio'],
    });
  }
});

// 1. All routes below this line require the user to be logged in
router.use(requireAuth);

// 2. Your existing standard routes
router.get('/', auditAction('generation.list'), asyncHandler(listGenerations));
router.post('/', generationRateLimiter, auditAction('generation.create'), validate(z.object({
  body: generationBodySchema,
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
})), asyncHandler(createGeneration));

// 3. NEW: Wiro AI Image Generation Route
router.post('/wiro-image', generationRateLimiter, auditAction('generation.wiro'), asyncHandler(async (req, res) => {
    const { prompt } = req.body;
    const wiroApiKey = process.env.WIRO_API_KEY;
    const userId = req.user.id; // Extracted safely from requireAuth middleware

    if (!wiroApiKey) {
        return res.status(500).json({ success: false, error: 'Wiro API key is missing on the server' });
    }

    if (!prompt) {
        return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    // 1. Submit the task to Wiro AI
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('resolution', '1k');
    formData.append('ratio', '1:1');
    formData.append('outputFormat', 'png');
    
    const runResponse = await fetch('https://api.wiro.ai/v1/Run/openai/gpt-image-2-5-flare', {
        method: 'POST',
        headers: { 'x-api-key': wiroApiKey },
        body: formData
    });
    
    const runData = await runResponse.json();
    
    if (!runData.result) {
        return res.status(500).json({ success: false, error: 'Failed to start Wiro image generation' });
    }

    const taskToken = runData.socketaccesstoken;

    // 2. Poll the Task Detail endpoint
    let isComplete = false;
    let imageUrl = null;

    while (!isComplete) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const detailResponse = await fetch('https://api.wiro.ai/v1/Task/Detail', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': wiroApiKey
            },
            body: JSON.stringify({ tasktoken: taskToken })
        });

        const detailData = await detailResponse.json();
        const taskInfo = detailData.tasklist[0];

        if (taskInfo && taskInfo.pexit === "0") {
            isComplete = true;
            if (taskInfo.outputs && taskInfo.outputs.length > 0) {
                imageUrl = taskInfo.outputs[0].url; 
            } else {
                throw new Error("No image output returned from provider.");
            }
        } else if (taskInfo && taskInfo.pexit === "1") {
            throw new Error("Image generation failed at provider.");
        }
    }

    // 3. (Optional) You can insert the generation into your PostgreSQL database here 
    // using userId so it doesn't throw the NULL USER_ID constraint error you saw earlier.
    
    // 4. Return the result to the frontend
    res.json({ success: true, imageUrl: imageUrl });
}));

module.exports = router;
