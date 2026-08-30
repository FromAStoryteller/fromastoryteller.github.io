// =======================================
// FROM A STORYTELLER - SCRIPT.JS
// Version: 2.5
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
  } catch (err) {
    console.error("Error loading components:", err);
  } 
});

// Reusable loader for header / sidebar / footer
async function loadComponent(path, placeholderId) {
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

// Shared responsive sidebar behaviour
function initSidebarToggle() {
  const toggleBtn = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const body = document.body;
  const compactSidebarQuery = window.matchMedia("(max-width: 1573px)");

  if (!toggleBtn || !sidebar) {
    console.warn("Sidebar toggle not initialized (missing elements).");
    return;
  }

  if (!sidebar.id) {
    sidebar.id = "site-sidebar";
  }

  toggleBtn.setAttribute("aria-controls", sidebar.id);

  let backdrop = document.querySelector(".sidebar-backdrop");

  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);
  }

  function isCompactSidebar() {
    return compactSidebarQuery.matches;
  }

  function setSidebarExpanded(expanded) {
    sidebar.classList.toggle("is-expanded", expanded);
    toggleBtn.setAttribute("aria-expanded", String(expanded));

    const compact = isCompactSidebar();

    if (compact) {
      sidebar.setAttribute("aria-hidden", String(!expanded));
      backdrop.classList.toggle("is-visible", expanded);
      body.classList.toggle("sidebar-open", expanded);
    } else {
      sidebar.setAttribute("aria-hidden", "false");
      backdrop.classList.remove("is-visible");
      body.classList.remove("sidebar-open");
    }
  }

  function applyDefaultSidebarState() {
    const shouldStartExpanded =
      body.classList.contains("home-page") &&
      !isCompactSidebar();

    setSidebarExpanded(shouldStartExpanded);
  }

  // Initial state:
  // - large-screen home page = expanded
  // - other large pages = 64px icon rail
  // - 1573px and below = completely hidden (including the home page)
  applyDefaultSidebarState();

  toggleBtn.addEventListener("click", () => {
    setSidebarExpanded(!sidebar.classList.contains("is-expanded"));
  });

  backdrop.addEventListener("pointerdown", () => {
    if (isCompactSidebar()) {
      setSidebarExpanded(false);
    }
  });

  sidebar.addEventListener("click", event => {
    if (
      isCompactSidebar() &&
      event.target.closest(".sidebar-item")
    ) {
      setSidebarExpanded(false);
    }
  });

  /*
     When the compact overlay sidebar is open, Escape belongs to the
     website navigation first. Stopping propagation prevents the same
     Escape press from also pausing an active game underneath it.
  */
  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      isCompactSidebar() &&
      sidebar.classList.contains("is-expanded")
    ) {
      event.preventDefault();
      event.stopPropagation();
      setSidebarExpanded(false);
    }
  });

  // Keep behaviour correct if a browser window crosses the breakpoint.
  if (typeof compactSidebarQuery.addEventListener === "function") {
    compactSidebarQuery.addEventListener("change", applyDefaultSidebarState);
  } else if (typeof compactSidebarQuery.addListener === "function") {
    compactSidebarQuery.addListener(applyDefaultSidebarState);
  }
}

function setActiveSidebarLink() {
  const currentPath = window.location.pathname
  const sidebarLinks = document.querySelectorAll(".sidebar-item")

  sidebarLinks.forEach(link => {
    link.classList.remove("active")

    const linkPath = new URL(link.href, window.location.origin).pathname

    if (linkPath === currentPath) {
      link.classList.add("active")
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
    return
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

  suggestionsContainer.addEventListener("pointerdown", event => {
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