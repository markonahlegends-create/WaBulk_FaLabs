import { makeWASocket, useMultiFileAuthState, DisconnectReason, ConnectionState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { environment } from '../config/env';
import { logger } from '../utils/logger';
import { database } from '../database/db';
import { rateLimiter } from './rateLimiter';
import { Contact, MessageLog, SessionState } from '../types';

const SESSION_ID = 'default';
const AUTH_DIR = path.join(process.cwd(), 'auth_info');

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock: any = null;
let connectionState: ConnectionState | null = null;
let isConnecting = false;
let connectionPromise: Promise<void> | null = null;

export class WhatsAppService {
  private sessionId: string;
  private onMessageCallback?: (message: any) => Promise<void>;

  constructor(sessionId: string = SESSION_ID) {
    this.sessionId = sessionId;
  }

  async connect(): Promise<void> {
    if (sock) {
      return connectionPromise || Promise.resolve();
    }

    if (isConnecting) {
      return connectionPromise || Promise.resolve();
    }

    isConnecting = true;
    connectionPromise = this._connect();
    return connectionPromise;
  }

  private async _connect(): Promise<void> {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const session = database.getSession(this.sessionId);
      if (session?.phone) {
        logger.info(`Resuming WhatsApp session for ${session.phone}`);
      }

      sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['WA Bulk', 'Chrome', '1.0.0'],
        getMessage: async (key: any) => {
          return undefined;
        },
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          database.saveSession({ id: this.sessionId, qrCode: qr, connected: false, createdAt: new Date().toISOString() });
          logger.info('QR code received. Scan with WhatsApp app.');

          try {
            const QRCode = await import('qrcode-terminal');
            console.log('\n========================================');
            console.log('QR Code received. Scan with WhatsApp:');
            console.log('========================================\n');
            QRCode.default.generate(qr, { small: true });
            console.log('\n========================================\n');
          } catch (error) {
            console.log('\n========================================');
            console.log('QR Code received. Scan with WhatsApp:');
            console.log('QR URL: https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr));
            console.log('========================================\n');
          }
        }

        if (connection === 'open') {
          const phone = sock.user?.id?.split(':')[0] || 'unknown';
          database.saveSession({ id: this.sessionId, phone, connected: true, lastConnectedAt: new Date().toISOString(), createdAt: new Date().toISOString() });
          logger.info(`WhatsApp connected: ${phone}`);
          connectionState = { connection: 'open' };
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          logger.warn({ shouldReconnect }, 'WhatsApp connection closed');
          database.saveSession({ id: this.sessionId, connected: false, createdAt: new Date().toISOString() });
          connectionState = { connection: 'close' };

          if (shouldReconnect) {
            logger.info('Attempting to reconnect...');
            sock = null;
            connectionPromise = null;
            isConnecting = false;
            setTimeout(() => this.connect(), 3000);
          } else {
            logger.info('Logged out. Please scan QR again.');
            sock = null;
            connectionPromise = null;
            isConnecting = false;
          }
        }
      });

      sock.ev.on('messages.upsert', async ({ messages, type }: { messages: any[]; type: string }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const phone = msg.key.remoteJid;
          const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

          if (text.toLowerCase().match(/^(stop|berhenti|unsubscribe|keluar|stop marketing|opt out)$/)) {
            database.addToOptOut(phone, 'User requested');
            await this.sendMessage(phone, '✅ Anda telah berhenti berlangganan. Anda tidak akan menerima pesan promosi lagi.');
            logger.info(`Contact opted out: ${phone}`);
            continue;
          }

          if (this.onMessageCallback) {
            try {
              await this.onMessageCallback(msg);
            } catch (error) {
              logger.error({ error }, 'Error in message callback');
            }
          }
        }
      });
    } catch (error) {
      logger.error({ error }, 'Failed to connect WhatsApp');
      sock = null;
      connectionPromise = null;
      isConnecting = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (sock) {
      try {
        await sock.end();
      } catch (error) {
        logger.error({ error }, 'Error disconnecting');
      }
      sock = null;
      connectionPromise = null;
      isConnecting = false;
    }
  }

  async sendMessage(phone: string, text: string): Promise<MessageLog> {
    if (!sock) {
      throw new Error('WhatsApp not connected');
    }

    if (rateLimiter.isOptedOut(phone)) {
      throw new Error('Contact opted out');
    }

    const rateLimit = rateLimiter.checkWarmupLimit(this.sessionId);
    if (!rateLimit.allowed) {
      throw new Error(`Warmup limit: ${rateLimit.reason}`);
    }

    const rateLimit2 = rateLimiter.canSend(phone);
    if (!rateLimit2.allowed) {
      throw new Error(`Rate limited: ${rateLimit2.reason}`);
    }

    try {
      const jid = this.normalizeJid(phone);
      const result = await sock.sendMessage(jid, { text });

      rateLimiter.recordSent(phone);
      rateLimiter.recordWarmupSent(this.sessionId);

      const log = database.createMessageLog({
        phone,
        direction: 'outbound',
        status: 'sent',
        content: text,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      database.upsertContact({
        phone,
        source: 'manual',
        tags: [],
        optedIn: true,
        optedInAt: new Date().toISOString(),
        optedOut: false,
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      logger.info({ phone, messageId: result?.key?.id }, 'Message sent');
      return log;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const log = database.createMessageLog({
        phone,
        direction: 'outbound',
        status: 'failed',
        errorMessage,
        content: text,
        createdAt: new Date().toISOString(),
      });

      logger.error({ error, phone }, 'Failed to send message');
      return log;
    }
  }

  async sendMedia(phone: string, media: Buffer, type: 'image' | 'document', filename?: string, caption?: string): Promise<MessageLog> {
    if (!sock) throw new Error('WhatsApp not connected');

    const rateLimit = rateLimiter.canSend(phone);
    if (!rateLimit.allowed) {
      throw new Error(`Rate limited: ${rateLimit.reason}`);
    }

    try {
      const jid = this.normalizeJid(phone);
      const message: any = type === 'image' ? { image: media, caption } : { document: media, fileName: filename, mimetype: 'application/pdf' };

      const result = await sock.sendMessage(jid, message);
      rateLimiter.recordSent(phone);

      const log = database.createMessageLog({
        phone,
        direction: 'outbound',
        status: 'sent',
        content: caption || `[${type}]`,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      return log;
    } catch (error) {
      const log = database.createMessageLog({
        phone,
        direction: 'outbound',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date().toISOString(),
      });
      return log;
    }
  }

  async sendMediaUrl(phone: string, mediaUrl: string, type: 'image' | 'document', caption?: string, link?: string): Promise<MessageLog> {
    if (!sock) throw new Error('WhatsApp not connected');

    const rateLimit = rateLimiter.canSend(phone);
    if (!rateLimit.allowed) {
      throw new Error(`Rate limited: ${rateLimit.reason}`);
    }

    try {
      const jid = this.normalizeJid(phone);

      const response = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(response.data);

      const fullCaption = link ? `${caption || ''}\n\nLink: ${link}` : caption;

      const message: any = type === 'image' ? { image: buffer, caption: fullCaption } : { document: buffer, fileName: 'file', mimetype: 'application/octet-stream' };

      const result = await sock.sendMessage(jid, message);
      rateLimiter.recordSent(phone);

      const log = database.createMessageLog({
        phone,
        direction: 'outbound',
        status: 'sent',
        content: fullCaption || `[${type}]`,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      logger.info({ phone, messageId: result?.key?.id, mediaUrl }, 'Media URL sent');
      return log;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const log = database.createMessageLog({
        phone,
        direction: 'outbound',
        status: 'failed',
        errorMessage,
        content: caption || '',
        createdAt: new Date().toISOString(),
      });

      logger.error({ error, phone, mediaUrl }, 'Failed to send media URL');
      return log;
    }
  }

  async getGroups(): Promise<{ id: string; name: string }[]> {
    if (!sock) {
      throw new Error('WhatsApp not connected');
    }

    try {
      const result = await sock.groupFetchAllParticipating();
      const groups = Object.values(result).map((group: any) => ({
        id: group.id,
        name: group.subject || 'Unnamed Group',
      }));

      logger.info({ count: groups.length }, 'Groups fetched');
      return groups;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch groups');
      throw error;
    }
  }

  async sendGroupMessage(groupId: string, message: string, mediaUrl?: string, caption?: string): Promise<MessageLog> {
    if (!sock) {
      throw new Error('WhatsApp not connected');
    }

    const normalizedGroupId = this.normalizeGroupJid(groupId);

    try {
      let result: any;
      if (mediaUrl) {
        const response = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const buffer = Buffer.from(response.data);
        const isImage = mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)/i);
        const messageType = isImage ? 'image' : 'document';

        result = await sock.sendMessage(normalizedGroupId, {
          [messageType]: buffer,
          caption: caption || message,
          fileName: 'file',
          mimetype: isImage ? 'image/jpeg' : 'application/octet-stream',
        });
      } else {
        result = await sock.sendMessage(normalizedGroupId, { text: message });
      }

      const log = database.createMessageLog({
        phone: normalizedGroupId,
        direction: 'outbound',
        status: 'sent',
        content: caption || message,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      logger.info({ groupId: normalizedGroupId, messageId: result?.key?.id }, 'Group message sent');
      return log;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const log = database.createMessageLog({
        phone: normalizedGroupId,
        direction: 'outbound',
        status: 'failed',
        errorMessage,
        content: caption || message,
        createdAt: new Date().toISOString(),
      });

      logger.error({ error, groupId: normalizedGroupId }, 'Failed to send group message');
      return log;
    }
  }

  onMessage(callback: (message: any) => Promise<void>): void {
    this.onMessageCallback = callback;
  }

  getConnectionState(): ConnectionState | null {
    return connectionState;
  }

  isConnected(): boolean {
    return connectionState?.connection === 'open';
  }

  getSessionInfo(): SessionState | undefined {
    return database.getSession(this.sessionId);
  }

  private normalizeJid(phone: string): string {
    let normalized = phone.replace(/\D/g, '');

    if (normalized.startsWith('0')) {
      normalized = '62' + normalized.substring(1);
    }

    if (!normalized.endsWith('@s.whatsapp.net')) {
      normalized = `${normalized}@s.whatsapp.net`;
    }

    return normalized;
  }

  private normalizeGroupJid(groupId: string): string {
    let normalized = groupId.trim();

    if (!normalized.includes('@')) {
      normalized = `${normalized}@g.us`;
    } else if (!normalized.endsWith('@g.us')) {
      normalized = normalized.replace(/@.*$/, '@g.us');
    }

    return normalized;
  }
}

export const whatsAppService = new WhatsAppService();
