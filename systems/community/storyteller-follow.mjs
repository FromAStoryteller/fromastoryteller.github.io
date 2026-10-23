import {connectViewerAccount} from './viewer-actions.mjs';
import {watchViewerChanges,publishViewerChanges} from './viewer-sync.mjs';
import {isPublicId,publicProfileUrl} from './profiles.mjs';
import {signInHref} from '../../account/return-path.mjs';

export function mountStorytellerFollow(host,profile,{connect=connectViewerAccount,window:w=window}={}){
 const d=host.ownerDocument;if(!isPublicId(profile?.public_id))return ()=>{};
 const root=d.createElement('div');root.className='storyteller-follow';host.append(root);
 const follow=d.createElement('button');follow.type='button';follow.className='account-secondary';follow.textContent='Follow';follow.title='Add this storyteller to your private Following list';follow.dataset.followAction='';
 const menu=d.createElement('details');menu.className='storyteller-follow-menu';menu.hidden=true;
 const toggle=d.createElement('summary');toggle.className='account-secondary';toggle.dataset.followingToggle='';toggle.append(d.createTextNode('Following '));const chevron=d.createElement('i');chevron.className='fa-solid fa-chevron-down';chevron.setAttribute('aria-hidden','true');toggle.append(chevron);
 const popup=d.createElement('div');popup.className='storyteller-follow-popup';const unfollow=d.createElement('button');unfollow.type='button';unfollow.className='account-secondary account-danger';unfollow.textContent='Unfollow';popup.append(unfollow);menu.append(toggle,popup);
 const status=d.createElement('span');status.className='profile-share-status visually-hidden';status.setAttribute('role','status');root.append(follow,menu,status);
 let account=null,state=false,busy=false,disposed=false,epoch=0,failed=false,loading=false,queued=false,stop,stopSync;
 const paint=()=>{follow.hidden=state;menu.hidden=!state;follow.disabled=busy||loading;unfollow.disabled=busy||loading;follow.textContent=loading?'Checking follow status…':failed?'Retry follow check':'Follow';root.setAttribute('aria-busy',String(busy||loading));status.classList.toggle('visually-hidden',!status.textContent.includes('could not'));};
 function end(){epoch++;stop?.();stopSync?.();stop=stopSync=null;account=null;state=false;busy=loading=false;failed=false;menu.open=false;root.hidden=false;status.textContent='';paint();}
 async function refresh(){if(disposed)return;if(loading||busy){queued=true;return;}loading=true;const token=epoch;paint();
  try{if(!account){const connected=await connect();if(disposed||token!==epoch)return;account=connected;if(account){stop=account.subscribe(end);stopSync=watchViewerChanges(()=>void refresh(),{window:w,document:d});}}
   if(account){const r=await account.client.rpc('fas_my_storyteller_follow',{target_key:profile.public_id});if(disposed||token!==epoch)return;if(r.error||typeof r.data?.following!=='boolean')throw Error();state=r.data.following;root.hidden=r.data.can_follow===false||r.data.available===false;}
   failed=false;status.textContent='';
  }catch{if(!disposed&&token===epoch){failed=true;status.textContent='Following could not be checked. Please try again.';}}
  finally{if(!disposed&&token===epoch){loading=false;paint();if(queued){queued=false;void refresh();}}}
 }
 async function change(enabled){if(disposed||loading||busy)return;if(failed){void refresh();return;}
  if(!account){w.location.assign(signInHref(publicProfileUrl(profile.public_id)));return;}
  busy=true;const token=epoch;status.textContent='';paint();
  try{const r=await account.client.rpc('fas_set_storyteller_follow',{target_key:profile.public_id,enabled});if(disposed||token!==epoch)return;if(r.error||r.data?.following!==enabled)throw Error();state=enabled;menu.open=false;status.textContent=enabled?'Following '+profile.display_name+'.':'Unfollowed '+profile.display_name+'.';publishViewerChanges(w);w.dispatchEvent(new CustomEvent('fas-storyteller-follow-change'));(enabled?toggle:follow).focus({preventScroll:true});}
  catch{if(!disposed&&token===epoch)status.textContent='Your follow choice could not be saved. Please try again.';}
  finally{if(!disposed&&token===epoch){busy=false;paint();if(queued){queued=false;void refresh();}}}
 }
 follow.addEventListener('click',()=>void change(true));unfollow.addEventListener('click',()=>void change(false));
 const outside=e=>{if(!root.contains(e.target))menu.open=false;},escape=e=>{if(e.key==='Escape'&&menu.open){menu.open=false;toggle.focus({preventScroll:true});}};d.addEventListener('click',outside);root.addEventListener('keydown',escape);
 paint();void refresh();return ()=>{disposed=true;epoch++;stop?.();stopSync?.();d.removeEventListener('click',outside);root.remove();};
}
