import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { validateManifest, publicHttps } from "../src/extensions/packages.ts";
import { checkV2Boundary } from "./check-plugin-v2-boundary.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
// An optional lightweight plugin should never approach the generic 20 MiB import ceiling.
export const MAX_PREVIEW_PACKAGE_BYTES=256*1024;
export async function buildPluginPreview(id) {
  if(!/^[a-z0-9-]+$/.test(id))throw Error("Invalid preview id");
  await checkV2Boundary();
  const dir=resolve(root,"plugin-previews",id);
  const manifest=validateManifest(JSON.parse(await readFile(resolve(dir,"manifest.json"),"utf8")));
  if(manifest.apiVersion!==2 || manifest.id!==id || manifest.kind!=="plugin")throw Error("Invalid preview manifest");
  const result=await build({entryPoints:[resolve(dir,"main.ts")],bundle:true,format:"esm",platform:"browser",target:"es2022",minify:true,legalComments:"none",write:false,metafile:true});
  for(const input of Object.keys(result.metafile.inputs)){
    const rel=relative(dir,resolve(root,input));
    if(!rel || isAbsolute(rel) || rel===".." || rel.startsWith(".."+sep))throw Error("Unexpected bundled runtime dependency: "+input);
  }
  const data=JSON.stringify({manifest,files:{[manifest.main]:{encoding:"utf8",data:result.outputFiles[0].text},LICENSE:{encoding:"utf8",data:await readFile(resolve(dir,"LICENSE"),"utf8")}}},null,2)+"\n";
  if(Buffer.byteLength(data)>MAX_PREVIEW_PACKAGE_BYTES)throw Error("Preview package exceeds 256 KiB budget");
  return {manifest,data,sha256:createHash("sha256").update(data).digest("hex")};
}
/** Build an isolated protocol-2 catalog. No v1 file or repository state is modified. */
export async function buildPreviewCatalog(baseUrl, ids) {
  const base=new URL(publicHttps(baseUrl));
  if(base.search || base.hash || !base.pathname.endsWith("/"))throw Error("Expected an HTTPS catalog base directory");
  const names=ids??(await readdir(resolve(root,"plugin-previews"),{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
  if(new Set(names).size!==names.length)throw Error("Duplicate preview ID");
  const artifacts=[],packages=[];
  for(const id of [...names].sort()){
    const pkg=await buildPluginPreview(id);
    const filename="packages-v2/"+id+"-"+pkg.manifest.version+"-"+pkg.sha256+".navopackage.json";
    artifacts.push({filename,data:pkg.data});
    packages.push({manifest:pkg.manifest,downloadUrl:new URL(filename,base).href,sha256:pkg.sha256});
  }
  return {catalog:{version:2,name:"NavoPath Protocol 2 Preview",packages},artifacts};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [, ,id,output,base]=process.argv;
  if(id==="--catalog"){
    if(!output || !base)throw Error("Usage: --catalog <staging-directory> <https-base-directory>");
    const target=resolve(output),protectedRoot=resolve(root,"public","extensions");
    const rel=relative(protectedRoot,target);
    if(rel==="" || (!isAbsolute(rel)&&rel!==".."&&!rel.startsWith(".."+sep)))throw Error("Stage preview catalogs outside the official live extension directory");
    const {catalog,artifacts}=await buildPreviewCatalog(base);
    for(const artifact of artifacts){const path=resolve(target,artifact.filename);await mkdir(dirname(path),{recursive:true});await writeFile(path,artifact.data);}
    await mkdir(target,{recursive:true});await writeFile(resolve(target,"catalog-v2.json"),JSON.stringify(catalog,null,2)+"\n");
    console.log("Staged protocol 2 catalog with "+artifacts.length+" immutable packages.");
  }else{
    if(!id||!output)throw Error("Usage: build-plugin-preview.mjs <id> <output-file>");
    const pkg=await buildPluginPreview(id);await writeFile(output,pkg.data);console.log(pkg.sha256);
  }
}
