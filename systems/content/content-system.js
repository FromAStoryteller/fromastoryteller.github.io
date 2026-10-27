import {createBrowseHistory} from './browse-state.mjs'
import {relatedContent} from './related-content.mjs'
import {normalizeGameFeatures,gameFeatureLabels} from './game-features.mjs'
import {publicStoryCatalog} from '../community/public-story-catalog.mjs'
import {publicFileCatalog} from '../community/publishing-identity.mjs'
import { readingTimeLabel } from "../reading/reading-time.mjs"
import {isKeyboardInteraction} from "../core/focus.js"
import {selectFeatured,newestPublished} from './featured-selection.mjs'
import {mountContentDiscovery,discoverContent} from './content-discovery.mjs'
import {mountHomeFollowing} from '../community/home-following.mjs'

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
    if (category === "gallery") return "View"

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
        gameFeatures: meta.type === "game" ? normalizeGameFeatures(meta.gameFeatures) : null,
        genres:safeArray(meta.genres),tags:safeArray(meta.tags),warningIds:safeArray(meta.warningIds),warningReviewed:meta.warningReviewed===true,metadataVersion:meta.metadataVersion??0,metadata:meta.metadata??{},language:meta.language??'en',
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

let allContentRequest;
async function loadAllContent() {
    return allContentRequest??=(loadAllContentUncached().catch(error=>{allContentRequest=null;throw error;}))
}
async function loadAllContentUncached() {
    const [results, times, fileAuthors, community] = await Promise.all([
        loadContentIndex().then(metaPaths => Promise.allSettled(metaPaths.map(loadMetaFile))),
        fetch("/content/story-reading-times.json").then(response => response.ok ? response.json() : {}).catch(() => ({})),
        publicFileCatalog(), publicStoryCatalog()
    ])
    const authors=new Map(fileAuthors.filter(item=>item.author).map(item=>[item.url,item.author]));
    const unavailable=new Set(fileAuthors.filter(item=>item.unavailable).map(item=>item.url));
    const live=new Map(community.map(item=>[item.url,item]));
    const loaded = results.filter(result => result.status === "fulfilled").map(result => result.value)
    if (results.length && !loaded.length && !community.length) throw new Error("No content metadata could be loaded")
    const files=loaded.filter(item=>!unavailable.has(item.url)).map(item => live.has(item.url)?({...item,...live.get(item.url),featured:item.featured,pinned:item.pinned,subtype:item.subtype}):({...item,...(authors.has(item.url)?{author:authors.get(item.url).public_id,authorDisplay:authors.get(item.url).display_name}:{}), readingMinutes: item.category === "stories" ? Number(times[item.id]?.minutes) || 0 : 0}))
    const paths=new Set(files.map(item=>item.url));
    return [...files,...community.filter(item=>!paths.has(item.url))]
}

// ----- SORT / FILTER -----
function getPublishedContent(items) {
    return items.filter(item => item.status === "published" && !item.draft)
}

function sortContent(items) {
    return newestPublished(items)
}

function filterByCategory(items, category) {
    if (!category) return items
    return items.filter(item => item.category === category)
}

function getFeaturedItem(items) {
    return selectFeatured(items)[0] || null
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
        ...(item.card?.tags || []),
        ...gameFeatureLabels(item.gameFeatures)
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
    return selectFeatured(items)
}

function cardAuthorMarkup(item) {
    const id=typeof item.author==='object'?item.author?.public_id:item.author;
    const name=item.authorDisplay || (typeof item.author==='object'?item.author?.display_name:'');
    if(!name)return '';
    const text='By '+escapeHtml(name);
    return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id||'')
        ? `<a class="content-card-author" href="/storytellers/?author=${escapeHtml(id)}">${text}</a>`
        : `<span class="content-card-author">${text}</span>`;
}

function cardTypeLabel(item) {
    const type = item.category === "stories" ? "Story" : formatLabel(item.type || item.category)
    const time = item.category === "stories" ? readingTimeLabel(item.readingMinutes) : ""
    return time ? type + " · " + time : type
}

function viewerCardAttributes(item) {
    return 'data-viewer-content="'+escapeHtml(item.url)+'" data-viewer-content-type="'+escapeHtml(item.type || ({stories:'story',games:'game',tools:'tool',videos:'video'})[item.category] || 'story')+'"'
}

function createFeaturedPanelMarkup(item, label = "Featured") {
    if (!item) return ""
    const type = cardTypeLabel(item)
    return `
        <article class="content-featured-card" ${viewerCardAttributes(item)}>
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
        ${cardAuthorMarkup(item)}
        </article>
    `
}

function createCardMarkup(item, variant = "standard") {
    const cardVariant = "standard"
    return `
        <article class="content-grid-card content-card--${cardVariant}" ${viewerCardAttributes(item)}>
            <a href="${escapeHtml(item.url)}" class="content-grid-card-link image-overlay" aria-label="${escapeHtml(item.card.title + (item.category === "stories" && item.readingMinutes ? ", " + readingTimeLabel(item.readingMinutes) : ""))}">
                <div class="content-grid-card-image image-overlay__media">
                    ${item.card.image ? `<img loading="lazy" decoding="async" src="${escapeHtml(item.card.image)}" alt="${escapeHtml(item.card.imageAlt)}">` : `<span class="content-grid-card-placeholder" aria-hidden="true">From, A Storyteller</span>`}
                </div>
                <div class="content-grid-card-body image-overlay__content">
                    <span class="image-overlay__label">${escapeHtml(cardTypeLabel(item))}</span>
                    <h3>${escapeHtml(item.card.title)}</h3>
                    ${cardVariant === "standard" ? `<p class="content-grid-card-excerpt">${escapeHtml(item.card.description || item.excerpt || item.description)}</p>` : ""}
                </div>
            </a>
            ${cardAuthorMarkup(item)}
        </article>
    `
}

function initFeaturedRotator(selector, items, label = "Featured Content", interval = 7000) {
    const shell = document.querySelector(selector)
    if (!shell) return
    shell._disposeFeatured?.()
    if (!items?.length) {shell.replaceChildren();return}
    if (items.length === 1) return renderFeaturedItem(selector, items[0], label)
    let index = 0
    let paused = false
    let hovered = false
    let remaining = interval
    let deadline = 0
    let timer = null
    let gesture = null
    let suppressClick = false
    const events = new AbortController()
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
        return shell.isConnected && !paused && !hovered && !reducedMotion.matches && !document.hidden
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
        if (event.pointerType === "mouse" || !event.isPrimary || event.target.closest("button, [data-viewer-action]")) return
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
    reducedMotion.addEventListener("change", () => schedule(true),{signal:events.signal})
    document.addEventListener("focusmodalitychange", () => schedule(),{signal:events.signal})
    document.addEventListener("visibilitychange", () => schedule(),{signal:events.signal})
    window.addEventListener("scroll", () => schedule(), {passive: true,signal:events.signal})
    window.addEventListener("resize", () => schedule(),{signal:events.signal})
    const resizeObserver=new ResizeObserver(() => schedule());resizeObserver.observe(shell)
    const bodyObserver=new MutationObserver(() => schedule());bodyObserver.observe(document.body, {attributes: true, attributeFilter: ["class"]})
    const dispose=()=>{paused=true;events.abort();clearTimeout(timer);resizeObserver.disconnect();bodyObserver.disconnect();shell._disposeFeatured=null;}
    shell._disposeFeatured=dispose
    window.addEventListener('pagehide',dispose,{once:true,signal:events.signal})
    show(0, false)
    schedule()
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
        featuredLabel = "Featured",
        emptyMessage = "Nothing to show yet."
    } = config

    let allItems = []
    const grid=document.querySelector(gridSelector)
    grid?.setAttribute('aria-busy','true')
    const loading=document.createElement('p');loading.className='content-load-status';loading.setAttribute('role','status');loading.textContent='Loading published content…';grid?.before(loading)
    const browsing = typeof window!=="undefined"&&window.history?.replaceState ? createBrowseHistory() : null

    try {
        const loadedContent = await loadAllContent()
        const publishedContent = getPublishedContent(loadedContent)
        const categoryItems = filterByCategory(publishedContent, category)

        allItems = sortContent(categoryItems)


        initFeaturedRotator(featuredSelector, selectFeatured(allItems), featuredLabel)
        mountContentDiscovery(document.querySelector(filtersSelector),allItems,items=>renderGrid(gridSelector,items,allItems.length?'No content matches these filters. Try another selection.':emptyMessage),{category})
        browsing?.restore()
    } catch (error) {
        console.error("Error loading category page:", error)

        const featuredContainer = document.querySelector(featuredSelector)
        const filtersContainer = document.querySelector(filtersSelector)
        const gridContainer = document.querySelector(gridSelector)

        if (featuredContainer) featuredContainer.innerHTML = ""
        if (filtersContainer) filtersContainer.innerHTML = ""
        showCatalogError(gridContainer)
    } finally {grid?.setAttribute('aria-busy','false');loading.remove()}
}

export async function initHomePage(config) {
    const {
        featuredSelector,
        filtersSelector,
        gridSelector,
        featuredLabel = "Featured",
        emptyMessage = "Nothing to show yet."
    } = config

    let allItems = []
    const grid=document.querySelector(gridSelector)
    grid?.setAttribute('aria-busy','true')
    const loading=document.createElement('p');loading.className='content-load-status';loading.setAttribute('role','status');loading.textContent='Loading published content…';grid?.before(loading)
    const browsing = typeof window!=="undefined" ? createBrowseHistory() : null
    let discovery, featuredItems = [], followedIds = new Set()
    if (grid) void mountHomeFollowing(grid, ids => {
        followedIds = ids
        if (!discovery) return
        discovery.setFollowed(ids)
        initFeaturedRotator(featuredSelector, discoverContent(featuredItems, {}, ids), featuredLabel, 7000)
    })

    try {
        const loadedContent = await loadAllContent()
        allItems = sortContent(getPublishedContent(loadedContent))


        featuredItems = getHomeFeaturedItems(allItems)

        initFeaturedRotator(featuredSelector, discoverContent(featuredItems, {}, followedIds), featuredLabel, 7000)
        discovery=mountContentDiscovery(document.querySelector(filtersSelector),allItems,items=>renderGrid(gridSelector,items,allItems.length?"No content matches these filters. Try another selection.":emptyMessage))
        discovery.setFollowed(followedIds)
        browsing?.restore()
    } catch (error) {
        console.error("Error loading home page:", error)

        const featuredContainer = document.querySelector(featuredSelector)
        const filtersContainer = document.querySelector(filtersSelector)
        const gridContainer = document.querySelector(gridSelector)

        if (featuredContainer) featuredContainer.innerHTML = ""
        if (filtersContainer) filtersContainer.innerHTML = ""
        showCatalogError(gridContainer)
    } finally {grid?.setAttribute('aria-busy','false');loading.remove()}
}

function showCatalogError(grid) {
    if(!grid)return
    const notice=document.createElement('p');notice.className='content-grid-empty';notice.setAttribute('role','status');notice.textContent=grid.querySelector('a[href]')?'The latest content could not be checked. Previously available content is shown. ':'Unable to load published content right now. '
    const retry=document.createElement('button');retry.type='button';retry.className='content-filter';retry.textContent='Try again';retry.addEventListener('click',()=>location.reload());notice.append(retry);grid.prepend(notice)
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
        const current = publishedContent.find(item => item.id === currentContentId || item.slug === currentContentId) ?? config.currentContent
        const relatedItems = relatedContent(publishedContent, current, {limit})

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

export async function getAllPublishedContent({refresh=false}={}) {
    if(refresh)allContentRequest=null
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
export { normalizeContentMeta, sortContent, createCardMarkup, getFeaturedItem, getHomeFeaturedItems, createFeaturedPanelMarkup, initFeaturedRotator };

