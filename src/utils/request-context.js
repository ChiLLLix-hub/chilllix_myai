const parseLocation = (value) => {
  if (!value || typeof value !== 'object') return { latitude: null, longitude: null };
  const latitude = value.latitude === null || value.latitude === undefined ? null : Number(value.latitude);
  const longitude = value.longitude === null || value.longitude === undefined ? null : Number(value.longitude);
  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
};

const getRequestContext = (req) => ({
  ipAddress: req.ip,
  userAgent: req.get('user-agent') || '',
  location: parseLocation(req.validated?.body?.location || req.body?.location),
});

module.exports = { parseLocation, getRequestContext };
