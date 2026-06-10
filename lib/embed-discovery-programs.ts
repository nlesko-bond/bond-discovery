import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cachedSWR, programsCacheKey } from '@/lib/cache';
import {
  filterProgramsByPageConfig,
  filterProgramsWithActiveSessions,
  PROGRAMS_DISCOVERY_EXPAND,
} from '@/lib/discovery-program-scope';
import type { DiscoveryConfig, Program } from '@/types';

/**
 * Same KV key as GET /api/programs (no expand suffix). A separate suffixed key was
 * introduced in d15da33 and cold-started empty/partial while /api/programs kept
 * serving good data — split-brain for page SSR vs the programs API.
 */
function programsDiscoveryCacheKey(
  orgId: string,
  apiKey: string,
  bondEnv: string | undefined,
): string {
  return programsCacheKey(orgId, undefined, apiKey, bondEnv);
}

async function fetchProgramsForOrg(
  client: ReturnType<typeof createBondClient>,
  orgId: string,
  apiKey: string,
  bondEnv: string | undefined,
  cacheTtlSeconds: number,
): Promise<Program[]> {
  const cacheKey = programsDiscoveryCacheKey(orgId, apiKey, bondEnv);

  // SWR: programs expiry (4h TTL) never blocks a user request as long as
  // the shadow key (2x TTL = 8h) still holds data.
  const response = await cachedSWR(
    cacheKey,
    async () => {
      try {
        return await client.getPrograms(orgId, { expand: PROGRAMS_DISCOVERY_EXPAND });
      } catch (primaryError) {
        console.error(
          `[fetchProgramsForDiscoveryPage] expand failed for org ${orgId}, retrying lighter expand`,
          primaryError,
        );
        return client.getPrograms(orgId, { expand: 'sessions,sessions.products' });
      }
    },
    { ttl: cacheTtlSeconds },
  );

  const rawPrograms = response.data || [];
  if (rawPrograms.length === 0) {
    console.warn(`[fetchProgramsForDiscoveryPage] Bond returned 0 programs for org ${orgId}`);
  }

  const programs = rawPrograms.map((raw) => ({
    ...transformProgram(raw),
    organizationId: orgId,
  }));

  return filterProgramsWithActiveSessions(programs);
}

/**
 * Loads programs for a discovery page using the same rules as public
 * discovery routes: per-org fetch with cache, session end-date filter,
 * facility scope, and program include/exclude from page config.
 */
export async function fetchProgramsForDiscoveryPage(
  config: DiscoveryConfig,
): Promise<Program[]> {
  const apiKey = config.apiKey || DEFAULT_API_KEY;
  const bondEnv = config.features.bondEnv;
  const client = createBondClient(apiKey, bondEnv);
  const allPrograms: Program[] = [];
  const orgIds = config.organizationIds;
  const cacheTtlSeconds = Math.max(config.cacheTtl || 0, 4 * 60 * 60);

  const promises = orgIds.map(async (orgId) => {
    try {
      return await fetchProgramsForOrg(client, orgId, apiKey, bondEnv, cacheTtlSeconds);
    } catch (error) {
      console.error(`Error fetching programs for org ${orgId}:`, error);
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach((programs) => allPrograms.push(...programs));

  let filtered =
    config.facilityIds && config.facilityIds.length > 0
      ? allPrograms.filter(
          (program) => program.facilityId && config.facilityIds!.includes(program.facilityId),
        )
      : allPrograms;

  filtered = filterProgramsByPageConfig(filtered, config);

  return filtered;
}
