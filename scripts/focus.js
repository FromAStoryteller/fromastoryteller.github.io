// Focus restoration keeps its accessible destination without borrowing the
// keyboard ring from the dismissed surface. The next real key restores styling.
let restoredElement = null
let keyboardInteraction = false
export function isKeyboardInteraction() { return keyboardInteraction }

function clearRestoredFocus() {
    restoredElement?.removeAttribute("data-restored-focus")
    restoredElement?.removeAttribute("data-escape-focus")
    restoredElement = null
}

globalThis.document?.addEventListener("keydown", event => {
    if (!event.isTrusted || ["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock", "NumLock", "ScrollLock"].includes(event.key)) return
    if (event.key === "Escape") {
        clearRestoredFocus()
        const active = document.activeElement
        if (active && active !== document.body && active !== document.documentElement) {
            restoredElement = active
            active.setAttribute("data-escape-focus", "")
        }
        return
    }
    keyboardInteraction = true
    clearRestoredFocus()
    document.dispatchEvent(new Event("focusmodalitychange"))
}, true)
globalThis.document?.addEventListener("pointerdown", event => {
    if (!event.isTrusted) return
    keyboardInteraction = false
    clearRestoredFocus()
    document.dispatchEvent(new Event("focusmodalitychange"))
}, true)
globalThis.document?.addEventListener("focusin", event => {
    if (event.target !== restoredElement) clearRestoredFocus()
}, true)
globalThis.document?.addEventListener("focusout", event => {
    if (event.target === restoredElement) clearRestoredFocus()
}, true)

export function restoreFocus(element, {silent = false} = {}) {
    clearRestoredFocus()
    if (!element) return
    if (silent) {
        restoredElement = element
        element.setAttribute("data-restored-focus", "")
    }
    element.focus({preventScroll: true})
    if (document.activeElement !== element) clearRestoredFocus()
}

