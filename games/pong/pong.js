let gameState = "menu"
let countdownValue = 3
let countdownStartTime = 0

let playerPaddle
let aiPaddle
let ball

let playerScore = 0
let aiScore = 0
let highScore = 0

const WIN_SCORE = 5
const PADDLE_MARGIN_RATIO = 0.04

const GAME_COLORS = {
    bg: "#26231f",
    net: "rgba(212, 175, 55, 0.28)",
    score: "#f5f1e8",
    panel: "rgba(17, 17, 17, 0.88)",
    panelBorder: "rgba(212, 175, 55, 0.35)",
    title: "#d4af37",
    text: "#f5f1e8",
    player: "#d4af37",
    ai: "#8b2f2f",
    ball: "#f3e7c2"
}

window.addEventListener("keydown", function (e) {
    if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault()
    }
}, {passive: false})

window.addEventListener("keyup", function (e) {
    if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault()
    }
}, {passive: false})

function startCountdown() {
    countdownValue = 3
    countdownStartTime = millis()
    gameState = "countdown"
}

function initGame() {
    playerScore = 0
    aiScore = 0
    resetObjects()
    startCountdown()
}

function resetObjects() {
    playerPaddle = new Paddle(true, GAME_COLORS.player)
    aiPaddle = new Paddle(false, GAME_COLORS.ai)
    ball = new Ball(GAME_COLORS.ball)
}

function drawMessageBox(boxY, boxW, boxH) {
    rectMode(CENTER)

    fill(17, 17, 17, 230)
    stroke(212, 175, 55, 90)
    strokeWeight(2)
    rect(width / 2, boxY, boxW, boxH, 12)

    noStroke()
    rectMode(CORNER)
}

function displayMenu() {
    const boxW = width * 0.55
    const boxH = height * 0.36
    const boxY = height / 2

    drawMessageBox(boxY, boxW, boxH)

    textAlign(CENTER, CENTER)

    const titleY = boxY - height * 0.045
    const promptY = boxY + height * 0.015
    const controlsY = boxY + height * 0.07

    fill(GAME_COLORS.title)
    textSize(min(width, height) * 0.085)
    text("PONG", width / 2, titleY)

    fill(GAME_COLORS.text)
    textSize(min(width, height) * 0.04)
    text("Press ENTER to start game", width / 2, promptY)

    textSize(min(width, height) * 0.03)
    text("UP and DOWN arrows to control the left paddle", width / 2, controlsY)
}

function displayCountdown() {
    const elapsed = millis() - countdownStartTime
    countdownValue = 3 - floor(elapsed / 1000)

    if (countdownValue <= 0) {
        gameState = "playing"
        return
    }

    const boxW = width * 0.22
    const boxH = height * 0.2
    const boxY = height / 2

    drawMessageBox(boxY, boxW, boxH)

    fill(GAME_COLORS.title)
    textAlign(CENTER, CENTER)
    textSize(min(width, height) * 0.14)

    const countdownY = boxY + height * 0.008
    text(countdownValue, width / 2, countdownY)
}

class Paddle {
    constructor(isLeft, col) {
        this.w = width * 0.025
        this.h = height * 0.2
        this.y = height / 2 - this.h / 2
        this.yChange = 0
        this.isLeft = isLeft
        this.col = col
    }

    getX() {
        const margin = width * PADDLE_MARGIN_RATIO
        return this.isLeft ? margin : width - this.w - margin
    }

    show() {
        fill(this.col)
        let x = this.getX()
        rect(x, this.y, this.w, this.h)
    }

    move(numPixels) {
        this.yChange = numPixels
    }

    update() {
        this.y += this.yChange
        // Prevent paddle from leaving canvas
        this.y = constrain(this.y, 0, height - this.h)
    }

    aiMove() {
        let moveSpeed = 0
        const paddleCenter = this.y + this.h / 2
        const distanceToBall = ball.y - paddleCenter
        
        // Only react when ball is moving toward the AI
        if (ball.xspeed > 0) {
            // Only start tracking when the ball is on the AI half
            if (ball.x > width / 2) {
                // Dead zone so AI doesn't perfectly jitter to the ball
                const deadZone = height * 0.04
                if (abs(distanceToBall) > deadZone) {
                    const maxSpeed = height * 0.012
                    moveSpeed = constrain(distanceToBall * 0.08, -maxSpeed, maxSpeed)
                }
            }
        }

        this.yChange = moveSpeed
        this.update()
    }    
}

class Ball {
    constructor(col) {
        this.r = min(width, height) * 0.024
        this.col = col
        this.baseSpeed = min(width, height) * 0.008
        this.speedIncrease = 1.08
        this.maxSpeed = min(width, height) * 0.022
        this.reset()
    }

    reset() {
        this.x = width / 2
        this.y = height / 2

        let xDirection = random([-1, 1])
        let launchAngle = random(-0.6, 0.6)
        
        this.xspeed = this.baseSpeed * xDirection
        this.yspeed = this.baseSpeed * launchAngle
    }

    increaseSpeed() {
        this.xspeed *= this.speedIncrease
        this.yspeed *= this.speedIncrease

        this.xspeed = constrain(this.xspeed, -this.maxSpeed, this.maxSpeed)
        this.yspeed = constrain(this.yspeed, -this.maxSpeed, this.maxSpeed)
    }

    show() {
        fill(this.col)
        ellipse(this.x, this.y, this.r * 2)
    }

    update() {
        this.x += this.xspeed
        this.y += this.yspeed
    }

    edges() {
        if (this.y - this.r <= 0) {
            this.y = this.r
            this.yspeed *= -1
        } else if (this.y + this.r >= height) {
            this.y = height - this.r
            this.yspeed *= -1
        }
    }
    
    checkPaddle(paddle) {
        // Check collision with paddles
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
            if (paddle.isLeft && this.xspeed < 0) {
                this.x = paddleRight + this.r
                this.handlePaddleBounce(paddle)
            } else if (!paddle.isLeft && this.xspeed > 0) {
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
        this.yspeed = normalizedHit * this.baseSpeed * 1.8

        this.increaseSpeed()
    }
}

function setup() {
    const container = document.getElementById("pong-game")

    const canvas = createCanvas(container.offsetWidth, container.offsetHeight)
    canvas.parent("pong-game")

    resetObjects()
    gameState = "menu"
}

function windowResized() {
    const container = document.getElementById("pong-game")
    resizeCanvas(container.offsetWidth, container.offsetHeight)
    resetObjects()
}

function drawNet() {
    stroke(GAME_COLORS.net)
    strokeWeight(min(width, height) * 0.008)
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

function displayScores() {
    fill(GAME_COLORS.score)
    textSize(min(width, height) * 0.064)
    textAlign(CENTER, TOP)

    text(playerScore, width / 4, min(width, height) * 0.04)
    text(aiScore, width * 3 / 4, min(width, height) * 0.04)
}

function draw() {
    background(GAME_COLORS.bg)
    drawNet()
    displayScores()

    playerPaddle.show()
    playerPaddle.update()

    aiPaddle.show()

    if (gameState === "playing") {
        aiPaddle.aiMove()

        ball.show()
        ball.update()
        ball.edges() // Check for ball hitting edges
        ball.checkPaddle(playerPaddle)
        ball.checkPaddle(aiPaddle)

        if (ball.x + ball.r < 0) {
            aiScore += 1
            checkGameOver()
            if (gameState !== "gameOver") {
                ball.reset()
                startCountdown()
            }
        } 

        if (ball.x - ball.r > width) {
            playerScore += 1
            checkGameOver()
            if (gameState !== "gameOver") {
                ball.reset()
                startCountdown()
            }
        }
    } else {
        ball.show()
    }

    if (gameState === "menu") {
        displayMenu()
        return
    }

    if (gameState === "countdown") {
        displayCountdown()
        return
    }

    if (gameState === "gameOver") {
        displayGameOver()
        return
    }
}

// Display GAME OVER message
function displayGameOver() {
    const boxW = width * 0.5
    const boxH = height * 0.42
    const boxY = height / 2

    drawMessageBox(boxY, boxW, boxH)

    textAlign(CENTER, CENTER)

    fill(GAME_COLORS.title)
    textSize(min(width, height) * 0.096)
    text("GAME OVER", width / 2, height / 2 - min(width, height) * 0.12)

    textSize(min(width, height) * 0.056)
    fill(GAME_COLORS.text)
    if (playerScore > aiScore) {
        text("You Win!", width / 2, height / 2)
    } else {
        text("You Lose!", width / 2, height / 2)
    }

    textSize(min(width, height) * 0.044)
    fill(GAME_COLORS.text)
    text("High Score: " + highScore, width / 2, height / 2 + min(width, height) * 0.09)
    text("Press ENTER to play again", width / 2, height / 2 + min(width, height) * 0.17)
}

function checkGameOver() {
    if (playerScore > highScore) {
        highScore = playerScore
    }

    if (playerScore >= WIN_SCORE || aiScore >= WIN_SCORE) {
        gameState = "gameOver"
    }
}

// Handles all key presses in a single function
function keyPressed() {
    const paddleSpeed = height * 0.02
    
    if (keyCode  === ENTER) {
        if (gameState === "menu") {
            initGame()
            return false
        }

        if (gameState === "gameOver") {
            initGame()
            return false
        }
    }
    
    if (keyCode === UP_ARROW) {
        playerPaddle.move(-paddleSpeed)
        return false
    }
    
    if (keyCode === DOWN_ARROW) {
        playerPaddle.move(paddleSpeed)
        return false
    }
}

function keyReleased() {
    if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
        playerPaddle.move(0)
        return false
    }
}