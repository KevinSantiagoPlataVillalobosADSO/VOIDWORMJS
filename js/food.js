/* ============================================================
   food.js - objetos comestibles. Cinco tipos, uno por nivel:
   orb (bolitas de energia), moon (lunas pequenas),
   sun (soles pequenos), bolt (truenos pequenos), star (estrellas).
   El pool es de tamano fijo por nivel: al comer un objeto se
   reposiciona en lugar de crear uno nuevo.
   ============================================================ */
(function (VW) {
  'use strict';

  const U = VW.U;

  /* Definicion visual de cada tipo de comida. */
  const TYPES = {
    orb: {
      label: 'Bolitas de energia',
      hue: 165, radius: 9, glow: 2.6,
      draw: function (ctx, x, y, r, f, t) {
        const p = 1 + 0.12 * Math.sin(t * 4 + f.phase);
        U.drawGlow(ctx, 'hsla(168,100%,62%,1)', x, y, r * this.glow * p, 0.5);
        ctx.fillStyle = '#eafffb';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.52 * p, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = 'hsla(160,100%,75%,0.85)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.95 * p, 0, U.TAU);
        ctx.stroke();
      }
    },

    moon: {
      label: 'Lunas pequenas',
      hue: 220, radius: 11, glow: 2.0,
      draw: function (ctx, x, y, r, f, t) {
        U.drawGlow(ctx, 'hsla(215,60%,72%,1)', x, y, r * this.glow, 0.32);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(f.rot);
        ctx.fillStyle = '#d9e2f2';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, U.TAU);
        ctx.fill();
        /* crateres */
        ctx.fillStyle = 'rgba(120,134,165,0.55)';
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.25, r * 0.26, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.32, r * 0.1, r * 0.18, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.05, r * 0.45, r * 0.13, 0, U.TAU); ctx.fill();
        /* terminador lunar */
        ctx.fillStyle = 'rgba(10,14,30,0.42)';
        ctx.beginPath();
        ctx.arc(r * 0.45, -r * 0.1, r * 1.02, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }
    },

    sun: {
      label: 'Soles pequenos',
      hue: 32, radius: 10, glow: 3.0,
      draw: function (ctx, x, y, r, f, t) {
        const p = 1 + 0.1 * Math.sin(t * 6 + f.phase);
        U.drawGlow(ctx, 'hsla(30,100%,58%,1)', x, y, r * this.glow * p, 0.5);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(f.rot);
        ctx.strokeStyle = 'hsla(42,100%,68%,0.9)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * U.TAU;
          const i0 = r * 1.15, i1 = r * (1.7 + 0.2 * Math.sin(t * 5 + i));
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * i0, Math.sin(a) * i0);
          ctx.lineTo(Math.cos(a) * i1, Math.sin(a) * i1);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#fff3cf';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.72 * p, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = 'hsla(35,100%,60%,0.75)';
        ctx.beginPath();
        ctx.arc(x, y, r * p, 0, U.TAU);
        ctx.fill();
      }
    },

    bolt: {
      label: 'Truenos pequenos',
      hue: 55, radius: 11, glow: 2.6,
      draw: function (ctx, x, y, r, f, t) {
        const flick = 0.65 + 0.35 * Math.sin(t * 18 + f.phase);
        U.drawGlow(ctx, 'hsla(52,100%,65%,1)', x, y, r * this.glow, 0.35 + flick * 0.25);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(f.rot) * 0.25);
        ctx.beginPath();
        ctx.moveTo(-r * 0.28, -r);
        ctx.lineTo(r * 0.42, -r * 0.18);
        ctx.lineTo(r * 0.04, -r * 0.12);
        ctx.lineTo(r * 0.52, r * 1.0);
        ctx.lineTo(-r * 0.34, r * 0.16);
        ctx.lineTo(r * 0.02, r * 0.1);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,250,205,' + (0.75 + flick * 0.25) + ')';
        ctx.fill();
        ctx.strokeStyle = 'hsla(48,100%,72%,0.95)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }
    },

    star: {
      label: 'Estrellas',
      hue: 48, radius: 11, glow: 3.2,
      draw: function (ctx, x, y, r, f, t) {
        const p = 1 + 0.14 * Math.sin(t * 5 + f.phase);
        U.drawGlow(ctx, 'hsla(46,100%,70%,1)', x, y, r * this.glow * p, 0.45);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(f.rot);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * U.TAU - Math.PI / 2;
          const rr = (i % 2 === 0) ? r * 1.25 * p : r * 0.5 * p;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#fff8dc';
        ctx.fill();
        ctx.strokeStyle = 'hsla(44,100%,66%,0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  class FoodManager {
    constructor(world) {
      this.world = world;
      this.items = [];
      this.type = 'orb';
      this.def = TYPES.orb;
      this.time = 0;
    }

    /* (Re)genera todos los objetos del nivel. */
    reset(level, world, avoid) {
      this.world = world;
      this.type = level.food;
      this.def = TYPES[level.food];
      this.time = 0;
      this.items.length = 0;
      for (let i = 0; i < level.foodCount; i++) {
        this.items.push(this._make(avoid));
      }
    }

    _make(avoid) {
      const f = {
        x: 0, y: 0,
        r: this.def.radius,
        phase: U.rand(0, U.TAU),
        rot: U.rand(0, U.TAU),
        spin: U.rand(-0.9, 0.9),
        bobPhase: U.rand(0, U.TAU),
        eaten: false
      };
      this.place(f, avoid);
      return f;
    }

    /* Coloca el objeto en un punto aleatorio, evitando aparecer
       encima del jugador o del jefe. */
    place(f, avoid) {
      const m = 60;
      for (let tries = 0; tries < 24; tries++) {
        f.x = U.rand(m, this.world.w - m);
        f.y = U.rand(m, this.world.h - m);
        let ok = true;
        if (avoid) {
          for (let i = 0; i < avoid.length; i++) {
            const a = avoid[i];
            if (U.dist2(f.x, f.y, a.x, a.y) < a.d * a.d) { ok = false; break; }
          }
        }
        if (ok) return;
      }
    }

    update(dt) {
      this.time += dt;
      const items = this.items;
      for (let i = 0; i < items.length; i++) {
        items[i].rot += items[i].spin * dt;
      }
    }

    draw(ctx, cam) {
      const def = this.def;
      const t = this.time;
      const items = this.items;
      const pad = 40;
      ctx.save();
      for (let i = 0; i < items.length; i++) {
        const f = items[i];
        const sx = f.x - cam.x;
        const sy = f.y - cam.y + Math.sin(t * 1.6 + f.bobPhase) * 3;
        if (sx < -pad || sy < -pad || sx > cam.w + pad || sy > cam.h + pad) continue;
        def.draw(ctx, sx, sy, f.r, f, t);
      }
      ctx.restore();
    }

    get hue() { return this.def.hue; }
    get label() { return this.def.label; }
  }

  VW.FoodManager = FoodManager;
  VW.FOOD_TYPES = TYPES;
})(window.VW);
