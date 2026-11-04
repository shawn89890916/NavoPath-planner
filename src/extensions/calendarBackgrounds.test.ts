import manifest from "../../community-plugins/class-timetable/manifest.json";
import { compatibility } from "./packages";
import {describe,it,expect} from 'vitest';
import {registerCalendarBackground,isCalendarBackgroundVisible} from './calendarBackgrounds';
import {parseTimetableJson,mergeTimetable} from '../../community-plugins/class-timetable/parser';
import {expandTimedCalendarEvent} from '../utils/calendarEventSlices';
const input=JSON.stringify([{title:'Study',date:'2026-11-02',startTime:'09:30',endTime:'10:10'}]);
describe('timetable ownership and import',()=>{
 it('retains data while disabling and enabling independent providers',()=>{const e=parseTimetableJson(input)[0];const predicate=()=>true;expect(isCalendarBackgroundVisible(e)).toBe(false);const off=registerCalendarBackground(predicate),off2=registerCalendarBackground(predicate);expect(isCalendarBackgroundVisible(e)).toBe(true);off();off();expect(isCalendarBackgroundVisible(e)).toBe(true);off2();expect(isCalendarBackgroundVisible(e)).toBe(false);expect(e.title).toBe('Study');expect(isCalendarBackgroundVisible({...e,fixedCourse:false})).toBe(true);});
 it('deduplicates import and preserves task references and existing recurrence',()=>{const events=parseTimetableJson(input);const tasks:any[]=[];const data={events:[],tasks} as any;const first=mergeTimetable(data,events);expect(first.tasks).toBe(tasks);expect(mergeTimetable(first,parseTimetableJson(input))).toBe(first);});
 it('expands weekly classes at their original times without duplicating stored events',()=>{const event=parseTimetableJson(input)[0];event.recurrence={mode:'scheduled',frequency:'weekly',startDate:event.date,startTime:event.startTime,durationMinutes:40};const slices=expandTimedCalendarEvent(event,['2026-11-09','2026-11-16']);expect(slices.map(s=>[s.date,s.startTime,s.endTime])).toEqual([['2026-11-09','09:30','10:10'],['2026-11-16','09:30','10:10']]);});
 it('rejects invalid dates, reverse times and non-array documents',()=>{for(const value of ['{}',input.replace('2026-11-02','2026-02-30'),input.replace('10:10','09:00')])expect(()=>parseTimetableJson(value)).toThrow();});
});

it("accepts this timetable package on its declared host build",()=>{ expect(compatibility(manifest as any,"desktop")).toBe(null); });
