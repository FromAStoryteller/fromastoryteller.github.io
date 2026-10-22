import {connectViewerAccount} from './viewer-actions.mjs';
import {watchViewerChanges} from './viewer-sync.mjs';
import {renderProfileCards} from './profile-directory.mjs';
import {isPublicId} from './profiles.mjs';
import {signInHref} from '../../account/return-path.mjs';

export async function mountFollowingPage(root,{connect=connectViewerAccount}={}){
 const d=root.ownerDocument,w=d.defaultView,node=(tag,text)=>{const n=d.createElement(tag);if(text)n.textContent=text;return n;};
 let account,ended=false,loading=false,queued=false,cursor=null,retryAppend=false,stop,stopSync;const people=new Map();
 function fail(text,signIn=false){root.replaceChildren(node('h1','Following'),node('p',text));const a=node('a',signIn?'Sign in':'Reload following');a.className='account-secondary';a.href=signIn?signInHref('/account/following/'):'/account/following/';root.append(a);}
 try{account=await connect();if(!account){fail('Sign in to see the storytellers you follow.',true);return;}
  stop=account.subscribe(()=>{ended=true;people.clear();stopSync?.();fail('Your account changed. Sign in again to view Following.',true);});
  const heading=node('h1','Following'),intro=node('p','The storytellers you follow. Your list is private. Storytellers see a total follower count, without names or account details.'),browse=node('a','Browse storytellers');browse.href='/storytellers/';browse.className='account-secondary storyteller-directory-back';
  const status=node('p');status.setAttribute('role','status');const grid=node('div');grid.className='storyteller-directory-grid';const more=node('button','More storytellers');more.type='button';more.className='account-secondary';more.hidden=true;root.replaceChildren(heading,intro,browse,status,grid,more);
  async function load(append=false){if(ended)return;if(loading){queued=true;return;}loading=true;retryAppend=append;more.disabled=true;status.textContent='Loading Following.';grid.setAttribute('aria-busy','true');
   try{const next=append?cursor:null,r=await account.client.rpc('fas_my_following',{after_name:next?.name??null,after_id:next?.id??null});if(ended)return;
    if(r.error||!Array.isArray(r.data?.items)||r.data.items.length>24||r.data.items.some(p=>!isPublicId(p.public_id)||typeof p.display_name!=='string')||r.data.next_cursor&&(!isPublicId(r.data.next_cursor.id)||typeof r.data.next_cursor.name!=='string'||JSON.stringify(r.data.next_cursor)===JSON.stringify(next)))throw Error();
    if(!append)people.clear();for(const p of r.data.items)people.set(p.public_id,p);cursor=r.data.next_cursor;renderProfileCards(grid,[...people.values()],{imageBase:account.imageBase});more.hidden=!cursor;more.textContent='More storytellers';status.textContent=people.size?'Showing '+people.size+' '+(people.size===1?'storyteller.':'storytellers.'):'You are not following any storytellers yet. Browse storytellers to find someone whose journey you would like to follow.';
   }catch{if(!ended){status.textContent='Following could not be loaded. Please try again.';more.hidden=false;more.textContent='Try again';}}
   finally{loading=false;if(!ended){grid.setAttribute('aria-busy','false');more.disabled=false;if(queued){queued=false;void load();}}}
  }
  more.addEventListener('click',()=>void load(more.textContent==='Try again'?retryAppend:true));stopSync=watchViewerChanges(()=>void load(),{window:w,document:d});
  w.addEventListener('pageshow',event=>{if(event.persisted)w.location.reload();});w.addEventListener('pagehide',()=>{ended=true;people.clear();stop?.();stopSync?.();},{once:true});await load();
 }catch{if(!ended)fail('Following could not be loaded. Please reload and try again.');}
}
const root=typeof document!=='undefined'?document.querySelector('[data-following-root]'):null;if(root)void mountFollowingPage(root);
