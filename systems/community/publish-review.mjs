import {downloadPackage} from './interactive-package.mjs';
import {documentText,plainDocument} from './manuscript.mjs';
import {genreLabel,SCENE_STYLES} from './studio-catalog.mjs';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
export const sameValue=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export const samePackage=(a,b)=>sameValue(a?{...a,assets:[...(a.assets??[])].sort((x,y)=>x.name.localeCompare(y.name))}:null,b?{...b,assets:[...(b.assets??[])].sort((x,y)=>x.name.localeCompare(y.name))}:null);
const bytes=s=>new TextEncoder().encode(s??'').length;
const mediaBytes=a=>a?Math.max(0,Math.floor(a.data.length*3/4)-(a.data.endsWith('==')?2:a.data.endsWith('=')?1:0)):0;
const size=n=>n.toLocaleString()+' bytes';
const text=v=>v==null||v===''?'None':typeof v==='boolean'?(v?'Yes':'No'):Array.isArray(v)?v.join(', ')||'None':typeof v==='object'?JSON.stringify(canonical(v),null,2):String(v);
const doc=s=>s.body_document??plainDocument(s.body??'');
export function contentChanges(before,after,{assets=[],metadataFields=[],authorName='My personal name',warnings=[]}={}){
 const changes=[],add=(label,a,b,display=text,extra={})=>{if(!sameValue(a,b))changes.push({label,before:display(a),after:display(b),...extra});};
 for(const [key,label]of [['title','Title'],['summary','Description']])add(label,before[key],after[key]);
 add('Content type',before.content_type,after.content_type,v=>({story:'Story',blog:'Blog post',game:'Game',tool:'Tool',video:'Video'}[v]??text(v)));
 add('Language',before.language,after.language,v=>({en:'English',mi:'Te reo Māori',fr:'French',de:'German',es:'Spanish',it:'Italian',pt:'Portuguese',ja:'Japanese',ko:'Korean',zh:'Chinese',other:'Other'}[v]??text(v)));
 const aDoc=doc(before),bDoc=doc(after),aText=documentText(aDoc),bText=documentText(bDoc);
 if(!sameValue(aDoc,bDoc))changes.push({label:'Manuscript',before:aText,after:bText,code:true,note:aText===bText?'The text is unchanged; its formatting has changed.':null,...(aText===bText?{before:JSON.stringify(aDoc,null,2),after:JSON.stringify(bDoc,null,2)}:{})});
 add('Genres',before.genres??[],after.genres??[],v=>v.map(genreLabel).join(', ')||'None');add('Tags',before.tags??[],after.tags??[]);
 add('Content warnings',before.warning_ids??[],after.warning_ids??[],v=>v.map(id=>warnings.find(w=>w.id===id)?.label??id).join(', ')||'None');
 if(sameValue(before.warning_ids??[],after.warning_ids??[]))add('Content warning text',before.content_warning??'',after.content_warning??'');
 add('Warnings reviewed',before.warning_reviewed===true,after.warning_reviewed===true);
 add('Cover image',before.cover_asset_id??null,after.cover_asset_id??null,id=>id?assets.find(a=>a.id===id)?.alt_text||'Selected cover':'No cover');
 if(before.cover_alt!==undefined||after.cover_alt!==undefined)add('Cover image description',before.cover_alt??'',after.cover_alt??'');
 add('Publishing name',before.publishing_identity??'personal',after.publishing_identity??'personal',v=>v==='fas'?'From A Storyteller':authorName);
 add('Scene breaks',before.scene_style??'space',after.scene_style??'space',v=>SCENE_STYLES.find(s=>s.id===v)?.label??text(v));add('Opening drop cap',before.drop_caps===true,after.drop_caps===true);
 add('Paragraph style',before.paragraph_style??'indented',after.paragraph_style??'indented',v=>v==='spaced'?'Spaced paragraphs':v==='indented'?'Indented paragraphs':text(v));
 add('Publication time',before.scheduled_at??null,after.scheduled_at??null,v=>v?new Date(v).toLocaleString():'Not scheduled');
 if(before.scheduled_at||after.scheduled_at)add('Publication timezone',before.publication_timezone,after.publication_timezone);
 for(const key of [...new Set([...Object.keys(before.metadata??{}),...Object.keys(after.metadata??{})])].sort())add(metadataFields.find(f=>f.key===key)?.label??key.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase()),before.metadata?.[key]??null,after.metadata?.[key]??null,text,{code:typeof before.metadata?.[key]==='object'||typeof after.metadata?.[key]==='object'});
 const a=before.executable_package,b=after.executable_package,type=after.content_type??before.content_type??'game';
 if(a||b){
  if(!a||!b)changes.push({label:'Player package',before:a?'Files attached':'No player files',after:b?'Files attached':'No player files'});
  add('Canvas orientation',a?.orientation??null,b?.orientation??null,v=>v==='portrait'?'Portrait · 1080 × 1920 (9:16)':v==='landscape'?'Landscape · 1920 × 1080 (16:9)':'None');
  for(const [key,name]of [['js',type+'.js'],['css',type+'.css']])add(name,a?.[key]??'',b?.[key]??'',v=>v,{code:true,file:name,note:'Saved: '+size(bytes(a?.[key]))+' · Proposed: '+size(bytes(b?.[key]))});
  for(const [key,label]of [['saves','Account saves'],['multiplayer','Multiplayer'],['saveVersion','Save format version'],['saveSchema','Allowed save data']])add(label,a?.settings?.[key]??null,b?.settings?.[key]??null,v=>key==='multiplayer'?({off:'Single-player',casual:'Private casual / turn-based rooms',realtime:'Private real-time rooms'}[v]??text(v)):text(v),{code:key==='saveSchema'});
  if(a?.template!==b?.template)add('Page template',a?.template??null,b?.template??null);
  const old=new Map((a?.assets??[]).map(v=>[v.name,v])),next=new Map((b?.assets??[]).map(v=>[v.name,v]));
  for(const name of [...new Set([...old.keys(),...next.keys()])].sort()){const x=old.get(name),y=next.get(name);if(!sameValue(x,y))changes.push({label:'assets/'+name,before:x?size(mediaBytes(x))+' · '+x.type:'Not included',after:y?size(mediaBytes(y))+' · '+y.type:'Not included',asset:y?(x?'Changed file':'Added file'):'Removed file'});}
 }
 return changes;
}
// Bound work for long manuscripts and source files. Trim their common edges
// before LCS so a small change in a large file still gets useful context.
export function lineComparison(before,after,{limit=240,maxCells=160000}={}){
 const a=before.replace(/\r\n/g,'\n').split('\n'),b=after.replace(/\r\n/g,'\n').split('\n');let start=0,end=0;
 while(start<a.length&&start<b.length&&a[start]===b[start])start++;
 while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
 const x=a.slice(start,a.length-end),y=b.slice(start,b.length-end),rows=[];
 for(let i=Math.max(0,start-3);i<start;i++)rows.push({kind:'same',text:a[i],oldLine:i+1,newLine:i+1});
 let i=0,j=0;const push=(kind,value)=>rows.push({kind,text:value,oldLine:kind==='add'?null:start+i+1,newLine:kind==='remove'?null:start+j+1});
 if(x.length+y.length<=2000&&(x.length+1)*(y.length+1)<=maxCells){const table=Array.from({length:x.length+1},()=>new Uint32Array(y.length+1));for(let p=x.length-1;p>=0;p--)for(let q=y.length-1;q>=0;q--)table[p][q]=x[p]===y[q]?table[p+1][q+1]+1:Math.max(table[p+1][q],table[p][q+1]);while(i<x.length||j<y.length){if(i<x.length&&j<y.length&&x[i]===y[j]){push('same',x[i]);i++;j++;}else if(i<x.length&&(j>=y.length||table[i+1][j]>=table[i][j+1])){push('remove',x[i]);i++;}else{push('add',y[j]);j++;}}}
 else{const cap=Math.max(1,Math.floor((limit-8)/4));for(const [kind,lines]of [['remove',x],['add',y]]){const indexes=lines.length<=cap*2?lines.map((_,n)=>n):[...Array.from({length:cap},(_,n)=>n),-1,...Array.from({length:cap},(_,n)=>lines.length-cap+n)];for(const n of indexes){if(n===-1)rows.push({kind:'gap',text:(lines.length-cap*2)+' '+(kind==='remove'?'removed':'added')+' lines omitted'});else rows.push({kind,text:lines[n],oldLine:kind==='remove'?start+n+1:null,newLine:kind==='add'?start+n+1:null});}}}
 for(let n=0;n<Math.min(3,end);n++)rows.push({kind:'same',text:a[a.length-end+n],oldLine:a.length-end+n+1,newLine:b.length-end+n+1});
 const compact=[];for(let p=0;p<rows.length;){if(rows[p].kind!=='same'){compact.push(rows[p++]);continue;}let q=p;while(q<rows.length&&rows[q].kind==='same')q++;if(q-p<=6)compact.push(...rows.slice(p,q));else compact.push(...rows.slice(p,p+3),{kind:'gap',text:(q-p-6)+' unchanged lines'},...rows.slice(q-3,q));p=q;}
 const shortened=compact.length>limit,visible=shortened?[...compact.slice(0,Math.floor(limit/2)),{kind:'gap',text:'Comparison shortened'},...compact.slice(-Math.floor(limit/2))]:compact;
 return {rows:visible,shortened,approximate:x.length+y.length>2000||(x.length+1)*(y.length+1)>maxCells};
}
function download(d,name,value){const url=URL.createObjectURL(new Blob([value],{type:'text/plain;charset=utf-8'})),a=d.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function mountPublishReview(root){
 const d=root.ownerDocument,dialog=d.createElement('dialog');let pending=null,disposed=false;
 dialog.className='ss-new-dialog ss-change-review';dialog.setAttribute('aria-labelledby','ss-review-title');dialog.setAttribute('aria-describedby','ss-review-description');
 dialog.innerHTML='<header><h2 id="ss-review-title">Review your changes</h2><p id="ss-review-description">This updates the published page. Check what changed before continuing.</p><p class="profile-muted" data-review-version></p></header><div class="ss-review-body" data-review-body></div><footer class="ss-save-actions ss-review-actions"><button type="button" class="account-secondary" data-review-cancel autofocus>Back to editing</button><button type="button" class="account-submit" data-review-confirm>Publish update</button></footer>';root.append(dialog);
 const body=dialog.querySelector('[data-review-body]'),confirm=dialog.querySelector('[data-review-confirm]');
 const finish=answer=>{const resolve=pending;pending=null;if(dialog.open)dialog.close();resolve?.(answer);};
 dialog.querySelector('[data-review-cancel]').addEventListener('click',()=>finish(false));confirm.addEventListener('click',()=>finish(true));dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});dialog.addEventListener('close',()=>{if(!dialog.open)finish(false);});
 return {get open(){return dialog.open;},ask({before,after,options={},confirmLabel='Publish update'}){if(disposed||pending)return Promise.resolve(false);body.replaceChildren();const changes=contentChanges(before,after,options);confirm.textContent=confirmLabel;confirm.disabled=!changes.length;dialog.querySelector('[data-review-version]').textContent=before.updated_at?'Compared with the version saved '+new Date(before.updated_at).toLocaleString()+'. Your address and ownership stay the same.':'Your address and ownership stay the same.';
  const summary=d.createElement('p');summary.className='ss-review-summary';summary.textContent=changes.length?changes.length+' changed '+(changes.length===1?'item':'items')+'. Publishing applies these changes immediately.':'No changes to publish. Your saved version already matches these changes.';body.append(summary);
  if(!samePackage(before.executable_package,after.executable_package)){const actions=d.createElement('nav');actions.className='ss-save-actions';actions.setAttribute('aria-label','Working project downloads');for(const [name,value]of [['saved',before.executable_package],['proposed',after.executable_package]]){if(!value)continue;const button=d.createElement('button');button.type='button';button.className='account-secondary';button.textContent='Download '+name+' project';button.addEventListener('click',async()=>{button.disabled=true;try{await downloadPackage(d,value,{type:after.content_type??before.content_type,name:'fas-'+(after.content_type??before.content_type)+'-'+name});}catch(e){summary.textContent=e.message;}finally{button.disabled=false;}});actions.append(button);}body.append(actions);}
  for(const change of changes){const section=d.createElement('section');section.className='ss-review-change';const h=d.createElement('h3');h.textContent=change.label;section.append(h);if(change.asset){const badge=d.createElement('p');badge.textContent=change.asset;section.append(badge);}if(change.note){const note=d.createElement('p');note.textContent=change.note;section.append(note);}
   if(change.code){const comparison=lineComparison(change.before,change.after),help=d.createElement('p');help.className='profile-muted';help.textContent='− Removed from saved version · + Added in proposed version'+(comparison.shortened||comparison.approximate?'. Preview shortened for this large change. Download the complete versions below.':'.');section.append(help);const pre=d.createElement('pre');pre.className='ss-review-diff';pre.tabIndex=0;pre.setAttribute('aria-label',change.label+' changes');for(const row of comparison.rows){const line=d.createElement('span');line.className='ss-diff-'+row.kind;line.textContent=(row.kind==='gap'?'… ':row.kind==='remove'?'− ':row.kind==='add'?'+ ':'  ')+(row.oldLine??'')+' '+(row.newLine??'')+'  '+row.text;pre.append(line);}section.append(pre);
    const actions=d.createElement('div');actions.className='ss-save-actions';for(const [name,value]of [['saved',change.before],['proposed',change.after]]){const button=d.createElement('button');button.type='button';button.className='studio-action-button';button.textContent='Download '+name+' '+(change.file?'file':'text');button.addEventListener('click',()=>download(d,'fas-'+name+'-'+(change.file??'comparison.txt'),value));actions.append(button);}section.append(actions);
   }else{const grid=d.createElement('div');grid.className='ss-review-values';for(const [label,value]of [['Saved',change.before],['Proposed',change.after]]){const part=d.createElement('div'),title=d.createElement('h4'),p=d.createElement('p');title.textContent=label;p.textContent=value;part.append(title,p);grid.append(part);}section.append(grid);}body.append(section);
  }
  return new Promise(resolve=>{pending=resolve;dialog.returnValue='';const w=d.defaultView,top=w.scrollY,left=w.scrollX;dialog.showModal();w.scrollTo({top,left,behavior:'instant'});body.scrollTop=0;dialog.querySelector('[data-review-cancel]').focus({preventScroll:true});});},dispose(){disposed=true;finish(false);dialog.remove();}};
}
