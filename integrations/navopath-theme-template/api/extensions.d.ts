export type ExtensionKind = "plugin" | "theme";
export type ExtensionPlatform = "desktop" | "web" | "mobile";
export interface ThemeOption { key: string; label: string; type: "color" | "number" | "string" | "boolean"; variable: string; default: string | number | boolean; min?: number; max?: number }
export interface ExtensionManifest {
  id: string; name: string; description: string; author: string; version: string;
  kind: ExtensionKind; apiVersion: number; minAppVersion: string; platforms: ExtensionPlatform[];
  main?: string; desktop?: string; styles?: string; options?: ThemeOption[];
  repository?: string; license?: string;
}
export interface PackageFile { encoding: "utf8" | "base64"; data: string }
export interface ExtensionPackage { manifest: ExtensionManifest; files: Record<string, PackageFile> }
export interface ExtensionSource { id: string; name: string; url: string }
export interface CatalogEntry { manifest: ExtensionManifest; downloadUrl: string; sha256: string; sourceId: string }
export interface InstalledExtension {
  key: string; sourceId: string; manifest: ExtensionManifest; sha256: string; downloadUrl?: string;
  enabled: boolean; installedAt: string; updatedAt?: string; previous?: { manifest: ExtensionManifest; sha256: string; downloadUrl?: string };
}
export interface ExtensionPreferences {
  version: 1; sources: ExtensionSource[]; installed: Record<string, InstalledExtension>;
  removed: Record<string, string>; activeTheme: string | null; autoCheckUpdates: boolean; autoUpdate: boolean;
  migratedLegacy?: boolean; updatedAt?: string;
}
