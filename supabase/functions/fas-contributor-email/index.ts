import {makeContributorEmail} from './handler.mjs';
Deno.serve(makeContributorEmail({
 base:Deno.env.get('SUPABASE_URL'),anonKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 apiKey:Deno.env.get('FAS_RESEND_API_KEY'),webhookSecret:Deno.env.get('FAS_RESEND_WEBHOOK_SECRET'),
 testRecipients:(Deno.env.get('FAS_EMAIL_TEST_TO')??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
}));
