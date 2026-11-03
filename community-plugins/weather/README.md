# Weather

Real current weather and daily high, low and precipitation from Open-Meteo.

Install from NavoPath Settings → Community plugins → Browse, then enable it.
All configuration is contributed by the installed plugin. Disabling or removing
the package releases its UI, timers, network listeners and commands.

Build and validate using `node scripts/build-extensions.mjs` and
`node scripts/build-extensions.mjs --check` from the repository root.

Choose a city using the Open-Meteo/GeoNames geocoding search; no location is assumed.
Chinese city searches check administrative suffix variants (for example, 温州 /
温州市 and 北京市 / 北京). Results retain the provider’s real coordinates and
administrative labels. If a translated alias is absent from GeoNames, try the
local or English name. No fallback provider or location dataset is downloaded.
Current temperature, daily high/low and maximum precipitation probability are
fetched from Open-Meteo. Celsius/Fahrenheit and a 30-minute default refresh are
configurable. Last successful readings show their timestamp and a cache/offline
label on failure. The header shows only the city name; click or use Enter/Space
to expand the current reading, daily forecast, timestamp and refresh action.
The panel stays within the viewport and closes with Escape or an outside click.
A custom HTTPS Open-Meteo-compatible endpoint can use an API key stored only in
the plugin’s device-local storage. Forecast cache and ordinary settings sync.
Forecast and geocoding requests go directly to their configured providers.
