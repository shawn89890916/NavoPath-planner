export function isPasswordRecoveryCallback(url: URL) {
  const fragment = new URLSearchParams(url.hash.slice(1));
  return url.searchParams.get("auth_callback") === "recovery"
    || url.searchParams.get("type") === "recovery"
    || fragment.get("type") === "recovery";
}
