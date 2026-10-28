import { makeImageHandler } from './handler.mjs';
Deno.serve(makeImageHandler({
  // Serve the verified master unchanged. On-demand JPEG processing exhausted
  // shared isolate CPU during parallel page loads (546 WORKER_RESOURCE_LIMIT).
  // Width parameters remain compatible with already-deployed image markup.
  base: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));
