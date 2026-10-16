import { createProfileService, publicProfileUrl } from './profiles.mjs';

export function mountProfileEditor(root, client, { contributor = false, viewer = true } = {}) {
  const service = createProfileService(client);
  let disposed = false;
  let busy = false;
  root.innerHTML = `<div class="profile-workspace">
    <aside class="profile-intro"><p class="profile-eyebrow">Your own small corner</p><h1>Make yourself <br>at home.</h1><p>The name, words and little welcome that make this space yours.</p><a href="/account/settings/">Account &amp; security ↗</a></aside>
    <section class="profile-form-panel" aria-labelledby="profile-title">
      <div class="profile-tabs"><span aria-current="page">About me</span><a href="/account/settings/">Account &amp; security</a></div>
      <h2 id="profile-title">My corner</h2><p class="profile-muted" data-visibility></p>
      <form class="profile-editor account-form"><fieldset disabled><legend class="visually-hidden">Your profile</legend>
        <div class="account-field"><label for="profile-display-name">Display name</label><input id="profile-display-name" name="display_name" required autocomplete="nickname" aria-describedby="profile-name-help"><p id="profile-name-help" class="password-guidance">Your name or pen name. Up to 80 characters.</p></div>
        <div class="account-field"><label for="profile-welcome">A line to welcome readers</label><input id="profile-welcome" name="welcome_line" aria-describedby="profile-welcome-help"><p id="profile-welcome-help" class="password-guidance">Optional. A small hello, in up to 160 characters.</p></div>
        <div class="account-field"><label for="profile-bio">About me</label><textarea id="profile-bio" name="bio" rows="5" aria-describedby="profile-bio-help"></textarea><p id="profile-bio-help" class="password-guidance">Optional. Up to 1,000 characters. Leave private contact details out.</p></div>
        <button class="account-submit" type="submit">Save profile</button>
      </fieldset><p class="profile-status" role="status" aria-live="polite" data-status>Loading your profile…</p></form>
    </section>
    <aside class="profile-preview" aria-labelledby="preview-title"><p class="profile-eyebrow" id="preview-title">A glimpse for your readers</p><div class="profile-monogram" aria-hidden="true" data-monogram>—</div><h2 data-preview-name>Your name</h2><p class="profile-welcome" data-preview-welcome></p><p class="profile-bio" data-preview-bio></p><p class="profile-muted" data-preview-note>Preview of your profile text.</p><a data-public-link hidden>View my public page ↗</a></aside>
  </div>`;
  const form = root.querySelector('form');
  const fieldset = root.querySelector('fieldset');
  const status = root.querySelector('[data-status]');
  const name = form.elements.namedItem('display_name');
  const bio = form.elements.namedItem('bio');
  const welcome = form.elements.namedItem('welcome_line');
  root.querySelector('#preview-title').textContent = contributor ? 'A glimpse for your readers' : 'Your profile preview';
  root.querySelector('[data-visibility]').textContent = contributor
    ? 'These words are public on your storyteller page. Your email and account settings stay private.'
    : viewer ? 'Your viewer profile is private. These words can become public if you later become a contributor.' : 'Your profile is private until you publish work. Your email and account settings stay private.';
  const preview = () => {
    root.querySelector('[data-preview-name]').textContent = name.value.trim() || 'Your name';
    root.querySelector('[data-preview-welcome]').textContent = welcome.value.trim();
    root.querySelector('[data-preview-bio]').textContent = bio.value.trim();
    root.querySelector('[data-monogram]').textContent = initials(name.value);
  };
  form.addEventListener('input', () => { preview(); root.querySelector('[data-preview-note]').textContent = 'Unsaved preview. Save to update your profile.'; });
  const dispose = () => { disposed = true; root.replaceChildren(); };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || disposed) return;
    busy = true; fieldset.disabled = true; status.textContent = 'Saving…';
    try {
      const saved = await service.saveOwn({ display_name: name.value, bio: bio.value, welcome_line: welcome.value });
      if (disposed) return;
      fill(saved); status.textContent = 'Your profile was saved.';
    } catch (error) { if (!disposed) { status.textContent = error.message; status.dataset.state = 'error'; } }
    finally { if (!disposed) fieldset.disabled = false; busy = false; }
  });
  function fill(profile) {
    name.value = profile.display_name; bio.value = profile.bio; welcome.value = profile.welcome_line;
    preview(); status.dataset.state = '';
    root.querySelector('[data-preview-note]').textContent = contributor ? 'Your saved public profile text.' : viewer ? 'Only you can see your viewer profile.' : 'Your saved private profile text.';
    const url = publicProfileUrl(profile.public_id);
    const link = root.querySelector('[data-public-link]');
    if (contributor && url) { link.href = url; link.hidden = false; }
  }
  void (async () => { try {
    const profile = await service.readOwn();
    if (!disposed) { fill(profile); fieldset.disabled = false; status.textContent = ''; }
  } catch (error) { if (!disposed) status.textContent = error.message; } })();
  return dispose;
}

export function initials(name) {
  return (name.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map(part => [...part][0]).join('') || 'S').toLocaleUpperCase();
}
