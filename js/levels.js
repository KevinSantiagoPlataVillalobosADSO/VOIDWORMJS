/* ============================================================
   levels.js - configuracion de los 5 niveles y constantes de Rage.
   Los tiempos son duraciones ESTIMADAS de la experiencia: se usan
   para calibrar cuantos objetos hacen falta, nunca como cuenta
   atras de muerte (el jugador jamas pierde por tiempo).
   ============================================================ */
(function (VW) {
  'use strict';

  /* Reglas de Rage Mode: valores fijos exigidos por el diseno. */
  VW.RAGE = {
    DURATION: 15,     /* segundos */
    SPEED_MULT: 1.20, /* +20 % de velocidad */
    SCORE_MULT: 2,    /* x2 puntos y progreso */
    ITEMS_TO_CHARGE: 12
  };

  VW.SCORE_PER_ITEM = 10;

  const RAGE_GAIN = 100 / VW.RAGE.ITEMS_TO_CHARGE;

  VW.LEVELS = [
    {
      index: 0,
      numeral: 'I',
      title: 'CINTURON DE ENERGIA',
      food: 'orb',
      foodLabel: 'Bolitas de energia',
      estimate: 120,               /* 2 minutos */
      itemsToComplete: 70,
      foodCount: 26,
      playerSpeed: 300,
      bossSpeed: 246,
      bossFleeSpeed: 262,
      bossTurn: 2.2,
      world: { w: 2400, h: 1700 },
      palette: [
        'rgba(120,72,255,ALPHA)',
        'rgba(60,150,255,ALPHA)',
        'rgba(40,220,190,ALPHA)'
      ]
    },
    {
      index: 1,
      numeral: 'II',
      title: 'MAR DE LUNAS',
      food: 'moon',
      foodLabel: 'Lunas pequenas',
      estimate: 120,               /* 2 minutos */
      itemsToComplete: 68,
      foodCount: 26,
      playerSpeed: 312,
      bossSpeed: 266,
      bossFleeSpeed: 280,
      bossTurn: 2.4,
      world: { w: 2500, h: 1800 },
      palette: [
        'rgba(90,110,220,ALPHA)',
        'rgba(160,180,255,ALPHA)',
        'rgba(70,60,160,ALPHA)'
      ]
    },
    {
      index: 2,
      numeral: 'III',
      title: 'FORJA SOLAR',
      food: 'sun',
      foodLabel: 'Soles pequenos',
      estimate: 90,                /* 1 minuto 30 */
      itemsToComplete: 54,
      foodCount: 24,
      playerSpeed: 326,
      bossSpeed: 288,
      bossFleeSpeed: 300,
      bossTurn: 2.7,
      world: { w: 2500, h: 1800 },
      palette: [
        'rgba(255,120,40,ALPHA)',
        'rgba(255,60,120,ALPHA)',
        'rgba(140,40,200,ALPHA)'
      ]
    },
    {
      index: 3,
      numeral: 'IV',
      title: 'TORMENTA IONICA',
      food: 'bolt',
      foodLabel: 'Truenos pequenos',
      estimate: 90,                /* 1 minuto 30 */
      itemsToComplete: 52,
      foodCount: 24,
      playerSpeed: 338,
      bossSpeed: 304,
      bossFleeSpeed: 316,
      bossTurn: 3.0,
      world: { w: 2600, h: 1900 },
      palette: [
        'rgba(230,220,60,ALPHA)',
        'rgba(80,200,255,ALPHA)',
        'rgba(120,60,220,ALPHA)'
      ]
    },
    {
      index: 4,
      numeral: 'V',
      title: 'CUNA DE ESTRELLAS',
      food: 'star',
      foodLabel: 'Estrellas',
      estimate: 60,                /* 1 minuto */
      itemsToComplete: 40,
      foodCount: 22,
      playerSpeed: 352,
      bossSpeed: 322,
      bossFleeSpeed: 334,
      bossTurn: 3.3,
      world: { w: 2600, h: 1900 },
      palette: [
        'rgba(255,215,90,ALPHA)',
        'rgba(255,90,190,ALPHA)',
        'rgba(60,120,255,ALPHA)'
      ]
    }
  ];

  /* Cuanto aporta un objeto (antes de aplicar el x2 de Rage). */
  VW.levelGains = function (level) {
    return {
      progress: 100 / level.itemsToComplete,
      rage: RAGE_GAIN,
      score: VW.SCORE_PER_ITEM
    };
  };

  VW.LEVEL_COUNT = VW.LEVELS.length;
})(window.VW);
