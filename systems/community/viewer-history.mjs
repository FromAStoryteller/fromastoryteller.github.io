import {connectViewerAccount} from './viewer-actions.mjs';
import {getAllPublishedContent,renderContentGrid} from '../content/content-system.js';
import {mountContentDiscovery} from '../content/content-discovery.mjs';
import {watchViewerChanges} from './viewer-sync.mjs';
import {signInHref} from '../../account/return-path.mjs';

// The existing account RPC resolves public URLs to both file and Studio identities.
// It returns only this viewer's choices and checks public availability afresh.
export async function loadExperiencedContent(client,items,{isEnded=()=>false}={}) {
 const read=new Set();
 for(let start=0;start<items.length;start+=100){
  const r=await client.rpc('fas_my_viewer_actions',{content_keys:items.slice(start,start+100).map(i=>i.url)});
  if(isEnded())return [];
  if(r.error||!Array.isArray(r.data))throw Error('Your read history could not be loaded.');
  for(const row of r.data)if(row.experienced===true)read.add(row.key);
 }
 return items.filter(i=>read.has(i.url));
}
export async function mountViewerHistory(root,{connect=connectViewerAccount,loadContent=getAllPublishedContent}={}) {
 const d=root.ownerDocument,w=d.defaultView,node=(tag,text)=>{const n=d.createElement(tag);n.textContent=text;return n;};
 let ended=false,loading=false,queued=false,account,stop,stopSync,discovery,signature='';
 function unavailable(text){root.replaceChildren(node('h1','Read history'),node('p',text));const a=node('a','Sign in');a.className='account-secondary';a.href=signInHref('/account/history/');root.append(a);}
 try{account=await connect();if(!account){unavailable('Sign in to see your private read history.');return;}
  stop=account.subscribe(()=>{ended=true;stopSync?.();discovery?.dispose();unavailable('Your account changed. Sign in again to see your history.');});
  const filters=node('div');filters.className='content-filters';const status=node('p','Loading read history.');status.setAttribute('role','status');const retry=node('button','Try again');retry.type='button';retry.className='account-secondary';retry.hidden=true;const grid=node('div');grid.id='viewer-history-grid';grid.className='content-grid';
  root.replaceChildren(node('h1','Read history'),node('p','Everything you have marked as read, played, watched, listened to, or used. This list is private. Available published pieces are shown newest first.'),status,retry,filters,grid);
  async function load(){if(ended)return;if(loading){queued=true;return;}loading=true;root.setAttribute('aria-busy','true');retry.hidden=true;
   try{const items=await loadContent({refresh:true});if(ended)return;const rows=await loadExperiencedContent(account.client,items,{isEnded:()=>ended});if(ended)return;
    const next=JSON.stringify(rows);if(next!==signature||!discovery){signature=next;discovery?.dispose();discovery=mountContentDiscovery(filters,rows,found=>renderContentGrid('#viewer-history-grid',found,rows.length?'No pieces match these filters.':'Nothing here yet. Mark a piece as read, played, watched, or used to find it here.'),{window:w});}
    status.textContent=rows.length?`${rows.length} completed ${rows.length===1?'piece':'pieces'}.`:'';
   }catch{if(!ended){status.textContent='Read history could not be refreshed. Please try again.';retry.hidden=false;}}
   finally{loading=false;if(!ended){root.setAttribute('aria-busy','false');if(queued){queued=false;void load();}}}
  }
  const changed=()=>void load();w.addEventListener('fas-viewer-action-change',changed);
  retry.addEventListener('click',()=>void load());stopSync=watchViewerChanges(changed,{window:w,document:d});w.addEventListener('pagehide',()=>{ended=true;stop?.();stopSync?.();w.removeEventListener('fas-viewer-action-change',changed);},{once:true});w.addEventListener('pageshow',e=>{if(e.persisted)w.location.reload();});await load();
 }catch{if(!ended)unavailable('Your account could not be checked. Please sign in again.');}
}
const root=typeof document!=='undefined'?document.querySelector('[data-viewer-history]'):null;if(root)void mountViewerHistory(root);
