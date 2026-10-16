import { optionalStorageAllowed } from '../privacy/storage-choice.mjs';
export const Storage = {
    save(key, value) {
        if (!optionalStorageAllowed(key)) return;
        try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Playing remains available. */ }
    },

    load(key, fallbackValue) {
        if (!optionalStorageAllowed(key)) return fallbackValue;
        let storedValue;
        try { storedValue = localStorage.getItem(key) } catch { return fallbackValue; }

        if (storedValue === null) {
            return fallbackValue
        }

        try {
            return JSON.parse(storedValue)
        } catch {
            return fallbackValue
        }
    }
}
