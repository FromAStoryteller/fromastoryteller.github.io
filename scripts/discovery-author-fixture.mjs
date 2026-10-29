// Isolated PostgreSQL fixtures only. This module never connects to Supabase.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
export const root=new URL('../',import.meta.url);
export const migration='20261029205709_discovery_author_lookups.sql';
export const optimization=readFileSync(new URL('supabase/migrations/'+migration,root),'utf8');
export const rollback=readFileSync(new URL('supabase/ops/rollback_discovery_author_lookups.sql',root),'utf8');
export async function discoveryDatabase({throughLatest=false}={}){
 const db=new PGlite();
 await db.exec(`create role supabase_auth_admin;create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text references storage.buckets(id),name text,metadata jsonb default '{}'::jsonb,updated_at timestamptz default now());
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to anon,authenticated;`);
 const directory=new URL('supabase/migrations/',root);
 for(const file of readdirSync(directory).filter(f=>f.endsWith('.sql')).sort()){
  if(file===migration&&!throughLatest)break;
  await db.exec(readFileSync(new URL(file,directory),'utf8'));
 }
 return db;
}
export async function publicQuery(db,options={}){
 await db.exec('set role anon');
 try{return (await db.query('select public.fas_query_public_content($1::jsonb) result',[JSON.stringify(options)])).rows[0].result;}
 finally{await db.exec('reset role');}
}
export async function pairedQuery(db,options={}){
 await db.exec(rollback);const before=await publicQuery(db,options);
 await db.exec(optimization);const after=await publicQuery(db,options);
 return {before,after};
}
