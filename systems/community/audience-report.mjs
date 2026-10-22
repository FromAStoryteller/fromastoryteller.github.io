export function renderFollowerCount(host,followers){
 if(!Number.isSafeInteger(followers?.people_following)||followers.people_following<0)return;
 const d=host.ownerDocument,node=(tag,text)=>{const el=d.createElement(tag);el.textContent=text;return el;},grid=node('div','');grid.className='ss-stat-grid ss-follower-metrics';
 for(const [label,count]of [['People Following',followers.people_following],...(Number.isSafeInteger(followers.fas_people_following)&&followers.fas_people_following>=0?[['People Following FAS',followers.fas_people_following]]:[])]){const card=node('article','');card.append(node('h3',label),node('p',count.toLocaleString()));grid.append(card);}
 host.append(grid,node('p','Current account followers, across all time. This count is private to you and is separate from page views. Follower identities and their lists stay private.'));
}
export function renderAudienceReport(host,data,{pageNames=new Map()}={}){
 const d=host.ownerDocument;host.replaceChildren();
 const node=(tag,text)=>{const el=d.createElement(tag);el.textContent=text;return el;};
 const firstParty=data.provider==='FAS first-party';
 renderFollowerCount(host,data.followers);
 if(data.acknowledgements){const a=data.acknowledgements;host.append(node('h2','Viewer acknowledgements'),node('p','Current totals from account holders who chose to acknowledge or love your work. These totals cover all time and are separate from measured page views. Saved lists and viewer identities remain private.'));
 const grid=node('div','');grid.className='ss-stat-grid ss-acknowledgement-metrics';for(const [label,count]of [['Read / played / used',a.experienced],['Loved it',a.loved]]){const card=node('article','');card.append(node('h3',label),node('p',Number(count??0).toLocaleString()));grid.append(card);}host.append(grid);
 if(a.pages?.length){const table=node('table','');table.className='ss-report-table ss-acknowledgements';const head=node('thead',''),tr=node('tr','');for(const label of ['Piece','Read / tried','Loved it']){const th=node('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=node('tbody','');for(const row of a.pages){const tr=node('tr',''),th=node('th',row.title);th.scope='row';tr.append(th,node('td',Number(row.experienced).toLocaleString()),node('td',Number(row.loved).toLocaleString()));body.append(tr);}table.append(body);host.append(table);}
 const download=node('button','Download acknowledgements (CSV)');download.type='button';download.className='account-secondary';download.addEventListener('click',()=>{const cell=value=>{const text=String(value??''),safe=/^\s*[=+@-]/.test(text)?"'"+text:text;return '"'+safe.replace(/"/g,'""')+'"';};const rows=[['Piece','Acknowledged (all time)','Loved it (all time)'],...(a.pages??[]).map(row=>[row.title,row.experienced,row.loved])],url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),link=node('a','');link.href=url;link.download='fas-viewer-acknowledgements.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});host.append(download,node('h2','Audience views'));}
 const grid=node('div','');grid.className='ss-stat-grid';
 const pages=data.pages??[],sum=kind=>pages.filter(p=>p.page_kind===kind).reduce((n,p)=>n+Number(p.views),0);
 const metrics=firstParty?[['Page views',data.views],['Profile views',sum('profile')],['Content views',sum('content')]]:[['Page views',data.views],['Engaged visits',data.engaged_views],['Completed reads',data.completed_reads]];
 for(const [label,value]of metrics){const card=node('article','');card.append(node('h3',label),node('p',Number(value??0).toLocaleString()));grid.append(card);}host.append(grid);
 const note=node('p',firstParty?'Anonymous views from visitors who allow audience insights. Repeat visits and your own visits can count. These are estimates, not unique people or earnings. Engagement and completion tracking are not collected.':'Aggregate provider reports.');note.className='profile-muted';host.append(note);
 if(!Number(data.views)){host.append(node('p','No recorded views in this period. Counts start when audience insights goes live and a visitor allows collection.'));}
 const groups=[['Traffic sources',data.sources,'source_group','Source'],['Screen-size groups',data.devices,'device_group','Screen size'],['Daily views (UTC)',data.daily,'day','Date'],['Pages',pages,'page_id','Page']];
 for(const [title,rows,key,label]of groups){if(!rows?.length)continue;host.append(node('h3',title));const table=node('table','');table.className='ss-report-table';const head=node('thead',''),tr=node('tr','');for(const labelText of [label,'Views']){const th=node('th',labelText);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=node('tbody','');for(const row of rows){const tr=node('tr',''),th=node('th',key==='page_id'?(pageNames.get(row.page_id)||(row.page_kind==='profile'?'Storyteller page':'Published content')):row[key]);th.scope='row';tr.append(th,node('td',Number(row.views).toLocaleString()));body.append(tr);}table.append(body);host.append(table);}
 const button=node('button','Download insights (CSV)');button.type='button';button.className='account-secondary';button.addEventListener('click',()=>{
  const csvCell=value=>{const text=String(value??''),safe=/^\s*[=+@-]/.test(text)?"'"+text:text;return '"'+safe.replace(/"/g,'""')+'"';};
  const rows=[['Group','Label','Views'],...groups.flatMap(([title,items,key])=>(items??[]).map(row=>[title,key==='page_id'?(pageNames.get(row[key])||row.page_kind):row[key],row.views]))];
  const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=node('a','');a.href=url;a.download='fas-audience-insights.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });host.append(button);
 if(data.monetization_enabled){host.append(node('p','Revenue reports are separate from a payable balance.'));}
}
