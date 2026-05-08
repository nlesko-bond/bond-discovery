/**
 * Bond v4 reservation API (Cognito headers).
 * Does not apply approval or slot-type filters by default; pass those only when needed.
 */

import { getBondAuthHeaders, getBondApiBase, invalidateBondTokenCache } from '@/lib/bond-auth';

const DEFAULT_SEARCH_ITEMS_PER_PAGE = 25;
const DEFAULT_SEARCH_PAGE = 1;

const DEFAULT_RESERVATION_QUERY: Record<string, string> = {
  includeCustomer: 'true',
  includeAddons: 'true',
  includeInvoices: 'true',
  includePayments: 'true',
  includeSeries: 'true',
  includeAnswers: 'true',
  buildTree: 'true',
  includeFacility: 'true',
};

export async function fetchOrganizationReservation(
  organizationId: number,
  reservationId: number,
  extraQuery?: Record<string, string | undefined>,
): Promise<unknown> {
  const baseUrl = getBondApiBase();
  const url = new URL(`${baseUrl}/reservations/organization/${organizationId}/${reservationId}`);
  const merged: Record<string, string> = { ...DEFAULT_RESERVATION_QUERY };
  if (extraQuery) {
    for (const [key, value] of Object.entries(extraQuery)) {
      if (value !== undefined && value !== '') {
        merged[key] = value;
      }
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('organizationId', String(organizationId));

  const doFetch = async () => {
    const headers = await getBondAuthHeaders();
    return fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(60000),
    });
  };

  let response = await doFetch();
  if (response.status === 401) {
    await invalidateBondTokenCache();
    response = await doFetch();
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Reservations API error: ${response.status} - ${text}`);
  }

  return response.json();
}

export interface IFetchOrganizationReservationsSearchParams {
  search: string;
  page?: number;
  itemsPerPage?: number;
  order?: string;
  orderBy?: string;
  sortBy?: string;
  extraQuery?: Record<string, string | undefined>;
}

/**
 * List/search reservations for an org (Bond v4). Does not send approvalStatus unless included in extraQuery.
 */
export async function fetchOrganizationReservationsSearch(
  organizationId: number,
  params: IFetchOrganizationReservationsSearchParams,
): Promise<unknown> {
  const baseUrl = getBondApiBase();
  const url = new URL(`${baseUrl}/reservations/organization/${organizationId}`);
  url.searchParams.set('organizationId', String(organizationId));
  url.searchParams.set('search', params.search);
  url.searchParams.set('itemsPerPage', String(params.itemsPerPage ?? DEFAULT_SEARCH_ITEMS_PER_PAGE));
  url.searchParams.set('page', String(params.page ?? DEFAULT_SEARCH_PAGE));
  url.searchParams.set('order', params.order ?? 'DESC');
  url.searchParams.set('orderBy', params.orderBy ?? 'id');
  url.searchParams.set('sortBy', params.sortBy ?? 'id');
  if (params.extraQuery) {
    for (const [key, value] of Object.entries(params.extraQuery)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  const doFetch = async () => {
    const headers = await getBondAuthHeaders();
    return fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(60000),
    });
  };

  let response = await doFetch();
  if (response.status === 401) {
    await invalidateBondTokenCache();
    response = await doFetch();
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Reservations search API error: ${response.status} - ${text}`);
  }

  return response.json();
}

export async function tryFetchFacilityDisplayName(organizationId: number, facilityId: number): Promise<string | null> {
  const baseUrl = getBondApiBase();
  const paths = [
    `${baseUrl}/facilities/organization/${organizationId}/${facilityId}`,
    `${baseUrl}/organization/${organizationId}/facilities/${facilityId}`,
  ];
  const headers = await getBondAuthHeaders();
  for (const path of paths) {
    try {
      const res = await fetch(path, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const body: unknown = await res.json();
      if (body && typeof body === 'object' && 'name' in body && typeof (body as { name: unknown }).name === 'string') {
        return (body as { name: string }).name;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function tryFetchSpaceDisplayName(organizationId: number, spaceId: number): Promise<string | null> {
  const baseUrl = getBondApiBase();
  const paths = [
    `${baseUrl}/spaces/organization/${organizationId}/${spaceId}`,
    `${baseUrl}/organization/${organizationId}/spaces/${spaceId}`,
  ];
  const headers = await getBondAuthHeaders();
  for (const path of paths) {
    try {
      const res = await fetch(path, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const body: unknown = await res.json();
      if (body && typeof body === 'object') {
        const o = body as Record<string, unknown>;
        const name =
          o.name ??
          o.Name ??
          o.displayName ??
          o.DisplayName ??
          o.internalName ??
          o.InternalName;
        if (typeof name === 'string' && name.trim()) return name.trim();
      }
    } catch {
      continue;
    }
  }
  return null;
}
