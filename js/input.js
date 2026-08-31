/* ============================================================
   input.js - gestor de teclado.
   Una sola pareja de listeners para toda la vida de la pagina:
   nunca se duplican al reiniciar niveles ni al cambiar de nivel.
   ============================================================ */
(function (VW) {
  'use strict';

  const BLOCKED = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'];

  class Input {
    constructor() {
      this.held = new Set();    /* teclas mantenidas */
      this.pressed = new Set(); /* pulsaciones pendientes de consumir */
      this.onFirstKey = null;   /* callback unico para desbloquear el audio */

      this._onDown = (e) => {
        if (BLOCKED.indexOf(e.code) !== -1) e.preventDefault();
        if (e.repeat) return;
        this.held.add(e.code);
        this.pressed.add(e.code);
        if (this.onFirstKey) { this.onFirstKey(); this.onFirstKey = null; }
      };
      this._onUp = (e) => { this.held.delete(e.code); };
      /* Al perder el foco se sueltan todas las teclas: evita que el
         gusano siga moviendose solo al volver a la ventana. */
      this._onBlur = () => { this.held.clear(); this.pressed.clear(); };

      window.addEventListener('keydown', this._onDown, { passive: false });
      window.addEventListener('keyup', this._onUp);
      window.addEventListener('blur', this._onBlur);
    }

    down(code) { return this.held.has(code); }

    /* Devuelve true una unica vez por pulsacion fisica. */
    consume(code) {
      if (!this.pressed.has(code)) return false;
      this.pressed.delete(code);
      return true;
    }

    consumeAny(codes) {
      let any = false;
      for (let i = 0; i < codes.length; i++) {
        if (this.consume(codes[i])) any = true;
      }
      return any;
    }

    /* Se llama al final de cada frame del game loop. */
    endFrame() { this.pressed.clear(); }

    dispose() {
      window.removeEventListener('keydown', this._onDown);
      window.removeEventListener('keyup', this._onUp);
      window.removeEventListener('blur', this._onBlur);
      this.held.clear();
      this.pressed.clear();
    }
  }

  VW.Input = Input;
})(window.VW);
