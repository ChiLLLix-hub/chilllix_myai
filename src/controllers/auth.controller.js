const { registerUser, loginUser, createGuestUser } = require('../services/auth.service');

const serializeUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl,
  creditsBalance: user.creditsBalance,
  isSuspended: user.isSuspended,
  createdAt: user.createdAt,
});

const register = async (req, res) => {
  const { email, password } = req.validated.body;
  const result = await registerUser({ email, password });
  res.status(201).json({ token: result.token, user: serializeUser(result.user) });
};

const login = async (req, res) => {
  const { email, password } = req.validated.body;
  const result = await loginUser({ email, password });
  res.json({ token: result.token, user: serializeUser(result.user) });
};

const guest = async (req, res) => {
  const result = await createGuestUser({ guestSessionId: req.body?.guestSessionId });
  res.status(201).json({ guestSessionId: result.guestSessionId, token: result.token, user: serializeUser(result.user) });
};

module.exports = { register, login, guest, serializeUser };
