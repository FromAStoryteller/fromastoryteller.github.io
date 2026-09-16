// =======================================
// FROM A STORYTELLER - INPUT.JS
// Version: 3.0
// Shared keyboard + single-touch / pointer input
// =======================================

export const Input = {
    initialized: false,

    keyState: {},
    keyPressed: {},
    keyRepeatTimers: {},

    pointerState: {
        active: false,
        pointerId: null,
        pointerType: null,
        clientX: 0,
        clientY: 0,
        gameContainer: null,
        captureElement: null
    },

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

    isTouchPointerType(pointerType) {
        return pointerType === "touch" || pointerType === "pen"
    },

    getPlayableCanvasFromTarget(target) {
        if (!(target instanceof HTMLCanvasElement)) {
            return null
        }

        const gameContainer = target.closest(".game-canvas")

        if (!gameContainer) {
            return null
        }

        return {
            canvas: target,
            gameContainer
        }
    },

    handlePointerDown(e) {
        if (!this.isTouchPointerType(e.pointerType)) {
            return
        }

        // First mobile pass: track one gameplay finger only.
        if (this.pointerState.active) {
            return
        }

        const playable = this.getPlayableCanvasFromTarget(e.target)

        if (!playable) {
            return
        }

        this.pointerState.active = true
        this.pointerState.pointerId = e.pointerId
        this.pointerState.pointerType = e.pointerType
        this.pointerState.clientX = e.clientX
        this.pointerState.clientY = e.clientY
        this.pointerState.gameContainer = playable.gameContainer
        this.pointerState.captureElement = playable.canvas

        try {
            playable.canvas.setPointerCapture(e.pointerId)
        } catch {
            // Pointer capture is optional.
        }

        e.preventDefault()
    },

    handlePointerMove(e) {
        if (
            !this.pointerState.active ||
            e.pointerId !== this.pointerState.pointerId
        ) {
            return
        }

        this.pointerState.clientX = e.clientX
        this.pointerState.clientY = e.clientY

        e.preventDefault()
    },

    handlePointerEnd(e) {
        if (
            !this.pointerState.active ||
            e.pointerId !== this.pointerState.pointerId
        ) {
            return
        }

        this.pointerState.clientX = e.clientX
        this.pointerState.clientY = e.clientY

        const captureElement = this.pointerState.captureElement

        try {
            if (
                captureElement &&
                captureElement.hasPointerCapture?.(e.pointerId)
            ) {
                captureElement.releasePointerCapture(e.pointerId)
            }
        } catch {
            // Safe fallback for partial support.
        }

        this.pointerState.active = false
        this.pointerState.pointerId = null
        this.pointerState.pointerType = null
        this.pointerState.gameContainer = null
        this.pointerState.captureElement = null

        e.preventDefault()
    },

    prepareTouchGameCanvases() {
        document.querySelectorAll(".game-canvas canvas").forEach((canvas) => {
            canvas.style.touchAction = "none"
        })
    },

    addTouchPauseButtons() {
        document.querySelectorAll(".game-canvas").forEach((gameContainer) => {
            if (gameContainer.querySelector(".game-touch-pause-button")) {
                return
            }

            const button = document.createElement("button")
            button.type = "button"
            button.className = "game-touch-pause-button"
            button.setAttribute("aria-label", "Pause game")
            button.setAttribute("title", "Pause")

            button.innerHTML = `
                <span class="game-touch-pause-icon" aria-hidden="true">
                    <span></span>
                    <span></span>
                </span>
            `

            button.addEventListener(
                "pointerdown",
                (event) => {
                    event.preventDefault()
                    event.stopPropagation()

                    // Reuse each game's existing Escape-to-pause route.
                    this.triggerPress("Escape")
                },
                { passive: false }
            )

            gameContainer.appendChild(button)
        })
    },

    resolveGameContainer(containerOrId) {
        if (typeof containerOrId === "string") {
            return document.getElementById(containerOrId)
        }

        if (containerOrId instanceof HTMLElement) {
            return containerOrId
        }

        return null
    },

    getLogicalCanvasSize(canvas, rect) {
        /*
           p5 normally keeps its logical presentation width/height as inline
           px values. Expanded View may visually override those values, but
           canvas.style still preserves the game's logical coordinate size.
        */
        const inlineWidth = canvas.style.width?.trim() || ""
        const inlineHeight = canvas.style.height?.trim() || ""

        const parsedWidth = inlineWidth.endsWith("px")
            ? Number.parseFloat(inlineWidth)
            : NaN

        const parsedHeight = inlineHeight.endsWith("px")
            ? Number.parseFloat(inlineHeight)
            : NaN

        const pixelRatio = Math.max(1, window.devicePixelRatio || 1)

        const logicalWidth =
            Number.isFinite(parsedWidth) && parsedWidth > 0
                ? parsedWidth
                : Math.max(1, canvas.width / pixelRatio || rect.width)

        const logicalHeight =
            Number.isFinite(parsedHeight) && parsedHeight > 0
                ? parsedHeight
                : Math.max(1, canvas.height / pixelRatio || rect.height)

        return {
            width: logicalWidth,
            height: logicalHeight
        }
    },

    // === SETUP === //

    init() {
        if (this.initialized) {
            this.prepareTouchGameCanvases()
            this.addTouchPauseButtons()
            return
        }

        this.initialized = true

        window.addEventListener(
            "keydown",
            (e) => this.handleKeyDown(e),
            { passive: false }
        )

        window.addEventListener(
            "keyup",
            (e) => this.handleKeyUp(e),
            { passive: false }
        )

        window.addEventListener(
            "pointerdown",
            (e) => this.handlePointerDown(e),
            { passive: false }
        )

        window.addEventListener(
            "pointermove",
            (e) => this.handlePointerMove(e),
            { passive: false }
        )

        window.addEventListener(
            "pointerup",
            (e) => this.handlePointerEnd(e),
            { passive: false }
        )

        window.addEventListener(
            "pointercancel",
            (e) => this.handlePointerEnd(e),
            { passive: false }
        )

        this.prepareTouchGameCanvases()
        this.addTouchPauseButtons()
    },

    // === PUBLIC KEYBOARD HELPERS === //

    isDown(code) {
        return !!this.keyState[code]
    },

    wasPressed(code) {
        return !!this.keyPressed[code]
    },

    wasPressedOrRepeated(code, initialDelay = 300, repeatInterval = 60) {
        if (this.wasPressed(code)) {
            if (this.keyRepeatTimers[code]) {
                this.keyRepeatTimers[code].nextTriggerTime =
                    performance.now() + initialDelay
            }

            return true
        }

        if (!this.isDown(code)) {
            return false
        }

        const timer = this.keyRepeatTimers[code]

        if (!timer) {
            return false
        }

        const now = performance.now()

        if (now >= timer.nextTriggerTime) {
            timer.nextTriggerTime = now + repeatInterval
            return true
        }

        return false
    },

    triggerPress(code) {
        const normalizedCode = this.normalizeKeyCode(code)
        this.keyPressed[normalizedCode] = true
    },

    // === PUBLIC TOUCH / POINTER HELPERS === //

    isTouchActive() {
        return (
            this.pointerState.active &&
            this.isTouchPointerType(this.pointerState.pointerType)
        )
    },

    getPointerPosition(containerOrId) {
        if (!this.isTouchActive()) {
            return null
        }

        const gameContainer = this.resolveGameContainer(containerOrId)

        if (
            !gameContainer ||
            gameContainer !== this.pointerState.gameContainer
        ) {
            return null
        }

        const canvas = gameContainer.querySelector("canvas")

        if (!canvas) {
            return null
        }

        const rect = canvas.getBoundingClientRect()

        if (rect.width <= 0 || rect.height <= 0) {
            return null
        }

        const logicalSize = this.getLogicalCanvasSize(canvas, rect)

        const x =
            (this.pointerState.clientX - rect.left) *
            (logicalSize.width / rect.width)

        const y =
            (this.pointerState.clientY - rect.top) *
            (logicalSize.height / rect.height)

        return {
            x,
            y,
            inside:
                this.pointerState.clientX >= rect.left &&
                this.pointerState.clientX <= rect.right &&
                this.pointerState.clientY >= rect.top &&
                this.pointerState.clientY <= rect.bottom
        }
    },

    clearPressed() {
        for (const code in this.keyPressed) {
            delete this.keyPressed[code]
        }
    }
}