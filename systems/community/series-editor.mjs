export function seriesPartState(item){return item.status==='published'?'published':item.scheduled_at?'scheduled':'draft';}
const time=value=>Number.isFinite(Date.parse(value))?Date.parse(value):0;
export function sortSeriesParts(items){return [...items].sort((a,b)=>{
 const rank={draft:0,scheduled:1,published:2},state=seriesPartState(a),other=seriesPartState(b);
 return rank[state]-rank[other]||(state==='scheduled'?time(a.scheduled_at)-time(b.scheduled_at):time(b.published_at||b.updated_at)-time(a.published_at||a.updated_at))||a.title.localeCompare(b.title)||a.key.localeCompare(b.key);
});}
export function seriesPartLabel(item){
 const state=seriesPartState(item),date=state==='published'?item.published_at:state==='scheduled'?item.scheduled_at:item.updated_at;
 const formatted=time(date)?new Date(date).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',...(state==='scheduled'?{hour:'numeric',minute:'2-digit',timeZoneName:'short'}:{})}):'';
 return item.title+' — '+(state==='published'?'Published':state==='scheduled'?'Scheduled for':'Draft'+(formatted?' · updated':''))+(formatted?' '+formatted:'');
}
const groupKey=(series,world)=>JSON.stringify([series||'',world||'']);
// Separate relationship settings work equally for new Studio drafts and legacy pages.
export function mountSeriesEditor(host,service,{canEdit=()=>true,onAccessLost=()=>{}}={}) {
 if(typeof service.seriesOptions!=='function'){host.hidden=true;return {setTarget(){},dirty:()=>false,pending:()=>false,refresh(){},dispose(){}};}
 const d=host.ownerDocument;
 host.addEventListener('input',event=>event.stopPropagation());host.addEventListener('change',event=>event.stopPropagation());
 host.innerHTML='<details class="ss-subsection ss-series-editor"><summary>Series &amp; collection</summary><p>A collection can group a shared world or related work. A series adds a reading or playing order.</p><fieldset><label class="ss-check"><input type="checkbox" data-series-enabled><span>Part of a series</span></label><div class="ss-field"><label>Series<select aria-label="Series" data-series-choice></select></label><label data-series-label>New series name<input maxlength="100" autocomplete="off" data-series-name></label></div><div class="ss-field"><label>Collection / world <span class="ss-optional">Optional</span><select aria-label="Collection / world" data-collection-choice></select></label><label>New collection / world name<input maxlength="100" autocomplete="off" data-series-collection></label></div><div class="ss-field"><label>Comes after<select data-series-previous><option value="">First in the series</option></select></label><p>Drafts first, then scheduled pieces (nearest first), then latest releases. Dates use your local time. Unassigned older work is listed separately so you can add it to this series.</p></div><div class="ss-save-actions"><button type="button" class="account-secondary" data-series-save>Save series details</button><button type="button" class="studio-action-button" data-series-reload>Reload saved details</button></div></fieldset><p role="status" data-series-status>Save a draft first to set up its series.</p></details>';
 const $=s=>host.querySelector(s),enabled=$('[data-series-enabled]'),name=$('[data-series-name]'),collection=$('[data-series-collection]'),seriesChoice=$('[data-series-choice]'),collectionChoice=$('[data-collection-choice]'),previous=$('[data-series-previous]'),status=$('[data-series-status]'),fieldset=$('fieldset'),save=$('[data-series-save]');
 previous.setAttribute('aria-label','Comes after');
 let target=null,version=null,items=[],baseline='',loading=false,saving=false,ready=false,disposed=false,generation=0;
 const values=()=>({collection_title:collection.value.trim(),series_title:enabled.checked?name.value.trim():'',previous_key:enabled.checked?previous.value||null:null});
 const signature=()=>JSON.stringify(values());
 function refresh(){fieldset.disabled=loading||saving||!target?.id||target.status==='archived';name.disabled=!enabled.checked;seriesChoice.disabled=!enabled.checked;name.closest('label').hidden=!enabled.checked||seriesChoice.value!=='new';collection.closest('label').hidden=collectionChoice.value!=='new';previous.disabled=!enabled.checked;save.disabled=fieldset.disabled||!ready||!canEdit();}
 function choices(){
  seriesChoice.replaceChildren(new Option('Create a new series','new'));collectionChoice.replaceChildren(new Option('No collection / world',''),new Option('Create a new collection / world','new'));
  const groups=new Map();for(const item of [...items,{series_name:name.value,collection_name:collection.value}])if(item.series_name)groups.set(groupKey(item.series_name,item.collection_name),item);
  for(const [key,item]of [...groups].sort((a,b)=>a[1].series_name.localeCompare(b[1].series_name)||a[0].localeCompare(b[0])))seriesChoice.append(new Option(item.series_name+(item.collection_name?' — '+item.collection_name:''),key));
  const worlds=[...new Set([...items.map(i=>i.collection_name),collection.value].filter(Boolean))].sort((a,b)=>a.localeCompare(b));for(const world of worlds)collectionChoice.append(new Option(world,JSON.stringify(world)));
  seriesChoice.value=name.value?groupKey(name.value,collection.value):'new';collectionChoice.value=collection.value?JSON.stringify(collection.value):'';
 }
 function fill(config={}){version=config.updated_at??null;collection.value=config.collection_name??'';name.value=config.series_name??'';enabled.checked=!!config.series_name;choices();options(config.previous_id?config.previous_source+':'+config.previous_id:'');baseline=signature();refresh();}
 function options(selected=previous.value){
  previous.replaceChildren(new Option('First in the series',''));
  const currentKey=(target?.source_kind==='file'?'file':'studio')+':'+target?.id;
  const assigned=d.createElement('optgroup'),unassigned=d.createElement('optgroup');assigned.label='In this series';unassigned.label='Add unassigned work to this series';
  for(const item of sortSeriesParts(items)){if(item.key===currentKey)continue;const same=item.series_name===name.value.trim()&&(item.collection_name||'')===collection.value.trim();if(item.series_name&&!same||!item.series_name&&item.collection_name&&item.collection_name!==collection.value.trim())continue;(item.series_name?assigned:unassigned).append(new Option(seriesPartLabel(item),item.key));}
  if(assigned.children.length)previous.append(assigned);if(unassigned.children.length)previous.append(unassigned);
  if(selected&&![...previous.options].some(o=>o.value===selected))previous.append(new Option('Previous piece unavailable — choose another',selected));previous.value=selected;
 }
 async function load(force=false){
  const token=++generation;loading=false;saving=false;ready=false;items=[];fill();if(!target?.id){status.textContent='Save a draft first to set up its series.';return;}
  loading=true;refresh();status.textContent='Loading series details…';const selected=target;let cursor=null,config,rows=[];const seen=new Set();
  try{do{const result=await service.seriesOptions(selected,cursor);if(disposed||token!==generation)return;config??=result.current;rows.push(...result.items);cursor=result.next_cursor;if(cursor&&seen.has(cursor))throw Error('Series choices could not load. Try again.');seen.add(cursor);}while(cursor);
   items=rows;ready=true;fill(config);status.textContent='Select an existing series or collection, or create a new one. Save these details separately; published links update immediately.';
  }catch(error){if(!disposed&&token===generation){status.textContent=error.message;onAccessLost(error);}}
  finally{if(!disposed&&token===generation){loading=false;refresh();}}
 }
 enabled.addEventListener('change',()=>{refresh();options();status.textContent='Unsaved series details.';});
 for(const control of [name,collection,previous])control.addEventListener('input',()=>{status.textContent='Unsaved series details.';});
 previous.addEventListener('change',()=>{const item=items.find(i=>i.key===previous.value);if(item){enabled.checked=true;if(item.series_name)name.value=item.series_name;if(item.series_name)worldChoice(item.collection_name||'');}refresh();status.textContent='Unsaved series details.';});
 function worldChoice(value){collection.value=value;const key=JSON.stringify(value);collectionChoice.value=[...collectionChoice.options].some(o=>o.value===key)?key:value?'new':'';}
 seriesChoice.addEventListener('change',()=>{if(seriesChoice.value==='new'){name.value='';}else{const [series,world]=JSON.parse(seriesChoice.value);name.value=series;worldChoice(world);}options('');refresh();status.textContent='Unsaved series details.';if(seriesChoice.value==='new')name.focus();});
 collectionChoice.addEventListener('change',()=>{collection.value=collectionChoice.value==='new'||!collectionChoice.value?'':JSON.parse(collectionChoice.value);if(seriesChoice.value!=='new')seriesChoice.value='new';options('');refresh();status.textContent='Unsaved series details.';if(collectionChoice.value==='new')collection.focus();});
 for(const control of [name,collection])control.addEventListener('input',()=>options(''));
 save.addEventListener('click',async()=>{
  if(!target?.id||loading||saving||!ready||!canEdit())return;const input=values();if(enabled.checked&&!input.series_title){status.textContent='Enter or choose a series name.';name.focus();return;}
  if(collectionChoice.value==='new'&&!input.collection_title){status.textContent='Enter a new collection / world name, or choose No collection / world.';collection.focus();return;}
  const selected=target,token=generation;saving=true;refresh();status.textContent='Saving series details…';
  try{const result=await service.saveSeries(selected,input,version);if(disposed||token!==generation)return;const key=(selected.source_kind==='file'?'file':'studio')+':'+selected.id;items=items.map(item=>item.key===key||item.key===input.previous_key&&!item.series_name?{...item,series_name:result.series_name,collection_name:result.collection_name}:item);fill(result);status.textContent='Series details saved. The next link appears only for published content.';}
  catch(error){if(!disposed&&token===generation){status.textContent=error.message;onAccessLost(error);}}
  finally{if(!disposed&&token===generation){saving=false;refresh();}}
 });
 $('[data-series-reload]').addEventListener('click',()=>{if(saving)return;if(signature()!==baseline&&!d.defaultView.confirm('Reload saved series details and discard these changes?'))return;void load(true);});
 choices();refresh();baseline=signature();
  return {setTarget(value,force=false){const same=target?.id===value?.id&&target?.source_kind===value?.source_kind&&target?.publishing_identity===value?.publishing_identity;target=value;if(!same||force)void load();else refresh();},dirty:()=>!!target?.id&&signature()!==baseline,pending:()=>saving,refresh,dispose(){disposed=true;generation++;items=[];host.replaceChildren();}};
}
