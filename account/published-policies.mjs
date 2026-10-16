export function validPolicyRequirement(value) {
  if (!value || value.status !== 'published' || value.minimum_age !== 16 || !Number.isFinite(Date.parse(value.published_at))) return false;
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value.release_id ?? '')) return false;
  for (const kind of ['terms','privacy']) {
    if (typeof value[kind+'_version'] !== 'string' || !value[kind+'_version'].trim() ||
      !/^[a-f0-9]{64}$/.test(value[kind+'_sha256'] ?? '') ||
      !new RegExp('^/account/policy-history/[a-z0-9-]+/'+kind+'/$').test(value[kind+'_path'] ?? '')) return false;
  }
  return true;
}
export function publishedPolicyDeclaration(requirement, {ageConfirmed,termsAgreed,privacyNoticeSeen}) {
  if (!validPolicyRequirement(requirement) || ageConfirmed !== true || termsAgreed !== true || privacyNoticeSeen !== true) return null;
  return {mode:'published_terms_agreement',release_id:requirement.release_id,
    terms_version:requirement.terms_version,privacy_version:requirement.privacy_version,
    terms_sha256:requirement.terms_sha256,privacy_sha256:requirement.privacy_sha256,
    age_16_or_over:true,terms_agreed:true,privacy_notice_seen:true};
}
export async function currentPolicyRequirement(client) {
  const result=await client.rpc('fas_current_policy_requirement');
  if (result.error || (result.data !== null && !validPolicyRequirement(result.data))) throw new Error('The current account policies are unavailable. Please try again later.');
  return result.data;
}
export async function acceptCurrentPolicies(client,requirement,confirmations) {
  if (!publishedPolicyDeclaration(requirement,confirmations)) throw new Error('Confirm your age, agree to the Terms and acknowledge the Privacy notice.');
  const renewed=await client.auth.refreshSession();
  const verified=await client.auth.getUser();
  if (renewed.error || !renewed.data?.session || verified.error || !verified.data?.user?.email_confirmed_at) throw new Error('Sign in again to review account terms.');
  const result=await client.rpc('fas_accept_current_policies',{target_release:requirement.release_id,terms_agreed:true,privacy_notice_seen:true,age_16_or_over:true});
  if (result.error || !Array.isArray(result.data) || !result.data.some(item=>item.release_id===requirement.release_id)) throw new Error('We couldn’t record your agreement. Reload to review the current policies before trying again.');
  return result.data;
}
