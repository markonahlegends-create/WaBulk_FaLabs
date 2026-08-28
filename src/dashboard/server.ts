import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { environment } from '../config/env';
import { logger } from '../utils/logger';
import { whatsAppService } from '../services/whatsAppService';
import { database } from '../database/db';
import { shopeeAffiliate } from '../services/shopeeAffiliate';
import { facebookIntegration } from '../services/facebookIntegration';
import { campaignScheduler } from '../services/campaignScheduler';
import { safetyService } from '../services/safetyService';
import { Campaign, Contact, MessageTemplate, MessageLog, AffiliateProduct } from '../types';

import path from 'path';

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.substring(7);
  if (token !== environment.security.jwtSecret || environment.security.jwtSecret === 'change_me_in_production') {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  next();
};

app.get('/api/health', (req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    whatsapp: whatsAppService.isConnected(),
    facebook: facebookIntegration.isConfigured(),
    shopee: !!(environment.shopee.appId && environment.shopee.secret),
  });
});

app.get('/api/whatsapp/status', (req: Request, res: Response): void => {
  const session = whatsAppService.getSessionInfo();
  res.json({
    connected: whatsAppService.isConnected(),
    session: session ? { id: session.id, phone: session.phone, lastConnectedAt: session.lastConnectedAt, qrCode: session.qrCode } : null,
  });
});

app.get('/api/whatsapp/qr', (req: Request, res: Response): void => {
  const session = whatsAppService.getSessionInfo();
  if (session?.qrCode) {
    res.json({ qr: session.qrCode });
  } else {
    res.status(404).json({ error: 'QR code not available' });
  }
});

app.post('/api/whatsapp/connect', async (req: Request, res: Response): Promise<void> => {
  try {
    await whatsAppService.connect();
    res.json({ success: true, message: 'Connecting to WhatsApp...' });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Connection failed' });
  }
});

app.post('/api/whatsapp/send', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      res.status(400).json({ success: false, error: 'Phone and message are required' });
      return;
    }

    if (!safetyService.validatePhoneNumber(phone)) {
      res.status(400).json({ success: false, error: 'Invalid phone number format' });
      return;
    }

    const validation = safetyService.validateMessageContent(message);
    if (!validation.valid) {
      res.status(400).json({ success: false, warnings: validation.warnings, error: 'Message validation failed' });
      return;
    }

    const normalizedPhone = safetyService.normalizePhone(phone);
    const log = await whatsAppService.sendMessage(normalizedPhone, message);

    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send message' });
  }
});

app.post('/api/whatsapp/send-media', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, mediaUrl, mediaType, caption, link } = req.body;

    if (!phone || !mediaUrl) {
      res.status(400).json({ success: false, error: 'Phone and media URL are required' });
      return;
    }

    if (!safetyService.validatePhoneNumber(phone)) {
      res.status(400).json({ success: false, error: 'Invalid phone number format' });
      return;
    }

    const normalizedPhone = safetyService.normalizePhone(phone);
    const log = await whatsAppService.sendMediaUrl(normalizedPhone, mediaUrl, mediaType || 'image', caption, link);

    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send media' });
  }
});

app.post('/api/whatsapp/send-bulk', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phones, message, templateId } = req.body;

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      res.status(400).json({ success: false, error: 'Phones array is required' });
      return;
    }

    if (phones.length > 100) {
      res.status(400).json({ success: false, error: 'Maximum 100 phones per request' });
      return;
    }

    const validation = safetyService.validateMessageContent(message);
    if (!validation.valid) {
      res.status(400).json({ success: false, warnings: validation.warnings });
      return;
    }

    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const phone of phones) {
      try {
        const normalizedPhone = safetyService.normalizePhone(phone);
        const log = await whatsAppService.sendMessage(normalizedPhone, message);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ phone, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send bulk messages' });
  }
});

app.get('/api/contacts', (req: Request, res: Response): void => {
  try {
    const { optedIn, optedOut, tags } = req.query;
    const contacts = database.getContacts({
      optedIn: optedIn === 'true' ? true : optedIn === 'false' ? false : undefined,
      optedOut: optedOut === 'true' ? true : optedOut === 'false' ? false : undefined,
      tags: tags ? [String(tags)] : undefined,
    });
    res.json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch contacts' });
  }
});

app.post('/api/contacts', (req: Request, res: Response): void => {
  try {
    const { phone, name, source, tags } = req.body;

    if (!phone) {
      res.status(400).json({ success: false, error: 'Phone is required' });
      return;
    }

    const normalizedPhone = safetyService.normalizePhone(phone);

    const contact = database.upsertContact({
      phone: normalizedPhone,
      name,
      source: source || 'manual',
      tags: tags || [],
      optedIn: true,
      optedInAt: new Date().toISOString(),
      optedOut: false,
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create contact' });
  }
});

app.get('/api/contacts/export', (req: Request, res: Response): void => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const contacts = database.getContacts();

    if (format === 'csv') {
      const BOM = '\uFEFF';
      const headers = 'ID,Phone,Name,Source,Tags,OptedIn,OptedOut,MessageCount,CreatedAt\n';
      const rows = contacts.map(c => [
        c.id,
        c.phone,
        c.name || '',
        c.source || '',
        JSON.stringify(c.tags || []),
        c.optedIn ? 'Ya' : 'Tidak',
        c.optedOut ? 'Ya' : 'Tidak',
        c.messageCount || 0,
        c.createdAt || ''
      ].map(v => `"${String(v).replace(/\"/g, '""')}"`).join(','));

      const csv = BOM + headers + rows.join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      res.send(csv);
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.json"');
    res.json({ success: true, data: contacts, exportedAt: new Date().toISOString(), total: contacts.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to export contacts' });
  }
});

app.post('/api/contacts/import', (req: Request, res: Response): void => {
  try {
    const { contacts, format } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      res.status(400).json({ success: false, error: 'Contacts array is required' });
      return;
    }

    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const contact of contacts) {
      try {
        const phone = contact.phone || contact.nomor || contact.nomor_wa;
        if (!phone) {
          results.failed++;
          results.errors.push({ contact, error: 'Phone number is required' });
          continue;
        }

        database.upsertContact({
          phone,
          name: contact.name || contact.nama || '',
          source: contact.source || 'import',
          tags: Array.isArray(contact.tags) ? contact.tags : contact.tags ? String(contact.tags).split(',').map((t: string) => t.trim()).filter(Boolean) : [],
          optedIn: true,
          optedInAt: new Date().toISOString(),
          optedOut: false,
          messageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ contact, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    res.json({ success: true, results, message: `Imported ${results.success} contacts, ${results.failed} failed` });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to import contacts' });
  }
});

app.delete('/api/contacts/:id', (req: Request, res: Response): void => {
  try {
    const id = parseInt(req.params.id, 10);
    const contact = database.getContactById(id);
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }

    const deleted = database.deleteContact(id);
    if (deleted) {
      res.json({ success: true, message: 'Contact deleted' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to delete contact' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete contact' });
  }
});

app.get('/api/campaigns', (req: Request, res: Response): void => {
  try {
    const { status } = req.query;
    const campaigns = database.getCampaigns(status ? { status: String(status) } : undefined);
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch campaigns' });
  }
});

app.post('/api/campaigns', (req: Request, res: Response): void => {
  try {
    const {
      name,
      type,
      templateId,
      contactListIds,
      targetMode,
      targetTag,
      manualPhones,
      message,
      mediaUrl,
      mediaType,
      caption,
      link,
      scheduleAt,
    } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Nama kampanye wajib diisi' });
      return;
    }

    if (targetMode === 'manual' && (!manualPhones || manualPhones.length === 0)) {
      res.status(400).json({ success: false, error: 'Pilih minimal satu kontak atau gunakan mode target lain' });
      return;
    }

    const campaign = database.createCampaign({
      name,
      status: 'draft',
      type: type || 'text',
      templateId,
      contactListIds: contactListIds || [],
      targetMode: targetMode || 'all',
      targetTag,
      manualPhones,
      message,
      mediaUrl,
      mediaType: mediaType || 'image',
      caption,
      link,
      scheduleAt,
      totalContacts: 0,
      sentCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create campaign' });
  }
});

app.post('/api/campaigns/:id/start', (req: Request, res: Response): void => {
  try {
    const campaign = database.getCampaign(parseInt(req.params.id, 10));
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    campaignScheduler.startCampaign(campaign);
    res.json({ success: true, message: 'Campaign started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to start campaign' });
  }
});

app.post('/api/campaigns/:id/stop', (req: Request, res: Response): void => {
  try {
    campaignScheduler.stopCampaign(parseInt(req.params.id, 10));
    res.json({ success: true, message: 'Campaign stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to stop campaign' });
  }
});

app.get('/api/templates', (req: Request, res: Response): void => {
  try {
    const templates = database.getTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch templates' });
  }
});

app.post('/api/templates', (req: Request, res: Response): void => {
  try {
    const { name, content, category, variables } = req.body;

    if (!name || !content) {
      res.status(400).json({ success: false, error: 'Name and content are required' });
      return;
    }

    const validation = safetyService.validateMessageContent(content);
    if (!validation.valid) {
      res.status(400).json({ success: false, warnings: validation.warnings });
      return;
    }

    const template = database.createTemplate({
      name,
      content,
      category: category || 'marketing',
      variables: variables || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create template' });
  }
});

app.get('/api/messages/logs', (req: Request, res: Response): void => {
  try {
    const { campaignId, phone, status } = req.query;
    const logs = database.getMessageLogs({
      campaignId: campaignId ? parseInt(String(campaignId), 10) : undefined,
      phone: phone ? String(phone) : undefined,
      status: status ? String(status) : undefined,
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch message logs' });
  }
});

app.get('/api/activity', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const activities: any[] = [];

    const logs = database.getMessageLogs().slice(0, limit);
    for (const log of logs) {
      activities.push({
        type: log.status === 'failed' ? 'error' : 'message',
        title: log.status === 'sent' ? 'Pesan Terkirim' : log.status === 'failed' ? 'Gagal Kirim' : 'Pesan',
        description: `Ke ${log.phone}${log.content ? `: "${log.content.slice(0, 50)}${log.content.length > 50 ? '...' : ''}"` : ''}`,
        time: log.createdAt,
        status: log.status,
      });
    }

    const contacts = database.getContacts().slice(0, limit);
    for (const contact of contacts) {
      activities.push({
        type: 'contact',
        title: 'Kontak Ditambahkan',
        description: `${contact.phone}${contact.name ? ` (${contact.name})` : ''}`,
        time: contact.createdAt,
        status: contact.optedIn ? 'opted-in' : 'opted-out',
      });
    }

    const campaigns = database.getCampaigns().slice(0, limit);
    for (const campaign of campaigns) {
      activities.push({
        type: 'campaign',
        title: `Kampanye ${campaign.status === 'running' ? 'Berjalan' : campaign.status === 'completed' ? 'Selesai' : 'Dibuat'}`,
        description: campaign.name,
        time: campaign.createdAt,
        status: campaign.status,
      });
    }

    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const sliced = activities.slice(0, limit);

    res.json({ success: true, data: sliced });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch activity' });
  }
});

app.get('/api/shopee/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyword, limit, category, minCommission } = req.query;

    if (!keyword) {
      res.status(400).json({ success: false, error: 'Keyword is required' });
      return;
    }

    const products = await shopeeAffiliate.searchProducts(
      String(keyword),
      parseInt(String(limit || '20'), 10)
    );

    let filtered = products;
    if (category) {
      filtered = filtered.filter(p => p.category === String(category));
    }
    if (minCommission) {
      filtered = filtered.filter(p => p.commissionRate >= parseFloat(String(minCommission)));
    }

    res.json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch products' });
  }
});

app.post('/api/shopee/generate-link', async (req: Request, res: Response): Promise<void> => {
  try {
    const { originUrl, subId } = req.body;

    if (!originUrl) {
      res.status(400).json({ success: false, error: 'Origin URL is required' });
      return;
    }

    const result = await shopeeAffiliate.generateAffiliateLink(originUrl, subId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to generate link' });
  }
});

app.post('/api/facebook/send', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, message, templateName } = req.body;

    if (!facebookIntegration.isConfigured()) {
      res.status(503).json({ success: false, error: 'Facebook WhatsApp Business API not configured' });
      return;
    }

    let result;
    if (templateName) {
      result = await facebookIntegration.sendTemplateMessage(phone, templateName);
    } else if (message) {
      result = await facebookIntegration.sendTextMessage(phone, message);
    } else {
      res.status(400).json({ success: false, error: 'Message or template name is required' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to send message' });
  }
});

app.get('/api/facebook/webhook', async (req: Request, res: Response): Promise<void> => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const result = await facebookIntegration.verifyWebhook(mode, token, challenge || '');
  if (result.success) {
    res.status(200).send(result.challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

app.post('/api/facebook/webhook', (req: Request, res: Response): void => {
  logger.info({ body: req.body }, 'Facebook webhook received');
  res.status(200).send('OK');
});

app.get('/api/safety/metrics', (_req: Request, res: Response): void => {
  try {
    const metrics = safetyService.getSafetyMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch safety metrics' });
  }
});

app.get('/api/safety/compliance', (_req: Request, res: Response): void => {
  try {
    const compliance = safetyService.getComplianceReport();
    res.json({ success: true, data: compliance });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch compliance report' });
  }
});

app.get('*', (req: Request, res: Response): void => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

export async function startDashboardServer(): Promise<void> {
  try {
    app.listen(environment.port, () => {
      logger.info(`Dashboard server running on port ${environment.port}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start dashboard server');
  }
}

