import test from 'node:test';import assert from 'node:assert/strict';
import {contentChanges,lineComparison,samePackage} from '../systems/community/publish-review.mjs';
import {starterPackage} from '../systems/community/interactive-package.mjs';import {plainDocument} from '../systems/community/manuscript.mjs';
test('review identifies content, metadata and formatting changes without comparing private identity fields',()=>{
 const before={title:'Original',body:'First paragraph',genres:['fantasy'],tags:[],metadata:{instructions:'Old controls'},author_id:'private',updated_at:'2026-10-20',status:'published'};
 const after={...before,title:'<script>unsafe()</script>',body_document:plainDocument('Revised paragraph'),metadata:{instructions:'New controls'},author_id:'different',updated_at:'later'};
 const rows=contentChanges(before,after,{metadataFields:[{key:'instructions',label:'Controls and instructions'}]});assert.deepEqual(rows.map(r=>r.label),['Title','Manuscript','Controls and instructions']);assert.equal(rows[0].after,after.title);assert.equal(rows[1].before,'First paragraph');assert.equal(rows[1].after,'Revised paragraph');
 assert.deepEqual(contentChanges(before,{...before,body_document:plainDocument(before.body)}),[]);
 const formatting=contentChanges({...before,body_document:plainDocument('Words')},{...before,body_document:{version:1,blocks:[{type:'paragraph',runs:[{text:'Words',bold:true}]}]}});assert.match(formatting[0].note,/formatting/);
});
test('game and tool comparisons name source files and expose asset status without rendering media bytes',()=>{
 for(const type of ['game','tool']){const a=starterPackage('landscape',type),b=structuredClone(a);a.assets=[{name:'old.png',type:'image/png',data:'aGVsbG8='},{name:'same.png',type:'image/png',data:'aGVsbG8='}];b.assets=[{name:'new.png',type:'image/png',data:'ZmlsZQ=='},{name:'same.png',type:'image/png',data:'ZmlsZQ=='}];b.js+='\n// New behavior';b.css+='\n/* New style */';b.orientation='portrait';const rows=contentChanges({content_type:type,executable_package:a},{content_type:type,executable_package:b});assert.ok(rows.some(r=>r.file===type+'.js'));assert.ok(rows.some(r=>r.file===type+'.css'));assert.ok(rows.some(r=>r.label==='Canvas orientation'));assert.deepEqual(rows.filter(r=>r.asset).map(r=>r.asset),['Added file','Removed file','Changed file']);assert.ok(!JSON.stringify(rows.filter(r=>r.asset)).includes('aGVsbG8='));}
});
test('package comparisons ignore object key and asset list order and show save/multiplayer contract changes',()=>{
 const p=starterPackage();p.assets=[{name:'b.png',type:'image/png',data:'eA=='},{name:'a.png',type:'image/png',data:'eA=='}];assert.equal(samePackage(p,{...p,assets:p.assets.toReversed(),settings:Object.fromEntries(Object.entries(p.settings).toReversed())}),true);const q=structuredClone(p);q.settings.saves=true;q.settings.saveVersion=2;q.settings.multiplayer='casual';const labels=contentChanges({executable_package:p},{executable_package:q}).map(r=>r.label);assert.deepEqual(labels,['Account saves','Multiplayer','Save format version']);
});
test('line comparisons retain meaningful line numbers and nearby context for small edits in large files',()=>{
 const before=Array.from({length:5000},(_,i)=>'line '+i),after=[...before];after[2500]='updated line';const result=lineComparison(before.join('\n'),after.join('\n'));assert.equal(result.approximate,false);assert.equal(result.rows.length,8);assert.deepEqual(result.rows.filter(r=>r.kind==='remove'||r.kind==='add'),[{kind:'remove',text:'line 2500',oldLine:2501,newLine:null},{kind:'add',text:'updated line',oldLine:null,newLine:2501}]);
 const insert=lineComparison('first\nlast','first\nnew\nlast');assert.ok(insert.rows.some(r=>r.kind==='add'&&r.newLine===2&&r.text==='new'));
});
test('very large replacements stay bounded and preserve both removed and added samples',()=>{
 const before=Array.from({length:50000},(_,i)=>'old '+i).join('\n'),after=Array.from({length:50000},(_,i)=>'new '+i).join('\n'),result=lineComparison(before,after);assert.equal(result.approximate,true);assert.ok(result.rows.length<=242);assert.ok(result.rows.some(r=>r.kind==='remove'&&r.text==='old 0'));assert.ok(result.rows.some(r=>r.kind==='add'&&r.text==='new 49999'));assert.ok(result.rows.some(r=>r.kind==='gap'));
});
