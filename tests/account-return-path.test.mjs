import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnPath,returnPathFromSearch,signInHref} from '../account/return-path.mjs';
test('sign-in returns only to known local pages and never forwards secrets or auth loops',()=>{
 const profile='/storytellers/?author=a6400000-0000-4000-8000-000000000001';
 for(const path of ['/account/following/','/storytellers/',profile])assert.equal(returnPathFromSearch(new URL('https://fromastoryteller.com'+signInHref(path)).search),path);
 for(const path of [profile+'&token=secret',profile+'&author=another','/storytellers/?author=bad','/storytellers/?next=https://evil.invalid/'])assert.equal(safeReturnPath(path),null);
 for(const path of ['/account/games/','/account/studio/','/account/settings/','/account/profile/','/account/agreements/','/games/brick-blitz/','/tools/countdown/','/games/','/']){assert.equal(safeReturnPath(path),path);assert.equal(returnPathFromSearch(new URL('https://fromastoryteller.com'+signInHref(path)).search),path);}
 for(const path of ['https://evil.invalid/','//evil.invalid/','/\\evil.invalid/','/account/sign-in/','/account/sign-up/','/account/reset-password/','/account/verify-email/','/games/../account/sign-in/','/games/game/?token=secret','/games/game/#credential','/%2f%2fevil.invalid/','/games/<script>/','javascript:alert(1)',null]){assert.equal(safeReturnPath(path),null);assert.equal(signInHref(path),'/account/sign-in/');}
 assert.equal(returnPathFromSearch('?next=%252F%252Fevil.invalid'),null);assert.equal(returnPathFromSearch('?next=%2Faccount%2Fgames%2F&next=%2Faccount%2Fsettings%2F'),null);
});
