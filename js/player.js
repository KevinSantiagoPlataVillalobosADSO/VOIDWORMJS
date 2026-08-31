/* ============================================================
   player.js - el gusano galactico.
   Movimiento continuo con teclas direccionales, independiente
   de los FPS (aceleracion exponencial con deltaTime).
   El cuerpo sigue el rastro de posiciones de la cabeza usando
   un buffer de puntos reutilizados (cero asignaciones por frame).
   ============================================================ */
(function (VW) {
  'use strict';

  const U = VW.U;

  const PATH_MAX = 260;     /* puntos del rastro */
  const PATH_STEP = 4.5;    /* distancia entre puntos, px */
  const SEG_POINTS = 2;     /* puntos entre segmentos del cuerpo */
  const ACCEL = 11;         /* respuesta del control */
  const BRAKE = 9;          /* frenado al soltar teclas */

  class Worm {
    constructor() {
      this.path = new Array(PATH_MAX);
      for (let i = 0; i < PATH_MAX; i++) this.path[i] = { x: 0, y: 0 };
      this.baseSpeed = 300;
      this.rageActive = false;
      this.reset(0, 0, { playerSpeed: 300 }, { w: 1000, h: 1000 });
    }

    reset(x, y, level, world) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;
      this.world = world;
      this.baseSpeed = level.playerSpeed;
      this.rageActive = false;

      this.headR = 14;
      this.segMin = 18;
      this.segMax = 44;
      this.segCount = this.segMin;
      this.growth = 0;       /* 0..1, ligado al progreso del nivel */

      this._acc = 0;
      this._trailAcc = 0;
      this.time = 0;
      this.hue = 186;

      /* El rastro arranca estirado hacia la izquierda para que el
         gusano tenga forma de gusano desde el primer frame. */
      for (let i = 0; i < PATH_MAX; i++) {
        this.path[i].x = x - i * PATH_STEP;
        this.path[i].y = y;
      }
    }

    /* Velocidad efectiva: en Rage Mode exactamente +20 %, nunca acumulativo. */
    get speed() {
      return this.baseSpeed * (this.rageActive ? VW.RAGE.SPEED_MULT : 1);
    }

    get bodyLength() { return this.segCount * SEG_POINTS * PATH_STEP; }

    /* El gusano crece con el progreso del nivel (feedback de "eat to win"). */
    setGrowth(t) {
      this.growth = U.clamp(t, 0, 1);
      this.segCount = Math.round(U.lerp(this.segMin, this.segMax, this.growth));
      this.headR = U.lerp(14, 18, this.growth);
    }

    setRage(active) { this.rageActive = active; }

    update(dt, input, particles) {
      this.time += dt;

      /* --- Entrada: teclas direccionales (o joystick tactil, que
             entrega los mismos 8 vectores) --- */
      const ax = input.axis();
      const ix = ax.x, iy = ax.y;

      const len = Math.hypot(ix, iy);
      const sp = this.speed;
      let tvx = 0, tvy = 0;
      if (len > 0) {
        tvx = (ix / len) * sp;
        tvy = (iy / len) * sp;
      }

      const rate = (len > 0) ? ACCEL : BRAKE;
      this.vx = U.damp(this.vx, tvx, rate, dt);
      this.vy = U.damp(this.vy, tvy, rate, dt);

      /* --- Integracion y limites del mundo --- */
      const px = this.x, py = this.y;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      const m = this.headR;
      if (this.x < m) { this.x = m; this.vx = 0; }
      if (this.y < m) { this.y = m; this.vy = 0; }
      if (this.x > this.world.w - m) { this.x = this.world.w - m; this.vx = 0; }
      if (this.y > this.world.h - m) { this.y = this.world.h - m; this.vy = 0; }

      const moved = U.dist(px, py, this.x, this.y);
      if (moved > 0.0001) this.angle = Math.atan2(this.vy, this.vx);

      /* --- Rastro de puntos del cuerpo --- */
      this._acc += moved;
      let guard = 0;
      while (this._acc >= PATH_STEP && guard++ < 40) {
        this._acc -= PATH_STEP;
        const p = this.path.pop();
        p.x = this.x;
        p.y = this.y;
        this.path.unshift(p);
      }

      /* --- Particulas: solo en Rage Mode hay rastro luminoso --- */
      if (this.rageActive && particles) {
        this._trailAcc += dt;
        const interval = VW.QUALITY.trail;
        let n = 0;
        while (this._trailAcc >= interval && n++ < 4) {
          this._trailAcc -= interval;
          /* Nacen en la cola, no en la cabeza: asi el rastro queda
             DETRAS del gusano y no se pierde dentro de su brillo. */
          const tail = this.path[Math.min(this.segCount * SEG_POINTS, PATH_MAX - 1)];
          particles.rageTrail(tail.x, tail.y, this.vx, this.vy, this.rageHue());
        }
      } else {
        this._trailAcc = 0;
      }
    }

    /* Ciclo de color de Rage Mode. */
    rageHue() { return (this.time * 210) % 360; }

    draw(ctx, cam, rageMix) {
      const path = this.path;
      const segs = this.segCount;
      const rage = this.rageActive;
      const baseHue = rage ? this.rageHue() : this.hue;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      /* Cuerpo de cola a cabeza para que la cabeza quede encima. */
      for (let i = segs; i >= 0; i--) {
        const idx = Math.min(i * SEG_POINTS, PATH_MAX - 1);
        const p = path[idx];
        const sx = p.x - cam.x;
        const sy = p.y - cam.y;
        const taper = 1 - (i / segs) * 0.6;
        const wob = 1 + 0.06 * Math.sin(this.time * 7 - i * 0.5);
        /* Radio minimo: la cola debe seguir siendo un cuerpo continuo,
           no una fila de puntos separados. */
        const r = Math.max(5, this.headR * taper * wob);

        if (rage) {
          const h = (baseHue + i * 7) % 360;
          U.drawGlow(ctx, U.hsl(h, 100, 62, 1), sx, sy, r * 3.1, 0.30);
          U.drawGlow(ctx, U.hsl(h, 100, 78, 1), sx, sy, r * 1.35, 0.60);
        } else {
          /* Estado normal: translucido, energetico, poco brillo. */
          const h = (this.hue + i * 1.6) % 360;
          U.drawGlow(ctx, U.hsl(h, 90, 60, 1), sx, sy, r * 2.4, 0.22);
          U.drawGlow(ctx, U.hsl(h + 12, 100, 84, 1), sx, sy, r * 1.1, 0.42);
        }
      }

      /* Cabeza */
      const hx = this.x - cam.x, hy = this.y - cam.y;
      const hr = this.headR;
      if (rage) {
        U.drawGlow(ctx, U.hsl(baseHue, 100, 70, 1), hx, hy, hr * 4.6, 0.35);
        U.drawGlow(ctx, '#ffffff', hx, hy, hr * 1.15, 0.75);
      } else {
        U.drawGlow(ctx, U.hsl(this.hue, 100, 72, 1), hx, hy, hr * 3.0, 0.34);
        U.drawGlow(ctx, '#dffcff', hx, hy, hr * 0.9, 0.7);
      }
      ctx.restore();

      /* Ojos: dan direccion y personalidad al gusano. */
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(this.angle);
      const eo = hr * 0.42;
      ctx.fillStyle = rage ? '#1a0010' : 'rgba(6,10,26,0.85)';
      ctx.beginPath(); ctx.arc(hr * 0.35, -eo, hr * 0.22, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(hr * 0.35, eo, hr * 0.22, 0, U.TAU); ctx.fill();
      ctx.restore();

      /* Aura de inmunidad mientras Rage esta activo. */
      if (rage) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.hsl(baseHue, 100, 75, 0.55);
        ctx.lineWidth = 2;
        const rr = hr * 2.6 + Math.sin(this.time * 8) * 3;
        ctx.beginPath();
        ctx.arc(hx, hy, rr, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  VW.Worm = Worm;
})(window.VW);
