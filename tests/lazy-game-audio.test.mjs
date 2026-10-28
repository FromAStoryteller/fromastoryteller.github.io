import test from 'node:test';import assert from 'node:assert/strict';
import {AudioManager} from '../systems/games/audio.js';
test('game sounds download on first play, reuse the decode, and cancel delayed playback when stopped',async()=>{
 let downloads=0,plays=0,loaded;globalThis.loadSound=(_url,ready)=>{downloads++;loaded=ready;return{isLoaded:()=>true,setVolume(){},play(){plays++},stop(){}};};
 const sounds=AudioManager.loadSounds({hit:'/sound.mp3'});assert.equal(downloads,0);AudioManager.play(sounds.hit);assert.equal(downloads,1);AudioManager.stopAll();loaded();await new Promise(r=>setImmediate(r));assert.equal(plays,0);AudioManager.play(sounds.hit);assert.equal(plays,1);assert.equal(downloads,1);delete globalThis.loadSound;
});
