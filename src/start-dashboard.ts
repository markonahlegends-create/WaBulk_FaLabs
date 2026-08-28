import 'dotenv/config';
import { environment } from './config/env';
import { logger } from './utils/logger';
import { database } from './database/db';
import { whatsAppService } from './services/whatsAppService';
import { startDashboardServer } from './dashboard/server';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    console.log('Starting WA Bulk Dashboard...');
    console.log(`Environment: ${environment.nodeEnv}`);

    const dirs = [
      path.dirname(environment.databasePath),
      path.join(process.cwd(), 'auth_info'),
      environment.logging.dir,
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    await database.init();
    console.log('Database initialized');

    startDashboardServer();
    console.log(`Dashboard available at http://0.0.0.0:${environment.port}`);

    whatsAppService.connect().catch((error) => {
      console.error('WhatsApp service failed to start:', error);
    });

    console.log('QR code akan muncul di dashboard atau terminal.');

    const gracefulShutdown = (signal: string) => {
      console.log(`${signal} received, shutting down gracefully...`);
      whatsAppService.disconnect().then(() => {
        console.log('WhatsApp disconnected');
        process.exit(0);
      }).catch((err) => {
        console.error('Error during shutdown:', err);
        process.exit(1);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
