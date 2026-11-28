export type WeReadAction = "status" | "connect" | "test" | "disconnect" | "shelf" | "progress" | "statistics";
export type WeReadItem = {id:string;kind:"book"|"audio";title:string;author:string;cover?:string;readerLink?:string;private:boolean;finished:boolean;recent?:number};
export type WeReadProgress = {id:string;percent:number;seconds?:number;recent?:number;finished:boolean;started:boolean};
export type WeReadPeriod = "weekly"|"lastWeek"|"monthly"|"annually"|"overall";
export const WEREAD_CONNECTION_EVENT = "navopath:weread";
export type WeReadStatistics = {period:WeReadPeriod;base:number;totalSeconds:number;days:{day:number;seconds:number}[];readDays?:number};
export type WeReadResult = { ok: true; connected: boolean; checkedAt?: string; upgradeNotice?: boolean; connectionId?:string; shelf?:WeReadItem[]; progress?:WeReadProgress; statistics?:WeReadStatistics; counts?: { books: number; audiobooks: number; articles: number } } | { ok: false; code: string };
type DesktopBridge = { readingWeRead?: (scope: string, action: WeReadAction, candidate?: string) => Promise<WeReadResult> };
export function weReadDesktopAvailable(){return typeof window!=="undefined" && typeof (window.desktopApi as DesktopBridge|undefined)?.readingWeRead==="function";}
export async function requestWeRead(scope:string,action:WeReadAction,candidate?:string):Promise<WeReadResult>{
  const api=(window.desktopApi as DesktopBridge|undefined)?.readingWeRead;
  if(!api)return {ok:false,code:"desktop-only"};
  try{return await api(scope,action,candidate);}catch{return {ok:false,code:"unavailable"};}
}
