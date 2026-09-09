/* Load synchronously in <head>, before the stylesheet, to apply the theme
   before first paint. This is intentionally independent of the unfinished
   automatic/time-of-day theme. Works with dynamically inserted header buttons. */
(() => {
  'use strict';
  const key = 'from-a-storyteller-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try { const saved = localStorage.getItem(key); if (saved === 'light' || saved === 'dark') preference = saved; } catch (_) {}
  const effective = () => preference || (system.matches ? 'dark' : 'light');
  function syncButtons() {
    const dark = effective() === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', 'Dark mode');
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
      const label = button.querySelector('[data-theme-label]');
      if (label && label.textContent !== (dark ? 'Dark' : 'Light')) label.textContent = dark ? 'Dark' : 'Light';
    });
  }
  function apply() { root.dataset.theme = effective(); syncButtons(); }
  apply();
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
    preference = effective() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(key, preference); } catch (_) { /* Works for this visit even when storage is blocked. */ }
    apply();
  });
  system.addEventListener('change', () => { if (!preference) apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : null;
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
