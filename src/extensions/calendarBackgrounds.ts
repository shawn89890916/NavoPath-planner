import type { CalendarEvent } from '../types';
const providers=new Set<(event:CalendarEvent)=>boolean>();
export function registerCalendarBackground(predicate:(event:CalendarEvent)=>boolean){const owned=(event:CalendarEvent)=>predicate(event);providers.add(owned);return()=>{providers.delete(owned);};}
export function isCalendarBackgroundVisible(event:CalendarEvent){return !event.fixedCourse||[...providers].some(test=>test(event));}
