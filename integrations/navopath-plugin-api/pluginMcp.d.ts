export type PluginMcpSettings = { read?: string[]; write?: string[] };
export type PluginMcpDeclaration = { settings: PluginMcpSettings };
export type PluginMcpAccess = Record<string, string | false>;
