import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { environment } from '../config/env';
import { logger } from '../utils/logger';
import { AffiliateProduct } from '../types';

export class ShopeeAffiliateService {
  private client: AxiosInstance;
  private appId: string;
  private secret: string;
  private region: string;

  constructor() {
    this.appId = environment.shopee.appId;
    this.secret = environment.shopee.secret;
    this.region = environment.shopee.region;

    const baseUrl = this.getBaseUrl();
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private getBaseUrl(): string {
    const regionUrls: Record<string, string> = {
      id: 'https://open.shopee.com/api/v2',
      vn: 'https://open.shopee.vn/api/v2',
      th: 'https://open.shopee.co.th/api/v2',
      ph: 'https://open.shopee.ph/api/v2',
      sg: 'https://open.shopee.sg/api/v2',
      my: 'https://open.shopee.com.my/api/v2',
      br: 'https://open.shopee.com.br/api/v2',
      mx: 'https://open.shopee.com.mx/api/v2',
    };
    return regionUrls[this.region] || regionUrls.id;
  }

  private generateSignature(path: string, timestamp: number): string {
    const baseString = `${this.appId}${path}${timestamp}${this.secret}`;
    return crypto.createHash('sha256').update(baseString).digest('hex');
  }

  private async request<T>(path: string, body: Record<string, any> = {}): Promise<T> {
    if (!this.appId || !this.secret) {
      throw new Error('Shopee credentials not configured. Set SHOPEE_APP_ID and SHOPEE_AFFILIATE_SECRET');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(path, timestamp);

    try {
      const response = await this.client.post(path, {
        ...body,
        app_id: this.appId,
        timestamp,
        sign: signature,
      }, {
        headers: {
          'Authorization': `SHA256 Credential=${this.appId}, Timestamp=${timestamp}, Signature=${signature}`,
        },
      });

      if (response.data?.error) {
        throw new Error(`Shopee API error: ${response.data.error} - ${response.data.message}`);
      }

      return response.data;
    } catch (error) {
      logger.error({ error, path }, 'Shopee API request failed');
      throw error;
    }
  }

  async generateAffiliateLink(originUrl: string, subId?: string): Promise<{ affiliateUrl: string; product?: AffiliateProduct }> {
    const path = '/api/v2/affiliate/generate_short_link';
    const payload: Record<string, any> = {
      origin_url: originUrl,
    };

    if (subId) {
      payload.sub_ids = [subId];
    }

    const data = await this.request<{ data?: { data?: { affiliate_url?: string; product?: any } } }>(path, payload);
    const affiliateUrl = data?.data?.data?.affiliate_url || originUrl;
    const product = data?.data?.data?.product;

    return {
      affiliateUrl,
      product: product ? this.mapProduct(product, affiliateUrl) : undefined,
    };
  }

  async searchProducts(keyword: string, limit: number = 20): Promise<AffiliateProduct[]> {
    const path = '/api/v2/affiliate/product/search';
    const data = await this.request<{ data?: { products?: any[] } }>(path, {
      keyword,
      limit,
      sort_type: 2,
    });

    const products = data?.data?.products || [];
    return products.map(p => this.mapProduct(p, p.affiliate_url || ''));
  }

  async getProductDetail(itemId: number, shopId: number): Promise<AffiliateProduct | null> {
    const path = '/api/v2/affiliate/product/detail';
    const data = await this.request<{ data?: { item?: any } }>(path, {
      item_id: itemId,
      shop_id: shopId,
    });

    const item = data?.data?.item;
    return item ? this.mapProduct(item, item.affiliate_url || '') : null;
  }

  private mapProduct(raw: any, affiliateUrl: string): AffiliateProduct {
    return {
      id: String(raw.item_id || raw.id || Date.now()),
      title: raw.title || raw.item_name || 'Unknown Product',
      price: parseFloat(raw.price || raw.item_price || 0),
      originalPrice: raw.original_price ? parseFloat(raw.original_price) : undefined,
      imageUrl: raw.image_url || raw.item_image || '',
      affiliateUrl: affiliateUrl || raw.affiliate_url || '',
      commissionRate: parseFloat(raw.commission_rate || raw.commission || 0),
      shopName: raw.shop_name || '',
      category: raw.category || '',
      salesCount: parseInt(raw.sales || raw.item_sold, 10) || 0,
      rating: parseFloat(raw.rating || raw.item_rating || 0),
    };
  }

  async getConversionReport(startTime: number, endTime: number): Promise<any> {
    const path = '/api/v2/affiliate/conversion_report';
    return this.request(path, {
      start_time: startTime,
      end_time: endTime,
    });
  }
}

export const shopeeAffiliate = new ShopeeAffiliateService();
