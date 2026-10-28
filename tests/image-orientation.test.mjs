import test from 'node:test';import assert from 'node:assert/strict';
import {rasterOrientation,orientImage} from '../supabase/functions/fas-studio-cover/orientation.mjs';
class Image{constructor(width,height){this.width=width;this.height=height;this.bitmap=new Uint8Array(width*height*4);}}
test('all camera orientations preserve pixels and rotate dimensions before cropping',()=>{
 const image=new Image(2,3);for(let i=0;i<6;i++)image.bitmap.set([i+1,0,0,255],i*4);
 const expected={1:[1,2,3,4,5,6],2:[2,1,4,3,6,5],3:[6,5,4,3,2,1],4:[5,6,3,4,1,2],5:[1,3,5,2,4,6],6:[5,3,1,6,4,2],7:[6,4,2,5,3,1],8:[2,4,6,1,3,5]};
 for(let orientation=1;orientation<=8;orientation++){const result=orientImage(image,orientation,Image);assert.deepEqual([...result.bitmap].filter((_,i)=>i%4===0),expected[orientation]);assert.deepEqual([result.width,result.height],orientation>=5?[3,2]:[2,3]);}
});
test('JPEG orientation is bounded and defaults safely for absent/malformed metadata',()=>{
 const bytes=new Uint8Array(40),view=new DataView(bytes.buffer);bytes.set([255,216,255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0]);assert.equal(rasterOrientation(bytes),6);view.setUint32(16,0xffffffff,true);assert.equal(rasterOrientation(bytes),1);assert.equal(rasterOrientation(new Uint8Array([0,1,2])),1);
});
