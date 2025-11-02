// liquid-background-game-v2.js — refined Blob Game 🎨 + retry + color progression

function initLiquidBackgroundGame() {
  const canvas = document.createElement("canvas");
  canvas.id = "liquid-bg";
  document.body.prepend(canvas);
  Object.assign(canvas.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    zIndex: "-1",
    pointerEvents: "none",
    background: "#fff",
  });

  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // ───────────────────────────────
  // 🌐 DEVICE / BROWSER
  // ───────────────────────────────
  const ua = navigator.userAgent || "";
  const isMobile  = /mobile|android|iphone|ipad|ipod/i.test(ua);
  const isSafari  = /^((?!chrome|android).)*safari/i.test(ua);
  const isChrome  = /crios|chrome|chromium/i.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const isDesktop = !isMobile;

  let W = (canvas.width = innerWidth);
  let H = (canvas.height = innerHeight);

  // ───────────────────────────────
  // ⚙️ GLOBAL PARAMETERS
  // ───────────────────────────────
  const REF_WIDTH = 1500;
  const AREA_DIVISOR = 30000;
  const BLOB_REDUCTION = 0.85;

  // base gravity per browser (+30 %)
  let baseForce = 0.0013;
  if (isMobile && isSafari) baseForce = 0.0001;
  else if (isMobile && isChrome) baseForce = 0.00032;
  else if (isDesktop && isChrome) baseForce = 0.00078;
  else baseForce = 0.0013;

  const screenScale = Math.min(1.5, Math.max(0.7, innerWidth / REF_WIDTH));
  const GRAVITY_SCALE = Math.min(1.5, Math.max(0.7, screenScale));
  const SIZE_SCALE    = Math.min(1.5, Math.max(0.7, screenScale));

  let MOUSE_FORCE = baseForce * GRAVITY_SCALE;
  const MOBILE_RADIUS_SCALE = (isMobile ? 0.7 : 1) * SIZE_SCALE;
  const MOBILE_MARGIN       = isMobile ? 0.1 : 0;

  if (isMobile) {
    window.addEventListener("pointerdown", () => {
      MOUSE_FORCE = baseForce * GRAVITY_SCALE * 1.25;
    });
    window.addEventListener("pointerup", () => {
      MOUSE_FORCE = baseForce * GRAVITY_SCALE;
    });
  }

  const BLUR_LOW = isSafari ? 35 : isFirefox ? 3 : 1;
  const BLUR_UP  = isSafari ? 60 : isFirefox ? 5 : 3;

  function calcNumBlobs() {
    const area = W * H;
    const baseCount = (area / AREA_DIVISOR) * BLOB_REDUCTION;
    return Math.max(20, Math.min(80, Math.round(baseCount)));
  }

  // ───────────────────────────────
// 🕹️ GAME STATE  &  LEVEL LOGIC
// ───────────────────────────────
let level = 1;
let timeLeft = 60;             // back to 60 s
let gameOver = false;
let driftMultiplier = 1.0;

// 🎨 Le Corbusier palette (used from level 2 on)
const corbusierColors = [
  "#C7C4B9", "#9BB1A0", "#BDA676",
  "#7A8CA0", "#A07E6A", "#B2B6AD"
];
function currentBlobColor() {
  return level === 1 ? "#000000" :
         corbusierColors[(level - 2) % corbusierColors.length];
}

// scaling helpers for size & count per level
function sizeScaleForLevel(lvl) {
  // lvl 1 = +30 %, then −5 % per level
  return 1.3 * Math.pow(0.95, lvl - 1);
}
function countScaleForLevel(lvl) {
  // lvl 1 = −20 %, then +5 % per level
  return 0.8 * Math.pow(1.05, lvl - 1);
}

// HUD
const hud = document.createElement("div");
Object.assign(hud.style, {
  position: "fixed", bottom: "10px", left: "10px",
  color: "#000",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "16px", fontWeight: "600",
  zIndex: "10",
  background: "rgba(255,255,255,0.3)",
  padding: "6px 10px", borderRadius: "8px",
  backdropFilter: "blur(4px)"
});
document.body.appendChild(hud);

// 🔁 Retry button — same visual style as HUD
const retryBtn = document.createElement("button");
retryBtn.textContent = "Retry";
Object.assign(retryBtn.style, {
  position: "fixed",
  top: "50%", left: "50%",
  transform: "translate(-50%, -50%)",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "16px", fontWeight: "600",
  background: "rgba(255,255,255,0.3)",
  color: "#000",
  border: "2px solid #000",
  borderRadius: "8px",
  padding: "8px 18px",
  backdropFilter: "blur(4px)",
  cursor: "pointer",
  zIndex: "20",
  display: "none"
});
document.body.appendChild(retryBtn);

retryBtn.onclick = () => {
  level = 1;
  driftMultiplier = 1;
  timeLeft = 60;
  gameOver = false;
  blackoutAlpha = 0;
  blobs = [];
  generateBlobs(calcNumBlobs());
  updateHUD();
  retryBtn.style.display = "none";
  startTimer();
};

function updateHUD() {
  if (gameOver) {
    hud.style.color = "#fff";
    hud.style.background = "rgba(180,0,0,0.8)";
    hud.textContent = "GAME OVER";
    retryBtn.style.display = "block";
  } else {
    hud.style.color = "#000";
    hud.style.background = "rgba(255,255,255,0.3)";
    hud.textContent = `⏱ ${timeLeft}s  |  Level ${level}`;
  }
}

function startTimer() {
  clearInterval(window.gameTimer);
  window.gameTimer = setInterval(() => {
    if (gameOver) return clearInterval(window.gameTimer);
    timeLeft--;
    updateHUD();
    if (timeLeft <= 0 && !explosion) {
      gameOver = true;
      blackoutAlpha = 0;
      clearInterval(window.gameTimer);
    }
  }, 1000);
}
startTimer();
updateHUD();

// ───────────────────────────────
// 💧 BLOBS with per-level scaling
// ───────────────────────────────
let blobs = [];
function createBlob() {
  const marginX = W * MOBILE_MARGIN;
  const marginY = H * MOBILE_MARGIN;
  const x = marginX + Math.random() * (W - marginX * 2);
  const y = marginY + Math.random() * (H - marginY * 2);
  const baseR = (24 + Math.random() * 48)
              * MOBILE_RADIUS_SCALE
              * sizeScaleForLevel(level);     // size scaling by level
  return {
    x, y,
    vx: (Math.random() - 0.5) * 1.2,
    vy: (Math.random() - 0.5) * 1.2,
    r: baseR,
    brightness: 0.45 + Math.random() * 0.35,
    driftPhase: Math.random() * Math.PI * 2,
    driftSpeed: (0.05 + Math.random() * 0.12) * driftMultiplier,
    alpha: 0,
    targetAlpha: 1,
    color: currentBlobColor()
  };
}

// overwrite calcNumBlobs to use count scaling
function calcNumBlobs() {
  const area = W * H;
  const baseCount = (area / AREA_DIVISOR)
                  * BLOB_REDUCTION
                  * countScaleForLevel(level); // count scaling by level
  return Math.max(10, Math.min(100, Math.round(baseCount)));
}

function generateBlobs(targetCount) {
  blobs = [];
  for (let i = 0; i < targetCount; i++) blobs.push(createBlob());
}

// level-up handler inside your explosion logic should now call:
function handleLevelUp() {
  level++;
  driftMultiplier *= 1.08;
  timeLeft = 60;
  blackoutAlpha = 0;
  generateBlobs(calcNumBlobs());
  for (const b of blobs) b.color = currentBlobColor();
  updateHUD();
}


  generateBlobs(calcNumBlobs());

  // ───────────────────────────────
  // OFFSCREEN BUFFERS
  // ───────────────────────────────
  let SIM_W = 360;
  let SIM_H = Math.round(SIM_W * (H / W));
  const off = document.createElement("canvas");
  const tmp = document.createElement("canvas");
  const offCtx = off.getContext("2d", { alpha: true });
  const tmpCtx = tmp.getContext("2d", { alpha: true });

  function updateOffscreenSizes() {
    SIM_H = Math.round(SIM_W * (H / W));
    off.width = SIM_W;
    off.height = SIM_H;
    tmp.width = SIM_W;
    tmp.height = SIM_H;
  }
  updateOffscreenSizes();

  window.addEventListener("resize", () => {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    updateOffscreenSizes();
    generateBlobs(calcNumBlobs());
  });

  // ───────────────────────────────
  // PHYSICS / DRAW / EXPLOSION
  // ───────────────────────────────
  const mouse = { x: W / 2, y: H / 2 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  let explosion = null;
  let blackoutAlpha = 0;

  function startExplosion() {
    if (gameOver) return;
    let largest = blobs.reduce((a, b) => (a.r > b.r ? a : b));
    explosion = {
      blob: largest,
      active: true,
      growthRate: 1.9,
      targetR: Math.hypot(W, H),
    };
  }

  function drawOffscreen() {
    const sx = SIM_W / W;
    const sy = SIM_H / H;
    const s = Math.min(sx, sy);
    offCtx.clearRect(0, 0, SIM_W, SIM_H);
    offCtx.fillStyle = "rgba(255,255,255,1)";
    offCtx.fillRect(0, 0, SIM_W, SIM_H);

    for (const b of blobs) {
      b.alpha += (b.targetAlpha - b.alpha) * 0.05;
      const cx = b.x * s;
      const cy = b.y * s;
      const rr = Math.max(8, b.r * s * 1.5);
      const grad = offCtx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, `${b.color}ee`);
      grad.addColorStop(0.8, `${b.color}00`);
      offCtx.fillStyle = grad;
      offCtx.beginPath();
      offCtx.arc(cx, cy, rr, 0, Math.PI * 2);
      offCtx.fill();
    }

    if (explosion && explosion.active) {
      const b = explosion.blob;
      const cx = b.x * s;
      const cy = b.y * s;
      const rr = Math.max(8, b.r * s * 1.5);
      const grad = offCtx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      offCtx.fillStyle = grad;
      offCtx.beginPath();
      offCtx.arc(cx, cy, rr, 0, Math.PI * 2);
      offCtx.fill();
    }

    if (blackoutAlpha > 0) {
      offCtx.fillStyle = `rgba(0,0,0,${blackoutAlpha})`;
      offCtx.fillRect(0, 0, SIM_W, SIM_H);
    }
  }

  function lowResBlur() {
    tmpCtx.clearRect(0, 0, SIM_W, SIM_H);
    tmpCtx.filter = `blur(${BLUR_LOW}px)`;
    tmpCtx.drawImage(off, 0, 0);
    tmpCtx.filter = "none";
  }

  function compositeToScreen() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.filter = `blur(${BLUR_UP}px)`;
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.85;
    ctx.drawImage(tmp, 0, 0, W, H);
    ctx.restore();

    if (gameOver) {
      ctx.fillStyle = "rgba(180,0,0,0.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 48px Helvetica, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2 - 40);
    }
  }

  let time = 0;
  function stepPhysics(dt) {
    if (gameOver) return;

    time += dt;

    if (explosion && explosion.active) {
      let b = explosion.blob;
      b.r = b.r * (1 + explosion.growthRate * dt);
      blackoutAlpha = Math.min(1, b.r / explosion.targetR);
      if (b.r >= explosion.targetR) {
        blackoutAlpha = 1;
        explosion.active = false;
        blobs = [];
        setTimeout(handleLevelUp, 2000);
        }
      return;
    }

    for (const b of blobs) {
      const dx = mouse.x - b.x;
      const dy = mouse.y - b.y;
      const dist2 = dx * dx + dy * dy;
      const influence = Math.exp(-dist2 / 20000);
      b.vx += dx * MOUSE_FORCE * influence;
      b.vy += dy * MOUSE_FORCE * influence;
      b.vx += Math.cos(b.driftPhase + time * b.driftSpeed) * 0.002;
      b.vy += Math.sin(b.driftPhase + time * b.driftSpeed) * 0.002;
      b.vx *= 0.96;
      b.vy *= 0.96;
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -60) b.x = -60, b.vx *= -0.6;
      if (b.x > W + 60) b.x = W + 60, b.vx *= -0.6;
      if (b.y < -60) b.y = -60, b.vy *= -0.6;
      if (b.y > H + 60) b.y = H + 60, b.vy *= -0.6;
    }

    // explosion trigger
    if (blobs.length > 3) {
      const avgX = blobs.reduce((a, b) => a + b.x, 0) / blobs.length;
      const avgY = blobs.reduce((a, b) => a + b.y, 0) / blobs.length;
      const maxDist = Math.max(...blobs.map(b => Math.hypot(b.x - avgX, b.y - avgY)));
      if (maxDist < 80) startExplosion();
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepPhysics(dt);
    drawOffscreen();
    lowResBlur();
    compositeToScreen();
    updateHUD();
    window.liquidRAF = requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initLiquidBackgroundGame);
} else {
  initLiquidBackgroundGame();
}
