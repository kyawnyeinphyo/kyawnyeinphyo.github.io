(() => {
'use strict';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const moneyEl = $('money');
const hintEl = $('hint'), muteBtn = $('mute');

const JIT_N = 64;        // stable per-bill stack jitter slots
const M = 61;            // sample points along the bill when drawing
const DT = 1 / 120;      // physics step
const FLY_A = 1700;      // upward acceleration of a released bill (px/s^2)
const K = 900, CV = 50, CW = 45;   // pointer spring, linear + angular damping

const VALUE = 1;         // each bill is worth $1
const CROP = 14;         // trim scan border from sample.jpg (px)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n).toLocaleString('en-US');
let img = null, asp = 0.42;

// ---------- layout ----------
let W = 0, H = 0, dpr = 1, bw = 0, bh = 0, cx = 0, cy = 0;
let sprite = null, shadowSprite = null, INERTIA = 1;

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function layout() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  bh = Math.min(H * 0.82, (W * 0.94) / asp, 860);
  bw = bh * asp;
  cx = W / 2; cy = H - bh / 2 - Math.max(28, H * 0.05);
  sprite = makeSprite();
  shadowSprite = makeShadow(sprite);
  INERTIA = (bw * bw + bh * bh) / 12 * 1.5;
}

function makeSprite() {
  const c = document.createElement('canvas');
  c.width = Math.round(bw * dpr);
  c.height = Math.round(bh * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  rr(g, 0, 0, bw, bh, Math.min(5, bw * 0.03));
  g.clip();
  g.fillStyle = '#eef0cf'; g.fillRect(0, 0, bw, bh);
  g.save();
  g.translate(bw / 2, bh / 2);
  g.rotate(-Math.PI / 2);           // landscape photo -> portrait
  g.drawImage(img, CROP, CROP, img.naturalWidth - 2 * CROP, img.naturalHeight - 2 * CROP,
              -bh / 2, -bw / 2, bh, bw);
  g.restore();
  const sh = g.createLinearGradient(0, 0, 0, bh);
  sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.fillRect(0, 0, bw, bh);
  return c;
}

function makeShadow(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---------- game state ----------
let idx = 0, money = 0, dispMoney = 0;
let active = null, flyers = [], floats = [], jit = [];
let pid = null, samples = [];

function makeBill(settle) {
  const j = jit[idx % JIT_N];
  return {
    x: settle ? cx + j.dx : cx, y: settle ? cy + 1.7 + j.dy : cy,
    vx: 0, vy: 0, th: settle ? j.r : 0, w: 0,   // rigid pose + velocities
    bs: 0, bv: 0,                                // bend (curvature) + its velocity
    state: settle ? 'returning' : 'idle',
    gx: 0, sg: 0.5, tx: 0, ty: 0, limY: 0        // grab point (local x, position along length), pointer target
  };
}

function reset() {
  jit = Array.from({ length: JIT_N }, () => ({ dx: (Math.random() - 0.5) * 6, dy: (Math.random() - 0.5) * 1.6, r: (Math.random() - 0.5) * 0.024 }));
  idx = 0; money = 0; dispMoney = 0;
  flyers = []; floats = []; pid = null; samples = [];
  active = makeBill(false);
  hintEl.classList.remove('gone');
}

// ---------- physics ----------
// The bill is a rigid body pulled by a spring at the grab point (so it swings and
// rotates naturally) plus one smooth bend parameter driven by sideways pull.
function stepBill(b) {
  const st = b.state;
  const c = Math.cos(b.th), s = Math.sin(b.th);
  let ax = 0, ay = 0, al = 0, target = 0;
  if (st === 'dragging') {
    const gy = -bh / 2 + b.sg * bh;
    const Px = b.x + c * b.gx - s * gy, Py = b.y + s * b.gx + c * gy;
    const dx = b.tx - Px, dy = b.ty - Py;
    const fx = K * dx, fy = K * dy;
    ax = fx - CV * b.vx; ay = fy - CV * b.vy;
    al = ((Px - b.x) * fy - (Py - b.y) * fx) / INERTIA - CW * b.w;
    const stuck = 1 - clamp((cy - b.y) / (bh * 0.5), 0, 1);   // stack friction fades as it lifts
    ax += 40 * stuck * (cx - b.x); ay += 40 * stuck * (cy - b.y); al -= 25 * stuck * b.th;
    target = clamp((dx * c + dy * s) * 0.02, -0.7, 0.7);
  } else if (st === 'returning') {
    ax = 250 * (cx - b.x) - 14 * b.vx; ay = 250 * (cy - b.y) - 14 * b.vy;
    al = -250 * b.th - 14 * b.w;
  } else if (st === 'flying') {
    ax = -0.3 * b.vx; ay = -FLY_A; al = -1.5 * b.w;
  }
  b.vx += ax * DT; b.vy += ay * DT; b.w += al * DT;
  b.x += b.vx * DT; b.y += b.vy * DT;
  b.th = clamp(b.th + b.w * DT, -1.2, 1.2);
  b.bv += (-400 * (b.bs - target) - 14 * b.bv) * DT;
  b.bs += b.bv * DT;

  if (st === 'returning' &&
      Math.abs(cx - b.x) < 0.1 && Math.abs(cy - b.y) < 0.1 && Math.abs(b.th) < 0.002 &&
      Math.abs(b.vx) + Math.abs(b.vy) < 2 && Math.abs(b.w) < 0.05 && Math.abs(b.bs) < 0.01) {
    b.x = cx; b.y = cy; b.th = 0; b.vx = b.vy = b.w = b.bs = b.bv = 0;
    b.state = 'idle';
  }
}

function simulate() {
  const b = active;
  if (b && b.state !== 'idle') {
    stepBill(b);
    if (b.state === 'dragging' && cy - b.y > bh * 0.9) {
      launch(pointerVel());
      pid = null;
    }
  }
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    stepBill(f);
    const ext = Math.abs(Math.cos(f.th)) * bh / 2 + Math.abs(Math.sin(f.th)) * bw / 2 + 60;
    if (f.y + ext < 0) flyers.splice(i, 1);
  }
}

// ---------- input ----------
function pushSample(x, y) {
  const t = performance.now();
  samples.push({ t, x, y });
  while (samples.length > 2 && t - samples[0].t > 120) samples.shift();
}
function pointerVel() {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const a = samples[0], z = samples[samples.length - 1];
  const dt = (z.t - a.t) / 1000;
  if (dt < 0.005) return { vx: 0, vy: 0 };
  return { vx: (z.x - a.x) / dt, vy: (z.y - a.y) / dt };
}

canvas.addEventListener('pointerdown', e => {
  initAudio();
  const b = active;
  if (pid !== null || !b || b.state === 'dragging') return;
  const x = e.clientX, y = e.clientY;
  const c = Math.cos(b.th), s = Math.sin(b.th);
  const dx = x - b.x, dy = y - b.y;
  let lx = dx * c + dy * s, ly = -dx * s + dy * c;
  if (Math.abs(lx) > bw / 2 + 24 || Math.abs(ly) > bh / 2 + 24) return;
  lx = clamp(lx, -bw / 2, bw / 2); ly = clamp(ly, -bh / 2, bh / 2);
  pid = e.pointerId;
  try { canvas.setPointerCapture(pid); } catch (_) {}
  b.state = 'dragging';
  b.gx = lx;
  b.sg = Math.round((ly + bh / 2) / bh * (M - 1)) / (M - 1);
  b.tx = x; b.ty = y; b.limY = y + 15;
  samples = []; pushSample(x, y);
  hintEl.classList.add('gone');
  e.preventDefault();
});

canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== pid || !active || active.state !== 'dragging') return;
  const b = active;
  b.tx = e.clientX;
  b.ty = Math.min(e.clientY, b.limY);
  pushSample(e.clientX, e.clientY);
  e.preventDefault();
});

function release(e) {
  if (e.pointerId !== pid) return;
  pid = null;
  const b = active;
  if (!b || b.state !== 'dragging') return;
  pushSample(e.clientX, e.clientY);
  const v = pointerVel();
  const lifted = cy - b.y;
  if (e.type !== 'pointercancel' && (lifted > bh * 0.35 || (v.vy < -650 && lifted > bh * 0.08))) {
    launch(v);
  } else {
    b.state = 'returning';
    if (lifted > 6) thud();
  }
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

function launch(v) {
  const b = active;
  b.vx = clamp(v.vx, -900, 900);
  b.vy = clamp(Math.min(v.vy, -900), -3000, -900);
  b.state = 'flying';
  flyers.push(b);

  money += VALUE;
  floats.push({ t0: performance.now(), text: '+$' + VALUE, x: b.x, y: Math.max(b.y - bh / 2, H * 0.3) });
  swoosh(clamp(0.5 + -b.vy / 4000, 0.5, 1));
  if (navigator.vibrate) navigator.vibrate(10);

  idx++;
  active = makeBill(true);
}

// block browser gestures / rubber-band scrolling
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (pid !== null) return;
    layout();
    flyers = [];
    active = makeBill(false);
  }, 150);
});

// ---------- audio ----------
let ac = null, master = null, noiseBuf = null, muted = false;
const rub = {};
let rubSpeed = 0, lastMid = null;

function initAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const len = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.6 + last * 1.4;
    }
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ac.destination);

    rub.src = ac.createBufferSource(); rub.src.buffer = noiseBuf; rub.src.loop = true;
    rub.hp = ac.createBiquadFilter(); rub.hp.type = 'highpass'; rub.hp.frequency.value = 900;
    rub.bp = ac.createBiquadFilter(); rub.bp.type = 'bandpass'; rub.bp.frequency.value = 3000; rub.bp.Q.value = 0.6;
    rub.gain = ac.createGain(); rub.gain.gain.value = 0;
    rub.src.connect(rub.hp); rub.hp.connect(rub.bp); rub.bp.connect(rub.gain); rub.gain.connect(master);
    rub.src.start();
  }
  if (ac.state === 'suspended') ac.resume();
}

function updateAudio(dt) {
  if (!ac || !rub.gain) return;
  const b = active;
  let sp = 0;
  if (b && (b.state === 'dragging' || b.state === 'returning')) {
    if (lastMid) sp = Math.hypot(b.x - lastMid[0], b.y - lastMid[1]) / Math.max(dt, 0.001);
    lastMid = [b.x, b.y];
    if (b.state === 'returning') sp *= 0.5;
  } else lastMid = null;
  rubSpeed += (sp - rubSpeed) * 0.35;
  const lvl = Math.min(1, rubSpeed / 1600);
  const gain = Math.pow(lvl, 0.7) * 0.9 * (0.6 + 0.4 * Math.random());
  const t = ac.currentTime;
  rub.gain.gain.setTargetAtTime(gain, t, 0.025);
  rub.bp.frequency.setTargetAtTime(2000 + Math.min(rubSpeed, 2500) * 1.1, t, 0.05);
}

function swoosh(power) {
  if (!ac) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
  f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(5200, t + 0.32);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * power, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random()); s.stop(t + 0.45);
}

function thud() {
  if (!ac) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random()); s.stop(t + 0.12);
}

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  if (master) master.gain.value = muted ? 0 : 0.8;
  initAudio();
});

// ---------- rendering ----------
function wrap(a) { return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }

function drawStack() {
  const m = 8;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 22 * dpr; ctx.shadowOffsetY = 8 * dpr;
  ctx.fillStyle = '#000';
  rr(ctx, (cx - bw / 2) * dpr, (cy - bh / 2 + m * 1.7) * dpr, bw * dpr, bh * dpr, 8 * dpr);
  ctx.fill();
  ctx.restore();
  for (let j = m; j >= 1; j--) {
    const jt = jit[(idx + j) % JIT_N];
    const c = Math.cos(jt.r) * dpr, s = Math.sin(jt.r) * dpr;
    ctx.setTransform(c, s, -s, c, (cx + jt.dx) * dpr, (cy + j * 1.7 + jt.dy) * dpr);
    ctx.drawImage(sprite, -bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = `rgba(0,0,0,${0.04 + 0.04 * j})`;
    rr(ctx, -bw / 2, -bh / 2, bw, bh, Math.min(5, bw * 0.03));
    ctx.fill();
  }
}

const WX = new Array(M), WY = new Array(M), LX = new Array(M), LY = new Array(M);
function bendCurve(b) {
  const ds = bh / (M - 1), gi = Math.round(b.sg * (M - 1));
  LX[gi] = 0; LY[gi] = -bh / 2 + gi * ds;
  for (let k = gi + 1; k < M; k++) {
    const a = Math.PI / 2 + b.bs * ((k - 0.5) / (M - 1) - b.sg);
    LX[k] = LX[k - 1] + Math.cos(a) * ds; LY[k] = LY[k - 1] + Math.sin(a) * ds;
  }
  for (let k = gi - 1; k >= 0; k--) {
    const a = Math.PI / 2 + b.bs * ((k + 0.5) / (M - 1) - b.sg);
    LX[k] = LX[k + 1] - Math.cos(a) * ds; LY[k] = LY[k + 1] - Math.sin(a) * ds;
  }
  const c = Math.cos(b.th), s = Math.sin(b.th);
  for (let k = 0; k < M; k++) {
    WX[k] = b.x + c * LX[k] - s * LY[k];
    WY[k] = b.y + s * LX[k] + c * LY[k];
  }
}

function drawSlices(b, im, ox, oy, alpha, shade) {
  const sh = im.height / (M - 1);
  ctx.globalAlpha = alpha;
  for (let k = 0; k < M - 1; k++) {
    const dx = WX[k + 1] - WX[k], dy = WY[k + 1] - WY[k];
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) - Math.PI / 2;
    const c = Math.cos(ang) * dpr, s = Math.sin(ang) * dpr;
    ctx.setTransform(c, s, -s, c, ((WX[k] + WX[k + 1]) / 2 + ox) * dpr, ((WY[k] + WY[k + 1]) / 2 + oy) * dpr);
    const sy = Math.max(0, k * sh - 0.5), sH = Math.min(im.height - sy, sh + 1);
    ctx.drawImage(im, 0, sy, im.width, sH, -bw / 2, -len / 2 - 1, bw, len + 2.5);
    if (shade) {
      const v = clamp(wrap(ang - b.th) * 0.6, -0.2, 0.2);
      if (Math.abs(v) > 0.015 && k > 1 && k < M - 3) {
        ctx.fillStyle = v > 0 ? `rgba(0,0,0,${v})` : `rgba(255,255,255,${-v * 0.8})`;
        ctx.fillRect(-bw / 2, -len / 2 - 1, bw, len + 2.5);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawBill(b) {
  bendCurve(b);
  const lift = b.state === 'flying' ? 1 : clamp(Math.hypot(b.x - cx, b.y - cy) / (bh * 0.5), 0, 1);
  if (lift > 0.02) {
    drawSlices(b, shadowSprite, 6 + 14 * lift, 10 + 24 * lift, 0.10 + 0.10 * lift, false);
    drawSlices(b, shadowSprite, 3 + 8 * lift, 5 + 14 * lift, 0.16 + 0.16 * lift, false);
  }
  drawSlices(b, sprite, 0, 0, 1, true);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStack();
  if (active) drawBill(active);
  for (const f of flyers) drawBill(f);

  const now = performance.now();
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], p = (now - f.t0) / 900;
    if (p >= 1) { floats.splice(i, 1); continue; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1 - p * p;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeText(f.text, f.x, f.y - p * 60);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(f.text, f.x, f.y - p * 60);
    ctx.globalAlpha = 1;
  }
}

let shownMoney = -1;
function updateHUD() {
  dispMoney += (money - dispMoney) * 0.2;
  if (Math.abs(money - dispMoney) < 0.5) dispMoney = money;
  const m = Math.round(dispMoney);
  if (m !== shownMoney) { shownMoney = m; moneyEl.textContent = fmt(m); }
}

let lastT = 0, acc = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  acc += dt;
  let n = 0;
  while (acc >= DT && n < 8) { simulate(); acc -= DT; n++; }
  if (n === 8) acc = 0;
  updateAudio(dt);
  updateHUD();
  render();
  requestAnimationFrame(frame);
}

img = new Image();
img.onload = () => {
  asp = (img.naturalHeight - 2 * CROP) / (img.naturalWidth - 2 * CROP);
  layout();
  reset();
  requestAnimationFrame(frame);
};
img.onerror = () => { moneyEl.textContent = 'sample.jpg ?'; };
img.src = 'sample.jpg';
})();
