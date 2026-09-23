const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanString, cleanStringArray, cleanJson } = require('../src/utils/sanitize');
const { resolveGenerationCosts, calculateExpiryDate } = require('../src/services/generation.service');
const { shouldCleanupGeneration } = require('../src/jobs/cleanup.job');

test('cleanString strips HTML and normalizes whitespace', () => {
  assert.equal(cleanString(' <script>alert(1)</script> hi   there '), 'hi there');
});

test('cleanStringArray keeps only cleaned non-empty tags', () => {
  assert.deepEqual(cleanStringArray([' neon ', '', '<b>dream</b>']), ['neon', 'dream']);
});

test('cleanJson recursively sanitizes nested values', () => {
  assert.deepEqual(cleanJson({ prompt: '<img src=x onerror=1>sky', nested: [' a ', '<b>b</b>'] }), { prompt: 'sky', nested: ['a', 'b'] });
});

test('resolveGenerationCosts respects configured settings', () => {
  assert.deepEqual(resolveGenerationCosts({ credit_cost_image: 1, credit_cost_video: 2, credit_cost_chat: 3 }), { image: 1, video: 2, chat: 3 });
});

test('calculateExpiryDate defaults into the future', () => {
  const expiresAt = calculateExpiryDate(7);
  assert.ok(expiresAt > new Date());
});

test('shouldCleanupGeneration only returns true for expired active assets', () => {
  const now = new Date('2026-01-08T00:00:00.000Z');
  assert.equal(shouldCleanupGeneration({ expiresAt: '2026-01-07T00:00:00.000Z', isDeleted: false }, now), true);
  assert.equal(shouldCleanupGeneration({ expiresAt: '2026-01-09T00:00:00.000Z', isDeleted: false }, now), false);
  assert.equal(shouldCleanupGeneration({ expiresAt: '2026-01-07T00:00:00.000Z', isDeleted: true }, now), false);
});
