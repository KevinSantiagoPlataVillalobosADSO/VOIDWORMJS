# VoidWorm — Bitácora de desarrollo

Este documento recoge cómo desarrollé VoidWorm de principio a fin: las decisiones técnicas que
tomé, por qué las tomé, los problemas que encontré por el camino y cómo los resolví. No es un
manual de uso —para eso está el [README](README.md)— sino el registro honesto del proceso,
incluidos los errores que cometí y las cosas que tuve que rehacer.

---

## Índice

1. [El punto de partida](#1-el-punto-de-partida)
2. [Decisiones técnicas de base](#2-decisiones-técnicas-de-base)
3. [La arquitectura](#3-la-arquitectura)
4. [El game loop](#4-el-game-loop)
5. [El gusano](#5-el-gusano)
6. [El mundo y la cámara](#6-el-mundo-y-la-cámara)
7. [Comida y partículas](#7-comida-y-partículas)
8. [Rage Mode](#8-rage-mode)
9. [Los jefes](#9-los-jefes)
10. [La interfaz](#10-la-interfaz)
11. [Controles táctiles](#11-controles-táctiles)
12. [Cómo lo probé](#12-cómo-lo-probé)
13. [Rendimiento](#13-rendimiento)
14. [Errores que encontré y cómo los corregí](#14-errores-que-encontré-y-cómo-los-corregí)
15. [Balance](#15-balance)
16. [Lo que quedó fuera](#16-lo-que-quedó-fuera)

---

## 1. El punto de partida

Empecé con una carpeta completamente vacía y una idea clara de qué quería: un arcade espacial
del género *eat to win* donde el gusano que controlas es al mismo tiempo presa y depredador,
y donde ese cambio de rol fuera el corazón de la partida y no un adorno.

Antes de escribir una sola línea me impuse las restricciones con las que iba a trabajar:

- **Solo HTML5, CSS3 y JavaScript.** Sin frameworks, sin TypeScript, sin motores de juego.
- **`index.html` como punto de entrada único.** Nada de una segunda página: los cambios de
  pantalla se resuelven con estados, no con navegación.
- **Cero dependencias y cero recursos externos.** Ni librerías, ni imágenes, ni archivos de
  sonido. Todo generado en tiempo de ejecución.
- **Mecánicas cerradas.** Los 15 segundos de Rage Mode, el +20 % de velocidad y el ×2 de puntos
  son valores de diseño, no perillas de balance. Cuando más adelante tuve que ajustar la
  dificultad, ajusté todo lo demás menos esos tres números.

También decidí una cosa desde el principio que resultó ser importante: **el jugador nunca pierde
por tiempo**. Los "2 minutos" o "1 minuto 30" de cada nivel son estimaciones de cuánto dura la
experiencia, y los usé para calibrar cuánta comida hace falta. Nunca se convirtieron en una
cuenta atrás mortal.

---

## 2. Decisiones técnicas de base

### Canvas para el mundo, DOM para la interfaz

Lo primero que decidí fue el reparto. El mundo del juego —gusano, jefe, comida, partículas,
fondo— va en un `<canvas>`, porque necesita movimiento fluido, cientos de elementos y efectos
aditivos que el DOM no da a ese ritmo. Pero el HUD, las barras, las pantallas de estado y los
botones son **HTML y CSS reales**. Cada tecnología hace lo que hace bien: el canvas dibuja,
el CSS anima barras y transiciones sin que yo tenga que reimplementar la tipografía.

### Scripts clásicos en lugar de módulos ES

Esta fue la decisión menos obvia y la tomé por una razón muy concreta: quería que el juego
**funcionara abriendo `index.html` con doble clic**, sin servidor. Los módulos ES fallan bajo el
protocolo `file://` por política de origen cruzado, así que un `import` habría obligado a montar
un servidor local solo para jugar. Usé `<script>` clásicos y un único espacio de nombres global,
`VW`, donde cada archivo registra su pieza. Es la solución antigua, pero es la que cumple el
requisito.

### Todo procedural

No usar recursos externos no fue una limitación caprichosa: me obligó a que el juego sea un
único paquete de texto que funciona en cualquier sitio. El fondo de galaxia, los cinco tipos de
comida, los tres jefes y todos los sonidos se generan con código —Canvas 2D y WebAudio—, así
que no hay nada que cargar ni nada que se pueda romper por una ruta mal puesta.

---

## 3. La arquitectura

Repartí el trabajo en trece módulos, cada uno con una responsabilidad clara:

| Módulo | De qué se ocupa |
| --- | --- |
| `utils.js` | Matemáticas, interpolación por `deltaTime`, caché de sprites de brillo |
| `audio.js` | Síntesis de sonido con WebAudio |
| `input.js` | Teclado y eje virtual táctil: **la única fuente de entrada** |
| `particles.js` | Sistema de partículas con pool fijo |
| `background.js` | Galaxia por capas, nebulosa, fundido a negro |
| `food.js` | Los cinco tipos de comida y su gestión |
| `player.js` | El gusano |
| `boss.js` | Los tres jefes |
| `levels.js` | Configuración de niveles y constantes de Rage Mode |
| `ui.js` | Único punto de contacto con el DOM |
| `touch.js` | Controles en pantalla |
| `game.js` | Máquina de estados, game loop y reglas |
| `main.js` | Arranque y conexión de las piezas |

Hay dos reglas que me impuse y que sostienen todo lo demás:

**Nadie toca el DOM salvo `ui.js`.** El núcleo del juego no sabe que existen elementos HTML;
le pide cambios a la capa de interfaz y punto. Cuando más adelante añadí la vida del jefe final
al HUD, solo tuve que tocar un archivo.

**Nadie lee el teclado salvo `input.js`.** Cuando añadí los controles táctiles, los botones en
pantalla no simulan eventos de teclado: escriben en el mismo gestor de entrada. El gusano
sigue preguntando "¿hacia dónde voy?" sin saber si la respuesta viene de una flecha o de un
pulgar.

### La máquina de estados

```text
MENU → LEVEL_INTRO → PLAYING ⇄ RAGE
                        ⇅
                     PAUSED
                        ↓
        LEVEL_COMPLETE / GAME_OVER → (siguiente nivel / reinicio)
                        ↓
                     VICTORY
```

Decidí que **Rage Mode fuera un estado propio** y no una bandera decorativa. Mientras está
activo cambian de verdad la velocidad del jugador, su inmunidad, el multiplicador de puntos,
el comportamiento del jefe, el color del fondo y el aspecto del gusano. Si hubiera sido solo un
efecto visual, la mitad del juego no existiría.

El jefe tiene su propia máquina: `SPAWN → CHASE ⇄ FLEE → REEL → DEVOURED`.

---

## 4. El game loop

Un solo `requestAnimationFrame` para toda la vida de la página. Ni uno más, y ninguno se
reinicia al cambiar de nivel. El orden de cada fotograma es siempre el mismo:

```text
deltaTime → entrada → jugador → jefe → objetos → colisiones
    → Rage Mode → cámara → partículas → fondo → HUD → render
```

Dos detalles que me ahorraron problemas:

**El `deltaTime` está acotado a 50 ms.** Si cambias de pestaña y vuelves, el navegador entrega
un salto enorme de tiempo. Sin ese tope, el gusano se teletransportaría media pantalla y podría
atravesar objetos. Con él, el peor caso es un fotograma lento.

**No hay ni un `setInterval` en la lógica.** Los 15 segundos de Rage Mode se descuentan del
`deltaTime` del bucle, igual que los retardos entre pantallas. Esto no es purismo: significa
que al reiniciar un nivel no queda ningún temporizador vivo esperando para disparar algo que
ya no tiene sentido. El único `setTimeout` de todo el proyecto está en el módulo de audio, para
espaciar las notas de una melodía, y jamás toca el estado del juego.

---

## 5. El gusano

### Movimiento

El movimiento tenía que sentirse continuo y no depender de los FPS. Uso aceleración exponencial
hacia la velocidad objetivo:

```js
this.vx = damp(this.vx, objetivoX, ACCEL, dt);
```

donde `damp` converge al mismo punto con cualquier `dt`. Un monitor de 144 Hz y uno de 60 Hz
producen exactamente el mismo recorrido. Al soltar las teclas hay una deceleración algo más
lenta que la aceleración: da una sensación de inercia que le sienta bien a una criatura que
se desliza por el vacío.

### El cuerpo

El cuerpo sigue el rastro de posiciones de la cabeza. Guardo los puntos por los que ha pasado
y coloco un segmento cada cierto número de puntos. La primera versión reservaba un objeto nuevo
por cada punto, y me pareció un desperdicio para algo que ocurre decenas de veces por segundo,
así que lo convertí en un **buffer circular de 260 puntos reutilizados**: saco el punto más
antiguo por la cola, le sobrescribo las coordenadas y lo meto por la cabeza. Cero reservas de
memoria mientras juegas.

El gusano **crece con el progreso** del nivel, de 18 a 44 segmentos. Es un detalle pequeño que
hace mucho: ves tu avance en el propio personaje, no solo en una barra.

### El aspecto

En estado normal es translúcido y energético: un cuerpo de brillos aditivos en cian con muy
poca opacidad, que deja ver la galaxia a través. En Rage Mode el mismo dibujo cambia de
parámetros —opacidad alta, ciclo de tono, halo de inmunidad— y se convierte en un cometa
multicolor. Es el mismo código con otros números, no dos personajes distintos.

---

## 6. El mundo y la cámara

Decidí que el mundo fuera **más grande que la ventana** (de 2400 × 1700 a 2600 × 1900 px según
el nivel), con una cámara que sigue al gusano con suavizado. Un arcade de una sola pantalla
habría sido más fácil, pero la persecución pierde toda la tensión si siempre ves dónde está el
jefe. Como contrapartida tuve que añadir un **marcador en el borde de la pantalla** que apunta
hacia él cuando está fuera de vista: rojo si te persigue, cian si huye.

El fondo tiene tres capas de estrellas con parallax, una nebulosa y un tinte cósmico. La
nebulosa se **pre-renderiza una sola vez por nivel** en un canvas fuera de pantalla a baja
resolución y luego se pinta escalada: dibujar treinta y cuatro degradados radiales en cada
fotograma habría sido absurdo.

Cuando el jugador activa Rage Mode, la galaxia se **funde a negro absoluto** en poco menos de
medio segundo. No es un corte seco: hay un valor que interpola entre "galaxia" y "vacío", y
todo el fondo lo respeta. Ese negro es funcional además de estético, porque es lo que hace que
el gusano y su rastro de partículas destaquen.

---

## 7. Comida y partículas

Los cinco tipos de comida —bolitas de energía, lunas, soles, truenos y estrellas— están
dibujados a mano con primitivas de canvas, cada uno con su propia animación: las bolitas
laten, las lunas rotan con su terminador y sus cráteres, los soles tienen corona palpitante,
los truenos parpadean y las estrellas centellean.

Tanto la comida como las partículas usan **pools de tamaño fijo**. Cuando te comes un objeto
no se destruye ni se crea otro: el mismo objeto se recoloca en un punto aleatorio, evitando
aparecer encima del jugador o del jefe. Las partículas viven en un pool de 700 y las muertas
se reciclan. Esto tiene dos ventajas: no hay presión sobre el recolector de basura durante la
partida, y es imposible que un nivel deje objetos flotando en memoria cuando reinicias.

---

## 8. Rage Mode

Es el centro del juego, así que lo traté como tal. Al activarse ocurren siete cosas a la vez:

1. Velocidad × 1.20 exacto, nunca acumulable.
2. Inmunidad frente al jefe.
3. Puntos y progreso ×2.
4. El jefe deja de perseguir y empieza a huir.
5. El fondo se funde a negro.
6. El gusano brilla y cicla de color.
7. Aparece un rastro de partículas luminosas.

Y a los 15 segundos, todo eso se revierte de golpe: velocidad normal, vulnerabilidad inmediata,
multiplicador a ×1, jefe otra vez a la caza, galaxia de vuelta. El jefe **no desaparece** ni se
reinicia; simplemente vuelve a ser el cazador.

### Una decisión que tuve que tomar

Las dos barras son independientes, pero durante Rage Mode la de rage tiene que mostrar algo.
Tenía dos opciones: seguir acumulando carga mientras estás en rage, o usar la barra como
cronómetro de los 15 segundos. Elegí lo segundo, porque comunica mejor: mientras estás en modo
furia, la barra te dice cuánto te queda. La consecuencia es que al terminar se queda a cero y
hay que volver a llenarla comiendo, cosa que además le da ritmo a la partida.

### Los temporizadores

`timeLeft` se descuenta del `deltaTime` del bucle. Esto tiene un efecto secundario que me gusta:
como el `deltaTime` está acotado y el bucle se detiene en pausa, **nadie pierde segundos de rage
por cambiar de ventana**.

---

## 9. Los jefes

### Primera versión: un solo jefe

Empecé con un único depredador reutilizado en los cinco niveles, con dos comportamientos:
persecución con anticipación —apunta a donde *estarás*, no a donde estás— y huida con repulsión
de los muros, para que no se dejara acorralar en una esquina de forma trivial.

Le puse **inercia deliberada**: no gira instantáneamente. Esa inercia es lo que hace el juego
justo, porque siempre existe una ventana para escapar por mucho que se te haya pegado. Y le di
un **radio de colisión más pequeño que su dibujo** (62 %), porque las muertes que ocurren
"por el pelo" se sienten injustas aunque técnicamente sean correctas.

También añadí un periodo de materialización de dos segundos al empezar cada nivel, en el que
aparece pero ni persigue ni mata. Te da tiempo a orientarte.

### Segunda versión: tres jefes

Más adelante decidí que el mismo enemigo durante cinco niveles era poco, y lo convertí en tres:

- **El Devorador** (niveles I y II): rojo, un ojo enorme, nueve tentáculos. En el II es más grande.
- **El Segador** (niveles III y IV): violeta, dos ojos, trece brazos y una corona de púas. En el IV es más grande.
- **El Monarca del Vacío** (nivel V): ámbar, tres ojos, diecisiete brazos y un halo giratorio.

En lugar de crear tres clases, definí una **tabla de identidades** con los parámetros que
cambian (tono, número de brazos, púas, ojos, halo) y dejé una sola clase que los interpreta.
El tamaño, la vida y las velocidades vienen de la configuración del nivel. Añadir un cuarto
jefe sería añadir una fila.

### El jefe final

Quería que el último no cayera de un mordisco, sino que fuera una pelea. Le puse **tres puntos
de vida**, con esta regla: cada impacto **consume la carga entera de Rage Mode**. No puedes
encadenar tres golpes en una sola furia; tienes que volver a llenar la barra tres veces.

Esto me obligó a añadir un estado nuevo, `REEL`: al recibir un golpe, el jefe sale despedido a
900 px/s y queda aturdido 1,6 segundos, durante los cuales **no persigue y no puede matarte**.
Sin ese estado, el golpe habría sido una trampa mortal: consumes tu rage, pierdes la inmunidad
al instante y te quedas pegado a un jefe que vuelve a ser letal. Medí el retroceso y da unos
360 px de separación por sí solo, que con el jugador moviéndose se convierten en casi 900.
Es margen suficiente para reaccionar sin que sea un regalo.

El HUD muestra tres indicadores que se apagan con cada golpe, la pantalla de inicio del nivel
anuncia el nombre del jefe y cuántos golpes aguanta, y el propio jefe se agrieta a medida que
pierde vida.

---

## 10. La interfaz

El HUD es HTML: nivel, tipo de comida, puntuación, las dos barras y la vida del jefe final.
Las barras se animan con transiciones CSS, la de rage late cuando está cargada y se rellena con
un degradado animado mientras está activa. El acento de color de toda la interfaz cambia de
cian a magenta cuando entras en Rage Mode con una sola clase en el `<body>`.

Un detalle de rendimiento: la capa de interfaz **cachea los valores** y solo escribe en el DOM
cuando algo cambia de verdad. Escribir `style.width` sesenta veces por segundo con el mismo
valor provoca trabajo de diseño innecesario en el navegador.

Las pantallas de estado —menú, intro de nivel, pausa, nivel completado, game over y victoria—
son secciones HTML que se muestran y ocultan. El mundo sigue vivo detrás de ellas, y eso hace
que las transiciones se sientan parte del juego y no una interrupción.

---

## 11. Controles táctiles

Añadí soporte táctil como una **capa adicional**, sin tocar los controles de teclado.

### Detección

Por capacidades, nunca por cadena de agente: `pointer: coarse`, `maxTouchPoints` y
`ontouchstart`. Y para portátiles híbridos, la capa se activa sola en cuanto ocurre el primer
toque real.

### Paridad exacta con las flechas

Aquí tomé una decisión de diseño importante. Un joystick analógico libre daría movimiento en
360° y velocidad proporcional, que se siente mejor al tacto pero **cambia la jugabilidad**:
el móvil sería más fácil que el teclado. Preferí que el juego sea el mismo en ambos, así que
el joystick **ajusta la dirección a las ocho direcciones exactas de las flechas**, con una tabla
de vectores enteros en lugar de senos y cosenos, para que la paridad sea exacta y no aproximada.
Lo comprobé midiendo: la diagonal del joystick produce el mismo ángulo que `↓` + `→`, hasta el
sexto decimal.

### Primero dinámico, después fijo

Mi primera versión fue un joystick dinámico: la base aparecía donde pusieras el pulgar, en
cualquier punto de la pantalla. Al probarlo me di cuenta del problema: **cualquier toque movía
al gusano**, incluido el que solo pretendía tocar la pantalla. Lo rehíce como joystick **fijo**
en la esquina inferior izquierda, siempre visible, que solo responde si el toque cae sobre su
base (con un margen generoso de agarre). Es menos "moderno" y es mucho mejor: no hay gestos
accidentales y siempre sabes dónde está el control.

Eso me obligó a mover el HUD: las barras, que en escritorio van abajo, en táctil suben arriba
para dejar el borde inferior libre al joystick y al botón de rage.

### Justicia en pantallas pequeñas

Este es el ajuste menos visible y el más importante. En un móvil en horizontal ves mucho menos
mundo que en un monitor, y con el mismo tamaño de dibujo el jefe te aparecería encima sin margen
de reacción. Añadí un **zoom de cámara** que mantiene constante la cantidad de mundo visible
(unos 1050 px de ancho): en una pantalla de 740 px el zoom baja a 0,70 y ves el mismo terreno
que en escritorio. La dificultad deja de depender del tamaño de la pantalla.

### El resto del paquete móvil

`viewport-fit=cover` con márgenes de zona segura para los recortes de pantalla, `100dvh` para
que la barra de direcciones del navegador no provoque saltos, sin zoom por gesto ni por doble
toque, calidad reducida automáticamente (DPR limitado a 1.5, 45 % menos estrellas, rastro de
partículas más espaciado) y un aviso de "gira el dispositivo" en vertical, con pausa automática,
porque la persecución necesita una vista ancha.

---

## 12. Cómo lo probé

Esta parte del proceso fue la que más me sorprendió, porque acabó siendo tan larga como escribir
el juego.

### El problema de probar un juego

Un juego no se prueba leyendo el código: se prueba jugándolo. Pero jugar a mano no sirve para
comprobar que la duración de Rage Mode son 15,000 segundos y no 14,9. Necesitaba algo
determinista.

La solución fue **avanzar el juego a mano**. Como toda la lógica vive en un método que recibe
`deltaTime`, puedo llamarlo yo mismo en un bucle con pasos fijos de 1/60 de segundo y examinar
el estado entre paso y paso. Sin depender del reloj, sin depender del navegador, y con
resultados reproducibles.

Descubrí de paso algo que confirmaba la utilidad del método: cuando la ventana no está visible,
el navegador congela `requestAnimationFrame`. Con el avance manual, eso deja de importar.

### Las suites de aserciones

Escribí varias tandas de comprobaciones automáticas sobre el juego cargado:

- **Reglas fundamentales (19 comprobaciones):** que solo las flechas mueven y WASD se ignora
  (0 px frente a 200 px), que la velocidad es ×1.20 con error cero, que la duración es de
  15 segundos exactos, que ni velocidad ni duración se acumulan al reactivar, que la inmunidad
  existe solo durante la furia, que el ×2 se aplica al progreso y a los puntos y desaparece al
  terminar, que sin rage es imposible devorar al jefe, y que tres minutos sin comer no matan a
  nadie.
- **Campaña completa:** los cinco niveles encadenados hasta la victoria, verificando que cada
  uno tiene su tipo de comida correcto.
- **Combate del jefe final (20 comprobaciones):** los tres golpes, la carga consumida en cada
  uno, el aturdimiento, el retroceso medido, y que estando encima de un jefe aturdido no mueres.
- **Controles táctiles (16 comprobaciones):** las ocho direcciones, la zona muerta, la paridad
  de ángulo con el teclado, los botones, y que un toque fuera de la base no mueve nada.
- **Fugas:** doce reinicios seguidos comprobando que sigue habiendo un único bucle de animación
  y que los pools no crecen.

### El bot

Para el balance del nivel V no me bastaba con comprobaciones: necesitaba saber si un jugador
puede *de verdad* conseguir tres cargas de rage antes de que la barra de progreso termine el
nivel. Así que escribí un bot sencillo que juega solo: come el objeto más cercano priorizando
los que están lejos del jefe, esquiva cuando lo tiene encima y usa la furia en cuanto la tiene
cargada. Fue la herramienta que más me ahorró tiempo, y la que destapó el problema de balance
que cuento más abajo.

### Dos falsos fallos

Merece la pena anotarlos porque me hicieron dudar del código cuando el error estaba en la
prueba:

- Una comprobación de "WASD no mueve" falló porque el gusano venía lanzado del test anterior y
  seguía frenando por inercia. Repitiéndola desde reposo: 0 px de movimiento.
- Varias comprobaciones del combate final fallaron porque en mi propio guion dejé al gusano
  encima del jefe justo cuando terminaba de aturdirse, y murió. Era el juego funcionando
  correctamente.

---

## 13. Rendimiento

Medí en lugar de suponer, y la medición cambió mis prioridades.

El coste de generar los comandos de dibujo resultó ser mínimo: alrededor de **0,5 ms por
fotograma** con el gusano al máximo, las partículas activas y todo en pantalla. Lo caro no era
mi JavaScript sino el rasterizado, así que ataqué justo eso:

- **Sprites de brillo cacheados.** Crear un degradado radial por cada segmento y cada partícula
  en cada fotograma es caro. Los pre-renderizo una vez por color en canvas pequeños y los pinto
  con `drawImage`.
- **Fuera los `shadowBlur` grandes.** Tenía el límite del mundo dibujado con `shadowBlur` sobre
  un rectángulo de 2600 × 1900 px: un desenfoque enorme en cada fotograma. Lo sustituí por dos
  trazos superpuestos —uno ancho y translúcido, otro fino y brillante— que dan el mismo halo por
  una fracción del coste. Hice lo mismo con el marcador del jefe.
- **Nebulosa recortada.** En vez de pintar la imagen del mundo entero y dejar que el navegador
  recorte, calculo el trozo visible y pinto solo ese. Tras el cambio, dibujar el fondo completo
  cuesta **0,018 ms**.
- **Un relleno de pantalla menos.** Cuando la galaxia es opaca, el fondo negro que hay debajo
  no se ve: me lo salto.
- **Calidad adaptativa en móvil,** decidida antes de construir el primer nivel para que ya
  arranque ajustado.

---

## 14. Errores que encontré y cómo los corregí

Los anoto porque el proceso real fue este, no una línea recta.

**El fondo se comía el juego.** La primera versión de la nebulosa saturaba: treinta y cuatro
manchas aditivas convertían la pantalla en una neblina azul brillante sobre la que el gusano
translúcido era prácticamente invisible. Bajé la opacidad de las manchas a la mitad, oscurecí
el degradado base y reduje la opacidad global del blit. El espacio volvió a parecer espacio.

**El gusano parecía una fila de puntos.** Los segmentos estaban demasiado separados y el cuerpo
se leía como una línea de topos en lugar de una criatura. Reduje a la mitad la separación entre
segmentos, subí el número de segmentos y añadí un radio mínimo, para que la cola siga siendo un
cuerpo continuo en vez de desintegrarse al afinarse.

**El rastro de partículas no se veía.** Lo estaba generando justo detrás de la cabeza, donde
quedaba tapado por el propio brillo del gusano. Moví el punto de nacimiento **a la cola** y le
subí la dispersión: ahora el rastro queda realmente detrás y se lee como una estela.

**El canvas podía dimensionarse a cero.** Probando en un contenedor que aún no tenía medidas
descubrí que el mundo se configuraba con un tamaño de 0 × 0. Añadí valores de reserva, hice que
el redimensionado no haga nada si no ha cambiado nada —asignar el tamaño del canvas borra el
fotograma— y le puse un `ResizeObserver` además del evento de ventana, para cubrir el caso de un
canvas que recibe sus medidas más tarde.

**El joystick dinámico era un error de diseño.** Ya lo conté arriba: cualquier toque movía al
gusano. Rehecho como joystick fijo.

**El nivel V no se podía terminar como yo quería.** El problema de balance más serio, en la
sección siguiente.

---

## 15. Balance

### Los niveles

Calibré la cantidad de comida a partir de las duraciones estimadas, no al revés: 70 objetos en
el nivel I para unos dos minutos, bajando hasta 56 en el V, que es más corto pero más rápido.
La velocidad del jugador sube de 300 a 352 px/s a lo largo de la campaña.

La curva de dificultad la lleva sobre todo el jefe. No es que se vuelva más listo, es que el
margen se estrecha:

| Nivel | Velocidad del jefe | Respecto al jugador |
| --- | --- | --- |
| I | 246 | 82 % |
| II | 266 | 85 % |
| III | 288 | 88 % |
| IV | 304 | 90 % |
| V | 302 | 86 % |

Mientras el jefe sea más lento que tú, huir siempre es posible **si tienes espacio**; lo que
mata es quedarte sin sitio contra un muro. Esa es exactamente la tensión que quería.

### El problema del nivel V

Cuando puse tres puntos de vida al jefe final me encontré con que la pelea era literalmente
imposible de completar. Las cuentas: hacían falta 12 objetos por carga de rage, es decir 36 para
tres cargas, cuando el nivel entero se terminaba con 40 objetos. **La barra de progreso acababa
el nivel antes de que pudieras dar el tercer golpe.**

Lo arreglé con dos cambios que no tocan las constantes de Rage Mode:

1. Abaratar la carga solo en el nivel V: **8 objetos por carga** en lugar de 12 (añadí un campo
   de configuración por nivel para ello).
2. Subir los objetos necesarios para el 100 % de 40 a **56**, para dar espacio a la pelea.

Después probé y descubrí un segundo problema: el jefe final iba a 322 px/s, el 91,5 % de la
velocidad del jugador. Con esa presión constante apenas podías comer para recargar tres veces.
Lo bajé a **302** (86 %). Su velocidad de huida sigue en 334 frente a los 422 px/s que alcanzas
en furia, así que sigue siendo perfectamente cazable.

### La validación

Con esos ajustes, el bot completó el nivel V matando al jefe final con **tres golpes a los 26,
45 y 55 segundos, sin morir ni una vez, con la barra de progreso al 46 %**. Exactamente el arco
que buscaba: la pelea es la forma natural de terminar el nivel, dura cerca del minuto estimado y
la barra de progreso queda como camino alternativo.

Con honestidad: en otra ejecución el mismo bot murió cinco veces sin conseguirlo. El nivel V es
claramente el más difícil del juego, y eso es intencional, pero si al jugarlo resulta excesivo
hay dos perillas de una línea: bajar la vida del jefe de 3 a 2, o abaratar la carga de rage de
8 a 6 objetos.

---

## 16. Lo que quedó fuera

Cosas que consideré y decidí no hacer, por si algún día retomo el proyecto:

- **Comportamientos propios por jefe.** Los tres jefes se distinguen por aspecto, tamaño,
  velocidad y vida, pero comparten la misma lógica de persecución. Darle al Segador una embestida
  corta o al Monarca una anticipación mayor sería el siguiente paso natural, y la tabla de
  identidades ya está preparada para ello.
- **Guardado de partida y récords.** No hay persistencia: cada sesión empieza en el nivel I.
- **Vidas o continues.** Morir reinicia el nivel, sin más. La puntuación vuelve al valor con el
  que entraste al nivel, para que morir no sea una forma de farmear puntos.
- **Soporte de orientación vertical en móvil.** Preferí un aviso para girar el dispositivo antes
  que rehacer el equilibrio de la cámara para una pantalla alta y estrecha.
- **Música.** Hay efectos de sonido sintetizados, pero no una banda sonora.

---

## Cierre

Si tuviera que quedarme con tres cosas de todo el proceso:

La primera es que **separar responsabilidades se paga solo**. Que solo un módulo toque el DOM y
solo uno lea la entrada hizo que añadir la vida del jefe al HUD y los controles táctiles enteros
fueran cambios pequeños y locales, en un proyecto donde podrían haber sido cirugía.

La segunda es que **medir cambia las prioridades**. Habría jurado que el cuello de botella
estaba en las partículas; resultó ser un desenfoque de sombra sobre un rectángulo gigante que
ni siquiera se notaba en pantalla.

Y la tercera es que **el balance no se adivina**. Las cuentas del nivel V parecían razonables
sobre el papel y hacían la pelea imposible. Solo verlo jugar, aunque fuera a un bot torpe, lo
dejó en evidencia.
