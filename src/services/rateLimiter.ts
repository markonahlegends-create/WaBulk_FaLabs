import { environment } from '../config/env';
import { database } from '../database/db';
import { logger } from '../utils/logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  reason?: string;
}

export class RateLimiter {
  private checkInterval: number = 1000;
  private lastSentTimestamps: Map<string, number[]> = new Map();

  canSend(phone: string): RateLimitResult {
    if (!environment.safety) {
      return { allowed: true, remaining: 1000, resetAt: new Date().toISOString() };
    }

    const { maxMessagesPerHour, maxMessagesPerDay, minDelayBetweenMessagesMs } = environment.safety;

    if (this.isOptedOut(phone)) {
      return { allowed: false, remaining: 0, resetAt: new Date().toISOString(), reason: 'Contact opted out' };
    }

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const timestamps = this.lastSentTimestamps.get(phone) || [];
    const recentTimestamps = timestamps.filter(t => t > oneDayAgo);
    this.lastSentTimestamps.set(phone, recentTimestamps);

    const hourCount = recentTimestamps.filter(t => t > oneHourAgo).length;
    const dayCount = recentTimestamps.length;

    if (dayCount >= maxMessagesPerDay) {
      const oldestTimestamp = recentTimestamps[0];
      const resetAt = new Date(oldestTimestamp + 24 * 60 * 60 * 1000).toISOString();
      return { allowed: false, remaining: 0, resetAt, reason: 'Daily limit reached' };
    }

    if (hourCount >= maxMessagesPerHour) {
      const hourTimestamps = recentTimestamps.filter(t => t > oneHourAgo);
      const oldestHourTimestamp = hourTimestamps[0];
      const resetAt = new Date(oldestHourTimestamp + 60 * 60 * 1000).toISOString();
      return { allowed: false, remaining: 0, resetAt, reason: 'Hourly limit reached' };
    }

    const lastSent = recentTimestamps.length > 0 ? recentTimestamps[recentTimestamps.length - 1] : 0;
    if (lastSent > 0 && (now - lastSent) < minDelayBetweenMessagesMs) {
      const nextAllowed = new Date(lastSent + minDelayBetweenMessagesMs).toISOString();
      return { allowed: false, remaining: maxMessagesPerHour - hourCount, resetAt: nextAllowed, reason: 'Delay between messages' };
    }

    return {
      allowed: true,
      remaining: Math.min(maxMessagesPerHour - hourCount, maxMessagesPerDay - dayCount),
      resetAt: new Date(now + 60 * 60 * 1000).toISOString(),
    };
  }

  recordSent(phone: string): void {
    const now = Date.now();
    const timestamps = this.lastSentTimestamps.get(phone) || [];
    timestamps.push(now);
    this.lastSentTimestamps.set(phone, timestamps);
  }

  isOptedOut(phone: string): boolean {
    try {
      return database.isOptedOut(phone);
    } catch {
      return false;
    }
  }

  getWarmupLimit(sessionId: string): number {
    try {
      const today = new Date().toISOString().split('T')[0];
      const warmup = database.getWarmupState(sessionId, today);
      if (warmup) {
        return warmup.dailyLimit;
      }
      return environment.safety.warmupStartLimit;
    } catch {
      return environment.safety.warmupStartLimit;
    }
  }

  checkWarmupLimit(sessionId: string): RateLimitResult {
    const warmupLimit = this.getWarmupLimit(sessionId);
    const { maxMessagesPerDay } = environment.safety;

    try {
      const today = new Date().toISOString().split('T')[0];
      const warmup = database.getWarmupState(sessionId, today);
      const sentToday = warmup?.sentToday || 0;

      if (sentToday >= warmupLimit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          reason: `Warmup limit reached (${sentToday}/${warmupLimit})`,
        };
      }

      return {
        allowed: true,
        remaining: warmupLimit - sentToday,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch {
      return { allowed: true, remaining: warmupLimit, resetAt: new Date().toISOString() };
    }
  }

  async recordWarmupSent(sessionId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const warmup = database.getWarmupState(sessionId, today);
      if (!warmup) {
        const dayNumber = Math.min(
          Math.floor((Date.now() - new Date(today).getTime()) / (24 * 60 * 60 * 1000)) + 1,
          environment.safety.warmupEndDay
        );
        const limit = this.calculateWarmupLimit(dayNumber);
        database.createOrUpdateWarmup({ sessionId, dayNumber, dailyLimit: limit, sentToday: 1, date: today });
      } else {
        database.incrementWarmupSent(sessionId, today);
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to record warmup sent');
    }
  }

  private calculateWarmupLimit(day: number): number {
    const { warmupStartDay, warmupEndDay, warmupStartLimit, warmupEndLimit } = environment.safety;
    if (day <= warmupStartDay) return warmupStartLimit;
    if (day >= warmupEndDay) return warmupEndLimit;

    const progress = (day - warmupStartDay) / (warmupEndDay - warmupStartDay);
    return Math.round(warmupStartLimit + (warmupEndLimit - warmupStartLimit) * progress);
  }
}

export const rateLimiter = new RateLimiter();
