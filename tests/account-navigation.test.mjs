import test from 'node:test';
import assert from 'node:assert/strict';
import { accountNavigation } from '../systems/community/account-navigation.mjs';

const document = { createElement(tag) { return {
  tag, children: [], attributes: {},
  setAttribute(key,value) { this.attributes[key]=value; },
  append(...nodes) { this.children.push(...nodes); },
  replaceChildren(...nodes) { this.children=nodes; },
  addEventListener(event,handler) { this[event]=handler; },
}; } };

test('account navigation keeps destinations consistent and signs out only the current session',async()=>{
  let scope;
  const nav=accountNavigation(document,{current:'settings',publicId:'81000000-0000-0000-0000-000000000001',auth:{signOut:async options=>{scope=options.scope;return {error:null};}}});
  assert.deepEqual(nav.children.map(n=>n.textContent),['Edit my profile','View public profile','Storyteller Studio','Account settings','Sign out']);
  assert.equal(nav.children[3].attributes['aria-current'],'page');
  await nav.children[4].click();
  assert.equal(scope,'local');
  assert.deepEqual(nav.children.map(n=>n.textContent),["You're signed out.",'Sign in']);
});

test('failed sign out retains retry and never falsely reports a signed-out state',async()=>{
  const nav=accountNavigation(document,{auth:{signOut:async()=>({error:new Error('offline')})}});
  const button=nav.children.at(-1);
  await button.click();
  assert.equal(button.disabled,false);
  assert.equal(button.textContent,'Could not sign out. Try again');
  assert.equal(nav.children.some(n=>n.textContent==="You're signed out."),false);
});

test('Studio can prevent sign-out while a save is pending or unsaved words need review',async()=>{
  let calls=0;const nav=accountNavigation(document,{beforeSignOut:()=>false,auth:{signOut:async()=>{calls++;return {};}}});
  await nav.children.at(-1).click();assert.equal(calls,0);assert.equal(nav.children.at(-1).textContent,'Sign out');
});
