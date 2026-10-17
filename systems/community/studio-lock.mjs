import {createSignInController} from '../../account/sign-in-controller.mjs';
import {downloadRecovery} from './studio-recovery.mjs';
// Only an independently verified matching account can reveal a captured manuscript.
export function mountStudioLock(root,{snapshot,ownerId,auth,verify,onResume,onForget}){
 const d=root.ownerDocument;let disposed=false,checking=false;
 const element=(tag,text)=>{const e=d.createElement(tag);if(text)e.textContent=text;return e;};
 const h=element('h2','Recover your unsaved writing'),intro=element('p','Your writing is held in this tab. Keep it open and sign back in with the same account to recover it. No save or publication will run while you are signed out.'),form=element('form'),status=element('p');
 h.tabIndex=-1;status.setAttribute('role','status');form.className='ss-recovery-sign-in';
 for(const [name,label,type,autocomplete]of [['email','Email','email','username'],['password','Password','password','current-password']]){
  const wrap=element('div'),l=element('label',label),input=element('input');wrap.className='ss-field';input.id='ss-recovery-'+name;input.name=name;input.type=type;input.autocomplete=autocomplete;input.required=true;l.htmlFor=input.id;wrap.append(l,input);form.append(wrap);
 }
 const submit=element('button','Sign in and recover');submit.type='submit';submit.className='account-submit';
 const check=element('button','Check my sign-in');check.type='button';check.className='account-secondary';
 const discard=element('button','Discard unsaved recovery');discard.type='button';discard.className='account-secondary';
 form.append(submit);root.append(h,intro,form,check,discard,status);root.dataset.recoveryLocked='true';h.focus();
 async function resume(){
  if(checking||disposed)return;checking=true;check.disabled=submit.disabled=true;status.textContent='Verifying your account…';
  try{const account=await verify();if(disposed)return;
   if(account.user.id!==ownerId||account.state!=='active'){onForget();return;}
   if(account.contributor){disposed=true;delete root.dataset.recoveryLocked;onResume(snapshot,account);return;}
   form.remove();check.remove();intro.textContent='Contributor access is unavailable. You can download your unsaved writing while signed in to its owning account.';
   for(const [label,plain]of [['Download text',true],['Download recovery file',false]]){const button=element('button',label);button.type='button';button.className='account-secondary';button.addEventListener('click',()=>downloadRecovery(d,snapshot,plain));root.insertBefore(button,status);}
   status.textContent='Account verified. Nothing was saved or published.';
  }catch{if(!disposed)status.textContent='Sign in with the original account, then try again. Your writing is still held in this tab.';}
  finally{checking=false;if(!disposed)check.disabled=submit.disabled=false;}
 }
 const controller=createSignInController(auth,state=>{
  if(disposed)return;status.textContent=state.message;submit.disabled=state.state==='pending';if(state.state==='signed-in')void resume();
 });
 form.addEventListener('submit',event=>{event.preventDefault();if(checking||!form.reportValidity())return;const password=form.elements.password.value;form.elements.password.value='';void controller.signIn(form.elements.email.value,password);});
 check.addEventListener('click',()=>void resume());discard.addEventListener('click',()=>{if(d.defaultView.confirm('Discard the unsaved writing held in this tab?'))onForget();});
 return ()=>{disposed=true;delete root.dataset.recoveryLocked;root.replaceChildren();};
}
