# Facility-schedule link

Blends reservation slots from a facility-schedule-v2 page into a discovery
page's schedule tab. Built for Palm Beach Skate Zone; opt-in per page.

## How it works

```
fsv2  GET /api/schedule/{fsv2Slug}/slots?types=reservation   (versioned contract, FEED_VERSION 1)
  └─ discovery  lib/facility-schedule-link.ts  (SWR cache: 5 min TTL, 4 h stale shadow)
       └─ GET /api/facility-slots?slug={discoverySlug}
            └─ useFacilityScheduleEvents() in all three shells
               (HostPortalDiscoveryPage, HostPortalV2Page, legacy DiscoveryPage;
                fetch deferred until the schedule surface is shown)
                 └─ merged ahead of event filtering → schedule tab only
```

- **Config:** `features.facilityScheduleSlug` (admin → page editor → Data section;
  pasted URLs are normalized to the slug), optional
  `features.facilityScheduleSlotTypes` (default `['reservation']`; only
  `reservation`/`maintenance` accepted — program/league would double-render
  against discovery's own pipeline).
- **Rule precedence:** fsv2's data rules (approval filtering, space rollups,
  private-event hide/placeholder + note stripping, title overrides,
  public-notes gating) are applied inside `buildSlotsFeed` at the source and
  must never be re-derived here. Discovery applies presentation only
  (filters, views, date horizon). Private slots default to hidden in the feed.
- **Caching:** key `facilitysched:events:{baseUrlHash}:{fsv2Slug}:{types}` —
  the base-URL hash keeps preview/local runs (which share production KV) from
  poisoning each other. An empty fresh fetch carries the previous non-empty
  payload forward for one cycle (empty-write guard), so a transient empty-200
  from fsv2 can't wipe the stale shadow; a genuinely emptied schedule
  converges to empty on the next cycle.
- **Event mapping:** feed slots become `IDiscoveryApiEvent`s with id prefix
  `fsched-`, `type: 'rental'` (renders the existing "Rental" chip), and no
  `linkSEO`, so no register button appears (including under
  `customRegistrationUrl`).
- **Isolation:** `/api/events` response shape and the `discovery:response:{slug}`
  warm pipeline are untouched. A feed failure returns `{ data: [] }` (503) and
  the schedule tab degrades to programs-only.
- **Env:** `FACILITY_SCHEDULE_BASE_URL` (optional, default
  `https://schedule.bondsports.co`).

## fsv2 side

`src/app/api/schedule/[slug]/slots/route.ts` + `src/lib/schedule-feed.ts` in
facility-schedule-v2. Same cache → hydrate → last-good → stale fallback chain
as the parent `/api/schedule/[slug]` route. Slots carry `startAt`/`endAt` UTC
instants converted from the slot's local time via its resolved timezone.
Breaking shape changes must bump `FEED_VERSION` on both sides.

This contract is the seed of the future unified schedule service (slot spine +
program enrichment); the link is retired by pointing discovery at that service.
