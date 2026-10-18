import {roleLabel} from '../../account/roles.mjs';
const el=(d,tag,cls,text)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const date=value=>value?new Intl.DateTimeFormat('en-NZ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
export function mountAdminTools(root,service,{onAccessLost=()=>{}}={}){
 const d=root.ownerDocument;let disposed=false,busy=false,generation=0;let inviteOffset=0,storyOffset=0,activityOffset=0,accountOffset=0;let accountSearch='',accountFilter='all',accountSort='name';
 root.innerHTML=`<header class="admin-heading"><p class="account-eyebrow">Behind the stories</p><h1>Admin tools</h1><p>Look after the people and stories that make this place.</p></header>
 <div class="admin-overview" data-overview aria-label="Community overview"></div>
 <nav class="admin-tabs" aria-label="Admin sections"><button class="account-secondary" data-tab="invitations" aria-current="page">Invitations</button><button class="account-secondary" data-tab="accounts">Accounts &amp; roles</button><button class="account-secondary" data-tab="moderation">Moderation</button><button class="account-secondary" data-tab="warnings">Warning requests</button><button class="account-secondary" data-tab="activity">Activity</button></nav>
 <p class="admin-status" role="status" aria-live="polite" data-admin-status></p><div data-admin-content></div>`;
 const content=root.querySelector('[data-admin-content]'),status=root.querySelector('[data-admin-status]');
 const say=(message,error=false)=>{if(disposed)return;status.textContent=message;status.dataset.state=error?'error':'';};
 async function run(fn){if(busy||disposed)return;busy=true;root.setAttribute('aria-busy','true');root.querySelectorAll('button,input,select,textarea').forEach(n=>{if(!n.readOnly)n.disabled=true;});try{await fn();}catch(e){say(e.message,true);if(/Administrator access|Sign in again|account changed|Active account session/.test(e.message))onAccessLost();}finally{busy=false;if(!disposed){root.removeAttribute('aria-busy');root.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=n.hasAttribute('data-unavailable'));}}}
 async function summary(){const data=await service.overview();if(disposed)return;const box=root.querySelector('[data-overview]');box.replaceChildren();for(const [key,label] of [['contributors','Contributors'],['admins','Administrators'],['pending_invites','Open invitations'],['published_stories','Published stories']]){const item=el(d,'div','admin-stat');item.append(el(d,'strong','',String(data[key]??0)),el(d,'span','',label));box.append(item);}}
 function button(label,handler,danger=false,primary=false){const b=el(d,'button',primary?'account-submit admin-destructive admin-destructive--primary':danger?'account-secondary admin-destructive':'account-secondary',label);b.type='button';b.addEventListener('click',()=>run(handler));return b;}
 function heading(title,description){content.replaceChildren(el(d,'h2','',title),el(d,'p','admin-muted',description));}
 function pager(offset,rows,next){const p=el(d,'div','admin-pagination');if(offset>0)p.append(button('Previous',()=>next(Math.max(0,offset-25))));p.append(el(d,'span','admin-muted',rows.length?`Showing ${offset+1}–${offset+rows.length}`:'Nothing to show'));if(rows.length===25)p.append(button('Next',()=>next(offset+25)));content.append(p);}
 async function invitations(offset=inviteOffset){
 inviteOffset=offset;const [rows,jobs,delivery]=await Promise.all([service.invites(offset),service.emailJobs?service.emailJobs(offset):[],service.emailStatus?service.emailStatus().catch(()=>({ready:false})):({ready:false})]);
 if(disposed)return;heading('Contributor invitations','Invite someone to contribute. Invitations grant contributor access only; admin access is managed separately.');
 const ready=delivery.ready===true;
 const form=el(d,'form','account-form admin-form');form.innerHTML=`<div class="account-field"><label for="invite-email">Email address</label><input id="invite-email" type="email" autocomplete="off" required maxlength="254"></div><div class="account-field"><label for="invite-days">Valid for</label><select id="invite-days"><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></div><button class="account-submit" type="submit" data-email-invite>Send invitation email</button><p class="password-guidance">${ready?'The email includes a private invitation link. The recipient must verify their email and choose to accept.':'Email delivery is not enabled yet. You can still create a private invitation link below.'}</p>`;
 const send=form.querySelector('[data-email-invite]');if(!ready){send.disabled=true;send.setAttribute('data-unavailable','');}
 const result=el(d,'div','admin-invite-result');
 form.addEventListener('submit',event=>{event.preventDefault();if(!ready||!form.reportValidity())return;void run(async()=>{
  const job=await service.sendInvitation(form.querySelector('input').value.trim(),Number(form.querySelector('select').value));if(disposed)return;
  await invitations();await summary();say(job.state==='accepted'?'Invitation accepted by the email provider. Delivery is confirmed separately below.':job.state==='failed'?'Email delivery failed. Check the address and delivery status before resending.':'Invitation queued. Temporary delivery failures will retry automatically.');
 });});
 const fallback=el(d,'details','admin-invite-fallback'),label=el(d,'summary','','Create a private link instead');fallback.append(label,el(d,'p','admin-muted','No email is sent by this action. Share the link privately with the invited person.'));
 fallback.append(button('Create invitation link',async()=>{
  if(!form.reportValidity())return;const email=form.querySelector('input').value.trim(),token=await service.issueInvite(email,Number(form.querySelector('select').value));if(disposed)return;
  const url=new URL('/account/invitation/',location.origin);url.hash='invite='+encodeURIComponent(token);
  result.replaceChildren(el(d,'h3','','Invitation link ready'),el(d,'p','',`For ${email}. This private link is shown only now. Copy it before leaving this section.`));
  const input=el(d,'input','admin-invite-link');input.readOnly=true;input.value=url.href;input.setAttribute('aria-label','Private contributor invitation link');
  result.append(input,button('Select link',async()=>{input.focus();input.select();say('Link selected. Copy it and share it privately.');}));
  say('Invitation created. No email was sent.');await summary();
 }));
 content.append(form,fallback,result,button('Refresh delivery status',async()=>{await invitations();await summary();say('Invitation and email statuses refreshed.');}));
 const labels={queued:'Queued',sending:'Sending',retrying:'Waiting to retry',accepted:'Accepted by email provider',delivered:'Delivered',delayed:'Delivery delayed',failed:'Delivery failed',bounced:'Bounced — check the address',complained:'Delivery blocked',suppressed:'Delivery blocked',canceled:'Canceled'};
 const list=el(d,'div','admin-list');for(const row of rows){
  const item=el(d,'article','admin-row'),state=row.accepted_at?'Accepted':row.revoked_at?'Revoked':new Date(row.expires_at)<=new Date()?'Expired':'Pending';
  const job=jobs.find(j=>j.invite_id===row.id);
  item.append(el(d,'h3','',row.email),el(d,'p','admin-muted',`${state} · Expires ${date(row.expires_at)}`));
  if(job)item.append(el(d,'p','admin-mail-state',`Email: ${labels[job.state]??'Status unavailable'}${job.state==='retrying'?' · Next attempt '+date(job.next_attempt):''}`));
  if(state==='Pending'){
   if(ready&&!['bounced','complained','suppressed'].includes(job?.state)){
    item.append(button(job?'Resend invitation email':'Send invitation email',async()=>{
     if(!d.defaultView.confirm('Send a new invitation email? Any earlier invitation link will stop working.'))return;
     const sent=await service.sendInvitation(null,7,row.id);await invitations();say(sent.state==='accepted'?'Invitation accepted by the email provider.':'Check the updated delivery status.');
    }));
   }
   item.append(button('Revoke invitation',async()=>{
    item.querySelector('.admin-confirm')?.remove();const confirm=el(d,'div','admin-confirm');confirm.append(el(d,'p','','Revoking this invitation makes its link unusable and cancels queued email.'),button('Confirm revoke',async()=>{await service.revokeInvite(row.id);await invitations();await summary();say('Invitation revoked.');},true,true),button('Cancel',async()=>confirm.remove()));item.append(confirm);
   },true));
  }
  list.append(item);
 }if(!rows.length)list.append(el(d,'p','admin-empty','No invitations yet.'));
 content.append(list);pager(offset,rows,invitations);
 }

 async function accounts(offset=accountOffset){
 accountOffset=offset;
 const page=await service.accounts(accountSearch,accountFilter,offset,accountSort);
 if(disposed)return;
 if(offset>0&&offset>=page.total){return accounts(Math.max(0,Math.floor((page.total-1)/25)*25));}
 heading('Accounts & roles','Browse community accounts. Contributor and administrator access are independent; an account can appear under both filters.');
 const form=el(d,'form','account-form admin-form admin-directory-filters');
 form.innerHTML=`<div class="account-field"><label for="account-search">Name or email</label><input id="account-search" type="search" autocomplete="off" maxlength="254" placeholder="Search accounts"></div><div class="account-field"><label for="account-role-filter">Role</label><select id="account-role-filter"><option value="all">All accounts</option><option value="viewer">Viewers</option><option value="member">Contributors</option><option value="admin">Administrators</option></select></div><div class="account-field"><label for="account-sort">Sort by</label><select id="account-sort"><option value="name">Display name</option><option value="newest">Newest first</option><option value="email">Email address</option></select></div><div class="admin-actions"><button class="account-submit" type="submit">Apply filters</button><button class="account-secondary" type="button" data-reset-filters>Clear filters</button><button class="account-secondary" type="button" data-refresh-accounts>Refresh list</button></div>`;
 form.querySelector('input').value=accountSearch;form.querySelector('#account-role-filter').value=accountFilter;form.querySelector('#account-sort').value=accountSort;
 const apply=()=>{accountSearch=form.querySelector('input').value.trim();accountFilter=form.querySelector('#account-role-filter').value;accountSort=form.querySelector('#account-sort').value;return accounts(0);};
 form.addEventListener('submit',e=>{e.preventDefault();if(form.reportValidity())void run(apply);});
 form.querySelector('[data-reset-filters]').addEventListener('click',()=>run(async()=>{accountSearch='';accountFilter='all';accountSort='name';await accounts(0);}));
 form.querySelector('[data-refresh-accounts]').addEventListener('click',()=>run(async()=>{await accounts(accountOffset);say('Account list refreshed.');}));
 content.append(form);
 const count=el(d,'p','admin-muted',page.total?`Showing ${offset+1}–${offset+page.accounts.length} of ${page.total} ${page.total===1?'account':'accounts'}`:'No matching accounts');
 content.append(count);
 const list=el(d,'div','admin-list');
 for(const account of page.accounts){
  const item=el(d,'details','admin-row admin-account-row');
  const summary=el(d,'summary','admin-account-summary');
  const identity=el(d,'span','admin-account-identity');
  identity.append(el(d,'strong','',account.display_name||'Unnamed account'),el(d,'span','admin-muted',roleLabel(account.roles)));
  const toggle=el(d,'span','admin-account-toggle','View details');
  summary.append(identity,toggle);item.append(summary);
  const details=el(d,'div','admin-account-details');
  const fields=el(d,'dl','admin-account-fields');
  for(const [label,value] of [['Email address',account.email],['Access roles',roleLabel(account.roles)],['Email verification',account.verified?'Verified':'Not verified'],['Account status',account.active?'Active':'Removal in progress'],['Stories owned',String(account.stories)],['Joined',account.created_at?date(account.created_at):'Not available']]){const field=el(d,'div','');field.append(el(d,'dt','',label),el(d,'dd','',value));fields.append(field);}
  details.append(fields);
  if(account.active&&account.verified){const actions=el(d,'div','admin-actions');for(const [role,label] of [['member','contributor'],['admin','admin']]){const enabled=!account.roles.includes(role);actions.append(button(`${enabled?'Grant':'Remove'} ${label} access`,async()=>confirmRole(account,role,enabled,details),!enabled));}details.append(actions);}
  else details.append(el(d,'p','admin-muted','Access changes are available for verified, active accounts.'));
  item.append(details);
  item.addEventListener('toggle',()=>{toggle.textContent=item.open?'Hide details':'View details';});
  list.append(item);
 }
 if(!page.accounts.length)list.append(el(d,'p','admin-empty','No accounts match these filters. Try another name, email or role.'));
 content.append(list);
 const pagination=el(d,'nav','admin-pagination');pagination.setAttribute('aria-label','Account pages');
 if(offset>0)pagination.append(button('Previous',()=>accounts(Math.max(0,offset-25))));
 pagination.append(el(d,'span','admin-muted',`Page ${Math.floor(offset/25)+1} of ${Math.max(1,Math.ceil(page.total/25))}`));
 if(offset+page.accounts.length<page.total)pagination.append(button('Next',()=>accounts(offset+25)));
 content.append(pagination);
 }
 function confirmRole(account,role,enabled,result){content.querySelector('[data-role-confirm]')?.remove();const form=el(d,'form','account-form admin-confirm');form.dataset.roleConfirm='';form.innerHTML=`<h3 data-confirm-title></h3><p data-confirm-detail></p><div class="account-field"><label for="confirm-account-email">Type the account email to confirm</label><input id="confirm-account-email" type="email" autocomplete="off" required></div><div class="account-field"><label for="role-reason">Reason</label><textarea id="role-reason" required maxlength="2000" rows="3"></textarea></div><label class="account-check"><input type="checkbox" required><span>I have checked the account and intended access change.</span></label><div class="admin-actions"><button class="account-submit" type="submit">Confirm access change</button><button class="account-secondary" type="button" data-role-cancel>Cancel</button></div>`;
 form.querySelector('[data-confirm-title]').textContent=`${enabled?'Grant':'Remove'} ${role==='admin'?'administrator':'contributor'} access`;
 form.querySelector('[data-confirm-detail]').textContent=role==='admin'?'This affects admin tools only. Contributor access stays as it is. At least one active administrator must remain.':'This affects story contribution only. Admin access stays as it is. Removing contributor access hides their public profile and returns published stories to private drafts. Ownership and content downloads are kept. Restoring access does not republish stories.';
 if(!enabled)form.querySelector('[type=submit]').classList.add('admin-destructive','admin-destructive--primary');
 form.querySelector('[data-role-cancel]').addEventListener('click',()=>form.remove());form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;run(async()=>{await service.setRole(account.id,role,enabled,form.querySelector('input[type=email]').value,form.querySelector('textarea').value);form.remove();say('Access updated. The account list now shows the current roles.');try{await summary();await accounts(accountOffset);}catch{onAccessLost();}});});result.append(form);form.querySelector('input').focus();}
 async function moderation(offset=storyOffset,filter){storyOffset=offset;const state=filter??root.querySelector('[data-story-filter]')?.value??'published';const rows=await service.stories(state,offset);if(disposed)return;heading('Story moderation','Review stories and unpublish when necessary. The author’s words stay theirs.');const label=el(d,'label','','Story status');label.htmlFor='story-filter';const select=el(d,'select','');select.id='story-filter';select.dataset.storyFilter='';for(const value of ['published','draft','archived','submitted','rejected']){const option=el(d,'option','',({submitted:'Legacy submitted',rejected:'Legacy rejected'})[value]??value[0].toUpperCase()+value.slice(1));option.value=value;select.append(option);}select.value=state;select.addEventListener('change',()=>run(()=>moderation(0,select.value)));content.append(label,select);const list=el(d,'div','admin-list');for(const row of rows){const item=el(d,'article','admin-row');item.append(el(d,'h3','',row.title),el(d,'p','admin-muted',`By ${row.author_name} · ${row.status} · Updated ${date(row.updated_at)}`),el(d,'p','',row.summary),button('Review story',async()=>reviewStory(row,item)));list.append(item);}if(!rows.length)list.append(el(d,'p','admin-empty','No stories with this status.'));content.append(list);pager(offset,rows,next=>moderation(next,state));}
 async function reviewStory(row,item){item.querySelector('[data-story-review]')?.remove();const story=await service.story(row.id);if(disposed)return;const review=el(d,'section','admin-confirm');review.dataset.storyReview='';review.append(el(d,'h3','','Story text'),el(d,'div','admin-story-text',story.body));if(story.status!=='archived'){const form=el(d,'form','account-form');form.innerHTML=`<div class="account-field"><label>Reason for unpublishing<textarea required maxlength="2000" rows="3"></textarea></label></div><label class="account-check"><input type="checkbox" required><span>I understand this hides the story and locks it against author republication.</span></label><button class="account-submit admin-destructive admin-destructive--primary">Unpublish for moderation</button>`;form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;run(async()=>{await service.archive(story.id,form.querySelector('textarea').value);await moderation();await summary();say('Story unpublished. The reason is recorded in the activity log.');});});review.append(form);}else {const form=el(d,'form','account-form');form.innerHTML=`<p>Restoring returns the story to a private draft. The contributor decides when to publish it again.</p><div class="account-field"><label>Type the story reference<input required autocomplete="off" data-restore-reference></label></div><div class="account-field"><label>Reason for restoring<textarea required maxlength="2000" rows="3"></textarea></label></div><button class="account-secondary">Restore to author’s drafts</button>`;const reference=el(d,'p','admin-muted','Story reference: '+story.slug);form.prepend(reference);form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;run(async()=>{await service.restore(story.id,form.querySelector('input').value,form.querySelector('textarea').value);await moderation();await summary();say('Story returned to the author’s private drafts. It is not published.');});});review.append(form);}review.append(button('Close review',async()=>review.remove()));item.append(review);}
 async function activity(offset=activityOffset){activityOffset=offset;const rows=await service.activity(offset);if(disposed)return;heading('Admin activity','A record of invitation, access and moderation actions. This log cannot be edited from the site.');const list=el(d,'div','admin-list');for(const row of rows){const item=el(d,'article','admin-row');item.append(el(d,'h3','',({role_changed:'Account access changed',invite_created:'Invitation created',invite_accepted:'Invitation accepted',invite_revoked:'Invitation revoked',story_archived:'Story unpublished',story_restored:'Story restored to draft',image_approved:'Story image approved',contributor_content_hidden:'Contributor stories made private'})[row.action]??'Admin action'),el(d,'p','admin-muted',`${row.actor_name??'Former account'} · ${date(row.created_at)}`),el(d,'p','',row.reason));if(row.details?.before&&row.details?.after)item.append(el(d,'p','admin-muted',`${roleLabel(row.details.before)} → ${roleLabel(row.details.after)}`));list.append(item);}if(!rows.length)list.append(el(d,'p','admin-empty','No admin activity yet.'));content.append(list);pager(offset,rows,activity);}
 async function warnings(){const rows=await service.warningRequests();if(disposed)return;heading('Content warning requests','Approve a shared warning for the dropdown, or decline with an explanation. Requests are reviewed in batches of 50; refresh to load the next batch.');for(const row of rows){const card=el(d,'article','admin-row'),form=el(d,'form','account-form'),label=el(d,'label','','Decision note'),note=el(d,'textarea','');note.id='warning-note-'+row.id;note.required=true;note.maxLength=500;label.htmlFor=note.id;card.append(el(d,'h3','',row.label),el(d,'p','',row.reason));form.append(label,note);for(const approve of [true,false])form.append(button(approve?'Approve warning':'Decline request',async()=>{if(!form.reportValidity())return;await service.reviewWarning(row.id,approve,note.value);await warnings();say('Request reviewed. The decision is recorded.');}));form.addEventListener('submit',e=>e.preventDefault());card.append(form);content.append(card);}if(!rows.length)content.append(el(d,'p','admin-empty','No pending requests.'));content.append(button('Refresh requests',warnings));}
 const sections={invitations,accounts,moderation,activity,warnings};root.querySelectorAll('[data-tab]').forEach(tab=>tab.addEventListener('click',()=>run(async()=>{++generation;say('');root.querySelectorAll('[data-tab]').forEach(b=>b.removeAttribute('aria-current'));tab.setAttribute('aria-current','page');await sections[tab.dataset.tab]();})));
 void run(async()=>{await summary();await invitations(0);});return()=>{disposed=true;++generation;root.replaceChildren();};
}
