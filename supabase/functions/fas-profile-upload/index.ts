import {makeCoverHandler} from '../fas-studio-cover/handler.mjs';
import {normalizeProfile} from '../fas-studio-cover/normalize.mjs';
const base=Deno.env.get('SUPABASE_URL');
const dev=base==='https://oqmmvjjycpyxvxipcyli.supabase.co';
const prod=base==='https://vzdicnufhidelaoeqbza.supabase.co';
const origins=dev?['http://127.0.0.1:55410']:prod?['https://fromastoryteller.com']:base==='http://127.0.0.1:55321'?['http://127.0.0.1:55400']:[];
Deno.serve(makeCoverHandler({base,anonKey:Deno.env.get('SUPABASE_ANON_KEY'),kind:'profile',serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),origins},normalizeProfile));
