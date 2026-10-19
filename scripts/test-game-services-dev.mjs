// Explicit DEV-only authenticated HTTP and Realtime fixtures; no production target accepted.
import {createClient} from '@supabase/supabase-js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const ref='oqmmvjjycpyxvxipcyli',url='https://'+ref+'.supabase.co';
if(process.env.FAS_GAME_TEST_TARGET!==ref||!process.env.FAS_DEV_ANON_KEY||!process.env.FAS_DEV_SERVICE_KEY||!process.env.FAS_SUPABASE_CLI)throw Error('Explicit DEV target and credentials required');
const exec=promisify(execFile),query=async sql=>{const r=await exec(process.env.FAS_SUPABASE_CLI,['db','query','--linked','--project-ref',ref,'--output','json',sql],{windowsHide:true,maxBuffer:1000000});return JSON.parse(r.stdout);};
const key=process.env.FAS_DEV_ANON_KEY,admin=createClient(url,process.env.FAS_DEV_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),users=[],clients=[],channels=[];
let game,wasEnabled;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 wasEnabled=(await query('select enabled from private.game_services_config'))[0].enabled;
 for(let i=0;i<3;i++){const email='fas-game-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+'aA!2';const r=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Game DEV fixture'}});if(r.error)throw r.error;users.push(r.data.user.id);const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const s=await c.auth.signInWithPassword({email,password});if(s.error)throw s.error;clients.push(c);}
 const settings={saves:true,saveVersion:1,multiplayer:'realtime',saveSchema:{type:'object',additionalProperties:false,properties:{level:{type:'integer',minimum:1,maximum:999},score:{type:'integer',minimum:0,maximum:1000000000}},required:['level','score']}};
 const p=JSON.stringify({version:1,orientation:'landscape',js:'// synthetic DEV fixture',css:'',assets:[],settings}).replaceAll("'","''");
 game=(await query("insert into public.user_roles(user_id,role) values('"+users[0]+"','member'),('"+users[0]+"','admin');update private.game_services_config set enabled=true;insert into public.stories(author_id,title,summary,status,published_at,content_type,publishing_identity,genres,warning_reviewed,metadata,executable_package) values('"+users[0]+"','DEV game "+crypto.randomUUID()+"','Temporary authenticated network fixture','published',now(),'game','fas',array['arcade'],true,'{\"instructions\":\"Fixture controls\"}','"+p+"') returning id,updated_at;"))[0];
 const call=async(i,action,params={})=>{const r=await clients[i].rpc('fas_game_api',{game_key:game.id,game_version:game.updated_at,action,params:{...params,account:users[i]}});if(r.error)throw r.error;return r.data;};
 assert.equal((await call(1,'status')).enabled,true);
 assert.equal((await call(1,'save.put',{slot:'main',revision:0,version:1,data:{level:1,score:7}})).revision,1);
 assert.equal(await call(0,'save.get',{slot:'main'}),null);
 const own=await clients[1].rpc('fas_my_game_data');assert.equal(own.data.saves.length,1);
 const forged=await clients[0].rpc('fas_game_api',{game_key:game.id,game_version:game.updated_at,action:'save.get',params:{account:users[1],slot:'main'}});assert.ok(forged.error||forged.data.error);
 const room=await call(0,'room.create',{capacity:2});assert.ok(room.code);assert.ok(!JSON.stringify(room).includes(users[0]));
 const guest=await call(1,'room.join',{code:room.code});assert.equal(guest.players.length,2);
 assert.ok((await call(2,'room.join',{code:room.code})).error);
 const denied=await clients[2].from('game_player_state').select('*').eq('room_id',room.id);assert.deepEqual(denied.data,[]);
 const direct=await clients[1].from('game_player_state').update({payload:{forged:true}}).eq('room_id',room.id);assert.ok(direct.error);
 assert.ok((await call(1,'room.shared',{room:room.id,revision:0,data:{forged:true}})).error);
 let events=0,outsiderEvents=0;const deleteEvents=[];
 const subscribe=(i,fn)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Realtime subscription timed out')),12000);const c=clients[i].channel('dev-'+crypto.randomUUID()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_player_state',filter:'room_id=eq.'+room.id},fn).subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve(c);}if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(Error('Realtime channel error'));}});channels.push([clients[i],c]);});
 await subscribe(0,e=>{if(e.new.payload?.x===42)events++;});await subscribe(2,()=>outsiderEvents++);const deletion=clients[2].channel('delete-audit-'+crypto.randomUUID()).on('postgres_changes',{event:'DELETE',schema:'public',table:'game_player_state'},e=>deleteEvents.push(e.old)).subscribe();channels.push([clients[2],deletion]);await sleep(1500);
 assert.equal((await call(1,'room.player',{room:room.id,revision:0,data:{x:42,y:17}})).revision,1);
 for(let i=0;i<40&&!events;i++)await sleep(250);assert.equal(events,1,'real authenticated Realtime update reaches room member');assert.equal(outsiderEvents,0,'outsider receives no state');
 await clients[1].rpc('fas_leave_game_room',{room_key:room.id});assert.deepEqual((await clients[1].from('game_player_state').select('*').eq('room_id',room.id)).data,[]);
 await sleep(1500);for(const old of deleteEvents)assert.deepEqual(Object.keys(old),['event_id'],'deleted event contains no room, player or gameplay data');const save=await clients[1].rpc('fas_my_game_data');assert.equal(save.data.saves.length,1,'leaving room preserves saves');
 await clients[1].auth.signOut();assert.ok((await clients[1].rpc('fas_my_game_data')).error);
 console.log('PASS real DEV sessions: private saves, forged account rejection, room capacity, host-only shared state, Realtime delivery/RLS, leave/sign-out and unlinkable deletion identifiers');
}finally{
 for(const [client,c] of channels)await client.removeChannel(c);
 if(game)await query("delete from public.stories where id='"+game.id+"'");
 if(users.length)await query("delete from public.user_roles where user_id in ("+users.map(id=>"'"+id+"'").join(',')+")");
 for(const id of users){const r=await admin.auth.admin.deleteUser(id);if(r.error)throw r.error;}
 if(wasEnabled!==undefined)await query('update private.game_services_config set enabled='+wasEnabled);
 for(const c of clients)c.realtime.disconnect();
}
