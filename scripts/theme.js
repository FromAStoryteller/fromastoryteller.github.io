/* Load synchronously in <head>, before the stylesheet, to apply the theme
   before first paint. This is intentionally independent of the unfinished
   automatic/time-of-day theme. Works with dynamically inserted header buttons. */
(() => {
  'use strict';
  const key = 'from-a-storyteller-theme';
  // Re-enable only when Auto is ready. Its OS resolver and distinct icon stay here.
  const AUTO_MODE_ENABLED = false;
  const modes = AUTO_MODE_ENABLED ? ['auto', 'light', 'dark'] : ['light', 'dark'];
  const icons = {
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    dark: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
    auto: '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8m-4-4v4M8 13l4-7 4 7m-6.5-2h5"/>'
  };
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try { const saved = localStorage.getItem(key); if (saved === 'light' || saved === 'dark' || saved === 'auto') preference = saved; } catch (_) {}
  const effective = () => preference && preference !== 'auto' ? preference : (system.matches ? 'dark' : 'light');
  function save() {
    try { localStorage.setItem(key, preference); } catch (_) { /* Remain usable when storage is blocked. */ }
  }
  function normalise() {
    if (!AUTO_MODE_ENABLED && (!preference || preference === 'auto')) {
      // Capture the existing OS-resolved appearance before retiring Auto.
      preference = effective();
      save();
    }
  }
  const nextMode = () => modes[(modes.indexOf(preference || 'auto') + 1) % modes.length];
  function syncButtons() {
    const current = preference || 'auto';
    const next = nextMode();
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.hidden = false;
      button.removeAttribute('aria-pressed');
      button.setAttribute('aria-label', `Theme: ${current}. Switch to ${next} mode`);
      button.title = `Theme: ${current}. Switch to ${next} mode`;
      button.dataset.themeState = current;
      const icon = button.querySelector('.theme-toggle__icon');
      if (icon && icon.dataset.state !== current) {
        icon.innerHTML = icons[current];
        icon.dataset.state = current;
      }
      const label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = current;
    });
  }
  function apply() { normalise(); root.dataset.theme = effective(); syncButtons(); }
  apply();
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
    preference = nextMode();
    save();
    apply();
  });
  system.addEventListener('change', () => { if (!preference || preference === 'auto') apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = event.newValue === 'light' || event.newValue === 'dark' || event.newValue === 'auto' ? event.newValue : null;
    apply();
  });
  function ready() {
    syncButtons();
    new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches('[data-theme-toggle]') || node.querySelector('[data-theme-toggle]'))))) syncButtons();
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true }); else ready();
})();
