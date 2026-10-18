import {makeEmailEvents} from './handler.mjs';
Deno.serve(makeEmailEvents({base:Deno.env.get('SUPABASE_URL'),anonKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),webhookSecret:Deno.env.get('FAS_RESEND_WEBHOOK_SECRET')}));
