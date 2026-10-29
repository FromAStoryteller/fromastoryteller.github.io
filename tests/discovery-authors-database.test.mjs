import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryDatabase,publicQuery,pairedQuery,optimization,rollback} from '../scripts/discovery-author-fixture.mjs';

test('discovery shares author lookups while keeping fresh permissions and identical public cards',async()=>{
 const db=await discoveryDatabase();
 const a='b1000000-0000-4000-8000-000000000001',b='b1000000-0000-4000-8000-000000000002';
 try{
  await db.exec(`insert into auth.users(id,email,email_confirmed_at)values('${a}','alpha@example.invalid',now()),('${b}','beta@example.invalid',now());
   insert into public.user_roles(user_id,role)values('${a}','member'),('${b}','member');
   insert into private.fas_publishers(user_id)values('${a}');
   update public.profiles set display_name=case when id='${a}' then 'Alpha writer' else 'Beta writer' end where id in('${a}','${b}');
   insert into public.stories(author_id,slug,title,summary,body,status,published_at,genres)
    select '${a}','alpha-'||i,'Alpha story '||i,'Public summary','Public prose','published',now()-i*interval '1 minute',array['fantasy'] from generate_series(1,40)i;
   insert into public.stories(author_id,slug,title,body,status,published_at,publishing_identity)
    values('${a}','alpha-brand','Alpha brand','Public prose','published',now(),'fas'),
    ('${b}','beta-live','Beta live','Public prose','published',now(),'personal'),
    ('${b}','beta-draft','Private draft','SECRET MANUSCRIPT','draft',null,'personal');
   insert into private.file_content(id,owner_id,url,content_type,title,summary,slug,published_at,image,image_alt,publishing_identity)
    values(gen_random_uuid(),'${a}','/stories/alpha-file/','story','Alpha file','Summary','alpha-file',now(),'/assets/images/covers/the-deal.jpg','Cover','personal'),
    (gen_random_uuid(),'${a}','/stories/alpha-file-brand/','story','Alpha file brand','Summary','alpha-file-brand',now(),'/assets/images/covers/the-deal.jpg','Cover','fas');
   insert into private.file_content(id,owner_id,url,content_type,title,summary,slug,published_at,image,image_alt,publishing_identity,editorial_migrated)
    select id,author_id,'/stories/alpha-1/','story',title,summary,slug,published_at,'/assets/images/covers/the-deal.jpg','Cover','personal',true from public.stories where slug='alpha-1';`);
  for(const options of [{limit:24},{q:'Alpha'},{category:'stories',sort:'title'},{offset:24,limit:24},{genre:'Fantasy'},{related:'/stories/alpha-1/',limit:6}]){
   const {before,after}=await pairedQuery(db,options);assert.deepEqual(after,before);
  }
  const all=await publicQuery(db,{limit:24});assert.equal(all.total,44);
  assert.equal(JSON.stringify(all).includes('SECRET MANUSCRIPT'),false);
  assert.equal(JSON.stringify(all).includes(a),false);
  assert.equal(JSON.stringify(all).includes('@example.invalid'),false);
  assert.equal((await publicQuery(db,{q:'Private draft'})).total,0);
  // The same owner has independent personal/FAS projections. Revocation is read
  // again by the next query; it does not remove their personal publications.
  await db.exec(`delete from private.fas_publishers where user_id='${a}';`);
  assert.equal((await publicQuery(db,{q:'brand'})).total,0);
  assert.equal((await publicQuery(db,{q:'Alpha story'})).total,40);
  await db.exec(`insert into private.fas_publishers(user_id)values('${a}');`);
  assert.equal((await publicQuery(db,{q:'brand'})).total,2);
  await db.exec(`delete from public.user_roles where user_id='${a}' and role='member';`);
  assert.equal((await publicQuery(db,{q:'Alpha'})).total,0);
  await db.exec(`insert into public.user_roles(user_id,role)values('${a}','member');`);
  assert.equal((await publicQuery(db,{q:'Alpha'})).total,2,'role restoration does not republish archived stories');
  await db.exec(`update public.stories set status='published',published_at=now() where author_id='${a}';`);
  assert.equal((await publicQuery(db,{q:'Alpha'})).total,43);
  await db.exec(`insert into private.account_deletion_jobs(user_id,receipt_hash)values('${a}',repeat('a',64));`);
  assert.equal((await publicQuery(db,{q:'Alpha'})).total,0);
  await db.exec(`delete from private.account_deletion_jobs where user_id='${a}';`);
  assert.equal((await publicQuery(db,{q:'Alpha'})).total,43);
  await db.exec(`update public.profiles set display_name='Renamed writer' where id='${a}';`);
  const renamed=await publicQuery(db,{q:'Alpha story'});assert.ok(renamed.items.every(i=>i.author.display_name==='Renamed writer'));
  await db.exec("update public.stories set status='draft' where slug='alpha-40';");
  assert.equal((await publicQuery(db,{q:'Alpha story 40'})).total,0);
  assert.equal((await publicQuery(db,{related:'/stories/alpha-40/'})).total,0);
  const grants=(await db.query(`select has_function_privilege('anon','private.discovery_cards()','execute') anon,
   has_function_privilege('authenticated','private.discovery_cards()','execute') authenticated,
   (select prosecdef from pg_proc where oid='public.fas_query_public_content(jsonb)'::regprocedure) wrapper_definer`)).rows[0];
  assert.deepEqual(grants,{anon:false,authenticated:false,wrapper_definer:false});
  // Count calls rather than asserting machine-dependent execution time.
  await db.exec(`alter function private.public_publishing_author(uuid,text) rename to original_publishing_author;
   create sequence private.author_lookup_probe;
   create function private.public_publishing_author(owner_key uuid,identity_key text) returns jsonb
   language plpgsql stable security definer set search_path='' as $$begin
    perform nextval('private.author_lookup_probe');return private.original_publishing_author(owner_key,identity_key);end$$;
   revoke all on function private.public_publishing_author(uuid,text) from public,anon,authenticated;`);
  await db.exec(optimization);
  await publicQuery(db,{});
  const expected=(await db.query(`select count(*)::integer n from(
   select author_id,publishing_identity from public.stories where status='published' and published_at is not null
   union select owner_id,publishing_identity from private.file_content where not editorial_migrated and owner_id is not null) keys`)).rows[0].n;
  assert.equal((await db.query('select last_value::integer n from private.author_lookup_probe')).rows[0].n,expected);
  // Rollback restores the previous projection without replaying schema changes.
  await db.exec(rollback);assert.equal((await publicQuery(db,{q:'Alpha'})).total,42);
 }finally{await db.close();}
});
