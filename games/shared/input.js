// === BROWSER INPUT BEHAVIOR === //

function preventArrowKeyScroll(e) {
    if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault()
    }
}

function setupArrowKeyScrollBlocker() {
    window.addEventListener("keydown", preventArrowKeyScroll, { passive: false })
    window.addEventListener("keyup", preventArrowKeyScroll, { passive: false })
}