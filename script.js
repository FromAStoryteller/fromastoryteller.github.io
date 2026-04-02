// script.js

import {
  getAllPublishedContent,
  searchPublishedContent
} from "/content/content-system.js"

// Load components, then wire up the sidebar toggle
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

// Hook up the hamburger to the sidebar expanded state
function initSidebarToggle() {
  const toggleBtn = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const body = document.body;

  if (!toggleBtn || !sidebar) {
    console.warn("Sidebar toggle not initialized (missing elements).");
    return;
  }

  // Default state on page load
  if (body.classList.contains("home-page")) {
    sidebar.classList.add("is-expanded");
  } else {
    sidebar.classList.remove("is-expanded");
  }

  // Toggle expanded / collapsed
  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("is-expanded");
  });
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
  });
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

  function showSuggestions(suggestions) {
    if (!suggestions.length) {
      hideSuggestions()
      return
    }

    suggestionsContainer.innerHTML = suggestions.map(item =>
      `<button class="site-search-suggestion" data-url="${item.url}">
        ${item.title}
      </button>`
    ).join("")

    suggestionsContainer.classList.add("is-visible")

    suggestionsContainer.querySelectorAll(".site-search-suggestion").forEach(btn => {
      btn.addEventListener("click", () => {
        window.location.href = btn.dataset.url
      })
    })
  }

  function getSuggestions(query) {
    if (!query) return []

    const results = searchPublishedContent(allItems, query)
    return results.slice(0, 5)
  }

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

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".site-search-wrap")) {
      hideSuggestions()
    }
  })
}