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
  ctx.shadowColour = '#b8922c';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const fireflies = [];
const fireflyCount = 20;

for (let i = 0; i < fireflyCount; i++) {
  fireflies.push({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    angle: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.6,
    radius: 2 + Math.random() * 2
  });
}

function loop () {
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  fireflies.forEach(f => {
    f.angle += (Math.random() - 0.5) * 0.1;
    f.x += Math.cos(f.angle) * f.speed;
    f.y += Math.sin(f.angle) * f.speed;

  const pad = 40;
  if (f.x < -pad) f.x = innerWidth + pad;
  if (f.x > innerWidth + pad) f.x = -pad;
  if (f.y < -pad) f.y = innerHeight + pad;
  if (f.y > innerHeight + pad) f.y = -pad;

  drawDot(f.x, f.y, f.radius);
  });
  
  requestAnimationFrame(loop);
}

loop();

