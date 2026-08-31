/* ============================================================
   boss.js - los depredadores del vacio.

   Tres jefes distintos a lo largo de la campana:
     kind 1  EL DEVORADOR   -> niveles I y II (mas grande en el II)
     kind 2  EL SEGADOR     -> niveles III y IV (mas grande en el IV)
     kind 3  EL MONARCA     -> nivel V, aguanta varios golpes de Rage

   Comportamientos obligatorios (iguales para los tres):
     CHASE  -> persigue al jugador (estado normal)
     FLEE   -> huye del jugador (mientras Rage Mode este activo)
   Ademas:
     SPAWN  -> se materializa al empezar el nivel; no persigue ni mata
     REEL   -> aturdido tras recibir un golpe; no persigue ni mata
   ============================================================ */
(function (VW) {
  'use strict';

  const U = VW.U;

  const STATE = {
    SPAWN: 'SPAWN',
    CHASE: 'CHASE',
    FLEE: 'FLEE',
    REEL: 'REEL',
    DEVOURED: 'DEVOURED'
  };

  const SPAWN_TIME = 2.0;
  const REEL_TIME = 1.6;     /* aturdimiento tras un golpe */
  const KNOCKBACK = 900;     /* px/s de retroceso al ser golpeado */

  /* Identidad visual de cada jefe. */
  const KINDS = {
    1: { name: 'EL DEVORADOR', hue: 352, arms: 9, spikes: 0, eyes: 1, armLen: 1.50, halo: false },
    2: { name: 'EL SEGADOR', hue: 288, arms: 13, spikes: 7, eyes: 2, armLen: 1.75, halo: false },
    3: { name: 'EL MONARCA DEL VACIO', hue: 22, arms: 17, spikes: 11, eyes: 3, armLen: 1.95, halo: true }
  };

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

      this.kind = level.bossKind || 1;
      this.def = KINDS[this.kind];
      this.r = level.bossRadius || 26;
      this.maxHits = level.bossHits || 1;
      this.hits = this.maxHits;

      this.chaseSpeed = level.bossSpeed;
      this.fleeSpeed = level.bossFleeSpeed;
      this.turnRate = level.bossTurn || 2.6;

      this.state = STATE.SPAWN;
      this.spawnT = 0;
      this.reelT = 0;
      this.time = 0;
      this.scare = 0;      /* 0..1, mezcla visual de panico */
      this.alpha = 0;      /* aparicion progresiva */
      this.hitFlash = 0;
      this.devourT = 0;
    }

    get name() { return this.def.name; }
    get isThreat() { return this.state === STATE.CHASE; }
    get isFleeing() { return this.state === STATE.FLEE; }
    get devoured() { return this.state === STATE.DEVOURED; }
    get reeling() { return this.state === STATE.REEL; }

    /* Radio efectivo para matar al jugador: mas pequeno que el visual,
       para que las muertes no se sientan injustas. */
    get hitR() { return this.r * 0.62; }

    /* Cambio de rol pedido por Rage Mode. */
    setRage(rageActive) {
      if (this.state === STATE.DEVOURED) return;
      if (this.state === STATE.SPAWN || this.state === STATE.REEL) return;
      this.state = rageActive ? STATE.FLEE : STATE.CHASE;
    }

    /* Golpe del gusano durante Rage Mode.
       Devuelve 'dead', 'hurt' o 'ignored'. */
    takeHit(px, py) {
      if (this.state === STATE.DEVOURED || this.state === STATE.REEL) return 'ignored';

      this.hits--;
      this.hitFlash = 1;

      if (this.hits <= 0) {
        this.devour();
        return 'dead';
      }

      /* Sobrevive: sale despedido y queda aturdido. Mientras se recupera
         no puede matar, asi que el jugador tiene tiempo de alejarse
         cuando su Rage Mode se apague. */
      const dx = this.x - px, dy = this.y - py;
      const d = Math.hypot(dx, dy) || 1;
      this.vx = (dx / d) * KNOCKBACK;
      this.vy = (dy / d) * KNOCKBACK;
      this.reelT = REEL_TIME;
      this.state = STATE.REEL;
      return 'hurt';
    }

    devour() {
      this.state = STATE.DEVOURED;
      this.hits = 0;
      this.devourT = 0;
      this.vx = this.vy = 0;
    }

    update(dt, player, rageActive) {
      this.time += dt;
      this.hitFlash = U.damp(this.hitFlash, 0, 6, dt);

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

      if (this.state === STATE.REEL) {
        this.reelT -= dt;
        /* Deriva con rozamiento, sin voluntad propia. */
        const drag = Math.exp(-2.4 * dt);
        this.vx *= drag;
        this.vy *= drag;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this._clampToWorld();
        if (this.reelT <= 0) this.state = rageActive ? STATE.FLEE : STATE.CHASE;
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
      this._clampToWorld();
    }

    _clampToWorld() {
      const m = this.r;
      if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx) * 0.4; }
      if (this.y < m) { this.y = m; this.vy = Math.abs(this.vy) * 0.4; }
      if (this.x > this.world.w - m) { this.x = this.world.w - m; this.vx = -Math.abs(this.vx) * 0.4; }
      if (this.y > this.world.h - m) { this.y = this.world.h - m; this.vy = -Math.abs(this.vy) * 0.4; }
    }

    draw(ctx, cam) {
      if (this.state === STATE.DEVOURED && this.alpha < 0.02) return;

      const sx = this.x - cam.x;
      const sy = this.y - cam.y;
      const pad = this.r * 4;
      if (sx < -pad || sy < -pad || sx > cam.w + pad || sy > cam.h + pad) return;

      const def = this.def;
      const t = this.time;
      const scare = this.scare;
      const reel = this.state === STATE.REEL;
      const a = this.alpha;
      /* Se encoge al huir y tiembla mientras esta aturdido. */
      const r = this.r * (1 - scare * 0.12) * (reel ? 1 - 0.08 * Math.abs(Math.sin(t * 22)) : 1);

      /* Aura: color propio del jefe al cazar, azul palido al huir. */
      const auraHue = U.lerp(def.hue, 195, scare);
      const wounded = 1 - (this.hits - 1) / Math.max(1, this.maxHits - 1); /* 0 intacto, 1 al limite */

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 1 + 0.08 * Math.sin(t * (this.isFleeing ? 11 : 3.4));
      U.drawGlow(ctx, U.hsl(auraHue, 95, 55, 1), sx, sy, r * 3.4 * pulse, 0.34 * a);
      if (this.hitFlash > 0.01) {
        U.drawGlow(ctx, '#ffffff', sx, sy, r * 4.2, this.hitFlash * 0.55);
      }
      ctx.restore();

      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalAlpha = a;

      /* Halo del jefe final */
      if (def.halo) {
        ctx.save();
        ctx.rotate(t * 0.35);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.hsl(auraHue, 100, 62, 0.5);
        ctx.lineWidth = 3;
        ctx.setLineDash([18, 14]);
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.7, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }

      /* Tentaculos */
      const arms = def.arms;
      ctx.strokeStyle = U.hsl(auraHue, 80, 42, 0.75);
      ctx.lineWidth = Math.max(2, r * 0.11);
      ctx.lineCap = 'round';
      for (let i = 0; i < arms; i++) {
        const base = (i / arms) * U.TAU + t * (this.isFleeing ? -0.5 : 0.35);
        const wig = Math.sin(t * 4 + i * 1.7) * 0.5;
        const len = r * (def.armLen + 0.45 * Math.sin(t * 3 + i));
        ctx.beginPath();
        ctx.moveTo(Math.cos(base) * r * 0.8, Math.sin(base) * r * 0.8);
        ctx.quadraticCurveTo(
          Math.cos(base + wig * 0.5) * len * 0.8, Math.sin(base + wig * 0.5) * len * 0.8,
          Math.cos(base + wig) * len, Math.sin(base + wig) * len
        );
        ctx.stroke();
      }

      /* Corona de puas (jefes 2 y 3) */
      if (def.spikes) {
        ctx.beginPath();
        const n = def.spikes * 2;
        for (let i = 0; i <= n; i++) {
          const ang = (i / n) * U.TAU + t * 0.5;
          const rr = (i % 2 === 0) ? r * 1.42 : r * 0.95;
          const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = U.hsl(auraHue, 70, 16, 0.85);
        ctx.fill();
        ctx.strokeStyle = U.hsl(auraHue, 90, 55, 0.75);
        ctx.lineWidth = 1.5;
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

      /* Grietas: cuanto mas danado, mas visibles. */
      if (this.maxHits > 1 && wounded > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.hsl(48, 100, 70, 0.75 * wounded);
        ctx.lineWidth = 2;
        const cracks = 3;
        for (let i = 0; i < cracks; i++) {
          const ang = (i / cracks) * U.TAU + 0.6;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * r * 0.55, Math.sin(ang) * r * 0.55);
          ctx.lineTo(Math.cos(ang + 0.5) * r * 0.95, Math.sin(ang + 0.5) * r * 0.95);
          ctx.stroke();
        }
        ctx.restore();
      }

      /* Ojos: grandes al cazar, diminutos al huir. */
      const look = Math.atan2(this.vy, this.vx);
      const eyeR = r * U.lerp(0.40, 0.15, scare) / (def.eyes > 1 ? 1.7 : 1);
      const spread = r * 0.34;
      const eyes = [];
      if (def.eyes === 1) eyes.push([0, 0]);
      else if (def.eyes === 2) eyes.push([0, -spread], [0, spread]);
      else eyes.push([spread * 0.5, -spread], [spread * 0.5, spread], [-spread * 0.8, 0]);

      for (let i = 0; i < eyes.length; i++) {
        const ex = eyes[i][0] + Math.cos(look) * r * 0.10;
        const ey = eyes[i][1] + Math.sin(look) * r * 0.10;
        ctx.globalCompositeOperation = 'lighter';
        U.drawGlow(ctx, U.hsl(auraHue, 100, 62, 1), ex, ey, eyeR * 2.4, 0.7);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = reel ? '#c8d4e6' : '#fff';
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = '#150009';
        ctx.beginPath();
        ctx.arc(ex + Math.cos(look) * eyeR * 0.35, ey + Math.sin(look) * eyeR * 0.35, eyeR * 0.5, 0, U.TAU);
        ctx.fill();
      }
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
  Boss.KINDS = KINDS;
  VW.Boss = Boss;
})(window.VW);
