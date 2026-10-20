import {createBrowseHistory} from '/systems/content/browse-state.mjs'
import {
    getAllPublishedContent,
    searchPublishedContent,
    renderContentGrid
} from "/systems/content/content-system.js"

const form = document.querySelector(".search-page-form")
const input = document.querySelector("#search-page-input")
const summary = document.querySelector("#search-summary")
const suggestionsContainer = document.querySelector("#search-suggestions")
const resultsSelector = "#search-results-grid"

let allItems = []
const browsing=createBrowseHistory()

function getQueryFromUrl() {
    const params = new URLSearchParams(window.location.search)
    return (params.get("q") || "").trim()
}

function setQueryInUrl(query) {
    const url = new URL(window.location.href)

    if (query) {
        url.searchParams.set("q", query)
    } else {
        url.searchParams.delete("q")
    }

    window.history.replaceState({...window.history.state}, "", url)
}

function updateSummary(query, resultsCount) {
    if (!query) {
        summary.textContent = "Start typing to search the site."
        return
    }

    if (resultsCount === 0) {
        summary.textContent = `No results found for "${query}".`
        return
    }

    if (resultsCount === 1) {
        summary.textContent = `1 result found for "${query}".`
        return
    }

    summary.textContent = `${resultsCount} results found for "${query}".`
}

function getSuggestions(query, items, limit = 6) {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
        return []
    }

    const seen = new Set()
    const suggestions = []

    items.forEach(item => {
        const title = item.title || ""
        const cardTitle = item.card?.title || ""
        const tags = Array.isArray(item.card?.tags) ? item.card.tags : []

        ;[title, cardTitle, ...tags].forEach(value => {
            const suggestion = String(value || "").trim()
            const normalizedSuggestion = suggestion.toLowerCase()

            if (!suggestion) return
            if (!normalizedSuggestion.includes(normalizedQuery)) return
            if (seen.has(normalizedSuggestion)) return

            seen.add(normalizedSuggestion)
            suggestions.push(suggestion)
        })
    })

    return suggestions.slice(0, limit)
}

function hideSuggestions() {
    suggestionsContainer.innerHTML = ""
    suggestionsContainer.classList.remove("is-visible")
}

function showSuggestions(suggestions) {
    if (!suggestions.length) {
        hideSuggestions()
        return
    }

    suggestionsContainer.replaceChildren(...suggestions.map(suggestion=>{
        const button=document.createElement('button');button.type='button';button.className='search-suggestion-button';button.dataset.suggestion=suggestion;button.textContent=suggestion;return button;
    }))

    suggestionsContainer.classList.add("is-visible")

    const buttons = suggestionsContainer.querySelectorAll(".search-suggestion-button")

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const suggestion = button.dataset.suggestion || ""
            input.value = suggestion
            setQueryInUrl(suggestion)
            runSearch(suggestion)
            hideSuggestions()
            browsing.remember()
        })
    })
}

function showRecovery(query){
    const grid=document.querySelector(resultsSelector),section=document.createElement('section');section.className='content-grid-empty search-recovery';
    const hint=document.createElement('p');hint.textContent=query?'Try another word, or browse a category.':'You can also browse by category.';section.append(hint);
    if(query){const clear=document.createElement('button');clear.type='button';clear.className='content-filter';clear.textContent='Clear search';clear.addEventListener('click',()=>{input.value='';setQueryInUrl('');runSearch('');hideSuggestions();browsing.remember();input.focus({preventScroll:true});});section.append(clear);}
    const nav=document.createElement('nav');nav.setAttribute('aria-label','Browse content categories');
    for(const [label,path]of [['Stories','/stories/'],['Games','/games/'],['Tools','/tools/'],['Videos','/videos/'],['Blog','/blog/']]){const a=document.createElement('a');a.className='content-filter';a.href=path;a.textContent=label;nav.append(a);}
    section.append(nav);grid.querySelector('.content-grid-empty')?.replaceWith(section);
}

function runSearch(query) {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
        updateSummary("", 0)
        renderContentGrid(resultsSelector, [], "Start typing to search the site.")
        showRecovery("")
        return
    }

    const results = searchPublishedContent(allItems, trimmedQuery)
    updateSummary(trimmedQuery, results.length)
    renderContentGrid(resultsSelector, results, `No results found for "${trimmedQuery}".`)
    if(!results.length)showRecovery(trimmedQuery)
}

async function initSearchPage() {
    try {
        allItems = await getAllPublishedContent()

        const initialQuery = getQueryFromUrl()
        input.value = initialQuery
        runSearch(initialQuery)
        browsing.restore()

        form.addEventListener("submit", event => {
            event.preventDefault()

            const query = input.value.trim()
            setQueryInUrl(query)
            runSearch(query)
            hideSuggestions()
            browsing.remember()
        })

        input.addEventListener("input", () => {
            const query = input.value.trim()
            setQueryInUrl(query)
            runSearch(query)

            const suggestions = getSuggestions(query, allItems)
            showSuggestions(suggestions)
            browsing.remember()
        })

        input.addEventListener("focus", () => {
            const query = input.value.trim()
            const suggestions = getSuggestions(query, allItems)
            showSuggestions(suggestions)
        })

        document.addEventListener("click", event => {
            const clickedInsideInputWrap = event.target.closest(".search-page-input-wrap")

            if (!clickedInsideInputWrap) {
                hideSuggestions()
            }
        })
    } catch (error) {
        console.error("Error loading search page:", error)
        summary.textContent = "Unable to load search right now."
        renderContentGrid(resultsSelector, [], "Unable to load search right now.")
    }
}

initSearchPage()