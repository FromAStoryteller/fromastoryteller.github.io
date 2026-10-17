import {validateStory,storySlug} from './studio-service.mjs';
import {isPublicId} from './profiles.mjs';
import {GENRES} from './studio-catalog.mjs';
import {documentText} from './manuscript.mjs';
const PREFIX='fas-studio-recovery-v1:',MAX=1024*1024,AGE=24*60*60*1000;
export function recoveryRecord(values,{ownerId,story=null,now=Date.now(),genres=GENRES}={}){
 if(!isPublicId(ownerId))throw new Error('A verified owner is required for recovery.');
 const title=values.title??'',clean=validateStory({...values,...(Array.isArray(values.genres)?{genres:[...new Set(values.genres)]}:{}),title:title.trim()?title:'Untitled recovery'},genres);clean.title=title;
 const record={format:'fas-studio-recovery-v1',owner:ownerId,saved_at:new Date(now).toISOString(),source_id:story?.id??null,base_version:story?.updated_at??null,values:clean};
 if(new TextEncoder().encode(JSON.stringify(record)).length>MAX)throw new Error('This recovery copy is too large. Download your text instead.');
 return record;
}
export function parseRecovery(raw,{ownerId,now=Date.now(),genres=GENRES,checkAge=true}={}){
 if(typeof raw!=='string'||(raw.length>MAX||new TextEncoder().encode(raw).length>MAX))throw new Error('Choose a Studio recovery file up to 1 MiB.');
 let record;try{record=JSON.parse(raw);}catch{throw new Error('This recovery file could not be read.');}
 if(record?.format!=='fas-studio-recovery-v1'||record.owner!==ownerId||!record.values||!Number.isFinite(Date.parse(record.saved_at))||record.source_id!==null&&!isPublicId(record.source_id)||record.base_version!==null&&typeof record.base_version!=='string')throw new Error('This recovery copy does not belong to this account or is unsupported.');
 if(checkAge&&(now-Date.parse(record.saved_at)>AGE||Date.parse(record.saved_at)>now+60000))throw new Error('This tab recovery copy has expired.');
 const clean=recoveryRecord(record.values,{ownerId,story:record.source_id?{id:record.source_id,updated_at:record.base_version}:null,now:Date.parse(record.saved_at),genres});if(record.text_only===true)clean.text_only=true;return clean;
}
export const canResumeRecovery=(record,story)=>!record.text_only&&!!record.source_id&&record.source_id===story?.id&&record.base_version===story.updated_at&&story.status==='draft'&&!story.scheduled_at;
export function clearRecoveryStorage(storage,exceptOwner=null){
 try{for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith(PREFIX)&&(!exceptOwner||!key.startsWith(PREFIX+exceptOwner+':')))storage.removeItem(key);}}catch{}
}
export function createRecoveryStore(storage,{ownerId,now=Date.now}={}){
 if(!isPublicId(ownerId))throw new Error('A verified owner is required for recovery.');
 const key=PREFIX+ownerId+':copy';
 // Remove the retired opt-in preference; recovery now protects edits automatically.
 try{storage?.removeItem(PREFIX+ownerId+':enabled');}catch{}
 return {
  read(genres=GENRES){try{const raw=storage?.getItem(key);if(!raw)return null;return parseRecovery(raw,{ownerId,now:now(),genres});}catch{try{storage?.removeItem(key);}catch{}return null;}},
  write(record){if(record?.owner!==ownerId||record?.format!=='fas-studio-recovery-v1')return false;try{const raw=JSON.stringify(record);if(new TextEncoder().encode(raw).length>MAX)return false;storage.setItem(key,raw);return storage.getItem(key)===raw;}catch{return false;}},
  clear(){try{storage?.removeItem(key);}catch{}},
 };
}

export function downloadRecovery(document,record,textOnly=false){
 const values=record.values,text=[values.title||'Untitled',values.summary,values.content_warning?'Content warning: '+values.content_warning:'',values.body_document?documentText(values.body_document):values.body].filter(Boolean).join('\n\n');
 const content=textOnly?text:JSON.stringify(record,null,2),url=URL.createObjectURL(new Blob([content],{type:textOnly?'text/plain;charset=utf-8':'application/json'})),a=document.createElement('a');
 a.href=url;a.download=storySlug(values.title||'recovery')+(textOnly?'.txt':'.fas-recovery.json');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
