import text0 from "../../public/extensions/packages/linen.navopackage.json?raw";
import text1 from "../../public/extensions/packages/pomodoro.navopackage.json?raw";
import text2 from "../../public/extensions/packages/weather.navopackage.json?raw";
import catalog from "../../public/extensions/catalog.json";
import type { ExtensionPackage } from "./types";
export const officialCatalog = catalog;
export const officialPackageTexts: Record<string, string> = { "linen": text0, "pomodoro": text1, "weather": text2 };
export const officialPackages: Record<string, ExtensionPackage> = Object.fromEntries(Object.entries(officialPackageTexts).map(([id,text])=>[id,JSON.parse(text) as ExtensionPackage]));
