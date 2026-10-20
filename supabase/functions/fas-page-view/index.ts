import {makePageViewHandler} from './handler.mjs';
const base=Deno.env.get('SUPABASE_URL');
const origins=base==='https://vzdicnufhidelaoeqbza.supabase.co'?['https://fromastoryteller.com']:base==='https://oqmmvjjycpyxvxipcyli.supabase.co'?['http://127.0.0.1:55410']:[];
Deno.serve(makePageViewHandler({base,serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),origins}));
