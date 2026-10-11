import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'

const source = fs.readFileSync(process.env.FAS_COUNTDOWN_SOURCE || new URL('../tools/countdown/tool.js', import.meta.url), 'utf8')
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }

function setup({ audio = true, blocked = false, deferLoad = false } = {}) {
    let now = 0
    const elements = new Map()
    const events = {}
    const sources = []
    let resolveLoad
    const loaded = deferLoad ? new Promise(resolve => { resolveLoad = resolve }) : Promise.resolve(new ArrayBuffer(8))
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            value: 0, textContent: '', hidden: false, disabled: false, style: {}, attrs: {}, events: {},
            r: { baseVal: { value: 50 } }, icon: {},
            setAttribute(key, value) { this.attrs[key] = value },
            addEventListener(key, callback) { this.events[key] = callback },
            querySelector() { return this.icon }
        })
        return elements.get(id)
    }
    const add = element('add'); add.dataset = { addSeconds: '60' }; add.textContent = '+1m'
    class AudioContext {
        state = blocked ? 'suspended' : 'running'
        currentTime = 0
        destination = {}
        resume() { return blocked ? Promise.reject(new Error('blocked')) : Promise.resolve() }
        decodeAudioData() { return Promise.resolve({duration:10}) }
        createGain() { return { gain: {}, connect() {}, disconnect() {} } }
        createBufferSource() {
            const s = { stopped: false, connect() {}, disconnect() {}, start(time) { this.when = time }, stop() { this.stopped = true } }
            sources.push(s); return s
        }
    }
    const media = { plays: 0, pause() {}, addEventListener() {}, play() { this.plays++; return blocked ? Promise.reject(new Error('blocked')) : Promise.resolve() } }
    const sandbox = {
        Date: { now: () => now }, Math, Number, String, console,
        document: {
            visibilityState: 'visible', getElementById: element,
            querySelectorAll(selector) { return selector === '.countdown-add' ? [add] : [] },
            addEventListener(name, callback) { events[name] = callback }
        },
        window: { AudioContext: audio ? AudioContext : undefined, addEventListener(name, callback) { events[name] = callback } },
        Audio: function(src) { media.src = src; return media },
        fetch: () => Promise.resolve({ok:true, arrayBuffer: () => loaded}),
        setInterval: () => 1, clearInterval() {}, setTimeout, clearTimeout
    }
    vm.createContext(sandbox)
    vm.runInContext(source, sandbox)
    return { elements, sources, events, media, add, sandbox,
        run: code => vm.runInContext(code, sandbox),
        advance(ms, audioSeconds = ms / 1000) { now += ms; const ctx = vm.runInContext('audioContext',sandbox); if(ctx) ctx.currentTime += audioSeconds },
        finishLoad() { resolveLoad(new ArrayBuffer(8)) }
    }
}

test('delayed updates use elapsed time and complete once', async () => {
    const h = setup(); h.run('startCountdown(600)'); await flush()
    assert.equal(h.sources[0].when, 600)
    h.advance(60000); h.run('updateCountdown()')
    assert.equal(h.elements.get('tool-result').textContent, '00:09:00')
    h.advance(540000); h.run('updateCountdown()'); h.run('updateCountdown()'); await flush()
    assert.equal(h.run('countdownState'), 'complete')
    assert.equal(h.sources.length, 1)
    assert.equal(h.run('alarmHandled'), true)
})

test('pause preserves partial seconds; resume excludes paused time', async () => {
    const h = setup(); h.run('startCountdown(10)'); await flush()
    h.advance(1500); h.run('pauseCountdown()')
    assert.equal(h.run('pausedRemainingMs'), 8500)
    assert.equal(h.sources[0].stopped, true)
    h.advance(30000); h.run('startCountdown(remainingSeconds)'); await flush()
    h.advance(8499); h.run('updateCountdown()'); assert.equal(h.run('remainingSeconds'), 1)
    h.advance(1); h.run('updateCountdown()'); assert.equal(h.run('countdownState'), 'complete')
})

test('add time catches up after delay and reschedules the alarm', async () => {
    const h = setup(); h.run('startCountdown(600)'); await flush()
    h.advance(60000); h.add.events.click(); await flush()
    assert.equal(h.run('remainingSeconds'), 600)
    assert.equal(h.run('finishTime'), 660000)
    assert.equal(h.sources[0].stopped, true)
    assert.equal(h.sources[1].when, 660)
    h.run('pauseCountdown()'); h.add.events.click()
    assert.equal(h.run('pausedRemainingMs'), 660000)
})

test('visibility recovery corrects the display and reschedules audio', async () => {
    const h = setup(); h.run('startCountdown(600)'); await flush()
    h.sandbox.document.visibilityState = 'hidden'; h.advance(60000)
    h.events.visibilitychange(); assert.equal(h.run('remainingSeconds'), 600)
    h.sandbox.document.visibilityState = 'visible'; h.events.visibilitychange(); await flush()
    assert.equal(h.run('remainingSeconds'), 540)
    assert.equal(h.sources[0].stopped, true)
    assert.equal(h.sources[1].when, 600)
})

test('a paused audio clock recovers with an immediate alarm, once', async () => {
    const h = setup(); h.run('startCountdown(10)'); await flush()
    h.advance(20000, 0); h.events.pageshow(); await flush()
    assert.equal(h.run('countdownState'), 'complete')
    assert.equal(h.sources[0].stopped, true)
    assert.equal(h.sources[1].when, 0)
    h.events.pageshow(); h.events.focus(); await flush()
    assert.equal(h.sources.length, 2)
})

test('scheduled sound can end before a delayed display update without replay', async () => {
    const h = setup(); h.run('startCountdown(10)'); await flush()
    h.advance(30000); h.sources[0].onended(); await flush()
    assert.equal(h.run('countdownState'), 'complete')
    assert.equal(h.sources.length, 1)
    assert.equal(h.media.plays, 0)
    h.elements.get('tool-stop-button').events.click()
    assert.equal(h.run('countdownState'), 'setup')
    assert.equal(h.run('initialSeconds'), 0)
})

test('reset/stop invalidate pending sound loading', async () => {
    for (const action of ['resetCountdown()', 'stopAndRestoreCountdown()', 'pauseCountdown()']) {
        const h = setup({deferLoad:true}); h.run('startCountdown(10)'); h.run(action)
        h.finishLoad(); await flush()
        assert.equal(h.sources.length, 0, action)
    }
})

test('unavailable Web Audio falls back to the media alarm', async () => {
    const h = setup({audio:false}); h.run('startCountdown(10)'); await flush()
    h.advance(10000); h.run('updateCountdown()'); await flush()
    assert.equal(h.media.plays, 1)
    assert.equal(h.run('alarmHandled'), true)
})

test('blocked sound shows accessible retry controls and can be dismissed', async () => {
    const h = setup({blocked:true}); h.run('startCountdown(10)'); await flush()
    h.advance(10000); h.run('updateCountdown()'); await flush()
    assert.match(h.elements.get('tool-message').textContent, /Sound could not play/)
    assert.equal(h.elements.get('tool-action-button').attrs['aria-label'], 'Play alarm')
    assert.equal(h.elements.get('tool-action-button').hidden, false)
    h.elements.get('tool-stop-button').events.click()
    assert.equal(h.run('countdownState'), 'setup')
    assert.equal(h.elements.get('tool-action-button').attrs['aria-label'], 'Start countdown')
})
