const http = require('http');
const { Server } = require('socket.io');
const env = require('./config/env');
const { sequelize } = require('./config/database');
const { app } = require('./app');
const { registerSocketServer } = require('./services/socket.service');
const { registerProcessor } = require('./services/queue.service');
const { processGenerationJob } = require('./jobs/generation.job');
const { startCleanupJob } = require('./jobs/cleanup.job');

const start = async () => {
  if (sequelize) {
    try {
      await sequelize.authenticate();
      console.log('Database connection verified');
    } catch (error) {
      console.error('Database connection failed', error.message);
    }
  } else {
    console.warn('DATABASE_URL is not configured; database features are disabled');
  }

  registerProcessor(processGenerationJob);
  startCleanupJob();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: env.frontendOrigin, methods: ['GET', 'POST'], credentials: true },
  });
  registerSocketServer(io);

  server.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });
};

start().catch((error) => {
  console.error('Startup failed', error);
  process.exit(1);
});
