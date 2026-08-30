// =======================================
// FROM A STORYTELLER - STORY-PAGE.JS
// Version: 1.0
// Shared enhancements for individual story pages
// =======================================

import { initRelatedContentSection } from "/content/content-system.js"

function getCurrentStoryId() {
    const explicitSection = document.querySelector("[data-current-content-id]")
    const explicitId = explicitSection?.dataset.currentContentId?.trim()

    if (explicitId) {
        return explicitId
    }

    const pathParts = window.location.pathname
        .split("/")
        .filter(Boolean)

    if (pathParts[0] !== "stories") {
        return ""
    }

    return pathParts[1] || ""
}

function alignLegacyStoryLabels(storyPage) {
    /*
       Older generated stories used the single label "Story".
       Keep old files compatible while bringing them into the same
       category / subtype pattern used by Games and Tools.
    */
    const category = storyPage.querySelector(".story-category")

    if (category && category.textContent.trim().toLowerCase() === "story") {
        category.innerHTML = `
            <i class="fa-solid fa-book-open" aria-hidden="true"></i>
            <span>Stories / Short Story</span>
        `
    }

    /*
       Once Explore Next exists below the story, this button is clearer as a
       direct route back to the full story library instead of another vague
       "explore" action.
    */
    const returnLabel = storyPage.querySelector(".story-return-link span")

    if (
        returnLabel &&
        returnLabel.textContent.trim().toLowerCase() === "explore more stories"
    ) {
        returnLabel.textContent = "Browse All Stories"
    }
}

function ensureRelatedSection(storyPage, currentContentId) {
    let relatedSection = document.querySelector(
        ".story-related-section[data-current-content-id]"
    )

    if (relatedSection) {
        if (!relatedSection.dataset.currentContentId) {
            relatedSection.dataset.currentContentId = currentContentId
        }

        return relatedSection
    }

    relatedSection = document.createElement("section")
    relatedSection.className = "content-page story-related-section"
    relatedSection.dataset.currentContentId = currentContentId

    relatedSection.innerHTML = `
        <div class="content-page-hero story-related-hero">
            <h2>Explore Next</h2>
            <p class="content-page-intro">
                Continue exploring From A Storyteller
            </p>
        </div>

        <div id="related-content-grid" class="content-grid"></div>
    `

    storyPage.insertAdjacentElement("afterend", relatedSection)

    return relatedSection
}

async function initStoryPage() {
    const storyPage = document.querySelector(".story-page")

    if (!storyPage) {
        return
    }

    alignLegacyStoryLabels(storyPage)

    const currentContentId = getCurrentStoryId()

    if (!currentContentId) {
        console.warn("Story page enhancements could not determine the story ID.")
        return
    }

    const relatedSection = ensureRelatedSection(
        storyPage,
        currentContentId
    )

    const relatedGrid = relatedSection.querySelector("#related-content-grid")

    if (!relatedGrid) {
        return
    }

    await initRelatedContentSection({
        gridSelector: "#related-content-grid",
        currentContentId,
        limit: 3,
        emptyMessage: "More content is coming soon."
    })
}

initStoryPage().catch((error) => {
    console.error("Error initializing story page enhancements:", error)
})