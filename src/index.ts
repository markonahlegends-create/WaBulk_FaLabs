import 'dotenv/config';
import { environment } from './config/env';
import { logger } from './utils/logger';
import { database } from './database/db';
import { whatsAppService } from './services/whatsAppService';
import { campaignScheduler } from './services/campaignScheduler';
import { startDashboardServer } from './dashboard/server';

async function main() {
  try {
    logger.info('Starting WA Bulk / WA Boss...');
    logger.info(`Environment: ${environment.nodeEnv}`);

    await database.init();
    logger.info('Database initialized');

    await whatsAppService.connect();
    logger.info('WhatsApp service started');

    startDashboardServer();
    logger.info('Dashboard server started');

    logger.info('All services started successfully');
    logger.info(`Dashboard: http://localhost:${environment.port}`);
    logger.info('Press Ctrl+C to stop');
  } catch (error) {
    logger.error({ error }, 'Failed to start application');
    process.exit(1);
  }
}

main();
