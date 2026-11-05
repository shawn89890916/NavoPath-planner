/** Keep semver for updates; show the product's prerelease label in version text. */
export function formatVersionLabel(version: string): string {
  return version.replace(/^([0-9]+\.[0-9]+)\.[0-9]+-alpha\.([1-9][0-9]*)$/, "$1 Alpha $2").replace(/-beta(?:\.[0-9]+)?$/, " Beta");
}
