import test from 'node:test';import assert from 'node:assert/strict';
import {responsiveImage} from '../systems/content/responsive-image.mjs';
test('static cards offer bounded AVIF/WebP sources with reserved dimensions',()=>{const html=responsiveImage('/assets/images/covers/tea-at-the-summit.jpg','Tea <snow>');assert.match(html,/<picture>/);assert.match(html,/image\/avif/);assert.match(html,/image\/webp/);assert.match(html,/480w/);assert.match(html,/sizes=/);assert.match(html,/loading="lazy"/);assert.match(html,/width="1600" height="900"/);assert.match(html,/Tea &lt;snow&gt;/);assert.ok(!html.includes('fetchpriority'));});
test('featured covers are eager and uploaded covers use only the trusted image gateway',()=>{const src='https://vzdicnufhidelaoeqbza.supabase.co/functions/v1/fas-story-image?asset_id=81000000-0000-4000-8000-000000000001';const html=responsiveImage(src,'Cover',{featured:true});assert.match(html,/width=480/);assert.match(html,/width=1600/);assert.match(html,/fetchpriority="high"/);assert.ok(!html.includes('loading="lazy"'));assert.ok(!responsiveImage('https://other.example/image.jpg','Other').includes('srcset'));});

test('candidate widths never claim more source pixels than a master contains',()=>{
 const src='https://vzdicnufhidelaoeqbza.supabase.co/functions/v1/fas-story-image?asset_id=81000000-0000-4000-8000-000000000001';
 const old=responsiveImage(src,'Cover',{width:1600,height:900});assert.match(old,/\/api\/public\/image/);assert.ok(!old.includes('2400w'));
 const large=responsiveImage(src,'Cover',{width:3200,height:1800});assert.match(large,/3200w/);assert.match(large,/width="3200" height="1800"/);
});
