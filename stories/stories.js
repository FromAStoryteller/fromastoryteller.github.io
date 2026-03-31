import { initCategoryPage } from "/content/content-system.js"

initCategoryPage({
    category: "stories",
    featuredSelector: "#featured-story",
    filtersSelector: "#stories-filters",
    gridSelector: "#stories-grid",
    filterMode: "subtype",
    featuredLabel: "Featured Story",
    emptyMessage: "No stories found yet."
})