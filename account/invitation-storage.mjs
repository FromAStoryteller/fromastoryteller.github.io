const key='fas-pending-contributor-invitation';
const valid=token=>typeof token==='string'&&/^[a-f0-9-]{72}$/i.test(token);
export function rememberInvitation(token,storage,now=Date.now()) {if(!valid(token))return false;try{storage??=globalThis.sessionStorage;storage.setItem(key,JSON.stringify({token,at:now}));return true;}catch{return false;}}
export function pendingInvitation(storage,now=Date.now()){try{storage??=globalThis.sessionStorage;const item=JSON.parse(storage.getItem(key));if(valid(item?.token)&&Number.isFinite(item.at)&&item.at<=now&&now-item.at<86400000)return item.token;storage.removeItem(key);}catch{}return null;}
export function clearInvitation(storage){try{storage??=globalThis.sessionStorage;storage.removeItem(key);}catch{}}
export function showPendingInvitation(container){if(!container||!pendingInvitation()||container.querySelector('[data-pending-invitation]'))return;const link=container.ownerDocument.createElement('a');link.href='/account/invitation/';link.className='account-secondary';link.dataset.pendingInvitation='';link.textContent='Review contributor invitation';container.append(link);}
