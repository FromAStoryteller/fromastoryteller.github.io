import { mountStudio } from '/systems/community/studio-editor.mjs';
import { accountNavigation } from '/systems/community/account-navigation.mjs';
import { validateStory, StudioAccessError, StudioConflictError } from '/systems/community/studio-service.mjs';
const owner='81000000-0000-0000-0000-000000000001';
const assetId='82000000-0000-0000-0000-000000000001';
const rows=[{id:owner,title:'The lantern keeper',slug:'the-lantern-keeper',summary:'At the edge of the last road, a light is still burning.',body:'The lantern had burned for three hundred years.\n\nEvery evening, Mara climbed the steps to the tower and trimmed its wick. Every morning, she watched the road for a traveller who never came.\n\nUntil the night someone knocked from inside the flame.',genre:'Fantasy',tags:['folklore','quiet magic'],content_warning:'',cover_asset_id:null,status:'draft',updated_at:new Date().toISOString()},
 {id:'81000000-0000-0000-0000-000000000002',title:'A place left behind',slug:'a-place-left-behind-preview',summary:'Some doors wait for us.',body:'The house remembered her name.',genre:'Mystery',tags:[],content_warning:'',cover_asset_id:null,status:'published',updated_at:new Date().toISOString()},
 {id:'81000000-0000-0000-0000-000000000003',title:'The locked door',slug:'locked-preview',summary:'',body:'A locked story remains available for download.',genre:'',tags:[],content_warning:'',cover_asset_id:null,status:'archived',updated_at:new Date().toISOString()}];
let fail=false,conflict=false,access=true;
const copy=value=>structuredClone(value);
const authorize=async()=>{if(!access)throw new StudioAccessError('Contributor access removed. Saved work remains available through account download.');};
const service={authorize,list:async offset=>{await authorize();return copy(rows.slice(offset,offset+20));},read:async id=>{await authorize();return {story:copy(rows.find(row=>row.id===id)),assets:id===owner?[{id:assetId,alt_text:'A lantern against the dusk',approved_at:null}]:[]};},save:async(input,previous,status='draft')=>{
 await authorize();if(fail){fail=false;throw new Error('Your story could not be saved. Your unsaved text is still here.');}if(conflict){conflict=false;throw new StudioConflictError('This story changed elsewhere. Download your text and reopen it.');}
 const values=validateStory(input);let row=previous?rows.find(row=>row.id===previous.id):null;if(row?.status==='archived')throw new Error('Locked by moderation.');if(previous&&row.updated_at!==previous.updated_at)throw new StudioConflictError('Changed elsewhere.');
 if(!row){row={id:crypto.randomUUID()};rows.unshift(row);}Object.assign(row,values,{status,updated_at:new Date().toISOString()});return copy(row);
}};
const nav=document.querySelector('[data-studio-navigation]');nav.append(accountNavigation(document,{current:'studio',publicId:owner}));
const note=document.createElement('p');note.className='profile-muted';note.textContent='Fictional preview — no accounts or stories are changed. Try writing, saving, previewing and switching stories.';nav.append(note);
const controls=document.createElement('div');controls.className='studio-actions';
for(const [label,action] of [['Simulate next save failure',()=>{fail=true;}],['Simulate conflicting edit',()=>{conflict=true;}],['Remove contributor access',()=>{access=false;document.dispatchEvent(new Event('visibilitychange'));}]]){const b=document.createElement('button');b.type='button';b.className='studio-text-button';b.textContent=label;b.addEventListener('click',action);controls.append(b);}nav.append(controls);
const root=document.querySelector('[data-studio-root]');let dispose;dispose=mountStudio(root,service,{authorName:'Mara Ellis',onAccessLost:message=>{dispose();const p=document.createElement('p');p.textContent=message;root.append(p);}});
