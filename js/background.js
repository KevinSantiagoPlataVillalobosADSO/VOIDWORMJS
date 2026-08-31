/* ============================================================
   background.js - galaxia con parallax y transicion a negro.
   La nebulosa se pre-renderiza una sola vez por nivel en un
   canvas fuera de pantalla (a baja resolucion) y se blitea:
   dibujar decenas de degradados radiales por frame seria caro.
   ============================================================ */
(function (VW) {
  'use strict';

  const U = VW.U;
  const NEB_SCALE = 0.22;   /* resolucion de la nebulosa respecto al mundo */
  const LAYERS = [
    { factor: 0.20, count: 260, min: 0.4, max: 1.1, alpha: 0.55 },
    { factor: 0.45, count: 150, min: 0.7, max: 1.7, alpha: 0.75 },
    { factor: 0.80, count: 70, min: 1.2, max: 2.4, alpha: 1.00 }
  ];

  class Background {
    constructor() {
      this.world = { w: 0, h: 0 };
      this.stars = [];
      this.neb = document.createElement('canvas');
      this.dark = 0;        /* 0 = galaxia, 1 = negro absoluto (Rage) */
      this.time = 0;
    }

    /* Reconstruye estrellas y nebulosa para el nivel dado. */
    build(world, palette) {
      this.world.w = world.w;
      this.world.h = world.h;
      this.stars.length = 0;

      for (let l = 0; l < LAYERS.length; l++) {
        const L = LAYERS[l];
        for (let i = 0; i < L.count; i++) {
          this.stars.push({
            x: U.rand(0, world.w),
            y: U.rand(0, world.h),
            r: U.rand(L.min, L.max),
            a: U.rand(0.35, 1) * L.alpha,
            tw: U.rand(0, U.TAU),
            f: L.factor
          });
        }
      }

      this._buildNebula(palette);
    }

    _buildNebula(palette) {
      const w = Math.max(64, Math.floor(this.world.w * NEB_SCALE));
      const h = Math.max(64, Math.floor(this.world.h * NEB_SCALE));
      this.neb.width = w;
      this.neb.height = h;
      const g = this.neb.getContext('2d');

      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';

      const blobs = 34;
      for (let i = 0; i < blobs; i++) {
        const cx = U.rand(0, w);
        const cy = U.rand(0, h);
        const rad = U.rand(w * 0.07, w * 0.26);
        const col = U.pick(palette);
        const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grd.addColorStop(0, col.replace('ALPHA', '0.15'));
        grd.addColorStop(0.45, col.replace('ALPHA', '0.05'));
        grd.addColorStop(1, col.replace('ALPHA', '0'));
        g.fillStyle = grd;
        g.beginPath();
        g.arc(cx, cy, rad, 0, U.TAU);
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }

    /* Blit del trozo de nebulosa que realmente entra en pantalla.
       P = factor de parallax. */
    _drawNebulaCrop(ctx, cam, P) {
      const nw = this.neb.width, nh = this.neb.height;
      const kx = this.world.w / nw;      /* px de mundo por px de nebulosa */
      const ky = this.world.h / nh;
      const ox = cam.x * P, oy = cam.y * P;

      let sx0 = ox / kx, sx1 = (ox + cam.w) / kx;
      let sy0 = oy / ky, sy1 = (oy + cam.h) / ky;
      sx0 = Math.max(0, sx0); sx1 = Math.min(nw, sx1);
      sy0 = Math.max(0, sy0); sy1 = Math.min(nh, sy1);
      if (sx1 <= sx0 || sy1 <= sy0) return;

      const dx = sx0 * kx - ox;
      const dy = sy0 * ky - oy;
      ctx.drawImage(
        this.neb,
        sx0, sy0, sx1 - sx0, sy1 - sy0,
        dx, dy, (sx1 - sx0) * kx, (sy1 - sy0) * ky
      );
    }

    /* rageActive controla el desvanecido de la galaxia hacia negro. */
    update(dt, rageActive) {
      this.time += dt;
      this.dark = U.damp(this.dark, rageActive ? 1 : 0, 3.2, dt);
      if (this.dark < 0.001) this.dark = 0;
      if (this.dark > 0.999) this.dark = 1;
    }

    draw(ctx, cam) {
      const vis = 1 - this.dark;

      /* Base negra. Se omite cuando el degradado de galaxia va a
         cubrirla por completo: un relleno de pantalla menos por frame. */
      if (vis < 0.999) {
        ctx.fillStyle = '#03020a';
        ctx.fillRect(0, 0, cam.w, cam.h);
      }

      if (vis > 0.01) {
        /* Tinte cosmico de fondo */
        ctx.save();
        ctx.globalAlpha = vis;
        const grd = ctx.createLinearGradient(0, 0, cam.w, cam.h);
        grd.addColorStop(0, '#070520');
        grd.addColorStop(0.5, '#0c0726');
        grd.addColorStop(1, '#040718');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, cam.w, cam.h);

        /* Nebulosa con parallax medio. Alpha bajo a proposito: el
           gusano y la comida deben destacar siempre sobre el fondo.
           Se blitea solo el recorte visible en lugar del mundo
           completo: menos pixeles que rellenar por frame. */
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = vis * 0.62;
        this._drawNebulaCrop(ctx, cam, 0.55);
        ctx.restore();
      }

      /* Estrellas: se atenuan con Rage pero no desaparecen del todo. */
      const starVis = 0.12 + vis * 0.88;
      if (starVis > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const t = this.time;
        const stars = this.stars;
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const sx = s.x - cam.x * s.f;
          const sy = s.y - cam.y * s.f;
          if (sx < -4 || sy < -4 || sx > cam.w + 4 || sy > cam.h + 4) continue;
          const tw = 0.75 + 0.25 * Math.sin(t * 2.1 + s.tw);
          ctx.globalAlpha = s.a * tw * starVis;
          ctx.fillStyle = '#dff1ff';
          if (s.r < 1.2) {
            ctx.fillRect(sx, sy, 1.4, 1.4);
          } else {
            ctx.beginPath();
            ctx.arc(sx, sy, s.r, 0, U.TAU);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    /* Limite del mundo: valla de energia visible para orientarse. */
    drawBounds(ctx, cam, rageMix) {
      const x = -cam.x, y = -cam.y;
      const w = this.world.w, h = this.world.h;
      const pulse = 0.35 + 0.15 * Math.sin(this.time * 2.4);
      const rgb = rageMix > 0.5 ? '255,79,216' : '95,245,255';
      ctx.save();
      /* Dos trazos en lugar de shadowBlur: mismo halo, coste muy menor
         (el desenfoque de sombra sobre un rectangulo enorme es caro). */
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 14;
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (pulse * 0.16) + ')';
      ctx.strokeRect(x, y, w, h);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(' + rgb + ',' + pulse + ')';
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }

  VW.Background = Background;
})(window.VW);
