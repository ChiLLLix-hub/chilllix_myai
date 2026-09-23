const { verifyAccessToken } = require('../utils/jwt');

let io = null;

const registerSocketServer = (socketServer) => {
  io = socketServer;

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next();
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
