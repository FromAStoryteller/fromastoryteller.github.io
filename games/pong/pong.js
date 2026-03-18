// === CONSTANTS === //
const GAME_STATE = {
    MENU: "menu",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
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
    aiDeadZoneRatio: 0.04,
    aiMaxSpeedRatio: 0.012,
    aiTrackingStrength: 0.08
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
    scoreTextRatio: 0.064,
    gameOverTitleRatio: 0.096,
    gameOverResultRatio: 0.056,
    gameOverTextRatio: 0.044
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
    highScore: "pongHighscore"
}

// === VARIABLES === //
let gameState = GAME_STATE.MENU
let countdownValue = GAME_CONFIG.countdownSeconds
let countdownStartTime = 0
let lastCountdownSound = 0

let playerPaddle
let aiPaddle
let ball

let playerScore = 0
let aiScore = 0
let highScore = loadFromStorage(STORAGE_KEYS.highScore, 0)

let sounds = {}

// === SETUP HELPERS === //
function startCountdown() {
    countdownValue = GAME_CONFIG.countdownSeconds
    countdownStartTime = millis()
    lastCountdownSound = 0
    gameState = GAME_STATE.COUNTDOWN
}

function initGame() {
    playerScore = 0
    aiScore = 0
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
    ball.r = getBaseSize() * BALL_CONFIG.radiusRatio
    ball.baseSpeed = getBaseSize() * BALL_CONFIG.baseSpeedRatio
    ball.maxSpeed = getBaseSize() * BALL_CONFIG.maxSpeedRatio
}

function resetRound() {
    ball.reset()
    startCountdown()
}

// === UI HELPERS === //
function drawMenu() {
    const box = getCenteredBox(0.55, 0.36)

    drawMessageBox(box.x, box.y, box.w, box.h, UI_PANEL_STYLE)

    textAlign(CENTER, CENTER)

    const titleY = box.y - height * 0.045
    const promptY = box.y + height * 0.015
    const controlsY = box.y + height * 0.07

    fill(GAME_COLORS.title)
    textSize(getBaseSize() * UI_CONFIG.menuTitleRatio)
    text("PONG", box.x, titleY)

    fill(GAME_COLORS.text)
    textSize(getBaseSize() * UI_CONFIG.menuPromptRatio)
    text("Press ENTER to start game", box.x, promptY)

    textSize(getBaseSize() * UI_CONFIG.menuControlsRatio)
    text("UP and DOWN arrows to control the left paddle", box.x, controlsY)
}

function updateCountdown() {
    const elapsed = millis() - countdownStartTime
    countdownValue = GAME_CONFIG.countdownSeconds - floor(elapsed / 1000)

    if (countdownValue <= 0) {
        playSound(sounds.start)
        gameState = GAME_STATE.PLAYING
        return
    }

    if (countdownValue !== lastCountdownSound) {
        playSound(sounds.countdown)
        lastCountdownSound = countdownValue
    }
}

function drawCountdown() {
    const box = getCenteredBox(0.22, 0.2)

    drawMessageBox(box.x, box.y, box.w, box.h, UI_PANEL_STYLE)

    fill(GAME_COLORS.title)
    textAlign(CENTER, CENTER)
    textSize(getBaseSize() * UI_CONFIG.countdownTextRatio)

    const countdownY = box.y + height * 0.008
    text(countdownValue, box.x, countdownY)
}

function drawGameOver() {
    const box = getCenteredBox(0.5, 0.42)

    drawMessageBox(box.x, box.y, box.w, box.h, UI_PANEL_STYLE)

    textAlign(CENTER, CENTER)

    fill(GAME_COLORS.title)
    textSize(getBaseSize() * UI_CONFIG.gameOverTitleRatio)
    text("GAME OVER", box.x, box.y - getBaseSize() * 0.12)

    textSize(getBaseSize() * UI_CONFIG.gameOverResultRatio)
    fill(GAME_COLORS.text)
    if (playerScore > aiScore) {
        text("You Win!", box.x, box.y)
    } else {
        text("You Lose!", box.x, box.y)
    }

    textSize(getBaseSize() * UI_CONFIG.gameOverTextRatio)
    fill(GAME_COLORS.text)
    text("High Score: " + highScore, box.x, box.y + getBaseSize() * 0.09)
    text("Press ENTER to play again", box.x, box.y + getBaseSize() * 0.17)
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
        this.r = getBaseSize() * BALL_CONFIG.radiusRatio
        this.color = color
        this.baseSpeed = getBaseSize() * BALL_CONFIG.baseSpeedRatio
        this.speedIncrease = BALL_CONFIG.speedIncrease
        this.maxSpeed = getBaseSize() * BALL_CONFIG.maxSpeedRatio
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
            playSound(sounds.wallHit)
        } else if (this.y + this.r >= height) {
            this.y = height - this.r
            this.yspeed *= -1
            playSound(sounds.wallHit)
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

        this.increaseSpeed()
        playSound(sounds.paddleHit)
    }
}

// === GAME RULE HELPERS === //
function awardPoint(scoringSide) {
    if (scoringSide === SCORING_SIDE.PLAYER) {
        playerScore += 1
    } else {
        aiScore += 1
    }

    playSound(sounds.score)
    checkGameOver()

    if (gameState === GAME_STATE.GAME_OVER) {
        if (scoringSide === SCORING_SIDE.PLAYER) {
            playSound(sounds.win)
        } else {
            playSound(sounds.lose)
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
    if (playerScore > highScore) {
        highScore = playerScore
        saveToStorage(STORAGE_KEYS.highScore, highScore)
    }

    if (playerScore >= GAME_CONFIG.winScore || aiScore >= GAME_CONFIG.winScore) {
        gameState = GAME_STATE.GAME_OVER
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
            const deadZone = height * PADDLE_CONFIG.aiDeadZoneRatio
            if (abs(distanceToBall) > deadZone) {
                const maxSpeed = height * PADDLE_CONFIG.aiMaxSpeedRatio
                moveSpeed = constrain(distanceToBall * PADDLE_CONFIG.aiTrackingStrength, -maxSpeed, maxSpeed)
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
    updatePlayerPaddle()

    if (gameState === GAME_STATE.PLAYING) {
        updatePlaying()
    }

    if (gameState === GAME_STATE.COUNTDOWN) {
        updateCountdown()
    }
}

// === DRAW HELPERS === //
function drawNet() {
    stroke(GAME_COLORS.net)
    strokeWeight(getBaseSize() * LAYOUT.netWidthRatio)
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
    fill(GAME_COLORS.score)
    textSize(getBaseSize() * UI_CONFIG.scoreTextRatio)
    textAlign(CENTER, TOP)

    text(playerScore, width / 4, getBaseSize() * 0.04)
    text(aiScore, width * 3 / 4, getBaseSize() * 0.04)
}

function drawGameScene() {
    background(GAME_COLORS.bg)
    drawNet()
    drawScores()

    playerPaddle.show()
    aiPaddle.show()
    ball.drawTrail()
    ball.show()
}

function drawOverlay() {
    if (gameState === GAME_STATE.MENU) {
        drawMenu()
        return
    }

    if (gameState === GAME_STATE.COUNTDOWN) {
        drawCountdown()
        return
    }

    if (gameState === GAME_STATE.GAME_OVER) {
        drawGameOver()
        return
    }
}

function renderGame() {
    drawGameScene()
    drawOverlay()
}

// === P5 LIFECYCLE === //
function preload() {
    sounds = loadSounds({
        paddleHit: "/assets/sounds/games/pong/paddle-hit.wav",
        wallHit: "/assets/sounds/games/pong/wall-hit.wav",
        score: "/assets/sounds/games/pong/score.mp3",
        win: "/assets/sounds/games/pong/win.wav",
        lose: "/assets/sounds/games/pong/lose.wav",
        countdown: "/assets/sounds/games/pong/countdown-beep.wav",
        start: "/assets/sounds/games/pong/start.wav"
    })
}

function setup() {
    createResponsiveCanvas("pong-game")

    setupInput()

    createGameObjects()
    gameState = GAME_STATE.MENU
}

function windowResized() {
    resizeResponsiveCanvas("pong-game")

    if (playerPaddle && aiPaddle && ball) {
        updateGameObjectSizes()
    }
}

function draw() {
    handleInput()
    updateGame()
    renderGame()
    clearPressedKeys()
}

function handleInput() {
    const paddleSpeed = height * PADDLE_CONFIG.playerSpeedRatio

    if (wasKeyPressed("Enter")) {
        userStartAudio()

        if (gameState === GAME_STATE.MENU || gameState === GAME_STATE.GAME_OVER) {
            initGame()
        }
    }

    if (isKeyDown("ArrowUp")) {
        playerPaddle.move(-paddleSpeed)
    } else if (isKeyDown("ArrowDown")) {
        playerPaddle.move(paddleSpeed)
    } else {
        playerPaddle.move(0)
    }
}