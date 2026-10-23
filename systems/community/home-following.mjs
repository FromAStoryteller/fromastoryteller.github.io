import {connectViewerAccount} from './viewer-actions.mjs';
import {loadFollowedStorytellers} from './following-service.mjs';
import {watchViewerChanges} from './viewer-sync.mjs';

export async function mountHomeFollowing(host,onChange,{connect=connectViewerAccount,window:w=window}={}) {
 const d=host.ownerDocument,status=d.createElement('p');status.className='home-following-status';status.setAttribute('role','status');host.before(status);
 let ended=false,loading=false,queued=false,account,stop,stopSync;
 const changed=()=>void refresh();
 const clear=()=>{ended=true;stopSync?.();w.removeEventListener('fas-storyteller-follow-change',changed);onChange(new Set());status.remove();};
 async function refresh(){if(ended)return;if(loading){queued=true;return;}loading=true;
  try{const people=await loadFollowedStorytellers(account.client,{isEnded:()=>ended});if(ended)return;onChange(new Set(people.map(p=>p.public_id.toLowerCase())));status.textContent=people.length?'From storytellers you follow first, then more to discover.':'Follow storytellers to see their work first here.';}
  catch{if(!ended){status.replaceChildren(d.createTextNode('Following could not be checked. Showing all content. '));onChange(new Set());const retry=d.createElement('button');retry.type='button';retry.className='content-filter';retry.textContent='Retry following';retry.addEventListener('click',()=>void refresh());status.append(retry);}}
  finally{loading=false;if(queued&&!ended){queued=false;void refresh();}}
 }
 w.addEventListener('pagehide',()=>{ended=true;stop?.();stopSync?.();w.removeEventListener('fas-storyteller-follow-change',changed);},{once:true});
 try{account=await connect();if(ended)return;if(!account){status.remove();return;}stop=account.subscribe(clear);w.addEventListener('fas-storyteller-follow-change',changed);stopSync=watchViewerChanges(()=>void refresh(),{window:w,document:d});await refresh();}catch{status.remove();}
}
