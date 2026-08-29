export interface Contact {
  id?: number;
  phone: string;
  name?: string;
  source: string;
  tags: string[];
  optedIn: boolean;
  optedInAt?: string;
  optedOut: boolean;
  optedOutAt?: string;
  lastMessageAt?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id?: number;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
  type: 'text' | 'media';
  templateId?: number;
  contactListIds: number[];
  targetMode: 'all' | 'tag' | 'manual' | 'group';
  targetTag?: string;
  manualPhones?: string[];
  groupIds?: string[];
  message?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document';
  caption?: string;
  link?: string;
  scheduleAt?: string;
  startedAt?: string;
  completedAt?: string;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id?: number;
  name: string;
  content: string;
  category: 'marketing' | 'utility' | 'authentication';
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MessageLog {
  id?: number;
  campaignId?: number;
  contactId?: number;
  phone: string;
  direction: 'outbound' | 'inbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  content?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface AffiliateProduct {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  affiliateUrl: string;
  commissionRate: number;
  shopName: string;
  category: string;
  salesCount?: number;
  rating?: number;
  createdAt?: string;
}

export interface SessionState {
  id: string;
  phone?: string;
  connected: boolean;
  qrCode?: string;
  lastConnectedAt?: string;
  createdAt: string;
}

export interface WarmupState {
  id?: number;
  sessionId: string;
  dayNumber: number;
  dailyLimit: number;
  sentToday: number;
  date: string;
}

export interface GroupSchedule {
  id?: number;
  taskId: string;
  groupId: string;
  groupName: string;
  message: string;
  mediaUrl?: string;
  caption?: string;
  scheduleType: 'once' | 'daily' | 'weekly';
  scheduleAt: string;
  cronExpression?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}
