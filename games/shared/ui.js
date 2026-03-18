// === UI === //
function getCenteredBox(widthRatio, heightRatio) {
    const boxWidth = width * widthRatio
    const boxHeight = height * heightRatio

    return {
        x: width / 2,
        y: height / 2,
        w: boxWidth,
        h: boxHeight
    }
}

function drawMessageBox(x, y, w, h, config) {
    rectMode(CENTER)

    const fillCol = color(config.fillColor)
    fillCol.setAlpha(config.fillAlpha)
    fill(fillCol)

    const strokeCol = color(config.strokeColor)
    strokeCol.setAlpha(config.strokeAlpha)
    stroke(strokeCol)

    strokeWeight(config.strokeWeight)
    rect(x, y, w, h, config.radius)

    noStroke()
    rectMode(CORNER)
}

