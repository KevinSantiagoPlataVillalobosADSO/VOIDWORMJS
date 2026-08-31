/* ============================================================
   particles.js - sistema de particulas con pool fijo.
   No se crean ni destruyen objetos durante la partida: las
   particulas muertas se reciclan, de modo que no hay presion
   de GC ni acumulacion en memoria al reiniciar niveles.
   ============================================================ */
(function (VW) {
  'use strict';

  const U = VW.U;
  const MAX = 700;

  function makeParticle() {
    return {
      alive: false,
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1,
      r: 2, drag: 1.6,
      hue: 190, sat: 100, light: 65,
      additive: true
    };
  }

  class ParticleSystem {
    constructor() {
      this.pool = new Array(MAX);
      for (let i = 0; i < MAX; i++) this.pool[i] = makeParticle();
      this.cursor = 0;
      this.aliveCount = 0;
    }

    /* Devuelve una particula libre; si no hay, reutiliza la mas antigua
       recorriendo el pool en circulo (limite duro de particulas). */
    _acquire() {
      for (let i = 0; i < MAX; i++) {
        const p = this.pool[this.cursor];
        this.cursor = (this.cursor + 1) % MAX;
        if (!p.alive) return p;
      }
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX;
      return p;
    }

    spawn(o) {
      const p = this._acquire();
      p.alive = true;
      p.x = o.x; p.y = o.y;
      p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.maxLife = o.life || 0.6;
      p.life = p.maxLife;
      p.r = o.r || 3;
      p.drag = (o.drag === undefined) ? 1.6 : o.drag;
      p.hue = (o.hue === undefined) ? 190 : o.hue;
      p.sat = (o.sat === undefined) ? 100 : o.sat;
      p.light = (o.light === undefined) ? 65 : o.light;
      return p;
    }

    /* Rastro luminoso de Rage Mode: sale por detras del gusano. */
    rageTrail(x, y, vx, vy, hue) {
      const sp = 55;
      this.spawn({
        x: x + U.rand(-7, 7),
        y: y + U.rand(-7, 7),
        vx: -vx * 0.18 + U.rand(-sp, sp),
        vy: -vy * 0.18 + U.rand(-sp, sp),
        life: U.rand(0.5, 1.1),
        r: U.rand(4, 10),
        drag: 0.9,
        hue: hue + U.rand(-40, 40),
        light: U.rand(62, 84)
      });
    }

    /* Estallido al comer, al devorar al jefe o al morir. */
    burst(x, y, count, hue, power, life) {
      for (let i = 0; i < count; i++) {
        const a = U.rand(0, U.TAU);
        const s = U.rand(power * 0.3, power);
        this.spawn({
          x: x, y: y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: U.rand((life || 0.6) * 0.5, life || 0.6),
          r: U.rand(2, 6),
          drag: 2.0,
          hue: hue + U.rand(-25, 25),
          light: U.rand(58, 88)
        });
      }
    }

    update(dt) {
      let alive = 0;
      const pool = this.pool;
      for (let i = 0; i < MAX; i++) {
        const p = pool[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; continue; }
        const d = Math.exp(-p.drag * dt);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        alive++;
      }
      this.aliveCount = alive;
    }

    draw(ctx, cam) {
      if (this.aliveCount === 0) return;
      const pool = this.pool;
      const pad = 40;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < MAX; i++) {
        const p = pool[i];
        if (!p.alive) continue;
        const sx = p.x - cam.x, sy = p.y - cam.y;
        if (sx < -pad || sy < -pad || sx > cam.w + pad || sy > cam.h + pad) continue;
        const t = p.life / p.maxLife;
        const color = U.hsl(p.hue, p.sat, p.light, 1);
        U.drawGlow(ctx, color, sx, sy, p.r * (0.5 + t * 0.9), t * 0.85);
      }
      ctx.restore();
    }

    clear() {
      for (let i = 0; i < MAX; i++) this.pool[i].alive = false;
      this.aliveCount = 0;
      this.cursor = 0;
    }
  }

  VW.ParticleSystem = ParticleSystem;
})(window.VW);
