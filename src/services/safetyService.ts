import { environment } from '../config/env';
import { database } from '../database/db';
import { logger } from '../utils/logger';

export class SafetyService {
  validatePhoneNumber(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }

    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  async sendOptOutInstructions(phone: string): Promise<void> {
    try {
      const optOutMessage = `Anda akan berhenti menerima pesan promosi dari kami. Kirim "STOP" kapan saja untuk berhenti.`;

      const normalized = this.normalizePhone(phone);

      database.upsertContact({
        phone: normalized,
        source: 'manual',
        tags: [],
        optedIn: false,
        optedInAt: undefined,
        optedOut: true,
        messageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error, phone }, 'Failed to send opt-out instructions');
    }
  }

  getOptOutRate(): number {
    try {
      const contacts = database.getContacts({ optedOut: true });
      const total = database.getContacts({});
      return total.length > 0 ? (contacts.length / total.length) * 100 : 0;
    } catch {
      return 0;
    }
  }

  getComplianceReport(): {
    totalContacts: number;
    optedIn: number;
    optedOut: number;
    optOutRate: number;
    lastMessageAt?: string;
  } {
    try {
      const all = database.getContacts({});
      const optedIn = database.getContacts({ optedIn: true });
      const optedOut = database.getContacts({ optedOut: true });

      return {
        totalContacts: all.length,
        optedIn: optedIn.length,
        optedOut: optedOut.length,
        optOutRate: all.length > 0 ? (optedOut.length / all.length) * 100 : 0,
      };
    } catch {
      return { totalContacts: 0, optedIn: 0, optedOut: 0, optOutRate: 0 };
    }
  }

  validateMessageContent(content: string): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (content.length > 4096) {
      warnings.push('Message exceeds WhatsApp 4096 character limit');
    }

    const spamPatterns = [
      /\b(GRATIS|GRATISS|CASHBACK 100%|MENANG BERKELAS)\b/gi,
      /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/g,
    ];

    spamPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        warnings.push('Content contains patterns commonly flagged as spam');
      }
    });

    return { valid: warnings.length === 0, warnings };
  }

  getSafetyMetrics() {
    return {
      maxMessagesPerDay: environment.safety.maxMessagesPerDay,
      maxMessagesPerHour: environment.safety.maxMessagesPerHour,
      minDelayBetweenMessagesMs: environment.safety.minDelayBetweenMessagesMs,
      warmupStartDay: environment.safety.warmupStartDay,
      warmupEndDay: environment.safety.warmupEndDay,
      warmupStartLimit: environment.safety.warmupStartLimit,
      warmupEndLimit: environment.safety.warmupEndLimit,
      compliance: this.getComplianceReport(),
    };
  }
}

export const safetyService = new SafetyService();
