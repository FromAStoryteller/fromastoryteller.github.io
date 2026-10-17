import { storySlug, StudioAccessError, StudioConflictError } from './studio-service.mjs';
import { publicCoverUrl } from './profiles.mjs';

const emptyStory = () => ({title:'',slug:'',summary:'',body:'',genre:'',tags:[],content_warning:'',cover_asset_id:null});
const label = status => ({draft:'Private draft',published:'Published',archived:'Locked by moderation',submitted:'Private · previously submitted',rejected:'Private · returned'})[status] || 'New private draft';

export function mountStudio(root, service, { authorName = 'Storyteller', imageBase, auth, onAccessLost = () => {} } = {}) {
  const d = root.ownerDocument;
  let current = null, assets = [], disposed = false, busy = false, conflicted = false;
  let lastSaved = '', timer, offset = 0, imageUrl, coverRequest = 0, listBusy = false, reloadList = false;
  root.innerHTML = `<header class="studio-heading"><div><p class="profile-eyebrow">A place for your words</p><h1>Story Studio</h1><p>Some stories begin with a whisper. Make room for yours.</p></div><button type="button" class="account-secondary" data-new>New story <span aria-hidden="true">+</span></button></header>
    <div class="studio-workspace"><aside class="studio-library" aria-labelledby="library-title"><div class="studio-library-heading"><h2 id="library-title">Your stories</h2><button type="button" class="studio-text-button" data-refresh>Refresh</button></div><p class="profile-muted">Your drafts stay private until you publish.</p><p role="status" data-library-status></p><ul data-library class="studio-story-list"></ul><button type="button" class="account-secondary" data-more hidden>More stories</button></aside>
    <section class="studio-desk" aria-labelledby="editor-title"><div class="studio-desk-heading"><h2 id="editor-title">A new beginning</h2><span class="studio-state" data-state>New private draft</span></div>
      <form class="account-form studio-form"><fieldset><legend class="visually-hidden">Story text and details</legend>
        <div class="account-field"><label for="studio-title">Title</label><input id="studio-title" name="title" required maxlength="200" placeholder="Give your story a name" autocomplete="off"></div>
        <div class="studio-body-heading"><label for="studio-body">Your story</label><span class="profile-muted" data-count>0 words</span></div>
        <p class="profile-muted" id="studio-body-help">Write in plain text. Blank lines separate paragraphs.</p><textarea id="studio-body" class="studio-body" name="body" rows="18" maxlength="200000" aria-describedby="studio-body-help" placeholder="It began…"></textarea>
        <details class="studio-details" open><summary>Story details</summary><div class="studio-metadata">
          <div class="account-field studio-full"><label for="studio-summary">Description / tagline <span class="studio-optional">(optional)</span></label><textarea id="studio-summary" name="summary" rows="3" maxlength="1000" placeholder="A few words to draw a reader in"></textarea></div>
          <div class="account-field"><label for="studio-genre">Genre <span class="studio-optional">(optional)</span></label><input id="studio-genre" name="genre" maxlength="80" placeholder="e.g. Fantasy" list="studio-genres"><datalist id="studio-genres"><option>Fantasy</option><option>Science fiction</option><option>Mystery</option><option>Horror</option><option>Romance</option><option>Literary fiction</option></datalist></div>
          <div class="account-field"><label for="studio-tags">Tags <span class="studio-optional">(optional)</span></label><input id="studio-tags" name="tags" aria-describedby="studio-tags-help" placeholder="e.g. folklore, discovery"><p class="profile-muted" id="studio-tags-help">Separate with commas. Up to 12 tags, 40 characters each.</p></div>
          <div class="account-field studio-full"><label for="studio-warning">Content warning <span class="studio-optional">(optional)</span></label><textarea id="studio-warning" name="content_warning" rows="2" maxlength="1000" placeholder="Anything readers should know before starting"></textarea></div>
          <div class="account-field studio-full"><label for="studio-slug">Story address</label><input id="studio-slug" name="slug" required maxlength="120" pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="studio-slug-help"><p class="profile-muted" id="studio-slug-help">Lowercase letters, numbers and hyphens. Changing a published address breaks its previous link.</p></div>
        </div></details>
        <details class="studio-details"><summary>Cover image <span class="studio-optional">(optional)</span></summary><div class="studio-cover-layout"><div><label for="studio-cover">Choose from this story’s images</label><select id="studio-cover" name="cover_asset_id"><option value="">No cover image</option></select><p class="profile-muted" data-cover-help>Save a draft to see its cover choices. Image uploading is being built separately.</p><p class="profile-muted" data-cover-state></p></div><figure class="studio-cover"><img data-cover-image alt="" hidden><figcaption data-cover-caption>No cover selected</figcaption></figure></div></details>
      </fieldset><div class="studio-actions"><button type="submit" class="account-submit" data-save>Save draft</button><button type="button" class="account-secondary" data-preview>Preview</button><button type="button" class="account-secondary" data-publish>Publish story</button><button type="button" class="studio-text-button" data-unpublish hidden>Unpublish</button></div>
      <div class="studio-save-note"><p class="studio-status" role="status" aria-live="polite" data-status>Nothing saved yet. Drafts autosave after you add a title.</p><button type="button" class="studio-text-button" data-download>Download text</button></div>
      <p class="profile-muted" data-save-help>Draft changes autosave after a short pause. Published changes go live when you save.</p>
    </form></section></div>
    <dialog class="studio-preview" aria-labelledby="studio-preview-title"><div class="studio-preview-controls"><p class="profile-eyebrow">Private preview · unsaved changes included</p><button type="button" class="account-secondary" data-close>Back to editing</button></div><article class="community-reading" data-preview-story></article></dialog>`;
  const $ = selector => root.querySelector(selector);
  const form = $('form'), fieldset = $('fieldset'), status = $('[data-status]'), library = $('[data-library]');
  const names = ['title','slug','summary','body','genre','tags','content_warning','cover_asset_id'];
  const field = name => form.elements.namedItem(name);
  const values = () => Object.fromEntries(names.map(name=>[name,field(name).value]));
  const signature = () => JSON.stringify(values());
  const dirty = () => signature() !== lastSaved;
  const tell = (message, error = false) => { status.textContent = message; status.dataset.error = String(error); };
  function revokeImage() { coverRequest++; if (imageUrl) URL.revokeObjectURL(imageUrl); imageUrl = null; $('[data-cover-image]').removeAttribute('src'); $('[data-cover-image]').hidden = true; }
  function updateState() {
    const locked = current?.status === 'archived';
    fieldset.disabled = locked;
    $('[data-state]').textContent = label(current?.status);
    $('[data-state]').dataset.published = String(current?.status === 'published');
    $('[data-save]').textContent = current?.status === 'published' ? 'Save live changes' : 'Save draft';
    $('[data-publish]').hidden = current?.status === 'published' || locked;
    $('[data-unpublish]').hidden = current?.status !== 'published';
    for (const key of ['save','publish','unpublish','new','refresh','more']) $('[data-'+key+']').disabled = busy || (['refresh','more'].includes(key) && listBusy) || (['save','publish','unpublish'].includes(key) && (locked || conflicted));
    for (const button of library.querySelectorAll('button')) { button.disabled = busy; button.setAttribute('aria-pressed',String(button.dataset.storyId===current?.id)); }
    $('[data-save-help]').textContent = locked ? 'This story is locked by moderation. You can preview and download your text.' : current?.status === 'published' ? 'Your story is public. Saving changes updates it immediately. Live changes do not autosave.' : 'Draft changes autosave after a short pause. Preview does not publish your story.';
  }
  function fill(story = emptyStory(), choices = []) {
    clearTimeout(timer); conflicted = false; current = story.id ? story : null; assets = choices;
    for (const name of names) field(name).value = name === 'tags' ? (story.tags ?? []).join(', ') : story[name] ?? '';
    const select = field('cover_asset_id');select.replaceChildren(new Option('No cover image',''));
    for (const asset of assets) select.append(new Option(`${asset.alt_text}${asset.approved_at ? '' : ' (private image)'}`,asset.id));
    select.value = story.cover_asset_id ?? '';
    $('[data-cover-help]').textContent = assets.length ? 'Only images registered to this story are available here. Images stay private until cleared for public delivery.' : 'No images are attached to this story yet. You can publish without a cover. Image uploading is being built separately.';
    $('[data-count]').textContent = wordCount(field('body').value);
    $('#editor-title').textContent = story.id ? 'Your writing desk' : 'A new beginning';
    lastSaved = signature();updateState();void showCover();
    tell(story.id ? (story.status === 'archived' ? 'Locked by moderation. Your text is available to download.' : `Saved ${new Date(story.updated_at).toLocaleString()}.`) : 'Nothing saved yet. Drafts autosave after you add a title.');
  }
  async function showCover() {
    revokeImage();const request = coverRequest;
    const asset = assets.find(item=>item.id === field('cover_asset_id').value);
    $('[data-cover-caption]').textContent = asset?.alt_text || 'No cover selected';
    $('[data-cover-state]').textContent = asset && !asset.approved_at ? 'Selected for this story. This image remains private until cleared for public delivery.' : '';
    if (!asset || !imageBase) return;
    const url = publicCoverUrl({asset_id:asset.id},imageBase);
    if (!url) return;
    try {
      const session = await auth?.getSession();
      const token = session?.data?.session?.access_token;
      const response = await fetch(url,{cache:'no-store',redirect:'error',headers:token?{Authorization:`Bearer ${token}`}:{}});
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (disposed || request !== coverRequest) return;
      if (!['image/jpeg','image/png','image/webp'].includes(blob.type)) throw new Error();
      imageUrl = URL.createObjectURL(blob);const img=$('[data-cover-image]');img.src=imageUrl;img.alt=asset.alt_text;img.hidden=false;
    } catch { if (!disposed && request === coverRequest) $('[data-cover-caption]').textContent = 'Image preview unavailable. The cover choice is retained.'; }
  }
  const leave = () => !dirty() || d.defaultView.confirm('You have unsaved changes. Leave this story? Download your text first if you want to keep it.');
  function handleError(error) {
    if (disposed) return;
    if (error instanceof StudioAccessError) { onAccessLost(error.message); return; }
    if (error instanceof StudioConflictError) conflicted = true;
    tell(error.message || 'Something went wrong. Your unsaved text is still here.',true);
  }
  async function loadList(append = false) {
    if(listBusy){if(!append)reloadList=true;return;}
    listBusy=true;updateState();
    try {
      const rows = await service.list(append ? offset : 0);
      if (disposed) return;
      if (!append) { library.replaceChildren(); offset=0; }
      for (const row of rows) {
        const li=d.createElement('li'),button=d.createElement('button'),title=d.createElement('span'),state=d.createElement('span');
        button.type='button';button.className='studio-story';button.dataset.storyId=row.id;
        title.textContent=row.title;state.textContent=label(row.status);state.className='profile-muted';button.append(title,state);
        button.setAttribute('aria-pressed',String(row.id===current?.id));
        button.addEventListener('click',async()=>{
          if (busy || !leave()) return;
          clearTimeout(timer);busy=true;updateState();
          try { const result=await service.read(row.id);if(!disposed){fill(result.story,result.assets);field('title').focus();} }catch(error){handleError(error);}finally{busy=false;if(!disposed)updateState();}
        });li.append(button);library.append(li);
      }
      offset+=rows.length;$('[data-more]').hidden=rows.length<20;
      $('[data-library-status]').textContent=library.children.length?'':'A quiet shelf, waiting for its first story.';
    } catch(error){if(error instanceof StudioAccessError)handleError(error);else if(!disposed)$('[data-library-status]').textContent=error.message;}
    finally{listBusy=false;if(!disposed){updateState();if(reloadList){reloadList=false;void loadList();}}}
  }
  async function save(target, automatic = false) {
    clearTimeout(timer);
    if (disposed || busy || conflicted || current?.status==='archived') return;
    if (automatic && (!dirty() || !field('title').value.trim() || current?.status==='published')) return;
    if (!automatic && !form.reportValidity()) return;
    const submitted=values(),stamp=signature();let succeeded=false;busy=true;updateState();tell('Saving your story…');
    try {
      const saved=await service.save(submitted,current,target ?? (current?.status==='published'?'published':'draft'));
      if(disposed)return;
      current=saved;lastSaved=stamp;succeeded=true;
      tell(dirty()?'Saved earlier changes. Your latest words are still unsaved.':saved.status==='published'?'Your story is published. Saved changes are live.':'Draft saved. Only you and site administrators can access it.');
      void loadList();
    }catch(error){handleError(error);}finally{busy=false;if(!disposed){updateState();if(dirty()&&succeeded&&!conflicted)schedule();}}
  }
  function schedule() {clearTimeout(timer);if(current?.status!=='published'&&current?.status!=='archived'&&!conflicted)timer=setTimeout(()=>void save(undefined,true),1800);}
  form.addEventListener('input',event=>{
    if(event.target===field('title')&&!current&&(!field('slug').value||field('slug').dataset.generated==='true')){field('slug').value=storySlug(field('title').value);field('slug').dataset.generated='true';}
    if(event.target===field('slug'))field('slug').dataset.generated='false';
    $('[data-count]').textContent=wordCount(field('body').value);tell(current?.status==='published'?'Unsaved live changes. Save when you are ready.':'Unsaved changes.');schedule();
  });
  field('cover_asset_id').addEventListener('change',()=>void showCover());
  form.addEventListener('submit',event=>{event.preventDefault();void save();});
  form.addEventListener('invalid',event=>{const details=event.target.closest('details');if(details)details.open=true;},true);
  $('[data-publish]').addEventListener('click',async()=>{
    if(busy||!form.reportValidity())return;
    if(!field('body').value.trim()){tell('Add your story text before publishing.',true);field('body').focus();return;}
    clearTimeout(timer);
    if(!current){await save('draft');if(!current||disposed)return;}
    if(d.defaultView.confirm('Publish this story for everyone to read? Your title, text and story details will become public.'))void save('published');
  });
  $('[data-unpublish]').addEventListener('click',()=>{if(d.defaultView.confirm('Unpublish this story? It will become a private draft. Your current editor changes will be saved with it.'))void save('draft');});
  $('[data-new]').addEventListener('click',()=>{if(!busy&&leave()){fill();field('slug').dataset.generated='true';void loadList();field('title').focus();}});
  $('[data-refresh]').addEventListener('click',()=>void loadList());
  $('[data-more]').addEventListener('click',()=>void loadList(true));
  $('[data-download]').addEventListener('click',()=>downloadStory(d,values()));
  const dialog=$('dialog');
  $('[data-preview]').addEventListener('click',()=>{
    const article=$('[data-preview-story]');article.replaceChildren();
    const add=(tag,value,cls)=>{const n=d.createElement(tag);n.textContent=value;if(cls)n.className=cls;article.append(n);return n;};
    const title=add('h2',field('title').value||'Untitled story');title.id='studio-preview-title';add('p',`By ${authorName}`,'profile-muted');
    if(field('summary').value)add('p',field('summary').value,'studio-preview-summary');
    const meta=[field('genre').value,field('tags').value].filter(Boolean).join(' · ');if(meta)add('p',meta,'profile-muted');
    if(field('content_warning').value)add('p',`Content warning: ${field('content_warning').value}`,'studio-warning');
    if(imageUrl){const img=d.createElement('img');img.src=imageUrl;img.alt=assets.find(a=>a.id===field('cover_asset_id').value)?.alt_text||'';img.className='studio-preview-cover';article.append(img);}
    add('div',field('body').value||'Your story will appear here.','community-prose');dialog.showModal();
  });
  $('[data-close]').addEventListener('click',()=>dialog.close());
  const unload=event=>{if(!disposed&&(dirty()||busy)){event.preventDefault();event.returnValue='';}};
  d.defaultView.addEventListener('beforeunload',unload);
  fill();void loadList();
  // Recheck roles even while idle. Saved drafts/cover bytes are removed from the
  // screen if access is withdrawn; account export remains a separate feature.
  const accessTimer=setInterval(()=>{if(d.visibilityState==='visible')void service.authorize().catch(handleError);},30000);
  const visible=()=>{if(d.visibilityState==='visible')void service.authorize().catch(handleError);};d.addEventListener('visibilitychange',visible);
  const dispose=()=>{disposed=true;clearTimeout(timer);clearInterval(accessTimer);revokeImage();if(dialog.open)dialog.close();d.defaultView.removeEventListener('beforeunload',unload);d.removeEventListener('visibilitychange',visible);root.replaceChildren();};
  dispose.canLeave=()=>{if(busy){tell('Please wait for your save to finish before signing out.');return false;}return leave();};
  return dispose;
}

export function wordCount(body) {const count=body.trim()?body.trim().split(/\s+/u).length:0;return `${count.toLocaleString()} ${count===1?'word':'words'}`;}
export function downloadStory(d,story) {
  const text=[story.title||'Untitled story',story.summary,story.genre?`Genre: ${story.genre}`:'',story.tags?`Tags: ${story.tags}`:'',story.content_warning?`Content warning: ${story.content_warning}`:'','',story.body].filter(value=>value!==undefined).join('\n\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=d.createElement('a');a.href=url;a.download=`${storySlug(story.title||'story')}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
