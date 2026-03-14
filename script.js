// script.js

// Load components, then wire up the sidebar toggle
document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    loadComponent("/components/header.html", "header-placeholder"),
    loadComponent("/components/sidebar.html", "sidebar-placeholder"),
    loadComponent("/components/footer.html", "footer-placeholder")
  ])
  .then(() => {
    initSidebarToggle();
  })
  .catch(err => console.error("Error loading components:", err));
});

// Reusable loader for header / sidebar / footer
function loadComponent(path, placeholderId) {
  return fetch(path)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Failed to fetch ${path}: ${res.status}`);
      }
      return res.text();
    })
    .then(html => {
      const container = document.getElementById(placeholderId);
      if (container) {
        container.innerHTML = html;
      } else {
        console.warn(`Placeholder #${placeholderId} not found`);
      }
    })
    .catch(err => {
      console.error("Error loading", path, err);
    });
}

// Hook up the hamburger to the sidebar collapse
function initSidebarToggle() {
  const toggleBtn   = document.querySelector(".menu-toggle");
  const sidebar     = document.querySelector(".sidebar");
  const mainContent = document.querySelector(".page-content");

  if (!toggleBtn || !sidebar || !mainContent) {
    console.warn("Sidebar toggle not initialized (missing elements).");
    return;
  }

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("is-collapsed");
    mainContent.classList.toggle("is-collapsed");
  });
}
