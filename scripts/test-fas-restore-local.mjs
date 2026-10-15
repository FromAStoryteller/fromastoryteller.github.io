// Synthetic data only. Two fixed LOCAL stacks; never accept a remote URL/key.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID, randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { makeLifecycleHandler } from '../supabase/functions/fas-account-lifecycle/handler.mjs';
import { makeImageHandler } from '../supabase/functions/fas-story-image/handler.mjs';
import { registrationDeclaration } from '../account/registration-declaration.mjs';

if (process.env.FAS_TEST_CONFIRM !== 'LOCAL-FAS-RESTORE-ONLY') throw new Error('Acknowledge LOCAL-FAS-RESTORE-ONLY.');
const root = fileURLToPath(new URL('../', import.meta.url));
const targetRoot = resolve(root, '../account-restore-target');
const check = value => { if (!value) throw new Error('Restore rehearsal contract failed'); };
function localStatus(directory, project, expectedURL) {
  check(readFileSync(resolve(directory,'supabase/config.toml'),'utf8').includes(`project_id = "${project}"`));
  check(!existsSync(resolve(directory,'supabase/.temp/project-ref')));
  const raw = execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npx', process.platform === 'win32'
    ? ['/d','/s','/c','npx.cmd --yes --offline supabase@2.120.0 status -o json']
    : ['--yes','--offline','supabase@2.120.0','status','-o','json'], { cwd:directory, encoding:'utf8', stdio:['ignore','pipe','ignore'], windowsHide:true });
  const config=JSON.parse(raw);check(config.API_URL===expectedURL);
  return {base:expectedURL,anonKey:config.ANON_KEY,serviceKey:config.SERVICE_ROLE_KEY,project};
}
const source=localStatus(root,'fas-community-v1','http://127.0.0.1:55321');
const target=localStatus(targetRoot,'fas-account-restore-rehearsal','http://127.0.0.1:55521');
function sql(side, statement) {
  return execFileSync('docker',['exec','-i',`supabase_db_${side.project}`,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],
    {input:statement,encoding:'utf8',stdio:['pipe','pipe','pipe'],windowsHide:true}).trim();
}
const quote = text => "'" + String(text).replaceAll("'","''") + "'";
const ids = []; const storyIds = []; const paths = []; const users = []; const clients = [];
const options = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:randomUUID()}};
source.admin=createClient(source.base,source.serviceKey,options);
target.admin=createClient(target.base,target.serviceKey,options);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOAAAAABJRU5ErkJggg==','base64');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const backupPath=resolve(root,'../restore-synthetic-'+randomUUID()+'.bin');
const encryptionKey=randomBytes(32); const nonce=randomBytes(12);
const releaseId='restore-fixture-'+randomUUID();
const policyTables=['private.account_policy_releases','private.account_policy_agreements'];
const eligiblePolicySides=[];
const rows=(side,table,predicate)=>JSON.parse(sql(side,`select coalesce(jsonb_agg(to_jsonb(row)),'[]'::jsonb) from ${table} row where ${predicate};`));
function insertRows(side,table,data,conflict='') {
  if(!data.length)return;
  // Exclude generated columns, e.g. auth.identities.email, when importing real Auth rows.
  const columns=sql(side,`select string_agg(quote_ident(attname),',' order by attnum) from pg_attribute where attrelid=${quote(table)}::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity<>'a';`);
  check(/^[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*$/.test(columns));
  sql(side,`insert into ${table} (${columns}) select ${columns} from jsonb_populate_recordset(null::${table},${quote(JSON.stringify(data))}::jsonb) ${conflict};`);
}
const image=(side,asset,token)=>makeImageHandler(side)(new Request(side.base+'/functions/v1/fas-story-image?asset_id='+asset,{headers:token?{Authorization:'Bearer '+token}:{}}));
async function lifecycle(side,token,body) {
  return makeLifecycleHandler({...side,enabled:true})(new Request(side.base+'/functions/v1/fas-account-lifecycle',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'http://127.0.0.1:55400'},body:JSON.stringify(body)}));
}
let stage='empty disposable target';
try {
  check(sql(target,'select count(*) from auth.users;')==='0');
  for(const side of [source,target]) {
    check(sql(side,'select count(*) from private.account_policy_requirement where singleton and release_id is null;')==='1');
    for(const table of policyTables)check(sql(side,`select count(*) from ${table};`)==='0');
    eligiblePolicySides.push(side);
  }
  for(let i=0;i<3;i++) {
    const email=`fas-restore-rehearsal-${randomUUID()}@example.invalid`;const password='LocalOnly9!'+randomBytes(24).toString('base64url');
    const made=await source.admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{fas_registration:registrationDeclaration({ageConfirmed:true,policiesAcknowledged:true})}});check(!made.error);
    const user={id:made.data.user.id,email,password};users.push(user);ids.push(user.id);
    check(!(await source.admin.from('user_roles').insert({user_id:user.id,role:i===2?'admin':'member'})).error);
    const client=createClient(source.base,source.anonKey,{auth:{...options.auth,storageKey:randomUUID()}});clients.push(client);
    const signed=await client.auth.signInWithPassword({email,password});check(!signed.error);user.token=signed.data.session.access_token;
  }
  stage='explicit synthetic agreements before source contribution';
  sql(source,`insert into private.account_policy_releases values(${quote(releaseId)},'published',now()-interval '1 day','synthetic-terms-v1','synthetic-privacy-v1',${quote(digest('synthetic terms'))},${quote(digest('synthetic privacy'))},'/account/policy-history/${releaseId}/terms/','/account/policy-history/${releaseId}/privacy/',16);
    update private.account_policy_requirement set release_id=${quote(releaseId)} where singleton;`);
  for(const client of clients)check(!(await client.rpc('fas_accept_current_policies',{target_release:releaseId,terms_agreed:true,privacy_notice_seen:true,age_16_or_over:true})).error);
  stage='source draft/published stories and original image bytes';
  for(let i=0;i<3;i++) {
    const owner=i===2?1:0;
    const made=await clients[owner].from('stories').insert({author_id:ids[owner],slug:'fas-restore-'+randomUUID(),title:i===1?'Disposable published story':'Disposable private draft',body:'Exact synthetic restore text '+i}).select('id').single();check(!made.error);storyIds.push(made.data.id);
    if(i>0) {
      const path=`${ids[owner]}/${made.data.id}/${randomUUID()}.png`;paths.push(path);
      const asset=await clients[owner].from('story_assets').insert({story_id:made.data.id,object_path:path,alt_text:'Synthetic restore original'}).select('id').single();check(!asset.error);
      check(!(await clients[owner].storage.from('fas-story-images').upload(path,png,{contentType:'image/png',upsert:false})).error);
      if(i===1) {
        users[0].publicAsset=asset.data.id;
        check(!(await clients[owner].from('stories').update({status:'submitted'}).eq('id',made.data.id)).error);
        check(!(await clients[2].rpc('approve_story_image',{target_asset:asset.data.id})).error);
        check(!(await clients[2].rpc('moderate_story',{target_story:made.data.id,decision:'published',note:'Synthetic local restore rehearsal'})).error);
      } else users[1].privateAsset=asset.data.id;
    }
  }
  const before=await image(source,users[0].publicAsset);check(before.ok&&digest(Buffer.from(await before.arrayBuffer()))===digest(png));
  const userPredicate='user_id in ('+ids.map(quote).join(',')+')';
  const storyPredicate='story_id in ('+storyIds.map(quote).join(',')+')';
  const snapshot={tables:{},images:[]};
  for(const [table,predicate] of [
    ['auth.users','id in ('+ids.map(quote).join(',')+')'],['auth.identities',userPredicate],
    ['public.profiles','id in ('+ids.map(quote).join(',')+')'],['public.user_roles',userPredicate],
    ['public.stories','author_id in ('+ids.map(quote).join(',')+')'],['public.story_assets',storyPredicate],
    ['public.moderation_log',storyPredicate],['private.account_registration_declarations',userPredicate],
    ['private.account_policy_releases','release_id='+quote(releaseId)],
    ['private.account_policy_requirement','singleton'],['private.account_policy_agreements',userPredicate],
  ]) snapshot.tables[table]=rows(source,table,predicate);
  for(const path of paths) {
    const downloaded=await source.admin.storage.from('fas-story-images').download(path);check(!downloaded.error);
    const bytes=Buffer.from(await downloaded.data.arrayBuffer());snapshot.images.push({path,sha256:digest(bytes),type:'image/png',base64:bytes.toString('base64')});
  }
  const cipher=createCipheriv('aes-256-gcm',encryptionKey,nonce);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(snapshot),'utf8'),cipher.final()]);
  writeFileSync(backupPath,Buffer.concat([cipher.getAuthTag(),ciphertext]),{flag:'wx'});
  console.log('PASS encrypted synthetic backup includes Auth, app rows, original declarations/agreements, policy versions/hashes and checksummed Storage originals');

  stage='source confirmed deletion and current ledger';
  const preparation=await lifecycle(source,users[0].token,{action:'prepare-delete',password:users[0].password});check(preparation.ok);
  const prepared=await preparation.json();
  const deleted=await lifecycle(source,users[0].token,{action:'confirm-delete',confirmation:'DELETE',exportAcknowledged:true,confirmationToken:prepared.confirmationToken});check(deleted.ok);
  const ledger=rows(source,'private.account_deletion_jobs','user_id='+quote(ids[0]));check(ledger.length===1&&ledger[0].state==='complete');
  check((await image(source,users[0].publicAsset)).status===404);

  stage='restore current deletion ledger before the older synthetic snapshot';
  const encrypted=readFileSync(backupPath);const decipher=createDecipheriv('aes-256-gcm',encryptionKey,nonce);decipher.setAuthTag(encrypted.subarray(0,16));
  const restored=JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(16)),decipher.final()]).toString('utf8'));
  insertRows(target,'private.account_deletion_jobs',ledger);
  stage='restore release and original Auth identities with agreement mode inactive';
  // Keep the requirement inactive during Auth import: a restore must not invent
  // a fresh signup agreement or replace the original existing-account timestamp.
  insertRows(target,'private.account_policy_releases',restored.tables['private.account_policy_releases']);
  insertRows(target,'auth.users',restored.tables['auth.users']);
  insertRows(target,'auth.identities',restored.tables['auth.identities']);
  stage='restore app rows and original declarations';
  for(const profile of restored.tables['public.profiles']) sql(target,`update public.profiles set display_name=${quote(profile.display_name)},bio=${quote(profile.bio)},created_at=${quote(profile.created_at)}::timestamptz where id=${quote(profile.id)}::uuid;`);
  // Never re-grant roles to identities already listed for deletion.
  insertRows(target,'public.user_roles',restored.tables['public.user_roles'].filter(row=>row.user_id!==ids[0]));
  insertRows(target,'public.stories',restored.tables['public.stories']);
  insertRows(target,'public.story_assets',restored.tables['public.story_assets']);
  insertRows(target,'public.moderation_log',restored.tables['public.moderation_log']);
  sql(target,"select setval('public.moderation_log_id_seq', greatest(coalesce((select max(id) from public.moderation_log),0),1), exists(select 1 from public.moderation_log));");
  for(const row of restored.tables['private.account_registration_declarations']) sql(target,`update private.account_registration_declarations set recorded_at=${quote(row.recorded_at)}::timestamptz where user_id=${quote(row.user_id)}::uuid;`);
  check(sql(target,'select count(*) from private.account_policy_agreements;')==='0');
  stage='import exact original policy agreement rows';
  insertRows(target,'private.account_policy_agreements',restored.tables['private.account_policy_agreements']);
  stage='compare complete restored policy rows';
  for(const table of policyTables)check(JSON.stringify(rows(target,table,table.endsWith('releases')?'release_id='+quote(releaseId):userPredicate).sort((a,b)=>String(a.user_id??a.release_id).localeCompare(String(b.user_id??b.release_id))))===JSON.stringify([...restored.tables[table]].sort((a,b)=>String(a.user_id??a.release_id).localeCompare(String(b.user_id??b.release_id)))));
  for(const item of restored.images) {
    stage='restore checksummed original image bytes';
    const bytes=Buffer.from(item.base64,'base64');check(digest(bytes)===item.sha256);
    check(!(await target.admin.storage.from('fas-story-images').upload(item.path,bytes,{contentType:item.type,upsert:false})).error);
    const copy=await target.admin.storage.from('fas-story-images').download(item.path);check(!copy.error&&digest(Buffer.from(await copy.data.arrayBuffer()))===item.sha256);
  }
  sql(target,`update private.account_policy_requirement set release_id=${quote(restored.tables['private.account_policy_requirement'][0].release_id)} where singleton;`);
  const anonymous=createClient(target.base,target.anonKey,options);
  const hidden=await anonymous.from('stories').select('id').eq('author_id',ids[0]);check(!hidden.error&&hidden.data.length===0);
  check((await image(target,users[0].publicAsset)).status===404);
  check((await anonymous.storage.from('fas-story-images').download(paths[0])).error);
  console.log('PASS older real rows and image bytes restore successfully; current deletion ledger keeps restored publications and originals hidden');

  stage='operator cleanup replay before making the restored service available';
  // Maintenance replay uses the preserved ledger, not a restored user's login.
  sql(target,`begin; update private.account_deletion_jobs set state='pending',completed_at=null where user_id=${quote(ids[0])}::uuid;
    delete from public.moderation_log where story_id in (select id from public.stories where author_id=${quote(ids[0])}::uuid);
    delete from public.stories where author_id=${quote(ids[0])}::uuid; commit;`);
  const deletedPaths=restored.images.filter(item=>item.path.startsWith(ids[0]+'/')).map(item=>item.path);
  check(!(await target.admin.storage.from('fas-story-images').remove(deletedPaths)).error);
  check(!(await target.admin.auth.admin.deleteUser(ids[0])).error);
  check(!(await target.admin.rpc('fas_finish_account_deletion',{target_user:ids[0]})).error);
  check((await target.admin.auth.admin.getUserById(ids[0])).error);
  check(sql(target,`select count(*) from private.account_registration_declarations where user_id=${quote(ids[0])}::uuid;`)==='0');
  check(sql(target,`select count(*) from private.account_policy_agreements where user_id=${quote(ids[0])}::uuid;`)==='0');
  check((await target.admin.storage.from('fas-story-images').download(paths[0])).error);
  check((await anonymous.auth.signInWithPassword({email:users[0].email,password:users[0].password})).error);
  const other=createClient(target.base,target.anonKey,{auth:{...options.auth,storageKey:randomUUID()}});clients.push(other);
  const signed=await other.auth.signInWithPassword({email:users[1].email,password:users[1].password});check(!signed.error&&signed.data.user.id===ids[1]);
  const preserved=await other.from('stories').select('body').eq('id',storyIds[2]).single();check(!preserved.error&&preserved.data.body==='Exact synthetic restore text 2');
  const otherImage=await image(target,users[1].privateAsset,signed.data.session.access_token);check(otherImage.ok&&digest(Buffer.from(await otherImage.arrayBuffer()))===digest(png));
  const declaration=await other.rpc('fas_my_registration_declaration');check(!declaration.error&&declaration.data.recorded_at===restored.tables['private.account_registration_declarations'].find(row=>row.user_id===ids[1]).recorded_at);
  const history=await other.rpc('fas_my_policy_agreements');check(!history.error&&history.data.length===1);
  const original=restored.tables['private.account_policy_agreements'].find(row=>row.user_id===ids[1]);
  check(history.data[0].recorded_at===original.recorded_at&&history.data[0].source===original.source&&history.data[0].release_id===releaseId);
  check(history.data[0].terms_sha256===digest('synthetic terms')&&history.data[0].privacy_sha256===digest('synthetic privacy'));
  const edited=await other.from('stories').update({title:'Restored contributor still permitted'}).eq('id',storyIds[2]).select('id');check(!edited.error&&edited.data.length===1);
  console.log('PASS deleted identity/content/files/declaration/agreements stay deleted; another author retains exact private content, agreement timestamps/hashes and contribution access');
} catch {
  console.error(`FAIL ${stage} (private fixture contents and credentials withheld)`);process.exitCode=1;
} finally {
  for(const client of clients) await client.auth.signOut({scope:'local'}).catch(()=>{});
  for(const side of [source,target]) {
    try {
      if(eligiblePolicySides.includes(side))sql(side,`update private.account_policy_requirement set release_id=null where singleton and release_id=${quote(releaseId)};`);
      if(paths.length)check(!(await side.admin.storage.from('fas-story-images').remove(paths)).error);
      for(const id of storyIds) {check(!(await side.admin.from('moderation_log').delete().eq('story_id',id)).error);check(!(await side.admin.from('stories').delete().eq('id',id)).error);}
      for(const user of users) { const existing=await side.admin.auth.admin.getUserById(user.id);if(!existing.error)check(!(await side.admin.auth.admin.deleteUser(user.id)).error); }
      if(ids.length)sql(side,'delete from private.account_deletion_jobs where user_id in ('+ids.map(quote).join(',')+');');
      // Disposable local fixture only; never bypass immutable history on hosted data.
      if(eligiblePolicySides.includes(side))sql(side,`begin; lock table private.account_policy_releases in access exclusive mode;
        alter table private.account_policy_releases disable trigger immutable_policy_releases;
        delete from private.account_policy_releases where release_id=${quote(releaseId)};
        alter table private.account_policy_releases enable trigger immutable_policy_releases; commit;`);
    } catch { console.error('FAIL scoped restore fixture cleanup');process.exitCode=1; }
  }
  rmSync(backupPath,{force:true});encryptionKey.fill(0);
  console.log('Restore fixture cleanup finished; temporary encrypted backup removed.');
}
