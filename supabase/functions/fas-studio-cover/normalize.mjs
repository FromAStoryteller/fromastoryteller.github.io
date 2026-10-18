// The Deno distribution uses portable WebAssembly codecs. The npm entry uses
// native Node codecs, which cannot start in the Supabase Edge runtime.
import {Image} from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
export async function normalizeCover(bytes,focus){
 const image=await Image.decode(bytes);let width=image.width,height=image.height;
 if(width/height>16/9)width=Math.max(1,Math.floor(height*16/9));else height=Math.max(1,Math.floor(width*9/16));
 const x=Math.floor((image.width-width)*focus.x),y=Math.floor((image.height-height)*focus.y);
 image.crop(x,y,width,height).resize(1600,900);
 return await image.encodeJPEG(90);
}

export async function normalizeProfile(bytes,focus){
 const image=await Image.decode(bytes),size=Math.min(image.width,image.height);
 image.crop(Math.floor((image.width-size)*focus.x),Math.floor((image.height-size)*focus.y),size,size).resize(512,512);
 return await image.encodeJPEG(90);
}
