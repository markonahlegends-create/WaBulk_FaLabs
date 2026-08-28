export const environment = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  redisUrl: process.env.REDIS_URL || null,
  databasePath: process.env.DATABASE_PATH || './data/wabulk.db',
  shopee: {
    appId: process.env.SHOPEE_APP_ID || '',
    secret: process.env.SHOPEE_AFFILIATE_SECRET || '',
    region: process.env.SHOPEE_REGION || 'id',
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
    whatsappBusinessId: process.env.FACEBOOK_WHATSAPP_BUSINESS_ID || '',
    graphApiVersion: process.env.FACEBOOK_GRAPH_API_VERSION || 'v18.0',
  },
  safety: {
    maxMessagesPerDay: parseInt(process.env.MAX_MESSAGES_PER_DAY || '50', 10),
    maxMessagesPerHour: parseInt(process.env.MAX_MESSAGES_PER_HOUR || '10', 10),
    minDelayBetweenMessagesMs: parseInt(process.env.MIN_DELAY_BETWEEN_MESSAGES_MS || '5000', 10),
    maxDelayBetweenMessagesMs: parseInt(process.env.MAX_DELAY_BETWEEN_MESSAGES_MS || '30000', 10),
    warmupStartDay: parseInt(process.env.WARMUP_START_DAY || '1', 10),
    warmupEndDay: parseInt(process.env.WARMUP_END_DAY || '14', 10),
    warmupStartLimit: parseInt(process.env.WARMUP_START_LIMIT || '5', 10),
    warmupEndLimit: parseInt(process.env.WARMUP_END_LIMIT || '50', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change_me_in_production',
    encryptionKey: process.env.ENCRYPTION_KEY || 'change_me_32_characters_here!!',
  },
} as const;

export type Environment = typeof environment;
