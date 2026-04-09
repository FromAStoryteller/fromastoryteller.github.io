// ==================================
// SHARED CONTENT SYSTEM
// Used by category pages and home page
// ==================================

// ----- CONFIG -----
const CONTENT_INDEX_PATH = "/content/content-index.json"

// ----- HELPERS -----
function safeArray(value) {
    return Array.isArray(value) ? value : []
}

function formatLabel(value) {
    if (!value) return ""

    return value
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

function getPrimaryActionLabel(item) {
    const category = item?.category || ""

    if (category === "games") return "Play"
    if (category === "stories") return "Read"
    if (category === "videos") return "Watch"
    if (category === "tools") return "Use"

    return "Explore"
}

function parseDate(dateString) {
    const time = Date.parse(dateString)
    return Number.isNaN(time) ? 0 : time
}

function escapeHtml(value) {
    if (typeof value !== "string") return ""

    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}

function normalizeContentMeta(meta) {
    return {
        id: meta.id || "",
        type: meta.type || "",
        category: meta.category || "",
        subtype: meta.subtype || "",
        status: meta.status || "",
        title: meta.title || "",
        shortTitle: meta.shortTitle || "",
        description: meta.description || "",
        excerpt: meta.excerpt || "",
        url: meta.url || "#",
        canonicalUrl: meta.canonicalUrl || "",
        slug: meta.slug || "",
        featured: Boolean(meta.featured),
        pinned: Boolean(meta.pinned),
        draft: Boolean(meta.draft),
        datePublished: meta.datePublished || "",
        dateModified: meta.dateModified || "",
        author: meta.author || "",
        authorDisplay: meta.authorDisplay || "",
        publisher: meta.publisher || "",
        image: {
            src: meta.image?.src || "",
            alt: meta.image?.alt || "",
            width: meta.image?.width || 0,
            height: meta.image?.height || 0
        },
        card: {
            title: meta.card?.title || meta.title || "",
            description: meta.card?.description || meta.excerpt || meta.description || "",
            image: meta.card?.image || meta.image?.src || "",
            imageAlt: meta.card?.imageAlt || meta.image?.alt || "",
            icon: meta.card?.icon || "fa-solid fa-file",
            tags: safeArray(meta.card?.tags)
        },
        seo: meta.seo || {},
        openGraph: meta.openGraph || {},
        twitter: meta.twitter || {},
        taxonomy: meta.taxonomy || {}
    }
}

// ----- DATA LOADING -----
async function loadContentIndex() {
    const response = await fetch(CONTENT_INDEX_PATH)

    if (!response.ok) {
        throw new Error(`Failed to load content index: ${response.status}`)
    }

    return response.json()
}

async function loadMetaFile(metaPath) {
    const response = await fetch(metaPath)

    if (!response.ok) {
        throw new Error(`Failed to load meta file: ${metaPath}`)
    }

    const meta = await response.json()
    return normalizeContentMeta(meta)
}

async function loadAllContent() {
    const metaPaths = await loadContentIndex()
    const results = await Promise.all(metaPaths.map(loadMetaFile))
    return results
}

// ----- SORT / FILTER -----
function getPublishedContent(items) {
    return items.filter(item => item.status === "published")
}

function sortContent(items) {
    return [...items].sort((a, b) => {
        if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1
        }

        if (a.featured !== b.featured) {
            return a.featured ? -1 : 1
        }

        return parseDate(b.datePublished) - parseDate(a.datePublished)
    })
}

function filterByCategory(items, category) {
    if (!category) return items
    return items.filter(item => item.category === category)
}

function getFeaturedItem(items) {
    const featuredItems = items.filter(item => item.featured)

    if (featuredItems.length > 0) {
        return sortContent(featuredItems)[0]
    }

    return items[0] || null
}

function getFilterValues(items, filterMode) {
    if (filterMode === "category") {
        const values = [...new Set(
            items
                .map(item => item.category)
                .filter(Boolean)
        )]

        return values.sort((a, b) => a.localeCompare(b))
    }

    if (filterMode === "subtype") {
        const values = [...new Set(
            items
                .map(item => item.subtype)
                .filter(Boolean)
        )]

        return values.sort((a, b) => a.localeCompare(b))
    }

    return []
}

function getFilteredItems(items, filterValue, filterMode) {
    if (filterValue === "all") {
        return items
    }

    if (filterMode === "category") {
        return items.filter(item => item.category === filterValue)
    }

    if (filterMode === "subtype") {
        return items.filter(item => item.subtype === filterValue)
    }

    return items
}

function getSearchableText(item) {
    const parts = [
        item.title,
        item.shortTitle,
        item.description,
        item.excerpt,
        item.category,
        item.subtype,
        item.author,
        item.authorDisplay,
        ...(item.card?.tags || [])
    ]

    return parts
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
}

function scoreSearchMatch(item, query) {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return 0

    const searchableText = getSearchableText(item)
    let score = 0

    if (item.title?.toLowerCase() === normalizedQuery) score += 120
    if (item.card?.title?.toLowerCase() === normalizedQuery) score += 110

    if (item.title?.toLowerCase().includes(normalizedQuery)) score += 80
    if (item.card?.title?.toLowerCase().includes(normalizedQuery)) score += 70

    if (item.category?.toLowerCase() === normalizedQuery) score += 50
    if (item.subtype?.toLowerCase() === normalizedQuery) score += 40

    if (searchableText.includes(normalizedQuery)) score += 30

    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean)

    queryTerms.forEach(term => {
        if (item.title?.toLowerCase().includes(term)) score += 20
        if (item.card?.title?.toLowerCase().includes(term)) score += 18
        if (item.description?.toLowerCase().includes(term)) score += 10
        if (item.excerpt?.toLowerCase().includes(term)) score += 8
        if (item.category?.toLowerCase().includes(term)) score += 8
        if (item.subtype?.toLowerCase().includes(term)) score += 8

        if ((item.card?.tags || []).some(tag => tag.toLowerCase().includes(term))) {
            score += 12
        }
    })

    return score
}

function searchContentItems(items, query) {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
        return []
    }

    return items
        .map(item => ({
            item,
            score: scoreSearchMatch(item, normalizedQuery)
        }))
        .filter(result => result.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score
            }

            return parseDate(b.item.datePublished) - parseDate(a.item.datePublished)
        })
        .map(result => result.item)
}

// ----- RENDER HELPERS -----
function getHomeFeaturedItems(items) {
    const featuredItems = items.filter(item => item.featured)

    if (featuredItems.length === 0) {
        return items.length > 0 ? [items[0]] : []
    }

    const categoryOrder = ["games", "stories", "tools", "videos"]

    const selectedItems = categoryOrder
        .map(category => {
            const categoryItems = featuredItems.filter(item => item.category === category)
            if (categoryItems.length === 0) return null
            return sortContent(categoryItems)[0]
        })
        .filter(Boolean)
    
    return selectedItems.sort((a, b) => parseDate(b.datePublished) - parseDate(a.datePublished))
}

function createFeaturedPanelMarkup(item, label = "Featured") {
    if (!item) return ""

    const primaryActionLabel = getPrimaryActionLabel(item)

    const featuredTags = item.card.tags.map(tag => `
        <span>${escapeHtml(tag)}</span>
    `).join("")

    return `
        <div class="content-featured-text">
            <div class="content-featured-text-inner">
                <p class="content-featured-label">
                    <i class="fa-solid fa-star"></i> ${escapeHtml(label)}
                </p>

                <h2>${escapeHtml(item.title)}</h2>

                <p class="content-featured-description">
                    ${escapeHtml(item.description || item.card.description)}
                </p>

                <div class="content-featured-tags">
                    ${featuredTags}
                </div>

                <div class="content-featured-actions">
                    <a href="${escapeHtml(item.url)}" class="btn-primary">${escapeHtml(primaryActionLabel)}</a>
                    <a href="${escapeHtml(item.url)}" class="btn-secondary">View Details</a>
                </div>
            </div>
        </div>

        <div class="content-featured-media">
            <img src="${escapeHtml(item.image.src || item.card.image)}" alt="${escapeHtml(item.image.alt || item.card.imageAlt)}">
        </div>
    `
}

function createFeaturedShellMarkup(showControls = false) {
    const controlsMarkup = showControls ? `
        <div class="content-featured-controls" aria-label="Featured content controls">
            <button type="button" class="content-featured-arrow content-featured-arrow-prev" aria-label="Previous featured item">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button type="button" class="content-featured-arrow content-featured-arrow-next" aria-label="Next featured item">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>
    ` : ""

    return `
        ${controlsMarkup}
        <div class="content-featured-viewport">
            <div class="content-featured-track content-featured-track-carousel">
                <div class="content-featured-slide content-featured-slide-current"></div>
                <div class="content-featured-slide content-featured-slide-next"></div>
            </div>
        </div>
    `
}

function renderFeaturedShell(selector, showControls = false) {
    const container = document.querySelector(selector)
    if (!container) return null

    container.innerHTML = createFeaturedShellMarkup(showControls)
    return container
}

function createCardMarkup(item) {
    const tagsMarkup = item.card.tags.map(tag => `
        <span>${escapeHtml(tag)}</span>
    `).join("")

    return `
        <article class="content-grid-card">
            <a href="${escapeHtml(item.url)}" class="content-grid-card-link">
                <div class="content-grid-card-image">
                    <img src="${escapeHtml(item.card.image)}" alt="${escapeHtml(item.card.imageAlt)}">
                    <span class="content-grid-card-banner">
                        <i class="${escapeHtml(item.card.icon)}"></i>
                    </span>
                </div>

                <div class="content-grid-card-body">
                    <h3>${escapeHtml(item.card.title)}</h3>
                    <p>${escapeHtml(item.card.description)}</p>

                    <div class="content-grid-card-tags">
                        ${tagsMarkup}
                    </div>
                </div>
            </a>
        </article>
    `
}

function initFeaturedRotator(selector, items, label = "Featured Content", interval = 6000) {
    const container = document.querySelector(selector)
    if (!container) return

    if (!items || items.length === 0) {
        container.innerHTML = ""
        return
    }

    if (items.length === 1) {
        renderFeaturedItem(selector, items[0], label)
        return
    }

    let currentIndex = 0
    let intervalId = null
    let isTransitioning = false

    const shell = renderFeaturedShell(selector, true)
    if (!shell) return

    let currentSlide = shell.querySelector(".content-featured-slide-current")
    let nextSlide = shell.querySelector(".content-featured-slide-next")
    const prevButton = shell.querySelector(".content-featured-arrow-prev")
    const nextButton = shell.querySelector(".content-featured-arrow-next")

    function setSlideContent(slideElement, item) {
        slideElement.innerHTML = createFeaturedPanelMarkup(item, label)
    }

    function finishTransition(nextIndex) {
        currentIndex = nextIndex

        currentSlide.innerHTML = ""
        currentSlide.classList.remove("content-featured-slide-current")
        currentSlide.classList.add("content-featured-slide-next")

        nextSlide.classList.remove("content-featured-slide-next")
        nextSlide.classList.add("content-featured-slide-current")

        const oldCurrent = currentSlide
        currentSlide = nextSlide
        nextSlide = oldCurrent

        shell.classList.remove("is-sliding-next", "is-sliding-prev")
        nextSlide.innerHTML = ""
        isTransitioning = false
    }

    function goToIndex(nextIndex, direction = "next") {
        if (isTransitioning || nextIndex === currentIndex) return
        isTransitioning = true

        setSlideContent(nextSlide, items[nextIndex])

        shell.classList.remove("is-sliding-next", "is-sliding-prev")
        void shell.offsetWidth
        shell.classList.add(direction === "next" ? "is-sliding-next" : "is-sliding-prev")

        window.setTimeout(() => {
            finishTransition(nextIndex)
        }, 420)
    }

    function goNext() {
        const nextIndex = (currentIndex + 1) % items.length
        goToIndex(nextIndex, "next")
        restartAutoRotate()
    }

    function goPrev() {
        const nextIndex = (currentIndex - 1 + items.length) % items.length
        goToIndex(nextIndex, "prev")
        restartAutoRotate()
    }

    function startAutoRotate() {
        if (items.length <= 1 || intervalId) return

        intervalId = window.setInterval(() => {
            if (isTransitioning) return
            const nextIndex = (currentIndex + 1) % items.length
            goToIndex(nextIndex, "next")
        }, interval)
    }

    function restartAutoRotate() {
        if (intervalId) {
            window.clearInterval(intervalId)
        }
        startAutoRotate()
    }

    function stopAutoRotate() {
        if (intervalId) {
            window.clearInterval(intervalId)
            intervalId = null
        }
    }

    setSlideContent(currentSlide, items[currentIndex])

    if (prevButton) {
        prevButton.addEventListener("click", goPrev)
    }

    if (nextButton) {
        nextButton.addEventListener("click", goNext)
    }

    shell.addEventListener("mouseenter", stopAutoRotate)
    shell.addEventListener("mouseleave", startAutoRotate)
    shell.addEventListener("focusin", stopAutoRotate)
    shell.addEventListener("focusout", startAutoRotate)

    startAutoRotate()
}

function renderFilters(selector, filters, activeFilter, onFilterClick) {
    const container = document.querySelector(selector)
    if (!container) return

    const allButton = `
        <button
            class="content-filter ${activeFilter === "all" ? "active" : ""}"
            type="button"
            data-filter="all"
        >
            All
        </button>
    `

    const filterButtons = filters.map(filter => `
        <button
            class="content-filter ${activeFilter === filter ? "active" : ""}"
            type="button"
            data-filter="${escapeHtml(filter)}"
        >
            ${escapeHtml(formatLabel(filter))}
        </button>
    `).join("")

    container.innerHTML = allButton + filterButtons

    const buttons = container.querySelectorAll(".content-filter")
    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const nextFilter = button.dataset.filter || "all"
            onFilterClick(nextFilter)
        })
    })
}

function renderGrid(selector, items, emptyMessage = "Nothing to show yet.") {
    const container = document.querySelector(selector)
    if (!container) return

    if (items.length === 0) {
        container.innerHTML = `
            <p class="content-grid-empty">${escapeHtml(emptyMessage)}</p>
        `
        return
    }

    container.innerHTML = items.map(createCardMarkup).join("")
}

function renderFeaturedItem(selector, item, label = "Featured") {
    const container = document.querySelector(selector)
    if (!container) return

    if (!item) {
        container.innerHTML = ""
        return
    }

    container.innerHTML = `
        <div class="content-featured-viewport">
            <div class="content-featured-track">
                <div class="content-featured-slide content-featured-slide-current">
                    ${createFeaturedPanelMarkup(item, label)}
                </div>
            </div>
        </div>
    `
}

// ----- PAGE INIT HELPERS -----
export async function initCategoryPage(config) {
    const {
        category,
        featuredSelector,
        filtersSelector,
        gridSelector,
        filterMode = "subtype",
        featuredLabel = "Featured",
        emptyMessage = "Nothing to show yet."
    } = config

    let allItems = []
    let activeFilter = "all"
    let filters = []

    function updatePage() {
        const filteredItems = getFilteredItems(allItems, activeFilter, filterMode)

        renderFilters(filtersSelector, filters, activeFilter, nextFilter => {
            activeFilter = nextFilter
            updatePage()
        })

        renderGrid(gridSelector, filteredItems, emptyMessage)
    }

    try {
        const loadedContent = await loadAllContent()
        const publishedContent = getPublishedContent(loadedContent)
        const categoryItems = filterByCategory(publishedContent, category)

        allItems = sortContent(categoryItems)
        filters = getFilterValues(allItems, filterMode)

        const featuredItem = getFeaturedItem(allItems)

        renderFeaturedItem(featuredSelector, featuredItem, featuredLabel)
        updatePage()
    } catch (error) {
        console.error("Error loading category page:", error)

        const featuredContainer = document.querySelector(featuredSelector)
        const filtersContainer = document.querySelector(filtersSelector)
        const gridContainer = document.querySelector(gridSelector)

        if (featuredContainer) featuredContainer.innerHTML = ""
        if (filtersContainer) filtersContainer.innerHTML = ""
        if (gridContainer) {
            gridContainer.innerHTML = `
                <p class="content-grid-empty">Unable to load content right now.</p>
            `
        }
    }
}

export async function initHomePage(config) {
    const {
        featuredSelector,
        filtersSelector,
        gridSelector,
        filterMode = "category",
        featuredLabel = "Featured",
        emptyMessage = "Nothing to show yet."
    } = config

    let allItems = []
    let activeFilter = "all"
    let filters = []

    function updatePage() {
        const filteredItems = getFilteredItems(allItems, activeFilter, filterMode)

        renderFilters(filtersSelector, filters, activeFilter, nextFilter => {
            activeFilter = nextFilter
            updatePage()
        })

        renderGrid(gridSelector, filteredItems, emptyMessage)
    }

    try {
        const loadedContent = await loadAllContent()
        allItems = sortContent(getPublishedContent(loadedContent))
        filters = getFilterValues(allItems, filterMode)

        const featuredItems = getHomeFeaturedItems(allItems)

        initFeaturedRotator(featuredSelector, featuredItems, featuredLabel, 7000)
        updatePage()
    } catch (error) {
        console.error("Error loading home page:", error)

        const featuredContainer = document.querySelector(featuredSelector)
        const filtersContainer = document.querySelector(filtersSelector)
        const gridContainer = document.querySelector(gridSelector)

        if (featuredContainer) featuredContainer.innerHTML = ""
        if (filtersContainer) filtersContainer.innerHTML = ""
        if (gridContainer) {
            gridContainer.innerHTML = `
                <p class="content-grid-empty">Unable to load content right now.</p>
            `
        }
    }
}

export async function initRelatedContentSection(config) {
    const {
        gridSelector,
        currentContentId = "",
        limit = 3,
        emptyMessage = "Nothing to show yet."
    } = config

    try {
        const loadedContent = await loadAllContent()
        const publishedContent = getPublishedContent(loadedContent)
        const sortedContent = sortContent(publishedContent)

        const filteredItems = sortedContent.filter(item => item.id !== currentContentId)
        const relatedItems = filteredItems.slice(0, limit)

        renderGrid(gridSelector, relatedItems, emptyMessage)
    } catch (error) {
        console.error("Error loading related content:", error)

        const gridContainer = document.querySelector(gridSelector)
        if (gridContainer) {
            gridContainer.innerHTML = `
                <p class="content-grid-empty">Unable to load content right now</p>
            `
        }
    }
}

export async function getAllPublishedContent() {
    const loadedContent = await loadAllContent()
    return sortContent(getPublishedContent(loadedContent))
}

export function searchPublishedContent(items, query) {
    return searchContentItems(items, query)
}

export function renderContentGrid(selector, items, emptyMessage = "Nothing to show yet.") {
    renderGrid(selector, items, emptyMessage)
}