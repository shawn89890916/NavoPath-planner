export type ExtensionKind = "plugin" | "theme";
export type ExtensionPlatform = "desktop" | "web" | "mobile";
export interface ThemeOption { key: string; label: string; type: "color" | "number" | "string" | "boolean"; variable: string; default: string | number | boolean; min?: number; max?: number }
export interface ExtensionManifest {
  id: string; name: string; description: string; author: string; version: string;
  kind: ExtensionKind; apiVersion: number; minAppVersion: string; platforms: ExtensionPlatform[];
  main?: string; desktop?: string; styles?: string; preview?: string; previews?: { light: string; dark: string }; options?: ThemeOption[];
  /** Optional square, single-color SVG used by the market and host launcher. */
  icon?: string;
  repository?: string; license?: string;
}
export interface PackageFile { encoding: "utf8" | "base64"; data: string }
export interface ExtensionPackage { manifest: ExtensionManifest; files: Record<string, PackageFile> }
export interface ExtensionSource { id: string; name: string; url: string }
export interface CatalogEntry { manifest: ExtensionManifest; downloadUrl: string; sha256: string; sourceId: string; previewUrl?: string; previewUrls?: { light: string; dark: string }; iconUrl?: string; downloads?: number; publishedAt?: string }
export interface InstalledExtension {
  key: string; sourceId: string; manifest: ExtensionManifest; sha256: string; downloadUrl?: string;
  enabled: boolean; installedAt: string; updatedAt?: string; previous?: { manifest: ExtensionManifest; sha256: string; downloadUrl?: string };
}
export interface ExtensionPreferences {
  version: 1; sources: ExtensionSource[]; installed: Record<string, InstalledExtension>;
  removed: Record<string, string>; activeTheme: string | null; autoCheckUpdates: boolean; autoUpdate: boolean;
  headerOrder?: string[]; compactPlacements?: Record<string, "bottom" | "more" | "settings">; migratedLegacy?: boolean; migratedPlanningViews?: boolean; migratedShelfViews?: boolean; updatedAt?: string;
}
