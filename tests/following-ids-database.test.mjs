import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryDatabase} from '../scripts/discovery-author-fixture.mjs';
test('private following IDs cover all pages with verified-session isolation and fresh eligibility',async()=>{
 const db=await discoveryDatabase({throughLatest:true});
 const user=n=>'bf100000-0000-4000-8000-'+String(n).padStart(12,'0');
 const session=n=>'bf200000-0000-4000-8000-'+String(n).padStart(12,'0');
 const as=async(n,sql,args=[])=>{
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user(n)}',false);select set_config('request.jwt.claims','{"session_id":"${session(n)}"}',false);`);
  try{return await db.query(sql,args);}finally{await db.exec('reset role');}
 };
 const read=async n=>(await as(n,'select public.fas_my_following_ids() ids')).rows[0].ids;
 try{
  await db.exec(`insert into auth.users(id,email,email_confirmed_at)
   select ('bf100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'following-ids-'||i||'@example.invalid',now() from generate_series(1,102)i;
   insert into public.user_roles(user_id,role)select id,'member' from auth.users where id::text like 'bf100000-%' and right(id::text,12)::integer<=100;
   insert into auth.sessions(id,user_id)values('${session(101)}','${user(101)}'),('${session(102)}','${user(102)}');
   insert into private.storyteller_follows(follower_id,profile_key,person_key)
    select '${user(101)}',public_id,public_id from public.profiles where id::text like 'bf100000-%' and right(id::text,12)::integer<=100;`);
  const key=(await db.query('select public_id from public.profiles where id=$1',[user(1)])).rows[0].public_id;
  const brand=(await db.query('select public_id from private.publishing_brand where singleton')).rows[0].public_id;
  await as(101,'select public.fas_set_storyteller_follow($1,true)',[brand]);
  const all=await read(101);assert.equal(all.length,101);assert.ok(all.every(id=>typeof id==='string'));
  const old=[];let cursor=null,pages=0;
  do{
   const page=(await as(101,'select public.fas_my_following($1,$2) data',[cursor?.name??null,cursor?.id??null])).rows[0].data;
   old.push(...page.items.map(p=>p.public_id));cursor=page.next_cursor;pages++;
  }while(cursor);
  assert.equal(pages,5);assert.deepEqual(new Set(all),new Set(old));
  assert.deepEqual(await read(102),[]);
  await as(102,'select public.fas_set_storyteller_follow($1,true)',[key]);assert.deepEqual(await read(102),[key]);
  assert.equal((await read(101)).length,101);
  await as(101,'select public.fas_set_storyteller_follow($1,false)',[key]);assert.equal((await read(101)).includes(key),false);
  await as(101,'select public.fas_set_storyteller_follow($1,true)',[key]);assert.equal((await read(101)).includes(key),true);
  await db.exec(`delete from public.user_roles where user_id='${user(1)}' and role='member';`);
  assert.equal((await read(101)).includes(key),false);assert.deepEqual(await read(102),[]);
  await db.exec(`insert into public.user_roles(user_id,role)values('${user(1)}','member');`);
  assert.equal((await read(101)).includes(key),true);
  await db.exec(`insert into private.account_deletion_jobs(user_id,receipt_hash)values('${user(1)}',repeat('b',64));`);
  assert.equal((await read(101)).includes(key),false);
  await db.exec(`delete from private.account_deletion_jobs where user_id='${user(1)}';`);
  assert.equal((await read(101)).includes(key),true);
  await db.exec(`set role anon;`);await assert.rejects(db.query('select public.fas_my_following_ids()'),/permission denied/);await db.exec('reset role');
  await assert.rejects(as(101,'select public.fas_my_following_ids($1)',[user(102)]),/does not exist/);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user(102)}',false);select set_config('request.jwt.claims','{"session_id":"${session(101)}"}',false);`);
  await assert.rejects(db.query('select public.fas_my_following_ids()'),/session/i);await db.exec('reset role');
  await db.exec(`update auth.sessions set not_after=now()-interval '1 minute' where id='${session(101)}';`);
  await assert.rejects(read(101),/session/i);
  await db.exec(`insert into private.account_deletion_jobs(user_id,receipt_hash)values('${user(102)}',repeat('c',64));`);
  await assert.rejects(read(102),/active account/i);
  const flags=(await db.query(`select
   has_function_privilege('anon','public.fas_my_following_ids()','execute') anon,
   has_function_privilege('authenticated','public.fas_my_following_ids()','execute') authenticated,
   (select prosecdef from pg_proc where oid='public.fas_my_following_ids()'::regprocedure) wrapper_definer`)).rows[0];
  assert.deepEqual(flags,{anon:false,authenticated:true,wrapper_definer:false});
  await db.exec(`delete from auth.users where id='${user(1)}';`);
  assert.equal((await db.query('select count(*)::integer n from private.storyteller_follows where profile_key=$1',[key])).rows[0].n,0);
 }finally{await db.close();}
});
