import { getAllPublishedContent, searchPublishedContent } from "../content/content-system.js";

export function syncHeaderSearchQuery() {
  const params = new URLSearchParams(window.location.search)
  const query = params.get("q") || ""

  const searchInputs = document.querySelectorAll('.site-search input[name="q"]')
  searchInputs.forEach(input => {
    input.value = query
  })
}

export async function initHeaderSearch() {
  const input = document.querySelector(".site-search-input")
  const suggestionsContainer = document.querySelector(".site-search-suggestions")
  const form = document.querySelector(".site-search")

  if (!input || !suggestionsContainer || !form) return

  let allItems = []

  try {
    allItems = await getAllPublishedContent()
  } catch (err) {
    console.error("Header search failed to load content:", err)
  }

  function hideSuggestions() {
    suggestionsContainer.innerHTML = ""
    suggestionsContainer.classList.remove("is-visible")
  }

  function goToSearchPage(query) {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) return

    const url = new URL("/search/", window.location.origin)
    url.searchParams.set("q", trimmedQuery)

    window.location.href = url.toString()
  }

  function showSuggestions(suggestions) {
    suggestionsContainer.innerHTML = ""

    if (!suggestions.length) {
      hideSuggestions()
      return
    }

    suggestions.forEach(item => {
      const button = document.createElement("button")

      button.type = "button"
      button.className = "site-search-suggestion"
      button.dataset.suggestion = item.title
      button.textContent = item.title

      suggestionsContainer.appendChild(button)
    })

    suggestionsContainer.classList.add("is-visible")
  }

  function getSuggestions(query) {
    if (!query) return []

    const results = searchPublishedContent(allItems, query)
    return results.slice(0, 5)
  }

  form.addEventListener("submit", event => {
    event.preventDefault()

    const query = input.value.trim()

    hideSuggestions()
    goToSearchPage(query)
  })

  input.addEventListener("input", () => {
    const query = input.value.trim()
    const suggestions = getSuggestions(query)

    showSuggestions(suggestions)
  })

  input.addEventListener("focus", () => {
    const query = input.value.trim()
    const suggestions = getSuggestions(query)

    showSuggestions(suggestions)
  })

  suggestionsContainer.addEventListener("click", event => {
    const button = event.target.closest(".site-search-suggestion")

    if (!button) return

    event.preventDefault()

    const suggestion = button.dataset.suggestion || ""

    input.value = suggestion
    hideSuggestions()
    goToSearchPage(suggestion)
  })

  document.addEventListener("pointerdown", event => {
    if (!event.target.closest(".site-search-wrap")) {
      hideSuggestions()
    }
  })
}
