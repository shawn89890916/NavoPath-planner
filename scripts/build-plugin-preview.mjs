import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { validateManifest } from "../src/extensions/packages.ts";
import { checkV2Boundary } from "./check-plugin-v2-boundary.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export async function buildPluginPreview(id) {
  if(!/^[a-z0-9-]+$/.test(id))throw Error("Invalid preview id");
  await checkV2Boundary();
  const dir=resolve(root,"plugin-previews",id);
  const manifest=validateManifest(JSON.parse(await readFile(resolve(dir,"manifest.json"),"utf8")));
  if(manifest.apiVersion!==2 || manifest.id!==id || manifest.kind!=="plugin")throw Error("Invalid preview manifest");
  const result=await build({entryPoints:[resolve(dir,"main.ts")],bundle:true,format:"esm",platform:"browser",target:"es2022",minify:true,legalComments:"none",write:false,metafile:true});
  for(const input of Object.keys(result.metafile.inputs))if(!resolve(input).startsWith(dir+"/") && !resolve(input).startsWith(dir+"\\"))throw Error("Unexpected bundled runtime dependency: "+input);
  const data=JSON.stringify({manifest,files:{[manifest.main]:{encoding:"utf8",data:result.outputFiles[0].text},LICENSE:{encoding:"utf8",data:await readFile(resolve(dir,"LICENSE"),"utf8")}}},null,2)+"\n";
  return {data,sha256:createHash("sha256").update(data).digest("hex")};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [, ,id,output]=process.argv;if(!id||!output)throw Error("Usage: build-plugin-preview.mjs <id> <output-file>");
  const pkg=await buildPluginPreview(id);await writeFile(output,pkg.data);console.log(pkg.sha256);
}
