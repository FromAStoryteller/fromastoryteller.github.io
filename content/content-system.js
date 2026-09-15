import { readingTimeLabel } from "./reading-time.mjs"
import {isKeyboardInteraction} from "../scripts/focus.js"

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
    if (category === "blog") return "Read"

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
        readingMinutes: Number(meta.readingMinutes) || 0,
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
    const [metaPaths, times] = await Promise.all([loadContentIndex(), fetch("/content/story-reading-times.json").then(response => response.ok ? response.json() : {}).catch(() => ({}))])
    const results = await Promise.allSettled(metaPaths.map(loadMetaFile))
    const loaded = results.filter(result => result.status === "fulfilled").map(result => result.value)
    if (metaPaths.length && !loaded.length) throw new Error("No content metadata could be loaded")
    return loaded.map(item => ({...item, readingMinutes: item.category === "stories" ? Number(times[item.id]?.minutes) || 0 : 0}))
}

// ----- SORT / FILTER -----
function getPublishedContent(items) {
    return items.filter(item => item.status === "published" && !item.draft)
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

    const categoryOrder = ["blog", "games", "stories", "tools", "videos"]

    const selectedItems = categoryOrder
        .map(category => {
            const categoryItems = featuredItems.filter(item => item.category === category)
            if (categoryItems.length === 0) return null
            return sortContent(categoryItems)[0]
        })
        .filter(Boolean)
    
    return selectedItems.sort((a, b) => parseDate(b.datePublished) - parseDate(a.datePublished))
}

function cardTypeLabel(item) {
    const type = item.category === "stories" ? "Story" : formatLabel(item.type || item.category)
    const time = item.category === "stories" ? readingTimeLabel(item.readingMinutes) : ""
    return time ? type + " · " + time : type
}

function createFeaturedPanelMarkup(item, label = "Featured") {
    if (!item) return ""
    const type = cardTypeLabel(item)
    return `
        <a class="content-featured-link image-overlay" href="${escapeHtml(item.url)}" aria-label="${escapeHtml(getPrimaryActionLabel(item) + ': ' + item.title + (item.category === "stories" && item.readingMinutes ? ", " + readingTimeLabel(item.readingMinutes) : ""))}">
            <div class="content-featured-media image-overlay__media">
                <img src="${escapeHtml(item.image.src || item.card.image)}" alt="${escapeHtml(item.image.alt || item.card.imageAlt)}" fetchpriority="high" decoding="async">
            </div>
            <div class="content-featured-text image-overlay__content">
                <div class="content-featured-text-inner">
                    <p class="content-featured-label image-overlay__label">Featured · ${escapeHtml(type)}</p>
                    <h2>${escapeHtml(item.title)}</h2>
                    <p class="content-featured-description">${escapeHtml(item.excerpt || item.card.description || item.description)}</p>
                    <span class="content-featured-action"><span class="content-featured-action-label">${escapeHtml(getPrimaryActionLabel(item))}</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
                </div>
            </div>
        </a>
    `
}

function createCardMarkup(item, variant = "standard") {
    const cardVariant = "standard"
    return `
        <article class="content-grid-card content-card--${cardVariant}">
            <a href="${escapeHtml(item.url)}" class="content-grid-card-link image-overlay" aria-label="${escapeHtml(item.card.title + (item.category === "stories" && item.readingMinutes ? ", " + readingTimeLabel(item.readingMinutes) : ""))}">
                <div class="content-grid-card-image image-overlay__media">
                    <img loading="lazy" decoding="async" src="${escapeHtml(item.card.image)}" alt="${escapeHtml(item.card.imageAlt)}">
                </div>
                <div class="content-grid-card-body image-overlay__content">
                    <span class="image-overlay__label">${escapeHtml(cardTypeLabel(item))}</span>
                    <h3>${escapeHtml(item.card.title)}</h3>
                    ${cardVariant === "standard" ? `<p class="content-grid-card-excerpt">${escapeHtml(item.card.description || item.excerpt || item.description)}</p>` : ""}
                </div>
            </a>
        </article>
    `
}

function initFeaturedRotator(selector, items, label = "Featured Content", interval = 7000) {
    const shell = document.querySelector(selector)
    if (!shell || !items?.length) return
    if (items.length === 1) return renderFeaturedItem(selector, items[0], label)
    let index = 0
    let paused = false
    let hovered = false
    let remaining = interval
    let deadline = 0
    let timer = null
    let gesture = null
    let suppressClick = false
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
    shell.setAttribute("role", "region")
    shell.setAttribute("aria-roledescription", "carousel")
    shell.setAttribute("aria-label", label)
    shell.tabIndex = 0
    shell.innerHTML = `
        <div class="content-featured-viewport">
            <div class="content-featured-slide" role="group" aria-roledescription="slide"></div>
            <button type="button" class="content-featured-pause" aria-label="Pause carousel"><i class="fa-solid fa-pause" aria-hidden="true"></i></button>
        </div>
        <div class="content-featured-controls" role="group" aria-label="Featured content controls">
            <button type="button" class="content-featured-arrow" data-step="-1" aria-label="Previous featured item"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <div class="content-featured-segments" role="group" aria-label="Choose featured item">
                ${items.map((item, i) => `<button type="button" class="content-featured-segment" data-index="${i}" aria-label="Show ${escapeHtml(item.title)}"><span></span></button>`).join("")}
            </div>
            <button type="button" class="content-featured-arrow" data-step="1" aria-label="Next featured item"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
        </div>
        <p class="visually-hidden content-featured-status" aria-live="polite" aria-atomic="true"></p>`
    const slide = shell.querySelector(".content-featured-slide")
    const viewport = shell.querySelector(".content-featured-viewport")
    const pause = shell.querySelector(".content-featured-pause")
    const segments = [...shell.querySelectorAll(".content-featured-segment")]
    function show(next, announce = true) {
        index = (next + items.length) % items.length
        slide.innerHTML = createFeaturedPanelMarkup(items[index], label)
        slide.setAttribute("aria-label", `${index + 1} of ${items.length}`)
        segments.forEach((button, i) => {
            if (i === index) button.setAttribute("aria-current", "true")
            else button.removeAttribute("aria-current")
        })
        if (announce) shell.querySelector(".content-featured-status").textContent = `${index + 1} of ${items.length}: ${items[index].title}`
        if (announce && !reducedMotion.matches) {
            slide.animate([{opacity: 0.65}, {opacity: 1}], {
                duration: parseFloat(getComputedStyle(shell).getPropertyValue("--duration-normal")) || 180
            })
        }
    }
    function canRun() {
        const rect = shell.getBoundingClientRect()
        const header = document.querySelector(".site-header")?.getBoundingClientRect().height || 0
        return !paused && !hovered && !reducedMotion.matches && !document.hidden
            && !document.body.classList.contains("shell-open")
            && !(isKeyboardInteraction() && shell.contains(document.activeElement))
            && rect.top >= header && rect.bottom <= innerHeight
    }
    function schedule(reset = false) {
        pause.hidden = reducedMotion.matches
        if (reset) {
            clearTimeout(timer)
            timer = null
            remaining = interval
        }
        if (!canRun()) {
            if (timer !== null) remaining = Math.max(0, deadline - performance.now())
            clearTimeout(timer)
            timer = null
            return
        }
        if (timer !== null) return
        deadline = performance.now() + remaining
        timer = setTimeout(() => {
            timer = null
            if (canRun()) { show(index + 1, false); remaining = interval }
            else remaining = 0
            schedule()
        }, remaining)
    }
    function select(next) { show(next); schedule(true) }
    shell.querySelectorAll("[data-step]").forEach(button => button.addEventListener("click", () => select(index + Number(button.dataset.step))))
    segments.forEach((button, i) => button.addEventListener("click", () => select(i)))
    pause.addEventListener("click", () => {
        paused = !paused
        pause.querySelector("i").className = paused ? "fa-solid fa-play" : "fa-solid fa-pause"
        pause.setAttribute("aria-label", paused ? "Play carousel" : "Pause carousel")
        schedule(true)
    })
    shell.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || event.target.closest("input, textarea, select")) return
        event.preventDefault()
        // Keep focus stable when the current CTA is replaced.
        if (slide.contains(document.activeElement)) shell.focus({preventScroll: true})
        select(event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : index + (event.key === "ArrowRight" ? 1 : -1))
    })
    viewport.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" || !event.isPrimary || event.target.closest(".content-featured-pause")) return
        gesture = {x: event.clientX, y: event.clientY, id: event.pointerId}
    })
    viewport.addEventListener("pointerup", event => {
        if (!gesture || gesture.id !== event.pointerId) return
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y
        gesture = null
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            suppressClick = true
            if (slide.contains(document.activeElement)) shell.focus({preventScroll: true})
            select(index + (dx < 0 ? 1 : -1))
            setTimeout(() => { suppressClick = false }, 0)
        }
    })
    viewport.addEventListener("pointercancel", () => { gesture = null })
    viewport.addEventListener("click", event => { if (suppressClick) { event.preventDefault(); event.stopPropagation() } }, true)
    shell.addEventListener("mouseenter", () => { hovered = true; schedule() })
    shell.addEventListener("mouseleave", () => { hovered = false; schedule() })
    shell.addEventListener("focusin", () => schedule())
    shell.addEventListener("focusout", () => queueMicrotask(schedule))
    reducedMotion.addEventListener("change", () => schedule(true))
    document.addEventListener("focusmodalitychange", () => schedule())
    document.addEventListener("visibilitychange", () => schedule())
    window.addEventListener("scroll", () => schedule(), {passive: true})
    window.addEventListener("resize", () => schedule())
    new ResizeObserver(() => schedule()).observe(shell)
    new MutationObserver(() => schedule()).observe(document.body, {attributes: true, attributeFilter: ["class"]})
    show(0, false)
    schedule()
}

function renderFilters(selector, filters, activeFilter, onFilterClick) {
    const container = document.querySelector(selector)
    if (!container) return

    const allButton = `
        <button
            class="content-filter ${activeFilter === "all" ? "active" : ""}"
            type="button"
            aria-pressed="${activeFilter === "all"}"
            data-filter="all"
        >
            All
        </button>
    `

    const filterButtons = filters.map(filter => `
        <button
            class="content-filter ${activeFilter === filter ? "active" : ""}"
            type="button"
            aria-pressed="${activeFilter === filter}"
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
            container.querySelector(`[data-filter="${CSS.escape(nextFilter)}"]`)?.focus({preventScroll: true})
        })
    })
}

function renderGrid(selector, items, emptyMessage = "Nothing to show yet.", variant = "standard") {
    const container = document.querySelector(selector)
    if (!container) return

    if (items.length === 0) {
        container.innerHTML = `
            <p class="content-grid-empty">${escapeHtml(emptyMessage)}</p>
        `
        return
    }

    container.classList.remove("content-grid--compact")
    container.innerHTML = items.map(item => createCardMarkup(item, variant)).join("")
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
        if (gridContainer && !gridContainer.querySelector("a[href]")) {
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
        if (gridContainer && !gridContainer.querySelector("a[href]")) {
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
        limit = 6,
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
        if (gridContainer && !gridContainer.querySelector("a[href]")) {
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
// Shared with the build script so static and interactive cards stay identical.
export { normalizeContentMeta, sortContent, createCardMarkup, getFeaturedItem, getHomeFeaturedItems, createFeaturedPanelMarkup };

