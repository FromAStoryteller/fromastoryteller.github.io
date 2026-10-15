import { makeLifecycleHandler } from './handler.mjs';
// Deliberately local-only until the full workflow and retention schedule are reviewed.
Deno.serve(makeLifecycleHandler({
  base: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  enabled: Deno.env.get('SUPABASE_URL') === 'http://kong:8000',
}));
