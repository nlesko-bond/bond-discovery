import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cached, programsCacheKey } from '@/lib/cache';
import type { DiscoveryConfig, Program } from '@/types';

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
  const today = new Date().toISOString().split('T')[0];

  const promises = orgIds.map(async (orgId) => {
    try {
      const cacheKey = programsCacheKey(orgId, undefined, apiKey, config.features.bondEnv);

      const response = await cached(
        cacheKey,
        () => client.getPrograms(orgId),
        { ttl: Math.max(config.cacheTtl || 0, 4 * 60 * 60) },
      );

      const programs = (response.data || []).map((raw) => ({
        ...transformProgram(raw),
        organizationId: orgId,
      }));

      programs.forEach((program) => {
        if (program.sessions) {
          program.sessions = program.sessions.filter((session) => {
            if (!session.endDate) return true;
            return session.endDate >= today;
          });
        }
      });

      return programs.filter((p) => !p.sessions || p.sessions.length > 0);
    } catch (error) {
      console.error(`Error fetching programs for org ${orgId}:`, error);
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach((programs) => allPrograms.push(...programs));

  let filtered =
    config.facilityIds && config.facilityIds.length > 0
      ? allPrograms.filter((p) => p.facilityId && config.facilityIds!.includes(p.facilityId))
      : allPrograms;

  const mode = config.features.programFilterMode || 'all';
  const excluded = config.excludedProgramIds || [];
  const included = config.includedProgramIds || [];

  if (mode === 'include' && included.length > 0) {
    filtered = filtered.filter((p) => included.includes(p.id));
  } else if (mode === 'exclude' && excluded.length > 0) {
    filtered = filtered.filter((p) => !excluded.includes(p.id));
  }

  return filtered;
}
