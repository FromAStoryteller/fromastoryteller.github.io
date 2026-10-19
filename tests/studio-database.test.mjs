import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('Studio metadata bounds, private drafts, public projections, moderation locks and ownership in PostgreSQL',async()=>{
 const db=new PGlite();try {
  await db.exec(`create role supabase_auth_admin;create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to anon,authenticated,service_role;
   grant execute on function auth.uid() to anon,authenticated,service_role;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text references storage.buckets(id),name text,metadata jsonb default '{}'::jsonb,updated_at timestamptz default now());
   alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  const migrations=new URL('../supabase/migrations/',import.meta.url);
  for(const file of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(new URL(file,migrations),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/tests/story-studio.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/tests/storyteller-studio-v2.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/tests/publishing-identity.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/tests/story-publishing-lifecycle.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/tests/image-storage.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/tests/interactive-uploads.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/tests/game-accounts-multiplayer.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/tests/editable-file-players.sql',import.meta.url),'utf8'));
 }finally{await db.close();}
});
