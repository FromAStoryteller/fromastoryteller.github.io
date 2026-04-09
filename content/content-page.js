import { initRelatedContentSection } from "/content/content-system.js"

const relatedSection = document.querySelector("[data-current-content-id]")

if (relatedSection) {
    const currentContentId = relatedSection.dataset.currentContentId || ""

    initRelatedContentSection({
        gridSelector: "#related-content-grid",
        currentContentId,
        limit: 3,
        emptyMessage: "More content is coming soon."
    })
}