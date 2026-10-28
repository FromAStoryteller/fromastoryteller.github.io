import {Image} from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
export async function resizeCover(bytes,width){
 const image=await Image.decode(bytes);
 if(image.width>4096||image.height>4096||image.width*image.height>16777216)throw Error('Image dimensions exceed limits');
 if(image.width>width)image.resize(width,Math.max(1,Math.round(image.height*width/image.width)));
 return image.encodeJPEG(88);
}
