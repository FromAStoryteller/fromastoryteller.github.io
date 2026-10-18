// Freeze a new release without changing an earlier snapshot or contacting a service.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {policyTransitionPlan} from './fas-policy-release-plan.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const registry=JSON.parse(readFileSync(root+'account/policy-versions.json','utf8'));
const version=registry.communityUpdateVersion,entry=registry.versions[version];
if(version!=='community-policies-2026-10-18-v1'||entry.status!=='publication-candidate')throw Error('Expected the new community release candidate');
for(const kind of ['terms','privacy']){
 const content=readFileSync(root+kind+'/index.html','utf8').replace(/\r\n/g,'\n');
 const dir='account/policy-history/'+version+'/'+kind;
 if(existsSync(root+dir+'/index.html'))throw Error('Snapshot already exists; do not overwrite history');
 mkdirSync(root+dir,{recursive:true});writeFileSync(root+dir+'/index.html',content);
 entry.documents[kind]={path:'/'+dir+'/index.html',sha256:createHash('sha256').update(content).digest('hex')};
}
writeFileSync(root+'account/policy-versions.json',JSON.stringify(registry,null,2)+'\n');
writeFileSync(root+'supabase/ops/'+version+'.sql',policyTransitionPlan(root,registry,version,entry.previousVersion));
console.log('Frozen new policy snapshots and prepared transition SQL; no publication or agreement performed.');
