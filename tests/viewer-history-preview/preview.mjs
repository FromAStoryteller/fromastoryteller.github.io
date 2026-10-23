import {mountViewerHistory} from '/systems/community/viewer-history.mjs';
import {recordRecentVisit} from '/systems/community/viewer-activity.mjs';
const now=Date.now(),item=(n,type='story',date=new Date(now-n*1000).toISOString())=>({id:'a6940000-0000-4000-8000-'+String(n).padStart(12,'0'),title:'Fictional '+type+' '+n,type,source:'file',url:'/'+({story:'stories',game:'games',tool:'tools'})[type]+'/fictional-'+n+'/',summary:'History fixture',image:'/assets/images/covers/the-deal.jpg',activity_at:date});
const fixture={settings:{enabled:true,version:0},recent:Array.from({length:52},(_,i)=>item(i+1)),completed:[item(100,'game'),item(101,'tool',null),item(102,'story',null)],calls:[],fail:false,wait:false,ended:false,subscribers:new Set()};
fixture.completed[0].title='Completed arcade game';fixture.completed[1].title='Useful timer';
const account={imageBase:'',subscribe(fn){fixture.subscribers.add(fn);return()=>fixture.subscribers.delete(fn);},client:{rpc:async(name,args)=>{
 fixture.calls.push({name,args});
 if(fixture.wait&&name==='fas_my_content_history')await new Promise(resolve=>fixture.resolve=resolve);
 if(fixture.fail)return {error:Error('Fictional offline failure')};
 if(name==='fas_my_activity_settings')return {data:{...fixture.settings}};
 if(name==='fas_set_activity_recording'){fixture.settings={enabled:args.enabled,version:fixture.settings.version+1};return {data:{...fixture.settings}};}
 if(name==='fas_remove_recent_activity'){fixture.recent=args.content_key?fixture.recent.filter(i=>i.id!==args.content_key):[];fixture.settings.version++;return {data:{...fixture.settings}};}
 if(name==='fas_my_content_history'){
  const rows=fixture[args.view_key],start=args.after_id?rows.findIndex(i=>i.id===args.after_id)+1:0,items=rows.slice(start,start+48),last=items.at(-1);
  return {data:{items,next_cursor:start+48<rows.length?{activity_at:last.activity_at,id:last.id}:null}};
 }
 if(name==='fas_record_content_visit')return {data:fixture.settings.enabled&&args.expected_version===fixture.settings.version};
 throw Error('Unexpected history fixture RPC '+name);
}}};
window.historyFixture=fixture;
fixture.track=()=>recordRecentVisit(account,{window:{location:{pathname:'/stories/the-deal/'}},document,isEnded:()=>fixture.ended});
fixture.end=()=>{fixture.ended=true;for(const fn of fixture.subscribers)fn();};
document.querySelector('#end-session').onclick=fixture.end;
await mountViewerHistory(document.querySelector('#history'),{connect:async()=>account});
