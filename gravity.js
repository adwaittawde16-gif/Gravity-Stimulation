const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');

let W, H;

function resize() {
  W = canvas.offsetWidth;
  H = canvas.offsetHeight || 500;
  canvas.width = W;
  canvas.height = H;
}
resize();
window.addEventListener('resize', resize);

const COLORS = [
  '#7fc8f8', '#f7b267', '#f25c54', '#a5ffd6',
  '#c9b8ff', '#ffdd94', '#ff9de2', '#88d8b0',
  '#ffb347', '#b5ead7'
];

let bodies = [];
let paused = false;
let merged = 0;
let G = 800;
let TRAIL = 50;

const dtFixed = 1 / 120;

function rnd(a, b) {
  return a + Math.random() * (b - a);
}

function spawnBodies(n) {
  bodies = [];
  merged = 0;
  for (let i = 0; i < n; i++) {
    const m = rnd(3, 18);
    bodies.push({
      x: rnd(W * 0.1, W * 0.9),
      y: rnd(H * 0.1, H * 0.9),
      vx: rnd(-60, 60),
      vy: rnd(-60, 60),
      m,
      r: Math.max(3, m * 1.1),
      col: COLORS[i % COLORS.length],
      trail: []
    });
  }
  updateStats();
}

function addSun() {
  const m = 200;
  bodies.push({
    x: W / 2 + rnd(-30, 30),
    y: H / 2 + rnd(-30, 30),
    vx: 0,
    vy: 0,
    m,
    r: Math.max(14, m * 0.18),
    col: '#ffe07a',
    trail: []
  });
}

// --- Drag to throw ---
let dragStart = null;

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  dragStart = {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
    t: Date.now()
  };
});

canvas.addEventListener('mouseup', e => {
  if (!dragStart) return;
  const rect = canvas.getBoundingClientRect();
  const ex = (e.clientX - rect.left) * (W / rect.width);
  const ey = (e.clientY - rect.top) * (H / rect.height);
  const dt = (Date.now() - dragStart.t) / 1000 + 0.001;
  const m = rnd(5, 15);
  bodies.push({
    x: dragStart.x,
    y: dragStart.y,
    vx: (ex - dragStart.x) / dt * 0.3,
    vy: (ey - dragStart.y) / dt * 0.3,
    m,
    r: Math.max(4, m * 1.1),
    col: COLORS[Math.floor(Math.random() * COLORS.length)],
    trail: []
  });
  dragStart = null;
});

// --- Physics step ---
function step() {
  // Gravity forces
  for (let i = 0; i < bodies.length; i++) {
    let ax = 0, ay = 0;
    for (let j = 0; j < bodies.length; j++) {
      if (i === j) continue;
      const dx = bodies[j].x - bodies[i].x;
      const dy = bodies[j].y - bodies[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.5;
      const soften = Math.max(dist, (bodies[i].r + bodies[j].r) * 0.6);
      const f = G * bodies[j].m / (soften * soften);
      ax += f * dx / dist;
      ay += f * dy / dist;
    }
    bodies[i].vx += ax * dtFixed;
    bodies[i].vy += ay * dtFixed;
  }

  // Move & trail
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].x += bodies[i].vx * dtFixed;
    bodies[i].y += bodies[i].vy * dtFixed;
    bodies[i].trail.push([bodies[i].x, bodies[i].y]);
    if (bodies[i].trail.length > TRAIL) bodies[i].trail.shift();

    // Wrap escaped bodies back to center
    if (
      bodies[i].x < -300 || bodies[i].x > W + 300 ||
      bodies[i].y < -300 || bodies[i].y > H + 300
    ) {
      bodies[i].x = W / 2 + rnd(-50, 50);
      bodies[i].y = H / 2 + rnd(-50, 50);
      bodies[i].vx = rnd(-60, 60);
      bodies[i].vy = rnd(-60, 60);
      bodies[i].trail = [];
    }
  }

  // Collision merging (inelastic, conserve momentum)
  const used = new Set();
  for (let i = 0; i < bodies.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      if (used.has(j)) continue;
      const dx = bodies[j].x - bodies[i].x;
      const dy = bodies[j].y - bodies[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < bodies[i].r + bodies[j].r - 2) {
        const a = bodies[i], b = bodies[j];
        const nm = a.m + b.m;
        a.x = (a.x * a.m + b.x * b.m) / nm;
        a.y = (a.y * a.m + b.y * b.m) / nm;
        a.vx = (a.vx * a.m + b.vx * b.m) / nm;
        a.vy = (a.vy * a.m + b.vy * b.m) / nm;
        a.m = nm;
        a.r = Math.max(a.r, Math.cbrt(nm) * 2.2);
        a.trail = [];
        used.add(j);
        merged++;
      }
    }
  }
  if (used.size > 0) bodies = bodies.filter((_, i) => !used.has(i));
}

// --- Draw ---
function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.22)';
  ctx.fillRect(0, 0, W, H);

  // Trails
  for (const b of bodies) {
    if (b.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(b.trail[0][0], b.trail[0][1]);
      for (let k = 1; k < b.trail.length; k++) ctx.lineTo(b.trail[k][0], b.trail[k][1]);
      ctx.strokeStyle = b.col + '55';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Drag indicator
  if (dragStart) {
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  }

  // Bodies
  for (const b of bodies) {
    const grd = ctx.createRadialGradient(
      b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1,
      b.x, b.y, b.r
    );
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.25, b.col);
    grd.addColorStop(1, b.col + '44');

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Glow ring for massive bodies (suns)
    if (b.m > 80) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = b.col + '55';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  updateStats();
}

function updateStats() {
  document.getElementById('bodyCount').textContent = bodies.length;
  document.getElementById('mergedCount').textContent = merged;
}

// --- Animation loop ---
function loop() {
  if (!paused) {
    step();
    step(); // 2 ticks per frame for stability
  }
  draw();
  requestAnimationFrame(loop);
}

// --- Controls ---
document.getElementById('G').oninput = function () {
  G = +this.value;
  document.getElementById('Gval').textContent = this.value;
};
document.getElementById('numB').oninput = function () {
  document.getElementById('numBval').textContent = this.value;
};
document.getElementById('trail').oninput = function () {
  TRAIL = +this.value;
  document.getElementById('trailval').textContent = this.value;
};
document.getElementById('resetBtn').onclick = function () {
  spawnBodies(+document.getElementById('numB').value);
};
document.getElementById('pauseBtn').onclick = function () {
  paused = !paused;
  this.textContent = paused ? 'Resume' : 'Pause';
};
document.getElementById('addSunBtn').onclick = addSun;

// --- Start ---
spawnBodies(8);
loop();
