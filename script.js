// =======================================
// FROM A STORYTELLER - SCRIPT.JS
// Version: 2.6
// Global component, sidebar and search behaviour
// =======================================

import {
  getAllPublishedContent,
  searchPublishedContent
} from "/content/content-system.js"

// Load components, then wire up global page behaviour
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadComponent("/components/header.html", "header-placeholder");
    await loadComponent("/components/sidebar.html", "sidebar-placeholder");
    await loadComponent("/components/footer.html", "footer-placeholder");

    initSidebarToggle();
    setActiveSidebarLink();
    syncHeaderSearchQuery();
    initHeaderSearch();
    initContentDetailEnhancements();
  } catch (err) {
    console.error("Error loading components:", err);
  } 
});


// Load detail-page enhancements only where they are needed.
// This keeps the global script lightweight while allowing older story HTML
// files to gain the current individual-story behaviour automatically.
async function initContentDetailEnhancements() {
  if (!document.querySelector(".story-page")) {
    return;
  }

  try {
    await import("/stories/story-page.js");
  } catch (err) {
    console.error("Story page enhancements failed to load:", err);
  }
}

// Reusable loader for header / sidebar / footer
async function loadComponent(path, placeholderId) {
  const existing = document.getElementById(placeholderId);
  if (existing?.querySelector("[data-static-component]")) return;

  const res = await fetch(path);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }

  const html = await res.text();
  const container = document.getElementById(placeholderId);

  if (!container) {
    throw new Error(`Placeholder #${placeholderId} not found`);
  }

  container.innerHTML = html;
}

// One shell state coordinates focus, Escape, the veil and background scrolling.
function initSidebarToggle() {
  const toggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const searchToggle = document.querySelector('.search-toggle');
  const panel = document.querySelector('.header-search-panel');
  const brand = document.querySelector('.header-brand');
  const right = document.querySelector('.header-right');
  if (!toggle || !sidebar || !panel) return;
  const compact = matchMedia('(max-width: 64rem)');
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.append(backdrop);
  const background = [...document.querySelectorAll('main, #footer-placeholder')];
  let mode = null;
  const focusable = container => [...container.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter(el => !el.closest('[hidden], [inert]') && el.getClientRects().length);
  function setMode(next, returnFocus = true) {
    const previous = mode;
    mode = next;
    const navOpen = mode === 'nav';
    const searchOpen = mode === 'search';
    sidebar.classList.toggle('is-expanded', navOpen);
    sidebar.inert = searchOpen || (compact.matches && !navOpen);
    sidebar.setAttribute('aria-hidden', String(sidebar.inert));
    toggle.setAttribute('aria-expanded', String(navOpen));
    toggle.setAttribute('aria-label', navOpen ? 'Close menu' : 'Open menu');
    panel.hidden = !searchOpen;
    brand.hidden = searchOpen && compact.matches;
    right.hidden = searchOpen;
    searchToggle.setAttribute('aria-expanded', String(searchOpen));
    document.body.classList.toggle('shell-open', !!mode);
    backdrop.classList.toggle('is-visible', !!mode);
    background.forEach(el => { el.inert = !!mode; });
    if (navOpen) focusable(sidebar)[0]?.focus({preventScroll: true});
    else if (searchOpen) panel.querySelector('input').focus({preventScroll: true});
    else if (returnFocus && previous) (previous === 'nav' ? toggle : searchToggle).focus({preventScroll: true});
    if (!searchOpen) {
      const suggestions = panel.querySelector('.site-search-suggestions');
      suggestions?.classList.remove('is-visible');
    }
  }
  toggle.addEventListener('click', () => setMode(mode === 'nav' ? null : 'nav'));
  searchToggle.addEventListener('click', () => setMode('search'));
  panel.querySelector('.search-close').addEventListener('click', () => setMode(null));
  backdrop.addEventListener('click', () => setMode(null));
  sidebar.addEventListener('click', event => { if (event.target.closest('a')) setMode(null); });
  document.addEventListener('keydown', event => {
    if (!mode) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); setMode(null); return;
    }
    if (event.key !== 'Tab') return;
    const elements = mode === 'nav' ? [toggle, ...focusable(sidebar)] : [toggle, ...focusable(panel)];
    const index = elements.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); elements.at(-1)?.focus(); }
    else if (!event.shiftKey && (index < 0 || index === elements.length - 1)) { event.preventDefault(); elements[0]?.focus(); }
  }, true);
  // Header controls remain operable but the keyboard cycle stays within the open surface.
  document.addEventListener('focusin', event => {
    if (!mode || event.target === toggle) return;
    const surface = mode === 'nav' ? sidebar : panel;
    if (!surface.contains(event.target)) focusable(surface)[0]?.focus({preventScroll: true});
  });
  compact.addEventListener('change', () => setMode(null));
  setMode(null, false);
  document.querySelectorAll('[data-copyright-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
}

function setActiveSidebarLink() {
  const currentPath = window.location.pathname.replace(/index\.html$/, "")
  const sidebarLinks = document.querySelectorAll(".sidebar-item")

  sidebarLinks.forEach(link => {
    link.classList.remove("active")
    link.removeAttribute("aria-current")

    const linkPath = new URL(link.href, window.location.origin).pathname

    if (linkPath === currentPath || (linkPath !== "/" && currentPath.startsWith(linkPath))) {
      link.setAttribute("aria-current", "page")
    }
  })
}

function syncHeaderSearchQuery() {
  const params = new URLSearchParams(window.location.search)
  const query = params.get("q") || ""

  const searchInputs = document.querySelectorAll('.site-search input[name="q"]')
  searchInputs.forEach(input => {
    input.value = query
  })
}

async function initHeaderSearch() {
  const input = document.querySelector(".site-search-input")
  const suggestionsContainer = document.querySelector(".site-search-suggestions")
  const form = document.querySelector(".site-search")

  if (!input || !suggestionsContainer || !form) return

  let allItems = []

  try {
    allItems = await getAllPublishedContent()
  } catch (err) {
    console.error("Header search failed to load content:", err)
  }

  function hideSuggestions() {
    suggestionsContainer.innerHTML = ""
    suggestionsContainer.classList.remove("is-visible")
  }

  function goToSearchPage(query) {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) return

    const url = new URL("/search/", window.location.origin)
    url.searchParams.set("q", trimmedQuery)

    window.location.href = url.toString()
  }

  function showSuggestions(suggestions) {
    suggestionsContainer.innerHTML = ""

    if (!suggestions.length) {
      hideSuggestions()
      return
    }

    suggestions.forEach(item => {
      const button = document.createElement("button")

      button.type = "button"
      button.className = "site-search-suggestion"
      button.dataset.suggestion = item.title
      button.textContent = item.title

      suggestionsContainer.appendChild(button)
    })

    suggestionsContainer.classList.add("is-visible")
  }

  function getSuggestions(query) {
    if (!query) return []

    const results = searchPublishedContent(allItems, query)
    return results.slice(0, 5)
  }

  form.addEventListener("submit", event => {
    event.preventDefault()

    const query = input.value.trim()

    hideSuggestions()
    goToSearchPage(query)
  })

  input.addEventListener("input", () => {
    const query = input.value.trim()
    const suggestions = getSuggestions(query)

    showSuggestions(suggestions)
  })

  input.addEventListener("focus", () => {
    const query = input.value.trim()
    const suggestions = getSuggestions(query)

    showSuggestions(suggestions)
  })

  suggestionsContainer.addEventListener("click", event => {
    const button = event.target.closest(".site-search-suggestion")

    if (!button) return

    event.preventDefault()

    const suggestion = button.dataset.suggestion || ""

    input.value = suggestion
    hideSuggestions()
    goToSearchPage(suggestion)
  })

  document.addEventListener("pointerdown", event => {
    if (!event.target.closest(".site-search-wrap")) {
      hideSuggestions()
    }
  })
}