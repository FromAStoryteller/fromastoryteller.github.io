// === REUSABLE SOUND HELPERS === //
export const AudioManager = {
    sounds: {},
    generation: 0,
    pendingPlays: new WeakSet(),
    soundEnabled: true,
    masterVolume: 1,

    loadSounds(soundMap) {
        this.sounds ={}

        for (const key in soundMap) {
            let audio, pending;
            this.sounds[key] = {
                load() { return pending ??= new Promise((resolve,reject) => { audio=loadSound(soundMap[key],()=>resolve(audio),error=>{pending=null;reject(error)}); }); },
                isLoaded:()=>!!audio?.isLoaded(),
                setVolume:value=>audio?.setVolume(value),
                play:()=>audio?.play(),
                stop:()=>audio?.stop()
            }
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
        if (!sound) return
        if (!sound.isLoaded()) {
            if (sound.load && !this.pendingPlays.has(sound)) {
                this.pendingPlays.add(sound)
                const generation=this.generation
                void sound.load().then(()=>{this.pendingPlays.delete(sound);if(generation===this.generation)this.play(sound,baseVolume)}).catch(()=>this.pendingPlays.delete(sound));
            }
            return
        }
        
        const finalVolume = Math.max(0, Math.min(1, baseVolume * this.masterVolume))
        sound.setVolume(finalVolume)
        sound.play()
    },

    stopAll() {
        this.generation++
        for (const key in this.sounds) {
            const sound = this.sounds[key]
            if (sound && sound.isLoaded()) {
                sound.stop()
            }
        }
    }
}