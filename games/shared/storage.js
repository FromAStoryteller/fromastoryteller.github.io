

function saveToStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
}

function loadFromStorage(key, fallbackValue) {
    const storedValue = localStorage.getItem(key)

    if (storedValue === null) {
        return fallbackValue
    }

    try {
        return JSON.parse(storedValue)
    } catch {
        return fallbackValue
    }
}