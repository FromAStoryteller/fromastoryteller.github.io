
let playerPaddle
let aiPaddle
let ball
let gameOver = false

function initGame() {
    playerPaddle = new Paddle(true, "blue")
    aiPaddle = new Paddle(false, "red")
    ball = new Ball("green")
    gameOver = false
}

class Paddle {
    constructor(isLeft, col) {
        this.y = height / 2
        this.w = 20
        this.h = 100
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
        const distanceToBall = ball.y - (this.y + this.h / 2)

        if (ball.xspeed > 0) {
            // Move only if the ball is coming towards the AI paddle
            if (abs(distanceToBall) > this.h / 4) {
                // Move only if the ball is a certain distance away
                moveSpeed = constrain(distanceToBall * 0.1, -10, 10)
            }
        }

        this.yChange = moveSpeed
        this.update()
    }    
}

class Ball {
    constructor(col) {
        this.x = width / 2
        this.y = height / 2
        this.r = 12
        this.xspeed = 10
        this.yspeed = 4 // Slower speed
        this.col = col
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
                this.xspeed *= -1
                this.x = paddle.w + this.r
            } else if (!paddle.isLeft && this.x + this.r > width - paddle.w) {
                this.xspeed *= -1
                this.x = width - paddle.w - this.r
            }
        }
    }
}

function setup() {
    const canvas = createCanvas(800, 500)
    canvas.parent("pong-game")
    initGame()
}

function draw() {
    background("white")

    if (gameOver) {
        displayGameOver()
        return
    }
    
    playerPaddle.show()
    playerPaddle.update()

    aiPaddle.show()
    aiPaddle.aiMove()
    aiPaddle.update()

    ball.show()
    ball.update()
    ball.edges() // Check for ball hitting edges
    ball.checkPaddle(playerPaddle)
    ball.checkPaddle(aiPaddle)

    if (ball.x + ball.r < 0) {
        gameOver = true
    } 
}

// Display GAME OVER message
function displayGameOver() {
    textSize(48)
    fill("orange")
    textAlign(CENTER, CENTER)
    text("GAME OVER", width / 2, height / 2)
}

// Handles all key presses in a single function
function keyPressed() {
    if (keyCode === UP_ARROW) {
        playerPaddle.move(-10)
    } else if (keyCode === DOWN_ARROW) {
        playerPaddle.move(10)
    } else {
        if(gameOver) {
            initGame()
            return
        }
    }
}

function keyReleased() {
    playerPaddle.move(0)
}