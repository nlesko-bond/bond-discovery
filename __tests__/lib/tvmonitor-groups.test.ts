import { describe, it, expect } from 'vitest';
import { MAX_TV_SCHEDULE_GROUPS, normalizeTvMonitorConfig, resourceIdCapFor } from '@/lib/tvmonitor-config';
import {
  buildScheduleGroupColumns,
  buildResourceColors,
  buildFeedItems,
  UNGROUPED_COLUMN_KEY,
} from '@/lib/tvmonitor-schedule-format';
import type { TvMonitorScheduleBlock, TvMonitorSpace } from '@/types/tvmonitor';

function scheduleBlock(overrides: Partial<TvMonitorScheduleBlock> = {}): TvMonitorScheduleBlock {
  return normalizeTvMonitorConfig({ schedule: { viewMode: 'grouped', ...overrides } }).schedule;
}

function space(id: number, name: string, startTimes: string[] = []): TvMonitorSpace {
  return {
    id,
    name,
    slots: startTimes.map((startTime, i) => ({
      slotId: id * 100 + i,
      parentSlotId: null,
      reservationId: id * 100 + i,
      reservationName: `${name} @ ${startTime}`,
      date: '2026-01-15',
      endDate: '2026-01-15',
      startTime,
      endTime: '23:00:00',
      notes: null,
      spaceId: id,
      slotType: 'internal',
      isPrivate: false,
    })),
  };
}

describe('grouped view — config normalization', () => {
  it('keeps grouped on the generous feed cap, not the columns display cap', () => {
    expect(resourceIdCapFor('grouped')).toBe(resourceIdCapFor('feed'));
    expect(resourceIdCapFor('grouped')).toBeGreaterThan(resourceIdCapFor('columns'));

    // The regression that motivated the per-view caps: a 36-resource page must
    // survive a save in grouped view exactly as it does in feed view.
    const ids = Array.from({ length: 36 }, (_, i) => i + 1);
    const config = normalizeTvMonitorConfig({
      schedule: { viewMode: 'grouped', resourceIds: ids, groups: [{ id: 'g1', label: 'Courts', resourceIds: ids }] },
    });
    expect(config.schedule.resourceIds).toHaveLength(36);
    expect(config.schedule.groups[0].resourceIds).toHaveLength(36);
  });

  it('defaults groups to an empty array and accepts a valid grouped config', () => {
    expect(normalizeTvMonitorConfig({}).schedule.groups).toEqual([]);
    const config = normalizeTvMonitorConfig({
      schedule: {
        viewMode: 'grouped',
        resourceIds: [1, 2, 3, 4],
        groups: [
          { id: 'courts', label: 'Courts', resourceIds: [1, 2] },
          { id: 'pool', label: 'Pool Lanes', resourceIds: [3, 4] },
        ],
      },
    });
    expect(config.schedule.viewMode).toBe('grouped');
    expect(config.schedule.groups).toEqual([
      { id: 'courts', label: 'Courts', resourceIds: [1, 2] },
      { id: 'pool', label: 'Pool Lanes', resourceIds: [3, 4] },
    ]);
  });

  it('drops group references to resources that are no longer on the page', () => {
    const config = normalizeTvMonitorConfig({
      schedule: {
        viewMode: 'grouped',
        resourceIds: [1, 2],
        groups: [{ id: 'courts', label: 'Courts', resourceIds: [1, 2, 999] }],
      },
    });
    expect(config.schedule.groups[0].resourceIds).toEqual([1, 2]);
  });

  it('lets only the first group claim a duplicated resource', () => {
    const config = normalizeTvMonitorConfig({
      schedule: {
        viewMode: 'grouped',
        resourceIds: [1, 2, 3],
        groups: [
          { id: 'a', label: 'A', resourceIds: [1, 2] },
          { id: 'b', label: 'B', resourceIds: [2, 3] },
        ],
      },
    });
    expect(config.schedule.groups[0].resourceIds).toEqual([1, 2]);
    expect(config.schedule.groups[1].resourceIds).toEqual([3]);
  });

  it('caps group count and fills in missing ids/labels', () => {
    const config = normalizeTvMonitorConfig({
      schedule: {
        viewMode: 'grouped',
        resourceIds: [1],
        groups: [{}, {}, {}, {}, {}, {}],
      },
    });
    expect(config.schedule.groups).toHaveLength(MAX_TV_SCHEDULE_GROUPS);
    expect(config.schedule.groups[0].label).toBe('Group 1');
    expect(new Set(config.schedule.groups.map((g) => g.id)).size).toBe(MAX_TV_SCHEDULE_GROUPS);
  });

  it('survives garbage in the groups field', () => {
    expect(normalizeTvMonitorConfig({ schedule: { groups: 'nope' } }).schedule.groups).toEqual([]);
    const config = normalizeTvMonitorConfig({
      schedule: { viewMode: 'grouped', resourceIds: [1], groups: [null, 7, { id: 'ok', resourceIds: ['1', 'x'] }] },
    });
    expect(config.schedule.groups).toEqual([{ id: 'ok', label: 'Group 3', resourceIds: [1] }]);
  });

  it('preserves groups through a grouped → feed → grouped round-trip', () => {
    const grouped = {
      viewMode: 'grouped',
      resourceIds: [1, 2, 3],
      groups: [{ id: 'courts', label: 'Courts', resourceIds: [1, 2] }],
    };
    const asFeed = normalizeTvMonitorConfig({ schedule: { ...grouped, viewMode: 'feed' } });
    expect(asFeed.schedule.groups).toEqual(grouped.groups);
    const back = normalizeTvMonitorConfig({ schedule: { ...asFeed.schedule, viewMode: 'grouped' } });
    expect(back.schedule.groups).toEqual(grouped.groups);
  });
});

describe('buildScheduleGroupColumns', () => {
  const spaces = [space(1, 'Court 1'), space(2, 'Court 2'), space(3, 'Lane 1')];

  it('splits spaces into the configured columns, in group order', () => {
    const columns = buildScheduleGroupColumns(
      spaces,
      scheduleBlock({
        resourceIds: [1, 2, 3],
        groups: [
          { id: 'pool', label: 'Pool Lanes', resourceIds: [3] },
          { id: 'courts', label: 'Courts', resourceIds: [1, 2] },
        ],
      }),
    );
    expect(columns.map((c) => c.label)).toEqual(['Pool Lanes', 'Courts']);
    expect(columns[0].spaces.map((s) => s.name)).toEqual(['Lane 1']);
    expect(columns[1].spaces.map((s) => s.name)).toEqual(['Court 1', 'Court 2']);
  });

  it('collects unassigned resources into a trailing "Other" column rather than dropping them', () => {
    const columns = buildScheduleGroupColumns(
      spaces,
      scheduleBlock({ resourceIds: [1, 2, 3], groups: [{ id: 'courts', label: 'Courts', resourceIds: [1, 2] }] }),
    );
    expect(columns).toHaveLength(2);
    expect(columns[1].key).toBe(UNGROUPED_COLUMN_KEY);
    expect(columns[1].spaces.map((s) => s.name)).toEqual(['Lane 1']);
  });

  it('adds no "Other" column when every resource is assigned', () => {
    const columns = buildScheduleGroupColumns(
      spaces,
      scheduleBlock({
        resourceIds: [1, 2, 3],
        groups: [
          { id: 'courts', label: 'Courts', resourceIds: [1, 2] },
          { id: 'pool', label: 'Pool Lanes', resourceIds: [3] },
        ],
      }),
    );
    expect(columns.map((c) => c.key)).toEqual(['courts', 'pool']);
  });

  it('keeps a group with no returned spaces as an empty column', () => {
    const columns = buildScheduleGroupColumns(
      [space(1, 'Court 1')],
      scheduleBlock({
        resourceIds: [1, 2],
        groups: [
          { id: 'courts', label: 'Courts', resourceIds: [1] },
          { id: 'pool', label: 'Pool Lanes', resourceIds: [2] },
        ],
      }),
    );
    expect(columns).toHaveLength(2);
    expect(columns[1].spaces).toEqual([]);
  });
});

describe('buildFeedItems / buildResourceColors', () => {
  it('merges a group’s resources chronologically and tags each row with its resource', () => {
    const spaces = [space(1, 'Court 1', ['12:00:00', '08:00:00']), space(2, 'Court 2', ['10:00:00'])];
    const items = buildFeedItems(spaces, scheduleBlock(), buildResourceColors(spaces));
    expect(items.map((i) => i.startTime)).toEqual(['08:00:00', '10:00:00', '12:00:00']);
    expect(items.map((i) => i.spaceName)).toEqual(['Court 1', 'Court 2', 'Court 1']);
  });

  it('gives each resource a distinct color keyed by id, so two columns never collide', () => {
    const spaces = [space(1, 'Court 1'), space(2, 'Court 2'), space(3, 'Lane 1')];
    const colors = buildResourceColors(spaces);
    expect(new Set(colors.values()).size).toBe(3);
    // Stable per id regardless of which column a resource ends up in.
    expect(colors.get(3)).toBe(buildResourceColors(spaces).get(3));
  });
});
