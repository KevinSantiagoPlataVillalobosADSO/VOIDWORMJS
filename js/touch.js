/* ============================================================
   touch.js - controles en pantalla para dispositivos tactiles.

   Es una capa ADICIONAL: las teclas direccionales siguen siendo el
   control principal y nada de esto se activa en escritorio.
   El joystick ajusta la direccion a las mismas 8 que dan las
   flechas, de modo que la jugabilidad y la dificultad no cambian
   entre teclado y tactil.
   ============================================================ */
(function (VW) {
  'use strict';

  /* Las 8 direcciones exactas de las flechas (0 = derecha, en sentido
     horario porque el eje Y crece hacia abajo). */
  const DIRS = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1]
  ];

  const DEAD_ZONE = 14;   /* px antes de empezar a moverse */
  const MAX_R = 46;       /* recorrido maximo del pulgar desde el centro */
  const GRAB = 34;        /* margen extra alrededor de la base para agarrarla */

  /* Estados en los que un toque en la pantalla equivale a ENTER. */
  const CONFIRM_STATES = ['MENU', 'LEVEL_INTRO', 'LEVEL_COMPLETE', 'GAME_OVER', 'VICTORY'];

  function isTouchDevice() {
    return (navigator.maxTouchPoints || 0) > 0 ||
           (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
           ('ontouchstart' in window);
  }

  class TouchControls {
    constructor(input) {
      this.input = input;
      this.enabled = false;
      this.pointerId = null;
      this.ox = 0;
      this.oy = 0;

      if (isTouchDevice()) {
        this.enable();
      } else {
        /* Portatiles hibridos: se activa en cuanto haya un toque real. */
        this._firstTouch = () => this.enable();
        window.addEventListener('touchstart', this._firstTouch, { once: true, passive: true });
      }
    }

    enable() {
      if (this.enabled) return;
      this.enabled = true;
      document.body.classList.add('touch');

      /* Menos carga de render antes de que el juego construya el nivel. */
      VW.QUALITY.stars = 0.55;
      VW.QUALITY.trail = 0.03;
      VW.QUALITY.dprCap = 1.5;
      if (VW.instance) VW.instance.resize();

      this._wire();
      this._checkOrientation();
    }

    _wire() {
      this.stage = document.getElementById('stage');
      this.stick = document.getElementById('touch-stick');
      this.knob = document.getElementById('touch-knob');
      const rage = document.getElementById('touch-rage');
      const pause = document.getElementById('touch-pause');

      /* Joystick: cualquier punto del escenario sirve de base. */
      this._down = (e) => this._onDown(e);
      this._move = (e) => this._onMove(e);
      this._up = (e) => this._onUp(e);
      this.stage.addEventListener('pointerdown', this._down);
      this.stage.addEventListener('pointermove', this._move);
      this.stage.addEventListener('pointerup', this._up);
      this.stage.addEventListener('pointercancel', this._up);

      /* Botones: no simulan teclas, inyectan la pulsacion en el gestor
         de entrada (misma ruta que el teclado, un solo camino). */
      rage.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.input.press('Space');
      });
      pause.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.input.press('KeyP');
      });

      /* Orientacion: la persecucion necesita vista ancha. */
      this._orient = () => this._checkOrientation();
      window.addEventListener('orientationchange', this._orient);
      window.addEventListener('resize', this._orient);

      /* Sin zoom por gesto ni por doble toque en iOS. */
      document.addEventListener('gesturestart', (e) => e.preventDefault());
    }

    _isUiTarget(e) {
      const t = e.target;
      return !!(t && t.closest && t.closest('.btn, .touch-btn'));
    }

    /* Centro real de la base fija, en coordenadas de pantalla. */
    _center() {
      const b = this.stick.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 };
    }

    _onDown(e) {
      if (this._isUiTarget(e)) return;   /* botones HTML: los gestiona el DOM */

      const g = VW.instance;
      if (g && CONFIRM_STATES.indexOf(g.state) !== -1) {
        /* En pantallas de aviso, tocar equivale a ENTER. */
        this.input.press('Enter');
        return;
      }
      if (this.pointerId !== null) return;

      /* Joystick FIJO: solo responde si el toque cae sobre su base
         (con un margen generoso). Un toque en el resto de la pantalla
         no mueve al gusano, asi no hay gestos accidentales. */
      const c = this._center();
      if (Math.hypot(e.clientX - c.x, e.clientY - c.y) > c.r + GRAB) return;

      e.preventDefault();
      this.pointerId = e.pointerId;
      this.ox = c.x;
      this.oy = c.y;
      this.stick.classList.add('on');
      if (this.stage.setPointerCapture) {
        try { this.stage.setPointerCapture(e.pointerId); } catch (err) { /* ignorado */ }
      }
      this._apply(e.clientX, e.clientY);
    }

    _onMove(e) {
      if (e.pointerId !== this.pointerId) return;
      e.preventDefault();
      this._apply(e.clientX, e.clientY);
    }

    /* Traduce la posicion del pulgar a direccion. La base no se mueve:
       el pomo se limita al radio maximo y la direccion se mantiene
       aunque el dedo se salga de la base. */
    _apply(px, py) {
      const dx = px - this.ox;
      const dy = py - this.oy;
      const m = Math.hypot(dx, dy);

      const k = (m > MAX_R) ? MAX_R / m : 1;
      const kx = dx * k, ky = dy * k;
      this.knob.style.transform = 'translate(calc(-50% + ' + kx.toFixed(1) + 'px), calc(-50% + ' + ky.toFixed(1) + 'px))';

      if (m < DEAD_ZONE) {
        this.input.setVirtual(0, 0);
        return;
      }
      /* Ajuste a 8 direcciones: mismos vectores que las flechas. */
      const idx = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
      const d = DIRS[idx];
      this.input.setVirtual(d[0], d[1]);
    }

    _onUp(e) {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.input.setVirtual(0, 0);
      this.stick.classList.remove('on');
      this.knob.style.transform = 'translate(-50%,-50%)';   /* el pomo vuelve al centro */
    }

    _checkOrientation() {
      if (!this.enabled) return;
      const portrait = window.innerHeight > window.innerWidth;
      document.body.classList.toggle('portrait', portrait);
      if (portrait && VW.instance) VW.instance.togglePause(true);
    }
  }

  TouchControls.isTouchDevice = isTouchDevice;
  VW.TouchControls = TouchControls;
})(window.VW);
