import { isPluginMcpDeclaration, isPluginMcpRecord, isSafePluginConfigKey, normalizePluginMcpAccess, pluginMcpGrant, SCHEDULE_TEMPLATE_PLUGIN } from "../../shared/pluginMcp.ts";

export const scheduleTemplateTools = ["list_schedule_templates", "create_schedule_template", "update_schedule_template"];

function installedPlugin(settings: Record<string, unknown>, owner: string) {
  const extensions = settings.extensions;
  if (!isPluginMcpRecord(extensions)) return undefined;
  const entry = isPluginMcpRecord(extensions.installed) ? extensions.installed[owner] : undefined;
  const removed = isPluginMcpRecord(extensions.removed) ? extensions.removed[owner] : undefined;
  if (!isPluginMcpRecord(entry) || !isPluginMcpRecord(entry.manifest) || entry.manifest.kind !== "plugin"
    || typeof entry.sha256 !== "string" || typeof entry.installedAt !== "string") return undefined;
  const updatedAt = typeof entry.updatedAt === "string" ? entry.updatedAt : entry.installedAt;
  if (typeof removed === "string" && Date.parse(removed) >= Date.parse(updatedAt)) return undefined;
  return { enabled: entry.enabled === true, sha256: entry.sha256, installedAt: entry.installedAt, manifest: entry.manifest };
}

export function hasScheduleTemplateAccess(settings: Record<string, unknown>): boolean {
  if (normalizePluginMcpAccess(settings.extensionMcpAccess)[SCHEDULE_TEMPLATE_PLUGIN] === false) return false;
  const installed = installedPlugin(settings, SCHEDULE_TEMPLATE_PLUGIN);
  if (installed) return installed.enabled;
  const extensions = settings.extensions;
  if (isPluginMcpRecord(extensions) && (
    (isPluginMcpRecord(extensions.removed) && Object.hasOwn(extensions.removed, SCHEDULE_TEMPLATE_PLUGIN))
    || (isPluginMcpRecord(extensions.installed) && Object.hasOwn(extensions.installed, SCHEDULE_TEMPLATE_PLUGIN))
  )) return false;
  return settings.featureTemplatesEnabled !== false;
}

export function pluginSettingsPermission(settings: Record<string, unknown>, owner: string) {
  const item = installedPlugin(settings, owner);
  if (!item?.enabled || !isPluginMcpDeclaration(item.manifest.mcp)) return undefined;
  const grant = pluginMcpGrant(item);
  if (normalizePluginMcpAccess(settings.extensionMcpAccess)[owner] !== grant) return undefined;
  return { owner, name: item.manifest.name, read: item.manifest.mcp.settings.read ?? [], write: item.manifest.mcp.settings.write ?? [] };
}

export function listPluginMcpCapabilities(settings: Record<string, unknown>) {
  const granted = Object.keys(normalizePluginMcpAccess(settings.extensionMcpAccess))
    .flatMap((owner) => {
      const permission = pluginSettingsPermission(settings, owner);
      return permission ? [permission] : [];
    });
  return {
    native: hasScheduleTemplateAccess(settings) ? [{ owner: SCHEDULE_TEMPLATE_PLUGIN, tools: scheduleTemplateTools }] : [],
    settings: granted,
  };
}

function configFor(settings: Record<string, unknown>, owner: string): Record<string, unknown> {
  const configs = settings.extensionConfigs;
  const config = isPluginMcpRecord(configs) ? configs[owner] : undefined;
  return isPluginMcpRecord(config) ? config : {};
}

export function readPluginSettings(settings: Record<string, unknown>, owner: string) {
  const permission = pluginSettingsPermission(settings, owner);
  if (!permission?.read.length) throw new Error("Read access not granted. Open Settings → Plugins → MCP access in NavoPath.");
  const config = configFor(settings, owner);
  return Object.fromEntries(permission.read.filter((key) => Object.hasOwn(config, key)).map((key) => [key, config[key]]));
}

function validJsonValue(value: unknown, depth: number): boolean {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") return value.length <= 10_000;
  if (typeof value === "number") return Number.isFinite(value);
  if (depth >= 8) return false;
  if (Array.isArray(value)) return value.length <= 5_000 && value.every((child) => validJsonValue(child, depth + 1));
  return isPluginMcpRecord(value) && Object.keys(value).length <= 5_000
    && Object.entries(value).every(([key, child]) => isSafePluginConfigKey(key) && validJsonValue(child, depth + 1));
}

export function writePluginSettings(settings: Record<string, unknown>, owner: string, patch: Record<string, unknown>, updatedAt: string) {
  const permission = pluginSettingsPermission(settings, owner);
  if (!permission?.write.length) throw new Error("Write access not granted. Open Settings → Plugins → MCP access in NavoPath.");
  const fields = Object.keys(patch);
  if (!fields.length || fields.some((field) => !permission.write.includes(field))) throw new Error("Patch contains no fields or fields outside the plugin's write permission");
  if (!validJsonValue(patch, 0)) throw new Error("Invalid plugin settings JSON");
  const config = { ...configFor(settings, owner), ...patch };
  if (Object.keys(config).length > 5_000 || JSON.stringify(config).length > 64 * 1024) throw new Error("Plugin settings exceed their storage limit");
  const configs = isPluginMcpRecord(settings.extensionConfigs) ? settings.extensionConfigs : {};
  if (!Object.hasOwn(configs, owner) && Object.keys(configs).length >= 100) throw new Error("Workspace plugin settings are at capacity");
  return {
    ...settings,
    extensionConfigs: { ...configs, [owner]: config },
    extensionConfigUpdatedAt: { ...(isPluginMcpRecord(settings.extensionConfigUpdatedAt) ? settings.extensionConfigUpdatedAt : {}), [owner]: updatedAt },
  };
}
