import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
if(args.length && (args.length!==1||!['--studio-only','--community-only'].includes(args[0])))throw new Error('Only --studio-only or --community-only is supported. The target is always FAS DEV.');
const checks=args[0]==='--studio-only'?[['test-fas-studio-api.mjs',[]]]:args[0]==='--community-only'?[['test-fas-community-api.mjs',[]]]:[['test-fas-accounts-dev.mjs',[]],['test-fas-studio-api.mjs',[]],['test-fas-community-api.mjs',[]]];
let keys;
try {keys=JSON.parse(execFileSync(process.platform==='win32'?'cmd.exe':'npx',process.platform==='win32'
  ? ['/d','/s','/c','npx.cmd --yes --offline supabase@2.120.0 projects api-keys --project-ref oqmmvjjycpyxvxipcyli -o json']
  : ['--yes','--offline','supabase@2.120.0','projects','api-keys','--project-ref','oqmmvjjycpyxvxipcyli','-o','json'],
  {cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],windowsHide:true,timeout:15000,env:{...process.env,DO_NOT_TRACK:'1'}}));}
catch {throw new Error('Private CLI access to FAS DEV is required.');}
const env={...process.env,FAS_TEST_CONFIRM:'fas-community-dev:oqmmvjjycpyxvxipcyli',FAS_TEST_ANON_KEY:keys.find(x=>x.name==='anon')?.api_key,FAS_TEST_SERVICE_KEY:keys.find(x=>x.name==='service_role')?.api_key};
keys=null;
if(!env.FAS_TEST_ANON_KEY || !env.FAS_TEST_SERVICE_KEY)throw new Error('Expected DEV process-only test credentials.');
try {
  for(const [file,args] of checks) {
    const child=spawnSync(process.execPath,['scripts/'+file,...args],{cwd:root,env,stdio:'inherit',windowsHide:true});
    if(child.status!==0){process.exitCode=1;break;}
  }
} finally {delete env.FAS_TEST_ANON_KEY;delete env.FAS_TEST_SERVICE_KEY;}
