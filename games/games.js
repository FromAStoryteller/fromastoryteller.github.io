import { initCategoryPage } from "/content/content-system.js"

initCategoryPage({
    category: "games",
    featuredSelector: "#featured-game",
    filtersSelector: "#games-filters",
    gridSelector: "#games-grid",
    filterMode: "subtype",
    featuredLabel: "Featured Game",
    emptyMessage: "No games found yet."
})