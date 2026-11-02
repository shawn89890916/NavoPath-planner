/** Keep semver for updates; show the product's Beta label in version text. */
export function formatVersionLabel(version: string): string {
  return version.replace(/-beta(?:\.[0-9]+)?$/, " Beta");
}
