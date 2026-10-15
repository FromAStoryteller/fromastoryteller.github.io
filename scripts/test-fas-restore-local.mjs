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
    ? ['/d','/s','/c','npx.cmd --yes supabase@2.120.0 status -o json']
    : ['--yes','supabase@2.120.0','status','-o','json'], { cwd:directory, encoding:'utf8', stdio:['ignore','pipe','ignore'], windowsHide:true });
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
const rows=(side,table,predicate)=>JSON.parse(sql(side,`select coalesce(jsonb_agg(to_jsonb(row)),'[]'::jsonb) from ${table} row where ${predicate};`));
function insertRows(side,table,data,conflict='') {
  if(!data.length)return;
  // Exclude generated columns, e.g. auth.identities.email, when importing real Auth rows.
  const columns=sql(side,`select string_agg(quote_ident(attname),',' order by attnum) from pg_attribute where attrelid=${quote(table)}::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity<>'a';`);
  check(/^[a-z_,]+$/.test(columns));
  sql(side,`insert into ${table} (${columns}) select ${columns} from jsonb_populate_recordset(null::${table},${quote(JSON.stringify(data))}::jsonb) ${conflict};`);
}
const image=(side,asset,token)=>makeImageHandler(side)(new Request(side.base+'/functions/v1/fas-story-image?asset_id='+asset,{headers:token?{Authorization:'Bearer '+token}:{}}));
async function lifecycle(side,token,body) {
  return makeLifecycleHandler({...side,enabled:true})(new Request(side.base+'/functions/v1/fas-account-lifecycle',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'http://127.0.0.1:55400'},body:JSON.stringify(body)}));
}
let stage='empty disposable target';
try {
  check(sql(target,'select count(*) from auth.users;')==='0');
  for(let i=0;i<3;i++) {
    const email=`fas-restore-rehearsal-${randomUUID()}@example.invalid`;const password='LocalOnly9!'+randomBytes(24).toString('base64url');
    const made=await source.admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{fas_registration:registrationDeclaration({ageConfirmed:true,policiesAcknowledged:true})}});check(!made.error);
    const user={id:made.data.user.id,email,password};users.push(user);ids.push(user.id);
    check(!(await source.admin.from('user_roles').insert({user_id:user.id,role:i===2?'admin':'member'})).error);
    const client=createClient(source.base,source.anonKey,{auth:{...options.auth,storageKey:randomUUID()}});clients.push(client);
    const signed=await client.auth.signInWithPassword({email,password});check(!signed.error);user.token=signed.data.session.access_token;
  }
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
  ]) snapshot.tables[table]=rows(source,table,predicate);
  for(const path of paths) {
    const downloaded=await source.admin.storage.from('fas-story-images').download(path);check(!downloaded.error);
    const bytes=Buffer.from(await downloaded.data.arrayBuffer());snapshot.images.push({path,sha256:digest(bytes),type:'image/png',base64:bytes.toString('base64')});
  }
  const cipher=createCipheriv('aes-256-gcm',encryptionKey,nonce);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(snapshot),'utf8'),cipher.final()]);
  writeFileSync(backupPath,Buffer.concat([cipher.getAuthTag(),ciphertext]),{flag:'wx'});
  console.log('PASS encrypted synthetic backup includes real Auth identities, app rows, declarations and checksummed Storage originals');

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
  insertRows(target,'auth.users',restored.tables['auth.users']);
  insertRows(target,'auth.identities',restored.tables['auth.identities']);
  for(const profile of restored.tables['public.profiles']) sql(target,`update public.profiles set display_name=${quote(profile.display_name)},bio=${quote(profile.bio)},created_at=${quote(profile.created_at)}::timestamptz where id=${quote(profile.id)}::uuid;`);
  // Never re-grant roles to identities already listed for deletion.
  insertRows(target,'public.user_roles',restored.tables['public.user_roles'].filter(row=>row.user_id!==ids[0]));
  insertRows(target,'public.stories',restored.tables['public.stories']);
  insertRows(target,'public.story_assets',restored.tables['public.story_assets']);
  insertRows(target,'public.moderation_log',restored.tables['public.moderation_log']);
  sql(target,"select setval('public.moderation_log_id_seq', greatest(coalesce((select max(id) from public.moderation_log),0),1), exists(select 1 from public.moderation_log));");
  for(const row of restored.tables['private.account_registration_declarations']) sql(target,`update private.account_registration_declarations set recorded_at=${quote(row.recorded_at)}::timestamptz where user_id=${quote(row.user_id)}::uuid;`);
  for(const item of restored.images) {
    const bytes=Buffer.from(item.base64,'base64');check(digest(bytes)===item.sha256);
    check(!(await target.admin.storage.from('fas-story-images').upload(item.path,bytes,{contentType:item.type,upsert:false})).error);
    const copy=await target.admin.storage.from('fas-story-images').download(item.path);check(!copy.error&&digest(Buffer.from(await copy.data.arrayBuffer()))===item.sha256);
  }
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
  check((await target.admin.storage.from('fas-story-images').download(paths[0])).error);
  check((await anonymous.auth.signInWithPassword({email:users[0].email,password:users[0].password})).error);
  const other=createClient(target.base,target.anonKey,{auth:{...options.auth,storageKey:randomUUID()}});clients.push(other);
  const signed=await other.auth.signInWithPassword({email:users[1].email,password:users[1].password});check(!signed.error&&signed.data.user.id===ids[1]);
  const preserved=await other.from('stories').select('body').eq('id',storyIds[2]).single();check(!preserved.error&&preserved.data.body==='Exact synthetic restore text 2');
  const otherImage=await image(target,users[1].privateAsset,signed.data.session.access_token);check(otherImage.ok&&digest(Buffer.from(await otherImage.arrayBuffer()))===digest(png));
  const declaration=await other.rpc('fas_my_registration_declaration');check(!declaration.error&&declaration.data.recorded_at===restored.tables['private.account_registration_declarations'].find(row=>row.user_id===ids[1]).recorded_at);
  console.log('PASS cleanup replay removes restored deleted login/content/files/declaration, while the other author can sign in and read exact restored private content');
} catch {
  console.error(`FAIL ${stage} (private fixture contents and credentials withheld)`);process.exitCode=1;
} finally {
  for(const client of clients) await client.auth.signOut({scope:'local'}).catch(()=>{});
  for(const side of [source,target]) {
    try {
      if(paths.length)check(!(await side.admin.storage.from('fas-story-images').remove(paths)).error);
      for(const id of storyIds) {check(!(await side.admin.from('moderation_log').delete().eq('story_id',id)).error);check(!(await side.admin.from('stories').delete().eq('id',id)).error);}
      for(const user of users) { const existing=await side.admin.auth.admin.getUserById(user.id);if(!existing.error)check(!(await side.admin.auth.admin.deleteUser(user.id)).error); }
      if(ids.length)sql(side,'delete from private.account_deletion_jobs where user_id in ('+ids.map(quote).join(',')+');');
    } catch { console.error('FAIL scoped restore fixture cleanup');process.exitCode=1; }
  }
  rmSync(backupPath,{force:true});encryptionKey.fill(0);
  console.log('Restore fixture cleanup finished; temporary encrypted backup removed.');
}
