# Chinese city aliases

`city-aliases.json` is derived from [GeoNames cities15000](https://download.geonames.org/export/dump/cities15000.zip), retrieved 2026-11-03. GeoNames geographical data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); attribution: [GeoNames](https://www.geonames.org/). See the [dataset schema](https://download.geonames.org/export/dump/readme.txt).

The index keeps Han-script alternate names for cities with a recorded population of at least 500,000, retaining up to three GeoNames identifiers per alias in descending population order. City/county/district suffixes are also indexed without their final character; 紐/約 variants are added for simplified 纽约. It contains names and identifiers, without forecast data or fallback coordinates. The plugin resolves identifiers using Open-Meteo's real geocoding endpoint and retains ordinary geocoding searches for other locations.

Regenerate with `node scripts/update-weather-city-aliases.mjs`, review changes, update the retrieval date here, then run `npm run extensions:build`. This command is intentionally separate from reproducible application builds.
