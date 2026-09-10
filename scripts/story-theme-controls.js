/* The shell height is now defined before first paint in foundations.css.
   Retained entry point for existing pages; controls live in the shared header. */
(() => {
  function update() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--colour-surface').trim();
  }
  document.addEventListener('DOMContentLoaded', update, { once: true });
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
