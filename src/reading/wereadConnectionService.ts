import {engine} from "../extensions/service";
import type {WeReadAction,WeReadResult} from "./wereadConnection";
export async function readingWeRead(action:WeReadAction,candidate?:string,expectedAccount?:string):Promise<WeReadResult>{
  return (await engine()).readingWeRead(action,candidate,expectedAccount);
}
