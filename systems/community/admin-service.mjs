const knownErrors=new Set(['Administrator access required','Verified active account required','Active account session required','Keep at least one active administrator','Confirm the target account email','Verified active target account required','Reason required','An active invitation already exists for this email','Invitation limit reached; try again later','Invitation is unavailable or already accepted','Invite unavailable','Enter a valid invitation email','Expiry must be 1-30 days']);
export function createAdminService(client,{ownerId}={}){
 async function call(name,args={},write=false){
  if(write){const refreshed=await client.auth.refreshSession();if(refreshed.error||!refreshed.data?.session)throw new Error('Sign in again to continue.');}
  const verified=await client.auth.getUser();if(verified.error||!verified.data?.user||verified.data.user.is_anonymous)throw new Error('Sign in again to continue.');
  if(ownerId&&ownerId!==verified.data.user.id)throw new Error('Your account changed. Reopen this page.');ownerId=verified.data.user.id;
  const result=await client.rpc(name,args);if(result.error)throw new Error(knownErrors.has(result.error.message)?result.error.message:'This request could not be completed. Refresh and try again.');return result.data;
 }
 return {overview:()=>call('fas_admin_overview'),invites:offset=>call('fas_admin_invites',{page_offset:offset}),activity:offset=>call('fas_admin_activity',{page_offset:offset}),
  findAccount:email=>call('fas_admin_find_account',{account_email:email}),
  setRole:(id,role,enabled,email,note)=>call('fas_admin_set_role',{target_user:id,target_role:role,enabled,confirmation_email:email,note},true),
  issueInvite:(email,days)=>call('create_invite',{invitee_email:email,valid_days:days},true),revokeInvite:id=>call('revoke_invite',{invite_id:id},true),
  stories:(state,offset)=>call('fas_admin_stories',{state_filter:state,page_offset:offset}),
  async story(id){const verified=await client.auth.getUser();if(verified.error||verified.data?.user?.id!==ownerId)throw new Error('Sign in again to continue.');const result=await client.from('stories').select('id,title,body,summary,status').eq('id',id).single();if(result.error||!result.data)throw new Error('This story is unavailable.');return result.data;},
  archive:(id,note)=>call('moderate_story',{target_story:id,decision:'archived',note},true),
  acceptInvite:token=>call('accept_invite',{invite_token:token},true)};
}
