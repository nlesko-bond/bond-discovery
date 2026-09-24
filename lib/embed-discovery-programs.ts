import { createBondClient, resolveBondApiKey } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cachedSWR, programsCacheKey } from '@/lib/cache';
import { sortProgramsForDisplay } from '@/lib/program-sort';
import {
  filterProgramsByPageConfig,
  filterProgramsWithActiveSessions,
  getProgramTypeScope,
  PROGRAMS_DISCOVERY_EXPAND,
} from '@/lib/discovery-program-scope';
import { mergeCompletedSeasons, resolveCompletedSeasonDays, todayYmd } from '@/lib/league-seasons';
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

/** Types fetched for completed seasons when the page has no type scope. */
const DEFAULT_COMPLETED_SEASON_TYPES = ['league', 'tournament', 'club_team'];

/**
 * Recently ended seasons for league-layout pages. Bond omits ended sessions
 * unless asked (`includePast`), so this is a separate, type-filtered call
 * under its own cache key — the shared programs key above is never touched.
 */
async function fetchPastProgramsForOrg(
  client: ReturnType<typeof createBondClient>,
  orgId: string,
  apiKey: string,
  bondEnv: string | undefined,
  cacheTtlSeconds: number,
  programTypes: string[],
): Promise<Program[]> {
  const cacheKey = `${programsDiscoveryCacheKey(orgId, apiKey, bondEnv)}:past:${programTypes.join(',')}`;
  const response = await cachedSWR(
    cacheKey,
    () =>
      client.getAllPrograms(orgId, {
        expand: PROGRAMS_DISCOVERY_EXPAND,
        includePast: true,
        programTypes,
      }),
    { ttl: cacheTtlSeconds },
  );
  return (response.data || []).map((raw) => ({
    ...transformProgram(raw),
    organizationId: orgId,
  }));
}

/**
 * Loads programs for a discovery page using the same rules as public
 * discovery routes: per-org fetch with cache, session end-date filter,
 * facility scope, and program include/exclude from page config.
 */
export async function fetchProgramsForDiscoveryPage(
  config: DiscoveryConfig,
): Promise<Program[]> {
  const apiKey = resolveBondApiKey(config.apiKey);
  if (!apiKey) {
    throw new Error(
      `No Bond API key for "${config.slug}": give the page an api_key, or a partner group that has one.`
    );
  }
  const bondEnv = config.features.bondEnv;
  const client = createBondClient(apiKey, bondEnv);
  const allPrograms: Program[] = [];
  const orgIds = config.organizationIds;
  const cacheTtlSeconds = Math.max(config.cacheTtl || 0, 4 * 60 * 60);

  const completedSeasonDays = resolveCompletedSeasonDays(config);
  const scopedTypes = getProgramTypeScope(config);
  const pastProgramTypes = scopedTypes.length > 0 ? scopedTypes : DEFAULT_COMPLETED_SEASON_TYPES;

  const promises = orgIds.map(async (orgId) => {
    try {
      const programs = await fetchProgramsForOrg(client, orgId, apiKey, bondEnv, cacheTtlSeconds);
      if (completedSeasonDays === 0) {
        return programs;
      }
      try {
        const pastPrograms = await fetchPastProgramsForOrg(
          client,
          orgId,
          apiKey,
          bondEnv,
          cacheTtlSeconds,
          pastProgramTypes,
        );
        return mergeCompletedSeasons(programs, pastPrograms, todayYmd(), completedSeasonDays);
      } catch (error) {
        // Completed seasons are extra; the live list still renders without them.
        console.error(`Error fetching completed seasons for org ${orgId}:`, error);
        return programs;
      }
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

  // Display order is applied after the per-org cache so the cached payload
  // stays in Bond's order and a config change never needs invalidation.
  return sortProgramsForDisplay(filtered, config.features);
}
