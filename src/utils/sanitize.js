const sanitizeHtml = require('sanitize-html');

const cleanString = (value) => {
  if (typeof value !== 'string') return value;
  const sanitized = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  return sanitized.replace(/\s+/g, ' ').trim();
};

const cleanStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean).slice(0, 10);
};

const cleanJson = (value) => {
  if (Array.isArray(value)) return value.map(cleanJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cleanJson(nested)]));
  }
  return cleanString(value);
};

module.exports = { cleanString, cleanStringArray, cleanJson };
