import { environment } from '../config/env';
import { logger } from '../utils/logger';
import { database } from './db';

export async function initializeDatabase(): Promise<any> {
  try {
    await database.init();
    return true;
  } catch (error) {
    logger.error({ error }, 'Database initialization failed');
    return null;
  }
}

export function getDatabase(): any {
  return database;
}
