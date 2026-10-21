// Separate relationship settings work equally for new Studio drafts and legacy pages.
export function mountSeriesEditor(host,service,{canEdit=()=>true,onAccessLost=()=>{}}={}) {
 if(typeof service.seriesOptions!=='function'){host.hidden=true;return {setTarget(){},dirty:()=>false,pending:()=>false,refresh(){},dispose(){}};}
 const d=host.ownerDocument;
 host.addEventListener('input',event=>event.stopPropagation());host.addEventListener('change',event=>event.stopPropagation());
 host.innerHTML='<details class="ss-subsection ss-series-editor"><summary>Series &amp; collection</summary><p>A collection can group a shared world or related work. A series adds a reading or playing order.</p><fieldset><label class="ss-check"><input type="checkbox" data-series-enabled><span>Part of a series</span></label><div class="ss-field"><label data-series-label>Series name<input maxlength="100" autocomplete="off" data-series-name></label></div><div class="ss-field"><label>Collection / world <span class="ss-optional">Optional</span><input maxlength="100" autocomplete="off" data-series-collection></label></div><div class="ss-field"><label>Comes after<select data-series-previous><option value="">First in the series</option></select></label><p>Choosing an older, unassigned piece adds it to this series too. Its next link appears automatically when this piece is published.</p></div><div class="ss-save-actions"><button type="button" class="account-secondary" data-series-save>Save series details</button><button type="button" class="studio-action-button" data-series-reload>Reload saved details</button></div></fieldset><p role="status" data-series-status>Save a draft first to set up its series.</p></details>';
 const $=s=>host.querySelector(s),enabled=$('[data-series-enabled]'),name=$('[data-series-name]'),collection=$('[data-series-collection]'),previous=$('[data-series-previous]'),status=$('[data-series-status]'),fieldset=$('fieldset'),save=$('[data-series-save]');
 previous.setAttribute('aria-label','Comes after');
 const suffix='series-'+Math.random().toString(36).slice(2);
 for(const [control,key]of [[name,'names'],[collection,'collections']]){const list=d.createElement('datalist');list.id=suffix+'-'+key;control.setAttribute('list',list.id);host.append(list);}
 let target=null,version=null,items=[],baseline='',loading=false,saving=false,disposed=false,generation=0;
 const values=()=>({collection_title:collection.value.trim(),series_title:enabled.checked?name.value.trim():'',previous_key:enabled.checked?previous.value||null:null});
 const signature=()=>JSON.stringify(values());
 function refresh(){fieldset.disabled=loading||saving||!target?.id||target.status==='archived';name.disabled=!enabled.checked;previous.disabled=!enabled.checked;save.disabled=fieldset.disabled||!canEdit();}
 function fill(config={}){version=config.updated_at??null;collection.value=config.collection_name??'';name.value=config.series_name??'';enabled.checked=!!config.series_name;options(config.previous_id?config.previous_source+':'+config.previous_id:'');baseline=signature();refresh();}
 function options(selected=previous.value){
  previous.replaceChildren(new Option('First in the series',''));
  const currentKey=(target?.source_kind==='file'?'file':'studio')+':'+target?.id;
  for(const item of items){if(item.key===currentKey)continue;const option=new Option(item.title+' · '+(item.status==='published'?'Published':'Draft'),item.key);previous.append(option);}
  if(selected&&![...previous.options].some(o=>o.value===selected))previous.append(new Option('Previous piece unavailable — choose another',selected));previous.value=selected;
  for(const [control,key,field]of [[name,'names','series_name'],[collection,'collections','collection_name']]){const list=d.getElementById(suffix+'-'+key);list.replaceChildren();for(const value of [...new Set(items.map(i=>i[field]).filter(Boolean))])list.append(new Option(value,value));}
 }
 async function load(force=false){
  const token=++generation;if(!target?.id){items=[];fill();status.textContent='Save a draft first to set up its series.';return;}
  loading=true;refresh();status.textContent='Loading series details…';const selected=target;let cursor=null,config,rows=[];const seen=new Set();
  try{do{const result=await service.seriesOptions(selected,cursor);if(disposed||token!==generation)return;config??=result.current;rows.push(...result.items);cursor=result.next_cursor;if(cursor&&seen.has(cursor))throw Error('Series choices could not load. Try again.');seen.add(cursor);}while(cursor);
   items=rows;fill(config);status.textContent='Choose an existing name or type a new one. Save these details separately; published links update immediately.';
  }catch(error){if(!disposed&&token===generation){status.textContent=error.message;onAccessLost(error);}}
  finally{if(!disposed&&token===generation){loading=false;refresh();}}
 }
 enabled.addEventListener('change',()=>{refresh();status.textContent='Unsaved series details.';});
 for(const control of [name,collection,previous])control.addEventListener('input',()=>{status.textContent='Unsaved series details.';});
 previous.addEventListener('change',()=>{const item=items.find(i=>i.key===previous.value);if(item){enabled.checked=true;if(item.series_name)name.value=item.series_name;if(item.collection_name)collection.value=item.collection_name;}refresh();status.textContent='Unsaved series details.';});
 name.addEventListener('change',()=>{const item=items.find(i=>i.series_name.toLocaleLowerCase()===name.value.trim().toLocaleLowerCase());if(item&&item.collection_name)collection.value=item.collection_name;});
 save.addEventListener('click',async()=>{
  if(!target?.id||loading||saving||!canEdit())return;const input=values();if(enabled.checked&&!input.series_title){status.textContent='Enter or choose a series name.';name.focus();return;}
  const selected=target,token=generation;saving=true;refresh();status.textContent='Saving series details…';
  try{const result=await service.saveSeries(selected,input,version);if(disposed||token!==generation)return;fill(result);status.textContent='Series details saved. The next link appears only for published content.';}
  catch(error){if(!disposed&&token===generation){status.textContent=error.message;onAccessLost(error);}}
  finally{if(!disposed&&token===generation){saving=false;refresh();}}
 });
 $('[data-series-reload]').addEventListener('click',()=>{if(saving)return;if(signature()!==baseline&&!d.defaultView.confirm('Reload saved series details and discard these changes?'))return;void load(true);});
 refresh();baseline=signature();
  return {setTarget(value,force=false){const same=target?.id===value?.id&&target?.source_kind===value?.source_kind&&target?.publishing_identity===value?.publishing_identity;target=value;if(!same||force)void load();else refresh();},dirty:()=>!!target?.id&&signature()!==baseline,pending:()=>saving,refresh,dispose(){disposed=true;generation++;items=[];host.replaceChildren();}};
}
