# Portal sport icons

Drop Bond sport SVGs in this folder. The portal loads:

`/icons/sports/icn-sport-{sport-key}.svg`

`{sport-key}` is normalized from `SessionDto.sport`: lowercase, underscores become hyphens.

Examples:

- `icn-sport-soccer.svg` for `soccer`
- `icn-sport-basketball.svg` for `basketball`
- `icn-sport-ice-hockey.svg` for `ice_hockey` or `ice hockey`

If a file is missing, built-in silhouettes are used as fallback.

Recommended: 24×24 or 32×32 viewBox, single-color SVG (`currentColor`) for tinting on branded chips.
