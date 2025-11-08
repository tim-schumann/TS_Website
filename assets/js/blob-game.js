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
    height: "var(--svh)",
    zIndex: "-1",
    pointerEvents: "none",
    background: "#fff",
  });

  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  let DPR = window.devicePixelRatio || 1;

  // ───────────────────────────────
  // 🌐 DEVICE / BROWSER
  // ───────────────────────────────
  const ua = navigator.userAgent || "";
  const isMobile  = /mobile|android|iphone|ipad|ipod/i.test(ua);
  const isSafari  = /^((?!chrome|android).)*safari/i.test(ua);
  const isChrome  = /crios|chrome|chromium/i.test(ua);
  const isFirefox = /firefox/i.test(ua);

  let W = innerWidth;
  let H = innerHeight;

  function resizeMainCanvas() {
    DPR = window.devicePixelRatio || 1;
    W = innerWidth;
    H = innerHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(DPR, DPR);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  resizeMainCanvas();

  // ───────────────────────────────
  // ⚙️ GLOBAL PARAMETERS
  // ───────────────────────────────
  const REF_WIDTH = 1500;
  const AREA_DIVISOR = 30000;
  const BLOB_REDUCTION = 0.85;

  let baseForce = 0.001;
  const isMobileSafari  = isMobile && isSafari;
  const isMobileChrome  = isMobile && isChrome;
  const isDesktopChrome = !isMobile && isChrome;
  if (isMobileSafari) baseForce = 0.00015;
  else if (isMobileChrome) baseForce = 0.0005;
  else if (isDesktopChrome) baseForce = 0.0008;
  else baseForce = 0.001;

  const scaleFactor = Math.min(1.5, Math.max(0.7, innerWidth / REF_WIDTH));
  let GRAVITY_SCALE = scaleFactor;
  let SIZE_SCALE    = scaleFactor;
  GRAVITY_SCALE = Math.min(1.5, Math.max(0.7, GRAVITY_SCALE));
  SIZE_SCALE    = Math.min(1.5, Math.max(0.7, SIZE_SCALE));

  const CSS_INCH = 96;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const screenWidthCSS = ((window.screen && window.screen.width) || innerWidth) / devicePixelRatio;
  const screenHeightCSS = ((window.screen && window.screen.height) || innerHeight) / devicePixelRatio;
  const approxDiagonalInches = Math.hypot(screenWidthCSS, screenHeightCSS) / CSS_INCH;
  const requiresPressForGravity = isMobile && approxDiagonalInches < 10;

  const BASE_GRAVITY = baseForce * GRAVITY_SCALE;
  const ACTIVE_FORCE_MULTIPLIER = isMobile ? 2 : 1;
  let gravityArmed = !requiresPressForGravity;
  let MOUSE_FORCE = 0;

  function setGravityState(forceActive) {
    gravityArmed = forceActive || !requiresPressForGravity;
    const multiplier = gravityArmed ? ACTIVE_FORCE_MULTIPLIER : 0;
    MOUSE_FORCE = BASE_GRAVITY * multiplier;
  }

  setGravityState(gravityArmed);

  const MOBILE_RADIUS_SCALE = (isMobile ? 0.7 : 1) * SIZE_SCALE;
  const MOBILE_MARGIN       = isMobile ? 0.1 : 0;

  const BLUR_LOW = isSafari ? 35 : isFirefox ? 3 : 1;
  const BLUR_UP  = isSafari ? 60 : isFirefox ? 5 : 3;

// ───────────────────────────────
// 🕹️ GAME STATE  &  LEVEL LOGIC
// ───────────────────────────────
const LEVEL_DURATION = 60;
const PROGRESS_BAR_HEIGHT = 6;
const WARNING_FLASH_DURATION = 0.8;
const WARNING_FLASH_ALPHA = 0.3; // half the strength of the final overlay
const LEVEL_BANNER_FADE_IN_SPEED = 2;  // alpha per second
const LEVEL_BANNER_FADE_OUT_SPEED = 1.2;
const LEVEL_BANNER_MAX_BLUR = 35;
const LEVEL_BANNER_BLUR_SPEED = 45;
let level = 1;
let timeLeft = LEVEL_DURATION;
let gameOver = false;
let driftMultiplier = 1.0;
let warningFlashTimer = 0;
let lastWarningSecond = null;
let uiSuppressed = false;
const nextLevelBanner = {
  number: null,
  alpha: 0,
  visible: false,
  fadingOut: false,
  blur: 0,
};

// 🎨 Le Corbusier-inspired palette (darker tones stay visible on white)
const corbusierColors = [
  "#4C5B61", // gris foncé blue
  "#6F4E37", // terre brûlée
  "#3E6257", // vert anglais
  "#354B5E", // bleu outremer
  "#5A4A5C", // violet sombre
  "#5C604D"  // olive patiné
];

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const bigint = parseInt(value, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function tonedColorFromHex(hex) {
  const rgb = hexToRgb(hex);
  const mix = 0.85; // darken slightly to keep readability on white
  return {
    r: Math.round(rgb.r * mix),
    g: Math.round(rgb.g * mix),
    b: Math.round(rgb.b * mix),
  };
}

function currentBlobColor() {
  if (level === 1) return { r: 0, g: 0, b: 0 };
  const hex = corbusierColors[(level - 2) % corbusierColors.length];
  return tonedColorFromHex(hex);
}

function rgbaFromColor(color, alpha) {
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${color.r},${color.g},${color.b},${clamped})`;
}

function drawTimerProgressBar(ctxRef) {
  const progress = Math.max(0, Math.min(1, timeLeft / LEVEL_DURATION));
  const barWidth = W * progress;
  const color = currentBlobColor();
  ctxRef.save();
  ctxRef.fillStyle = rgbaFromColor(color, 0.85);
  ctxRef.fillRect(0, H - PROGRESS_BAR_HEIGHT, barWidth, PROGRESS_BAR_HEIGHT);
  ctxRef.restore();
}

function showNextLevelBanner(nextNumber) {
  nextLevelBanner.number = nextNumber;
  nextLevelBanner.visible = true;
  nextLevelBanner.alpha = 0;
  nextLevelBanner.blur = 0;
  nextLevelBanner.fadingOut = false;
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
  position: "fixed",
  bottom: "10px",
  left: "50%",
  transform: "translateX(-50%)",
  color: "#000",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "16px",
  fontWeight: "300",
  zIndex: "10",
  background: "transparent",
  padding: "6px 14px",
  borderRadius: "999px",
  backdropFilter: "blur(4px)",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px"
});
document.body.appendChild(hud);

function syncHudVisibility() {
  hud.style.display = (!gameOver && !uiSuppressed) ? "inline-flex" : "none";
}

// 🔁 Retry button — same visual style as HUD
const retryBtn = document.createElement("button");
retryBtn.textContent = "Retry";
Object.assign(retryBtn.style, {
  position: "fixed",
  bottom: "10px",
  left: "50%",
  transform: "translateX(-50%)",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "16px", fontWeight: "600",
  background: "rgba(255,255,255,0.3)",
  color: "#000",
  border: "none",
  borderRadius: "999px",
  padding: "6px 14px",
  backdropFilter: "blur(4px)",
  cursor: "pointer",
  zIndex: "20",
  display: "none"
});
document.body.appendChild(retryBtn);

retryBtn.onclick = () => {
  level = 1;
  driftMultiplier = 1;
  timeLeft = LEVEL_DURATION;
  warningFlashTimer = 0;
  lastWarningSecond = null;
  nextLevelBanner.visible = false;
  nextLevelBanner.alpha = 0;
  nextLevelBanner.number = null;
  nextLevelBanner.fadingOut = false;
  nextLevelBanner.blur = 0;
  gameOver = false;
  uiSuppressed = false;
  blackoutAlpha = 0;
  blobs = [];
  generateBlobs(calcNumBlobs());
  updateHUD();
  retryBtn.style.display = "none";
  syncHudVisibility();
};

function updateHUD() {
  if (gameOver) {
    retryBtn.style.display = "inline-flex";
    syncHudVisibility();
    return;
  }

  hud.style.color = rgbaFromColor(currentBlobColor(), 1);
  hud.style.background = "transparent";
  const displayTime = Math.max(0, Math.ceil(timeLeft));
  hud.textContent = `${displayTime}s  |  Level ${level}`;
  retryBtn.style.display = "none";
  syncHudVisibility();
}
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
  timeLeft = LEVEL_DURATION;
  warningFlashTimer = 0;
  lastWarningSecond = null;
  if (nextLevelBanner.visible) {
    nextLevelBanner.fadingOut = true;
    nextLevelBanner.blur = 0;
  }
  uiSuppressed = false;
  syncHudVisibility();
  blackoutAlpha = 0;
  generateBlobs(calcNumBlobs());
  const levelColor = currentBlobColor();
  for (const b of blobs) b.color = { ...levelColor };
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
    resizeMainCanvas();
    updateOffscreenSizes();
    generateBlobs(calcNumBlobs());
  });

  // ───────────────────────────────
  // PHYSICS / DRAW / EXPLOSION
  // ───────────────────────────────
  const mouse = { x: W / 2, y: H / 2 };
  const hasPointerEvents = "PointerEvent" in window;

  const updatePointerPosition = (evt) => {
    if (!evt) return;
    mouse.x = evt.clientX;
    mouse.y = evt.clientY;
  };

  const armGravityOnPointerDown = (evt) => {
    updatePointerPosition(evt);
    setGravityState(true);
  };

  const disarmGravityIfNeeded = () => {
    if (requiresPressForGravity) setGravityState(false);
  };

  if (hasPointerEvents) {
    window.addEventListener("pointermove", updatePointerPosition, { passive: true });
    window.addEventListener("pointerdown", armGravityOnPointerDown, { passive: true });
    ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
      window.addEventListener(type, disarmGravityIfNeeded, { passive: true });
    });
  } else {
    window.addEventListener("mousemove", updatePointerPosition, { passive: true });
    window.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length) updatePointerPosition(e.touches[0]);
      setGravityState(true);
    }, { passive: true });
    window.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length) updatePointerPosition(e.touches[0]);
    }, { passive: true });
    window.addEventListener("touchend", disarmGravityIfNeeded, { passive: true });
    window.addEventListener("touchcancel", disarmGravityIfNeeded, { passive: true });
  }

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
    uiSuppressed = true;
    syncHudVisibility();
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
      const innerAlpha = b.brightness * b.alpha;
      const midAlpha = Math.max(0.18, innerAlpha - 0.15);
      const grad = offCtx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, rgbaFromColor(b.color, innerAlpha));
      grad.addColorStop(0.45, rgbaFromColor(b.color, midAlpha));
      grad.addColorStop(1, rgbaFromColor(b.color, 0));
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
      const innerAlpha = Math.min(1.0, (b.brightness + 0.4) * (b.alpha + 0.3));
      const midAlpha = Math.max(0.25, innerAlpha - 0.1);
      const grad = offCtx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, rgbaFromColor(b.color, innerAlpha));
      grad.addColorStop(0.45, rgbaFromColor(b.color, midAlpha));
      grad.addColorStop(1, rgbaFromColor(b.color, 0));
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

    if (!uiSuppressed && !gameOver) {
      drawTimerProgressBar(ctx);
    }

    if (!uiSuppressed && !gameOver && warningFlashTimer > 0) {
      const flashStrength = warningFlashTimer / WARNING_FLASH_DURATION;
      ctx.fillStyle = `rgba(180,0,0,${WARNING_FLASH_ALPHA * flashStrength})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (nextLevelBanner.visible && nextLevelBanner.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = nextLevelBanner.alpha;
      ctx.filter = nextLevelBanner.blur > 0 ? `blur(${nextLevelBanner.blur}px)` : "none";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.round(H * 0.25)}px Helvetica, Arial, sans-serif`;
      const label = nextLevelBanner.number != null ? String(nextLevelBanner.number) : "";
      ctx.fillText(label, W / 2, H / 2);
      ctx.restore();
    }

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
    warningFlashTimer = Math.max(0, warningFlashTimer - dt);
    if (nextLevelBanner.visible) {
      if (nextLevelBanner.fadingOut) {
        nextLevelBanner.alpha = Math.max(0, nextLevelBanner.alpha - LEVEL_BANNER_FADE_OUT_SPEED * dt);
        nextLevelBanner.blur = Math.min(LEVEL_BANNER_MAX_BLUR, nextLevelBanner.blur + LEVEL_BANNER_BLUR_SPEED * dt);
        if (nextLevelBanner.alpha === 0) {
          nextLevelBanner.visible = false;
          nextLevelBanner.number = null;
          nextLevelBanner.fadingOut = false;
          nextLevelBanner.blur = 0;
        }
      } else {
        nextLevelBanner.alpha = Math.min(1, nextLevelBanner.alpha + LEVEL_BANNER_FADE_IN_SPEED * dt);
        nextLevelBanner.blur = Math.max(0, nextLevelBanner.blur - LEVEL_BANNER_BLUR_SPEED * dt);
      }
    }
    if (gameOver) return;

    timeLeft = Math.max(0, timeLeft - dt);
    const warningSecond = Math.ceil(timeLeft);
    if (warningSecond <= 5 && warningSecond > 0 && warningSecond !== lastWarningSecond) {
      warningFlashTimer = WARNING_FLASH_DURATION;
      lastWarningSecond = warningSecond;
    }

    if (timeLeft <= 0) {
      timeLeft = 0;
      if (!gameOver) {
        gameOver = true;
        blackoutAlpha = 0;
        explosion = null;
        nextLevelBanner.visible = false;
        nextLevelBanner.alpha = 0;
        nextLevelBanner.number = null;
        nextLevelBanner.fadingOut = false;
        nextLevelBanner.blur = 0;
      }
      return;
    }

    time += dt;

    if (explosion && explosion.active) {
      let b = explosion.blob;
      b.r = b.r * (1 + explosion.growthRate * dt);
      blackoutAlpha = Math.min(1, b.r / explosion.targetR);
      if (b.r >= explosion.targetR) {
        blackoutAlpha = 1;
        explosion.active = false;
        blobs = [];
        showNextLevelBanner(level + 1);
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
