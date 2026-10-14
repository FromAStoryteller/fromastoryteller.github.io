import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordChecks } from '../account/password-policy.mjs';
test('verified hosted policy accepts minimum length and rejects each missing category', () => {
  const valid = passwordChecks('SampleOnly9!', 'SampleOnly9!');
  assert.ok(Object.values(valid).every(Boolean));
  for (const [password,missing] of [['Abcdefgh1!','length'],['ABCDEFGHIJ1!','lowercase'],['abcdefghij1!','uppercase'],['Abcdefghijk!','number'],['Abcdefghijk1','symbol']]) {
    assert.equal(passwordChecks(password)[missing],false,missing);
  }
});
test('space and emoji do not substitute for a required Supabase symbol', () => {
  assert.equal(passwordChecks('Abcdefghijk1 ').symbol,false);
  assert.equal(passwordChecks('Abcdefghijk1🙂').symbol,false);
  for (const symbol of ['!','\\','"',"'",'`','~','/','[',']']) assert.equal(passwordChecks('Abcdefghijk1'+symbol).symbol,true);
});
test('confirmation must be nonempty and exactly equal without trimming', () => {
  assert.equal(passwordChecks('','').match,false);
  assert.equal(passwordChecks('ExampleOnly9!','ExampleOnly9! ').match,false);
  assert.equal(passwordChecks('ExampleOnly9!','exampleOnly9!').match,false);
});
test('minimum-length measurement matches Supabase UTF-8 byte counting', () => {
  assert.equal(passwordChecks('Aa1!éééé').length,true);
  assert.equal(passwordChecks('Aa1!ééé').length,false);
});
