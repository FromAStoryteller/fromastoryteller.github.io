// =======================================
// FROM A STORYTELLER - CANVAS.JS
// Version: 2.4
// Shared canvas and immersive fullscreen helpers
// =======================================

const GAME_ASPECT_WIDTH = 16
const GAME_ASPECT_HEIGHT = 9
const GAME_ASPECT_RATIO = GAME_ASPECT_WIDTH / GAME_ASPECT_HEIGHT
const MAX_EXPANDED_PIXEL_DENSITY = 3
const MAX_EXPANDED_BACKING_WIDTH = 2560
const MAX_EXPANDED_BACKING_HEIGHT = 1440

export const CanvasManager = {
    managers: new Map(),
    fullscreenState: new WeakMap(),

    resolveContainer(containerOrId) {
        if (typeof containerOrId === "string") {
            return document.getElementById(containerOrId)
        }

        if (containerOrId instanceof HTMLElement) {
            return containerOrId
        }

        return null
    },

    getContainer(containerId) {
        return this.resolveContainer(containerId)
    },

    getFrame(containerOrId) {
        const container = this.resolveContainer(containerOrId)

        if (!container) {
            return null
        }

        return container.closest(".game-shell-frame") || container
    },

    getDimensions(containerOrId) {
        const container = this.resolveContainer(containerOrId)

        if (!container) {
            return { width: 1, height: 1 }
        }

        const width = Math.max(1, Math.round(container.clientWidth))
        const height = Math.max(1, Math.round(width / GAME_ASPECT_RATIO))

        return { width, height }
    },

    createResponsive(containerId) {
        const container = this.getContainer(containerId)

        if (!container) {
            throw new Error(`Canvas container not found: ${containerId}`)
        }

        this.prepareDisplay(containerId)

        const { width, height } = this.getDimensions(container)

        const canvas = createCanvas(width, height)
        canvas.parent(containerId)

        this.observeContainer(containerId)

        return canvas
    },

    resizeResponsive(containerId) {
        const container = this.getContainer(containerId)

        if (!container || typeof resizeCanvas !== "function") {
            return
        }

        /*
           Immersive fullscreen scales the existing rendered canvas with CSS.
           Keeping the logical p5 width/height unchanged prevents each game's
           object coordinates from jumping to stale positions.
        */
        if (this.isFullscreen(container)) {
            return
        }

        const { width, height } = this.getDimensions(container)
        const manager = this.managers.get(containerId)

        if (
            manager &&
            manager.lastWidth === width &&
            manager.lastHeight === height
        ) {
            return
        }

        resizeCanvas(width, height)

        if (manager) {
            manager.lastWidth = width
            manager.lastHeight = height
        }
    },

    prepareDisplay(containerId) {
        const container = this.getContainer(containerId)

        if (!container || container.dataset.gameDisplayReady === "true") {
            return
        }

        container.dataset.gameDisplayReady = "true"

        this.addRotateOverlay(containerId)
    },

    addRotateOverlay(containerId) {
        const container = this.getContainer(containerId)

        if (!container || container.querySelector(".game-rotate-overlay")) {
            return
        }

        const overlay = document.createElement("div")
        overlay.className = "game-rotate-overlay"
        overlay.setAttribute("aria-live", "polite")
        overlay.innerHTML = `
            <div class="game-rotate-overlay-inner">
                <span class="game-rotate-icon" aria-hidden="true">↻</span>
                <strong>Rotate your device to play</strong>
                <p>Turn your device sideways for the best game experience.</p>
            </div>
        `

        container.appendChild(overlay)
    },

    getViewportDimensions() {
        /*
           visualViewport is useful on phones/tablets because it reflects the
           actually visible browser area as browser chrome appears/disappears.
        */
        const viewport = window.visualViewport

        return {
            width: Math.max(
                1,
                Math.floor(viewport?.width || window.innerWidth || document.documentElement.clientWidth)
            ),
            height: Math.max(
                1,
                Math.floor(viewport?.height || window.innerHeight || document.documentElement.clientHeight)
            )
        }
    },

    getLargestAspectFit(viewportWidth, viewportHeight) {
        let width = viewportWidth
        let height = Math.round(width / GAME_ASPECT_RATIO)

        if (height > viewportHeight) {
            height = viewportHeight
            width = Math.round(height * GAME_ASPECT_RATIO)
        }

        return {
            width: Math.max(1, width),
            height: Math.max(1, height)
        }
    },

    getCanvasLogicalSize(container, renderDensity = 1) {
        const canvas = container?.querySelector("canvas")

        if (!canvas) {
            return null
        }

        const inlineWidth = canvas.style.width?.trim() || ""
        const inlineHeight = canvas.style.height?.trim() || ""
        const parsedWidth = inlineWidth.endsWith("px")
            ? Number.parseFloat(inlineWidth)
            : NaN
        const parsedHeight = inlineHeight.endsWith("px")
            ? Number.parseFloat(inlineHeight)
            : NaN
        const safeDensity = Math.max(1, renderDensity || 1)

        return {
            width: Number.isFinite(parsedWidth) && parsedWidth > 0
                ? parsedWidth
                : Math.max(1, canvas.width / safeDensity),
            height: Number.isFinite(parsedHeight) && parsedHeight > 0
                ? parsedHeight
                : Math.max(1, canvas.height / safeDensity)
        }
    },

    getExpandedPixelDensity({
        displayWidth,
        displayHeight,
        logicalWidth,
        logicalHeight,
        devicePixelRatio = 1,
        embeddedDensity = 1
    }) {
        const safeLogicalWidth = Math.max(1, logicalWidth || 1)
        const safeLogicalHeight = Math.max(1, logicalHeight || 1)
        const safeDevicePixelRatio = Math.max(1, devicePixelRatio || 1)
        const safeEmbeddedDensity = Math.max(1, embeddedDensity || 1)
        const displayScale = Math.max(
            Math.max(1, displayWidth || 1) / safeLogicalWidth,
            Math.max(1, displayHeight || 1) / safeLogicalHeight
        )
        const desiredDensity = displayScale * safeDevicePixelRatio
        const cappedDensity = Math.min(
            MAX_EXPANDED_PIXEL_DENSITY,
            MAX_EXPANDED_BACKING_WIDTH / safeLogicalWidth,
            MAX_EXPANDED_BACKING_HEIGHT / safeLogicalHeight
        )
        const roundedDensity = Math.ceil(
            Math.min(desiredDensity, cappedDensity) * 4
        ) / 4

        /* Never reduce an already sharper embedded canvas on expansion. */
        return Math.max(safeEmbeddedDensity, roundedDensity)
    },

    getCurrentPixelDensity() {
        if (typeof pixelDensity !== "function") {
            return Math.max(1, window.devicePixelRatio || 1)
        }

        return Math.max(1, Number(pixelDensity()) || 1)
    },

    applyExpandedRenderDensity(container, display) {
        const frame = this.getFrame(container)
        const state = frame ? this.fullscreenState.get(frame) : null

        if (!state || typeof pixelDensity !== "function") {
            return
        }

        const embeddedDensity = state.embeddedRenderDensity
        const logicalSize = this.getCanvasLogicalSize(
            container,
            embeddedDensity
        )

        if (!logicalSize) {
            return
        }

        const expandedDensity = this.getExpandedPixelDensity({
            displayWidth: display.width,
            displayHeight: display.height,
            logicalWidth: logicalSize.width,
            logicalHeight: logicalSize.height,
            devicePixelRatio: window.devicePixelRatio,
            embeddedDensity
        })

        if (Math.abs(this.getCurrentPixelDensity() - expandedDensity) > 0.01) {
            pixelDensity(expandedDensity)
        }

        state.expandedRenderDensity = expandedDensity
    },

    restoreEmbeddedRenderDensity(state) {
        if (
            !state ||
            typeof pixelDensity !== "function" ||
            !Number.isFinite(state.embeddedRenderDensity)
        ) {
            return
        }

        if (
            Math.abs(
                this.getCurrentPixelDensity() - state.embeddedRenderDensity
            ) > 0.01
        ) {
            pixelDensity(state.embeddedRenderDensity)
        }
    },

    applyExpandedDisplaySize(containerOrId) {
        const container = this.resolveContainer(containerOrId)

        if (!container || !this.isFullscreen(container)) {
            return
        }

        const viewport = this.getViewportDimensions()
        const display = this.getLargestAspectFit(
            viewport.width,
            viewport.height
        )

        /*
           IMPORTANT:
           We resize only the DOM presentation of the game container here.
           The logical p5 canvas width/height remain unchanged, which keeps
           game-world coordinates stable mid-game.
        */
        container.style.width = `${display.width}px`
        container.style.height = `${display.height}px`
        this.applyExpandedRenderDensity(container, display)
    },

    isFullscreen(containerOrId) {
        const frame = this.getFrame(containerOrId)

        return Boolean(frame && frame.classList.contains("is-game-fullscreen"))
    },

    toggleFullscreen(containerOrId) {
        const container = this.resolveContainer(containerOrId)
        const frame = this.getFrame(container)

        if (!container || !frame) {
            return
        }

        const enteringFullscreen = !this.isFullscreen(container)

        if (enteringFullscreen) {
            const frameRect = frame.getBoundingClientRect()

            /*
               Leave a placeholder behind so the underlying page keeps the
               same height and the user's scroll position does not jump.
            */
            const placeholder = document.createElement("div")
            placeholder.className = "game-expanded-placeholder"
            placeholder.style.width = `${frameRect.width}px`
            placeholder.style.height = `${frameRect.height}px`
            placeholder.style.visibility = "hidden"
            placeholder.setAttribute("aria-hidden", "true")

            frame.parentNode.insertBefore(placeholder, frame)

            this.fullscreenState.set(frame, {
                parent: frame.parentNode,
                placeholder,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                containerInlineWidth: container.style.width,
                containerInlineHeight: container.style.height,
                embeddedRenderDensity: this.getCurrentPixelDensity(),
                expandedRenderDensity: null
            })

            frame.classList.add("is-game-fullscreen")
            document.body.classList.add("game-fullscreen-active")
            document.body.appendChild(frame)

            /*
               Explicitly calculate and apply the largest possible 16:9 size.
               This fixes the previous behaviour where the overlay expanded
               but the game display itself stayed at its embedded dimensions.
            */
            this.applyExpandedDisplaySize(container)
        } else {
            const state = this.fullscreenState.get(frame)

            if (state?.placeholder?.parentNode) {
                state.placeholder.parentNode.replaceChild(
                    frame,
                    state.placeholder
                )
            } else if (state?.parent) {
                state.parent.appendChild(frame)
            }

            container.style.width = state?.containerInlineWidth || ""
            container.style.height = state?.containerInlineHeight || ""

            frame.classList.remove("is-game-fullscreen")
            document.body.classList.remove("game-fullscreen-active")
            this.restoreEmbeddedRenderDensity(state)
            this.fullscreenState.delete(frame)

            if (state) {
                requestAnimationFrame(() => {
                    window.scrollTo(state.scrollX, state.scrollY)
                })
            }
        }

        document.dispatchEvent(new CustomEvent("gamefullscreenchange", {
            detail: {
                container,
                frame,
                isFullscreen: enteringFullscreen
            }
        }))

        if (!enteringFullscreen) {
            requestAnimationFrame(() => {
                const containerId =
                    typeof containerOrId === "string"
                        ? containerOrId
                        : container.id

                if (containerId) {
                    this.resizeResponsive(containerId)
                }
            })
        }
    },

    observeContainer(containerId) {
        const container = this.getContainer(containerId)

        if (!container || this.managers.has(containerId)) {
            return
        }

        const refreshExpandedDisplay = () => {
            if (this.isFullscreen(container)) {
                this.applyExpandedDisplaySize(container)
            }
        }

        window.addEventListener("resize", refreshExpandedDisplay)

        if (window.visualViewport) {
            window.visualViewport.addEventListener(
                "resize",
                refreshExpandedDisplay
            )
        }

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", () => {
                this.resizeResponsive(containerId)
            })

            const { width, height } = this.getDimensions(container)

            this.managers.set(containerId, {
                observer: null,
                resizeFrame: null,
                lastWidth: width,
                lastHeight: height
            })

            return
        }

        let resizeFrame = null

        const observer = new ResizeObserver(() => {
            if (resizeFrame) {
                cancelAnimationFrame(resizeFrame)
            }

            resizeFrame = requestAnimationFrame(() => {
                this.resizeResponsive(containerId)
            })
        })

        observer.observe(container)

        const { width, height } = this.getDimensions(container)

        this.managers.set(containerId, {
            observer,
            resizeFrame,
            lastWidth: width,
            lastHeight: height
        })
    }
}
