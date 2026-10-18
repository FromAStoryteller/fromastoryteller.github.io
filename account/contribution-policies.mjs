import {currentPolicyRequirement} from './published-policies.mjs';
// Only the server chooses the active release. No agreement is inferred from a role.
export async function contributionPolicyState(client) {
 const requirement=await currentPolicyRequirement(client);
 if(!requirement)return {requirement:null,accepted:true};
 const result=await client.rpc('fas_my_policy_agreements');
 if(result.error||!Array.isArray(result.data))throw new Error('Your policy agreement could not be checked. Reload to try again.');
 return {requirement,accepted:result.data.some(record=>record.release_id===requirement.release_id)};
}
