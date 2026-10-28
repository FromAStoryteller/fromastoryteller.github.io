import { makeImageHandler } from './handler.mjs';
Deno.serve(makeImageHandler({
  transform:async(bytes,width)=>{const {resizeCover}=await import('./resize.mjs');return resizeCover(bytes,width);},
  base: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));
