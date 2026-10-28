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
    GAME_OVER: "game-over"
}

const GAME_COLORS = {
    bg: "#26231f",
    main: "#d4af37",
    text: "#f5f1e8"
}

const GAME_CONFIG = {
    startingLives: 3,
    ballStartSpeed: 4,
    ballSpeedStep: 0.2,
    ballMaxSpeed: 7,

    baseBrickScore: 10,

    comboResetFrames: 120,      // about 2 seconds at 60fps
    loseLifePenaltyBricks: 3,

    levelSpeedBonus: 0.2,       // extra starting speed per level
    levelMaxSpeedBonus: 0.35,   // extra max speed per level
    levelPaddleSpeedBonus: 0.15 // paddle speed also rises
}

const STORAGE_KEYS = {
    allTimeHighscore: "games.brickBlitz.highscore"
}

const ball = {
    x: 0,
    y: 0,
    r: 8,
    vx: 0,
    vy: 0,
    speed: GAME_CONFIG.ballStartSpeed
}

// === VARIABLES === //
let gameState = GAME_STATE.MENU
let menu

let lives = GAME_CONFIG.startingLives
let score = 0
let level = 1
let allTimeHighscore = 0

let combo = 0
let comboTimer = 0
let highestCombo = 0

let comboPopFrames = 0
let comboPopDuration = 12

let countdownValue = 0
let countdownFrames = 0

let screenShakeFrames = 0
let screenShakeStrength = 0

let sounds = {}

let paddle = {
    x: 100,
    y: 300,
    w: 120,
    h: 20,
    speed: 8
}

let bricks = []

// === SETUP HELPERS === //
function startCountdown() {
    countdownValue = 3
    countdownFrames = 60
    gameState = GAME_STATE.COUNTDOWN

    AudioManager.play(sounds.countdown, 0.35)
}

function setupPaddle() {
    paddle.x = (width - paddle.w) / 2
    paddle.y = height - 40
}

function resetBall() {
    ball.x = width / 2
    ball.y = height / 2
    ball.vx = 0
    ball.vy = 0
}

function parkBallOnPaddle() {
    ball.x = paddle.x + paddle.w / 2
    ball.y = paddle.y - ball.r
    ball.vx = 0
    ball.vy = 0
}

function launchBall() {
    const maxLaunchAngle = radians(20)
    const launchAngle = random(-maxLaunchAngle, maxLaunchAngle)

    ball.vx = ball.speed * sin(launchAngle)
    ball.vy = -ball.speed * cos(launchAngle)
}

function getBallStartSpeed() {
    return GAME_CONFIG.ballStartSpeed + (level - 1) * GAME_CONFIG.levelSpeedBonus
}

function getBallMaxSpeed() {
    return GAME_CONFIG.ballMaxSpeed + (level - 1) * GAME_CONFIG.levelMaxSpeedBonus
}

function getPaddleSpeed() {
    return 8 + (level - 1) * GAME_CONFIG.levelPaddleSpeedBonus
}

function increaseBallSpeed() {
    ball.speed = Math.min(
        ball.speed + GAME_CONFIG.ballSpeedStep,
        getBallMaxSpeed()
    )
}

function applyBallSpeedToCurrentDirection() {
    const currentMagnitude = Math.hypot(ball.vx, ball.vy)

    if (currentMagnitude === 0) return

    ball.vx = (ball.vx / currentMagnitude) * ball.speed
    ball.vy = (ball.vy / currentMagnitude) * ball.speed
}

function setupBricks() {
    bricks = []

    const patternType = getPatternType()
    const rows = Math.min(3 + Math.floor((level - 1) / 1), 6)
    const cols = Math.min(5 + Math.floor((level - 1) / 2), 10)
    const gap = 4
    const sidePadding = 50
    const topOffset = 40

    const totalGapWidth = gap * (cols - 1)
    const brickWidth = (width - sidePadding * 2 - totalGapWidth) / cols
    const brickHeight = 20

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let active = true

            // Pattern Logic
            if (patternType === "gaps") {
                if (c % 2 === 0) active = false
            }

            if (patternType === "checker") {
                if ((r + c) % 2 === 0) active = false
            }

            if (patternType === "pyramid") {
                const center = (cols - 1) / 2
                const distance = Math.abs(c - center)

                if (distance > r) active = false
            }

            if (patternType === "frame") {
                if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
                    active = false
                }
            }

            if (patternType === "tunnel") {
                const centerLeft = Math.floor((cols - 1) / 2)
                const centerRight = Math.ceil((cols - 1) / 2)

                if (c === centerLeft || c === centerRight) {
                    active = false
                }
            }

            if (patternType === "diamond") {
                const centerRow = (rows - 1) / 2
                const centerCol = (cols - 1) / 2

                const rowDistance = Math.abs(r - centerRow)
                const colDistance = Math.abs(c - centerCol)

                const maxDistance = Math.min(centerRow, centerCol)

                if (rowDistance + colDistance > maxDistance + 0.5) {
                    active = false
                }
            }

            let health = 1

            if (active) {
                if (level >= 3 && r === 0) {
                    health = 2
                }

                if (level >= 5 && r <= 1 && active) {
                    health = 2
                }

                if (level >= 8 && r === 0) {
                    health = 3
                }

                if (level >= 10 && r <= 1) {
                    health = 3
                }

                if (level >= 14 && r <= 2) {
                    health = 4
                }
            }

            bricks.push({
                x: sidePadding + c * (brickWidth + gap),
                y: topOffset + r * (brickHeight + gap),
                w: brickWidth,
                h: brickHeight,
                active: active,
                health: health
            })
        }
    }
}

function getPatternType() {
    if (level === 1) return "full"
    if (level === 2) return "gaps"
    if (level === 3) return "checker"
    if (level === 4) return "pyramid"
    if (level === 5) return "frame"
    if (level === 6) return "tunnel"
    if (level === 7) return "diamond"

    const latePatterns = ["full", "gaps", "checker", "pyramid", "frame", "tunnel", "diamond"]
    return latePatterns[(level - 8) % latePatterns.length]
}

function triggerScreenShake(frames, strength) {
    screenShakeFrames = frames
    screenShakeStrength = strength
}

// === UI HELPERS === //
function buildMenuActions() {
    return {
        startGame: () => {
            userStartAudio()
            startNewGame()
        },

        resumeGame: () => {
            gameState = GAME_STATE.PLAYING
        },

        returnToTitle: () => {
            gameState = GAME_STATE.MENU
        },

        getAudioSettings: () => ({
            soundEnabled: true,
            masterVolume: 100
        }),

        setSoundEnabled: (enabled) => {
            AudioManager.setSoundEnabled(enabled)
        },

        setMasterVolume: (volume) => {
            AudioManager.setMasterVolume(volume)
        }
    }
}

// === CLASSES === //


// === GAME RULE HELPERS === //
function startNewGame() {
    score = 0
    level = 1
    lives = GAME_CONFIG.startingLives
    combo = 0
    comboTimer = 0
    highestCombo = 0
    setupBricks()
    resetRound()
}

function resetRound() {
    ball.speed = getBallStartSpeed()
    paddle.speed = getPaddleSpeed()
    setupPaddle()
    parkBallOnPaddle()
    resetCombo()
    startCountdown()
}

function startNewLevel() {
    level++
    setupBricks()
    resetRound()
}

function loseLife() {
    applyLoseLifePenalty()
    resetCombo()
    lives--

    if (lives <= 0) {
        endGame("gameOver")
    } else {
        resetRound()
    }
}

function getLevelMultiplier() {
    return level
}

function getBrickScoreValue() {
    return GAME_CONFIG.baseBrickScore * getLevelMultiplier() * Math.max(1, combo)
}

function resetCombo() {
    combo = 0
    comboTimer = 0
    comboPopFrames = 0
}

function refreshComboTimer() {
    comboTimer = GAME_CONFIG.comboResetFrames
}

function increaseCombo() {
    combo++
    highestCombo = Math.max(highestCombo, combo)
    refreshComboTimer()

    comboPopFrames = comboPopDuration
}

function updateComboTimer() {
    if (comboTimer > 0) {
        comboTimer--

        if (comboTimer <= 0) {
            resetCombo()
        }
    }
}

function getLoseLifePenalty() {
    return GAME_CONFIG.baseBrickScore * GAME_CONFIG.loseLifePenaltyBricks * level
}

function applyLoseLifePenalty() {
    score -= getLoseLifePenalty()

    if (score < 0) {
        score = 0
    }
}

function updateAllTimeHighscore() {
    if (score > allTimeHighscore) {
        allTimeHighscore = score
        Storage.save(STORAGE_KEYS.allTimeHighscore, allTimeHighscore)
        return true
    }

    return false
}

function endGame(result) {
    AudioManager.play(sounds.gameover, 0.6)

    const isNewHighscore = updateAllTimeHighscore()

    const stats = [
        {
            type: "stat",
            label: "Score",
            value: nf(score, 6)
        },
        {
            type: "stat",
            label: "All-Time Highscore",
            value: nf(allTimeHighscore, 6),
            highlight: isNewHighscore,
            suffix: isNewHighscore ? "NEW HIGHSCORE" : ""
        }
    ]

    gameState = GAME_STATE.GAME_OVER

    menu.openScreen("matchResult", null, {
        result,
        stats
    })
}

function checkGameOver() {
    let activeBrickFound = false

    for (let i = 0; i < bricks.length; i++) {
        if (bricks[i].active) {
            activeBrickFound = true
            break
        }
    }

    if (!activeBrickFound) {
        startNewLevel()
    }
}

function pauseGame() {
    gameState = GAME_STATE.PAUSED
    menu.openScreen("pause")
}

// === UPDATE HELPERS === //
function updateCountdown() {
    parkBallOnPaddle()

    countdownFrames--

    if (countdownFrames <= 0) {
        countdownValue--

        if (countdownValue <= 0) {
            AudioManager.play(sounds.start, 0.5)
            launchBall()
            gameState = GAME_STATE.PLAYING
            return
        }

        AudioManager.play(sounds.countdown, 0.35)
        countdownFrames = 60
    }
}

function updatePaddle () {
    const touchPosition = Input.getPointerPosition("brick-blitz-game")

    if (Input.isTouchActive() && touchPosition) {
        paddle.x = touchPosition.x - paddle.w / 2
    } else {
        if (Input.isDown("ArrowLeft")) {
            paddle.x -= paddle.speed
        }

        if (Input.isDown("ArrowRight")) {
            paddle.x += paddle.speed
        }
    }

    if (paddle.x < 0) {
        paddle.x = 0
    }

    if (paddle.x + paddle.w > width) {
        paddle.x = width - paddle.w
    }
}

function updateBall () {
    ball.x += ball.vx
    ball.y += ball.vy

    // Left wall
    if (ball.x - ball.r < 0) {
        ball.x = ball.r
        ball.vx *= -1
        AudioManager.play(sounds.wallHit, 0.3)
    }

    // Right wall
    if (ball.x + ball.r > width) {
        ball.x = width - ball.r
        ball.vx *= -1
        AudioManager.play(sounds.wallHit, 0.3)
    }

    // Top wall
    if (ball.y - ball.r < 0) {
        ball.y = ball.r
        ball.vy *= -1
        AudioManager.play(sounds.wallHit, 0.3)
    }

    // Paddle collision
    if (
        ball.x + ball.r > paddle.x &&
        ball.x - ball.r < paddle.x + paddle.w &&
        ball.y + ball.r > paddle.y &&
        ball.y - ball.r < paddle.y + paddle.h
    ) {
        const ballLeft = ball.x - ball.r
        const ballRight = ball.x + ball.r
        const ballTop = ball.y - ball.r
        const ballBottom = ball.y + ball.r

        const paddleLeft = paddle.x
        const paddleRight = paddle.x + paddle.w
        const paddleTop = paddle.y
        const paddleBottom = paddle.y + paddle.h

        const overlapLeft = ballRight - paddleLeft
        const overlapRight = paddleRight - ballLeft
        const overlapTop = ballBottom - paddleTop
        const overlapBottom = paddleBottom - ballTop

        const minOverlapX = Math.min(overlapLeft, overlapRight)
        const minOverlapY = Math.min(overlapTop, overlapBottom)

        if (minOverlapX < minOverlapY) {
            if (overlapLeft < overlapRight) {
                ball.x = paddleLeft - ball.r
            } else {
                ball.x = paddleRight + ball.r
            }

            ball.vx *= -1
        } else {
            if (overlapTop < overlapBottom) {
                ball.y = paddleTop - ball.r

                const paddleCenter = paddle.x + paddle.w / 2
                const hitOffset = ball.x - paddleCenter
                const normalizedHit = hitOffset / (paddle.w / 2)
                const clampedHit = constrain(normalizedHit, -1, 1)

                const maxBounceAngle = radians(60)
                const bounceAngle = clampedHit * maxBounceAngle

                increaseBallSpeed()

                ball.vx = ball.speed * sin(bounceAngle)
                ball.vy = -ball.speed * cos(bounceAngle)

                AudioManager.play(sounds.paddleHit, 0.45)

                resetCombo()
                triggerScreenShake(4, 0.6)
            } else {
                ball.y = paddleBottom + ball.r
                ball.vy *= -1
            }
        }
    }

    if (ball.y - ball.r > height) {
        loseLife()
        return
    }

    for (let i = 0; i < bricks.length; i++) {
        let brick = bricks[i]
        
        if (!brick.active) continue
        
        if (
            ball.x + ball.r > brick.x &&            
            ball.x - ball.r < brick.x + brick.w &&
            ball.y + ball.r > brick.y &&
            ball.y - ball.r < brick.y + brick.h
        ) {
            brick.health--

            if (brick.health <= 0) {
                brick.active = false
                increaseCombo()
                score += getBrickScoreValue()

                AudioManager.play(sounds.brickBreak, 0.4)
            } else {
                refreshComboTimer()

                AudioManager.play(sounds.brickHit, 0.3)
            }

            const ballLeft = ball.x - ball.r
            const ballRight = ball.x + ball.r
            const ballTop = ball.y - ball.r
            const ballBottom = ball.y + ball.r

            const brickLeft = brick.x
            const brickRight = brick.x + brick.w
            const brickTop = brick.y
            const brickBottom = brick.y + brick.h

            const overlapLeft = ballRight - brickLeft
            const overlapRight = brickRight - ballLeft
            const overlapTop = ballBottom - brickTop
            const overlapBottom = brickBottom - ballTop

            const minOverlapX = Math.min(overlapLeft, overlapRight)
            const minOverlapY = Math.min(overlapTop, overlapBottom)

            if (minOverlapX < minOverlapY) {
                if (overlapLeft < overlapRight) {
                    ball.x = brickLeft - ball.r
                } else {
                    ball.x = brickRight + ball.r
                }

                ball.vx *= -1
            } else {
                if (overlapTop < overlapBottom) {
                    ball.y = brickTop - ball.r
                } else {
                    ball.y = brickBottom + ball.r
                }

                ball.vy *= -1
            }

            increaseBallSpeed()
            applyBallSpeedToCurrentDirection()
            triggerScreenShake(3, 1)

            break
        }
    }

    checkGameOver()
}


// === DRAW HELPERS === //
function drawBackground() {
    background(GAME_COLORS.bg)
}

function drawPaddle() {
    fill(GAME_COLORS.main)
    noStroke()
    rect(paddle.x, paddle.y, paddle.w, paddle.h)
}

function drawBall() {
    fill(GAME_COLORS.text)
    circle(ball.x, ball.y, ball.r * 2)
}

function drawBricks() {
    noStroke()

    for (let i = 0; i < bricks.length; i++) {
        let brick = bricks[i]

        if (brick.active) {
            if (brick.health >= 4) {
                fill("#5e3b0c")
            } else if (brick.health === 3) {
                fill("#7a5516")
            } else if (brick.health === 2) {
                fill("#8b6b1f")
            } else {
                fill(GAME_COLORS.main)
            }
           
            rect(brick.x, brick.y, brick.w, brick.h)
        }
    }
}

function drawHud() {
    noStroke()

    // SCORE //
    fill(GAME_COLORS.text)
    textSize(20)
    textAlign(LEFT, TOP)

    const scoreLabel = "Score: " + nf(score, 6)
    text(scoreLabel, 12, 12)

    // COMBO //
    if (combo > 1) {
        const scoreWidth = textWidth(scoreLabel)

        const popProgress = comboPopFrames / comboPopDuration
        const comboSize = 14 + popProgress * 4
        const comboY = 14 - popProgress * 2

        fill(combo >= 5 ? "#f4deb0" : "#d4af37") // softer gold accent
        textSize(comboSize)
        
        text("   |   x" + combo + " Combo", 12 + scoreWidth + 6, comboY)
    }
    
    // LEVEL //
    fill(GAME_COLORS.text)
    textSize(20)
    textAlign(CENTER, TOP)
    text("Level: " + level, width / 2, 12)

    // LIVES //
    textAlign(RIGHT, TOP)
    text("Lives: " + lives, width - 12, 12)
}

function drawOverlay() {
    if (gameState === GAME_STATE.COUNTDOWN) {
        const box = Layout.getCenteredBox(0.28, 0.18, 0)

        UI.drawMessageBox(box.x, box.y, box.w, box.h, {
            fillColor: "#111111",
            fillAlpha: 220,
            strokeColor: "#d4af37",
            strokeAlpha: 255,
            strokeWeight: 2,
            radius: 18
        })

        fill(GAME_COLORS.text)
        noStroke()
        textAlign(CENTER, CENTER)
        textSize(42)
        text(countdownValue, box.x, box.y)
    }
}

function drawGame() {
    drawPaddle()
    drawBall()
    drawBricks()
}

// === P5 LIFECYCLE (ES MODULE MODE) === //
window.preload = function() {
    sounds = AudioManager.loadSounds({
        brickBreak: "/assets/sounds/games/brick-blitz/brick-break.mp3",
        brickHit: "/assets/sounds/games/brick-blitz/brick-hit.mp3",
        paddleHit: "/assets/sounds/games/brick-blitz/paddle-hit.mp3",
        wallHit: "/assets/sounds/games/brick-blitz/wall-hit.mp3",
        gameover: "/assets/sounds/games/brick-blitz/game-over.mp3",
        countdown: "/assets/sounds/games/brick-blitz/countdown-beep.mp3",
        start: "/assets/sounds/games/brick-blitz/start.mp3"
    })
}

window.setup = function () {
    CanvasManager.createResponsive("brick-blitz-game")
    
    Input.init()

    menu = new Menu.Manager(buildMenuActions())

    const gameContainer = document.getElementById("brick-blitz-game")
    menu.init(gameContainer)
    menu.openScreen("title")

    allTimeHighscore = Storage.load(STORAGE_KEYS.allTimeHighscore, 0)

    setupPaddle()
    setupBricks()
    resetBall()

    gameState = GAME_STATE.MENU
}

window.draw = function () {
    const menuHandled = menu.handleInput(
        (code) => Input.wasPressed(code),
        (code) => Input.wasPressedOrRepeated(code)
    )

    if (!menuHandled) {
        if (Input.wasPressed("Escape")) {
            if (gameState === GAME_STATE.PLAYING) {
                pauseGame()
            } else if (gameState === GAME_STATE.PAUSED) {
                menu.actions.resumeGame()
            }
        }
    }

    if (!menuHandled) {
        if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.COUNTDOWN) {
            updatePaddle()
        }
    }

    if (!menuHandled) {
        if(gameState === GAME_STATE.PLAYING) {
            updateBall()
            updateComboTimer()

            if (comboPopFrames > 0) {
                comboPopFrames--
            }
        }

        if (gameState === GAME_STATE.COUNTDOWN) {
            updateCountdown()
        }
    }

    drawBackground()

    push()

    if (screenShakeFrames > 0) {
        const decay = screenShakeFrames / 4
        const strength = screenShakeStrength * decay

        const shakeX = random(-strength, strength)
        const shakeY = random(-strength, strength)
        translate(shakeX, shakeY)

        screenShakeFrames--
    }

    drawGame()

    pop()

    drawHud()
    drawOverlay()

    Input.clearPressed()
}