import { initHomePage } from "/content/content-system.js"

initHomePage({
    featuredSelector: "#home-featured",
    filtersSelector: "#home-filters",
    gridSelector: "#home-grid",
    filterMode: "category",
    featuredLabel: "Featured Content",
    emptyMessage: "No content found yet."
})