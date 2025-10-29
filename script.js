const canvas = document.getElementById('fireflies');
const ctx = canvas.getContext('2d', { alpha: true });

function resize() {
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

let x = innerWidth / 2;
let y = innerHeight / 2;
let angle = 0;
const speed = 0.7;

function loop () {
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  angle += (Math.random() - 0.5) * 0.06;

  x += Math.cos(angle) * speed;
  y += Math.sin(angle) * speed;

  const pad = 40;
  if (x < -pad) x = innerWidth + pad;
  if (x > innerWidth + pad) x = -pad;
  if (y < -pad) y = innerHeight + pad;
  if (y > innerHeight + pad) y = -pad;

  drawDot(x, y, 3);

  requestAnimationFrame(loop);
}

loop();

