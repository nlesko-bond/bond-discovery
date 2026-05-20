# Bond Discovery — WordPress host shell (Phase 2)

Phase 1 ships `public/bond-host/v1.js` and [partner-host-integration.md](../../docs/partner-host-integration.md).

Phase 2 will add a plugin here:

- `[bond_host]` shortcode for discovery + shell mount
- Rewrite rule: `^programs/(.*)` → single template with `data-bond-host`

Until then, hosts can paste the HTML from the integration doc into a Custom HTML block and configure rewrites manually.
