import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
const fixture=`
const user={id:'b1000000-0000-0000-0000-000000000001',email:'viewer@example.invalid',email_confirmed_at:new Date().toISOString(),is_anonymous:false};
const session=()=>sessionStorage.getItem('fixture-auth')?{user,access_token:'fictional'}:null;
const auth={
 getSession:async()=>({data:{session:session()},error:null}),
 refreshSession:async()=>({data:{session:session()},error:null}),
 getUser:async()=>({data:{user:session()?user:null},error:null}),
 signInWithPassword:async()=>{sessionStorage.setItem('fixture-auth','1');return {data:{session:session(),user},error:null};},
 signOut:async()=>{sessionStorage.removeItem('fixture-auth');return{error:null};},
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
};
const client={auth,rpc:async(name,args)=>{
 if(name!=='accept_invite'||!session()||args.invite_token!=='a'.repeat(72)||sessionStorage.getItem('fixture-accepted'))return{error:{message:'Invite unavailable'}};
 sessionStorage.setItem('fixture-accepted','1');sessionStorage.setItem('fixture-roles','member');return {data:null,error:null};
}};
export async function loadLocalAuthClient(){return {client,hadSession:!!session(),mode:'development',storage:{persistent:true,remembered:false,requestedRemember:false,key:'fixture-auth',clear(){sessionStorage.removeItem('fixture-auth');}}};}
`;
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.route('**/account/local-auth-client.mjs',r=>r.fulfill({contentType:'application/javascript',body:fixture}));
  await page.goto('http://127.0.0.1:55410/account/invitation/#invite='+'a'.repeat(72));
  await page.getByRole('link',{name:'Sign in',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>location.hash),'');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-auth')),null);
  await page.getByRole('link',{name:'Sign in',exact:true}).click();
  await page.locator('[data-sign-in-form] input[type=email]').fill('viewer@example.invalid');
  await page.locator('#account-password').fill('FictionalPassword9!');
  await page.locator('[data-sign-in-form] button[type=submit]').click();
  await page.waitForURL('**/account/invitation/');
  const accept=page.getByRole('button',{name:'Accept contributor invitation',exact:true});
  await accept.waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-accepted')),null,'sign-in must not auto-accept');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-roles')),null,'viewer starts without contributor or admin roles');
  await accept.click();
  await page.getByRole('heading',{name:'Invitation accepted',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-roles')),'member');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fas-pending-contributor-invitation')),null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto('http://127.0.0.1:55410/account/sign-in/');
  await page.getByRole('heading',{name:'Your account',exact:true}).waitFor();
  assert.match(page.url(),/account\/sign-in\/$/,'cleared invitation must not redirect ordinary account access');
  console.log('PASS '+width+'px: signed-out invitation -> actual sign-in controller -> automatic fixed-path resume -> explicit acceptance -> pending credential cleared; no prior contributor/admin role');
  await context.close();
  const admin=await browser.newPage({viewport:{width,height:900}});
  await admin.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await admin.goto('http://127.0.0.1:55410/tests/admin-preview/');
  const stat=admin.locator('[data-overview] .admin-stat').filter({hasText:'Open invitations'});
  await stat.locator('strong').filter({hasText:'1'}).waitFor();
  await admin.evaluate(()=>window.__adminEmailPreview.acceptFirst());
  await admin.getByRole('button',{name:'Refresh delivery status',exact:true}).click();
  await stat.locator('strong').filter({hasText:'0'}).waitFor();
  await admin.locator('.admin-row').filter({hasText:'writer@example.invalid'}).getByText(/^Accepted · Expires/).waitFor();
  console.log('PASS '+width+'px: refreshing invitation status updates accepted row and open-invitation count together');
  await admin.close();
 }
}finally{await browser.close();}
