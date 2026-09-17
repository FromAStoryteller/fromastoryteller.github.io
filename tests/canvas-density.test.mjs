import assert from "node:assert/strict"
import test from "node:test"

import { CanvasManager } from "../systems/games/canvas.js"

test("expanded density sharpens an enlarged canvas", () => {
    const density = CanvasManager.getExpandedPixelDensity({
        displayWidth: 1600,
        displayHeight: 900,
        logicalWidth: 800,
        logicalHeight: 450,
        devicePixelRatio: 1,
        embeddedDensity: 1
    })

    assert.equal(density, 2)
})

test("expanded density accounts for high-DPI displays", () => {
    const density = CanvasManager.getExpandedPixelDensity({
        displayWidth: 1280,
        displayHeight: 720,
        logicalWidth: 960,
        logicalHeight: 540,
        devicePixelRatio: 1.5,
        embeddedDensity: 1.5
    })

    assert.equal(density, 2)
})

test("expanded density respects the backing-resolution cap", () => {
    const density = CanvasManager.getExpandedPixelDensity({
        displayWidth: 3840,
        displayHeight: 2160,
        logicalWidth: 800,
        logicalHeight: 450,
        devicePixelRatio: 2,
        embeddedDensity: 1
    })

    assert.equal(density, 3)
    assert.ok(800 * density <= 2560)
    assert.ok(450 * density <= 1440)
})

test("expansion never lowers an existing embedded density", () => {
    const density = CanvasManager.getExpandedPixelDensity({
        displayWidth: 1000,
        displayHeight: 563,
        logicalWidth: 1000,
        logicalHeight: 563,
        devicePixelRatio: 1,
        embeddedDensity: 2
    })

    assert.equal(density, 2)
})
