

function getCenteredBox(widthRatio, heightRatio, offsetYRatio = 0) {
    return {
        x: width / 2,
        y: height / 2 + height * offsetYRatio,
        w: width * widthRatio,
        h: height * heightRatio
    }
}