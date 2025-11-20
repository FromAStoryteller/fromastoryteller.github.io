document.addEventListener("DOMContentLoaded", () => {
  loadComponent("components/header.html", "header-placeholder");
  loadComponent("components/sidebar.html", "sidebar-placeholder");
  loadComponent("components/footer.html", "footer-placeholder");
});

function loadComponent(path, placeholderId) {
  fetch(path)
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById(placeholderId);
      if (container) container.innerHTML = html;
    })
    .catch(err => console.error("Error loading", path, err));
}
