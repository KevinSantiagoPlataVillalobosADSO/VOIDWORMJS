/* ============================================================
   game.js - nucleo: maquina de estados, game loop y reglas.

   Un unico requestAnimationFrame gobierna todo el juego. No se
   usa setInterval ni temporizadores para la logica: Rage Mode,
   transiciones y retardos se resuelven con el tiempo transcurrido
   (deltaTime), por lo que nada sigue corriendo tras reiniciar.
   ============================================================ */
(function (VW) {
  'use strict';

  const U = VW.U;

  const STATE = {
    MENU: 'MENU',
    LEVEL_INTRO: 'LEVEL_INTRO',
    PLAYING: 'PLAYING',
    RAGE: 'RAGE',            /* Rage Mode: estado propio, no solo un efecto */
    PAUSED: 'PAUSED',
    LEVEL_COMPLETE: 'LEVEL_COMPLETE',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY'
  };

  const CONFIRM = ['Enter', 'Space', 'NumpadEnter'];
  const MAX_DT = 0.05;          /* 50 ms: evita saltos tras cambiar de pestana */
  const INTRO_TIME = 2.4;
  const DEATH_HOLD = 0.9;
  const COMPLETE_HOLD = 0.85;

  class Game {
    constructor(canvas, input, audio, ui) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.input = input;
      this.audio = audio;
      this.ui = ui;

      this.dpr = 1;
      this.cam = { x: 0, y: 0, w: canvas.clientWidth || 960, h: canvas.clientHeight || 540 };
      this.drawCam = { x: 0, y: 0, w: this.cam.w, h: this.cam.h };
      this.world = { w: 2400, h: 1700 };

      this.player = new VW.Worm();
      this.boss = new VW.Boss();
      this.particles = new VW.ParticleSystem();
      this.food = new VW.FoodManager(this.world);
      this.bg = new VW.Background();

      this.state = STATE.MENU;
      this.prevState = STATE.PLAYING;
      this.levelIndex = 0;
      this.level = VW.LEVELS[0];

      this.score = 0;
      this.scoreAtLevelStart = 0;
      this.progress = 0;      /* 0..100 */
      this.rageCharge = 0;    /* 0..100 */
      this.rage = { active: false, timeLeft: 0 };

      this.eaten = 0;
      this.shake = 0;
      this.flash = 0;
      this.holdT = 0;
      this.introT = 0;
      this.completeReason = '';

      this._raf = 0;
      this._last = 0;
      this._loop = this._loop.bind(this);

      this.resize();
      /* Se prepara el nivel I para que el menu tenga galaxia viva detras. */
      this.setupLevel(0);
      this.ui.showScreen('menu');
      this.ui.setPlaying(false);
    }

    /* ---------------- Canvas y camara ---------------- */

    resize() {
      const c = this.canvas;
      const w = c.clientWidth || window.innerWidth;
      const h = c.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cam.w = w;
      this.cam.h = h;
      this.drawCam.w = w;
      this.drawCam.h = h;
    }

    _clampCam() {
      const c = this.cam;
      if (this.world.w <= c.w) c.x = (this.world.w - c.w) / 2;
      else c.x = U.clamp(c.x, 0, this.world.w - c.w);
      if (this.world.h <= c.h) c.y = (this.world.h - c.h) / 2;
      else c.y = U.clamp(c.y, 0, this.world.h - c.h);
    }

    _followCam(dt, snap) {
      const tx = this.player.x - this.cam.w / 2;
      const ty = this.player.y - this.cam.h / 2;
      if (snap) {
        this.cam.x = tx;
        this.cam.y = ty;
      } else {
        this.cam.x = U.damp(this.cam.x, tx, 6.5, dt);
        this.cam.y = U.damp(this.cam.y, ty, 6.5, dt);
      }
      this._clampCam();
    }

    /* ---------------- Ciclo de vida de niveles ---------------- */

    setupLevel(index) {
      const L = VW.LEVELS[index];
      this.levelIndex = index;
      this.level = L;
      this.world.w = L.world.w;
      this.world.h = L.world.h;

      this.progress = 0;
      this.rageCharge = 0;
      this.eaten = 0;
      this.rage.active = false;
      this.rage.timeLeft = 0;
      this.shake = 0;
      this.flash = 0;

      /* Jugador al centro; jefe en una esquina aleatoria, lejos. */
      const px = this.world.w * 0.5;
      const py = this.world.h * 0.5;
      this.player.reset(px, py, L, this.world);
      this.player.setGrowth(0);
      this.player.setRage(false);

      const corner = U.randInt(0, 3);
      const bx = (corner === 0 || corner === 3) ? this.world.w * 0.12 : this.world.w * 0.88;
      const by = (corner === 0 || corner === 1) ? this.world.h * 0.12 : this.world.h * 0.88;
      this.boss.reset(bx, by, L, this.world);

      this.food.reset(L, this.world, [
        { x: px, y: py, d: 300 },
        { x: bx, y: by, d: 220 }
      ]);

      this.particles.clear();
      this.bg.build(this.world, L.palette);
      this.bg.dark = 0;

      this._followCam(0, true);

      this.ui.setLevelInfo(L);
      this.ui.setProgress(0);
      this.ui.setRage(0, 'idle', 0);
      this.ui.setScore(this.score);
      this.ui.setRageStyle(false);
    }

    /* Nueva partida completa desde el Nivel I. */
    startRun() {
      this.score = 0;
      this.scoreAtLevelStart = 0;
      this.setupLevel(0);
      this._enterIntro();
    }

    _enterIntro() {
      this.scoreAtLevelStart = this.score;
      this.state = STATE.LEVEL_INTRO;
      this.introT = INTRO_TIME;
      this.ui.levelIntro(this.level);
      this.ui.showScreen('level');
      this.ui.setPlaying(true);
    }

    _beginPlay() {
      this.state = STATE.PLAYING;
      this.ui.showScreen(null);
      this.ui.setPlaying(true);
    }

    /* Reinicia el nivel actual: todo vuelve a condiciones iniciales. */
    restartLevel() {
      this.score = this.scoreAtLevelStart;
      this.setupLevel(this.levelIndex);
      this._enterIntro();
    }

    nextLevel() {
      if (this.levelIndex + 1 >= VW.LEVEL_COUNT) {
        this._victory();
        return;
      }
      this.setupLevel(this.levelIndex + 1);
      this._enterIntro();
    }

    _victory() {
      this.state = STATE.VICTORY;
      this.rage.active = false;
      this.player.setRage(false);
      this.ui.setRageStyle(false);
      this.ui.victory(this.score);
      this.ui.showScreen('victory');
      this.ui.setPlaying(false);
      this.audio.victory();
    }

    _completeLevel(reason) {
      if (this.state === STATE.LEVEL_COMPLETE) return;
      this.completeReason = reason;
      this.state = STATE.LEVEL_COMPLETE;
      this.holdT = COMPLETE_HOLD;
      /* Rage se apaga limpiamente al terminar el nivel. */
      this._stopRage(true);
      this.ui.levelComplete(this.level, reason);
      this.audio.levelUp();
    }

    _gameOver() {
      if (this.state === STATE.GAME_OVER) return;
      this.state = STATE.GAME_OVER;
      this.holdT = DEATH_HOLD;
      this.shake = 22;
      this.particles.burst(this.player.x, this.player.y, 90, 350, 460, 1.1);
      this._stopRage(true);
      this.ui.gameOver(this.level);
      this.audio.death();
    }

    togglePause(force) {
      const playing = (this.state === STATE.PLAYING || this.state === STATE.RAGE);
      const wantPause = (force === undefined) ? playing : force;

      if (wantPause && playing) {
        this.prevState = this.state;
        this.state = STATE.PAUSED;
        this.ui.showScreen('pause');
      } else if (!wantPause && this.state === STATE.PAUSED) {
        this.state = this.prevState;
        this.ui.showScreen(null);
      }
    }

    /* ---------------- Rage Mode ---------------- */

    _startRage() {
      const R = VW.RAGE;
      this.rage.active = true;
      this.rage.timeLeft = R.DURATION;   /* siempre 15 s, no acumulable */
      this.state = STATE.RAGE;

      this.player.setRage(true);
      this.boss.setRage(true);

      this.ui.setRageStyle(true);
      this.flash = 1;
      this.shake = 14;
      this.particles.burst(this.player.x, this.player.y, 70, this.player.rageHue(), 420, 0.9);
      this.audio.rageOn();
    }

    /* silent = no reproducir el sonido de fin (cambio de nivel/muerte). */
    _stopRage(silent) {
      if (!this.rage.active) {
        this.rageCharge = 0;
        this.ui.setRageStyle(false);
        return;
      }
      this.rage.active = false;
      this.rage.timeLeft = 0;
      this.rageCharge = 0;               /* hay que volver a cargar la barra */

      this.player.setRage(false);        /* velocidad normal e inmunidad fuera */
      this.boss.setRage(false);          /* el jefe vuelve a perseguir */
      this.ui.setRageStyle(false);       /* fondo y HUD vuelven a la normalidad */

      if (this.state === STATE.RAGE) this.state = STATE.PLAYING;
      if (!silent) this.audio.rageOff();
    }

    get rageReady() { return !this.rage.active && this.rageCharge >= 100; }

    /* ---------------- Comer ---------------- */

    _eat(f) {
      const g = VW.levelGains(this.level);
      const mult = this.rage.active ? VW.RAGE.SCORE_MULT : 1;

      this.score += g.score * mult;
      this.progress = Math.min(100, this.progress + g.progress * mult);
      this.eaten++;

      /* Durante Rage la barra de rage funciona como cronometro:
         vuelve a cargarse con comida cuando Rage termina. */
      if (!this.rage.active) {
        const before = this.rageCharge;
        this.rageCharge = Math.min(100, this.rageCharge + g.rage);
        if (before < 100 && this.rageCharge >= 100) this.audio.ready();
      }

      this.player.setGrowth(this.progress / 100);

      const hue = this.rage.active ? this.player.rageHue() : this.food.hue;
      this.particles.burst(f.x, f.y, this.rage.active ? 16 : 10, hue, 200, 0.5);
      this.audio.eat(this.eaten % 6);

      /* El objeto se recoloca: pool de tamano fijo, sin crear basura. */
      this.food.place(f, [
        { x: this.player.x, y: this.player.y, d: 260 },
        { x: this.boss.x, y: this.boss.y, d: 170 }
      ]);

      if (this.progress >= 100) {
        this._completeLevel('Barra de progreso al 100 %');
      }
    }

    _checkFood() {
      const p = this.player;
      const items = this.food.items;
      const pr = p.headR * 0.95;
      for (let i = 0; i < items.length; i++) {
        const f = items[i];
        if (U.hit(p.x, p.y, pr, f.x, f.y, f.r)) {
          this._eat(f);
          if (this.state === STATE.LEVEL_COMPLETE) return;
        }
      }
    }

    _checkBoss() {
      const p = this.player;
      const b = this.boss;

      if (b.devoured) return;

      if (this.rage.active) {
        /* Solo en Rage Mode se puede devorar al jefe. */
        if (U.hit(p.x, p.y, p.headR + 4, b.x, b.y, b.r * 0.85)) {
          b.devour();
          this.shake = 26;
          this.flash = 0.8;
          this.particles.burst(b.x, b.y, 120, 300, 520, 1.2);
          this.particles.burst(b.x, b.y, 60, 190, 300, 1.4);
          this.audio.devour();
          this.score += 250;
          this._completeLevel('Jefe devorado en Rage Mode');
        }
        return;
      }

      /* Sin Rage el jugador es la presa. La inmunidad solo existe
         mientras Rage esta activo (aqui ya sabemos que no lo esta). */
      if (b.isThreat && U.hit(p.x, p.y, p.headR * 0.7, b.x, b.y, b.hitR)) {
        this._gameOver();
      }
    }

    /* ---------------- Entrada por estado ---------------- */

    _handleKeys() {
      const input = this.input;

      if (input.consume('KeyM')) this.audio.toggleMute();

      switch (this.state) {
        case STATE.MENU:
          if (input.consumeAny(CONFIRM)) this.startRun();
          break;

        case STATE.LEVEL_INTRO:
          if (input.consumeAny(CONFIRM)) this._beginPlay();
          break;

        case STATE.PLAYING:
        case STATE.RAGE:
          if (input.consume('KeyP') || input.consume('Escape')) {
            this.togglePause(true);
            break;
          }
          if (input.consume('Space') && this.rageReady) this._startRage();
          break;

        case STATE.PAUSED:
          if (input.consume('KeyP') || input.consume('Escape') || input.consumeAny(CONFIRM)) {
            this.togglePause(false);
          }
          break;

        case STATE.LEVEL_COMPLETE:
          if (this.holdT <= 0 && input.consumeAny(CONFIRM)) this.nextLevel();
          break;

        case STATE.GAME_OVER:
          if (this.holdT <= 0 && input.consumeAny(CONFIRM)) this.restartLevel();
          break;

        case STATE.VICTORY:
          if (input.consumeAny(CONFIRM)) this.startRun();
          break;
      }
    }

    /* ---------------- Update (orden del diseno) ---------------- */

    update(dt) {
      this._handleKeys();

      const playing = (this.state === STATE.PLAYING || this.state === STATE.RAGE);

      if (playing) {
        /* 1. jugador */
        this.player.update(dt, this.input, this.particles);
        /* 2. jefe */
        this.boss.update(dt, this.player, this.rage.active);
        /* 3. objetos */
        this.food.update(dt);
        /* 4. colisiones */
        this._checkFood();
        if (this.state === STATE.PLAYING || this.state === STATE.RAGE) this._checkBoss();
        /* 5. Rage Mode por tiempo transcurrido */
        if (this.rage.active) {
          this.rage.timeLeft -= dt;
          if (this.rage.timeLeft <= 0) this._stopRage(false);
        }
      } else if (this.state === STATE.MENU) {
        /* Menu: galaxia viva con deriva lenta de camara. */
        this.food.update(dt);
        this.cam.x += 14 * dt;
        this.cam.y += 6 * dt;
        this._clampCam();
      } else if (this.state === STATE.LEVEL_INTRO) {
        this.food.update(dt);
        this.introT -= dt;
        if (this.introT <= 0) this._beginPlay();
      } else if (this.state === STATE.LEVEL_COMPLETE || this.state === STATE.GAME_OVER) {
        this.food.update(dt);
        if (this.holdT > 0) {
          this.holdT -= dt;
          if (this.holdT <= 0) {
            this.ui.showScreen(this.state === STATE.GAME_OVER ? 'gameover' : 'complete');
          }
        }
      }

      /* 6. camara, particulas, fondo y efectos: siempre vivos salvo en pausa */
      if (this.state !== STATE.PAUSED) {
        if (playing) this._followCam(dt, false);
        this.particles.update(dt);
        this.bg.update(dt, this.rage.active);
        this.shake = U.damp(this.shake, 0, 7, dt);
        this.flash = U.damp(this.flash, 0, 6, dt);
      }

      /* 7. HUD */
      this.ui.setScore(this.score);
      this.ui.setProgress(this.progress);
      if (this.rage.active) {
        const pct = (this.rage.timeLeft / VW.RAGE.DURATION) * 100;
        this.ui.setRage(pct, 'active', Math.max(0, this.rage.timeLeft));
      } else {
        this.ui.setRage(this.rageCharge, this.rageCharge >= 100 ? 'ready' : 'idle', 0);
      }
    }

    /* ---------------- Render ---------------- */

    render() {
      const ctx = this.ctx;
      const cam = this.drawCam;

      /* Sacudida de pantalla aplicada solo al dibujar. */
      const s = this.shake;
      cam.x = this.cam.x + (s > 0.2 ? U.rand(-s, s) : 0);
      cam.y = this.cam.y + (s > 0.2 ? U.rand(-s, s) : 0);

      this.bg.draw(ctx, cam);
      this.bg.drawBounds(ctx, cam, this.bg.dark);
      this.food.draw(ctx, cam);
      this.particles.draw(ctx, cam);
      if (this.state !== STATE.MENU) this.boss.draw(ctx, cam);

      const dead = (this.state === STATE.GAME_OVER && this.holdT <= 0.35);
      if (this.state !== STATE.MENU && !dead) {
        this.player.draw(ctx, cam, this.bg.dark);
      }

      this._drawBossIndicator(ctx, cam);
      this._drawFlash(ctx);
    }

    /* Marcador en el borde de pantalla cuando el jefe esta fuera de vista:
       el mundo es mayor que la ventana y hay que saber por donde viene. */
    _drawBossIndicator(ctx, cam) {
      if (this.state === STATE.MENU || this.boss.devoured) return;
      const bx = this.boss.x - cam.x;
      const by = this.boss.y - cam.y;
      const m = 34;
      if (bx > m && by > m && bx < cam.w - m && by < cam.h - m) return;

      const cx = cam.w / 2, cy = cam.h / 2;
      const ang = Math.atan2(by - cy, bx - cx);
      const px = U.clamp(bx, m, cam.w - m);
      const py = U.clamp(by, m, cam.h - m);
      const fleeing = this.boss.isFleeing;

      const color = fleeing ? '#5ff5ff' : '#ff4b5c';
      U.drawGlow(ctx, color, px, py, 22, 0.35);   /* halo barato, sin shadowBlur */

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    _drawFlash(ctx) {
      if (this.flash <= 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,120,220,' + (this.flash * 0.35) + ')';
      ctx.fillRect(0, 0, this.cam.w, this.cam.h);
      ctx.restore();
    }

    /* ---------------- Game loop ---------------- */

    start() {
      if (this._raf) return;              /* nunca dos bucles a la vez */
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._loop);
    }

    stop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    _loop(now) {
      this._raf = requestAnimationFrame(this._loop);

      let dt = (now - this._last) / 1000;
      this._last = now;
      if (!isFinite(dt) || dt < 0) dt = 0;
      if (dt > MAX_DT) dt = MAX_DT;       /* estabilidad tras pestanas inactivas */

      this.update(dt);
      this.render();
      this.input.endFrame();
    }
  }

  Game.STATE = STATE;
  VW.Game = Game;
})(window.VW);
