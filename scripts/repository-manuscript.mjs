// Trusted repository HTML only. Normal user text uses the regular editor model.
import {readManuscript,documentText} from '../systems/community/manuscript.mjs';
export function repositoryManuscript(html,document){
 const source=document.createElement('div'),flat=document.createElement('div');source.innerHTML=html;
 const narrative=source.cloneNode(true);for(const e of narrative.querySelectorAll('.story-scene-break,.story-break,hr'))e.remove();
 function append(node,marks={}){
  if(node.nodeType===8)return;
  if(node.nodeType===3){if(!node.textContent.trim())return;const p=document.createElement('p');p.textContent=node.textContent;append(p,marks);return;}
  if(node.nodeType!==1)return;
  if(node.matches('hr,.story-scene-break,.story-break')){flat.append(document.createElement('hr'));return;}
  if(['P','H2','BLOCKQUOTE'].includes(node.tagName)){
   if(!node.textContent.trim()&&!node.querySelector('br'))return;
   const block=node.cloneNode(true),walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),texts=[];while(walker.nextNode())texts.push(walker.currentNode);
   for(const t of texts)t.textContent=t.textContent.replace(/\s+/g,' ');
   if(texts.length){texts[0].textContent=texts[0].textContent.trimStart();texts.at(-1).textContent=texts.at(-1).textContent.trimEnd();}
   for(const [mark,tag] of [['italic','em'],['bold','strong']])if(marks[mark]){const wrap=document.createElement(tag);wrap.append(...block.childNodes);block.append(wrap);}
   flat.append(block);return;
  }
  const next={...marks,...(['EM','I'].includes(node.tagName)?{italic:true}:{}),...(['STRONG','B'].includes(node.tagName)?{bold:true}:{})};
  for(const child of node.childNodes)append(child,next);
 }
 for(const node of source.childNodes)append(node);
 const snapshot=readManuscript(flat),original=narrative.textContent.replace(/\s+/g,''),roundtrip=snapshot.blocks.filter(b=>b.type!=='scene').map(b=>(b.runs??[{text:b.text??''}]).map(r=>r.text).join('')).join('').replace(/\s+/g,'');
 if(original!==roundtrip)throw Error('Manuscript narrative changed during import');
 return snapshot;
}
