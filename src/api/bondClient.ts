import axios, { AxiosInstance } from 'axios';
import { Program, Session, Product, Segment, Event, APIResponse } from '../types/bond';

const BASE_URL = 'https://public.api.bondsports.co/v1';
const API_KEY = 'zhoZODDEKuaexCBkvumrU7c84TbC3zsC4hENkjlz';

// In-memory cache (5 minutes)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class BondClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'x-api-key': API_KEY,
      },
    });
  }

  private getCacheKey(endpoint: string, params?: Record<string, any>): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramStr}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  async getPrograms(
    orgId: string,
    filters?: Record<string, any>
  ): Promise<Program[]> {
    const cacheKey = this.getCacheKey(`/organization/${orgId}/programs`, filters);
    const cached = this.getFromCache<Program[]>(cacheKey);
    if (cached) return cached;

    const params = {
      expand: 'sessions,sessions.products,sessions.products.prices',
      ...filters,
    };

    const response = await this.client.get<APIResponse<Program[]>>(
      `/organization/${orgId}/programs`,
      { params }
    );

    const programs = response.data.data || [];
    this.setCache(cacheKey, programs);
    return programs;
  }

  async getSessions(
    orgId: string,
    programId: string,
    filters?: Record<string, any>
  ): Promise<Session[]> {
    const cacheKey = this.getCacheKey(
      `/organization/${orgId}/programs/${programId}/sessions`,
      filters
    );
    const cached = this.getFromCache<Session[]>(cacheKey);
    if (cached) return cached;

    const params = {
      expand: 'products,products.prices,segments,events',
      ...filters,
    };

    const response = await this.client.get<APIResponse<Session[]>>(
      `/organization/${orgId}/programs/${programId}/sessions`,
      { params }
    );

    const sessions = response.data.data || [];
    this.setCache(cacheKey, sessions);
    return sessions;
  }

  async getProducts(
    orgId: string,
    programId: string,
    sessionId: string,
    filters?: Record<string, any>
  ): Promise<Product[]> {
    const cacheKey = this.getCacheKey(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/products`,
      filters
    );
    const cached = this.getFromCache<Product[]>(cacheKey);
    if (cached) return cached;

    const params = {
      expand: 'prices',
      ...filters,
    };

    const response = await this.client.get<APIResponse<Product[]>>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/products`,
      { params }
    );

    const products = response.data.data || [];
    this.setCache(cacheKey, products);
    return products;
  }

  async getSegments(
    orgId: string,
    programId: string,
    sessionId: string,
    filters?: Record<string, any>
  ): Promise<Segment[]> {
    const cacheKey = this.getCacheKey(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/segments`,
      filters
    );
    const cached = this.getFromCache<Segment[]>(cacheKey);
    if (cached) return cached;

    const params = {
      expand: 'events',
      ...filters,
    };

    const response = await this.client.get<APIResponse<Segment[]>>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/segments`,
      { params }
    );

    const segments = response.data.data || [];
    this.setCache(cacheKey, segments);
    return segments;
  }

  async getEvents(
    orgId: string,
    programId: string,
    sessionId: string,
    filters?: Record<string, any>
  ): Promise<Event[]> {
    const cacheKey = this.getCacheKey(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/events`,
      filters
    );
    const cached = this.getFromCache<Event[]>(cacheKey);
    if (cached) return cached;

    const params = { ...filters };

    const response = await this.client.get<APIResponse<Event[]>>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/events`,
      { params }
    );

    const events = response.data.data || [];
    this.setCache(cacheKey, events);
    return events;
  }
}

// Export singleton instance
export const bondClient = new BondClient();
