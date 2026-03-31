import { initCategoryPage } from "/content/content-system.js"

initCategoryPage({
    category: "tools",
    featuredSelector: "#featured-tool",
    filtersSelector: "#tools-filters",
    gridSelector: "#tools-grid",
    filterMode: "subtype",
    featuredLabel: "Featured Tool",
    emptyMessage: "No tools found yet."
})