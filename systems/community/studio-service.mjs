import {validatePackage,isInteractive} from './interactive-package.mjs';
import {loadProfileAccount} from '../../account/settings-controller.mjs';
import {isPublicId} from './profiles.mjs';
import {GENRES,genreLabel,metadataIssues} from './studio-catalog.mjs';
import {validateDocument,documentText} from './manuscript.mjs';
export const STORY_FIELDS='author_id,id,slug,title,summary,body,genre,genres,tags,content_warning,cover_asset_id,status,updated_at,published_at,content_type,body_document,scene_style,drop_caps,paragraph_style,language,scheduled_at,publication_timezone,slug_locked,metadata,metadata_version,author_archived_at,warning_ids,warning_reviewed,publishing_identity,executable_package';
const allowed=['slug','title','summary','body','genre','genres','tags','content_warning','cover_asset_id','content_type','body_document','scene_style','drop_caps','paragraph_style','language','scheduled_at','publication_timezone','metadata','warning_ids','warning_reviewed','publishing_identity','executable_package'];
const text=(value,name,max,required=false)=>{if(typeof value!=='string'||[...value].length>max||required&&!value.trim())throw new Error(`${name}: ${required?'enter text, up to':'use up to'} ${max.toLocaleString()} characters.`);return value;};
export const storySlug=title=>title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100).replace(/-$/,'')||'untitled';
export function validateStory(input,genreCatalog=GENRES){
 if(!input||Object.keys(input).some(key=>!allowed.includes(key)))throw new Error('Only content, presentation and publication fields can be edited.');
 const title=text(input.title,'Title',200,true).trim(),tags=typeof input.tags==='string'?input.tags.split(',').map(t=>t.trim()).filter(Boolean):input.tags??[];
 if(!Array.isArray(tags)||tags.length>12||tags.some(t=>typeof t!=='string'||!t.trim()||[...t].length>40))throw new Error('Use up to 12 tags, each up to 40 characters.');
 const genres=input.genres??(input.genre?genreCatalog.filter(g=>g.label.toLowerCase()===input.genre.toLowerCase()).map(g=>g.id):[]);
 if(!Array.isArray(genres)||genres.length>3||new Set(genres).size!==genres.length||genres.some(id=>!genreCatalog.some(g=>g.id===id)))throw new Error('Choose up to three genres or subgenres from the list.');
 const cover=input.cover_asset_id||null;if(cover!==null&&!isPublicId(cover))throw new Error('Choose a cover attached to this content.');
 const document=input.body_document?validateDocument(input.body_document):null,body=document?documentText(document):text(input.body??'','Manuscript',200000);
 const type=input.content_type??'story',scene=input.scene_style??'space',paragraph=input.paragraph_style??'indented',language=input.language??'en';
 if(!['story','blog','game','tool'].includes(type)||!['space','dots','diamond','rule'].includes(scene)||!['indented','spaced'].includes(paragraph)||!['en','mi','fr','de','es','it','pt','ja','ko','zh','other'].includes(language))throw new Error('Choose supported content and presentation options.');
 const schedule=input.scheduled_at||null;if(schedule&&(typeof schedule!=='string'||!Number.isFinite(Date.parse(schedule))))throw new Error('Choose a valid publication time.');
 const timezone=input.publication_timezone??Intl.DateTimeFormat().resolvedOptions().timeZone;try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw new Error('Your publication timezone could not be determined.');}
 if(!Array.isArray(input.warning_ids??[])||(input.warning_ids??[]).length>10||(input.warning_ids??[]).some(id=>typeof id!=='string'||!/^[a-z0-9-]{1,100}$/.test(id)))throw new Error('Choose content warnings from the list.');
 if(input.metadata!=null&&(typeof input.metadata!=='object'||Array.isArray(input.metadata)||JSON.stringify(input.metadata).length>16000))throw new Error('Check your content details.');
 if(!['personal','fas'].includes(input.publishing_identity??'personal'))throw new Error('Choose a publishing name.');
 const executable_package=validatePackage(input.executable_package);if(executable_package&&!isInteractive(type))throw new Error('Only games and tools can contain executable files.');
 return {executable_package,publishing_identity:input.publishing_identity??'personal',metadata:input.metadata??{},warning_ids:input.warning_ids??[],warning_reviewed:input.warning_reviewed===true,title,summary:text(input.summary??'','Description',1000),body,body_document:document,genres,genre:genres.map(id=>genreCatalog.find(g=>g.id===id)?.label??id).join(', ').slice(0,80),tags:[...new Set(tags.map(t=>t.trim()))],content_warning:text(input.content_warning??'','Content warning',1000),cover_asset_id:cover,content_type:type,scene_style:scene,drop_caps:input.drop_caps===true,paragraph_style:'indented',language,scheduled_at:schedule,publication_timezone:timezone};
}
export function publicationIssues(input,assets=[],type){
 const issues=metadataIssues(input,type);if(!input.warning_reviewed)issues.push('Review content warnings (or confirm none)');if(!input.title?.trim())issues.push('Add a title');if((input.summary?.trim().length??0)<10)issues.push('Add a description (at least 10 characters)');
 const body=input.body_document?documentText(input.body_document):input.body;if(isInteractive(input.content_type)){if(!input.executable_package?.js?.trim())issues.push('Upload main.js');if(!input.metadata?.instructions?.trim())issues.push('Add controls and instructions');}else if(!body?.replace(/\*\*\*/g,'').trim())issues.push('Write your manuscript');if(!input.genres?.length)issues.push('Choose at least one genre or subgenre');
 const cover=assets.find(a=>a.id===input.cover_asset_id);if(!cover)issues.push('Choose a cover image');else{if(!cover.alt_text?.trim())issues.push('Describe the cover for screen readers');if(!cover.pixel_width||cover.pixel_width*9!==cover.pixel_height*16)issues.push('Use a verified 16:9 cover');}return issues;
}
export const canDeleteDraft=story=>!!story?.id&&story.status==='draft'&&!story.slug_locked&&!story.published_at&&!story.scheduled_at;
export const canArchiveStory=story=>!!story?.id&&story.source_kind!=='file'&&['draft','published'].includes(story.status);
export const canRestoreStory=story=>!!story?.id&&story.status==='archived'&&!!story.author_archived_at;
export const canDeleteArchivedStory=canRestoreStory;
export class StudioAccessError extends Error{constructor(message,reason='access-revoked'){super(message);this.reason=reason;}}
export class StudioConflictError extends Error{}
export function createStudioService(client,{ownerId,checkAccount=loadProfileAccount}={}){
 let genreCatalog=GENRES;
 if(!isPublicId(ownerId))throw new Error('A verified account is required.');
 async function authorize(){let account;try{account=await checkAccount(client);}catch{throw new Error('Your account could not be verified. Check your connection and try again. Your unsaved words remain here.');}if(account.user.id!==ownerId)throw new StudioAccessError('Your account changed. Reopen Studio to continue.','owner-changed');if(account.state!=='active')throw new StudioAccessError('Account removal is in progress.','account-closed');if(!account.contributor)throw new StudioAccessError('Your contributor access changed. Saved work is available through your account download.');return account;}
 const fail=e=>{if(e?.code==='23505')throw new Error('This address is already in use. Save again to generate another.');if(e?.code==='P0001'&&/Publication requires|future publication|genres|timezone/.test(e.message))throw new Error(e.message);throw new Error('The save failed. Check your connection and current account agreements. Your unsaved words remain here.');};
 return {authorize,
  async seriesOptions(previous,cursor=null){await authorize();const r=await client.rpc('fas_series_editor',{content_key:previous.id,source_key:previous.source_kind==='file'?'file':'studio',page_after:cursor});if(r.error||!Array.isArray(r.data?.items))throw Error('Series choices could not load. Check your access and reload the details.');return r.data;},
  async saveSeries(previous,input,version){await authorize();const r=await client.rpc('fas_save_content_series',{content_key:previous.id,source_key:previous.source_kind==='file'?'file':'studio',...input,expected_version:version});if(r.error)throw Error(['P0001','P0002'].includes(r.error.code)?r.error.message:'Series details could not be saved. Check your access and try again.');if(!r.data||typeof r.data!=='object')throw Error('The series update was not confirmed. Reload its details.');return r.data;},
  async history(previous,revisionId=null){await authorize();if(!isPublicId(previous?.id)||revisionId!==null&&!isPublicId(revisionId))throw Error('Reopen this content first.');const r=await client.rpc('fas_content_history',{content_key:previous.id,source_key:previous.source_kind==='file'?'file':'studio',revision_key:revisionId});if(r.error)throw Error('Version history could not be loaded. Check your access and try again.');return r.data;},
  async restoreRevision(previous,revisionId){
   if(previous.source_kind==='file'){await authorize();const r=await client.rpc('fas_restore_file_revision',{content_key:previous.id,revision_key:revisionId,expected_version:previous.updated_at});if(r.error||r.data?.id!==previous.id)throw new StudioConflictError('This content changed or could not be restored. Reopen it before trying again.');return r.data;}
   const revision=await this.history(previous,revisionId),snapshot=revision.snapshot;if(!snapshot)throw Error('This version is unavailable.');
   const values=Object.fromEntries(allowed.filter(k=>k!=='slug').map(k=>[k,previous[k]]));Object.assign(values,snapshot);
   // Current save contracts protect progress already saved by players. Source code
   // is recovered; authors must adapt it to the current contract before publishing.
   if(values.executable_package&&previous.executable_package&&JSON.stringify(values.executable_package.settings)!==JSON.stringify(previous.executable_package.settings))throw Error('This version uses different account-save or multiplayer settings. Download its files, adapt them to the current settings, then upload and preview them.');
   return this.save(values,previous,previous.status);
  },
  async catalogs(){await authorize();const results=await Promise.all([client.from('studio_content_types').select('*').order('id'),client.from('content_warnings').select('id,label,active').order('label'),client.from('content_genres').select('id,label,parent_label').order('label'),client.rpc('fas_my_publishing_options')]);if(results.some(r=>r.error))throw new Error('Content requirements could not be loaded. Reload before publishing.');genreCatalog=results[2].data;return {types:results[0].data,warnings:results[1].data,genres:genreCatalog,publishing:results[3].data};},
  async list({search='',type='',state='',cursor=null,scope='own'}={}){await authorize();const r=await client.rpc('fas_studio_library',{library_scope:scope,search_text:search,type_filter:type,state_filter:state,before_time:cursor?.updated_at??null,after_id:cursor?.id??null});if(r.error)throw new Error('Your work could not be loaded. Try again.');return r.data;},
  async readFilePlayer(fileKey){await authorize();if(!isPublicId(fileKey))throw Error('Content unavailable.');const r=await client.rpc('fas_my_file_player',{file_key:fileKey});if(r.error||r.data?.id!==fileKey)throw new StudioConflictError('This player could not be loaded. Reopen it from Your work.');return r.data;},
  async saveFilePlayer(previous,value,identity){await authorize();const r=await client.rpc('fas_save_file_player',{file_key:previous.id,expected_version:previous.updated_at,player_package:validatePackage(value),identity_key:identity});if(r.error||r.data?.id!==previous.id)throw new StudioConflictError(r.error?.code==='P0002'?'This content changed elsewhere. Download your files, then reopen it.':'Files could not be saved. Check your current access and upload this page’s working project.');return r.data;},
  async updateFilePublishing(previous,identity){await authorize();if(!isPublicId(previous?.id)||!previous.updated_at||!['personal','fas'].includes(identity))throw new Error('Reopen this content before saving.');const r=await client.rpc('fas_update_file_publishing',{content_key:previous.id,expected_version:previous.updated_at,identity_key:identity});if(r.error||r.data?.id!==previous.id)throw new StudioConflictError('This content changed or could not be saved. Reopen it from Your work before trying again.');return r.data;},
  async requestWarning(label,reason){await authorize();const r=await client.rpc('fas_request_content_warning',{requested_label:label,request_reason:reason});if(r.error)throw new Error('Request could not be added. Check the details; you can have up to five pending requests.');return r.data;},
  async warningRequests(){await authorize();const r=await client.rpc('fas_my_warning_requests');if(r.error)throw new Error('Requests could not be loaded.');return r.data;},
  async read(id){if(!isPublicId(id))throw new Error('Content unavailable.');const account=await authorize();let query=client.from('stories').select(STORY_FIELDS).eq('id',id);query=account.admin?query.or('author_id.eq.'+ownerId+',publishing_identity.eq.fas'):query.eq('author_id',ownerId);const r=await query.single();if(r.error||!r.data)throw new StudioConflictError('This content is unavailable. Reopen it from your work.');const a=await client.from('story_assets').select('id,alt_text,verified_at,pixel_width,pixel_height').eq('story_id',id).order('created_at');if(a.error)throw new Error('Cover choices could not be loaded. Try opening this content again.');return {story:r.data,assets:a.data};},
  async save(input,previous,status=previous?.status??'draft'){
   const changes=validateStory(input,genreCatalog);if(!['draft','published'].includes(status)||previous?.status==='archived')throw new Error('This archived content is locked. Restore your own archive before editing; moderation locks require an administrator.');if(status==='published'&&!isInteractive(changes.content_type)&&!changes.body.replace(/\*\*\*/g,'').trim())throw new Error('Write your manuscript before publishing.');const account=await authorize();if(changes.content_type==='tool'&&!account.admin)throw new StudioAccessError('Tools can only be uploaded by an administrator.');let q;
   if(previous){if(!isPublicId(previous.id)||!previous.updated_at)throw new Error('Reopen this content before saving.');if(previous.author_id&&previous.author_id!==ownerId&&(!account.admin||previous.publishing_identity!=='fas'||changes.publishing_identity!=='fas'))throw new StudioAccessError('Only shared FAS content can be edited for another account.');q=client.from('stories').update({...changes,status}).eq('author_id',previous.author_id??ownerId).eq('id',previous.id).eq('updated_at',previous.updated_at);}
   else{if(status!=='draft'||changes.cover_asset_id||changes.scheduled_at)throw new Error('Save a draft before choosing its cover or publishing.');const {cover_asset_id,...draft}=changes;q=client.from('stories').insert({...draft,author_id:ownerId});}
   const r=await q.select(STORY_FIELDS).maybeSingle();if(r.error)fail(r.error);if(!r.data)throw new StudioConflictError('This content changed elsewhere or is locked. Download your text, then reopen it.');return r.data;
  },
  async lifecycle(previous,action,confirmationTitle=null){
   const permitted=action==='archive'?canArchiveStory(previous):action==='restore'?canRestoreStory(previous):action==='delete'?canDeleteArchivedStory(previous):false;
   if(!permitted||!isPublicId(previous.id)||!previous.updated_at)throw new Error('Reopen eligible content before changing its lifecycle.');
   if(['archive','delete'].includes(action)&&confirmationTitle!==previous.title)throw new Error('Confirm the current title.');
   await authorize();const r=await client.rpc('fas_story_lifecycle',{target_story:previous.id,expected_version:previous.updated_at,action,confirmation_title:confirmationTitle});
   if(r.error?.code==='P0002')throw new StudioConflictError('This content changed elsewhere or is unavailable. Reopen it from Your work.');
   if(r.error)throw new Error('The action could not finish. Reopen this content and check your current access before trying again.');
   if(r.data?.id!==previous.id||(action==='delete'?r.data.deleted!==true:action==='archive'?r.data.status!=='archived'||!r.data.author_archived_at:r.data.status!=='draft'||r.data.author_archived_at))throw new StudioConflictError('The action was not confirmed. Reopen this content from Your work.');
   return r.data;
  },
  async deleteDraft(previous){
   if(!canDeleteDraft(previous)||!isPublicId(previous.id)||!previous.updated_at)throw new Error('Only saved, never-published drafts can be deleted here. Cancel any schedule first.');
   await authorize();const r=await client.from('stories').delete().eq('author_id',previous.author_id??ownerId).eq('id',previous.id).eq('updated_at',previous.updated_at).eq('status','draft').eq('slug_locked',false).is('published_at',null).is('scheduled_at',null).select('id').maybeSingle();
   if(r.error)throw new Error('The draft could not be deleted. Reopen it from Your work before trying again.');
   if(r.data?.id!==previous.id)throw new StudioConflictError('This draft changed elsewhere, was scheduled or published, or is no longer available. Reopen it from Your work before deleting.');
  },
  async uploadCover(id,file,alt,crop){await authorize();if(!isPublicId(id)||!file||file.size>5*1024*1024||!['image/jpeg','image/png'].includes(file.type)||!alt.trim()||[...alt].length>500)throw new Error('Choose a JPEG or PNG up to 5 MiB and describe the image.');const body=new FormData();body.set('story_id',id);body.set('image',file);body.set('alt',alt.trim());body.set('focus_x',String(crop.x));body.set('focus_y',String(crop.y));const r=await client.functions.invoke('fas-studio-cover',{body});if(r.error||!r.data?.asset)throw new Error('Cover upload could not finish. Try again. Existing covers are unchanged.');return r.data.asset;},
  async changeCover(previous,assetId,alt,remove=false){
   await authorize();if(!isPublicId(previous?.id)||!isPublicId(assetId)||!previous.updated_at)throw new Error('Reopen this content before managing covers.');
   const r=await client.rpc('fas_change_cover_image',{target_story:previous.id,asset_key:assetId,expected_version:previous.updated_at,image_alt:alt,remove_image:remove});
   if(r.error?.code==='P0002')throw new StudioConflictError('This content changed elsewhere. Reopen it before managing covers.');
   if(r.error)throw new Error(remove?'This cover could not be removed. Choose and save another cover (or clear an unscheduled draft’s cover) before removing the selected image.':'The description could not be saved. Check your access and description.');
   if(r.data?.id!==previous.id)throw new StudioConflictError('The image change was not confirmed. Reopen your content.');return r.data;
  },
  async traffic(pageId=null,days=30){await authorize();const [r,a]=await Promise.all([client.rpc('fas_my_studio_traffic',{page_key:pageId,period_days:days}),client.rpc('fas_my_studio_acknowledgements',{page_key:pageId})]);if(r.error||a.error)throw new Error('Insights could not be loaded. Try again.');return {...r.data,acknowledgements:a.data};},
 };
}
