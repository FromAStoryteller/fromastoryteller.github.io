import {makeCleanupHandler} from './handler.mjs';
Deno.serve(makeCleanupHandler({base:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
