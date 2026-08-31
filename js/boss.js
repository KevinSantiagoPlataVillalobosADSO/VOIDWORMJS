/* ============================================================
   boss.js - el depredador del vacio.
   Dos comportamientos obligatorios:
     CHASE  -> persigue al jugador (estado normal)
     FLEE   -> huye del jugador (mientras Rage Mode este activo)
   Al inicio de cada nivel se materializa (SPAWN): durante ese
   breve periodo no persigue ni puede matar.
   ============================================================ */
(function (VW) {
  'use strict';

  const U = VW.U;

  const STATE = { SPAWN: 'SPAWN', CHASE: 'CHASE', FLEE: 'FLEE', DEVOURED: 'DEVOURED' };
  const SPAWN_TIME = 2.0;

  class Boss {
    constructor() {
      this.reset(0, 0, { bossSpeed: 250, bossFleeSpeed: 240 }, { w: 1000, h: 1000 });
    }

    reset(x, y, level, world) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.world = world;
      this.r = 26;
      this.chaseSpeed = level.bossSpeed;
      this.fleeSpeed = level.bossFleeSpeed;
      this.turnRate = level.bossTurn || 2.6;
      this.state = STATE.SPAWN;
      this.spawnT = 0;
      this.time = 0;
      this.scare = 0;      /* 0..1, mezcla visual de panico */
      this.alpha = 0;      /* aparicion progresiva */
      this.devourT = 0;
    }

    get isThreat() { return this.state === STATE.CHASE; }
    get isFleeing() { return this.state === STATE.FLEE; }
    get devoured() { return this.state === STATE.DEVOURED; }

    /* Cambio de rol pedido por Rage Mode. */
    setRage(rageActive) {
      if (this.state === STATE.DEVOURED) return;
      if (this.state === STATE.SPAWN) return;
      this.state = rageActive ? STATE.FLEE : STATE.CHASE;
    }

    devour() {
      this.state = STATE.DEVOURED;
      this.devourT = 0;
      this.vx = this.vy = 0;
    }

    update(dt, player, rageActive) {
      this.time += dt;

      if (this.state === STATE.DEVOURED) {
        this.devourT += dt;
        this.alpha = U.damp(this.alpha, 0, 6, dt);
        return;
      }

      this.alpha = U.damp(this.alpha, 1, 3, dt);

      if (this.state === STATE.SPAWN) {
        this.spawnT += dt;
        if (this.spawnT >= SPAWN_TIME) {
          this.state = rageActive ? STATE.FLEE : STATE.CHASE;
        }
        return;
      }

      this.scare = U.damp(this.scare, this.isFleeing ? 1 : 0, 5, dt);

      let tx = 0, ty = 0, speed;

      if (this.state === STATE.CHASE) {
        /* Persecucion con anticipacion: apunta a donde estara el jugador. */
        const px = player.x + player.vx * 0.32;
        const py = player.y + player.vy * 0.32;
        const dx = px - this.x, dy = py - this.y;
        const d = Math.hypot(dx, dy) || 1;
        speed = this.chaseSpeed;
        tx = (dx / d) * speed;
        ty = (dy / d) * speed;
      } else {
        /* Huida: se aleja del jugador y se despega de los muros para
           no quedar atrapado en una esquina de forma trivial. */
        const dx = this.x - player.x, dy = this.y - player.y;
        const d = Math.hypot(dx, dy) || 1;
        let ax = dx / d, ay = dy / d;

        const margin = 260;
        const w = this.world.w, h = this.world.h;
        if (this.x < margin) ax += (1 - this.x / margin) * 1.5;
        if (this.x > w - margin) ax -= (1 - (w - this.x) / margin) * 1.5;
        if (this.y < margin) ay += (1 - this.y / margin) * 1.5;
        if (this.y > h - margin) ay -= (1 - (h - this.y) / margin) * 1.5;

        const al = Math.hypot(ax, ay) || 1;
        speed = this.fleeSpeed;
        tx = (ax / al) * speed;
        ty = (ay / al) * speed;
      }

      /* Inercia: el jefe no gira instantaneamente, por lo que siempre
         existe una ventana para escapar (o para cazarlo en Rage). */
      const rate = this.isFleeing ? this.turnRate * 1.25 : this.turnRate;
      this.vx = U.damp(this.vx, tx, rate, dt);
      this.vy = U.damp(this.vy, ty, rate, dt);

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      const m = this.r;
      if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx) * 0.4; }
      if (this.y < m) { this.y = m; this.vy = Math.abs(this.vy) * 0.4; }
      if (this.x > this.world.w - m) { this.x = this.world.w - m; this.vx = -Math.abs(this.vx) * 0.4; }
      if (this.y > this.world.h - m) { this.y = this.world.h - m; this.vy = -Math.abs(this.vy) * 0.4; }
    }

    /* Radio efectivo para colisiones (mas pequeno que el visual: se
       siente justo y evita muertes que parecen injustas). */
    get hitR() { return this.r * 0.62; }

    draw(ctx, cam) {
      if (this.state === STATE.DEVOURED && this.alpha < 0.02) return;

      const sx = this.x - cam.x;
      const sy = this.y - cam.y;
      const pad = 160;
      if (sx < -pad || sy < -pad || sx > cam.w + pad || sy > cam.h + pad) return;

      const t = this.time;
      const scare = this.scare;
      const r = this.r * (1 - scare * 0.12);
      const a = this.alpha;

      /* Aura: rojo amenazante en persecucion, azul palido al huir. */
      const auraHue = U.lerp(352, 195, scare);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 1 + 0.08 * Math.sin(t * (this.isFleeing ? 11 : 3.4));
      U.drawGlow(ctx, U.hsl(auraHue, 95, 55, 1), sx, sy, r * 3.4 * pulse, 0.34 * a);
      ctx.restore();

      /* Tentaculos */
      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalAlpha = a;
      const arms = 9;
      ctx.strokeStyle = U.hsl(auraHue, 80, 42, 0.75);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < arms; i++) {
        const base = (i / arms) * U.TAU + t * (this.isFleeing ? -0.5 : 0.35);
        const wig = Math.sin(t * 4 + i * 1.7) * 0.5;
        const len = r * (1.5 + 0.45 * Math.sin(t * 3 + i));
        ctx.beginPath();
        ctx.moveTo(Math.cos(base) * r * 0.8, Math.sin(base) * r * 0.8);
        ctx.quadraticCurveTo(
          Math.cos(base + wig * 0.5) * len * 0.8, Math.sin(base + wig * 0.5) * len * 0.8,
          Math.cos(base + wig) * len, Math.sin(base + wig) * len
        );
        ctx.stroke();
      }

      /* Masa central: borde irregular que respira. */
      ctx.beginPath();
      const steps = 26;
      for (let i = 0; i <= steps; i++) {
        const ang = (i / steps) * U.TAU;
        const n = 1
          + 0.10 * Math.sin(ang * 3 + t * 2.2)
          + 0.07 * Math.sin(ang * 5 - t * 3.1);
        const rr = r * n;
        const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.1);
      grd.addColorStop(0, U.hsl(auraHue, 40, 12, 1));
      grd.addColorStop(0.65, '#0a0410');
      grd.addColorStop(1, U.hsl(auraHue, 70, 22, 1));
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.strokeStyle = U.hsl(auraHue, 95, 62, 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();

      /* Ojo: enorme al cazar, diminuto al huir. */
      const eyeR = r * U.lerp(0.42, 0.16, scare);
      const look = Math.atan2(this.vy, this.vx);
      const ex = Math.cos(look) * r * 0.12, ey = Math.sin(look) * r * 0.12;
      ctx.globalCompositeOperation = 'lighter';
      U.drawGlow(ctx, U.hsl(auraHue, 100, 62, 1), ex, ey, eyeR * 2.4, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#150009';
      ctx.beginPath();
      ctx.arc(ex + Math.cos(look) * eyeR * 0.35, ey + Math.sin(look) * eyeR * 0.35, eyeR * 0.5, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      /* Aviso de materializacion al empezar el nivel. */
      if (this.state === STATE.SPAWN) {
        const k = 1 - this.spawnT / SPAWN_TIME;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,75,92,' + (0.25 + 0.45 * k) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, r + 40 + k * 120, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  Boss.STATE = STATE;
  VW.Boss = Boss;
})(window.VW);
