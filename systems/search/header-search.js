import {findPublicProfiles} from '../community/profile-directory.mjs';
import {publicProfileUrl} from '../community/profiles.mjs';
import { getAllPublishedContent, searchPublishedContent } from "../content/content-system.js";
import {remoteDiscovery,queryPublicContent} from '../content/public-query.mjs';

export function syncHeaderSearchQuery() {
  const params = new URLSearchParams(window.location.search)
  const query = params.get("q") || ""

  const searchInputs = document.querySelectorAll('.site-search input[name="q"]')
  searchInputs.forEach(input => {
    if (document.activeElement !== input) input.value = query
  })
}

export async function initHeaderSearch() {
  const input = document.querySelector(".site-search-input")
  const suggestionsContainer = document.querySelector(".site-search-suggestions")
  const form = document.querySelector(".site-search")

  if (!input || !suggestionsContainer || !form) return

  let allItems = [], profileGeneration=0, profileTimer, suggestionsOpen=false

  try {
    if(!remoteDiscovery())void getAllPublishedContent().then(items=>{allItems=items;if(document.activeElement===input)updateSuggestions(input.value.trim());}).catch(()=>{})
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

  function showSuggestions(suggestions,profiles=[]) {
    suggestionsContainer.innerHTML = ""

    if (!suggestions.length&&!profiles.length) {
      hideSuggestions()
      return
    }

    profiles.forEach(profile=>{const a=document.createElement('a');a.className='site-search-suggestion';a.href=publicProfileUrl(profile.public_id);a.textContent=profile.display_name+' - Storyteller';suggestionsContainer.append(a);});
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

  function updateSuggestions(query){suggestionsOpen=true;const token=++profileGeneration;clearTimeout(profileTimer);const content=getSuggestions(query);showSuggestions(content);if(!query)return;profileTimer=setTimeout(async()=>{const [people,results]=await Promise.allSettled([findPublicProfiles(query),remoteDiscovery()?queryPublicContent({q:query,limit:5}):Promise.resolve({items:content})]);if(suggestionsOpen&&token===profileGeneration&&input.value.trim()===query)showSuggestions(results.status==='fulfilled'?results.value.items:content,people.status==='fulfilled'?people.value.data.items.slice(0,3):[]);},200);}
  form.addEventListener("submit", event => {
    event.preventDefault()

    const query = input.value.trim()

    suggestionsOpen=false;profileGeneration++;clearTimeout(profileTimer);hideSuggestions()
    goToSearchPage(query)
  })

  input.addEventListener("input", () => {
    const query = input.value.trim()
    updateSuggestions(query)
  })

  input.addEventListener("focus", () => {
    const query = input.value.trim()
    updateSuggestions(query)
  })

  suggestionsContainer.addEventListener("click", event => {
    const button = event.target.closest("button.site-search-suggestion")

    if (!button) return

    event.preventDefault()

    const suggestion = button.dataset.suggestion || ""

    input.value = suggestion
    hideSuggestions()
    goToSearchPage(suggestion)
  })

  document.addEventListener("pointerdown", event => {
    if (!event.target.closest(".site-search-wrap")) {
      suggestionsOpen=false;profileGeneration++;clearTimeout(profileTimer);hideSuggestions()
    }
  })
}
