import { environment } from '../config/env';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { Contact, Campaign, MessageTemplate, MessageLog, AffiliateProduct, SessionState, WarmupState } from '../types';

const DB_FILE = environment.databasePath;

class JsonDatabase {
  private data: {
    contacts: Contact[];
    campaigns: Campaign[];
    message_templates: MessageTemplate[];
    message_logs: MessageLog[];
    affiliate_products: AffiliateProduct[];
    sessions: SessionState[];
    warmup_state: WarmupState[];
    opt_out_list: { phone: string; reason?: string; createdAt: string }[];
    nextIds: {
      contacts: number;
      campaigns: number;
      message_templates: number;
      message_logs: number;
      warmup_state: number;
      opt_out_list: number;
    };
  };

  constructor() {
    this.data = {
      contacts: [],
      campaigns: [],
      message_templates: [],
      message_logs: [],
      affiliate_products: [],
      sessions: [],
      warmup_state: [],
      opt_out_list: [],
      nextIds: {
        contacts: 1,
        campaigns: 1,
        message_templates: 1,
        message_logs: 1,
        warmup_state: 1,
        opt_out_list: 1,
      },
    };
  }

  async init(): Promise<void> {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const loaded = JSON.parse(content);
        this.data = loaded;
      } else {
        this.save();
      }

      logger.info('Database initialized');
    } catch (error) {
      logger.error({ error }, 'Database initialization failed');
      throw error;
    }
  }

  private save(): void {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
  }

  private getNextId(table: keyof typeof this.data.nextIds): number {
    const id = this.data.nextIds[table];
    this.data.nextIds[table] = id + 1;
    return id;
  }

  // Contacts
  upsertContact(contact: Contact): Contact {
    const existing = this.data.contacts.find(c => c.phone === contact.phone);
    if (existing) {
      Object.assign(existing, contact, { id: existing.id });
      this.save();
      return existing;
    }

    const newContact: Contact = {
      ...contact,
      id: this.getNextId('contacts'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.contacts.push(newContact);
    this.save();
    return newContact;
  }

  getContact(phone: string): Contact | undefined {
    return this.data.contacts.find(c => c.phone === phone);
  }

  getContactById(id: number): Contact | undefined {
    return this.data.contacts.find(c => c.id === id);
  }

  deleteContact(id: number): boolean {
    const index = this.data.contacts.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.data.contacts.splice(index, 1);
    this.save();
    return true;
  }

  getContacts(filters?: { optedIn?: boolean; optedOut?: boolean; tags?: string[] }): Contact[] {
    let contacts = [...this.data.contacts];

    if (filters?.optedIn !== undefined) {
      contacts = contacts.filter(c => c.optedIn === filters.optedIn);
    }
    if (filters?.optedOut !== undefined) {
      contacts = contacts.filter(c => c.optedOut === filters.optedOut);
    }
    if (filters?.tags && filters.tags.length > 0) {
      contacts = contacts.filter(c => c.tags.some(tag => filters.tags!.includes(tag)));
    }

    return contacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Campaigns
  createCampaign(campaign: Campaign): Campaign {
    const newCampaign: Campaign = {
      ...campaign,
      id: this.getNextId('campaigns'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.campaigns.push(newCampaign);
    this.save();
    return newCampaign;
  }

  getCampaign(id: number): Campaign | undefined {
    return this.data.campaigns.find(c => c.id === id);
  }

  updateCampaignStatus(id: number, status: Campaign['status'], extra?: { startedAt?: string; completedAt?: string }): void {
    const campaign = this.data.campaigns.find(c => c.id === id);
    if (campaign) {
      campaign.status = status;
      campaign.updatedAt = new Date().toISOString();
      if (extra?.startedAt) campaign.startedAt = extra.startedAt;
      if (extra?.completedAt) campaign.completedAt = extra.completedAt;
      this.save();
    }
  }

  incrementCampaignCounts(id: number, sent: number, failed: number): void {
    const campaign = this.data.campaigns.find(c => c.id === id);
    if (campaign) {
      campaign.sentCount += sent;
      campaign.failedCount += failed;
      campaign.updatedAt = new Date().toISOString();
      this.save();
    }
  }

  getCampaigns(filters?: { status?: string }): Campaign[] {
    let campaigns = [...this.data.campaigns];
    if (filters?.status) {
      campaigns = campaigns.filter(c => c.status === filters.status);
    }
    return campaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Message Templates
  createTemplate(template: MessageTemplate): MessageTemplate {
    const newTemplate: MessageTemplate = {
      ...template,
      id: this.getNextId('message_templates'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.message_templates.push(newTemplate);
    this.save();
    return newTemplate;
  }

  getTemplate(id: number): MessageTemplate | undefined {
    return this.data.message_templates.find(t => t.id === id);
  }

  getTemplates(): MessageTemplate[] {
    return this.data.message_templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Message Logs
  createMessageLog(log: MessageLog): MessageLog {
    const newLog: MessageLog = {
      ...log,
      id: this.getNextId('message_logs'),
      createdAt: new Date().toISOString(),
    };
    this.data.message_logs.push(newLog);
    this.save();
    return newLog;
  }

  getMessageLog(id: number): MessageLog | undefined {
    return this.data.message_logs.find(l => l.id === id);
  }

  getMessageLogs(filters?: { campaignId?: number; phone?: string; status?: string }): MessageLog[] {
    let logs = [...this.data.message_logs];

    if (filters?.campaignId) {
      logs = logs.filter(l => l.campaignId === filters.campaignId);
    }
    if (filters?.phone) {
      logs = logs.filter(l => l.phone === filters.phone);
    }
    if (filters?.status) {
      logs = logs.filter(l => l.status === filters.status);
    }

    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 1000);
  }

  updateMessageLog(id: number, updates: Partial<MessageLog>): void {
    const log = this.data.message_logs.find(l => l.id === id);
    if (log) {
      Object.assign(log, updates);
      this.save();
    }
  }

  // Sessions
  saveSession(session: SessionState): void {
    const existing = this.data.sessions.find(s => s.id === session.id);
    if (existing) {
      Object.assign(existing, session);
    } else {
      this.data.sessions.push({
        ...session,
        createdAt: new Date().toISOString(),
      });
    }
    this.save();
  }

  getSession(id: string): SessionState | undefined {
    return this.data.sessions.find(s => s.id === id);
  }

  getSessions(): SessionState[] {
    return this.data.sessions;
  }

  // Warmup
  getWarmupState(sessionId: string, date?: string): WarmupState | undefined {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.data.warmup_state.find(w => w.sessionId === sessionId && w.date === targetDate);
  }

  createOrUpdateWarmup(warmup: WarmupState): WarmupState {
    const existing = this.data.warmup_state.find(w => w.sessionId === warmup.sessionId && w.date === warmup.date);
    if (existing) {
      Object.assign(existing, warmup);
    } else {
      this.data.warmup_state.push({
        ...warmup,
        id: this.getNextId('warmup_state'),
      });
    }
    this.save();
    return this.getWarmupState(warmup.sessionId, warmup.date)!;
  }

  incrementWarmupSent(sessionId: string, date?: string): WarmupState | undefined {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const warmup = this.getWarmupState(sessionId, targetDate);
    if (warmup) {
      warmup.sentToday += 1;
      this.save();
    }
    return warmup;
  }

  // Opt-out
  addToOptOut(phone: string, reason?: string): void {
    const existing = this.data.opt_out_list.find(o => o.phone === phone);
    if (!existing) {
      this.data.opt_out_list.push({
        phone,
        reason,
        createdAt: new Date().toISOString(),
      });
      this.save();
    }
  }

  isOptedOut(phone: string): boolean {
    return this.data.opt_out_list.some(o => o.phone === phone);
  }

  // Affiliate Products
  upsertProduct(product: AffiliateProduct): void {
    const existing = this.data.affiliate_products.find(p => p.id === product.id);
    if (existing) {
      Object.assign(existing, product);
    } else {
      this.data.affiliate_products.push({
        ...product,
        createdAt: new Date().toISOString(),
      });
    }
    this.save();
  }

  getProducts(filters?: { category?: string; minCommission?: number }): AffiliateProduct[] {
    let products = [...this.data.affiliate_products];

    if (filters?.category) {
      products = products.filter(p => p.category === filters.category);
    }
    if (filters?.minCommission !== undefined) {
      products = products.filter(p => p.commissionRate >= filters.minCommission!);
    }

    return products.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
  }
}

export const database = new JsonDatabase();
