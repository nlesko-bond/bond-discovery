# Portal sport icons

Drop one SVG per sport here. The portal session card loads:

`/icons/sports/{sport_key}.svg`

`{sport_key}` is the normalized `SessionDto.sport` value (lowercase, spaces/hyphens → underscores), e.g.:

- `soccer.svg`
- `basketball.svg`
- `ice_hockey.svg`

If a file is missing, the app uses built-in sport silhouettes until your assets are added.

Recommended: 24×24 or 32×32 viewBox, single-color SVG (currentColor) for tinting on branded chips.
