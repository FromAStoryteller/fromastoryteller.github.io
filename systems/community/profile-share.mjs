import {isPublicId,publicProfileUrl} from './profiles.mjs';

// Public URL only: never copy account routes, tracking parameters or preview URLs.
export function profileShareControls(profile,{document:d=document,window:w=window}={}){
 const row=d.createElement('div');row.className='profile-share-controls';
 if(!isPublicId(profile?.public_id))return row;
 const url='https://fromastoryteller.com'+publicProfileUrl(profile.public_id);
 const status=d.createElement('span');status.className='profile-share-status';status.setAttribute('role','status');
 const makeButton=(label,icon)=>{const b=d.createElement('button');b.type='button';b.className='account-secondary';const i=d.createElement('i');i.className='fa-solid fa-'+icon;i.setAttribute('aria-hidden','true');const text=d.createElement('span');text.textContent=label;b.append(i,text);return b;};
 const copy=makeButton('Copy profile link','link');copy.dataset.copyProfileLink='';let fallback;
 function showFallback(){
  if(!fallback){fallback=d.createElement('div');fallback.className='profile-share-fallback';const label=d.createElement('label');label.textContent='Profile link';const input=d.createElement('input');input.type='text';input.readOnly=true;input.value=url;label.append(input);
   const close=makeButton('Close','xmark');close.addEventListener('click',()=>{fallback.remove();fallback=null;status.textContent='';copy.focus({preventScroll:true});});fallback.append(label,close);row.append(fallback);}
  status.textContent='Select and copy the profile link below.';const input=fallback.querySelector('input');input.focus({preventScroll:true});input.select();
 }
 copy.addEventListener('click',async()=>{copy.disabled=true;status.textContent='';try{if(!w.navigator.clipboard?.writeText)throw Error();await w.navigator.clipboard.writeText(url);if(!row.isConnected)return;fallback?.remove();fallback=null;status.textContent='Profile link copied.';}catch{if(row.isConnected)showFallback();}finally{copy.disabled=false;}});
 row.append(copy);
 if(typeof w.navigator.share==='function'){
  const share=makeButton('Share profile','share-nodes');share.dataset.shareProfile='';share.addEventListener('click',async()=>{share.disabled=true;status.textContent='';try{await w.navigator.share({title:profile.display_name+' | From A Storyteller',url});if(row.isConnected)status.textContent='Profile shared.';}catch(error){if(row.isConnected&&error?.name!=='AbortError')showFallback();}finally{share.disabled=false;}});row.append(share);
 }
 row.append(status);return row;
}
