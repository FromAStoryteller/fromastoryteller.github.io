import {mountProfileImage} from './profile-image-editor.mjs';
import { createProfileService } from './profiles.mjs';
import { accountNavigation } from './account-navigation.mjs';
import {mountSocialEditor} from './social-editor.mjs';
import {renderSocialLinks} from './manuscript.mjs';

export function mountProfileEditor(root, client, { contributor = false, viewer = !contributor, initialProfile, ownerId, imageBase, imageService, admin = false } = {}) {
  const service = createProfileService(client, { expectedOwnerId: ownerId });
  let disposed = false;
  let busy = false;
  root.innerHTML = `<nav class="account-navigation" aria-label="Your profile and account"><a class="account-secondary" href="/account/profile/" aria-current="page">Edit my profile</a><a class="account-secondary" href="/account/settings/">Account settings</a></nav><div class="profile-workspace${viewer ? ' profile-workspace--viewer' : ''}">
    <aside class="profile-intro"><p class="profile-eyebrow">Your own small corner</p><h1>Make yourself <br>at home.</h1><p>The name, words and little welcome that make this space yours.</p></aside>
    <section class="profile-form-panel" aria-labelledby="profile-title">
      <h2 id="profile-title">My corner</h2><p class="profile-muted" data-visibility></p>
      <section class="profile-image-editor account-form" data-profile-image></section><form class="profile-editor account-form"><fieldset disabled><legend class="visually-hidden">Your profile</legend>
        <div class="account-field"><label for="profile-display-name">Display name</label><input id="profile-display-name" name="display_name" required autocomplete="nickname" aria-describedby="profile-name-help"><p id="profile-name-help" class="password-guidance">Your name or pen name. Up to 80 characters.</p></div>
        ${viewer ? '' : `<div class="account-field"><label for="profile-welcome">A line to welcome readers</label><input id="profile-welcome" name="welcome_line" aria-describedby="profile-welcome-help"><p id="profile-welcome-help" class="password-guidance">Optional. A small hello, in up to 160 characters.</p></div>
        <div class="account-field"><label for="profile-bio">About me</label><textarea id="profile-bio" name="bio" rows="5" aria-describedby="profile-bio-help"></textarea><p id="profile-bio-help" class="password-guidance">Optional. Up to 1,000 characters. Leave private contact details out.</p></div>`}
        ${viewer?'':'<section data-social-editor></section>'}<button class="account-submit" type="submit">Save profile</button>
      </fieldset><p class="profile-status" role="status" aria-live="polite" data-status>Loading your profile…</p></form>
    </section>
    ${viewer ? '' : `<aside class="profile-preview" aria-labelledby="preview-title"><p class="profile-eyebrow" id="preview-title">A glimpse for your readers</p><div class="profile-monogram" aria-hidden="true" data-monogram>—</div><h2 data-preview-name>Your name</h2><p class="profile-welcome" data-preview-welcome></p><p class="profile-bio" data-preview-bio></p><p class="profile-muted" data-preview-note>Preview of your profile text.</p></aside>`}
  </div>`;
  const form = root.querySelector('form');
  const fieldset = form.querySelector('fieldset');
  const status = root.querySelector('[data-status]');
  const name = form.elements.namedItem('display_name');
  const bio = form.elements.namedItem('bio');
  const welcome = form.elements.namedItem('welcome_line');
  const socials=viewer?null:mountSocialEditor(root.querySelector('[data-social-editor]'));
  let savedSocials=[],savedSignature=null;
  const w=root.ownerDocument.defaultView;
  const signature=()=>JSON.stringify({name:name.value.trim(),bio:bio?.value.trim()??'',welcome:welcome?.value.trim()??'',socials:socials?.value()??[]});
  const dirty=()=>{try{return (savedSignature!==null&&signature()!==savedSignature)||disposeImage.dirty();}catch{return true;}};
  const beforeSignOut=()=>{if(busy||disposeImage.pending()){status.textContent='Wait for your profile to finish saving before signing out.';return false;}return !dirty()||w.confirm('Sign out and discard your unsaved profile changes?');};
  const unload=event=>{if(!disposed&&(busy||disposeImage.pending()||dirty())){event.preventDefault();event.returnValue='';}};
  w.addEventListener('beforeunload',unload);
  if (!viewer) root.querySelector('#preview-title').textContent = contributor ? 'A glimpse for your readers' : 'Your profile preview';
  else root.querySelector('.profile-intro > p:not(.profile-eyebrow)').textContent = 'Choose the name you will use around the site.';
  root.querySelector('[data-visibility]').textContent = contributor
    ? 'These words are public on your storyteller page. Your email and account settings stay private.'
    : viewer ? 'Your display name identifies you around the site. Your email and account details stay private.' : 'Your profile is private until you publish work. Your email and account settings stay private.';
  const preview = () => {
    if (viewer) return;
    root.querySelector('[data-preview-name]').textContent = name.value.trim() || 'Your name';
    root.querySelector('[data-preview-welcome]').textContent = welcome.value.trim();
    root.querySelector('[data-preview-bio]').textContent = bio.value.trim();
    root.querySelector('[data-monogram]').textContent = initials(name.value);
    let socialPreview=root.querySelector('[data-social-preview]');if(!socialPreview){socialPreview=root.ownerDocument.createElement('nav');socialPreview.className='storyteller-socials';socialPreview.setAttribute('data-social-preview','');root.querySelector('.profile-preview').append(socialPreview);}try{renderSocialLinks(socialPreview,socials?.value()??savedSocials);}catch{renderSocialLinks(socialPreview,[]);}
  };
  form.addEventListener('input', () => { preview(); if (!viewer) root.querySelector('[data-preview-note]').textContent = 'Unsaved preview. Save to update your profile.'; else status.textContent = 'Unsaved changes.'; });
  const disposeImage=mountProfileImage(root.querySelector('[data-profile-image]'),client,{ownerId,imageBase,contributor,getName:()=>name.value, ...(imageService?{service:imageService}:{}),onImage:image=>{
    if(viewer)return;const monogram=root.querySelector('[data-monogram]');let img=root.querySelector('[data-avatar-preview]');
    if(!image){img?.remove();monogram.hidden=false;return;}if(!img){img=root.ownerDocument.createElement('img');img.className='profile-avatar';img.setAttribute('data-avatar-preview','');monogram.after(img);}img.src=image.url;img.alt=image.alt;monogram.hidden=true;
  }});
  const dispose = () => { if(disposed)return; disposed = true; w.removeEventListener('beforeunload',unload); disposeImage(); root.replaceChildren(); };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || disposed) return;
    busy = true; fieldset.disabled = true; status.textContent = 'Saving…';
    try {
      const saved = await service.saveOwn(viewer ? { display_name: name.value } : { display_name: name.value, bio: bio.value, welcome_line: welcome.value,social_links:socials.value() });
      if (disposed) return;
      fill(saved); status.textContent = 'Your profile was saved.';
    } catch (error) { if (!disposed) { status.textContent = error.message; status.dataset.state = 'error'; } }
    finally { if (!disposed) fieldset.disabled = false; busy = false; }
  });
  function fill(profile) {
    name.value = profile.display_name;
    root.querySelector('nav').replaceWith(accountNavigation(root.ownerDocument, { current: 'profile', auth: client.auth, publicId: contributor ? profile.public_id : null, admin, beforeSignOut }));
    if (!viewer) { bio.value = profile.bio; welcome.value = profile.welcome_line; }
    savedSocials=profile.social_links??[];socials?.fill(savedSocials);
    savedSignature=signature();
    preview(); status.dataset.state = '';
    if (viewer) return;
    root.querySelector('[data-preview-note]').textContent = contributor ? 'Your saved public profile text.' : viewer ? 'Only you can see your viewer profile.' : 'Your saved private profile text.';
  }
  void (async () => { try {
    const profile = initialProfile && ownerId ? initialProfile : await service.readOwn();
    if (!disposed) { fill(profile); fieldset.disabled = false; status.textContent = ''; }
  } catch (error) { if (!disposed) status.textContent = error.message; } })();
  return dispose;
}

export function initials(name) {
  return (name.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map(part => [...part][0]).join('') || 'S').toLocaleUpperCase();
}
