import cron from 'node-cron';
import { Campaign } from '../types';
import { database } from '../database/db';
import { whatsAppService } from './whatsAppService';
import { facebookIntegration } from './facebookIntegration';
import { shopeeAffiliate } from './shopeeAffiliate';
import { rateLimiter } from './rateLimiter';
import { logger } from '../utils/logger';

export class CampaignScheduler {
  private tasks: Map<number, cron.ScheduledTask> = new Map();

  startCampaign(campaign: Campaign): void {
    if (this.tasks.has(campaign.id!)) {
      this.tasks.get(campaign.id!)?.stop();
      this.tasks.delete(campaign.id!);
    }

    database.updateCampaignStatus(campaign.id!, 'scheduled');

    if (!campaign.scheduleAt) {
      this.runCampaign(campaign);
      return;
    }

    const scheduleTime = new Date(campaign.scheduleAt);
    const cronExpression = this.getCronExpression(scheduleTime);

    if (!cronExpression) {
      logger.warn({ campaignId: campaign.id }, 'Invalid schedule time, running immediately');
      this.runCampaign(campaign);
      return;
    }

    const task = cron.schedule(cronExpression, () => {
      this.runCampaign(campaign);
    });

    this.tasks.set(campaign.id!, task);
    logger.info({ campaignId: campaign.id, scheduleAt: campaign.scheduleAt }, 'Campaign scheduled');
  }

  stopCampaign(campaignId: number): void {
    const task = this.tasks.get(campaignId);
    if (task) {
      task.stop();
      this.tasks.delete(campaignId);
      database.updateCampaignStatus(campaignId, 'paused');
      logger.info({ campaignId }, 'Campaign stopped');
    }
  }

  async runCampaign(campaign: Campaign): Promise<void> {
    try {
      database.updateCampaignStatus(campaign.id!, 'running', { startedAt: new Date().toISOString() });
      logger.info({ campaignId: campaign.id }, 'Campaign started');

      if (campaign.targetMode === 'group' && campaign.groupIds && campaign.groupIds.length > 0) {
        const uniqueGroupIds = [...new Set(campaign.groupIds)];
        campaign.totalContacts = uniqueGroupIds.length;
        database.incrementCampaignCounts(campaign.id!, 0, 0);

        for (const groupId of uniqueGroupIds) {
          try {
            if (campaign.type === 'media' && campaign.mediaUrl) {
              await whatsAppService.sendGroupMessage(
                groupId,
                campaign.message || '',
                campaign.mediaUrl,
                campaign.caption
              );
            } else {
              const message = this.getCampaignMessage(campaign);
              await whatsAppService.sendGroupMessage(groupId, message);
            }

            database.incrementCampaignCounts(campaign.id!, 1, 0);
            await this.delay(5000, 30000);
          } catch (error) {
            logger.error({ error, groupId }, 'Error sending campaign group message');
            database.incrementCampaignCounts(campaign.id!, 0, 1);
          }
        }
      } else {
        let contacts = [];
        if (campaign.targetMode === 'tag' && campaign.targetTag) {
          contacts = database.getContacts({ optedOut: false }).filter(c => c.tags.includes(campaign.targetTag!));
        } else if (campaign.targetMode === 'manual' && campaign.manualPhones && campaign.manualPhones.length > 0) {
          const manualPhones = [...new Set(campaign.manualPhones)];
          const existingContacts = new Map(database.getContacts({}).map(c => [c.phone, c]));
          contacts = manualPhones
            .map(phone => {
              const existing = existingContacts.get(phone);
              if (existing) return existing;
              return {
                phone,
                name: '',
                tags: [],
                optedIn: true,
                optedOut: false,
                messageCount: 0,
                source: 'campaign',
              };
            })
            .filter(c => !c.optedOut);
        } else {
          contacts = database.getContacts({ optedOut: false });
        }

        const uniquePhones = [...new Set(contacts.map(c => c.phone))];
        campaign.totalContacts = uniquePhones.length;
        database.incrementCampaignCounts(campaign.id!, 0, 0);

        for (const phone of uniquePhones) {
          try {
            if (!rateLimiter.canSend(phone).allowed) {
              logger.warn({ phone }, 'Rate limited, skipping');
              continue;
            }

            if (campaign.type === 'media' && campaign.mediaUrl) {
              await whatsAppService.sendMediaUrl(
                phone,
                campaign.mediaUrl,
                campaign.mediaType || 'image',
                campaign.caption,
                campaign.link
              );
            } else {
              const message = this.getCampaignMessage(campaign);
              const personalizedMessage = this.personalizeMessage(message, phone);
              await whatsAppService.sendMessage(phone, personalizedMessage);
            }

            database.incrementCampaignCounts(campaign.id!, 1, 0);
            await this.delay(5000, 30000);
          } catch (error) {
            logger.error({ error, phone }, 'Error sending campaign message');
            database.incrementCampaignCounts(campaign.id!, 0, 1);
          }
        }
      }

      database.updateCampaignStatus(campaign.id!, 'completed', { completedAt: new Date().toISOString() });
      logger.info({ campaignId: campaign.id }, 'Campaign completed');
    } catch (error) {
      logger.error({ error, campaignId: campaign.id }, 'Campaign failed');
      database.updateCampaignStatus(campaign.id!, 'failed');
    }
  }

  private getCampaignMessage(campaign: Campaign): string {
    try {
      const template = database.getTemplate(campaign.templateId!);
      if (template) {
        return template.content;
      }
    } catch {
      // ignore
    }
    return 'Check out our latest products!';
  }

  private personalizeMessage(message: string, phone: string): string {
    try {
      const contact = database.getContacts({ optedOut: false }).find(c => c.phone === phone);
      const name = contact?.name ? contact.name.split(' ')[0] : 'Kakak';

      return message
        .replace('{{name}}', name)
        .replace('{{phone}}', phone);
    } catch {
      return message;
    }
  }

  private getCronExpression(date: Date): string | null {
    const cronMap: Record<number, string> = {
      0: '0 9 * * *',
      1: '0 10 * * *',
      2: '0 11 * * *',
      3: '0 13 * * *',
      4: '0 14 * * *',
      5: '0 15 * * *',
      6: '0 16 * * *',
      7: '0 17 * * *',
      8: '0 18 * * *',
      9: '0 19 * * *',
      10: '0 20 * * *',
      11: '0 21 * * *',
      12: '0 22 * * *',
      13: '0 8 * * *',
      14: '0 9 * * *',
    };

    const hour = date.getHours();
    return cronMap[hour] || null;
  }

  private delay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stopAll(): void {
    this.tasks.forEach(task => task.stop());
    this.tasks.clear();
    logger.info('All campaigns stopped');
  }
}

export const campaignScheduler = new CampaignScheduler();
