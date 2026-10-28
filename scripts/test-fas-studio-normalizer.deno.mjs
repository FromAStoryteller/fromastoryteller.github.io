import {Image} from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
// Runs in actual Deno with the same remote WASM import used by the deployed Edge function.
import {normalizeCover,normalizeProfile} from '../supabase/functions/fas-studio-cover/normalize.mjs';
import {inspectRaster} from '../supabase/functions/fas-studio-cover/handler.mjs';
const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR4nGOIcpMjCTGMahgUGgA2zWrhijW97QAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
Deno.test('real WASM codecs boot and normalize PNG and JPEG into verified 1600 by 900 JPEG',async()=>{
 const source=await (await Image.decode(png)).resize(1600,900).encode();
 const first=await normalizeCover(source,{x:.5,y:.5});
 if(first[0]!==255||first[1]!==216)throw new Error('Expected JPEG output');
 const dimensions=inspectRaster(first);if(dimensions.width!==1600||dimensions.height!==900)throw new Error('Expected 16:9 output');
 const second=await normalizeCover(first,{x:1,y:0});const check=inspectRaster(second);if(check.width!==1600||check.height!==900)throw new Error('JPEG round trip failed');
});

Deno.test('profile crops use the same WASM codec and produce a square JPEG',async()=>{
 const source=await (await Image.decode(png)).resize(512,512).encode();
 const bytes=await normalizeProfile(source,{x:0,y:1}),size=inspectRaster(bytes);
 if(size.width!==512||size.height!==512||bytes[0]!==255||bytes[1]!==216)throw new Error('Invalid profile crop');
 let rejected=false;try{await normalizeProfile(new Uint8Array([1,2,3]),{x:.5,y:.5});}catch{rejected=true;}if(!rejected)throw new Error('Corrupted input accepted');
});

Deno.test('responsive gateway variants retain aspect ratio and bound output dimensions',async()=>{
 const {resizeCover}=await import('../supabase/functions/fas-story-image/resize.mjs');
 const original=await normalizeCover(await (await Image.decode(png)).resize(1600,900).encode(),{x:.5,y:.5});
 for(const width of [480,800,1200,1600]){const bytes=await resizeCover(original,width),size=inspectRaster(bytes);if(size.width!==width||size.height!==Math.round(width*9/16))throw Error('Invalid responsive dimensions');}
});

Deno.test('small sources are never enlarged; large crops retain a sharper master',async()=>{
 for(const normalise of [normalizeCover,normalizeProfile]){let failed=false;try{await normalise(png,{x:.5,y:.5});}catch{failed=true;}if(!failed)throw Error('Small source was enlarged');}
 const source=await (await Image.decode(png)).resize(2400,1350).encode();const bytes=await normalizeCover(source,{x:.5,y:.5}),size=inspectRaster(bytes);if(size.width!==2400||size.height!==1350)throw Error('Master was unnecessarily downsampled');
});
