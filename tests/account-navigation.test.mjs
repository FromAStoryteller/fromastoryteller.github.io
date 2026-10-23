import test from 'node:test';
import assert from 'node:assert/strict';
import { accountNavigation } from '../systems/community/account-navigation.mjs';

const document = { createElement(tag) { return {
  tag, ownerDocument:document, children: [], attributes: {}, classList:{add(){}},
  getAttribute(key){return this.attributes[key]??null;},
  setAttribute(key,value) { this.attributes[key]=value; },
  append(...nodes) { this.children.push(...nodes); },
  replaceChildren(...nodes) { this.children=nodes; },
  addEventListener(event,handler) { this[event]=handler; },
}; } };

test('account navigation keeps destinations consistent and signs out only the current session',async()=>{
  let scope;
  const nav=accountNavigation(document,{current:'settings',publicId:'81000000-0000-0000-0000-000000000001',auth:{signOut:async options=>{scope=options.scope;return {error:null};}}});
  const list=nav.children[1].children[1];
  assert.deepEqual(list.children.map(n=>n.textContent),['Edit my profile','View public profile','Storyteller Studio','Saved for later','Favourites','Following','Your history','Account settings','Sign out']);
  assert.equal(list.children.find(n=>n.textContent==='Account settings').attributes['aria-current'],'page');
  await nav.children[1].children[1].children.at(-1).click();
  assert.equal(scope,'local');
  assert.deepEqual(nav.children.map(n=>n.textContent),["You're signed out.",'Sign in']);
});

test('failed sign out retains retry and never falsely reports a signed-out state',async()=>{
  const nav=accountNavigation(document,{auth:{signOut:async()=>({error:new Error('offline')})}});
  const button=nav.children[1].children[1].children.at(-1);
  await button.click();
  assert.equal(button.disabled,false);
  assert.equal(button.textContent,'Could not sign out. Try again');
  assert.equal(nav.children.some(n=>n.textContent==="You're signed out."),false);
});

test('Studio can prevent sign-out while a save is pending or unsaved words need review',async()=>{
  let calls=0;const nav=accountNavigation(document,{beforeSignOut:()=>false,auth:{signOut:async()=>{calls++;return {};}}});
  await nav.children[1].children[1].children.at(-1).click();assert.equal(calls,0);assert.equal(nav.children[1].children[1].children.at(-1).textContent,'Sign out');
});
