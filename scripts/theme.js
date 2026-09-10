/* Load synchronously in <head>, before the stylesheet, to apply the theme
   before first paint. This is intentionally independent of the unfinished
   automatic/time-of-day theme. Works with dynamically inserted header buttons. */
(() => {
  'use strict';
  const key = 'from-a-storyteller-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try { const saved = localStorage.getItem(key); if (saved === 'light' || saved === 'dark' || saved === 'auto') preference = saved; } catch (_) {}
  const effective = () => preference && preference !== 'auto' ? preference : (system.matches ? 'dark' : 'light');
  function syncButtons() {
    const current = preference || 'auto';
    const next = {auto: 'light', light: 'dark', dark: 'auto'}[current];
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.hidden = false;
      button.removeAttribute('aria-pressed');
      button.setAttribute('aria-label', `Theme: ${current}. Switch to ${next} mode`);
      button.title = `Theme: ${current}. Switch to ${next} mode`;
      const label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = current;
    });
  }
  function apply() { root.dataset.theme = effective(); syncButtons(); }
  apply();
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
    preference = {auto: 'light', light: 'dark', dark: 'auto'}[preference || 'auto'];
    try { localStorage.setItem(key, preference); } catch (_) { /* Works for this visit even when storage is blocked. */ }
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
