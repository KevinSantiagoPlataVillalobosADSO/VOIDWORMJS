/* ============================================================
   audio.js - sonidos sintetizados con WebAudio (sin assets).
   Se inicializa de forma diferida tras la primera interaccion
   del usuario para respetar las politicas de autoplay.
   ============================================================ */
(function (VW) {
  'use strict';

  class AudioFX {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.volume = 0.45;
    }

    /* Llamado desde el primer click o tecla real del usuario. */
    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
      return this.muted;
    }

    /* Oscilador simple con envolvente exponencial. */
    tone(freq, freq2, dur, type, gain) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (freq2 && freq2 !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
      }
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gain || 0.2, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(env);
      env.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    /* Ruido filtrado, para impactos y explosiones. */
    noise(dur, freq, q, gain) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = q || 1;
      const env = this.ctx.createGain();
      env.gain.value = gain || 0.22;
      src.connect(bp);
      bp.connect(env);
      env.connect(this.master);
      src.start(t);
    }

    /* Secuencia de notas sin setInterval: un solo setTimeout por nota,
       usado unicamente para audio (nunca para logica de juego). */
    arp(notes, step, dur, type, gain) {
      notes.forEach((f, i) => {
        window.setTimeout(() => this.tone(f, f, dur, type, gain), i * step * 1000);
      });
    }

    eat(step) { this.tone(480 + step * 26, 860 + step * 40, 0.09, 'triangle', 0.12); }
    ready() { this.arp([880, 1320], 0.09, 0.13, 'sine', 0.1); }
    rageOn() { this.tone(110, 900, 0.55, 'sawtooth', 0.15); this.noise(0.5, 320, 0.8, 0.16); }
    rageOff() { this.tone(700, 110, 0.5, 'sawtooth', 0.11); }
    devour() { this.tone(80, 440, 0.75, 'square', 0.17); this.noise(0.85, 170, 0.6, 0.26); }
    /* Golpe que el jefe final aguanta: impacto seco, sin resolucion. */
    bossHit() { this.tone(150, 70, 0.35, 'square', 0.16); this.noise(0.4, 260, 0.9, 0.24); }
    death() { this.tone(230, 40, 0.9, 'sawtooth', 0.2); this.noise(0.7, 120, 0.5, 0.26); }
    levelUp() { this.arp([523, 659, 784, 1046], 0.09, 0.16, 'sine', 0.13); }
    victory() { this.arp([523, 659, 784, 1046, 1318, 1568], 0.14, 0.3, 'triangle', 0.14); }
  }

  VW.AudioFX = AudioFX;
})(window.VW);
