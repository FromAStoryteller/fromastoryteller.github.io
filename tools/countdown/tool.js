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
const completeSound = new Audio("/assets/sounds/tools/countdown/countdown-complete.mp3")
completeSound.volume = 0.6
completeSound.loop = false
completeSound.preload = "none"

// === STATE ===
let remainingSeconds = 0
let initialSeconds = 0
let countdownInterval = null
let alarmIsPlaying = false
let countdownState = "setup"
let finishTime = null
let pausedRemainingMs = 0
let alarmHandled = false
let audioContext = null
let alarmBuffer = null
let alarmBufferPromise = null
let scheduledAlarm = null
let alarmVersion = 0

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
    if (countdownInterval !== null) {
        clearInterval(countdownInterval)
        countdownInterval = null
    }
    finishTime = null
}

function renderCountdown() {
    resultElement.textContent = formatTime(remainingSeconds)
    updateProgressRing(remainingSeconds)
}

function updateCountdown() {
    if (countdownState !== "playing") return
    const remainingMs = Math.max(0, finishTime - Date.now())
    remainingSeconds = Math.ceil(remainingMs / 1000)
    renderCountdown()
    if (remainingMs === 0) completeCountdown()
}

function completeCountdown() {
    if (countdownState !== "playing") return
    stopCountdown()
    countdownState = "complete"
    pausedRemainingMs = 0
    remainingSeconds = 0
    renderCountdown()
    setCountdownView("setup")
    setInputsDisabled(false)
    messageElement.textContent = "Countdown complete."
    setAlarmCompleteState()
    playCompleteSound()
}

function startCountdown(totalSeconds) {
    const durationMs = countdownState === "paused"
        ? pausedRemainingMs : totalSeconds * 1000
    stopCountdown()
    stopCompleteSound()
    alarmHandled = false
    countdownState = "playing"
    finishTime = Date.now() + durationMs
    pausedRemainingMs = 0
    remainingSeconds = Math.ceil(durationMs / 1000)
    if (initialSeconds === 0) initialSeconds = totalSeconds
    renderCountdown()
    setCountdownView("active")
    setActionButtonsForState("playing")
    messageElement.textContent = "Countdown running."
    setInputsDisabled(true)
    stopButton.disabled = false
    // Call from the Start/Resume click, before awaiting anything, to enable audio.
    armAlarm()
    countdownInterval = setInterval(updateCountdown, 250)
}

function pauseCountdown() {
    updateCountdown()
    if (countdownState !== "playing") return
    pausedRemainingMs = Math.max(0, finishTime - Date.now())
    remainingSeconds = Math.ceil(pausedRemainingMs / 1000)
    stopCountdown()
    stopCompleteSound()
    countdownState = "paused"
    renderCountdown()
    setActionButtonsForState("paused")
    messageElement.textContent = "Countdown paused."
}

function stopAndRestoreCountdown() {
    stopCountdown()
    stopCompleteSound()

    remainingSeconds = 0
    pausedRemainingMs = 0
    countdownState = "setup"
    alarmHandled = false

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
    pausedRemainingMs = 0
    countdownState = "setup"
    alarmHandled = false

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

function cancelScheduledAlarm() {
    alarmVersion++
    if (!scheduledAlarm) return
    const { source, gain } = scheduledAlarm
    scheduledAlarm = null
    source.onended = null
    try { source.stop() } catch { /* Already stopped. */ }
    source.disconnect()
    gain.disconnect()
}

async function prepareAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) throw new Error("Web Audio is unavailable")
    if (!audioContext || audioContext.state === "closed") {
        audioContext = new AudioContextClass()
        alarmBuffer = null
        alarmBufferPromise = null
    }
    // resume() is invoked synchronously during the user's click.
    const resumePromise = audioContext.resume()
    if (!alarmBufferPromise) {
        alarmBufferPromise = fetch(completeSound.src)
            .then(response => {
                if (!response.ok) throw new Error("Alarm sound could not load")
                return response.arrayBuffer()
            })
            .then(bytes => audioContext.decodeAudioData(bytes))
            .then(buffer => { alarmBuffer = buffer; return buffer })
            .catch(error => { alarmBufferPromise = null; throw error })
    }
    let resumeTimeout
    const resumed = Promise.race([
        resumePromise,
        new Promise((_, reject) => {
            resumeTimeout = setTimeout(() => reject(new Error("Audio permission is needed")), 2000)
        })
    ]).finally(() => clearTimeout(resumeTimeout))
    await Promise.all([resumed, alarmBufferPromise])
    if (audioContext.state !== "running") throw new Error("Audio is blocked")
}

function scheduleAlarm(delaySeconds) {
    const source = audioContext.createBufferSource()
    const gain = audioContext.createGain()
    source.buffer = alarmBuffer
    gain.gain.value = 0.6
    source.connect(gain)
    gain.connect(audioContext.destination)
    const record = { source, gain, startsAt: audioContext.currentTime + delaySeconds }
    scheduledAlarm = record
    source.onended = () => {
        if (scheduledAlarm !== record) return
        scheduledAlarm = null
        source.disconnect()
        gain.disconnect()
        alarmHandled = true
        alarmIsPlaying = false
        updateCountdown()
    }
    source.start(record.startsAt)
}

function showAudioFailure() {
    if (countdownState === "playing") {
        messageElement.textContent = "Countdown running. Sound is not ready; check your browser's sound permissions."
        return
    }
    if (countdownState !== "complete") return
    messageElement.textContent = "Countdown complete. Sound could not play. Select Play alarm to try again."
    startButton.hidden = false
    startButton.querySelector("i").className = "fa-solid fa-volume-high"
    startButton.setAttribute("aria-label", "Play alarm")
    startButton.setAttribute("title", "Play alarm")
}

function playFallbackAlarm(version) {
    if (alarmHandled || countdownState !== "complete") return
    completeSound.currentTime = 0
    alarmIsPlaying = true
    completeSound.play().then(() => {
        if (version !== alarmVersion || countdownState !== "complete") return
        alarmHandled = true
        setAlarmCompleteState()
        messageElement.textContent = "Countdown complete."
    }).catch(() => {
        if (version !== alarmVersion) return
        alarmIsPlaying = false
        showAudioFailure()
    })
}

function armAlarm() {
    cancelScheduledAlarm()
    const version = alarmVersion
    prepareAudio().then(() => {
        // A pause, reset, add-time action, or newer alarm invalidates this request.
        if (version !== alarmVersion || alarmHandled) return
        if (countdownState !== "playing" && countdownState !== "complete") return
        const delay = countdownState === "playing"
            ? Math.max(0, (finishTime - Date.now()) / 1000) : 0
        scheduleAlarm(delay)
        if (countdownState === "complete") {
            alarmHandled = true
            alarmIsPlaying = true
            setAlarmCompleteState()
            messageElement.textContent = "Countdown complete."
        }
    }).catch(() => {
        if (version !== alarmVersion) return
        if (countdownState === "complete") playFallbackAlarm(version)
        else showAudioFailure()
    })
}

function playCompleteSound() {
    if (alarmHandled) return
    if (scheduledAlarm && audioContext.state === "running" &&
        audioContext.currentTime >= scheduledAlarm.startsAt) {
        alarmHandled = true
        alarmIsPlaying = true
        return
    }
    // The audio clock may have paused during device sleep. Schedule immediately.
    armAlarm()
}

function stopCompleteSound() {
    cancelScheduledAlarm()
    completeSound.pause()
    completeSound.currentTime = 0
    alarmIsPlaying = false
}

function recoverCountdown() {
    if (document.visibilityState === "hidden") return
    updateCountdown()
    if (countdownState === "playing") armAlarm()
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
    messageElement.setAttribute("role", "status")
    completeSound.addEventListener("ended", () => { alarmIsPlaying = false })
    document.addEventListener("visibilitychange", recoverCountdown)
    window.addEventListener("pageshow", recoverCountdown)
    window.addEventListener("focus", recoverCountdown)
    document.addEventListener("resume", recoverCountdown)

    setupWholeNumberInput(hoursInput)
    setupWholeNumberInput(minutesInput)
    setupWholeNumberInput(secondsInput)

    setActionButtonsForState("setup")

    presetButtons.forEach((button) => {
        button.addEventListener("click", () => {
            stopCompleteSound()
            countdownState = "setup"
            alarmHandled = false
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
            updateCountdown()
            if (countdownState === "complete") return
            const secondsToAdd = Number(button.dataset.addSeconds)
            if (!Number.isFinite(secondsToAdd) || secondsToAdd <= 0) return
            if (countdownState === "playing") {
                finishTime += secondsToAdd * 1000
                remainingSeconds = Math.ceil(Math.max(0, finishTime - Date.now()) / 1000)
                armAlarm()
            } else if (countdownState === "paused") {
                pausedRemainingMs += secondsToAdd * 1000
                remainingSeconds = Math.ceil(pausedRemainingMs / 1000)
            } else {
                remainingSeconds = getCurrentTotalSeconds() + secondsToAdd
            }
            if (initialSeconds > 0) initialSeconds += secondsToAdd
            setTimeInputsFromSeconds(remainingSeconds)
            renderCountdown()
            clearSelectedPreset()
            messageElement.textContent = `Added ${button.textContent.trim()}`
        })
    })

    startButton.addEventListener("click", () => {
        if (countdownState === "complete") {
            armAlarm()
            return
        }
        if (countdownState === "playing") {
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
        if (countdownState === "complete") {
            stopCompleteSound()
            countdownState = "setup"
            alarmHandled = true
            initialSeconds = 0

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
