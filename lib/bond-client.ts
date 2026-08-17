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
import { DEFAULT_BOND_ENV, getBondBaseUrl, type BondEnv } from '@/lib/bond-env';
import type {
  BondGroup,
  BondGroupExpand,
  BondGroupType,
  BondParticipant,
  BondParticipantExpand,
} from '@/types/rosters';

const DEFAULT_BOND_API_BASE_URL = getBondBaseUrl(DEFAULT_BOND_ENV);

interface BondClientOptions {
  apiKey: string;
  timeout?: number;
  bondEnv?: BondEnv;
}

interface BondApiStats {
  totalRequests: number;
  rateLimitHits: number;
  serverErrors: number;
  errors: number;
}

const BOND_PAGE_FETCH_CONCURRENCY = 3;

let bondApiStats: BondApiStats = {
  totalRequests: 0,
  rateLimitHits: 0,
  serverErrors: 0,
  errors: 0,
};

/**
 * Reset the per-process Bond API stats counter. Call at the start of any
 * scoped operation (e.g. a cron run) where you want a clean reading.
 */
export function resetBondApiStats(): void {
  bondApiStats = { totalRequests: 0, rateLimitHits: 0, serverErrors: 0, errors: 0 };
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
  private baseUrl: string;

  constructor(options: BondClientOptions) {
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 30000;
    this.baseUrl = getBondBaseUrl(options.bondEnv || DEFAULT_BOND_ENV);
  }

  private async fetch<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    bondApiStats.totalRequests++;
    const url = new URL(endpoint.replace(/^\//, ''), `${this.baseUrl.replace(/\/$/, '')}/`);

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
            if (response.status >= 500) {
              bondApiStats.serverErrors++;
            }
            throw new Error(
              `API Error: ${response.status} ${response.statusText} (${url.pathname})`
            );
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
   * Page count from whichever pagination shape Bond returned.
   *
   * Falls back to 1 for an unrecognized shape, and warns when it does: a silent
   * fallback here is indistinguishable from a genuine single-page response, and
   * on a roster that means quietly dropping players.
   */
  private getTotalPages(response: APIResponse<unknown[]>, endpoint?: string): number {
    if (!response.meta || typeof response.meta !== 'object') {
      if (endpoint) {
        console.warn('[bond-client] no pagination meta, assuming single page', {
          endpoint,
          itemsReturned: Array.isArray(response.data) ? response.data.length : undefined,
        });
      }
      return 1;
    }

    if ('totalPages' in response.meta && typeof response.meta.totalPages === 'number') {
      return response.meta.totalPages;
    }

    if (
      'pagination' in response.meta &&
      response.meta.pagination &&
      typeof response.meta.pagination === 'object' &&
      'lastPage' in response.meta.pagination &&
      typeof response.meta.pagination.lastPage === 'number'
    ) {
      return response.meta.pagination.lastPage;
    }

    if (endpoint) {
      console.warn('[bond-client] unrecognized pagination shape, assuming single page', {
        endpoint,
        metaKeys: Object.keys(response.meta),
        itemsReturned: Array.isArray(response.data) ? response.data.length : undefined,
      });
    }
    return 1;
  }

  private async fetchRemainingPages<T>(
    endpoint: string,
    baseParams: Record<string, string>,
    totalPages: number
  ): Promise<APIResponse<T[]>[]> {
    const responses: APIResponse<T[]>[] = [];

    for (let page = 2; page <= totalPages; page += BOND_PAGE_FETCH_CONCURRENCY) {
      const batch = Array.from(
        { length: Math.min(BOND_PAGE_FETCH_CONCURRENCY, totalPages - page + 1) },
        (_, index) =>
          this.fetch<APIResponse<T[]>>(endpoint, {
            ...baseParams,
            page: String(page + index),
          })
      );

      responses.push(...(await Promise.all(batch)));
    }

    return responses;
  }

  /**
   * Read every page of a paginated list endpoint and flatten them into a single
   * synthetic one-page response: page 1 first to learn the page count, then the
   * remainder BOND_PAGE_FETCH_CONCURRENCY at a time.
   */
  protected async fetchAllPages<T>(
    endpoint: string,
    params?: Record<string, string | number | undefined>
  ): Promise<APIResponse<T[]>> {
    const baseParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null) {
        baseParams[key] = String(value);
      }
    }

    const first = await this.fetch<APIResponse<T[]>>(endpoint, { ...baseParams, page: '1' });
    const items: T[] = [...(first.data || [])];
    const totalPages = this.getTotalPages(first, endpoint);

    if (totalPages > 1) {
      const remaining = await this.fetchRemainingPages<T>(endpoint, baseParams, totalPages);
      for (const r of remaining) {
        if (r.data) items.push(...r.data);
      }
    }

    return {
      data: items,
      meta: {
        pagination: {
          total: items.length,
          perPage: items.length,
          currentPage: 1,
          lastPage: 1,
          hasMore: false,
        },
      },
    };
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
   * Every program for an organization, across all pages.
   *
   * `getPrograms` reads a single page (default 100). Callers that need a
   * complete list — roster scope resolution, for instance — must use this, or
   * an org with more than one page of programs silently loses the remainder.
   */
  async getAllPrograms(
    orgId: string,
    options?: { expand?: string; facilityId?: string; status?: string }
  ): Promise<APIResponse<Program[]>> {
    return this.fetchAllPages<Program>(`/organization/${orgId}/programs`, {
      expand: options?.expand || 'sessions,sessions.products,sessions.products.prices',
      facility_id: options?.facilityId,
      status: options?.status,
      per_page: 100,
    });
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
    return this.fetchAllPages<SessionEvent>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/events`,
      { expand: options?.expand }
    );
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
    return this.fetchAllPages<SessionEvent>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/segments/${segmentId}/events`,
      { expand: options?.expand }
    );
  }

  /**
   * Get every group (division, team, conference, level, …) in a published
   * session. Bond returns a flat list carrying `parentId`, so one call is
   * enough to build the whole division/team tree — see lib/roster-tree.ts.
   *
   * Only published sessions have groups; Bond 404s otherwise.
   */
  async getSessionGroups(
    orgId: string | number,
    programId: string | number,
    sessionId: string | number,
    options?: {
      expand?: BondGroupExpand[];
      groupTypes?: BondGroupType[];
      parentIds?: number[];
      isTeam?: boolean;
      hasPlayers?: boolean;
      search?: string;
      itemsPerPage?: number;
    }
  ): Promise<APIResponse<BondGroup[]>> {
    return this.fetchAllPages<BondGroup>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/groups`,
      {
        expand: options?.expand?.length ? options.expand.join(',') : undefined,
        groupTypes: options?.groupTypes?.length ? options.groupTypes.join(',') : undefined,
        parentIds: options?.parentIds?.length ? options.parentIds.join(',') : undefined,
        isTeam: options?.isTeam === undefined ? undefined : String(options.isTeam),
        hasPlayers: options?.hasPlayers === undefined ? undefined : String(options.hasPlayers),
        search: options?.search,
        itemsPerPage: options?.itemsPerPage ?? 100,
      }
    );
  }

  /**
   * Get the roster of one group.
   *
   * `expand` decides how much PII Bond sends back — always pass the result of
   * `resolveExpand()` from lib/roster-privacy.ts rather than a literal list, so
   * a public request never pulls contact or registration data into this
   * process in the first place.
   */
  async getGroupParticipants(
    orgId: string | number,
    programId: string | number,
    sessionId: string | number,
    groupId: string | number,
    options?: { expand?: BondParticipantExpand[]; itemsPerPage?: number }
  ): Promise<APIResponse<BondParticipant[]>> {
    return this.fetchAllPages<BondParticipant>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/groups/${groupId}/participants`,
      {
        expand: options?.expand?.length ? options.expand.join(',') : undefined,
        itemsPerPage: options?.itemsPerPage ?? 100,
      }
    );
  }

  /**
   * Get the participants attached to one event.
   *
   * Note this is who is *registered for or assigned to* the event — Bond
   * exposes no check-in or attendance state, so nothing here can be presented
   * as attendance. Same `expand` rule as getGroupParticipants.
   */
  async getEventParticipants(
    orgId: string | number,
    programId: string | number,
    sessionId: string | number,
    eventId: string | number,
    options?: { expand?: BondParticipantExpand[]; itemsPerPage?: number }
  ): Promise<APIResponse<BondParticipant[]>> {
    return this.fetchAllPages<BondParticipant>(
      `/organization/${orgId}/programs/${programId}/sessions/${sessionId}/events/${eventId}/participants`,
      {
        expand: options?.expand?.length ? options.expand.join(',') : undefined,
        itemsPerPage: options?.itemsPerPage ?? 100,
      }
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
 * Resolve the Bond API key for a request.
 *
 * A key comes from exactly one place: the page's own `api_key`, or the one it
 * inherits from its partner group (see `rowToConfig` in lib/config.ts). There
 * is deliberately **no** deployment-wide or hardcoded fallback.
 *
 * Two reasons. Rotation: a key lives on one partner group, so rotating it is a
 * single edit that every page under that group picks up, rather than a hunt
 * across pages and environments. And attribution: Bond provisions keys per
 * organization and meters usage per organization, so a shared fallback let a
 * page silently read another customer's data on that customer's quota — which
 * is exactly what happened here before this was removed.
 *
 * Returns undefined when no key is configured, so callers fail closed with a
 * clear error instead of borrowing one.
 */
export function resolveBondApiKey(explicit?: string | null): string | undefined {
  return typeof explicit === 'string' && explicit.length > 0 ? explicit : undefined;
}

/**
 * Create a Bond client. Throws when no key can be resolved.
 */
export function createBondClient(apiKey?: string, bondEnv?: BondEnv): BondClient {
  const key = resolveBondApiKey(apiKey);

  if (!key) {
    throw new Error(
      'No Bond API key: give the page an api_key, or a partner group that has one.'
    );
  }

  return new BondClient({ apiKey: key, bondEnv: bondEnv || DEFAULT_BOND_ENV });
}

export { DEFAULT_BOND_API_BASE_URL };

/**
 * Default organization IDs
 */
export const DEFAULT_ORG_IDS = ['516', '512', '513', '519', '518', '521', '514', '515', '510', '520', '522', '511'];
