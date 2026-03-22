// === REUSABLE SOUND HELPERS === //
export const AudioManager = {
    sounds: {},
    soundEnabled: true,
    masterVolume: 1,

    loadSounds(soundMap) {
        this.sounds ={}

        for (const key in soundMap) {
            this.sounds[key] = loadSound(soundMap[key])
        }

        return this.sounds
    },

    setSoundEnabled(enabled) {
        this.soundEnabled = enabled
    },

    setMasterVolume(volumePercent) {
        const clamped = Math.max(0, Math.min(100, volumePercent))
        this.masterVolume = clamped / 100
    },

    play(sound, baseVolume = 1) {
        if (!this.soundEnabled) return
        if (!sound || !sound.isLoaded()) return
        
        const finalVolume = Math.max(0, Math.min(1, baseVolume * this.masterVolume))
        sound.setVolume(finalVolume)
        sound.play()
    },

    stopAll() {
        for (const key in this.sounds) {
            const sound = this.sounds[key]
            if (sound && sound.isLoaded()) {
                sound.stop()
            }
        }
    }
}