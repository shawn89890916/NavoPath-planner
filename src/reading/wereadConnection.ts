export type WeReadAction = "status" | "connect" | "test" | "disconnect";
export type WeReadResult = { ok: true; connected: boolean; checkedAt?: string; upgradeNotice?: boolean; counts?: { books: number; audiobooks: number; articles: number } } | { ok: false; code: string };
type DesktopBridge = { readingWeRead?: (scope: string, action: WeReadAction, candidate?: string) => Promise<WeReadResult> };
export function weReadDesktopAvailable(){return typeof window!=="undefined" && typeof (window.desktopApi as DesktopBridge|undefined)?.readingWeRead==="function";}
export async function requestWeRead(scope:string,action:WeReadAction,candidate?:string):Promise<WeReadResult>{
  const api=(window.desktopApi as DesktopBridge|undefined)?.readingWeRead;
  if(!api)return {ok:false,code:"desktop-only"};
  try{return await api(scope,action,candidate);}catch{return {ok:false,code:"unavailable"};}
}
