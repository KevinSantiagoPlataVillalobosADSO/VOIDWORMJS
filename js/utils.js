/* ============================================================
   utils.js - helpers matematicos y cache de sprites de brillo
   ============================================================ */
window.VW = window.VW || {};

(function (VW) {
  'use strict';

  const TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Interpolacion independiente de FPS: converge igual con cualquier dt. */
  function damp(current, target, rate, dt) {
    return current + (target - current) * (1 - Math.exp(-rate * dt));
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  /* Colision circulo-circulo sin raiz cuadrada. */
  function hit(ax, ay, ar, bx, by, br) {
    const r = ar + br;
    return dist2(ax, ay, bx, by) <= r * r;
  }

  /* --------------------------------------------------------
     Sprites de brillo pre-renderizados.
     Crear un radial-gradient por particula o segmento en cada
     frame es caro; se cachean canvases pequenos por color y se
     blitean con drawImage, que es mucho mas rapido.
     -------------------------------------------------------- */
  const spriteCache = new Map();
  const SPRITE_SIZE = 64;

  function glowSprite(color) {
    let s = spriteCache.get(color);
    if (s) return s;

    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_SIZE;
    const g = c.getContext('2d');
    const h = SPRITE_SIZE / 2;
    const grd = g.createRadialGradient(h, h, 0, h, h, h);
    grd.addColorStop(0.00, color);
    grd.addColorStop(0.35, color);
    grd.addColorStop(1.00, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(h, h, h, 0, TAU);
    g.fill();

    /* Cota de seguridad: el ciclo de tonos de Rage genera muchos
       colores distintos, asi que la cache se recicla si crece. */
    if (spriteCache.size > 120) spriteCache.clear();
    spriteCache.set(color, c);
    return c;
  }

  /* Dibuja un sprite de brillo centrado en (x,y) con radio r. */
  function drawGlow(ctx, color, x, y, r, alpha) {
    const img = glowSprite(color);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  function hsl(h, s, l, a) {
    return 'hsla(' + (h | 0) + ',' + s + '%,' + l + '%,' + a + ')';
  }

  VW.U = {
    TAU: TAU,
    clamp: clamp,
    lerp: lerp,
    damp: damp,
    rand: rand,
    randInt: randInt,
    pick: pick,
    dist: dist,
    dist2: dist2,
    hit: hit,
    glowSprite: glowSprite,
    drawGlow: drawGlow,
    hsl: hsl
  };
})(window.VW);
