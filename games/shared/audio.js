// === REUSABLE SOUND HELPERS === //

function playSound (sound) {
    if (sound && sound.isLoaded()) {
        sound.play()
    }
}