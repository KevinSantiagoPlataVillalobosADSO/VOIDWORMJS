# VoidWorm

**Un gusano galáctico. Cinco niveles. Un depredador que no se cansa.**

VoidWorm es un videojuego arcade del género *eat to win* ambientado en el espacio profundo.
Controlas un gusano de energía translúcido que debe devorar todo lo que encuentre para llenar
dos barras: la de **progreso**, que completa el nivel, y la de **rage**, que te convierte
durante 15 segundos en el cazador en lugar de la presa.

Está hecho con **HTML5, CSS3 y JavaScript puro**. Sin frameworks, sin motores de juego,
sin dependencias, sin proceso de compilación y sin un solo archivo de recursos externo:
el fondo, los objetos, los jefes y los sonidos se generan proceduralmente en tiempo de ejecución.

---

## Cómo ejecutarlo

Abre el archivo:

```text
index.html
```

Eso es todo. No hace falta servidor, ni instalación, ni conexión a internet. Funciona con
doble clic desde el explorador de archivos (protocolo `file://`), y también servido por HTTP
si prefieres hacerlo así.

---

## Cómo se juega

### Objetivo

Devora objetos para llenar la barra de progreso. Al 100 % avanzas de nivel. Pero hay un atajo:
si activas Rage Mode y consigues **devorar al jefe**, el nivel se completa al instante.

Si el jefe te alcanza cuando no estás en Rage Mode, pierdes y repites el nivel.
Nunca pierdes por tiempo: las duraciones de cada nivel son estimaciones de la experiencia,
no cuentas atrás.

### Controles

| Acción | Teclado | Táctil |
| --- | --- | --- |
| Mover | `↑` `↓` `←` `→` | Joystick fijo (abajo a la izquierda) |
| Activar Rage Mode | `ESPACIO` | Botón **RAGE** |
| Pausa | `P` o `ESC` | Botón **II** |
| Confirmar pantallas | `ENTER` | Tocar la pantalla |
| Silenciar | `M` | — |

Los controles táctiles aparecen solos al detectar un dispositivo con pantalla táctil.
El joystick se ajusta a las mismas ocho direcciones que dan las flechas, así que la
jugabilidad es idéntica en teclado y en móvil.

---

## Mecánicas

### Las dos barras

Son independientes y ambas suben al comer:

- **Progreso** — llega al 100 % y el nivel termina.
- **Rage** — al llenarse queda disponible Rage Mode. Mientras está activo, la barra funciona
  como cronómetro de los 15 segundos; al terminar hay que volver a llenarla desde cero.

### Rage Mode

Dura exactamente **15 segundos** y cambia siete cosas a la vez:

| | Estado normal | Rage Mode |
| --- | --- | --- |
| Velocidad | `V` | `V × 1.20` |
| Puntos y progreso | ×1 | **×2** |
| Jefe | te persigue | **huye de ti** |
| Contacto con el jefe | mueres | eres inmune y **puedes devorarlo** |
| Fondo | galaxia | negro absoluto |
| Gusano | translúcido, cian | brillante, ciclando de color |
| Rastro | — | partículas luminosas |

Ni la velocidad ni la duración son acumulables: activarlo de nuevo no apila multiplicadores.
Cuando se agota, todo vuelve a la normalidad de forma inmediata y el jefe sigue ahí.

### Los tres jefes

| Nivel | Jefe | Aspecto | Tamaño | Vida |
| --- | --- | --- | --- | --- |
| I | **El Devorador** | rojo, un ojo, 9 tentáculos | 26 | 1 golpe |
| II | El Devorador | el mismo, más grande | **34** | 1 golpe |
| III | **El Segador** | violeta, dos ojos, 13 brazos, corona de púas | 32 | 1 golpe |
| IV | El Segador | el mismo, más grande | **42** | 1 golpe |
| V | **El Monarca del Vacío** | ámbar, tres ojos, 17 brazos, halo giratorio | **54** | **3 golpes** |

El jefe final es una pelea de verdad: cada impacto consume una carga entera de Rage Mode,
lo lanza por los aires y lo deja aturdido un momento, pero sobrevive. Hay que volver a llenar
la barra y embestirlo **tres veces** para acabar con él.

Los jefes se vuelven más rápidos nivel a nivel —del 82 % de tu velocidad en el I hasta el
91,5 % en el IV—, así que el margen para escapar se estrecha sin que nunca sea imposible huir.
El Monarca es la excepción: baja al 86 % porque su pelea es larga, y lo que aporta no es
presión por segundo sino resistencia.

### Los cinco niveles

| Nivel | Zona | Comida | Duración estimada | Objetos para el 100 % |
| --- | --- | --- | --- | --- |
| I | Cinturón de Energía | Bolitas de energía | 2 min | 70 |
| II | Mar de Lunas | Lunas pequeñas | 2 min | 68 |
| III | Forja Solar | Soles pequeños | 1 min 30 s | 54 |
| IV | Tormenta Iónica | Truenos pequeños | 1 min 30 s | 52 |
| V | Cuna de Estrellas | Estrellas | 1 min | 56 |

Al completar el nivel V: **victoria**.

---

## Estructura del proyecto

```text
VoidWorm/
│
├── index.html          Punto de entrada único: canvas, HUD y pantallas de estado
├── README.md           Este archivo
├── DESARROLLO.md       Bitácora completa del proceso de creación
│
├── css/
│   └── style.css       HUD, barras, pantallas, controles táctiles, animaciones
│
└── js/
    ├── utils.js        Matemáticas, interpolación por deltaTime y caché de sprites
    ├── audio.js        Sonidos sintetizados con WebAudio (sin archivos)
    ├── input.js        Teclado y eje virtual táctil: fuente única de entrada
    ├── particles.js    Sistema de partículas con pool fijo
    ├── background.js   Galaxia por capas, nebulosa pre-renderizada, fundido a negro
    ├── food.js         Los cinco tipos de comida y su gestión
    ├── player.js       El gusano: movimiento, cuerpo y estados visuales
    ├── boss.js         Los tres jefes: perseguir, huir, encajar golpes
    ├── levels.js       Configuración de los 5 niveles y constantes de Rage Mode
    ├── ui.js           Único punto de contacto con el DOM
    ├── touch.js        Controles en pantalla para dispositivos táctiles
    ├── game.js         Núcleo: máquina de estados, game loop y reglas
    └── main.js         Arranque y conexión de las piezas
```

---

## Arquitectura

El juego se dibuja en un `<canvas>`; la interfaz (HUD, barras, pantallas, botones táctiles)
es HTML y CSS reales. Esa separación es deliberada: el canvas hace lo que sabe hacer bien
—movimiento fluido, partículas, efectos— y el DOM hace lo que sabe hacer bien: texto legible,
animaciones de barras y transiciones.

**Un único `requestAnimationFrame`** gobierna toda la partida, con `deltaTime` acotado para
sobrevivir a cambios de pestaña. No hay ningún `setInterval` en la lógica: los 15 segundos de
Rage Mode, los retardos entre pantallas y las transiciones se miden con el tiempo transcurrido.
Así nada sigue ejecutándose al reiniciar un nivel.

```text
requestAnimationFrame → deltaTime → entrada → jugador → jefe → objetos
    → colisiones → barras → Rage Mode → partículas → cámara → render ↺
```

Estados del juego: `MENU · LEVEL_INTRO · PLAYING · RAGE · PAUSED · LEVEL_COMPLETE · GAME_OVER · VICTORY`
Estados del jefe: `SPAWN · CHASE · FLEE · REEL · DEVOURED`

Rage Mode es un **estado propio**, no un efecto visual: mientras está activo cambian de verdad
la velocidad, la inmunidad, el multiplicador, el comportamiento del jefe, el fondo y el gusano.

### Sobre el rendimiento

El bucle no reserva memoria: las partículas viven en un pool fijo de 700, el rastro del cuerpo
del gusano es un buffer circular de 260 puntos reutilizados y los objetos de comida se
reposicionan en lugar de recrearse. Los brillos usan sprites cacheados en vez de crear
degradados en cada fotograma, y la nebulosa se pre-renderiza una vez por nivel y se pinta
recortada a lo que se ve.

El mundo es mayor que la ventana (hasta 2600 × 1900 px) y la cámara ajusta el zoom para que
en una pantalla estrecha veas la misma cantidad de terreno que en un monitor: si no, el jefe
aparecería encima sin margen de reacción.

---

## Compatibilidad

Funciona en cualquier navegador moderno con Canvas 2D. Se ha probado sobre un navegador basado
en Chromium, en escritorio y con emulación de móvil, en horizontal y en vertical.

En móvil los controles táctiles se activan por detección de capacidades (`pointer: coarse`,
`maxTouchPoints`), la calidad se ajusta sola (menos estrellas, menos partículas, DPR limitado)
y en orientación vertical aparece un aviso para girar el dispositivo, porque la persecución
necesita una vista ancha.

El audio se inicializa tras la primera interacción del usuario, como exigen las políticas de
reproducción automática de los navegadores.

---

## Autoría

- **Kevin Plata** — concepto, diseño de juego, desarrollo, especificación funcional y dirección del proyecto.
- **Claude (Anthropic)** — Apoyo en desarollo, auditor, implementación y pruebas.

Documentación del proceso completo en [DESARROLLO.md](DESARROLLO.md).

---

## Licencia

Proyecto personal sin licencia definida todavía. :b