// === UI === //

function drawMessageBox(x, y, w, h, config) {
    rectMode(CENTER)

    fill(17, 17, 17, config.fillAlpha)
    stroke(212, 175, 55, config.strokeAlpha)
    strokeWeight(2)
    rect(x, y, w, h, config.radius)

    noStroke()
    rectMode(CORNER)
}

