# Weather

Real current weather and daily high, low and precipitation from Open-Meteo.

Install from NavoPath Settings → Community plugins → Browse, then enable it.
All configuration is contributed by the installed plugin. Disabling or removing
the package releases its UI, timers, network listeners and commands.

Build and validate using `node scripts/build-extensions.mjs` and
`node scripts/build-extensions.mjs --check` from the repository root.

Choose a city using the Open-Meteo geocoding search; no location is assumed.
Current temperature, daily high/low and maximum precipitation probability are
fetched from Open-Meteo. Celsius/Fahrenheit and a 30-minute default refresh are
configurable. Last successful readings show their timestamp and a cache/offline
label on failure. Click the header to refresh; hover or focus for the timestamp.
A custom HTTPS Open-Meteo-compatible endpoint can use an API key stored only in
the plugin’s device-local storage. Forecast cache and ordinary settings sync.
Forecast and geocoding requests go directly to their configured providers.
