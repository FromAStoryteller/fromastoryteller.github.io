// Runs in actual Deno with the same remote WASM import used by the deployed Edge function.
import {normalizeCover} from '../supabase/functions/fas-studio-cover/normalize.mjs';
import {inspectRaster} from '../supabase/functions/fas-studio-cover/handler.mjs';
const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR4nGOIcpMjCTGMahgUGgA2zWrhijW97QAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
Deno.test('real WASM codecs boot and normalize PNG and JPEG into verified 1600 by 900 JPEG',async()=>{
 const first=await normalizeCover(png,{x:.5,y:.5});
 if(first[0]!==255||first[1]!==216)throw new Error('Expected JPEG output');
 const dimensions=inspectRaster(first);if(dimensions.width!==1600||dimensions.height!==900)throw new Error('Expected 16:9 output');
 const second=await normalizeCover(first,{x:1,y:0});const check=inspectRaster(second);if(check.width!==1600||check.height!==900)throw new Error('JPEG round trip failed');
});
