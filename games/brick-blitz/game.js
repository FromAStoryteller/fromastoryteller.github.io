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
        brickBreak: "/assets/sounds/games/brick-blitz/brick-break.wav",
        brickHit: "/assets/sounds/games/brick-blitz/brick-hit.wav",
        paddleHit: "/assets/sounds/games/brick-blitz/paddle-hit.wav",
        wallHit: "/assets/sounds/games/brick-blitz/wall-hit.wav",
        gameover: "/assets/sounds/games/brick-blitz/game-over.wav",
        countdown: "/assets/sounds/games/brick-blitz/countdown-beep.wav",
        start: "/assets/sounds/games/brick-blitz/start.wav"
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