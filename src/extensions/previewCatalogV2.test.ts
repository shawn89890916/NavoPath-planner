import { describe, expect, it } from "vitest";
import { readV2PreviewCatalog } from "./previewCatalogV2";
const hash="a".repeat(64);
const manifest={id:"sample",name:"Sample",description:"Preview",author:"NavoPath",version:"2.0.0",kind:"plugin",apiVersion:2,minAppVersion:"1.7.0-beta.141",platforms:["web"],main:"main.js",permissions:["tasks.read"]};
const entry={manifest,sha256:hash,downloadUrl:"https://navopath.com/extensions-preview/packages-v2/sample-2.0.0-"+hash+".navopackage.json"};
describe("isolated V2 catalog",()=>{
  it("accepts only valid official content-addressed packages",()=>{
    expect(readV2PreviewCatalog({version:2,packages:[entry]})).toEqual([{...entry,sourceId:"official"}]);
    for(const bad of [{...entry,downloadUrl:"https://example.com/package"},{...entry,downloadUrl:entry.downloadUrl+"?x=1"},{...entry,manifest:{...manifest,apiVersion:1}},{...entry,sha256:"b".repeat(64)}])expect(()=>readV2PreviewCatalog({version:2,packages:[bad]})).toThrow();
    expect(()=>readV2PreviewCatalog({version:1,packages:[entry]})).toThrow();
    expect(()=>readV2PreviewCatalog({version:2,packages:[entry,entry]})).toThrow();
  });
});
