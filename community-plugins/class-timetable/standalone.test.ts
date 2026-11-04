import {describe,it,expect} from 'vitest';
import plugin from './main';
import manifest from './manifest.json';
import {compatibility} from '../../src/extensions/packages';
describe('standalone official host compatibility',()=>{
 it('passes the released loader version check without changing the host',()=>{expect(compatibility(manifest as any,'desktop')).toBeNull();expect(compatibility(manifest as any,'web')).toBeNull();});
 it('rejects missing background capability before registering or writing',()=>{let registrations=0;const ctx={language:'zh',calendar:{},settings:{registerPage:()=>{registrations++;}},app:{saveData:()=>{throw Error('unexpected write');}}};expect(()=>plugin.onload(ctx)).toThrow(/1.6.2/);expect(registrations).toBe(0);});
 it('uses the host background API and registers the import page',()=>{let predicate:any,page:any;plugin.onload({language:'zh',calendar:{registerBackground:(p:any)=>{predicate=p;}},settings:{registerPage:(_n:any,p:any)=>{page=p;}}});expect(predicate({fixedCourse:true})).toBe(true);expect(predicate({fixedCourse:false})).toBe(false);expect(typeof page).toBe('function');});
});
