// === ELEMENTS ===
const resultElement = document.getElementById("tool-result")
const hoursInput = document.getElementById("countdown-hours")
const minutesInput = document.getElementById("countdown-minutes")
const secondsInput = document.getElementById("countdown-seconds")
const messageElement = document.getElementById("tool-message")
const startButton = document.getElementById("tool-action-button")
const resetButton = document.getElementById("tool-reset-button")

// === AUDIO ===
const completeSound = new Audio("/assets/sounds/tools/countdown/countdown-complete.wav")
completeSound.volume = 0.6
completeSound.loop = false

// === STATE ===
let remainingSeconds = 0
let countdownInterval = null

// === FUNCTIONS ===
function getCountdownInputValues() {
    const hours = clampNumber(Number(hoursInput.value), 0, 99)
    const minutes = clampNumber(Number(minutesInput.value), 0, 59)
    const seconds = clampNumber(Number(secondsInput.value), 0, 59)

    hoursInput.value = hours
    minutesInput.value = minutes
    secondsInput.value = seconds

    return {
        hours,
        minutes,
        seconds
    }
}

function getTotalSeconds(hours, minutes, seconds) {
    return hours * 60 * 60 + minutes * 60 + seconds
}

function clampNumber(value, min, max) {
    if (Number.isNaN(value)) {
        return min
    }

    const wholeNumber = Math.floor(value)

    return Math.min(Math.max(wholeNumber, min), max)
}

function isValidCountdownTime(totalSeconds) {
    return totalSeconds > 0
}

function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const formattedHours = String(hours).padStart(2, "0")
    const formattedMinutes = String(minutes).padStart(2, "0")
    const formattedSeconds = String(seconds).padStart(2, "0")

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
}

function allowOnlyWholeNumberKeys(event) {
    const allowedKeys = [
        "Backspace",
        "Delete",
        "Tab",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End"
    ]

    if (allowedKeys.includes(event.key)) {
        return
    }

    if (event.ctrlKey || event.metaKey) {
        return
    }

    if (!/^\d$/.test(event.key)) {
        event.preventDefault()
    }
}

function cleanWholeNumberInput(input) {
    input.value = input.value.replace(/\D/g, "")
}

function setupWholeNumberInput(input) {
    input.addEventListener("keydown", allowOnlyWholeNumberKeys)

    input.addEventListener("input", () => {
        cleanWholeNumberInput(input)
    })
}

function stopCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
    }
}

function startCountdown(totalSeconds) {
    stopCountdown()
    stopCompleteSound()

    remainingSeconds = totalSeconds
    resultElement.textContent = formatTime(remainingSeconds)
    messageElement.textContent = "Countdown running."
    startButton.textContent = "Pause Countdown"
    setInputsDisabled(true)

    countdownInterval = setInterval(() => {
        remainingSeconds--

        resultElement.textContent = formatTime(remainingSeconds)

        if (remainingSeconds <= 0) {
            stopCountdown()
            messageElement.textContent = "Countdown complete."
            startButton.textContent = "Start Countdown"
            setInputsDisabled(false)
            playCompleteSound()
        }
    }, 1000)
}

function pauseCountdown() {
    stopCountdown()

    startButton.textContent = "Resume Countdown"
    messageElement.textContent = "Countdown paused."
}

function resetCountdown() {
    stopCountdown()
    stopCompleteSound()

    remainingSeconds = 0

    resultElement.textContent = "00:00:00"

    hoursInput.value = 0
    minutesInput.value = 30
    secondsInput.value = 0

    messageElement.textContent = "Set your time, then start the countdown."
    startButton.textContent = "Start Countdown"
    setInputsDisabled(false)
}

function setInputsDisabled(isDisabled) {
    hoursInput.disabled = isDisabled
    minutesInput.disabled = isDisabled
    secondsInput.disabled = isDisabled
}

function playCompleteSound() {
    completeSound.currentTime = 0

    completeSound.play().catch(() => {
        console.warn("Countdown complete sound could not play.")
    })
}

function stopCompleteSound() {
    completeSound.pause()
    completeSound.currentTime = 0
}

// === EVENT LISTENERS ===
if (
    resultElement &&
    hoursInput &&
    minutesInput &&
    secondsInput &&
    messageElement &&
    startButton &&
    resetButton
) {
    setupWholeNumberInput(hoursInput)
    setupWholeNumberInput(minutesInput)
    setupWholeNumberInput(secondsInput)

    startButton.addEventListener("click", () => {
        if (countdownInterval) {
            pauseCountdown()
            return
        }

        if (remainingSeconds > 0) {
            startCountdown(remainingSeconds)
            return
        }

        const countdownTime = getCountdownInputValues()

        const totalSeconds = getTotalSeconds(
            countdownTime.hours,
            countdownTime.minutes,
            countdownTime.seconds
        )

        if (!isValidCountdownTime(totalSeconds)) {
            messageElement.textContent = "Please set a countdown time greater than zero."
            return
        }

        startCountdown(totalSeconds)
    })

    resetButton.addEventListener("click", () => {
        resetCountdown()
    })
} else {
    console.warn("Countdown tool elements could not be found.")
}
