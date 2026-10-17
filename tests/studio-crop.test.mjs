import test from 'node:test';
import assert from 'node:assert/strict';
import {coverCrop,moveCoverCrop} from '../systems/community/studio-crop.mjs';
test('portrait and wide sources select edge-to-edge 16:9 crops without stretching or blank pixels',()=>{
 for(const [width,height] of [[600,1000],[2000,600],[1600,900],[1,100],[100,1]])for(const focus of [0,50,100]){
  const crop=coverCrop(width,height,focus,focus);assert.ok(Math.abs(crop.width/crop.height-16/9)<1e-10);assert.ok(crop.x>=0&&crop.y>=0);assert.ok(crop.x+crop.width<=width+1e-9);assert.ok(crop.y+crop.height<=height+1e-9);
 }
 assert.equal(coverCrop(600,1000,50,0).y,0);assert.equal(coverCrop(600,1000,50,100).y,662.5);
 assert.equal(coverCrop(2000,600,0,50).x,0);assert.ok(Math.abs(coverCrop(2000,600,100,50).x-933.3333333333)<1e-8);
 const exact=coverCrop(1600,900);assert.deepEqual([exact.x,exact.y,exact.travelX,exact.travelY],[0,0,0,0]);
});
test('drag follows the image direction, scales with the displayed frame and clamps to its edges',()=>{
 const portrait=coverCrop(600,1000),wide=coverCrop(2000,600);
 const down=moveCoverCrop(portrait,50,50,0,100,300,168.75);assert.equal(down.x,50);assert.ok(down.y<50);
 assert.deepEqual(moveCoverCrop(portrait,50,50,0,10000,300,168.75),{x:50,y:0});assert.deepEqual(moveCoverCrop(portrait,50,50,0,-10000,300,168.75),{x:50,y:100});
 assert.ok(moveCoverCrop(wide,50,50,50,0,600,337.5).x<50);assert.equal(moveCoverCrop(wide,50,50,0,100,600,337.5).y,50);
 assert.deepEqual(moveCoverCrop(coverCrop(1600,900),50,50,100,100,320,180),{x:50,y:50});
 assert.deepEqual(moveCoverCrop(portrait,50,50,0,50,300,168.75),moveCoverCrop(portrait,50,50,0,100,600,337.5));
});
