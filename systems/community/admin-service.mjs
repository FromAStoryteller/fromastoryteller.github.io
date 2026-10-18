const knownErrors=new Set(['Administrator access required','Verified active account required','Active account session required','Keep at least one active administrator','Confirm the target account email','Verified active target account required','Reason required','An active invitation already exists for this email','Invitation limit reached; try again later','Invitation is unavailable or already accepted','Invite unavailable','Enter a valid invitation email','Expiry must be 1-30 days']);
export function createAdminService(client,{ownerId}={}){
 async function call(name,args={},write=false){
  if(write){const refreshed=await client.auth.refreshSession();if(refreshed.error||!refreshed.data?.session)throw new Error('Sign in again to continue.');}
  const verified=await client.auth.getUser();if(verified.error||!verified.data?.user||verified.data.user.is_anonymous)throw new Error('Sign in again to continue.');
  if(ownerId&&ownerId!==verified.data.user.id)throw new Error('Your account changed. Reopen this page.');ownerId=verified.data.user.id;
  const result=await client.rpc(name,args);if(result.error)throw new Error(knownErrors.has(result.error.message)?result.error.message:'This request could not be completed. Refresh and try again.');return result.data;
 }
 const requests=new Map();
 async function emailCall(body){
  if(body.action!=='status'){const refreshed=await client.auth.refreshSession();if(refreshed.error||!refreshed.data?.session)throw new Error('Sign in again to continue.');}
  const verified=await client.auth.getUser();if(verified.error||!verified.data?.user||verified.data.user.is_anonymous)throw new Error('Sign in again to continue.');
  if(ownerId&&ownerId!==verified.data.user.id)throw new Error('Your account changed. Reopen this page.');ownerId=verified.data.user.id;
  const r=await client.functions.invoke('fas-contributor-email',{body});if(r.error)throw new Error('Email delivery was not confirmed. Refresh delivery status before retrying. Private invitation links remain available.');return r.data;
 }
 return {emailStatus:()=>emailCall({action:'status'}),emailJobs:offset=>call('fas_admin_email_jobs',{page_offset:offset??0}),
  async sendInvitation(email,days,inviteId=null){
   const key=JSON.stringify([email,days,inviteId]);if(!requests.has(key))requests.set(key,crypto.randomUUID());
   const result=await emailCall({action:inviteId?'resend':'create',email,days,invite_id:inviteId,request_id:requests.get(key)});
   if(!result?.job?.id)throw new Error('The invitation email was not confirmed. Refresh delivery status and retry.');
   requests.delete(key);return result.job;
  },
  warningRequests:()=>call('fas_admin_warning_requests'),reviewWarning:(id,approve,note)=>call('fas_admin_review_warning',{request_id:id,approve,note},true),overview:()=>call('fas_admin_overview'),invites:offset=>call('fas_admin_invites',{page_offset:offset}),activity:offset=>call('fas_admin_activity',{page_offset:offset}),
  accounts:(search='',role='all',offset=0,sort='name')=>call('fas_admin_accounts',{search_text:search,role_filter:role,page_offset:offset,sort_order:sort}),
  findAccount:email=>call('fas_admin_find_account',{account_email:email}),
  setRole:(id,role,enabled,email,note)=>call('fas_admin_set_role',{target_user:id,target_role:role,enabled,confirmation_email:email,note},true),
  issueInvite:(email,days)=>call('create_invite',{invitee_email:email,valid_days:days},true),revokeInvite:id=>call('revoke_invite',{invite_id:id},true),
  stories:(state,offset)=>call('fas_admin_stories',{state_filter:state,page_offset:offset}),
  async story(id){const verified=await client.auth.getUser();if(verified.error||verified.data?.user?.id!==ownerId)throw new Error('Sign in again to continue.');const result=await client.from('stories').select('id,slug,title,body,summary,status').eq('id',id).single();if(result.error||!result.data)throw new Error('This story is unavailable.');return result.data;},
  archive:(id,note)=>call('moderate_story',{target_story:id,decision:'archived',note},true),
  restore:(id,slug,note)=>call('fas_admin_restore_story',{target_story:id,confirmation_slug:slug,note},true),
  acceptInvite:token=>call('accept_invite',{invite_token:token},true)};
}
