document.addEventListener("DOMContentLoaded", () => {
  loadComponent("components/header.html", "header-placeholder");
  loadComponent("components/sidebar.html", "sidebar-placeholder");
  loadComponent("components/footer.html", "footer-placeholder");
});

function loadComponent(path, placeholderId) {
  fetch(path)
    .then(response => response.text())
    .then(html => {
      document.getElementById(placeholderId).innerHTML = html;
    });
}
