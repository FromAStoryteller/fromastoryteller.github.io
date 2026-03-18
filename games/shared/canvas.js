// === CANVAS HELPERS === //
function getGameContainer(containerId) {
    return document.getElementById(containerId)
}

function createResponsiveCanvas(containerId) {
    const container = getGameContainer(containerId)
    const canvas = createCanvas(container.offsetWidth, container.offsetHeight)
    canvas.parent(containerId)
    return canvas
}

function resizeResponsiveCanvas(containerId) {
    const container = getGameContainer(containerId)
    resizeCanvas(container.offsetWidth, container.offsetHeight)
}

