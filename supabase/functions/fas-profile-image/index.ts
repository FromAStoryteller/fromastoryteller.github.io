import { makeImageHandler } from '../fas-story-image/handler.mjs';
Deno.serve(makeImageHandler({
  base: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  kind:'profile',serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));
