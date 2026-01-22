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
    const url = new URL(`${BASE_URL}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

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

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('API request timed out');
      }
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
   * Get events for a session (fetches all pages)
   */
  async getEvents(
    orgId: string,
    programId: string,
    sessionId: string,
    options?: { expand?: string }
  ): Promise<APIResponse<SessionEvent[]>> {
    const allEvents: SessionEvent[] = [];
    let currentPage = 1;
    let totalPages = 1;
    
    do {
      const params: Record<string, string> = { page: String(currentPage) };
      if (options?.expand) params.expand = options.expand;
      
      const response = await this.fetch<APIResponse<SessionEvent[]>>(
        `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/events`,
        params
      );
      
      if (response.data) {
        allEvents.push(...response.data);
      }
      
      // Check pagination from meta
      if (response.meta && typeof response.meta === 'object' && 'totalPages' in response.meta) {
        totalPages = (response.meta as any).totalPages || 1;
      }
      
      currentPage++;
    } while (currentPage <= totalPages);
    
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
    const params: Record<string, any> = {
      expand: options?.expand || 'events',
    };

    return this.fetch<APIResponse<Segment[]>>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/segments`,
      params
    );
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
