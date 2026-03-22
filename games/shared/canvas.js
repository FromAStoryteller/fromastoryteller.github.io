// === CANVAS HELPERS === //
export const CanvasManager = {
    getContainer(containerId) {
        return document.getElementById(containerId)
    },

    createResponsive(containerId) {
        const container = this.getContainer(containerId)
        const canvas = createCanvas(container.offsetWidth, container.offsetHeight)
        canvas.parent(containerId)
        return canvas
    },

    resizeResponsive(containerId) {
        const container = this.getContainer(containerId)
        resizeCanvas(container.offsetWidth, container.offsetHeight)
    }
}
