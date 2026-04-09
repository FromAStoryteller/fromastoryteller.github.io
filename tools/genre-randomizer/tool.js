const genres = [
    { name: "Action", timesSelected: 0, lastSelectedRound: -1},
    { name: "Adventure", timesSelected: 0, lastSelectedRound: -1},
    { name: "Comedy", timesSelected: 0, lastSelectedRound: -1},
    { name: "Coming-of-Age", timesSelected: 0, lastSelectedRound: -1},
    { name: "Crime", timesSelected: 0, lastSelectedRound: -1},
    { name: "Drama", timesSelected: 0, lastSelectedRound: -1},
    { name: "Dystopian", timesSelected: 0, lastSelectedRound: -1},
    { name: "Fantasy", timesSelected: 0, lastSelectedRound: -1},
    { name: "Historical Fiction", timesSelected: 0, lastSelectedRound: -1},
    { name: "Horror", timesSelected: 0, lastSelectedRound: -1},
    { name: "Mystery", timesSelected: 0, lastSelectedRound: -1},
    { name: "Romance", timesSelected: 0, lastSelectedRound: -1},
    { name: "Satire", timesSelected: 0, lastSelectedRound: -1},
    { name: "Sci-Fi", timesSelected: 0, lastSelectedRound: -1},
    { name: "Supernatural", timesSelected: 0, lastSelectedRound: -1},
    { name: "Thriller", timesSelected: 0, lastSelectedRound: -1}
]

let currentRound = 0
let lastSelectedGenre = null

function getGenreWeight(genre) {
    const roundsSinceLastSeen = 
        genre.lastSelectedRound === -1
        ? currentRound + 1
        : currentRound - genre.lastSelectedRound

    const recencyBoost = 1 + roundsSinceLastSeen
    const frequencyPenalty = 1 + genre.timesSelected * 0.25

    return recencyBoost / frequencyPenalty
}

function getAvailableGenres() {
    return genres.filter(genre => genre.name !== lastSelectedGenre)
}

function weightedRandomSelect(items, getWeight) {
    const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0)
    let random = Math.random() * totalWeight

    for (const item of items) {
        random -= getWeight(item)
        if (random <= 0) {
            return item
        }
    }

    return items[items.length - 1]
}

function selectGenre() {
    currentRound++

    const availableGenres = getAvailableGenres()

    const selectedGenre = weightedRandomSelect(availableGenres, getGenreWeight)

    selectedGenre.timesSelected++
    selectedGenre.lastSelectedRound = currentRound
    lastSelectedGenre = selectedGenre.name
    
    return selectedGenre
}

const resultElement = document.getElementById("tool-result")
const buttonElement = document.getElementById("tool-action-button")

if (resultElement && buttonElement) {
    buttonElement.addEventListener("click", () => {
        const genre = selectGenre()
        resultElement.textContent = genre.name
    })
}