// script.js

// Load components, then wire up the sidebar toggle
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadComponent("/components/header.html", "header-placeholder");
    await loadComponent("/components/sidebar.html", "sidebar-placeholder");
    await loadComponent("/components/footer.html", "footer-placeholder");

    initSidebarToggle();
    setActiveSidebarLink();
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
