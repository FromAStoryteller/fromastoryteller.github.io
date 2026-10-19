// Compare only repository-authored content against the PR base; never private manuscripts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {playerSlot} from '../systems/content/player-information.mjs';
import {storyBodyHtml} from '../systems/reading/reading-time.mjs';
const base=process.env.FAS_LAYOUT_BASE;
if(!/^[a-f0-9]{40}$/.test(base??''))throw Error('Exact base commit required');
const index=JSON.parse(readFileSync('content/content-index.json','utf8'));
let stories=0,interactive=0;
function section(html,kind){
 const re=new RegExp('<section\\\\b[^>]*class="[^"]*\\\\b'+kind+'-play-section\\\\b[^"]*"[^>]*>'); // replaced below
 const start=html.match(new RegExp('<section[^>]*class="'+kind+'-play-section"[^>]*>'));
 assert.ok(start);const offset=start.index+start[0].length;const tags=/<\/?section\b[^>]*>/g;tags.lastIndex=offset;let depth=1,tag;
 while((tag=tags.exec(html))){depth+=tag[0].startsWith('</')?-1:1;if(!depth)return html.slice(offset,tag.index);}throw Error('Unclosed implementation slot');
}
for(const metaPath of index){
 assert.match(metaPath,/^\/(?:stories|games|tools|blog|videos)\/[a-z0-9-]+\/meta\.json$/);
 const path=metaPath.slice(1).replace(/meta\.json$/,'index.html'),previous=execFileSync('git',['show',base+':'+path],{encoding:'utf8'}),current=readFileSync(path,'utf8');
 const meta=JSON.parse(readFileSync(metaPath.slice(1),'utf8'));
 if(['story','blog'].includes(meta.type)){assert.equal(storyBodyHtml(current),storyBodyHtml(previous),'Legacy manuscript changed: '+path);stories++;}
 if(['game','tool'].includes(meta.type)){assert.equal(playerSlot(current,meta.type),playerSlot(previous,meta.type),'Interactive player changed: '+path);interactive++;}
 assert.ok(current.includes('data-content-layout="'+meta.type+'"'));
}
console.log('PASS preserved '+stories+' legacy manuscripts and '+interactive+' interactive player slots byte-for-byte against '+base);
