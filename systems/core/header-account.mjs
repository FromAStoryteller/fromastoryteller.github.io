import {navigationSnapshot,rememberNavigationSnapshot,clearNavigationSnapshot} from '../../account/navigation-shell.mjs';
import {signInHref} from '../../account/return-path.mjs';
import {syncProfileSidebar} from './profile-sidebar.mjs';

export function initHeaderAccount({closeOther=()=>{}}={}) {
 const host=document.querySelector('[data-header-account]'),toggle=host?.querySelector('[data-account-toggle]'),panel=host?.querySelector('.header-account-panel');
 if(!host||!toggle||!panel)return;
 let open=false,pinned=false,leaveTimer,checking,auth=null,known=navigationSnapshot(),epoch=0,rendered='',watching=false,phase='checking',focusFirst=false,verifiedUser=null;
 const current=location.pathname.replace(/index\.html$/,'');
 function render(access=known){
  syncProfileSidebar(access);
  if(access || phase==='ready' || phase==='unavailable') delete document.documentElement.dataset.fasAccountStartup;
  const active=panel.contains(document.activeElement)?{href:document.activeElement.getAttribute('href'),text:document.activeElement.textContent}:null;
  const links=access?[['Edit my profile','/account/profile/'],...(access.contributor&&access.publicId&&/^[0-9a-f-]{36}$/i.test(access.publicId)?[['View public profile','/storytellers/?author='+encodeURIComponent(access.publicId)]]:[]),...(access.contributor?[['Storyteller Studio','/account/studio/']]:[]),['Game saves','/account/games/'],['Account settings','/account/settings/'],...(access.admin?[['Admin tools','/account/admin/']]:[])]:phase==='ready'?[['Sign in',signInHref(location.pathname+location.search)],['Create account','/account/sign-up/'],['Account settings','/account/settings/']]:[];
  const signature=JSON.stringify([links,Boolean(auth),phase]);
  if(signature===rendered)return;
  rendered=signature;
  // Keep focus within the account menu while a retry replaces its controls.
  if(active&&!links.length){focusFirst=true;toggle.focus({preventScroll:true});}
  panel.replaceChildren();
  if(!access&&phase==='checking')message('Loading your account…');
  for(const [label,href] of links){const a=document.createElement('a');a.href=href;a.textContent=label;if(current===href)a.setAttribute('aria-current','page');panel.append(a);}
  if(access){const b=document.createElement('button');b.type='button';b.textContent='Sign out';b.disabled=!auth;b.addEventListener('click',async()=>{
   // Studio's existing sign-out action protects pending saves and recovery.
   const existing=document.querySelector('main [data-account-sign-out]');if(existing){existing.click();return;}
   b.disabled=true;b.textContent='Signing out…';try{const result=await auth.signOut({scope:'local'});if(result?.error)throw result.error;clearNavigationSnapshot();known=null;auth=null;render();close(true);}catch{b.disabled=false;b.textContent='Could not sign out. Try again';}
  });panel.append(b);}
  if(focusFirst){const first=panel.querySelector('a,button:not(:disabled)');if(first){first.focus({preventScroll:true});focusFirst=false;}}
  else if(active){const items=[...panel.querySelectorAll('a,button:not(:disabled)')];(items.find(e=>active.href?e.getAttribute('href')===active.href:e.textContent===active.text)??items[0])?.focus({preventScroll:true});}
 }
 function message(text,retry=false){const p=document.createElement('p');p.setAttribute('role','status');p.textContent=text;panel.append(p);if(retry){const b=document.createElement('button');b.type='button';b.textContent='Retry account check';b.dataset.headerRetry='';b.addEventListener('click',()=>{checking=null;void check();});panel.append(b);}}
 async function check(){
  if(checking)return checking;phase='checking';render();const requestEpoch=epoch;
  checking=(async()=>{try{
   const [{loadLocalAuthClient},{restoreSession},{loadProfileAccount},{watchSessionEnd}]=await Promise.all([import('../../account/local-auth-client.mjs'),import('../../account/session-controller.mjs'),import('../../account/settings-controller.mjs'),import('../../account/session-events.mjs')]);
   const local=await loadLocalAuthClient();if(!local)throw Error('Account services are unavailable.');
   const end=()=>{epoch++;known=null;auth=null;checking=null;phase='ready';verifiedUser=null;clearNavigationSnapshot();render();};
   if(!watching){watching=true;const stop=watchSessionEnd(local,end);
    const changes=local.client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user?.id&&session.user.id!==verifiedUser&&phase!=='checking'){
     // Auth requests run after the SDK releases its event/refresh lock.
     epoch++;checking=null;known=null;auth=null;phase='checking';clearNavigationSnapshot();render();setTimeout(()=>void check(),0);
    }}).data.subscription;
    addEventListener('pagehide',()=>{stop();changes.unsubscribe();},{once:true});}
   const session=await restoreSession(local.client.auth,local.hadSession,()=>local.storage.clear());if(requestEpoch!==epoch)return;
   if(session.state!=='signed-in'){if(session.state==='session-unavailable')throw Error(session.message);phase='ready';clearNavigationSnapshot();known=null;auth=null;render();return;}
   const account=await loadProfileAccount(local.client,{useRestoredSession:true,onNavigation:access=>{if(requestEpoch!==epoch)return;auth=local.client.auth;known={...access,publicId:access.contributor?navigationSnapshot()?.publicId:null};rememberNavigationSnapshot(known);render(known);}});
   if(requestEpoch!==epoch)return;
   if(account.state!=='active'){clearNavigationSnapshot();known={contributor:false,admin:false};}else known={admin:account.admin,contributor:account.contributor,publicId:account.contributor?account.profile.public_id:null};
   verifiedUser=account.user.id;phase='ready';auth=local.client.auth;if(account.state==='active')rememberNavigationSnapshot(known);render(known);
  }catch{if(requestEpoch===epoch){phase='unavailable';auth=null;render();message('Could not check your account. Please try again.',true);}}})();return checking;
 }
 function close(returnFocus=false){clearTimeout(leaveTimer);open=false;pinned=false;focusFirst=false;panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(returnFocus)toggle.focus({preventScroll:true});}
 function show(pin=false){clearTimeout(leaveTimer);closeOther();open=true;pinned=pin||pinned;panel.hidden=false;toggle.setAttribute('aria-expanded','true');void check();}
 toggle.addEventListener('click',()=>{if(open&&pinned)close();else show(true);});
 toggle.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();focusFirst=true;show(true);const first=panel.querySelector('a,button:not(:disabled)');if(first){first.focus();focusFirst=false;}}});
 host.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&matchMedia('(hover:hover)').matches)show();});
 host.addEventListener('pointerleave',()=>{if(!pinned)leaveTimer=setTimeout(()=>close(),180);});
 host.addEventListener('focusout',e=>{if(host.contains(e.relatedTarget))return;setTimeout(()=>{if(open&&!host.contains(document.activeElement))close();},0);});
 document.addEventListener('click',e=>{if(open&&!e.composedPath().includes(host))close();});
 document.addEventListener('keydown',e=>{if(!open)return;if(e.key==='Escape'){e.preventDefault();close(true);return;}if(!panel.contains(document.activeElement))return;const items=[...panel.querySelectorAll('a,button:not(:disabled)')];let index=items.indexOf(document.activeElement);if(e.key==='ArrowDown')index=(index+1)%items.length;else if(e.key==='ArrowUp')index=(index-1+items.length)%items.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=items.length-1;else return;e.preventDefault();items[index]?.focus();});
 document.addEventListener('fas-shell-open',e=>{if(e.detail)close();});
 globalThis.addEventListener('fas-navigation-change',e=>{if(e.detail?.clear){known=null;auth=null;}else known=navigationSnapshot();render();});
 // Resolve the account alongside the rest of the shell, before the first hover.
 render();void check();
 addEventListener('pageshow',event=>{if(event.persisted){epoch++;checking=null;watching=false;known=navigationSnapshot();auth=null;void check();}});
}
