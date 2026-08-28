import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { environment } from '../config/env';

const logDir = environment.logging.dir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFilePath = path.join(logDir, 'app.log');

const logger = pino(
  {
    level: environment.logging.level,
  },
  fs.existsSync(logFilePath)
    ? fs.createWriteStream(logFilePath, { flags: 'a' })
    : fs.createWriteStream(logFilePath, { flags: 'w' })
);

export { logger };
