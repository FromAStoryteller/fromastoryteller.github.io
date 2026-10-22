import {findPublicProfiles,renderProfileCards} from '/systems/community/profile-directory.mjs'
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
const people=document.createElement('section');people.className='search-storytellers';people.hidden=true;people.setAttribute('aria-label','Storyteller results');const peopleHeading=document.createElement('h2');peopleHeading.textContent='Storytellers';const peopleStatus=document.createElement('p');peopleStatus.setAttribute('role','status');const peopleGrid=document.createElement('div'),peopleMore=document.createElement('button');peopleMore.type='button';peopleMore.className='content-filter';peopleMore.textContent='More storytellers';peopleMore.hidden=true;people.append(peopleHeading,peopleStatus,peopleGrid,peopleMore);document.querySelector(resultsSelector).closest('section').before(people);
let contentReady=false,peopleSettled=false,peopleGeneration=0,peopleTimer,peopleCursor=null,peopleQuery='',peopleSeen=new Set();
async function loadPeople(query,append=false){const token=++peopleGeneration;people.hidden=!query;peopleSettled=false;if(!query){peopleSettled=true;if(contentReady)browsing.restore();return;}peopleStatus.textContent='Loading storytellers.';peopleMore.disabled=true;
 if(!append){peopleGrid.replaceChildren();peopleCursor=null;peopleQuery=query;peopleSeen.clear();peopleMore.hidden=true;}
 try{const result=await findPublicProfiles(query,append?peopleCursor:null);if(token!==peopleGeneration)return;const key=JSON.stringify(result.data.next_cursor);if(result.data.next_cursor&&peopleSeen.has(key))throw Error('Storyteller results could not continue.');peopleSeen.add(key);renderProfileCards(peopleGrid,result.data.items,{imageBase:result.imageBase,append});peopleCursor=result.data.next_cursor;peopleMore.hidden=!peopleCursor;peopleStatus.textContent=peopleGrid.children.length?peopleGrid.children.length+' storytellers found.':'No storytellers match this search.';
 }catch{if(token===peopleGeneration){peopleStatus.replaceChildren(document.createTextNode('Storyteller search is temporarily unavailable. '));const retry=document.createElement('button');retry.type='button';retry.className='content-filter';retry.textContent='Retry storyteller search';retry.addEventListener('click',()=>void loadPeople(query,append));peopleStatus.append(retry);}}
 finally{if(token===peopleGeneration){peopleMore.disabled=false;peopleSettled=true;if(contentReady)browsing.restore();}}
}
peopleMore.addEventListener('click',()=>void loadPeople(peopleQuery,true));
function searchPeople(query){peopleSettled=false;peopleGeneration++;clearTimeout(peopleTimer);people.hidden=!query;peopleMore.hidden=true;peopleGrid.replaceChildren();peopleStatus.textContent='Loading storytellers.';peopleTimer=setTimeout(()=>void loadPeople(query),200);}

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
        summary.textContent = `No content results found for "${query}".`
        return
    }

    if (resultsCount === 1) {
        summary.textContent = `1 content result found for "${query}".`
        return
    }

    summary.textContent = `${resultsCount} content results found for "${query}".`
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
    for(const [label,path]of [['Stories','/stories/'],['Games','/games/'],['Tools','/tools/'],['Videos','/videos/'],['Blog','/blog/'],['Storytellers','/storytellers/']]){const a=document.createElement('a');a.className='content-filter';a.href=path;a.textContent=label;nav.append(a);}
    section.append(nav);grid.querySelector('.content-grid-empty')?.replaceWith(section);
}

function runSearch(query,searchProfiles=true) {
    const trimmedQuery = query.trim()
    if(searchProfiles)searchPeople(trimmedQuery)

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
        void getAllPublishedContent().then(items=>{allItems=items;contentReady=true;runSearch(input.value.trim(),false);if(peopleSettled)browsing.restore();}).catch(()=>{contentReady=true;summary.textContent='Content search is temporarily unavailable. You can still search storytellers.';if(peopleSettled)browsing.restore();})

        const initialQuery = getQueryFromUrl()
        input.value = initialQuery
        runSearch(initialQuery)
        // Capture early departures; repeat restoration when both result sections settle.
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
