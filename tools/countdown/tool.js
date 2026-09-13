// === ELEMENTS ===
const resultElement = document.getElementById("tool-result")
const hoursInput = document.getElementById("countdown-hours")
const minutesInput = document.getElementById("countdown-minutes")
const secondsInput = document.getElementById("countdown-seconds")
const messageElement = document.getElementById("tool-message")
const startButton = document.getElementById("tool-action-button")
const stopButton = document.getElementById("tool-stop-button")
const resetButton = document.getElementById("tool-reset-button")
const presetButtons = document.querySelectorAll(".countdown-preset")
const quickAddButtons = document.querySelectorAll(".countdown-add")
const setupElement = document.getElementById("countdown-setup")
const activeElement = document.getElementById("countdown-active")
const progressCircle = document.getElementById("countdown-progress-value")
const progressGlow = document.getElementById("countdown-progress-glow")

// === AUDIO ===
const completeSound = new Audio("/assets/sounds/tools/countdown/countdown-complete.wav")
completeSound.volume = 0.6
completeSound.loop = false

// === STATE ===
let remainingSeconds = 0
let initialSeconds = 0
let countdownInterval = null
let alarmIsPlaying = false

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
        clearSelectedPreset()
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

    if (initialSeconds === 0) {
        initialSeconds = totalSeconds
    }

    resultElement.textContent = formatTime(remainingSeconds)

    const nextVisualSecond = Math.max(remainingSeconds - 1, 0)
    updateProgressRing(nextVisualSecond)

    setCountdownView("active")
    setActionButtonsForState("playing")

    messageElement.textContent = "Countdown running."
    setInputsDisabled(true)
    stopButton.disabled = false

    countdownInterval = setInterval(() => {
        remainingSeconds--

        resultElement.textContent = formatTime(remainingSeconds)
        
        const nextVisualSecond = Math.max(remainingSeconds - 1, 0)
        updateProgressRing(nextVisualSecond)

        if (remainingSeconds <= 0) {
            stopCountdown()
            setCountdownView("setup")
            messageElement.textContent = "Countdown complete."
            setInputsDisabled(false)
            playCompleteSound()
            setAlarmCompleteState()
        }
    }, 1000)
}

function pauseCountdown() {
    stopCountdown()

    setActionButtonsForState("paused")
    messageElement.textContent = "Countdown paused."
}

function stopAndRestoreCountdown() {
    stopCountdown()
    stopCompleteSound()

    remainingSeconds = 0

    resultElement.textContent = formatTime(initialSeconds)
    setTimeInputsFromSeconds(initialSeconds)

    setCountdownView("setup")

    messageElement.textContent = "Countdown stopped."

    setActionButtonsForState("setup")
    setInputsDisabled(false)

    stopButton.disabled = true
    initialSeconds = 0
}

function resetCountdown() {
    stopCountdown()
    stopCompleteSound()

    remainingSeconds = 0

    resultElement.textContent = "00:00:00"

    hoursInput.value = 0
    minutesInput.value = 30
    secondsInput.value = 0

    setCountdownView("setup")

    messageElement.textContent = "Set your time, then start the countdown."
    setActionButtonsForState("setup")
    setInputsDisabled(false)

    initialSeconds = 0
    stopButton.disabled = true

    clearSelectedPreset()
}

function setInputsDisabled(isDisabled) {
    hoursInput.disabled = isDisabled
    minutesInput.disabled = isDisabled
    secondsInput.disabled = isDisabled

    presetButtons.forEach((button) => {
        button.disabled = isDisabled
    })
}

function playCompleteSound() {
    completeSound.currentTime = 0
    alarmIsPlaying = true

    completeSound.play().catch(() => {
        alarmIsPlaying = false
        console.warn("Countdown complete sound could not play.")
    })
}

function stopCompleteSound() {
    completeSound.pause()
    completeSound.currentTime = 0
    alarmIsPlaying = false
}

function setStartButtonState(state) {
    const icon = startButton.querySelector("i")

    if (state === "playing") {
        icon.className = "fa-solid fa-pause"
        startButton.setAttribute("aria-label", "Pause countdown")
        startButton.setAttribute("title", "Pause countdown")
        return
    }

    icon.className = "fa-solid fa-play"

    if (state === "paused") {
        startButton.setAttribute("aria-label", "Resume countdown")
        startButton.setAttribute("title", "Resume countdown")
        return
    }

    startButton.setAttribute("aria-label", "Start countdown")
    startButton.setAttribute("title", "Start countdown")
}

function setTimeInputsFromSeconds(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    hoursInput.value = hours
    minutesInput.value = minutes
    secondsInput.value = seconds
}

function setSelectedPreset(selectedButton) {
    presetButtons.forEach((button) => {
        button.setAttribute(
            "aria-pressed",
            button === selectedButton ? "true" : "false"
        )
    })
}

function clearSelectedPreset() {
    presetButtons.forEach((button) => {
        button.setAttribute("aria-pressed", false)
    })
}

function getCurrentTotalSeconds() {
    if (remainingSeconds > 0) {
        return remainingSeconds
    }

    const countdownTime = getCountdownInputValues()

    return getTotalSeconds(
        countdownTime.hours,
        countdownTime.minutes,
        countdownTime.seconds
    )
}

function setCountdownView(state) {
    const isActive = state === "active"

    setupElement.hidden = isActive
    activeElement.hidden = !isActive
}

function setActionButtonsForState(state) {
    const isSetup = state === "setup"
    const isPlaying = state === "playing"
    const isPaused = state === "paused"

    const stopIcon = stopButton.querySelector("i")

    stopIcon.className = "fa-solid fa-stop"
    stopButton.setAttribute("aria-label", "Stop countdown")
    stopButton.setAttribute("title", "Stop countdown")

    startButton.hidden = false
    stopButton.hidden = isSetup
    resetButton.hidden = !isSetup

    if (isPlaying) {
        setStartButtonState("playing")
    } else if (isPaused) {
        setStartButtonState("paused")
    } else {
        setStartButtonState("ready")
    }
}

function setAlarmCompleteState() {
    startButton.hidden = true
    resetButton.hidden = true
    stopButton.hidden = false
    stopButton.disabled = false

    const icon = stopButton.querySelector("i")

    icon.className = "fa-solid fa-volume-xmark"

    stopButton.setAttribute("aria-label", "Stop alarm")
    stopButton.setAttribute("title", "Stop alarm")
}

function updateProgressRing(displaySeconds = remainingSeconds) {
    if (!progressCircle || !progressGlow || initialSeconds <= 0) {
        return
    }

    const radius = progressCircle.r.baseVal.value
    const circumference = 2 * Math.PI * radius

    const progress = Math.max(
        0,
        Math.min(displaySeconds / initialSeconds, 1)
    )

    const progressOffset =
        circumference * (1 - progress)

    progressCircle.style.strokeDasharray =
        circumference

    progressCircle.style.strokeDashoffset =
        -progressOffset

    /*
     * Keep the glow just behind the moving edge,
     * entirely on the already-used/gold side.
     */
    const glowLength = 7

    const glowPosition =
        circumference * progress - glowLength

    progressGlow.style.strokeDasharray =
        `${glowLength} ${circumference - glowLength}`

    progressGlow.style.strokeDashoffset =
        glowPosition

    progressGlow.style.opacity =
        progress > 0 && progress < 1 ? 0.35 : 0
}

// === EVENT LISTENERS ===
if (
    resultElement &&
    hoursInput &&
    minutesInput &&
    secondsInput &&
    messageElement &&
    startButton &&
    stopButton &&
    resetButton &&
    setupElement &&
    activeElement &&
    progressCircle &&
    progressGlow
) {
    setupWholeNumberInput(hoursInput)
    setupWholeNumberInput(minutesInput)
    setupWholeNumberInput(secondsInput)

    setActionButtonsForState("setup")

    presetButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const totalSeconds = Number(button.dataset.seconds)

            setTimeInputsFromSeconds(totalSeconds)
            resultElement.textContent = formatTime(totalSeconds)

            remainingSeconds = 0
            initialSeconds = 0

            setSelectedPreset(button)

            messageElement.textContent = "Countdown time updated."
        })
    })

    quickAddButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const secondsToAdd = Number(button.dataset.addSeconds)
            const currentSeconds = getCurrentTotalSeconds()
            const updatedSeconds = currentSeconds + secondsToAdd

            remainingSeconds = updatedSeconds

            if (initialSeconds > 0) {
                initialSeconds += secondsToAdd
            }

            setTimeInputsFromSeconds(updatedSeconds)
            resultElement.textContent = formatTime(updatedSeconds)
            updateProgressRing()

            clearSelectedPreset()

            messageElement.textContent = `Added ${button.textContent.trim()}`
        })
    })

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

    stopButton.addEventListener("click", () => {
        if (alarmIsPlaying) {
            stopCompleteSound()

            setActionButtonsForState("setup")
            messageElement.textContent = "Countdown complete."

            return
        }
        
        stopAndRestoreCountdown()
    })

    resetButton.addEventListener("click", () => {
        resetCountdown()
    })
} else {
    console.warn("Countdown tool elements could not be found.")
}
