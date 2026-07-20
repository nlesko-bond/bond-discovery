import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetServerSession = vi.fn();
vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

const mockGetPageBySlug = vi.fn();
const mockGetAllPages = vi.fn();
const mockCreatePage = vi.fn();
vi.mock('@/lib/tvmonitor-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tvmonitor-config')>();
  return {
    ...actual,
    getTvMonitorPageBySlug: (...args: unknown[]) => mockGetPageBySlug(...args),
    getAllTvMonitorPages: (...args: unknown[]) => mockGetAllPages(...args),
    createTvMonitorPage: (...args: unknown[]) => mockCreatePage(...args),
  };
});

const mockGetSchedule = vi.fn();
vi.mock('@/lib/tvmonitor-schedule', () => ({
  getTvMonitorSchedule: (...args: unknown[]) => mockGetSchedule(...args),
}));

vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => undefined }),
}));

import { GET as GET_SCHEDULE } from '@/app/api/tvmonitor/[slug]/schedule/route';
import { GET as GET_ADMIN_LIST } from '@/app/api/admin/tvmonitor/route';
import { normalizeTvMonitorConfig } from '@/lib/tvmonitor-config';

const PAGE = {
  id: 'p-1',
  slug: 'hatfield-lobby',
  name: 'Hatfield Lobby',
  is_active: true,
  organization_id: 61,
  facility_id: 289,
  config: normalizeTvMonitorConfig({ schedule: { resourceIds: [2191, 2192], futureHoursLimit: 6 } }),
  created_by: null,
  created_at: '',
  updated_at: '',
};

const SCHEDULE = { facilityId: 289, facilityName: "Nicole's Facility", spaces: [], fetchedAt: 'now' };

function scheduleRequest(slug = 'hatfield-lobby') {
  return new NextRequest(`http://localhost/api/tvmonitor/${slug}/schedule`);
}

describe('GET /api/tvmonitor/[slug]/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSchedule.mockResolvedValue(SCHEDULE);
  });

  it('returns 404 for unknown slugs', async () => {
    mockGetPageBySlug.mockResolvedValue(null);
    const res = await GET_SCHEDULE(scheduleRequest('nope'), { params: { slug: 'nope' } });
    expect(res.status).toBe(404);
  });

  it('returns 404 for inactive pages', async () => {
    mockGetPageBySlug.mockResolvedValue({ ...PAGE, is_active: false });
    const res = await GET_SCHEDULE(scheduleRequest(), { params: { slug: PAGE.slug } });
    expect(res.status).toBe(404);
  });

  it('returns config + schedule using the page data scope', async () => {
    mockGetPageBySlug.mockResolvedValue(PAGE);
    const res = await GET_SCHEDULE(scheduleRequest(), { params: { slug: PAGE.slug } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config.schedule.resourceIds).toEqual([2191, 2192]);
    expect(body.schedule.facilityName).toBe("Nicole's Facility");
    expect(mockGetSchedule).toHaveBeenCalledWith(61, 289, [2191, 2192], 6);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('admin TV monitor routes require admin auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('ADMIN_AUTH_BYPASS', '');
    vi.stubEnv('NEXT_PUBLIC_ADMIN_AUTH_BYPASS', '');
    mockGetServerSession.mockResolvedValue(null);
  });

  it('GET /api/admin/tvmonitor returns 401 with no session', async () => {
    const res = await GET_ADMIN_LIST();
    expect(res.status).toBe(401);
    expect(mockGetAllPages).not.toHaveBeenCalled();
  });

  it('GET /api/admin/tvmonitor returns pages for an admin session', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'admin@bondsports.co' } });
    mockGetAllPages.mockResolvedValue([PAGE]);
    const res = await GET_ADMIN_LIST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pages).toHaveLength(1);
  });
});
