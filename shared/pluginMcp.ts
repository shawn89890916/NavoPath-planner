export const SCHEDULE_TEMPLATE_PLUGIN = "official:schedule-templates";
export const PLUGIN_OWNER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}:[a-z0-9][a-z0-9._-]{0,79}$/;

const unsafeKeys = new Set(["__proto__", "prototype", ...Object.getOwnPropertyNames(Object.prototype)]);
export const isSafePluginConfigKey = (key: string) => key.length > 0 && key.length <= 100 && !unsafeKeys.has(key);

export type PluginMcpSettings = { read?: string[]; write?: string[] };
export type PluginMcpDeclaration = { settings: PluginMcpSettings };
export type PluginMcpAccess = Record<string, string | false>;

export function isPluginMcpRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validFields(fields: unknown): fields is string[] {
  return Array.isArray(fields) && fields.length <= 24 && fields.every(
    (field) => typeof field === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(field)
      && isSafePluginConfigKey(field),
  ) && new Set(fields).size === fields.length;
}

export function isPluginMcpDeclaration(value: unknown): value is PluginMcpDeclaration {
  if (!isPluginMcpRecord(value) || Object.keys(value).some((key) => key !== "settings")) return false;
  const settings = value.settings;
  if (!isPluginMcpRecord(settings) || Object.keys(settings).some((key) => key !== "read" && key !== "write")) return false;
  return (settings.read === undefined || validFields(settings.read))
    && (settings.write === undefined || validFields(settings.write))
    && Boolean((settings.read as string[] | undefined)?.length || (settings.write as string[] | undefined)?.length);
}

export function pluginMcpGrant(item: { sha256: string; installedAt: string; manifest: { mcp?: unknown } | Record<string, unknown> }): string | undefined {
  if (!isPluginMcpDeclaration(item.manifest.mcp)) return undefined;
  const { read = [], write = [] } = item.manifest.mcp.settings;
  return JSON.stringify([item.sha256, item.installedAt, [...read].sort(), [...write].sort()]);
}

export function normalizePluginMcpAccess(input: unknown): PluginMcpAccess {
  if (!isPluginMcpRecord(input)) return {};
  return Object.fromEntries(Object.entries(input).filter(([owner, grant]) =>
    PLUGIN_OWNER_PATTERN.test(owner) && (grant === false || (typeof grant === "string" && grant.length <= 4096)),
  )) as PluginMcpAccess;
}
