// liquid-background.js — largest-blob black-out explosion + per-browser gravity + mobile fixes
function initLiquidBackground() {
  const canvas = document.createElement("canvas");
  canvas.id = "liquid-bg";
  document.body.prepend(canvas);
  Object.assign(canvas.style, {
  position: "fixed",
  top: "0",
  left: "0",
  width: "100vw",
  height: "var(--svh)", // 👈 use CSS variable instead of hardcoded vh
  zIndex: "-1",
  pointerEvents: "none",
  background: "#fff",
});

  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // ───────────────────────────────── Device/Browser flags
  const ua = navigator.userAgent || "";
  const isMobile  = /mobile|android|iphone|ipad|ipod/i.test(ua);
  const isSafari  = /^((?!chrome|android).)*safari/i.test(ua);
  const isChrome  = /crios|chrome|chromium/i.test(ua);
  const isFirefox = /firefox/i.test(ua);

  let W = (canvas.width = innerWidth);
  let H = (canvas.height = innerHeight);

  // 🟢 Adaptive gravity and blob scaling per device/screen
let baseForce = 0.001;

// detect platform
const isMobileSafari  = isMobile && isSafari;
const isMobileChrome  = isMobile && isChrome;
const isDesktopChrome = !isMobile && isChrome;

// ───────────────────────────────
// BASE GRAVITY by browser type
if (isMobileSafari) baseForce = 0.00015;
else if (isMobileChrome) baseForce = 0.0005;
else if (isDesktopChrome) baseForce = 0.0008;
else baseForce = 0.001; // Safari / Firefox / others desktop

// ───────────────────────────────
// SCALE with screen size
// → tuned so 14" (≈ 1500 px width) feels “perfect”
const refWidth = 1500; // reference width (your 14" sweet spot)
const scaleFactor = Math.min(1.5, Math.max(0.7, innerWidth / refWidth));

// adjust blob size + gravity for very large displays
let GRAVITY_SCALE = scaleFactor;  // more space ⇒ slightly stronger pull
let SIZE_SCALE    = scaleFactor;  // bigger screens ⇒ proportionally bigger blobs

// clamp for sanity (no extreme values)
GRAVITY_SCALE = Math.min(1.5, Math.max(0.7, GRAVITY_SCALE));
SIZE_SCALE    = Math.min(1.5, Math.max(0.7, SIZE_SCALE));

// final gravity
let MOUSE_FORCE = baseForce * GRAVITY_SCALE;

// ───────────────────────────────
// Touch-activation: on phones only increase gravity after user tap/click
if (isMobile) {
  let touchActive = false;
  window.addEventListener("pointerdown", () => {
    touchActive = true;
    MOUSE_FORCE = baseForce * GRAVITY_SCALE * 3; // +200% stronger after touch
  });
  window.addEventListener("pointerup", () => {
    touchActive = false;
    MOUSE_FORCE = baseForce * GRAVITY_SCALE;        // reset
  });
}

// ───────────────────────────────
// apply blob size scaling globally
const MOBILE_RADIUS_SCALE = (isMobile ? 0.7 : 1) * SIZE_SCALE;
const MOBILE_MARGIN       = isMobile ? 0.1 : 0;


  // ───────────────────────────────── Counts and blobs
  function calcNumBlobs() {
    const area = W * H;
    return Math.max(20, Math.min(80, Math.round(area / 30000 * 0.85)));
  }

  let blobs = [];
  function createBlob() {
    const marginX = W * MOBILE_MARGIN;
    const marginY = H * MOBILE_MARGIN;
    const x = marginX + Math.random() * (W - marginX * 2);
    const y = marginY + Math.random() * (H - marginY * 2);
    const baseR = 24 + Math.random() * 48;
    return {
      x, y,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      r: baseR * MOBILE_RADIUS_SCALE,
      brightness: 0.45 + Math.random() * 0.35,
      driftPhase: Math.random() * Math.PI * 2,
      driftSpeed: 0.05 + Math.random() * 0.12,
      alpha: 0,
      targetAlpha: 1,
      isDying: false,
    };
  }

  function generateBlobs(targetCount) {
    const diff = targetCount - blobs.length;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) blobs.push(createBlob());
    } else if (diff < 0) {
      const removeCount = -diff;
      for (let i = 0; i < removeCount; i++) {
        blobs[i].targetAlpha = 0;
        blobs[i].isDying = true;
      }
    }
  }

  generateBlobs(calcNumBlobs());

  // 🟢 iOS stretch fix: force a pixel-perfect redraw right after load
  setTimeout(() => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }, 300);

  // ───────────────────────────────── Offscreen buffers
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

  const BLUR_LOW = isSafari ? 35 : isFirefox ? 3 : 1;
  const BLUR_UP  = isSafari ? 60 : isFirefox ? 5 : 3;

  const mouse = { x: W / 2, y: H / 2 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // ───────────────────────────────── Explosion via LARGEST blob
  // phases: null -> 'grow' (largest blob expands & darkens) -> blackout hold -> fade white -> respawn
  let explosion = null; // { index, targetR, growthRate }
  let blackoutPhase = 0; // 0 none, 1 holding black, 2 fading to white
  let blackoutAlpha = 0;
  let respawnTimer = null;

  function startLargestBlobExplosion() { // 🟢
    if (!blobs.length) return;
    // pick largest blob (by radius)
    let idx = 0;
    for (let i = 1; i < blobs.length; i++) if (blobs[i].r > blobs[idx].r) idx = i;
    const b = blobs[idx];

    // don't remove other blobs — they stay visible until the largest covers the screen
    const coverR = Math.hypot(W, H); // rough world-space diagonal; draw uses soften*1.5 so this is generous
    explosion = {
      index: idx,
      targetR: coverR,          // when its radius exceeds this, we consider screen "filled"
      growthRate: 1.9,          // exponential growth factor per second
      active: true
    };
    // boost its darkness smoothly
    b.targetAlpha = 1.0;
    b.brightness = Math.min(1.0, b.brightness + 0.25); // darker center
  }

  // ───────────────────────────────── Draw pipeline
  function drawOffscreen() {
    const sx = SIM_W / W;
    const sy = SIM_H / H;
    const s  = Math.min(sx, sy); // uniform scale: keeps circles perfectly round

    offCtx.clearRect(0, 0, SIM_W, SIM_H);
    offCtx.fillStyle = "rgba(255,255,255,1)";
    offCtx.fillRect(0, 0, SIM_W, SIM_H);

    // draw all blobs (largest will be drawn again if exploding to ensure dominance)
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      b.alpha += (b.targetAlpha - b.alpha) * 0.05;
      if (b.isDying && b.alpha < 0.02) { blobs.splice(i, 1); i--; continue; }

      const cx = b.x * s, cy = b.y * s;
      const rr = Math.max(8, b.r * s * 1.5);
      const innerAlpha = b.brightness * b.alpha;
      const midAlpha = Math.max(0.18, innerAlpha - 0.15);

      const grad = offCtx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, `rgba(0,0,0,${innerAlpha})`);
      grad.addColorStop(0.45, `rgba(0,0,0,${midAlpha})`);
      grad.addColorStop(1, `rgba(0,0,0,0)`);
      offCtx.fillStyle = grad;
      offCtx.beginPath();
      offCtx.arc(cx, cy, rr, 0, Math.PI * 2);
      offCtx.fill();
    }

    // 🟢 If exploding, over-draw the largest blob with intensified darkness & (now bigger) radius
    if (explosion && explosion.active && blobs[explosion.index]) {
      const b = blobs[explosion.index];
      const cx = b.x * s, cy = b.y * s;
      const rr = Math.max(8, b.r * s * 1.5);
      const innerAlpha = Math.min(1.0, (b.brightness + 0.4) * (b.alpha + 0.3)); // extra dark
      const midAlpha = Math.max(0.25, innerAlpha - 0.1);

      const grad = offCtx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, `rgba(0,0,0,${innerAlpha})`);
      grad.addColorStop(0.45, `rgba(0,0,0,${midAlpha})`);
      grad.addColorStop(1, `rgba(0,0,0,0)`);
      offCtx.fillStyle = grad;
      offCtx.beginPath();
      offCtx.arc(cx, cy, rr, 0, Math.PI * 2);
      offCtx.fill();
    }

    // Blackout overlay
    if (blackoutPhase > 0 || blackoutAlpha > 0) {
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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.filter = `blur(${BLUR_UP}px)`;
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.85;
    ctx.drawImage(tmp, 0, 0, W, H);
    ctx.restore();
  }

  // ───────────────────────────────── Physics + Explosion control
  let time = 0;
  function stepPhysics(dt) {
    time += dt;

    // Handle fading/respawn phases
    if (blackoutPhase === 1) { // holding black, do nothing (stay black)
      return;
    } else if (blackoutPhase === 2) { // fading back to white
      blackoutAlpha -= dt * 0.5;
      if (blackoutAlpha <= 0) {
        blackoutAlpha = 0;
        blackoutPhase = 0;
        // Gradual respawn over 3 seconds
        if (respawnTimer) clearInterval(respawnTimer);
        const total = calcNumBlobs();
        let spawned = 0;
        respawnTimer = setInterval(() => {
          blobs.push(createBlob());
          spawned++;
          if (spawned >= total) clearInterval(respawnTimer);
        }, 3000 / total);
      }
      return;
    }

    // Explosion grow phase driven by largest blob
    if (explosion && explosion.active && blobs[explosion.index]) {
      const b = blobs[explosion.index];
      // exponential growth toward target
      b.r = b.r * (1 + explosion.growthRate * dt);
      b.brightness = Math.min(1.15, b.brightness + 0.4 * dt); // keep darkening a bit
      b.targetAlpha = 1.0;

      // progressively ramp blackoutAlpha as radius approaches target (feels seamless)
      const progress = Math.min(1, b.r / explosion.targetR);
      blackoutAlpha = Math.max(blackoutAlpha, progress); // 0 → 1

      if (b.r >= explosion.targetR) {
        // fully black; hold for ~2s, then fade back and respawn
        blackoutAlpha = 1;
        explosion.active = false;
        // Hide everything beneath black to avoid artifacts
        blobs = [];
        blackoutPhase = 1;
        setTimeout(() => { blackoutPhase = 2; }, 2000);
      }
      return; // pause normal physics while exploding
    }

    // Regular blob motion
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

      // containment
      if (b.x < -60) b.x = -60, b.vx *= -0.6;
      if (b.x > W + 60) b.x = W + 60, b.vx *= -0.6;
      if (b.y < -60) b.y = -60, b.vy *= -0.6;
      if (b.y > H + 60) b.y = H + 60, b.vy *= -0.6;
    }

    // Fusion trigger: when all blobs are clustered, start the LARGEST-blob explosion
    if (!explosion && blobs.length > 3) {
      const avgX = blobs.reduce((a, b) => a + b.x, 0) / blobs.length;
      const avgY = blobs.reduce((a, b) => a + b.y, 0) / blobs.length;
      const maxDist = Math.max(...blobs.map(b => Math.hypot(b.x - avgX, b.y - avgY)));
      if (maxDist < 80) startLargestBlobExplosion(); // 🟢
    }
  }

  // ───────────────────────────────── Main loop
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    stepPhysics(dt);
    drawOffscreen();
    lowResBlur();
    compositeToScreen();

    window.liquidRAF = requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// auto initialize
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initLiquidBackground);
} else {
  initLiquidBackground();
}
