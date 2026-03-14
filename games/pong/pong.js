
let playerPaddle
let aiPaddle
let ball
let gameOver = false

let playerScore = 0
let aiScore = 0
let highScore = 0

const WIN_SCORE = 5

function initGame() {
    playerPaddle = new Paddle(true, "blue")
    aiPaddle = new Paddle(false, "red")
    ball = new Ball("green")
    playerScore = 0
    aiScore = 0
    gameOver = false
}

class Paddle {
    constructor(isLeft, col) {
        this.w = 20
        this.h = 100
        this.y = height / 2 - this.h / 2
        this.yChange = 0
        this.isLeft = isLeft
        this.col = col
    }

    show() {
        fill(this.col)
        let x = this.isLeft ? 0 : width - this.w
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
                if (abs(distanceToBall) > 20) {
                    moveSpeed = constrain(distanceToBall * 0.08, -6, 6)
                }
            }
        }

        this.yChange = moveSpeed
        this.update()
    }    
}

class Ball {
    constructor(col) {
        this.r = 12
        this.col = col
        this.reset()
    }

    reset() {
        this.x = width / 2
        this.y = height / 2

        let xDirection = random([-1, 1])
        let yDirection = random([-1, 1])

        this.xspeed = 6 * xDirection
        this.yspeed = random(2, 4) * yDirection
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
        if (this.y - this.r < 0 || this.y + this.r > height) {
            this.yspeed *= -1 // Reverse direction
        }
    }
    
    checkPaddle(paddle) {
        // Check collision with paddles
        if (this.y > paddle.y && this.y < paddle.y + paddle.h) {
            if (paddle.isLeft && this.x - this.r < paddle.w) {
                this.x = paddle.w + this.r
                this.xspeed *= -1

                let hitPos = this.y - (paddle.y + paddle.h / 2)
                this.yspeed = hitPos * 0.15
            } else if (!paddle.isLeft && this.x + this.r > width - paddle.w) {
                this.x = width - paddle.w - this.r
                this.xspeed *= -1

                let hitPos = this.y - (paddle.y + paddle.h / 2)
                this.yspeed = hitPos * 0.15
            }
        }
    }
}

function setup() {
    const canvas = createCanvas(800, 500)
    canvas.parent("pong-game")
    initGame()
}

function drawNet() {
    stroke("white")
    strokeWeight(4)

    for (let y = 0; y < height; y += 30) {
        line(width / 2, y, width / 2, y + 15)
    }

    noStroke()
}

function displayScores() {
    fill("black")
    textSize(32)
    textAlign(CENTER, TOP)

    text(playerScore, width / 4, 20)
    text(aiScore, width * 3 / 4, 20)
}

function draw() {
    background("white")
    drawNet()
    displayScores()

    if (gameOver) {
        displayGameOver()
        return
    }
    
    playerPaddle.show()
    playerPaddle.update()

    aiPaddle.show()
    aiPaddle.aiMove()
    // aiPaddle.update()

    ball.show()
    ball.update()
    ball.edges() // Check for ball hitting edges
    ball.checkPaddle(playerPaddle)
    ball.checkPaddle(aiPaddle)

    if (ball.x + ball.r < 0) {
        aiScore += 1
        checkGameOver()
        if (!gameOver) {
            ball.reset()
        }
    } 

    if (ball.x - ball.r > width) {
        playerScore += 1
        checkGameOver()
        if (!gameOver) {
            ball.reset()
        }
    }
}

// Display GAME OVER message
function displayGameOver() {
    fill("orange")
    textAlign(CENTER, CENTER)

    textSize(48)
    text("GAME OVER", width / 2, height / 2 - 60)

    textSize(28)
    if (playerScore > aiScore) {
        text("You Win!", width / 2, height / 2)
    } else {
        text("You Lose!", width / 2, height / 2)
    }

    textSize(22)
    fill("black")
    text("High Score: " + highScore, width / 2, height / 2 + 45)
    text("Press ENTER to play again", width / 2, height / 2 + 85)
}

function checkGameOver() {
    if (playerScore > highScore) {
        highScore = playerScore
    }

    if (playerScore >= WIN_SCORE || aiScore >= WIN_SCORE) {
        gameOver = true
    }
}

// Handles all key presses in a single function
function keyPressed() {
    if (gameOver && keyCode  === ENTER) {
        initGame()
        return
    }
    
    if (keyCode === UP_ARROW) {
        playerPaddle.move(-10)
    } else if (keyCode === DOWN_ARROW) {
        playerPaddle.move(10)
    }
}

function keyReleased() {
    playerPaddle.move(0)
}