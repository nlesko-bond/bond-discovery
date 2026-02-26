/**
 * Bond v4 API client for memberships.
 * Uses Cognito auth headers (NOT the public API key).
 */

import { getBondAuthHeaders, getBondApiBase } from './bond-auth';
import { MembershipApiResponse } from '@/types/membership';

interface GetMembershipsOptions {
  includeDependentProducts?: boolean;
  productSubTypes?: string;
  itemsPerPage?: number;
  page?: number;
  order?: 'ASC' | 'DESC';
  orderBy?: string;
}

export async function getMemberships(
  orgId: number,
  options: GetMembershipsOptions = {}
): Promise<MembershipApiResponse> {
  const {
    includeDependentProducts = true,
    productSubTypes = 'gating_membership',
    itemsPerPage = 40,
    page = 1,
    order = 'ASC',
    orderBy = 'name',
  } = options;

  const baseUrl = getBondApiBase();
  const url = new URL(`${baseUrl}/membership/organization/${orgId}/memberships`);

  url.searchParams.set('includeDependentProducts', String(includeDependentProducts));
  url.searchParams.set('productSubTypes', productSubTypes);
  url.searchParams.set('itemsPerPage', String(itemsPerPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('order', order);
  url.searchParams.set('orderBy', orderBy);
  url.searchParams.set('organizationId', String(orgId));

  const headers = await getBondAuthHeaders();

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Memberships API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch all pages of memberships (handles pagination)
 */
export async function getAllMemberships(
  orgId: number,
  options: Omit<GetMembershipsOptions, 'page'> = {}
): Promise<MembershipApiResponse> {
  const firstPage = await getMemberships(orgId, { ...options, page: 1 });

  if (firstPage.meta.totalPages <= 1) {
    return firstPage;
  }

  const allData = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.totalPages; page++) {
    const nextPage = await getMemberships(orgId, { ...options, page });
    allData.push(...nextPage.data);
  }

  return {
    meta: { ...firstPage.meta, currentPage: 1, totalPages: 1 },
    data: allData,
  };
}
