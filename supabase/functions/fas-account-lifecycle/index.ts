import { makeLifecycleHandler } from './handler.mjs';
import { lifecycleEnvironment } from './environment.mjs';
Deno.serve(makeLifecycleHandler({
  base: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  ...lifecycleEnvironment(Deno.env.get('SUPABASE_URL'), Deno.env.get('FAS_DEV_LIFECYCLE_ENABLED'), Deno.env.get('FAS_PRODUCTION_LIFECYCLE_ENABLED')),
}));
