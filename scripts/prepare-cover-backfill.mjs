// Offline-only preparation; never receives account credentials or writes Storage.
// npm install --no-save playwright@1.58.0 && npx playwright install chromium
// node scripts/prepare-cover-backfill.mjs /absolute/path/to/inventory.json
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createCoverDerivatives,derivativeWidths} from '../systems/community/cover-derivatives.mjs';
import {inspectRaster} from '../supabase/functions/fas-studio-cover/handler.mjs';

if(process.argv.length!==3)throw Error('Supply an inventory JSON file.');
const inventoryPath=path.resolve(process.argv[2]),root=path.dirname(inventoryPath),assets=JSON.parse(await readFile(inventoryPath,'utf8'));
if(!Array.isArray(assets)||!assets.length||assets.length>100)throw Error('Prepare 1-100 inventoried covers at a time.');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),report=[],browser=await chromium.launch();
try{
 const page=await browser.newPage();
 for(const asset of assets){
  if(!/^[a-f0-9-]{36}$/.test(asset.id)||!['dev','prod'].includes(asset.project)||typeof asset.masterFile!=='string'||path.basename(asset.masterFile)!==asset.masterFile||!/^[a-zA-Z0-9_-]+\.jpg$/.test(asset.masterFile))throw Error('Invalid inventory entry.');
  const original=await readFile(path.join(root,asset.masterFile)),shape=inspectRaster(original);
  if(original.length>5242880||original[0]!==255||original[1]!==216||shape.width!==asset.pixel_width||shape.height!==asset.pixel_height||shape.width<1600||shape.width>3200||shape.height*16!==shape.width*9)throw Error('Master differs from inventory.');
  const generated=await page.evaluate(async({encoded,source,widths,width,height})=>{
   const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:'image/jpeg'}),image=await createImageBitmap(blob);
   if(image.width!==width||image.height!==height)throw Error('Unexpected decoded master orientation');image.close();
   const generate=new Function('derivativeWidths','return '+source)(widths),variants=await generate(blob,{x:.5,y:.5}),results=[];
   for(const variant of variants){const decoded=await createImageBitmap(variant.blob);if(decoded.width!==variant.width||decoded.height!==variant.width*9/16)throw Error('Derivative shape mismatch');decoded.close();let raw='';for(const byte of new Uint8Array(await variant.blob.arrayBuffer()))raw+=String.fromCharCode(byte);results.push({width:variant.width,base64:btoa(raw)});}return results;
  },{encoded:original.toString('base64'),source:createCoverDerivatives.toString(),widths:derivativeWidths,width:shape.width,height:shape.height});
  const expected=derivativeWidths.filter(w=>w<shape.width);if(JSON.stringify(generated.map(v=>v.width))!==JSON.stringify(expected))throw Error('Not every required derivative was generated.');
  const variants=[];for(const variant of generated){const bytes=Buffer.from(variant.base64,'base64'),file=asset.project+'-'+asset.id+'-'+variant.width+'.jpg';await writeFile(path.join(root,file),bytes);variants.push({width:variant.width,file,bytes:bytes.length,sha256:digest(bytes)});}
  report.push({...asset,masterBytes:original.length,masterSha256:digest(original),variants});
 }
}finally{await browser.close();}
await writeFile(path.join(root,'prepared.json'),JSON.stringify(report,null,2)+'\n');
console.log('Prepared '+report.length+' covers and '+report.reduce((n,a)=>n+a.variants.length,0)+' quality-94 derivatives; originals unchanged.');
