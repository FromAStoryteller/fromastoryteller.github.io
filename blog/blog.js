import { initCategoryPage } from "/content/content-system.js"

initCategoryPage({
    category: "blog",
    featuredSelector: "#featured-blog",
    filtersSelector: "#blog-filters",
    gridSelector: "#blog-grid",
    filterMode: "subtype",
    featuredLabel: "Featured Blog",
    emptyMessage: "No blogs found yet."
})