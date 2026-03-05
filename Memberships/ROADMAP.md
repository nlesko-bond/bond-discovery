# Membership Discovery - Roadmap & Future Features

## Current State (v1 - Coppermine)

- Fixed/seasonal memberships with start and end dates
- Single organization (Coppermine White Marsh, org 529)
- Categories: Family, Individual, Senior (configurable via overrides)
- Links open Bond registration in new tab
- Cache TTL: 15 min (configurable per page)
- Embed route exists at `/embed/memberships/[slug]`

---

## Near-Term: Template & Configurability Cleanup

### Generic Layout Template
- Remove Coppermine-specific hardcoding from components
- Make section headings configurable (e.g., "CHOOSE YOUR MEMBERSHIP" should come from config)
- Make info strip content dynamic based on what data is actually present
- Clean defaults for new orgs (neutral colors, no hero text, placeholder logo)

### More Configurable Fields
- Hero section: title, subtitle, background image/gradient (partially done via branding)
- Info strip: choose which stats to show (season dates, age range, price range, tax info)
- Section headings and CTAs
- Empty state messaging (configurable per page)

### Empty State Handling
- If zero memberships match filters, show a configurable friendly message
- Default: "No active memberships available right now. Check back soon!"
- Allow orgs to customize this text and optionally link to a contact page

---

## Medium-Term: Membership Type Support

### Rolling/Recurring Memberships
- Many orgs use monthly or yearly auto-renewing memberships (no fixed season)
- API field: `membershipType` can be `fix_membership` or `rolling_membership`
- `durationMonths` indicates the billing cycle (1 = monthly, 12 = yearly)
- `isAutoRenew` flag for auto-renewal
- UI needs to show billing frequency (e.g., "$37/mo" vs "$370/yr") instead of flat price

### Tier-Based Grouping
- Some orgs group memberships by tier (e.g., Gold vs Platinum at The Bridge WV)
- Each tier has its own set of individual/family/senior/youth options
- Need a way to configure "grouping mode": by category (current), by tier, or by both
- Tier info may come from tags, name patterns, or a configurable mapping

### Comparison/Benefits View
- The Bridge shows a comparison table of what's included per tier
- Could be a second layout option: "comparison" vs "list" (current)
- Benefits data would need to come from product descriptions or a configurable list

---

## Longer-Term: Embed & Integration

### Embed Improvements
- Current: `/embed/memberships/[slug]` renders a clean page suitable for iframing
- Add `target` config per page: `_blank` (new tab, current default) vs `_self` (navigate in iframe)
- URL override per membership: orgs with embedded Bond pages on their site can provide custom destination URLs instead of the default Bond registration link
- Consider postMessage API for iframe-to-parent communication (e.g., notify parent of navigation)

### Full Embedded Experience
- Some orgs embed the full membership purchase flow on their own domain
- Example: The Bridge has `/memberships/senior-platinum-monthly` as an embedded page
- Could support a mode where clicking a membership navigates within the same frame to a detail/purchase page
- Complex: requires coordination with the org's CMS and Bond's checkout flow
- Parking this for now -- link-out works for v1

### White-Label / Custom Domain
- Currently lives at `discovery.bondsports.co/memberships/[slug]`
- Future: support custom domains (e.g., `memberships.gocoppermine.com`)
- Would require Vercel domain configuration and DNS setup per org

---

## Admin Tool Enhancements

### API Response Flexibility
- The admin tool should handle any membership type from the API (fixed, rolling, etc.)
- Auto-detect membership characteristics and suggest appropriate display settings
- Preview mode: show what the page will look like before publishing

### Bulk Configuration
- Import/export page configs as JSON
- Clone an existing page config for a new org
- Template library: save and reuse layout/branding presets

### Analytics
- Track page views, click-through rates to registration
- Show which memberships get the most interest
- Dashboard in admin panel

---

## API Notes

Key fields from the Bond v4 memberships API that we may need to handle:

| Field | Fixed (Coppermine) | Rolling (The Bridge) |
|-------|-------------------|---------------------|
| `membershipType` | `fix_membership` | `rolling_membership` |
| `durationMonths` | `null` (season-based) | `1` (monthly) or `12` (yearly) |
| `startDate` / `endDate` | Season dates | May be open-ended |
| `isAutoRenew` | `false` | `true` |
| `registrationStartDate` | Specific window | Often always open |
| `customerTypes` | `["family"]`, `["individual"]` | Same |
| `tags` | Usually empty | May contain tier info |
| `package.parentProduct.prices` | Single season price | Recurring price |

---

## Reference Sites

- **Coppermine White Marsh** (current): Fixed seasonal pool memberships
  - `discovery.bondsports.co/memberships/coppermine`
- **The Bridge WV**: Rolling monthly/yearly, Gold/Platinum tiers
  - `thebridgewv.com/memberships`
  - Good example of tier comparison and embedded purchase pages
