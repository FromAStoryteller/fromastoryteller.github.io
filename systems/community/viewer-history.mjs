import {connectViewerAccount} from './viewer-actions.mjs';
import {onPageRestore} from '../core/page-restore.mjs';
import {createBrowseHistory} from '../content/browse-state.mjs';
import {createCardMarkup} from '../content/content-system.js';
import {publicCoverUrl} from './profiles.mjs';
import {watchViewerChanges,publishViewerChanges} from './viewer-sync.mjs';
import {signInHref} from '../../account/return-path.mjs';

export const historyViews={recent:'Recent Activity',completed:'Completed / Used / Played'};
const searchable=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
export function filterHistory(items,{query='',type='',period=''}={},now=Date.now()){
 const words=searchable(query).trim().split(/\s+/).filter(Boolean),days=({week:7,month:30})[period];
 return items.filter(item=>(!type||item.type===type)&&words.every(word=>searchable(item.title+' '+(item.summary??'')).includes(word))&&(!days||Date.parse(item.activity_at)>=now-days*86400000));
}
export function activityGroup(value,now=new Date()){
 if(!value)return 'Date not recorded';
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'Date not recorded';
 const day=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
 if(day(date)===day(now))return 'Today';
 const yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);if(day(date)===day(yesterday))return 'Yesterday';
 if(date.getTime()>=now.getTime()-7*86400000)return 'Earlier this week';
 return date.toLocaleDateString(undefined,{month:'long',year:'numeric'});
}
export async function historyPage(client,view,cursor=null){
 const r=await client.rpc('fas_my_content_history',{view_key:view,before_time:cursor?.activity_at??null,after_id:cursor?.id??null});
 if(r.error||!Array.isArray(r.data?.items))throw Error('Your history could not be loaded. Please try again.');
 return r.data;
}

export async function mountViewerHistory(root,{connect=connectViewerAccount}={}){
 const d=root.ownerDocument,w=d.defaultView,node=(tag,text='')=>{const el=d.createElement(tag);el.textContent=text;return el;};
 const params=new URL(w.location.href).searchParams,view=params.get('view')==='completed'?'completed':'recent';
 let ended=false,account,stop,stopSync,loading=false,queued=false,mutating=false,revision=0,cursor=null,loaded=false,cache=new Map(),limit=48,settings;
 const browsing=createBrowseHistory(()=>({pages:Math.ceil(limit/48)}),{window:w,document:d});limit=Math.max(1,Math.min(50,browsing.state?.pages??1))*48;
 const state={query:(params.get('q')??'').slice(0,160),type:params.get('type')??'',period:params.get('period')??''};
 function unavailable(text){root.replaceChildren(node('h1','Your history'),node('p',text));const a=node('a','Sign in');a.className='account-secondary';a.href=signInHref('/account/history/');root.append(a);}
 try{
  account=await connect();if(!account){unavailable('Sign in to see your private history.');return;}
  stop=account.subscribe(()=>{ended=true;revision++;cache.clear();stopSync?.();root.querySelector('dialog')?.close();unavailable('Your account changed. Sign in again to see your history.');});
  root.replaceChildren(node('h1','Your history'),node('p','Your activity and the pieces you have marked as read, played, watched, listened to, or used. Only you can see these lists.'));
  const nav=node('nav');nav.className='viewer-history-tabs';nav.setAttribute('aria-label','History sections');
  for(const [key,title]of Object.entries(historyViews)){const a=node('a',title);a.className='account-secondary';a.href='/account/history/?view='+key;if(key===view)a.setAttribute('aria-current','page');nav.append(a);}
  const heading=node('h2',historyViews[view]),description=node('p',view==='recent'?'Pieces you have opened, most recent first. Visiting does not mark a piece completed.':'Your explicit Read, Played, Watched, Listened and Used marks, newest marks first. Older marks without a recorded date appear last.');
  const privacy=node('section');privacy.className='viewer-history-recording';privacy.setAttribute('aria-label','Recent activity recording');
  const recording=node('p','Checking recent activity recording…'),toggle=node('button','Enable Recent Activity');toggle.type='button';toggle.className='account-secondary';toggle.disabled=true;
  const privacyText=node('p','On by default for signed-in accounts: keep the latest visit to up to 500 pieces for 90 days in your account. You can pause, remove entries, or clear visits. Saved lists, completion marks and game saves are separate.');
  const privacyLink=node('a','Privacy details');privacyLink.href='/privacy/#recent-activity';privacy.append(recording,privacyText,toggle,privacyLink);
  const controls=node('form');controls.className='viewer-collection-filters';controls.setAttribute('role','search');controls.setAttribute('aria-label','Filter your history');
  function field(title,el){const label=node('label',title);label.className='viewer-collection-field';el.setAttribute('aria-label',title);label.append(el);controls.append(label);return el;}
  const search=field('Search history',node('input'));search.type='search';search.maxLength=160;search.value=state.query;search.placeholder='Title or description';search.autocomplete='off';
  function select(title,values,current){const el=node('select');for(const [value,text]of values){const o=node('option',text);o.value=value;el.append(o);}el.value=current;if(el.selectedIndex<0)el.selectedIndex=0;return field(title,el);}
  const type=select('Content type',[['','All types'],['story','Stories'],['blog','Blog'],['game','Games'],['tool','Tools'],['video','Videos'],['audio','Audio']],state.type);
  const period=select('Activity date',[['','Any date'],['week','Last 7 days'],['month','Last 30 days']],state.period);
  state.type=type.value;state.period=period.value;
  const reset=node('button','Clear filters');reset.type='button';reset.className='account-secondary';controls.append(reset);
  const status=node('p','Loading history…');status.setAttribute('role','status');
  const actionStatus=node('p');actionStatus.setAttribute('role','status');
  const grid=node('div');grid.className='content-grid viewer-history-grid';
  const more=node('button','Load more');more.type='button';more.className='account-secondary';more.hidden=true;
  const retry=node('button','Try again');retry.type='button';retry.className='account-secondary';retry.hidden=true;
  const clear=node('button','Clear recent activity');clear.type='button';clear.className='account-secondary account-danger';clear.hidden=view!=='recent';clear.disabled=true;
  // A native modal gives keyboard users focus containment and Escape cancellation.
  const dialog=node('dialog');dialog.className='viewer-history-confirm';dialog.setAttribute('aria-labelledby','activity-confirm-title');
  const dialogTitle=node('h2','Clear recent activity?');dialogTitle.id='activity-confirm-title';
  const confirm=node('button','Clear recent activity');confirm.type='button';confirm.className='account-secondary account-danger';
  const cancel=node('button','Keep activity');cancel.type='button';cancel.className='account-secondary';cancel.autofocus=true;
  dialog.append(dialogTitle,node('p','This removes your recent visits. Your completion marks, saved lists, favourites and game saves stay as they are.'),cancel,confirm);
  root.append(nav,heading,description);if(view==='recent')root.append(privacy);root.append(controls,actionStatus,status,retry,grid,more,clear,dialog);
  function paintSettings(){recording.textContent=settings.enabled?'Recent activity recording is on.':'Recent activity recording is paused.';toggle.textContent=settings.enabled?'Pause recording':'Enable Recent Activity';toggle.disabled=mutating;}
  async function readSettings(){const r=await account.client.rpc('fas_my_activity_settings');if(ended)return;if(r.error||typeof r.data?.enabled!=='boolean')throw Error('Recent activity settings could not be checked. Please try again.');settings=r.data;paintSettings();}
  const dateText=item=>item.activity_at?new Date(item.activity_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Date not recorded';
  function render(){
   const rows=filterHistory([...cache.values()],state),shown=rows.slice(0,limit),oldFocus=d.activeElement,focusKey=oldFocus?.closest('[data-activity-entry]')?.dataset.activityEntry;
   grid.replaceChildren();let group='';
   for(const item of shown){
    const next=activityGroup(item.activity_at);if(next!==group){const h=node('h3',next);h.className='viewer-history-group';grid.append(h);group=next;}
    const entry=node('div');entry.className='viewer-history-entry';entry.dataset.activityEntry=item.id;
    const template=node('template'),image=item.source==='file'?item.image:publicCoverUrl(item.cover,account.imageBase);
    template.innerHTML=createCardMarkup({type:item.type,category:({story:'stories',game:'games',tool:'tools',video:'videos'})[item.type]??item.type,url:item.url,title:item.title,card:{title:item.title,description:item.summary,image,imageAlt:item.image_alt??item.cover?.alt??''}});
    entry.append(template.content);
    const meta=node('div');meta.className='viewer-history-meta';
    const label=view==='recent'?'Visited':({story:'Read',blog:'Read',game:'Played',tool:'Used',video:'Watched',audio:'Listened'})[item.type]??'Marked';
    const time=node('p',label+' · '+dateText(item));meta.append(time);
    if(view==='recent'){const remove=node('button','Remove');remove.type='button';remove.className='account-secondary account-danger';remove.setAttribute('aria-label','Remove '+item.title+' from recent activity');remove.disabled=mutating;remove.onclick=()=>void mutate('fas_remove_recent_activity',{content_key:item.id},'Visit removed.');meta.append(remove);}
    entry.append(meta);grid.append(entry);
   }
   if(focusKey&&!oldFocus.isConnected){const entry=[...grid.querySelectorAll('[data-activity-entry]')].find(el=>el.dataset.activityEntry===focusKey);(entry?.querySelector('button,a')??search).focus({preventScroll:true});}
   status.textContent=shown.length?shown.length+' '+(shown.length===1?'piece':'pieces')+' shown.':state.query||state.type||state.period?'No pieces match these filters.':view==='recent'?'No recent activity yet. Open a piece while recording is on to add it here.':'Nothing marked yet. Use Read, Played, Watched, Listened or Used on a piece to add it here.';
   more.hidden=!cursor&&rows.length<=shown.length;more.disabled=loading||mutating;clear.disabled=mutating||!cache.size;
   w.dispatchEvent(new CustomEvent('fas-viewer-collection-rendered'));
  }
  async function load(refresh=false){
   if(ended)return;if(loading||mutating){queued=true;return;}loading=true;retry.hidden=true;more.disabled=true;grid.setAttribute('aria-busy','true');
   const version=revision,items=refresh?new Map():new Map(cache);let next=refresh?null:cursor,fetched=!refresh&&loaded;const seen=new Set();
   try{
    if(view==='recent')await readSettings();if(ended)return;
    while(!fetched||(next&&filterHistory([...items.values()],state).length<limit)){
     const key=JSON.stringify(next);if(seen.has(key))throw Error('Your history could not be loaded. Please try again.');seen.add(key);
     const page=await historyPage(account.client,view,next);if(ended)return;if(version!==revision){queued=true;return;}
     for(const item of page.items)items.set(item.id,item);next=page.next_cursor;fetched=true;
    }
    if(ended||version!==revision)return;cache=items;cursor=next;loaded=true;render();
   }catch(e){if(!ended){status.textContent=e.message;retry.hidden=false;}}
   finally{loading=false;if(!ended){grid.setAttribute('aria-busy','false');more.disabled=mutating;if(queued){queued=false;void load(true);}}}
  }
  async function mutate(name,args,message){
   if(ended||mutating)return;mutating=true;revision++;toggle.disabled=true;clear.disabled=true;grid.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{const r=await account.client.rpc(name,args);if(ended)return;if(r.error||typeof r.data?.enabled!=='boolean')throw Error('Your change could not be saved. Please try again.');settings=r.data;publishViewerChanges(w);actionStatus.textContent=message;}
   catch(e){if(!ended)actionStatus.textContent=e.message;}
   finally{mutating=false;if(!ended){if(settings)paintSettings();await load(true);}}
  }
  toggle.onclick=()=>void mutate('fas_set_activity_recording',{enabled:!settings.enabled},'Recording setting saved.');
  clear.onclick=()=>dialog.showModal();cancel.onclick=()=>dialog.close();confirm.onclick=()=>{dialog.close();void mutate('fas_remove_recent_activity',{content_key:null},'Recent activity cleared.');};
  function change(){state.query=search.value.slice(0,160);state.type=type.value;state.period=period.value;limit=48;const url=new URL(w.location.href);for(const [key,value]of [['q',state.query],['type',state.type],['period',state.period]]){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}w.history.replaceState(w.history.state,'',url);render();void load();}
  search.addEventListener('input',change);type.onchange=change;period.onchange=change;controls.onsubmit=e=>{e.preventDefault();change();};reset.onclick=()=>{search.value=type.value=period.value='';change();search.focus();};
  more.onclick=()=>{limit+=48;void load();};retry.onclick=()=>void load(true);
  const changed=()=>{revision++;void load(true);};w.addEventListener('fas-viewer-action-change',changed);stopSync=watchViewerChanges(changed,{window:w,document:d});
  w.addEventListener('pagehide',()=>{ended=true;cache.clear();browsing.dispose();stop?.();stopSync?.();w.removeEventListener('fas-viewer-action-change',changed);},{once:true});
  onPageRestore(w,()=>mountViewerHistory(root,{connect}),{hide:root});
  await load();browsing.restore();
 }catch{if(!ended)unavailable('Your account could not be checked. Please sign in again.');}
}
const root=typeof document!=='undefined'?document.querySelector('[data-viewer-history]'):null;if(root)void mountViewerHistory(root);
