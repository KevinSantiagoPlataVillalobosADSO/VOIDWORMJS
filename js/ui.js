/* ============================================================
   ui.js - unico punto de contacto con el DOM.
   El juego nunca toca elementos HTML directamente: solo pide
   cambios a esta capa. Cachea los valores para no escribir en
   el DOM en cada frame (evita reflows innecesarios).
   ============================================================ */
(function (VW) {
  'use strict';

  const $ = (id) => document.getElementById(id);

  class UI {
    constructor(handlers) {
      this.el = {
        body: document.body,
        level: $('hud-level'),
        food: $('hud-food'),
        score: $('hud-score'),
        progFill: $('bar-progress-fill'),
        progPct: $('bar-progress-pct'),
        rageBar: $('bar-rage'),
        rageFill: $('bar-rage-fill'),
        ragePct: $('bar-rage-pct'),
        rageHint: $('rage-hint'),
        touchRage: $('touch-rage'),
        bossHud: $('hud-boss'),
        bossPips: $('boss-pips'),
        levelNumeral: $('level-numeral'),
        levelBoss: $('level-boss'),
        levelTitle: $('level-title'),
        levelDesc: $('level-desc'),
        completeTitle: $('complete-title'),
        completeReason: $('complete-reason'),
        gameoverDesc: $('gameover-desc'),
        victoryScore: $('victory-score')
      };

      this.screens = {
        menu: $('screen-menu'),
        level: $('screen-level'),
        complete: $('screen-complete'),
        gameover: $('screen-gameover'),
        victory: $('screen-victory'),
        pause: $('screen-pause')
      };

      this.cache = {
        score: -1, prog: -1, rage: -1, rageState: '', screen: '',
        bossHits: -1, bossMax: -1
      };

      /* Listeners de botones: se registran una sola vez. */
      $('btn-start').addEventListener('click', handlers.onStart);
      $('btn-retry').addEventListener('click', handlers.onRetry);
      $('btn-resume').addEventListener('click', handlers.onResume);
      $('btn-again').addEventListener('click', handlers.onAgain);
    }

    /* name = 'menu' | 'level' | 'complete' | 'gameover' | 'victory' | 'pause' | null */
    showScreen(name) {
      if (this.cache.screen === (name || '')) return;
      this.cache.screen = name || '';
      for (const key in this.screens) {
        this.screens[key].classList.toggle('hidden', key !== name);
      }
    }

    setPlaying(on) { this.el.body.classList.toggle('playing', !!on); }
    setRageStyle(on) { this.el.body.classList.toggle('rage', !!on); }

    setLevelInfo(level) {
      this.el.level.textContent = level.numeral;
      this.el.food.textContent = level.foodLabel;
    }

    setScore(score) {
      const v = Math.round(score);
      if (v === this.cache.score) return;
      this.cache.score = v;
      this.el.score.textContent = v.toLocaleString('es-CO');
    }

    setProgress(pct) {
      const v = Math.round(pct * 10) / 10;
      if (v === this.cache.prog) return;
      this.cache.prog = v;
      this.el.progFill.style.width = v + '%';
      this.el.progPct.textContent = Math.floor(v) + '%';
    }

    /* state: 'idle' | 'ready' | 'active' */
    setRage(pct, state, secondsLeft) {
      const v = Math.round(pct * 10) / 10;
      if (v !== this.cache.rage) {
        this.cache.rage = v;
        this.el.rageFill.style.width = v + '%';
      }

      if (state === 'active') {
        this.el.ragePct.textContent = secondsLeft.toFixed(1) + 's';
      } else {
        this.el.ragePct.textContent = Math.floor(v) + '%';
      }

      if (state !== this.cache.rageState) {
        this.cache.rageState = state;
        this.el.rageBar.classList.toggle('ready', state === 'ready');
        this.el.rageBar.classList.toggle('active', state === 'active');
        this.el.rageHint.classList.toggle('show', state === 'ready');
        /* El boton tactil de RAGE refleja el mismo estado que la barra. */
        if (this.el.touchRage) {
          this.el.touchRage.classList.toggle('ready', state === 'ready');
          this.el.touchRage.classList.toggle('active', state === 'active');
        }
      }
    }

    levelIntro(level, boss) {
      this.el.levelNumeral.textContent = level.numeral;
      this.el.levelTitle.textContent = level.title;
      this.el.levelDesc.textContent = 'Devora ' + level.foodLabel.toLowerCase();
      if (this.el.levelBoss && boss) {
        this.el.levelBoss.textContent = boss.maxHits > 1
          ? 'JEFE: ' + boss.name + ' · ' + boss.maxHits + ' GOLPES DE RAGE'
          : 'JEFE: ' + boss.name;
      }
    }

    /* Vida del jefe: solo se muestra si aguanta mas de un golpe. */
    setBossHits(hits, maxHits) {
      const wrap = this.el.bossHud;
      if (!wrap) return;

      if (maxHits <= 1) {
        wrap.classList.add('hidden');
        this.cache.bossMax = maxHits;
        this.cache.bossHits = hits;
        return;
      }
      wrap.classList.remove('hidden');

      /* Los indicadores se construyen una sola vez por nivel. */
      if (this.cache.bossMax !== maxHits) {
        this.cache.bossMax = maxHits;
        this.el.bossPips.innerHTML = '';
        for (let i = 0; i < maxHits; i++) {
          const pip = document.createElement('span');
          pip.className = 'boss-pip';
          this.el.bossPips.appendChild(pip);
        }
      }
      if (this.cache.bossHits === hits) return;
      this.cache.bossHits = hits;

      const pips = this.el.bossPips.children;
      for (let i = 0; i < pips.length; i++) {
        pips[i].classList.toggle('spent', i >= hits);
      }
    }

    levelComplete(level, reason) {
      this.el.completeTitle.textContent = 'NIVEL ' + level.numeral;
      this.el.completeReason.textContent = reason;
    }

    gameOver(level) {
      this.el.gameoverDesc.textContent = 'El jefe te alcanzo en el Nivel ' + level.numeral;
    }

    victory(score) {
      this.el.victoryScore.textContent =
        'Puntuacion final: ' + Math.round(score).toLocaleString('es-CO');
    }
  }

  VW.UI = UI;
})(window.VW);
