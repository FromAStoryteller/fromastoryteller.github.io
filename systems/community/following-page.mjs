import {connectViewerAccount} from './viewer-actions.mjs';
import {onPageRestore} from '../core/page-restore.mjs';
import {createBrowseHistory} from '../content/browse-state.mjs';
import {watchViewerChanges} from './viewer-sync.mjs';
import {renderProfileCards} from './profile-directory.mjs';
import {loadFollowedStorytellers} from './following-service.mjs';
export {loadFollowedStorytellers} from './following-service.mjs';
import {signInHref} from '../../account/return-path.mjs';
import {getAllPublishedContent,renderContentGrid} from '../content/content-system.js';
import {contributorKey,newestPublished} from '../content/featured-selection.mjs';

export function followedWork(items,people){const ids=new Set(people.map(p=>p.public_id.toLowerCase()));return newestPublished(items.filter(item=>item.status==='published'&&!item.draft&&ids.has(contributorKey(item))));}

export async function mountFollowingPage(root,{connect=connectViewerAccount,loadContent=getAllPublishedContent}={}){
 const d=root.ownerDocument,w=d.defaultView,node=(tag,text)=>{const n=d.createElement(tag);if(text)n.textContent=text;return n;};
 let account,ended=false,loading=false,queued=false,stop,stopSync,people=[],work=[],peopleLimit=24,workLimit=12;
 const browsing=createBrowseHistory(()=>({pages:Math.max(peopleLimit/24,workLimit/12)}),{window:w,document:d});const pages=Math.max(1,Math.min(50,browsing.state?.pages??1));peopleLimit=24*pages;workLimit=12*pages;
 function fail(text,signIn=false){root.replaceChildren(node('h1','Following'),node('p',text));const a=node('a',signIn?'Sign in':'Reload following');a.className='account-secondary';a.href=signIn?signInHref('/account/following/'):'/account/following/';root.append(a);}
 try{account=await connect();if(!account){fail('Sign in to see the storytellers you follow.',true);return;}
  stop=account.subscribe(()=>{ended=true;people=[];work=[];stopSync?.();fail('Your account changed. Sign in again to view Following.',true);});
  const heading=node('h1','Following'),intro=node('p','The storytellers you follow. Your list is private. Storytellers see a total follower count, without names or account details.'),browse=node('a','Browse storytellers');browse.href='/storytellers/';browse.className='account-secondary storyteller-directory-back';
  const status=node('p');status.setAttribute('role','status');const retry=node('button','Try again');retry.type='button';retry.className='account-secondary following-retry';retry.hidden=true;
  const latest=node('section');latest.className='following-latest';latest.setAttribute('aria-label','Latest from storytellers you follow');latest.append(node('h2','Latest from storytellers you follow'));const feed=node('div');feed.id='following-work-grid';feed.className='content-grid';const feedMore=node('button','More published work');feedMore.type='button';feedMore.className='account-secondary';feedMore.hidden=true;latest.append(feed,feedMore);
  const section=node('section');section.className='following-people';section.append(node('h2','Storytellers you follow'));const grid=node('div');grid.className='storyteller-directory-grid';const more=node('button','More storytellers');more.type='button';more.className='account-secondary';more.hidden=true;section.append(grid,more);root.replaceChildren(heading,intro,browse,status,retry,latest,section);
  function paint(){renderProfileCards(grid,people.slice(0,peopleLimit),{imageBase:account.imageBase});more.hidden=people.length<=peopleLimit;renderContentGrid('#following-work-grid',work.slice(0,workLimit),people.length?'These storytellers have no published work available yet.':'Follow a storyteller to see their latest work here.');feedMore.hidden=work.length<=workLimit;}
  async function load(){if(ended)return;if(loading){queued=true;return;}loading=true;retry.hidden=true;status.textContent='Loading Following and latest work…';root.setAttribute('aria-busy','true');more.disabled=feedMore.disabled=true;
   try{const nextPeople=await loadFollowedStorytellers(account.client,{isEnded:()=>ended});if(ended)return;const items=nextPeople.length?await loadContent({refresh:true}):[];if(ended)return;
    people=nextPeople;work=followedWork(items,people);paint();status.textContent=people.length?`Following ${people.length} ${people.length===1?'storyteller':'storytellers'}. Latest work is shown newest first.`:'You are not following any storytellers yet. Browse storytellers to find someone whose journey you would like to follow.';
   }catch{if(!ended){status.textContent='Following and latest work could not be refreshed. Please try again.';retry.hidden=false;}}
   finally{loading=false;if(!ended){root.setAttribute('aria-busy','false');more.disabled=feedMore.disabled=false;if(queued){queued=false;void load();}}}
  }
  more.addEventListener('click',()=>{peopleLimit+=24;paint();});feedMore.addEventListener('click',()=>{workLimit+=12;paint();});retry.addEventListener('click',()=>void load());stopSync=watchViewerChanges(()=>void load(),{window:w,document:d});
  onPageRestore(w,()=>mountFollowingPage(root,{connect,loadContent}),{hide:root});w.addEventListener('pagehide',()=>{ended=true;people=[];work=[];browsing.dispose();stop?.();stopSync?.();},{once:true});await load();browsing.restore();
 }catch{if(!ended)fail('Following could not be loaded. Please reload and try again.');}
}
const root=typeof document!=='undefined'?document.querySelector('[data-following-root]'):null;if(root)void mountFollowingPage(root);
