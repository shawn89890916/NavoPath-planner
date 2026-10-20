/** Theme-dependent display ink; the saved project color remains unchanged. */
export function projectColorInk(color: string) {
  return `oklch(from ${color} clamp(var(--project-color-lightness-min, 0), l, var(--project-color-lightness-max, 1)) calc(c * var(--project-color-chroma, 1)) h)`;
}
