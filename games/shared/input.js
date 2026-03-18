// === INPUT STATE === //
const keyState = {}
const keyPressed = {}

// === INTERNAL HELPERS === //
function normalizeKeyCode(code) {
    if (code === "NumpadEnter") {
        return "Enter"
    }

    return code
}

function shouldPreventDefault(code) {
    return code === "ArrowUp" || code === "ArrowDown"
}

function handleKeyDown(e) {
    const code = normalizeKeyCode(e.code)
    
    if (shouldPreventDefault(code)) {
        e.preventDefault()
    }

    // Only mark as "pressed" if it wasn't already held
    if (!keyState[code]) {
        keyPressed[code] = true
    }

    keyState[code] = true
}

function handleKeyUp(e) {
    const code = normalizeKeyCode(e.code)
    
    if (shouldPreventDefault(code)) {
        e.preventDefault()
    }

    keyState[code] = false
}


// === SETUP === //
function setupInput() {
    window.addEventListener("keydown", handleKeyDown, { passive: false })
    window.addEventListener("keyup", handleKeyUp, { passive: false })
}

// === PUBLIC HELPERS === //
function isKeyDown(code) {
    return !!keyState[code]
}

function wasKeyPressed(code) {
    return !!keyPressed[code]
}

function clearPressedKeys() {
    for (const code in keyPressed) {
        delete keyPressed[code]
    }
}