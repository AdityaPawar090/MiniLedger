import { app } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`MiniLedger Backend API running on port ${env.PORT}`);
  console.log(`Health check: http://localhost:${env.PORT}/api/health`);
  console.log(`Environment:  ${env.NODE_ENV}`);
  console.log('====================================================');
});

async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await prisma.$disconnect();
    console.log('Prisma disconnected.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
