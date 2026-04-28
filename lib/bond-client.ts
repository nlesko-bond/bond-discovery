import { 
  Program, 
  Session, 
  Product, 
  SessionEvent, 
  Segment,
  APIResponse,
  Facility,
  Organization
} from '@/types';

const BASE_URL = 'https://public.api.bondsports.co/v1';

interface BondClientOptions {
  apiKey: string;
  timeout?: number;
}

interface BondApiStats {
  totalRequests: number;
  rateLimitHits: number;
  errors: number;
}

let bondApiStats: BondApiStats = {
  totalRequests: 0,
  rateLimitHits: 0,
  errors: 0,
};

/**
 * Reset the per-process Bond API stats counter. Call at the start of any
 * scoped operation (e.g. a cron run) where you want a clean reading.
 */
export function resetBondApiStats(): void {
  bondApiStats = { totalRequests: 0, rateLimitHits: 0, errors: 0 };
}

/**
 * Read a snapshot of the per-process Bond API stats counter.
 * `rateLimitHits` counts every 429 response (including ones that succeed on retry).
 */
export function getBondApiStats(): BondApiStats {
  return { ...bondApiStats };
}

/**
 * Server-side Bond Sports API client
 * Use this in API routes and Server Components only
 */
export class BondClient {
  private apiKey: string;
  private timeout: number;

  constructor(options: BondClientOptions) {
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 30000;
  }

  private async fetch<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    bondApiStats.totalRequests++;
    const url = new URL(`${BASE_URL}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    // Retry on 429 rate-limit responses. Without this, concurrent program/session
    // fetches during a discovery refresh lose events (and therefore spotsLeft) for
    // every session that gets rate-limited. Backoff follows `Retry-After` header
    // when present, else exponential 500ms / 1s / 2s.
    const maxAttempts = 4;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'x-api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.status === 429 && attempt < maxAttempts) {
            bondApiStats.rateLimitHits++;
            console.warn('[bond-client] 429 from Bond, retrying', {
              endpoint: url.pathname,
              attempt,
              maxAttempts,
            });
            const retryAfterHeader = response.headers.get('retry-after');
            const retryAfterMs = retryAfterHeader
              ? Number.parseFloat(retryAfterHeader) * 1000
              : undefined;
            const waitMs =
              Number.isFinite(retryAfterMs) && retryAfterMs! > 0
                ? Math.min(retryAfterMs!, 10_000)
                : 500 * 2 ** (attempt - 1);
            // Add up to 150ms jitter so concurrent waiters don't thunder at once.
            await new Promise((resolve) => setTimeout(resolve, waitMs + Math.random() * 150));
            continue;
          }

          if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
          }

          return (await response.json()) as T;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('API request timed out');
          }
          throw error;
        }
      }

      throw new Error('API Error: 429 Too Many Requests (max retries exceeded)');
    } catch (error) {
      bondApiStats.errors++;
      throw error;
    }
  }

  /**
   * Get all programs for an organization
   */
  async getPrograms(
    orgId: string,
    options?: {
      expand?: string;
      facilityId?: string;
      status?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<APIResponse<Program[]>> {
    const params: Record<string, any> = {
      // Full expand to get all nested data: sessions, products, and prices
      expand: options?.expand || 'sessions,sessions.products,sessions.products.prices',
      page: options?.page || 1,
      per_page: options?.perPage || 100,
    };

    if (options?.facilityId) {
      params.facility_id = options.facilityId;
    }
    if (options?.status) {
      params.status = options.status;
    }

    return this.fetch<APIResponse<Program[]>>(`/organization/${orgId}/programs`, params);
  }

  /**
   * Get sessions for a program
   */
  async getSessions(
    orgId: string,
    programId: string,
    options?: {
      expand?: string;
      status?: string;
    }
  ): Promise<APIResponse<Session[]>> {
    const params: Record<string, any> = {
      expand: options?.expand || 'products,products.prices,segments,events',
    };

    if (options?.status) {
      params.status = options.status;
    }

    return this.fetch<APIResponse<Session[]>>(
      `/organization/${orgId}/programs/${programId}/sessions`,
      params
    );
  }

  /**
   * Get products for a session
   */
  async getProducts(
    orgId: string,
    programId: string,
    sessionId: string,
    options?: {
      expand?: string;
      status?: string;
    }
  ): Promise<APIResponse<Product[]>> {
    const params: Record<string, any> = {
      expand: options?.expand || 'prices',
    };

    if (options?.status) {
      params.status = options.status;
    }

    return this.fetch<APIResponse<Product[]>>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/products`,
      params
    );
  }

  /**
   * Get events for a session (fetches page 1, then remaining pages in parallel)
   */
  async getEvents(
    orgId: string,
    programId: string,
    sessionId: string,
    options?: { expand?: string }
  ): Promise<APIResponse<SessionEvent[]>> {
    const endpoint = `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/events`;
    const baseParams: Record<string, string> = {};
    if (options?.expand) baseParams.expand = options.expand;

    const first = await this.fetch<APIResponse<SessionEvent[]>>(endpoint, { ...baseParams, page: '1' });
    const allEvents: SessionEvent[] = [...(first.data || [])];
    const totalPages = (first.meta && typeof first.meta === 'object' && 'totalPages' in first.meta)
      ? (first.meta as any).totalPages || 1
      : 1;

    if (totalPages > 1) {
      const remaining = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          this.fetch<APIResponse<SessionEvent[]>>(endpoint, { ...baseParams, page: String(i + 2) })
        )
      );
      for (const r of remaining) {
        if (r.data) allEvents.push(...r.data);
      }
    }

    return {
      data: allEvents,
      meta: { 
        pagination: { 
          total: allEvents.length, 
          perPage: allEvents.length, 
          currentPage: 1, 
          lastPage: 1, 
          hasMore: false 
        } 
      }
    };
  }

  /**
   * Get segments for a session
   */
  async getSegments(
    orgId: string,
    programId: string,
    sessionId: string,
    options?: {
      expand?: string;
    }
  ): Promise<APIResponse<Segment[]>> {
    const params: Record<string, any> = {};
    if (options?.expand) {
      params.expand = options.expand;
    }

    return this.fetch<APIResponse<Segment[]>>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/segments`,
      params
    );
  }

  /**
   * Get events for a specific segment (fetches page 1, then remaining pages in parallel)
   */
  async getSegmentEvents(
    orgId: string,
    programId: string,
    sessionId: string,
    segmentId: string,
    options?: { expand?: string }
  ): Promise<APIResponse<SessionEvent[]>> {
    const endpoint = `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/segments/${segmentId}/events`;
    const baseParams: Record<string, string> = {};
    if (options?.expand) baseParams.expand = options.expand;

    const first = await this.fetch<APIResponse<SessionEvent[]>>(endpoint, { ...baseParams, page: '1' });
    const allEvents: SessionEvent[] = [...(first.data || [])];
    const totalPages = (first.meta && typeof first.meta === 'object' && 'totalPages' in first.meta)
      ? (first.meta as any).totalPages || 1
      : 1;

    if (totalPages > 1) {
      const remaining = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          this.fetch<APIResponse<SessionEvent[]>>(endpoint, { ...baseParams, page: String(i + 2) })
        )
      );
      for (const r of remaining) {
        if (r.data) allEvents.push(...r.data);
      }
    }

    return {
      data: allEvents,
      meta: { 
        pagination: { 
          total: allEvents.length, 
          perPage: allEvents.length, 
          currentPage: 1, 
          lastPage: 1, 
          hasMore: false 
        } 
      }
    };
  }

  /**
   * Get facilities for an organization
   */
  async getFacilities(orgId: string): Promise<APIResponse<Facility[]>> {
    return this.fetch<APIResponse<Facility[]>>(`/organization/${orgId}/facilities`);
  }

  /**
   * Get organization details
   */
  async getOrganization(orgId: string): Promise<APIResponse<Organization>> {
    return this.fetch<APIResponse<Organization>>(`/organization/${orgId}`);
  }
}

/**
 * Create a Bond client with the default API key from environment
 */
export function createBondClient(apiKey?: string): BondClient {
  const key = apiKey || process.env.BOND_API_KEY;
  
  if (!key) {
    throw new Error('BOND_API_KEY environment variable is required');
  }

  return new BondClient({ apiKey: key });
}

/**
 * Default API key for development (move to env in production)
 */
export const DEFAULT_API_KEY = 'zhoZODDEKuaexCBkvumrU7c84TbC3zsC4hENkjlz';

/**
 * Default organization IDs
 */
export const DEFAULT_ORG_IDS = ['516', '512', '513', '519', '518', '521', '514', '515', '510', '520', '522', '511'];
