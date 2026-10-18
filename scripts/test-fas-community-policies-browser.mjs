// Isolated browser contract. All identities and agreement calls are synthetic.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
const release='community-policies-2026-10-18-v1';
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(({release})=>{
   const policy={release_id:release,status:'published',published_at:'2026-10-18T00:00:00Z',minimum_age:16,terms_version:release,privacy_version:release,terms_sha256:'a'.repeat(64),privacy_sha256:'b'.repeat(64),terms_path:'/account/policy-history/'+release+'/terms/',privacy_path:'/account/policy-history/'+release+'/privacy/'};
   window.policyFixture={accepted:sessionStorage.getItem('fixture-policy-accepted')==='yes',inviteCalls:0};
   window.fixtureAccount={user:{id:'a1000000-0000-0000-0000-000000000001',email:'fixture@example.invalid'},profile:{public_id:'a2000000-0000-0000-0000-000000000001',display_name:'Fixture Writer'},state:'active',contributor:true,admin:false};
   window.fixtureClient={auth:{refreshSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{...window.fixtureAccount.user,email_confirmed_at:'2026-10-18'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},
    rpc:async(name,args)=>{
     if(name==='fas_current_policy_requirement')return {data:policy};
     if(name==='fas_my_policy_agreements')return {data:window.policyFixture.accepted?[{release_id:release,terms_version:release,privacy_version:release,recorded_at:'2026-10-18'}]:[]};
     if(name==='fas_accept_current_policies'){if(args.target_release!==release||!args.terms_agreed||!args.privacy_notice_seen||!args.age_16_or_over)throw Error('Invalid fixture confirmation');window.policyFixture.accepted=true;sessionStorage.setItem('fixture-policy-accepted','yes');return {data:[{release_id:release,terms_version:release,privacy_version:release,recorded_at:'2026-10-18'}]};}
     if(name==='accept_invite'){window.policyFixture.inviteCalls++;return {data:null};}
     throw Error('Unexpected RPC '+name);
    }};
  },{release});
  await context.route('**/account/local-auth-client.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export async function loadLocalAuthClient(){return {client:window.fixtureClient,hadSession:true,mode:"dev",storage:{clear(){}}};}'}));
  await context.route('**/account/session-controller.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export async function restoreSession(){return {state:"signed-in",email:"fixture@example.invalid"};} export function takeRestoredIdentity(){return null;}'}));
  await context.route('**/account/session-events.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export function watchSessionEnd(){return ()=>{};}'}));
  await context.route('**/account/settings-controller.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export async function loadProfileAccount(){return window.fixtureAccount;}'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:55410/account/studio/');
  await page.getByRole('heading',{name:'Review the updated contributor terms'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Review and agree',exact:true}).getAttribute('href'),'/account/agreements/');
  await page.goto('http://127.0.0.1:55410/account/invitation/#invite='+'a'.repeat(72));
  await page.getByRole('link',{name:'Review and agree',exact:true}).waitFor();
  assert.equal(await page.locator('[data-invitation-root] button[type=submit]').count(),0);
  assert.equal(await page.evaluate(()=>location.hash),'');
  await page.getByRole('link',{name:'Review and agree',exact:true}).click();
  await page.locator('[data-agreement-form]:not([hidden])').waitFor();
  assert.equal(await page.locator('[data-age]').isChecked(),false);
  assert.equal(await page.locator('[data-terms]').isChecked(),false);
  assert.equal(await page.locator('[data-privacy]').isChecked(),false);
  for(const selector of ['[data-age]','[data-terms]','[data-privacy]'])await page.locator(selector).check();
  await page.getByRole('button',{name:'Agree to these Terms',exact:true}).click();
  await page.getByRole('link',{name:'Continue to your invitation',exact:true}).waitFor();
  await page.getByRole('link',{name:'Continue to your invitation',exact:true}).click();
  await page.getByRole('button',{name:'Accept contributor invitation',exact:true}).click();
  await page.getByRole('heading',{name:'Invitation accepted',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.policyFixture.inviteCalls),1);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fas-pending-contributor-invitation')),null);
  for(const path of ['/terms/','/privacy/','/terms/contributors/']){
   await page.goto('http://127.0.0.1:55410'+path);
   assert.equal(await page.locator('h1').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' overflow');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS community policy onboarding and public pages at '+width+'px');
  await context.close();
 }
}finally{await browser.close();}
