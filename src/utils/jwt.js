const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccessToken = (user) => jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.jwtSecret, { expiresIn: '12h' });
const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);

module.exports = { signAccessToken, verifyAccessToken };
