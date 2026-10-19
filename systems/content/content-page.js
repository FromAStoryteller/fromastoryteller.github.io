import { initRelatedContentSection } from "/systems/content/content-system.js"

function init(){
const relatedSection = document.querySelector("[data-current-content-id]")

if (relatedSection) {
    const currentContentId = relatedSection.dataset.currentContentId || ""

    initRelatedContentSection({
        gridSelector: "#related-content-grid",
        currentContentId,
        limit: 6,
        emptyMessage: "More content is coming soon."
    })
}
}
init();
document.addEventListener("fas:content-rendered",init);
