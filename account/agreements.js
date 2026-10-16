import { accountEnvironmentNote } from './environment-copy.mjs';
import { loadLocalAuthClient } from './local-auth-client.mjs';
import { currentPolicyRequirement, acceptCurrentPolicies } from './published-policies.mjs';
import { restoreSession } from './session-controller.mjs';
import { watchSessionEnd } from './session-events.mjs';
const status=document.querySelector('[data-agreement-status]');
const form=document.querySelector('[data-agreement-form]');
let local,requirement,busy=false;
let sessionEnded=false;
const show=(message,error=false)=>{status.textContent=message;status.dataset.state=error?'error':'success';};
function history(records) {
  const target=document.querySelector('[data-agreement-history]');target.replaceChildren();
  for(const record of records) {
    if(sessionEnded)return;
    const paragraph=document.createElement('p');
    paragraph.textContent=`Terms ${record.terms_version}; Privacy notice ${record.privacy_version}. Recorded ${new Date(record.recorded_at).toLocaleString()}.`;
    target.append(paragraph);
  }
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(!local || busy || !requirement || !form.reportValidity())return;
  busy=true;form.querySelector('fieldset').disabled=true;
  show('Recording your agreement…');
  try {
    history(await acceptCurrentPolicies(local.client,requirement,{ageConfirmed:form.querySelector('[data-age]').checked,termsAgreed:form.querySelector('[data-terms]').checked,privacyNoticeSeen:form.querySelector('[data-privacy]').checked}));
    form.hidden=true;show('Your agreement to these policy versions has been recorded.');
  } catch(error){show(error.message,true);}
  finally{busy=false;form.querySelector('fieldset').disabled=false;}
});
try {
  local=await loadLocalAuthClient();
  if(local) {
    watchSessionEnd(local,()=>{
      sessionEnded=true;form.hidden=true;form.reset();history([]);
      document.querySelector('[data-agreement-sign-in]').hidden=false;
      show('Your session has ended. Sign in to view your agreement history.',true);
    });
    document.querySelector('[data-preview-note]').textContent=accountEnvironmentNote(local.mode, 'Local test only — uses the isolated FAS test stack.', 'Development test only — uses FAS DEV.', 'Review the published versions and your agreement history.');
    requirement=await currentPolicyRequirement(local.client);
    const restored=await restoreSession(local.client.auth,local.hadSession,()=>local.storage.clear());
    if(restored.state!=='signed-in') {
      show(requirement?'Sign in to review the current Terms and your agreement history.':'No published Terms currently need your agreement. Sign in to view your agreement history.');
      document.querySelector('[data-agreement-sign-in]').hidden=false;
    } else {
      const records=await local.client.rpc('fas_my_policy_agreements');
      if(records.error || !Array.isArray(records.data))throw new Error('We couldn’t load your policy history. Please try again.');
      history(records.data);
      if(sessionEnded) { /* The sign-out handler already cleared private UI. */ }
      else if(!requirement)show('No published Terms currently need your agreement. Earlier test acknowledgements remain unchanged.');
      else if(records.data.some(record=>record.release_id===requirement.release_id))show('You have already agreed to the current Terms and seen the Privacy notice.');
      else {
        document.querySelector('[data-policy-version]').textContent=`Terms ${requirement.terms_version}; Privacy notice ${requirement.privacy_version}. Published ${new Date(requirement.published_at).toLocaleDateString()}.`;
        document.querySelector('[data-terms-link]').href=requirement.terms_path;
        document.querySelector('[data-privacy-link]').href=requirement.privacy_path;
        show('Review the linked policy versions before choosing whether to agree.');form.hidden=false;
      }
    }
  } else show('Published account policies are not enabled in this preview.');
} catch(error){show(error.message,true);}
