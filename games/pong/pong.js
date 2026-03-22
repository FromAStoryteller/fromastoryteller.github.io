// === IMPORTS === //
import { Menu } from "../shared/menu/index.js"
import { Input } from "../shared/input.js"
import { AudioManager } from "../shared/audio.js"
import { CanvasManager } from "../shared/canvas.js"
import { Layout } from "../shared/layout.js"
import { Storage } from "../shared/storage.js"
import { UI } from "../shared/ui.js"
import { Utils } from "../shared/utils.js"

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
    aiDeadZoneRatio: 0.03,
    aiMaxSpeedRatio: 0.014,
    aiTrackingStrength: 0.09
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
        aiTrackingMultiplier: 0.8
    },
    Normal: {
        aiDeadZoneMultiplier: 1,
        aiMaxSpeedMultiplier: 1,
        aiTrackingMultiplier: 1
    },
    Hard: {
        aiDeadZoneMultiplier: 0.8,
        aiMaxSpeedMultiplier: 1.2,
        aiTrackingMultiplier: 1.2
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
    bestRally: "pongBestRally",
    soundEnabled: "pongSoundEnabled",
    masterVolume: "pongMasterVolume"
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
        this.yChange = 0
        this.side = side
        this.color = color
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

    move(numPixels) {
        this.yChange = numPixels
    }

    update() {
        this.y += this.yChange
        this.y = constrain(this.y, 0, height - this.h)
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
        
    if (ball.xspeed > 0) {
        if (ball.x > width / 2) {
            const deadZone = height
                * PADDLE_CONFIG.aiDeadZoneRatio
                * currentDifficultySettings.aiDeadZoneMultiplier
            
            if (abs(distanceToBall) > deadZone) {
                const maxSpeed = height
                    * PADDLE_CONFIG.aiMaxSpeedRatio
                    * currentDifficultySettings.aiMaxSpeedMultiplier
                
                const trackingStrength = PADDLE_CONFIG.aiTrackingStrength
                    * currentDifficultySettings.aiTrackingMultiplier

                moveSpeed = constrain(
                    distanceToBall * trackingStrength,
                    -maxSpeed,
                    maxSpeed
                )
            }
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
        paddleHit: "/assets/sounds/games/pong/paddle-hit.wav",
        wallHit: "/assets/sounds/games/pong/wall-hit.wav",
        score: "/assets/sounds/games/pong/score.wav",
        win: "/assets/sounds/games/pong/win.wav",
        lose: "/assets/sounds/games/pong/lose.wav",
        countdown: "/assets/sounds/games/pong/countdown-beep.wav",
        start: "/assets/sounds/games/pong/start.wav"
    })
}

window.setup = function () {
    CanvasManager.createResponsive("pong-game")

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

    const gameContainer = document.getElementById("pong-game")
    menu.init(gameContainer)
    menu.openScreen("title")

    gameState = GAME_STATE.MENU
}

window.windowResized = function () {
    CanvasManager.resizeResponsive("pong-game")

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
        (code) => Input.wasPressedOrRepeated(code))

    if (menuHandled) {
        return
    }

    if (Input.wasPressed("Escape")) {
        if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.COUNTDOWN) {
            pausedFromState = gameState
            gameState = GAME_STATE.PAUSED
            menu.openScreen("pause")
            return
        }
    }

    if (gameState !== GAME_STATE.PLAYING && gameState !== GAME_STATE.COUNTDOWN) {
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