/* Shared header controls and measured header height. Also supports headers refreshed by the static component generator. */
(() => {
  const buttonMarkup = '<button class="theme-toggle" type="button" data-theme-toggle aria-label="Dark mode" aria-pressed="false" hidden><svg class="theme-toggle__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/></svg><span data-theme-label aria-hidden="true">Light</span></button>';
  let observedHeader;
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) document.documentElement.style.setProperty('--story-header-height', Math.ceil(entry.target.getBoundingClientRect().height) + 'px');
  });
  function update() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const colour = document.documentElement.dataset.theme === 'dark' ? '#0D1017' : '#F4EEDF';
    if (meta && meta.content !== colour) meta.content = colour;
    const header = document.querySelector('.site-header');
    const right = header?.querySelector('.header-right');
    const sidebar = document.querySelector('.sidebar');
    if (!right || !sidebar) return;
    const socials = right.querySelector('.socials');
    if (socials) {
      let follow = sidebar.querySelector('.sidebar-follow');
      if (!follow) {
        follow = document.createElement('section'); follow.className = 'sidebar-follow';
        follow.setAttribute('aria-label', 'Follow From A Storyteller');
        follow.innerHTML = '<h2 class="sidebar-follow__title">Follow</h2>';
        sidebar.insertBefore(follow, sidebar.querySelector('.sidebar-footer-links'));
      }
      const oldSocials = follow.querySelector('.socials');
      if (oldSocials) oldSocials.remove();
      follow.append(socials);
    }
    if (!right.querySelector('[data-theme-toggle]')) right.insertAdjacentHTML('beforeend', buttonMarkup);
    if (header !== observedHeader) { resize.disconnect(); resize.observe(header); observedHeader = header; }
  }
  function start() {
    update();
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    for (const id of ['header-placeholder', 'sidebar-placeholder']) {
      const el = document.getElementById(id);
      if (el) new MutationObserver(update).observe(el, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
