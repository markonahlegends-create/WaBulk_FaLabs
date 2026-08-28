import { Contact } from '../types';

export interface ContactCreateRequest {
  phone: string;
  name?: string;
  source?: string;
  tags?: string[];
}

export interface ContactResponse {
  success: boolean;
  data?: Contact;
  error?: string;
}

export interface MessageSendRequest {
  phone: string;
  message: string;
}

export interface MessageSendResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface BulkMessageRequest {
  phones: string[];
  message: string;
  templateId?: number;
}

export interface BulkMessageResponse {
  success: boolean;
  results: {
    success: number;
    failed: number;
    errors: Array<{ phone: string; error: string }>;
  };
}

export interface CampaignCreateRequest {
  name: string;
  templateId?: number;
  contactListIds: number[];
  scheduleAt?: string;
}

export interface CampaignResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface TemplateCreateRequest {
  name: string;
  content: string;
  category?: string;
  variables?: string[];
}

export interface TemplateResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  whatsapp: boolean;
  facebook: boolean;
  shopee: boolean;
}

export interface ShopeeProductSearchRequest {
  keyword: string;
  limit?: number;
  category?: string;
  minCommission?: number;
}

export interface FacebookSendRequest {
  phone: string;
  message?: string;
  templateName?: string;
}
