/* ============================================================
   main.js - arranque. Crea las piezas, las conecta y lanza el
   unico game loop. Todo ocurre dentro de index.html.
   ============================================================ */
(function (VW) {
  'use strict';

  function boot() {
    const canvas = document.getElementById('game-canvas');
    const input = new VW.Input();
    const audio = new VW.AudioFX();

    let game = null;

    /* Se detecta el tactil ANTES de construir el juego: asi la calidad
       de render y el DPR ya estan ajustados en el primer nivel. */
    const touch = new VW.TouchControls(input);

    const ui = new VW.UI({
      onStart: () => { audio.unlock(); game.startRun(); },
      onRetry: () => { audio.unlock(); game.restartLevel(); },
      onResume: () => { game.togglePause(false); },
      onAgain: () => { audio.unlock(); game.startRun(); }
    });

    game = new VW.Game(canvas, input, audio, ui);

    /* El audio necesita un gesto real del usuario para iniciarse. */
    input.onFirstKey = () => audio.unlock();

    /* Un solo observador de tamano para toda la sesion. ResizeObserver
       cubre tambien el caso de un contenedor que aun no tenia medidas
       (por ejemplo si el canvas se muestra despues de cargar). */
    if (window.ResizeObserver) {
      new ResizeObserver(() => game.resize()).observe(canvas);
    }
    window.addEventListener('resize', () => game.resize());

    /* Al perder el foco se pausa: nadie muere mirando otra ventana. */
    window.addEventListener('blur', () => game.togglePause(true));

    game.start();

    /* Punto de inspeccion para depuracion manual desde la consola. */
    VW.instance = game;
    VW.touch = touch;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window.VW);
