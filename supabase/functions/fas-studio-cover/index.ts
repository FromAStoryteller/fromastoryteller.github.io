import {Image} from 'npm:imagescript@1.3.0';
import {makeCoverHandler} from './handler.mjs';
const base=Deno.env.get('SUPABASE_URL');
const dev=base==='https://oqmmvjjycpyxvxipcyli.supabase.co';
const prod=base==='https://vzdicnufhidelaoeqbza.supabase.co';
const origins=dev?['http://127.0.0.1:55410']:prod?['https://fromastoryteller.com']:base==='http://127.0.0.1:55321'?['http://127.0.0.1:55400']:[];
Deno.serve(makeCoverHandler({base,anonKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),origins},async(bytes:Uint8Array,focus:{x:number,y:number})=>{
 const image=await Image.decode(bytes);let width=image.width,height=image.height;
 if(width/height>16/9)width=Math.floor(height*16/9);else height=Math.floor(width*9/16);
 const x=Math.floor((image.width-width)*focus.x),y=Math.floor((image.height-height)*focus.y);
 image.crop(x,y,width,height).resize(1600,900);
 return await image.encodeJPEG(90);
}));
