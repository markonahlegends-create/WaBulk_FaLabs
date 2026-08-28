import axios, { AxiosInstance } from 'axios';
import { environment } from '../config/env';
import { logger } from '../utils/logger';

export interface FacebookContact {
  id: string;
  name: string;
  phone?: string;
}

export interface FacebookMessageResult {
  messageId: string;
  recipientId: string;
}

export class FacebookIntegrationService {
  private client: AxiosInstance;
  private accessToken: string;
  private businessId: string;
  private graphVersion: string;

  constructor() {
    this.accessToken = environment.facebook.pageAccessToken;
    this.businessId = environment.facebook.whatsappBusinessId;
    this.graphVersion = environment.facebook.graphApiVersion;

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${this.graphVersion}`,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  isConfigured(): boolean {
    return !!(this.accessToken && this.businessId);
  }

  async sendTemplateMessage(phone: string, templateName: string, languageCode: string = 'id_ID', components: any[] = []): Promise<FacebookMessageResult> {
    if (!this.isConfigured()) {
      throw new Error('Facebook WhatsApp Business API not configured');
    }

    const phoneNumberId = this.businessId;
    const url = `/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    try {
      const response = await this.client.post(url, payload, {
        params: { access_token: this.accessToken },
      });

      const messageId = response.data?.messages?.[0]?.id;
      logger.info({ phone, templateName, messageId }, 'Facebook template message sent');
      return { messageId, recipientId: phone };
    } catch (error) {
      logger.error({ error, phone, templateName }, 'Failed to send Facebook template message');
      throw error;
    }
  }

  async sendTextMessage(phone: string, text: string, previewUrl: boolean = false): Promise<FacebookMessageResult> {
    if (!this.isConfigured()) {
      throw new Error('Facebook WhatsApp Business API not configured');
    }

    const phoneNumberId = this.businessId;
    const url = `/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: text,
      },
    };

    try {
      const response = await this.client.post(url, payload, {
        params: { access_token: this.accessToken },
      });

      const messageId = response.data?.messages?.[0]?.id;
      logger.info({ phone, messageId }, 'Facebook text message sent');
      return { messageId, recipientId: phone };
    } catch (error) {
      logger.error({ error, phone }, 'Failed to send Facebook text message');
      throw error;
    }
  }

  async sendMediaMessage(phone: string, mediaType: 'image' | 'document', mediaUrl: string, caption?: string): Promise<FacebookMessageResult> {
    if (!this.isConfigured()) {
      throw new Error('Facebook WhatsApp Business API not configured');
    }

    const phoneNumberId = this.businessId;
    const url = `/${phoneNumberId}/messages`;

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: mediaType,
      [mediaType]: { link: mediaUrl },
    };

    if (caption && mediaType === 'image') {
      payload.image.caption = caption;
    }

    try {
      const response = await this.client.post(url, payload, {
        params: { access_token: this.accessToken },
      });

      const messageId = response.data?.messages?.[0]?.id;
      logger.info({ phone, mediaType, mediaUrl, messageId }, 'Facebook media message sent');
      return { messageId, recipientId: phone };
    } catch (error) {
      logger.error({ error, phone, mediaType }, 'Failed to send Facebook media message');
      throw error;
    }
  }

  async getPhoneNumberId(): Promise<string | null> {
    if (!this.isConfigured()) return null;
    return this.businessId;
  }

  async verifyWebhook(mode: string, token: string, challenge: string): Promise<{ success: boolean; challenge?: string }> {
    const verifyToken = environment.security.jwtSecret;
    if (mode === 'subscribe' && token === verifyToken) {
      return { success: true, challenge };
    }
    return { success: false };
  }
}

export const facebookIntegration = new FacebookIntegrationService();
