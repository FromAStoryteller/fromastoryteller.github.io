const canvas = document.getElementById('fireflies');
const ctx = canvas.getContext('2d', { alpha: true });

function resive() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resize();
addEventListener('resize', resize);

function drawDot(x, y, r) {
  ctx.fillStyle = '#b8922c';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function renderOnce() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  drawDot(innerWidth / 2, innerHeight / 2, 3);
}

renderOnce();
