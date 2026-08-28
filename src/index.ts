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

    startDashboardServer();
    logger.info('Dashboard server started');

    logger.info(`Dashboard: http://0.0.0.0:${environment.port}`);

    whatsAppService.connect().catch((error) => {
      logger.error({ error }, 'WhatsApp service failed to start');
    });

    logger.info('All services started successfully');
    logger.info('Press Ctrl+C to stop');
  } catch (error) {
    logger.error({ error }, 'Failed to start application');
    process.exit(1);
  }
}

main();
