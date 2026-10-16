import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let keys;
try {keys=JSON.parse(execFileSync(process.platform==='win32'?'cmd.exe':'npx',process.platform==='win32'
  ? ['/d','/s','/c','npx.cmd --yes --offline supabase@2.120.0 projects api-keys --project-ref oqmmvjjycpyxvxipcyli -o json']
  : ['--yes','--offline','supabase@2.120.0','projects','api-keys','--project-ref','oqmmvjjycpyxvxipcyli','-o','json'],
  {cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],windowsHide:true}));}
catch {throw new Error('Private CLI access to FAS DEV is required.');}
const env={...process.env,FAS_TEST_CONFIRM:'fas-community-dev:oqmmvjjycpyxvxipcyli',FAS_TEST_ANON_KEY:keys.find(x=>x.name==='anon')?.api_key,FAS_TEST_SERVICE_KEY:keys.find(x=>x.name==='service_role')?.api_key};
keys=null;
if(!env.FAS_TEST_ANON_KEY || !env.FAS_TEST_SERVICE_KEY)throw new Error('Expected DEV process-only test credentials.');
try {
  for(const [file,args] of [['test-fas-accounts-dev.mjs',[]],['test-fas-security-api.mjs',['--hosted-dev']],['test-fas-admin-api.mjs',[]]]) {
    const child=spawnSync(process.execPath,['scripts/'+file,...args],{cwd:root,env,stdio:'inherit',windowsHide:true});
    if(child.status!==0){process.exitCode=1;break;}
  }
} finally {delete env.FAS_TEST_ANON_KEY;delete env.FAS_TEST_SERVICE_KEY;}
