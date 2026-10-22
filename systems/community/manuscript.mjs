import {publicSocialLinks,socialLabel} from './studio-catalog.mjs';
const blockTypes=new Set(['paragraph','heading','quote','scene']);
export function plainDocument(body='') {
  return {version:1,blocks:String(body).split(/\n\s*\n/).map(text=>text.trim()==='***'?{type:'scene'}:{type:'paragraph',text})};
}
export function validateDocument(value) {
  if(!value||value.version!==1||!Array.isArray(value.blocks)||value.blocks.length>5000)throw new Error('The manuscript format is invalid.');
  let length=0;
  const blocks=value.blocks.map(block=>{
    if(!block||!blockTypes.has(block.type)||Object.keys(block).some(k=>!['type','text','runs'].includes(k)))throw new Error('Unsupported manuscript block.');
    if(block.type==='scene')return {type:'scene'};
    if(block.runs){
      if(!Array.isArray(block.runs)||block.runs.length>10000)throw new Error('Too much formatting in one paragraph.');
      const runs=block.runs.map(run=>{if(typeof run.text!=='string'||Object.keys(run).some(k=>!['text','bold','italic'].includes(k)))throw new Error('Unsupported text formatting.');length+=run.text.length;return {text:run.text,...(run.bold?{bold:true}:{}),...(run.italic?{italic:true}:{})};});
      return {type:block.type,runs};
    }
    if(typeof block.text!=='string')throw new Error('Each paragraph needs text.');length+=block.text.length;return {type:block.type,text:block.text};
  });
  if(length>200000)throw new Error('Keep the manuscript to 200,000 characters.');
  return {version:1,blocks:blocks.length?blocks:[{type:'paragraph',text:''}]};
}
export const documentText = document => document.blocks.map(block=>block.type==='scene'?'***':block.runs?block.runs.map(run=>run.text).join(''):block.text).join('\n\n');
export function renderManuscript(root, value, {scene_style='space',drop_caps=false,paragraph_style='indented'}={}) {
  const document=validateDocument(value),d=root.ownerDocument;root.replaceChildren();
  root.classList.add('fas-manuscript');root.dataset.sceneStyle=scene_style;root.dataset.dropCaps=String(drop_caps);root.dataset.paragraphStyle='indented';
  for(const block of document.blocks){
    const element=d.createElement(({paragraph:'p',heading:'h2',quote:'blockquote',scene:'hr'})[block.type]);
    if(block.type==='scene'){element.dataset.scene='true';element.setAttribute('aria-label','Scene break');element.setAttribute('contenteditable','false');}
    else for(const run of block.runs??[{text:block.text}]){let node=d.createTextNode(run.text);if(run.italic){const em=d.createElement('em');em.append(node);node=em;}if(run.bold){const strong=d.createElement('strong');strong.append(node);node=strong;}element.append(node);}
    if(block.type!=='scene'&&!element.textContent)element.append(d.createElement('br'));
    root.append(element);
  }
  refreshParagraphLayout(root);
}
// Serialize a limited document model, never arbitrary HTML from contenteditable.
export function readManuscript(root) {
  const blocks=[];
  function inline(node,marks={}){
    if(node.nodeType===3)return [{text:node.textContent,...marks}];
    if(node.nodeType!==1)return [];
    if(['SCRIPT','STYLE','IFRAME','OBJECT','IMG'].includes(node.tagName))return [];
    if(node.tagName==='BR')return [{text:'\n',...marks}];
    const next={...marks,...(['B','STRONG'].includes(node.tagName)?{bold:true}:{}),...(['I','EM'].includes(node.tagName)?{italic:true}:{})};
    return [...node.childNodes].flatMap(child=>inline(child,next));
  }
  for(const node of root.childNodes){
    if(node.nodeType===1&&node.tagName==='HR'){blocks.push({type:'scene'});continue;}
    const type=node.tagName==='H2'?'heading':node.tagName==='BLOCKQUOTE'?'quote':'paragraph';
    // Browser-created DIVs after Enter are paragraphs too; paste is plain text.
    const runs=inline(node);if(runs.length===1&&runs[0].text==='\n')runs[0].text='';
    blocks.push({type,runs});
  }
  return validateDocument({version:1,blocks});
}
export function renderSocialLinks(root,links=[]) {
  const d=root.ownerDocument;root.replaceChildren();root.setAttribute('aria-label','Find this storyteller elsewhere');
  for(const link of publicSocialLinks(links)){let url;try{url=new URL(link.url);}catch{continue;}if(url.protocol!=='https:'||url.username||url.password)continue;
    const label=socialLabel(link.platform),icons={instagram:'instagram',facebook:'facebook',tiktok:'tiktok',youtube:'youtube',x:'x-twitter'};
    const a=d.createElement('a');a.href=url.href;a.rel='me noopener noreferrer';a.target='_blank';a.setAttribute('aria-label',label+' (opens in a new tab)');a.title=label;
    const icon=d.createElement('i');icon.className='fa-brands fa-'+icons[link.platform];icon.setAttribute('aria-hidden','true');
    const text=d.createElement('span');text.className='visually-hidden';text.textContent=label;a.append(icon,text);root.append(a);}
}

export function refreshParagraphLayout(root){let previous=null;for(const element of root.children){element.dataset.indent=String(['P','DIV'].includes(element.tagName)&&!!element.textContent.trim()&&['P','DIV'].includes(previous?.tagName)&&!!previous.textContent.trim());previous=element;}}
