const { verifyAccessToken } = require('../utils/jwt');
const { AUTH_COOKIE_NAME, parseCookies } = require('../utils/auth-cookie');

let io = null;

const registerSocketServer = (socketServer) => {
  io = socketServer;

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        || parseCookies(socket.handshake.headers.cookie || '')[AUTH_COOKIE_NAME];
      if (!token) return next(new Error('Unauthorized socket'));
      socket.user = verifyAccessToken(token);
      return next();
    } catch (error) {
      return next(new Error('Unauthorized socket'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.user?.sub) {
      socket.join(`user:${socket.user.sub}`);
    }
  });
};

const emitGenerationUpdate = (userId, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit('generation:update', payload);
};

module.exports = { registerSocketServer, emitGenerationUpdate };
