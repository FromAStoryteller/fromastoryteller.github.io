// === CANVAS HELPERS === //
export const CanvasManager = {
    getContainer(containerId) {
        return document.getElementById(containerId)
    },

    createResponsive(containerId) {
        const container = this.getContainer(containerId)

        const width = container.offsetWidth
        const height = width * (10 / 16)

        const canvas = createCanvas(width, height)
        canvas.parent(containerId)

        return canvas
    },

    resizeResponsive(containerId) {
        const container = this.getContainer(containerId)

        const width = container.offsetWidth
        const height = width * (10 / 16)

        resizeCanvas(width, height)
    }
}
