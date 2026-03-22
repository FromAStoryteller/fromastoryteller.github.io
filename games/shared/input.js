// === INPUT STATE === //
export const Input = {
    keyState: {},
    keyPressed: {},
    keyRepeatTimers: {},

    // === INTERNAL HELPERS === //
    normalizeKeyCode(code) {
        if (code === "NumpadEnter") {
            return "Enter"
        }

        return code
    },

    shouldPreventDefault(code) {
        return (
            code === "ArrowUp" ||
            code === "ArrowDown" ||
            code === "ArrowLeft" ||
            code === "ArrowRight" ||
            code === "Space" ||
            code === "Enter"
        )
    },

    handleKeyDown(e) {
        const code = this.normalizeKeyCode(e.code)
        
        if (this.shouldPreventDefault(code)) {
            e.preventDefault()
        }

        // Only mark as "pressed" if it wasn't already held
        if (!this.keyState[code]) {
            this.keyPressed[code] = true
            this.keyRepeatTimers[code] = {
                nextTriggerTime: performance.now() + 300
            }
        }

        this.keyState[code] = true
    },

    handleKeyUp(e) {
        const code = this.normalizeKeyCode(e.code)
        
        if (this.shouldPreventDefault(code)) {
            e.preventDefault()
        }

        this.keyState[code] = false
        delete this.keyRepeatTimers[code]
    },

    // === SETUP === //
    init() {
        window.addEventListener("keydown", (e) => this.handleKeyDown(e), { passive: false })
        window.addEventListener("keyup", (e) => this.handleKeyUp(e), { passive: false })
    },

    // === PUBLIC HELPERS === //
    isDown(code) {
        return !!this.keyState[code]
    },

    wasPressed(code) {
        return !!this.keyPressed[code]
    },

    wasPressedOrRepeated(code, initialDelay = 300, repeatInterval = 60) {
        if (this.wasPressed(code)) {
            if (this.keyRepeatTimers[code]) {
                this.keyRepeatTimers[code].nextTriggerTime = performance.now() + initialDelay
            }
            return true
        }

        if (!this.isDown(code)) return false

        const timer = this.keyRepeatTimers[code]
        if (!timer) return false

        const now = performance.now()

        if (now >= timer.nextTriggerTime) {
            timer.nextTriggerTime = now + repeatInterval
            return true
        }

        return false
    },

    clearPressed() {
        for (const code in this.keyPressed) {
            delete this.keyPressed[code]
        }
    }
}