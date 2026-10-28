// This game owns its menu and gameplay. Build to one browser entry with npm run build:games.
// =======================================
// FROM A STORYTELLER - MENU-SCREENS.JS
// Version: 2.0
// Menu definitions owned by this game
// =======================================

const MenuScreens = {
    create(menu) {
        return {
            title: {
                title: "Main Menu",
                items: [
                    {
                        type: "button",
                        label: "Play",
                        action: () => menu.startGame()
                    },
                    {
                        type: "select",
                        label: "Difficulty",
                        key: "difficulty",
                        source: "sessionOptions",
                        options: ["Easy", "Normal", "Hard"]
                    },
                    {
                        type: "button",
                        label: "Settings",
                        action: () => menu.openScreen("settings", "title")
                    },
                    {
                        type: "button",
                        label: () => menu.getFullscreenLabel(),
                        action: () => menu.toggleFullscreen()
                    }
                ]
            },

            pause: {
                title: "Paused",
                items: [
                    {
                        type: "button",
                        label: "Resume",
                        action: () => menu.resumeGame()
                    },
                    {
                        type: "button",
                        label: "Settings",
                        action: () => menu.openScreen("settings", "pause")
                    },
                    {
                        type: "button",
                        label: () => menu.getFullscreenLabel(),
                        action: () => menu.toggleFullscreen()
                    },
                    {
                        type: "button",
                        label: "Return to Title",
                        action: () => menu.returnToTitle()
                    }
                ]
            },

            settings: {
                title: "Settings",
                items: [
                    {
                        type: "toggle",
                        label: "Sounds",
                        key: "soundEnabled",
                        source: "settings"
                    },
                    {
                        type: "slider",
                        label: "Master Volume",
                        key: "masterVolume",
                        source: "settings",
                        min: 0,
                        max: 100,
                        step: 1
                    },
                    {
                        type: "button",
                        label: "Back",
                        action: () => menu.goBack()
                    }
                ]
            },

            matchResult: {
                title: () => {
                    const result = menu.getScreenData("result", "gameOver")

                    if (result === "victory") return "Victory"
                    if (result === "defeat") return "Defeat"
                    return "Game Over"
                },

                content: () => menu.getScreenData("stats", []),

                items: [
                    {
                        type: "button",
                        label: "Play Again",
                        action: () => menu.startGame()
                    },
                    {
                        type: "button",
                        label: "Return to Title",
                        action: () => menu.returnToTitle()
                    }
                ]
            }
        }
    }
}
// =======================================
// FROM A STORYTELLER - MENU-MANAGER.JS
// Version: 3.0
// Menu controller owned by this game
// =======================================




class MenuManager {
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
// === IMPORTS === //
const Menu = { Manager: MenuManager };
import { Input } from "../../systems/games/input.js"
import { AudioManager } from "../../systems/games/audio.js"
import { CanvasManager } from "../../systems/games/canvas.js"
import { Layout } from "../../systems/games/layout.js"
import { Storage } from "../../systems/games/storage.js"
import { UI } from "../../systems/games/ui.js"
import { Utils } from "../../systems/games/utils.js"

// === CONSTANTS === //
const GAME_STATE = {
    MENU: "menu",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
    PAUSED: "paused",
    GAME_OVER: "gameOver"
}

const SCORING_SIDE = {
    PLAYER: "player",
    AI: "ai"
}

const GAME_CONFIG = {
    winScore: 5,
    countdownSeconds: 3
}

const LAYOUT = {
    paddleMarginRatio: 0.04,
    netWidthRatio: 0.008,
}

const SIDE = {
    LEFT: "left",
    RIGHT: "right"
}

const PADDLE_CONFIG = {
    widthRatio: 0.025,
    heightRatio: 0.2,
    playerSpeedRatio: 0.02,
    aiDeadZoneRatio: 0.025,
    aiMaxSpeedRatio: 0.02,
    aiTrackingStartRatio: 0.25,
    accelRatio: 0.0024,
    decelRatio: 0.0032
}

const BALL_CONFIG = {
    radiusRatio: 0.024,
    baseSpeedRatio: 0.008,
    speedIncrease: 1.08,
    maxSpeedRatio: 0.022,
    launchAngleMin: -0.6,
    launchAngleMax: 0.6,
    bounceAngleStrength: 1.8
}

const TRAIL_CONFIG = {
    minLength: 4,
    maxLength: 14,
    minAlpha: 40,
    maxAlpha: 170,
    sizeMultiplier: 0.9
}

const UI_CONFIG = {
    messageRadius: 12,
    messageFillAlpha: 230,
    messageStrokeAlpha: 90,
    menuTitleRatio: 0.085,
    menuPromptRatio: 0.04,
    menuControlsRatio: 0.03,
    countdownTextRatio: 0.14,
    scoreTextRatio: 0.064
}

const DIFFICULTY_SETTINGS = {
    Easy: {
        aiDeadZoneMultiplier: 1.2,
        aiMaxSpeedMultiplier: 0.8,
    },
    Normal: {
        aiDeadZoneMultiplier: 1,
        aiMaxSpeedMultiplier: 1,
    },
    Hard: {
        aiDeadZoneMultiplier: 0.8,
        aiMaxSpeedMultiplier: 1.2,
    }
}

const GAME_COLORS = {
    bg: "#26231f",
    net: "rgba(212, 175, 55, 0.28)",
    score: "#f5f1e8",
    title: "#d4af37",
    text: "#f5f1e8",
    player: "#d4af37",
    ai: "#8b2f2f",
    ball: "#f3e7c2",

    panelFill: "#111111",
    panelStroke: "#d4af37",
    trail: "#e6d7b5"
}

const UI_PANEL_STYLE = {
    fillColor: GAME_COLORS.panelFill,
    fillAlpha: UI_CONFIG.messageFillAlpha,
    strokeColor: GAME_COLORS.panelStroke,
    strokeAlpha: UI_CONFIG.messageStrokeAlpha,
    strokeWeight: 2,
    radius: UI_CONFIG.messageRadius
}

const STORAGE_KEYS = {
    bestRally: "rallyClash_bestRally",
    soundEnabled: "rallyClash_SoundEnabled",
    masterVolume: "rallyClash_MasterVolume"
}

const SOUND_VOLUMES = {
    paddleHit: 0.45,
    wallHit: 0.35,
    score: 0.5,
    win: 0.6,
    lose: 0.55,
    countdown: 0.4,
    start: 0.5,
    uiMove: 0.2,
    uiSelect: 0.3,
    uiBack: 0.25
}

// === VARIABLES === //
let gameState = GAME_STATE.MENU
let countdownValue = GAME_CONFIG.countdownSeconds
let countdownStartTime = 0
let lastCountdownSound = 0
let pausedFromState = null
let hudAlpha = 0

let playerPaddle
let aiPaddle
let ball
let menu

let selectedDifficulty = "Normal"
let currentDifficultySettings = DIFFICULTY_SETTINGS.Normal

let playerScore = 0
let aiScore = 0

let currentRally = 0
let longestRally = 0
let bestRally = Storage.load(STORAGE_KEYS.bestRally, 0)
let isNewBestRally = false
let matchResult = null

let sounds = {}

let soundEnabled = Storage.load(STORAGE_KEYS.soundEnabled, true)
let masterVolume = Storage.load(STORAGE_KEYS.masterVolume, 100)

// === SETUP HELPERS === //
function startGameFromMenu(sessionOptions = {}) {
    userStartAudio()

    applyDifficulty(sessionOptions.difficulty)
    initGame()
}

function startCountdown() {
    countdownValue = GAME_CONFIG.countdownSeconds
    countdownStartTime = millis()
    lastCountdownSound = 0
    gameState = GAME_STATE.COUNTDOWN
}

function initGame() {
    playerScore = 0
    aiScore = 0

    currentRally = 0
    longestRally = 0
    isNewBestRally = false
    matchResult = null

    createGameObjects()
    startCountdown()
}

function createGameObjects() {
    playerPaddle = new Paddle(SIDE.LEFT, GAME_COLORS.player)
    aiPaddle = new Paddle(SIDE.RIGHT, GAME_COLORS.ai)
    ball = new Ball(GAME_COLORS.ball)
}

function updateGameObjectSizes() {
    // Update paddle sizes
    playerPaddle.w = width * PADDLE_CONFIG.widthRatio
    playerPaddle.h = height * PADDLE_CONFIG.heightRatio

    aiPaddle.w = width * PADDLE_CONFIG.widthRatio
    aiPaddle.h = height * PADDLE_CONFIG.heightRatio

    // Keep paddles within bounds
    playerPaddle.y = constrain(playerPaddle.y, 0, height - playerPaddle.h)
    aiPaddle.y = constrain(aiPaddle.y, 0, height - aiPaddle.h)

    // Update ball size + speed scaling
    ball.r = Utils.getBaseSize() * BALL_CONFIG.radiusRatio
    ball.baseSpeed = Utils.getBaseSize() * BALL_CONFIG.baseSpeedRatio
    ball.maxSpeed = Utils.getBaseSize() * BALL_CONFIG.maxSpeedRatio
}

function resetRound() {
    ball.reset()
    startCountdown()
}

function applySoundEnabled(enabled) {
    soundEnabled = enabled
    AudioManager.setSoundEnabled(enabled)
    Storage.save(STORAGE_KEYS.soundEnabled, enabled)

    if (!enabled) {
        AudioManager.stopAll()
    }
}

function applyMasterVolume(volume) {
    masterVolume = volume
    AudioManager.setMasterVolume(volume)
    Storage.save(STORAGE_KEYS.masterVolume, volume)
}

function applyDifficulty(difficultyName = "Normal") {
    const validDifficulty = DIFFICULTY_SETTINGS[difficultyName] ? difficultyName : "Normal"
    selectedDifficulty = validDifficulty
    currentDifficultySettings = DIFFICULTY_SETTINGS[selectedDifficulty]
}

function registerRallyHit() {
    currentRally += 1

    if (currentRally > longestRally) {
        longestRally = currentRally
    }
}

// === UI HELPERS === //
function updateCountdown() {
    const elapsed = millis() - countdownStartTime
    countdownValue = GAME_CONFIG.countdownSeconds - floor(elapsed / 1000)

    if (countdownValue <= 0) {
        AudioManager.play(sounds.start, SOUND_VOLUMES.start)
        gameState = GAME_STATE.PLAYING
        return
    }

    if (countdownValue !== lastCountdownSound) {
        AudioManager.play(sounds.countdown, SOUND_VOLUMES.countdown)
        lastCountdownSound = countdownValue
    }
}

function drawCountdown() {
    const box = Layout.getCenteredBox(0.22, 0.2)

    UI.drawMessageBox(box.x, box.y, box.w, box.h, UI_PANEL_STYLE)

    fill(GAME_COLORS.title)
    textAlign(CENTER, CENTER)
    textSize(Utils.getBaseSize() * UI_CONFIG.countdownTextRatio)

    const countdownY = box.y + height * 0.008
    text(countdownValue, box.x, countdownY)
}

// === CLASSES === //
class Paddle {
    constructor(side, color) {
        this.w = width * PADDLE_CONFIG.widthRatio
        this.h = height * PADDLE_CONFIG.heightRatio
        this.y = height / 2 - this.h / 2

        this.side = side
        this.color = color

        this.speed = 0
        this.targetSpeed = 0
    }

    getX() {
        const margin = width * LAYOUT.paddleMarginRatio
        return this.side === SIDE.LEFT ? margin : width - this.w - margin
    }

    show() {
        fill(this.color)
        const x = this.getX()
        rect(x, this.y, this.w, this.h)
    }

    move(targetSpeed) {
        this.targetSpeed = targetSpeed
    }

    update() {
        const accel = height * PADDLE_CONFIG.accelRatio
        const decel = height * PADDLE_CONFIG.decelRatio

        if (this.targetSpeed === 0) {
            if (abs(this.speed) <= decel) {
                this.speed = 0
            } else {
                this.speed -= Math.sign(this.speed) * decel
            }
        } else {
            const speedDifference = this.targetSpeed - this.speed
            const step = abs(speedDifference) < accel ? abs(speedDifference) : accel
            this.speed += Math.sign(speedDifference) * step
        }

        this.y += this.speed
        this.y = constrain(this.y, 0, height - this.h)

        if (this.y <= 0 || this.y >= height - this.h) {
            this.speed = 0
        }
    }  
}

class Ball {
    constructor(color) {
        this.r = Utils.getBaseSize() * BALL_CONFIG.radiusRatio
        this.color = color
        this.baseSpeed = Utils.getBaseSize() * BALL_CONFIG.baseSpeedRatio
        this.speedIncrease = BALL_CONFIG.speedIncrease
        this.maxSpeed = Utils.getBaseSize() * BALL_CONFIG.maxSpeedRatio
        this.trail = []
        this.reset()
    }

    reset() {
        this.x = width / 2
        this.y = height / 2
        this.trail = []

        let xDirection = random([-1, 1])
        let launchAngle = random(BALL_CONFIG.launchAngleMin, BALL_CONFIG.launchAngleMax)
        
        this.xspeed = this.baseSpeed * xDirection
        this.yspeed = this.baseSpeed * launchAngle
    }

    getSpeed() {
        return sqrt(this.xspeed * this.xspeed + this.yspeed * this.yspeed)
    }

    updateTrail() {
        const speed = this.getSpeed()
        const trailLength = floor(
            map(
                speed,
                this.baseSpeed,
                this.maxSpeed,
                TRAIL_CONFIG.minLength,
                TRAIL_CONFIG.maxLength,
                true
            )
        )

        this.trail.push({
            x: this.x,
            y: this.y
        })

        while (this.trail.length > trailLength) {
            this.trail.shift()
        }
    }

    drawFeatheredTrailPoint(x, y, size, alpha, fillColor) {
        noStroke()

        const outerColor = color(fillColor)
        outerColor.setAlpha(alpha * 0.05)
        fill(outerColor)
        ellipse(x, y, size * 1.18)

        const midColor = color(fillColor)
        midColor.setAlpha(alpha * 0.12)
        fill(midColor)
        ellipse(x, y, size * 1.08)

        const innerColor = color(fillColor)
        innerColor.setAlpha(alpha * 0.24)
        fill(innerColor)
        ellipse(x, y, size * 0.82)
    }

    drawTrail() {
        if (this.trail.length < 3) {
            return
        }

        noStroke()

        const speed = this.getSpeed()
        
        const maxTrailAlpha = map(
            speed,
            this.baseSpeed,
            this.maxSpeed,
            TRAIL_CONFIG.minAlpha,
            TRAIL_CONFIG.maxAlpha,
            true
        )

        const speedFactor = map(
            speed,
            this.baseSpeed,
            this.maxSpeed,
            0,
            1,
            true
        )

        const baseTrailColor = color(GAME_COLORS.trail)
        const fastTrailColor = color(GAME_COLORS.title)

        const visibleTrailCount = this.trail.length - 2
                        
        for (let i = 0; i < visibleTrailCount; i++) {
            const point = this.trail[i]            
            const progress = (i + 1) / visibleTrailCount

            const alpha = maxTrailAlpha * (0.15 + progress * 0.25)
            const size = this.r * 2 * (TRAIL_CONFIG.sizeMultiplier * (0.35 + progress * 0.55))

            const blendedColor = lerpColor(
                baseTrailColor,
                fastTrailColor,
                speedFactor * 0.16
            )
            
            this.drawFeatheredTrailPoint(point.x, point.y, size, alpha, blendedColor)
        }
    }

    increaseSpeed() {
        this.xspeed *= this.speedIncrease
        this.yspeed *= this.speedIncrease

        this.xspeed = constrain(this.xspeed, -this.maxSpeed, this.maxSpeed)
        this.yspeed = constrain(this.yspeed, -this.maxSpeed, this.maxSpeed)
    }

    show() {
        fill(this.color)
        ellipse(this.x, this.y, this.r * 2)
    }

    update() {
        this.x += this.xspeed
        this.y += this.yspeed
        this.updateTrail()
    }

    edges() {
        if (this.y - this.r <= 0) {
            this.y = this.r
            this.yspeed *= -1
            AudioManager.play(sounds.wallHit, SOUND_VOLUMES.wallHit)
        } else if (this.y + this.r >= height) {
            this.y = height - this.r
            this.yspeed *= -1
            AudioManager.play(sounds.wallHit, SOUND_VOLUMES.wallHit)
        }
    }
    
    checkPaddle(paddle) {
        const paddleLeft = paddle.getX()
        const paddleRight = paddleLeft + paddle.w
        const paddleTop = paddle.y
        const paddleBottom = paddle.y + paddle.h
        
        const ballLeft = this.x - this.r
        const ballRight = this.x + this.r
        const ballTop = this.y - this.r
        const ballBottom = this.y + this.r

        const overlapsVertically = ballBottom > paddleTop && ballTop < paddleBottom
        const overlapsHorizontally = ballRight > paddleLeft && ballLeft < paddleRight

        if (overlapsVertically && overlapsHorizontally) {
            if (paddle.side === SIDE.LEFT && this.xspeed < 0) {
                this.x = paddleRight + this.r
                this.handlePaddleBounce(paddle)
            } else if (paddle.side === SIDE.RIGHT && this.xspeed > 0) {
                this.x = paddleLeft - this.r
                this.handlePaddleBounce(paddle)
            }
        }
    }

    handlePaddleBounce(paddle) {
        this.xspeed *= -1

        const paddleCenter = paddle.y + paddle.h / 2
        const hitPos = this.y - paddleCenter

        const normalizedHit = hitPos / (paddle.h / 2)
        this.yspeed = normalizedHit * this.baseSpeed * BALL_CONFIG.bounceAngleStrength

        registerRallyHit()

        this.increaseSpeed()
        AudioManager.play(sounds.paddleHit, SOUND_VOLUMES.paddleHit)
    }
}

// === GAME RULE HELPERS === //
function awardPoint(scoringSide) {
    if (scoringSide === SCORING_SIDE.PLAYER) {
        playerScore += 1
    } else {
        aiScore += 1
    }

    currentRally = 0

    AudioManager.play(sounds.score, SOUND_VOLUMES.score)
    checkGameOver()

    if (gameState === GAME_STATE.GAME_OVER) {
        if (scoringSide === SCORING_SIDE.PLAYER) {
            AudioManager.play(sounds.win, SOUND_VOLUMES.win)
        } else {
            AudioManager.play(sounds.lose, SOUND_VOLUMES.lose)
        }
    } else {
        resetRound()
    }
}

function checkForScore() {
    if (ball.x + ball.r < 0) {
        awardPoint(SCORING_SIDE.AI)
        return
    }

    if (ball.x - ball.r > width) {
        awardPoint(SCORING_SIDE.PLAYER)
    }
}

function checkGameOver() {
    if (playerScore >= GAME_CONFIG.winScore || aiScore >= GAME_CONFIG.winScore) {
        matchResult = playerScore > aiScore ? "victory" : "defeat"
        
        if (longestRally > bestRally) {
            bestRally = longestRally
            isNewBestRally = true
            Storage.save(STORAGE_KEYS.bestRally, bestRally)
        } else {
            isNewBestRally = false
        }

        gameState = GAME_STATE.GAME_OVER

        menu.openScreen("matchResult", null, {
            result: matchResult,
            stats: [
                {
                    type: "stat",
                    label: "Longest Rally",
                    value: longestRally
                },
                {
                    type: "stat",
                    label: "All-Time Best",
                    value: bestRally,
                    highlight: isNewBestRally,
                    suffix: isNewBestRally ? "NEW HIGHSCORE" : ""
                }
            ]
        })
    }
}

// === UPDATE HELPERS === //
function updatePlayerPaddle() {
    playerPaddle.update()
}

function updateAiPaddle() {
    let moveSpeed = 0

    const paddleCenter = aiPaddle.y + aiPaddle.h / 2
    const distanceToBall = ball.y - paddleCenter

    const trackingStartX = width * PADDLE_CONFIG.aiTrackingStartRatio
            
    if (ball.xspeed > 0 && ball.x > trackingStartX) {
        const deadZone = height
            * PADDLE_CONFIG.aiDeadZoneRatio
            * currentDifficultySettings.aiDeadZoneMultiplier
        
        if (abs(distanceToBall) > deadZone) {
            const maxSpeed = height
                * PADDLE_CONFIG.aiMaxSpeedRatio
                * currentDifficultySettings.aiMaxSpeedMultiplier

            moveSpeed = constrain(
                distanceToBall,
                -maxSpeed,
                maxSpeed
            )
        }
    }

    aiPaddle.move(moveSpeed)
    aiPaddle.update()
}

function updatePlaying() {
    updateAiPaddle()

    ball.update()
    ball.edges()
    ball.checkPaddle(playerPaddle)
    ball.checkPaddle(aiPaddle)
    checkForScore()
}

function updateGame() {
    updateHudFade()

    if (gameState === GAME_STATE.PLAYING) {
        updatePlayerPaddle()
        updatePlaying()
    }

    if (gameState === GAME_STATE.COUNTDOWN) {
        updatePlayerPaddle()
        updateCountdown()
    }
}

function updateHudFade() {
    const targetAlpha = gameState === GAME_STATE.MENU ? 0 : 255
    hudAlpha = lerp(hudAlpha, targetAlpha, 0.15)

    if (abs(hudAlpha - targetAlpha) < 0.5) {
        hudAlpha = targetAlpha
    }
}

// === DRAW HELPERS === //
function drawNet() {
    stroke(GAME_COLORS.net)
    strokeWeight(Utils.getBaseSize() * LAYOUT.netWidthRatio)
    strokeCap(ROUND)

    const dashGap = height * 0.06
    const dashLength = height * 0.03

    const patternHeight = dashLength + dashGap

    const dashCount = floor(height / patternHeight)

    const usedHeight = dashCount * patternHeight - dashGap

    const offset = (height - usedHeight) / 2

    for (let i = 0; i < dashCount; i++) {
        const y = offset + i * patternHeight
        line(width / 2, y, width / 2, y + dashLength)
    }

    noStroke()
}

function drawScores() {
    const hudCenterY = height * 0.075

    const scoreColor = color(GAME_COLORS.score)
    scoreColor.setAlpha(hudAlpha)

    fill(scoreColor)
    textSize(Utils.getBaseSize() * UI_CONFIG.scoreTextRatio)
    textAlign(CENTER, CENTER)

    text(playerScore, width / 4, hudCenterY)
    text(aiScore, width * 3 / 4, hudCenterY)
}

function drawGameScene() {
    background(GAME_COLORS.bg)
    drawNet()
    drawScores()
    drawDifficultyBadge()

    playerPaddle.show()
    aiPaddle.show()
    ball.drawTrail()
    ball.show()
}

function drawOverlay() {
    if (gameState === GAME_STATE.COUNTDOWN) {
        drawCountdown()
        return
    }
}

function drawDifficultyBadge() {
    const hudCenterY = height * 0.075
    const badgeWidth = width * 0.095
    const badgeHeight = height * 0.038
    const badgeX = width / 2
    const badgeY = hudCenterY - Utils.getBaseSize() * 0.009

    UI.drawMessageBox(
        badgeX,
        badgeY,
        badgeWidth,
        badgeHeight,
        {
            fillColor: GAME_COLORS.panelFill,
            fillAlpha: 160 * (hudAlpha / 255),
            strokeColor: GAME_COLORS.panelStroke,
            strokeAlpha: 45 * (hudAlpha / 255),
            strokeWeight: 1,
            radius: 8
        }
    )
    
    const titleColor = color(GAME_COLORS.title)
    titleColor.setAlpha(hudAlpha)
    
    fill(titleColor)
    textAlign(CENTER, CENTER)
    textSize(Utils.getBaseSize() * 0.015)
    text(selectedDifficulty.toUpperCase(), badgeX, badgeY)
}

function renderGame() {
    drawGameScene()
    drawOverlay()
}

// === P5 LIFECYCLE (ES MODULE MODE) === //
window.preload = function () {
    sounds = AudioManager.loadSounds({
        paddleHit: "/assets/sounds/games/rally-clash/paddle-hit.mp3",
        wallHit: "/assets/sounds/games/rally-clash/wall-hit.mp3",
        score: "/assets/sounds/games/rally-clash/score.mp3",
        win: "/assets/sounds/games/rally-clash/win.mp3",
        lose: "/assets/sounds/games/rally-clash/lose.mp3",
        countdown: "/assets/sounds/games/rally-clash/countdown-beep.mp3",
        start: "/assets/sounds/games/rally-clash/start.mp3"
    })
}

window.setup = function () {
    CanvasManager.createResponsive("rally-clash-game")

    Input.init()

    AudioManager.setSoundEnabled(soundEnabled)
    AudioManager.setMasterVolume(masterVolume)

    createGameObjects()

    menu = new Menu.Manager({
        startGame: startGameFromMenu,

        resumeGame: () => {
            gameState = pausedFromState || GAME_STATE.PLAYING
            pausedFromState = null
        },

        returnToTitle: () => {
            gameState = GAME_STATE.MENU
            pausedFromState = null
            playerScore = 0
            aiScore = 0
            createGameObjects()
            playerPaddle.move(0)
        },

        toggleSound: () => {
            applySoundEnabled(!soundEnabled)
        },

        setSoundEnabled: (enabled) => {
            applySoundEnabled(enabled)
        },

        setMasterVolume: (volume) => {
            applyMasterVolume(volume)
        },

        getAudioSettings: () => ({
            soundEnabled,
            masterVolume
        })
    })

    const gameContainer = document.getElementById("rally-clash-game")
    menu.init(gameContainer)
    menu.openScreen("title")

    gameState = GAME_STATE.MENU
}

window.windowResized = function () {
    CanvasManager.resizeResponsive("rally-clash-game")

    if (playerPaddle && aiPaddle && ball) {
        updateGameObjectSizes()
    }
}

window.draw = function () {
    handleInput()
    updateGame()
    renderGame()
    Input.clearPressed()
}

function handleInput() {
    const menuHandled = menu.handleInput(
        (code) => Input.wasPressed(code),
        (code) => Input.wasPressedOrRepeated(code)
    )

    if (menuHandled) {
        return
    }

    if (Input.wasPressed("Escape")) {
        if (
            gameState === GAME_STATE.PLAYING ||
            gameState === GAME_STATE.COUNTDOWN
        ) {
            pausedFromState = gameState
            gameState = GAME_STATE.PAUSED
            menu.openScreen("pause")
            return
        }
    }

    if (
        gameState !== GAME_STATE.PLAYING &&
        gameState !== GAME_STATE.COUNTDOWN
    ) {
        return
    }

    const touchPosition = Input.getPointerPosition("rally-clash-game")

    if (Input.isTouchActive() && touchPosition) {
        playerPaddle.move(0)
        playerPaddle.speed = 0

        playerPaddle.y = constrain(
            touchPosition.y - playerPaddle.h / 2,
            0,
            height - playerPaddle.h
        )

        return
    }

    const paddleSpeed = height * PADDLE_CONFIG.playerSpeedRatio

    if (Input.isDown("ArrowUp")) {
        playerPaddle.move(-paddleSpeed)
    } else if (Input.isDown("ArrowDown")) {
        playerPaddle.move(paddleSpeed)
    } else {
        playerPaddle.move(0)
    }
}