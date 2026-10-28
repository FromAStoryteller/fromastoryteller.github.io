// The Deno distribution uses portable WebAssembly codecs. The npm entry uses
// native Node codecs, which cannot start in the Supabase Edge runtime.
import {Image} from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
export async function normalizeCover(bytes,focus){
 const image=await Image.decode(bytes);let width=image.width,height=image.height;
 if(width/height>16/9)width=Math.max(1,Math.floor(height*16/9));else height=Math.max(1,Math.floor(width*9/16));
 const x=Math.floor((image.width-width)*focus.x),y=Math.floor((image.height-height)*focus.y);
 if(width<1600||height<900)throw Error('Cover crop must contain at least 1600 × 900 source pixels.');
 const target=width>=3200&&height>=1800?3200:width>=2400&&height>=1350?2400:1600;
 image.crop(x,y,width,height).resize(target,target*9/16);
 return await image.encodeJPEG(94);
}

export async function normalizeProfile(bytes,focus){
 const image=await Image.decode(bytes),size=Math.min(image.width,image.height);
 if(size<512)throw Error('Profile crop must contain at least 512 × 512 source pixels.');
 image.crop(Math.floor((image.width-size)*focus.x),Math.floor((image.height-size)*focus.y),size,size).resize(512,512);
 return await image.encodeJPEG(94);
}
