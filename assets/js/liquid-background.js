// liquid-background.js — refined mobile behavior + safe margins + smaller blobs
function initLiquidBackground() {
  const canvas = document.createElement("canvas");
  canvas.id = "liquid-bg";
  document.body.prepend(canvas);
  Object.assign(canvas.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "-1",
    pointerEvents: "none",
    background: "#fff",
  });

  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  let W = (canvas.width = innerWidth);
  let H = (canvas.height = innerHeight);

  const ua = navigator.userAgent || "";
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua); // 🟢 Added
  const MOUSE_FORCE = isMobile ? 0.0004 : 0.001;

  // 🟢 Blobs on phones: smaller + inner margins
  const MOBILE_RADIUS_SCALE = isMobile ? 0.7 : 1;
  const MOBILE_MARGIN = isMobile ? 0.1 : 0; // 10% screen margin inside edges

  function calcNumBlobs() {
    const area = W * H;
    return Math.max(20, Math.min(80, Math.round(area / 30000)));
  }

  let blobs = [];
  function createBlob() {
    const marginX = W * MOBILE_MARGIN;
    const marginY = H * MOBILE_MARGIN;
    const x = marginX + Math.random() * (W - marginX * 2);
    const y = marginY + Math.random() * (H - marginY * 2);
    const baseR = 24 + Math.random() * 48;
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      r: baseR * MOBILE_RADIUS_SCALE, // 🟢 smaller on mobile
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

  // Offscreen setup
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

  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const BLUR_LOW = isSafari ? 35 : isFirefox ? 2 : 0.5;
  const BLUR_UP = isSafari ? 60 : isFirefox ? 4 : 2;

  const mouse = { x: W / 2, y: H / 2 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Explosion + blackout
  let explosion = null;
  let blackoutPhase = 0;
  let blackoutAlpha = 0;
  let respawnTimer = null;

  function startExplosion(x, y) {
    explosion = {
      x,
      y,
      t: 0,
      waves: [],
      duration: 3,
    };
    for (let i = 0; i < 5; i++) {
      explosion.waves.push({
        r: 80 + i * 40,
        speed: 300 + i * 150,
        alpha: 0.6 - i * 0.1,
        decay: 0.25 + i * 0.05,
      });
    }
    setTimeout(() => {
      blackoutPhase = 1;
    }, 1000);
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
      if (b.isDying && b.alpha < 0.02) {
        blobs.splice(blobs.indexOf(b), 1);
        continue;
      }

      const cx = b.x * s;
      const cy = b.y * s;
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

    if (explosion) {
      for (const w of explosion.waves) {
        const cx = explosion.x * s;
        const cy = explosion.y * s;
        const grad = offCtx.createRadialGradient(
          cx,
          cy,
          w.r * s * 0.2,
          cx,
          cy,
          w.r * s
        );
        grad.addColorStop(0, `rgba(0,0,0,${w.alpha})`);
        grad.addColorStop(1, `rgba(0,0,0,0)`);
        offCtx.fillStyle = grad;
        offCtx.beginPath();
        offCtx.arc(cx, cy, w.r * s, 0, Math.PI * 2);
        offCtx.fill();
      }
    }

    if (blackoutPhase > 0) {
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

  let time = 0;
  function stepPhysics(dt) {
    time += dt;

    if (blackoutPhase === 1) {
      blackoutAlpha += dt * 0.5;
      if (blackoutAlpha >= 1) {
        blackoutAlpha = 1;
        blackoutPhase = 2;
        setTimeout(() => {
          blackoutPhase = 3;
        }, 2000);
      }
      return;
    } else if (blackoutPhase === 3) {
      blackoutAlpha -= dt * 0.5;
      if (blackoutAlpha <= 0) {
        blackoutAlpha = 0;
        blackoutPhase = 0;
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

    if (explosion) {
      explosion.t += dt;
      for (const w of explosion.waves) {
        w.r += w.speed * dt;
        w.alpha -= w.decay * dt;
      }
      explosion.waves = explosion.waves.filter((w) => w.alpha > 0);
      if (explosion.t > explosion.duration) explosion = null;
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

    if (blobs.length > 3) {
      const avgX = blobs.reduce((a, b) => a + b.x, 0) / blobs.length;
      const avgY = blobs.reduce((a, b) => a + b.y, 0) / blobs.length;
      const maxDist = Math.max(
        ...blobs.map((b) => Math.hypot(b.x - avgX, b.y - avgY))
      );
      if (maxDist < 80) {
        blobs = [];
        startExplosion(avgX, avgY);
      }
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
    window.liquidRAF = requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initLiquidBackground);
} else {
  initLiquidBackground();
  try {
    window.liquidBgCanvas = canvas;
    window.liquidCtx = ctx;
  } catch (e) {
    console.warn("Could not expose liquid background context:", e);
  }
}
