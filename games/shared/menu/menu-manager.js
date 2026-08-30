// =======================================
// FROM A STORYTELLER - MENU-MANAGER.JS
// Version: 3.0
// Shared menu manager for all games
// =======================================

import { MenuScreens } from "./menu-screens.js"
import { CanvasManager } from "../canvas.js"

export class MenuManager {
    constructor(actions = {}) {
        this.actions = actions

        this.isOpen = false
        this.currentScreen = "title"
        this.previousScreen = null
        this.selectedIndex = 0
        this.screenData = {}

        this.sessionOptions = {
            difficulty: "Normal",
            players: 1
        }

        const audioSettings = typeof this.actions.getAudioSettings === "function"
            ? this.actions.getAudioSettings()
            : {
                soundEnabled: true,
                masterVolume: 100
            }

        this.settings = {
            soundEnabled: audioSettings.soundEnabled,
            masterVolume: audioSettings.masterVolume
        }

        this.screens = MenuScreens.create(this)

        this.container = null
        this.panel = null
        this.mountElement = null
        this.fullscreenEventsBound = false
    }

    init(mountElement) {
        this.mountElement = mountElement

        this.container = document.createElement("div")
        this.container.className = "menu-overlay hidden"

        this.panel = document.createElement("div")
        this.panel.className = "menu-panel"

        this.container.appendChild(this.panel)
        mountElement.appendChild(this.container)

        if (!this.fullscreenEventsBound) {
            const handleFullscreenChange = (event) => {
                /*
                   Only rerender this menu when the fullscreen event belongs
                   to the game container that this MenuManager controls.
                */
                if (
                    this.isOpen &&
                    event.detail?.container === this.mountElement
                ) {
                    this.render()
                }
            }

            document.addEventListener("gamefullscreenchange", handleFullscreenChange)
            this.fullscreenEventsBound = true
        }

        this.render()
    }

    openScreen(screenId, previousScreen = null, screenData = {}) {
        this.isOpen = true
        this.currentScreen = screenId
        this.previousScreen = previousScreen
        this.selectedIndex = 0
        this.screenData = { ...screenData }

        if (screenId === "settings" && typeof this.actions.getAudioSettings === "function") {
            const audioSettings = this.actions.getAudioSettings()
            this.settings.soundEnabled = audioSettings.soundEnabled
            this.settings.masterVolume = audioSettings.masterVolume
        }

        if (this.container) {
            this.container.classList.remove("hidden")
        }

        this.render()
    }

    close() {
        this.isOpen = false
        this.screenData = {}

        if (this.container) {
            this.container.classList.add("hidden")
        }
    }

    goBack() {
        if (this.previousScreen) {
            const target = this.previousScreen
            this.previousScreen = null
            this.openScreen(target)
            return
        }

        if (this.currentScreen === "pause") {
            this.resumeGame()
        }
    }

    moveSelection(direction) {
        const screen = this.screens[this.currentScreen]
        const items = screen?.items ?? []
        if (items.length === 0) return

        const itemCount = items.length

        this.selectedIndex += direction
        if (this.selectedIndex < 0) {
            this.selectedIndex = itemCount - 1
        }

        if (this.selectedIndex >= itemCount) {
            this.selectedIndex = 0
        }

        this.render()
    }

    getValue(item) {
        return this[item.source][item.key]
    }

    setValue(item, value) {
        this[item.source][item.key] = value

        if (item.source === "settings") {
            if (item.key === "soundEnabled" && typeof this.actions.setSoundEnabled === "function") {
                this.actions.setSoundEnabled(value)
            }

            if (item.key === "masterVolume" && typeof this.actions.setMasterVolume === "function") {
                this.actions.setMasterVolume(value)
            }
        }
    }

    changeValue(direction) {
        const screen = this.screens[this.currentScreen]
        const items = screen?.items ?? []
        const item = items[this.selectedIndex]
        if (!item) return

        if (item.type === "select") {
            const currentValue = this.getValue(item)
            const currentIndex = item.options.indexOf(currentValue)

            let newIndex = currentIndex + direction

            if (newIndex < 0) newIndex = 0
            if (newIndex >= item.options.length) newIndex = item.options.length - 1

            if (newIndex !== currentIndex) {
                this.setValue(item, item.options[newIndex])
                this.render()
            }
        }

        if (item.type === "toggle") {
            this.setValue(item, direction < 0)
            this.render()
        }

        if (item.type === "slider") {
            let newValue = this.getValue(item) + direction * item.step

            if (newValue < item.min) newValue = item.min
            if (newValue > item.max) newValue = item.max

            this.setValue(item, newValue)
            this.render()
        }
    }

    activateSelected() {
        const screen = this.screens[this.currentScreen]
        const items = screen?.items ?? []
        const item = items[this.selectedIndex]
        if (!item) return

        if (item.type === "button" && item.action) {
            item.action()
            return
        }

        if (item.type === "toggle") {
            this.setValue(item, !this.getValue(item))
            this.render()
            return
        }

        if (item.type === "select") {
            const currentValue = this.getValue(item)
            const currentIndex = item.options.indexOf(currentValue)
            const nextIndex = (currentIndex + 1) % item.options.length

            this.setValue(item, item.options[nextIndex])
            this.render()
            return
        }

        if (item.type === "slider") {
            let newValue = this.getValue(item) + item.step

            if (newValue > item.max) {
                newValue = item.min
            }

            this.setValue(item, newValue)
            this.render()
        }
    }

    getScreenData(key, fallback = null) {
        if (!this.screenData || !(key in this.screenData)) {
            return fallback
        }

        return this.screenData[key]
    }

    resolveScreenValue(value, fallback = null) {
        if (typeof value === "function") {
            return value()
        }

        return value ?? fallback
    }

    getFullscreenLabel() {
        return CanvasManager.isFullscreen(this.mountElement)
            ? "Exit Expanded View"
            : "Expand Game"
    }

    toggleFullscreen() {
        if (!this.mountElement) {
            return
        }

        CanvasManager.toggleFullscreen(this.mountElement)
    }

    render() {
        const screen = this.screens[this.currentScreen]
        if (!screen || !this.panel) return

        this.panel.innerHTML = ""
        this.panel.className = "menu-panel"

        this.panel.classList.add(`menu-screen-${this.currentScreen}`)

        const resultType = this.getScreenData("result", null)
        if (resultType) {
            this.panel.classList.add(`menu-result-${resultType}`)
        }

        const title = document.createElement("h2")
        title.className = "menu-title"

        if (this.currentScreen === "matchResult") {
            title.classList.add("menu-result-title")
        }

        title.textContent = this.resolveScreenValue(screen.title, "")
        this.panel.appendChild(title)

        const contentRows = this.resolveScreenValue(screen.content, [])

        if (Array.isArray(contentRows) && contentRows.length > 0) {
            const content = document.createElement("div")
            content.className = "menu-content"

            const statsGrid = document.createElement("div")
            statsGrid.className = "menu-stats-grid"

            contentRows.forEach((entry) => {
                if (entry.type === "stat") {
                    statsGrid.appendChild(this.createStatCard(entry))
                }
            })

            content.appendChild(statsGrid)
            this.panel.appendChild(content)
        }

        const list = document.createElement("div")
        list.className = "menu-list"

        if (this.currentScreen === "matchResult") {
            list.classList.add("menu-result-actions")
        }

        const items = screen.items ?? []

        items.forEach((item, index) => {
            const row = document.createElement("div")
            row.className = "menu-row"

            if (this.currentScreen === "matchResult") {
                row.classList.add("menu-result-action")

                if (index === 0) {
                    row.classList.add("menu-result-action-primary")
                }

                if (index === 1) {
                    row.classList.add("menu-result-action-secondary")
                }
            }

            if (index === this.selectedIndex) {
                row.classList.add("selected")
            }

            const label = document.createElement("span")
            label.className = "menu-label"
            label.textContent = this.resolveScreenValue(item.label, "")

            row.appendChild(label)

            if (item.type === "toggle") {
                row.appendChild(this.createToggleDisplay(item))
            } else if (item.type === "slider") {
                row.appendChild(this.createSliderDisplay(item))
            } else if (item.type === "select") {
                row.appendChild(this.createSelectDisplay(item))
            } else {
                const value = document.createElement("span")
                value.className = "menu-value"
                value.textContent = this.getDisplayValue(item)
                row.appendChild(value)
            }

            row.addEventListener("mouseenter", () => {
                if (this.selectedIndex !== index) {
                    this.selectedIndex = index
                    this.render()
                }
            })

            if (item.type === "button") {
                row.addEventListener("click", () => {
                    this.selectedIndex = index
                    this.activateSelected()
                })
            }

            list.appendChild(row)
        })

        this.panel.appendChild(list)
    }

    createStatCard(entry) {
        const card = document.createElement("div")
        card.className = "menu-stat-card"

        if (entry.highlight === true) {
            card.classList.add("highlight")
        }

        const label = document.createElement("div")
        label.className = "menu-stat-label"
        label.textContent = entry.label

        const value = document.createElement("div")
        value.className = "menu-stat-value"
        value.textContent = entry.value

        card.appendChild(label)
        card.appendChild(value)

        if (entry.suffix) {
            const suffix = document.createElement("div")
            suffix.className = "menu-stat-suffix"
            suffix.textContent = entry.suffix
            card.appendChild(suffix)
        }

        return card
    }

    createToggleDisplay(item) {
        const wrapper = document.createElement("div")
        wrapper.className = "menu-toggle-group"

        const currentValue = this.getValue(item)

        const onButton = document.createElement("button")
        onButton.type = "button"
        onButton.className = "menu-toggle-option"
        onButton.textContent = "On"

        if (currentValue === true) {
            onButton.classList.add("active")
        }

        onButton.addEventListener("click", (event) => {
            event.stopPropagation()
            this.selectedIndex = this.screens[this.currentScreen].items.indexOf(item)
            this.setValue(item, true)
            this.render()
        })

        const offButton = document.createElement("button")
        offButton.type = "button"
        offButton.className = "menu-toggle-option"
        offButton.textContent = "Off"

        if (currentValue === false) {
            offButton.classList.add("active")
        }

        offButton.addEventListener("click", (event) => {
            event.stopPropagation()
            this.selectedIndex = this.screens[this.currentScreen].items.indexOf(item)
            this.setValue(item, false)
            this.render()
        })

        wrapper.appendChild(onButton)
        wrapper.appendChild(offButton)

        return wrapper
    }

    createSelectDisplay(item) {
        const wrapper = document.createElement("div")
        wrapper.className = "menu-select-group"

        const currentValue = this.getValue(item)

        item.options.forEach((option) => {
            const optionButton = document.createElement("button")
            optionButton.type = "button"
            optionButton.className = "menu-select-option"
            optionButton.textContent = option

            if (option === currentValue) {
                optionButton.classList.add("active")
            }

            optionButton.addEventListener("click", (event) => {
                event.stopPropagation()
                this.selectedIndex = this.screens[this.currentScreen].items.indexOf(item)
                this.setValue(item, option)
                this.render()
            })

            wrapper.appendChild(optionButton)
        })

        return wrapper
    }

    createSliderDisplay(item) {
        const wrapper = document.createElement("div")
        wrapper.className = "menu-slider-wrap"

        const valueLabel = document.createElement("span")
        valueLabel.className = "menu-slider-value"

        const track = document.createElement("div")
        track.className = "menu-slider-bar"

        const fill = document.createElement("div")
        fill.className = "menu-slider-fill"

        const thumb = document.createElement("div")
        thumb.className = "menu-slider-thumb"

        const min = item.min ?? 0
        const max = item.max ?? 100
        const step = item.step ?? 1

        const updateSliderVisuals = (value) => {
            const clampedValue = Math.max(min, Math.min(max, value))
            const percent = (clampedValue - min) / (max - min)

            fill.style.width = `${percent * 100}%`
            thumb.style.left = `${percent * 100}%`
            valueLabel.textContent = clampedValue
        }

        const setSliderFromPointer = (clientX) => {
            const rect = track.getBoundingClientRect()

            if (rect.width <= 0) {
                return
            }

            const rawRatio = (clientX - rect.left) / rect.width
            const clampedRatio = Math.max(0, Math.min(1, rawRatio))

            const rawValue = min + clampedRatio * (max - min)
            const steppedValue =
                Math.round((rawValue - min) / step) * step + min

            const finalValue = Math.max(
                min,
                Math.min(max, steppedValue)
            )

            this.selectedIndex =
                this.screens[this.currentScreen].items.indexOf(item)

            this.setValue(item, finalValue)
            updateSliderVisuals(finalValue)
        }

        updateSliderVisuals(this.getValue(item))

        let activePointerId = null

        const finishPointerDrag = (event) => {
            if (
                activePointerId === null ||
                event.pointerId !== activePointerId
            ) {
                return
            }

            event.preventDefault()
            event.stopPropagation()

            try {
                if (track.hasPointerCapture?.(activePointerId)) {
                    track.releasePointerCapture(activePointerId)
                }
            } catch {
                // Safe fallback for partial Pointer Events support.
            }

            activePointerId = null
            this.render()
        }

        track.addEventListener(
            "pointerdown",
            (event) => {
                if (event.pointerType === "mouse" && event.button !== 0) {
                    return
                }

                event.preventDefault()
                event.stopPropagation()

                activePointerId = event.pointerId

                try {
                    track.setPointerCapture(event.pointerId)
                } catch {
                    // Drag still works while the pointer remains on the track.
                }

                setSliderFromPointer(event.clientX)
            },
            { passive: false }
        )

        track.addEventListener(
            "pointermove",
            (event) => {
                if (
                    activePointerId === null ||
                    event.pointerId !== activePointerId
                ) {
                    return
                }

                event.preventDefault()
                event.stopPropagation()

                setSliderFromPointer(event.clientX)
            },
            { passive: false }
        )

        track.addEventListener(
            "pointerup",
            finishPointerDrag,
            { passive: false }
        )

        track.addEventListener(
            "pointercancel",
            finishPointerDrag,
            { passive: false }
        )

        track.appendChild(fill)
        track.appendChild(thumb)

        wrapper.appendChild(track)
        wrapper.appendChild(valueLabel)

        return wrapper
    }

    getDisplayValue(item) {
        if (item.type === "button") return ""

        return ""
    }

    handleInput(wasKeyPressed, wasKeyPressedOrRepeated = wasKeyPressed) {
        if (!this.isOpen) return false

        if (this.currentScreen === "matchResult") {
            if(wasKeyPressedOrRepeated("ArrowLeft")) {
                this.moveSelection(-1)
                return true
            }

            if (wasKeyPressedOrRepeated("ArrowRight")) {
                this.moveSelection(1)
                return true
            }

            if (wasKeyPressedOrRepeated("ArrowUp") || wasKeyPressedOrRepeated("ArrowDown")) {
                return true
            }
        } else {
            if (wasKeyPressedOrRepeated("ArrowUp")) {
                this.moveSelection(-1)
                return true
            }

            if (wasKeyPressedOrRepeated("ArrowDown")) {
                this.moveSelection(1)
                return true
            }

            if (wasKeyPressedOrRepeated("ArrowLeft")) {
                this.changeValue(-1)
                return true
            }

            if (wasKeyPressedOrRepeated("ArrowRight")) {
                this.changeValue(1)
                return true
            }
        }

        if (wasKeyPressed("Enter") || wasKeyPressed("Space")) {
            this.activateSelected()
            return true
        }

        if (wasKeyPressed("Escape")) {
            this.goBack()
            return true
        }

        return false
    }

    startGame() {      
        if (typeof this.actions.startGame !== "function") {
            throw new Error("MenuManager actions.startGame is missing or not a function")
        }

        this.actions.startGame(this.sessionOptions)
        this.close()
    }

    resumeGame() {
        if (typeof this.actions.resumeGame === "function") {
            this.actions.resumeGame()
        }

        this.close()
    }

    returnToTitle() {
        if (typeof this.actions.returnToTitle === "function") {
            this.actions.returnToTitle()
        }

        this.openScreen("title")
    }
}