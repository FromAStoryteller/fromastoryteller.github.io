// === REUSABLE SOUND HELPERS === //
function loadSounds(soundMap) {
    const sounds ={}

    for (const key in soundMap) {
        sounds[key] = loadSound(soundMap[key])
    }

    return sounds
}

function playSound (sound) {
    if (sound && sound.isLoaded()) {
        sound.play()
    }
}