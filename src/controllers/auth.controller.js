const { User } = require('../models');
const { registerUser, loginUser } = require('../services/auth.service');
const { setAuthCookie, clearAuthCookie } = require('../utils/auth-cookie');
const { getRequestContext } = require('../utils/request-context');
const { HttpError } = require('../utils/http-error');

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
  const result = await registerUser({ email, password, context: getRequestContext(req) });
  setAuthCookie(res, result.token);
  res.status(201).json({ user: serializeUser(result.user) });
};

const login = async (req, res) => {
  const { email, password } = req.validated.body;
  const result = await loginUser({ email, password, context: getRequestContext(req) });
  setAuthCookie(res, result.token);
  res.json({ user: serializeUser(result.user) });
};

const logout = async (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
};

const session = async (req, res) => {
  if (!User) throw new HttpError(503, 'Database is not configured');
  const user = await User.findByPk(req.user.sub);
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user: serializeUser(user) });
};

module.exports = { register, login, logout, session, serializeUser };
