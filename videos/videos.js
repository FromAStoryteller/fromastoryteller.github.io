import { initCategoryPage } from "/content/content-system.js"

initCategoryPage({
    category: "videos",
    featuredSelector: "#featured-video",
    filtersSelector: "#videos-filters",
    gridSelector: "#videos-grid",
    filterMode: "subtype",
    featuredLabel: "Featured Video",
    emptyMessage: "No videos found yet."
})