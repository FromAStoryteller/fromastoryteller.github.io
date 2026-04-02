import {
    getAllPublishedContent,
    searchPublishedContent,
    renderContentGrid
} from "/content/content-system.js"

const form = document.querySelector(".search-page-form")
const input = document.querySelector("#search-page-input")
const summary = document.querySelector("#search-summary")
const suggestionsContainer = document.querySelector("#search-suggestions")
const resultsSelector = "#search-results-grid"

let allItems = []

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

    window.history.replaceState({}, "", url)
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

    suggestionsContainer.innerHTML = suggestions.map(suggestion => `
        <button
            type="button"
            class="search-suggestion-button"
            data-suggestion="${suggestion.replace(/"/g, "&quot;")}"
        >${suggestion}</button>
    `).join("")

    suggestionsContainer.classList.add("is-visible")

    const buttons = suggestionsContainer.querySelectorAll(".search-suggestion-button")

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const suggestion = button.dataset.suggestion || ""
            input.value = suggestion
            setQueryInUrl(suggestion)
            runSearch(suggestion)
            hideSuggestions()
        })
    })
}

function runSearch(query) {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
        updateSummary("", 0)
        renderContentGrid(resultsSelector, [], "Start typing to search the site.")
        return
    }

    const results = searchPublishedContent(allItems, trimmedQuery)
    updateSummary(trimmedQuery, results.length)
    renderContentGrid(resultsSelector, results, `No results found for "${trimmedQuery}".`)   
}

async function initSearchPage() {
    try {
        allItems = await getAllPublishedContent()

        const initialQuery = getQueryFromUrl()
        input.value = initialQuery
        runSearch(initialQuery)

        form.addEventListener("submit", event => {
            event.preventDefault()

            const query = input.value.trim()
            setQueryInUrl(query)
            runSearch(query)
            hideSuggestions()
        })

        input.addEventListener("input", () => {
            const query = input.value.trim()
            setQueryInUrl(query)
            runSearch(query)

            const suggestions = getSuggestions(query, allItems)
            showSuggestions(suggestions)
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