// A short-lived, tab-local presentation hint. Never used for authentication,
// role checks, editor access or template permissions. Destinations verify afresh.
const KEY='fas-account-navigation-v1',TTL=10*60*1000;
const safeStorage=name=>{try{return globalThis[name];}catch{return null;}};
function identity(raw){try{const value=JSON.parse(raw),claims=JSON.parse(atob(value.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(typeof value.user?.id==='string'&&typeof claims.session_id==='string')return {user:value.user.id,session:claims.session_id};}catch{}return null;}
function activeStorage(key,store){const prefix=key.replace(/-(remembered|[0-9a-f-]{36})$/i,'');if(prefix===key)return false;const tab=safeStorage('sessionStorage'),mode=tab?.getItem(prefix+'-mode');return mode==='tab'?store==='sessionStorage'&&key===prefix+'-'+tab?.getItem(prefix+'-tab-id'):store==='localStorage'&&key===prefix+'-remembered';}
export function clearNavigationSnapshot(){try{safeStorage('sessionStorage')?.removeItem(KEY);}catch{}}
export function navigationSnapshot(){try{const hint=JSON.parse(safeStorage('sessionStorage')?.getItem(KEY)??'null');if(!hint||hint.expires<Date.now()||hint.expires>Date.now()+TTL||!['localStorage','sessionStorage'].includes(hint.store)||!/^fas-account-/.test(hint.key))return null;if(!activeStorage(hint.key,hint.store))return null;const current=identity(safeStorage(hint.store)?.getItem(hint.key));if(!current||current.user!==hint.user||current.session!==hint.session){clearNavigationSnapshot();return null;}return hint;}catch{return null;}}
export function rememberNavigationSnapshot({admin=false,contributor=false,publicId}={}){
 try{let found;for(const store of ['localStorage','sessionStorage']){const storage=safeStorage(store);for(let i=0;storage&&i<storage.length;i++){const key=storage.key(i);if(!/^fas-account-/.test(key)||!activeStorage(key,store))continue;const current=identity(storage.getItem(key));if(current){found={...current,key,store};break;}}if(found)break;}if(!found)return;const previous=navigationSnapshot();safeStorage('sessionStorage')?.setItem(KEY,JSON.stringify({...found,admin:admin===true,contributor:contributor===true,publicId:contributor?(publicId??(previous?.user===found.user?previous.publicId:null)):null,expires:Date.now()+TTL}));}catch{}
}
export function mountNavigationShell(document){
 const hint=navigationSnapshot();if(!hint)return;
 const host=document.querySelector('[data-account-navigation], [data-studio-navigation], [data-admin-navigation]')??(document.querySelector('[data-profile-mode="profile"]')?document.querySelector('[data-profile-root]'):null);if(!host)return;
 const nav=document.createElement('nav');nav.className='account-navigation'+(hint.admin?' account-navigation--admin':'');nav.setAttribute('aria-label','Your profile and account');nav.dataset.navigationShell='';
 const links=[['profile','Edit my profile','/account/profile/'],...(hint.publicId&&/^[0-9a-f-]{36}$/i.test(hint.publicId)?[['public','View public profile','/storytellers/?author='+encodeURIComponent(hint.publicId)]]:[]),...(hint.contributor?[['studio','Storyteller Studio','/account/studio/']]:[]),['settings','Account settings','/account/settings/'],...(hint.admin?[['admin','Admin tools','/account/admin/']]:[])];
 for(const [key,label,href]of links){const a=document.createElement('a');a.className='account-secondary';a.href=href;a.textContent=label;if(location.pathname==='/account/'+key+'/')a.setAttribute('aria-current','page');nav.append(a);}
 const signOut=document.createElement('button');signOut.className='account-secondary';signOut.type='button';signOut.disabled=true;signOut.textContent='Sign out';nav.append(signOut);
 host.querySelector('.account-navigation')?.remove();host.prepend(nav);
}
if(typeof document!=='undefined'){
 mountNavigationShell(document);
 globalThis.addEventListener?.('storage',()=>{if(!navigationSnapshot()){
  clearNavigationSnapshot();document.querySelectorAll('[data-navigation-shell]').forEach(nav=>nav.remove());
 }});
}
