# Práctica de Tablas

Juego web para practicar las **tablas de multiplicar** (del 1 al 10) con varios modos:
enseñanza, práctica, memoria y visualización. Es 100% estático (HTML + CSS + JS
vanilla), **sin dependencias, sin build y sin backend**. Se abre haciendo doble click
en `index.html` o sirviéndolo desde cualquier hosting estático (GitHub Pages, etc.).

> Este README está pensado como **handoff para otro agente/IA** que quiera seguir
> mejorando el juego. Explica la arquitectura, cada modo, las convenciones y una lista
> de ideas. Leelo entero antes de tocar código.

---

## Cómo correrlo

- **Local:** abrí `index.html` en el navegador. No hace falta servidor.
- **GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main` → `/(root)`.
  Como las rutas a `style.css` y `script.js` son **relativas**, funciona en la raíz o en
  cualquier subruta.

No hay tests, ni linter, ni paso de compilación. Editar y recargar.

### Móvil / PWA
- El layout es **responsive**: en celular la sidebar pasa arriba y la grilla (12 columnas)
  se ajusta al ancho con `--cell: clamp(...)` (ver media queries en `style.css`).
- Es **instalable** ("Agregar a pantalla de inicio") y funciona **offline** vía
  `manifest.webmanifest` + `sw.js`. El service worker **solo corre por http/https**
  (GitHub Pages sirve), no con `file://`.
- El `sw.js` usa estrategia **network-first**: con internet siempre baja la última versión
  (y actualiza el cache), y sin internet sirve lo último cacheado. **No hay que subir ningún
  número de versión**: los cambios se reflejan solos al hacer push + recargar.
- **Ojo con el cache HTTP**: GitHub Pages manda `Cache-Control: max-age=600`, así que un
  `fetch()` común se resuelve desde el cache del navegador y podés ver hasta 10 minutos de
  atraso — el "network-first" queda en la nada. Por eso `fetchFresh()` pide con
  `cache: "reload"`. Si algún día no ves un cambio en el celu, ese es el primer lugar donde
  mirar.

---

## Estructura de archivos

```
practica-tablas/
├── index.html            # Estructura: sidebar (tabs + panel de info) + tablero + modal + cartel de victoria
├── style.css             # Todo el estilo. Tema oscuro. Variables CSS en :root. Layout de 2 columnas + responsive.
├── script.js             # Toda la lógica. Vanilla JS, sin módulos. Un solo archivo.
├── manifest.webmanifest  # PWA: nombre, colores, ícono (para "agregar a pantalla de inicio").
├── sw.js                 # Service worker: network-first real (cache: "reload"), cache solo offline.
└── icon.svg              # Ícono de la app (SVG, texto plano). Usado por manifest y apple-touch-icon.
```

### `index.html`
- **`.app`**: contenedor flex de 2 columnas.
  - **`.sidebar`** (izquierda, sticky): header, `.tabs` (una `.tab` por modo), `.info-panel`
    (status, barra de progreso, leyenda del heatmap, switch de espejo, botón Memotest,
    botón Reiniciar) y `.hint`.
  - **`.board-wrap`** → **`#board`**: la grilla, generada por JS.
- **`#modal`**: popup para escribir el resultado (modo Operación → Resultado).
- **`#win-banner`**: cartel de "¡Completaste el tablero!" con confeti.

### `style.css`
- Variables de color en `:root` (`--accent`, `--good`, `--bad`, `--text`, etc.).
- Grilla con CSS Grid (`#board`).
- Cartas con volteo 3D (`.card` + `.card-face` + `transform: rotateY`).
- Responsive: en < 900px la sidebar pasa arriba; en < 560px achica celdas.

### `script.js`
Un solo archivo con todo. Secciones marcadas con comentarios `// ===== ... =====`.

---

## Arquitectura general

Todo gira alrededor de una variable global **`mode`** y una función **`resetGame()`**.

- **`mode`** ∈ `"op-to-result" | "result-to-op" | "mirror" | "heatmap" | "neighbors" | "same"`.
  Se setea al hacer click en una `.tab` (cada tab tiene `data-mode`).
- Para el modo `"same"` hay un submodo **`sameSub`** ∈ `"explore" | "memotest"`,
  alternado por el botón `#same-toggle`.
- **`resetGame()`** es el punto central: limpia estado, llama a `buildBoard()`, decide qué
  UI mostrar (leyenda, progreso, switch, botón) y ajusta textos con `setStatusAndHint()`.
- **`buildBoard()`** dibuja la grilla 11×11 (encabezados 1–10 + 100 celdas). Según el modo
  crea celdas distintas:
  - `makeCell(r,c)` → carta con volteo (modos op-to-result / result-to-op / mirror).
  - `makeHeatCell(r,c)` → celda coloreada (modos heatmap / neighbors / same-explore).
  - `makeMemoGridCell(r,c,active)` → carta tapada con "?" (modo same-memotest).

Cada celda guarda `data-r`, `data-c` y `data-product` (= r*c). Helper `key(r,c)` → `"r,c"`.

### Estado (variables globales relevantes)
- `solved` (Set de `"r,c"`): celdas resueltas en los modos con `updateProgress()`.
- `currentTarget`, `targetCells`: modo Resultado → Operación.
- `firstPick`: modo Espejo (la primera carta destapada).
- `activeCell`: celda cuyo modal está abierto.
- `sameSub`, `memoFirst`, `memoLock`, `memoMatched`, `memoTarget`: modo Iguales/Memotest.

---

## Los 6 modos (qué hacen y dónde está el código)

### 1. Operación → Resultado (`op-to-result`)
Click en una carta → `openModal()` abre el popup → al enviar (`answerForm submit`) compara
con `r*c`. Si acierta, voltea la carta (`flip`), la marca `done`, suma a `solved` y actualiza
progreso. Si falla, `shake()`.

### 2. Resultado → Operación (`result-to-op`)
`pickNewTarget()` elige un resultado al azar entre las celdas no resueltas y pide encontrar
**todas** las que dan ese número. `handleResultMode()` valida cada click. Cuando encontrás
todas las de un target, elige otro.

### 3. Espejo (`mirror`)
Memotest de la simetría de la diagonal (a×b = b×a). `handleMirrorMode()`: primer click revela
el resultado; hay que encontrar el espejo (c×r). Las celdas de la diagonal (n×n) se resuelven
con un solo click. Progreso/victoria vía `computeTotals()` + `checkWin()`.

### 4. Heatmap (`heatmap`)
Solo visualización (no interactivo salvo hover). `makeHeatCell()` colorea cada celda con
`heatColor(p)` (frío azul en los resultados chicos → cálido rojo cerca de 100). La **diagonal** se resalta
(`.diagonal-heat`), el **triángulo inferior** (`r>c`, `.tri-lower`) se ve más brilloso y el
**superior** (`r<c`, `.tri-upper`) más apagado, para mostrar la simetría. Muestra `#legend`.

### 5. Vecinos / saltos (`neighbors`)
Apoyado en el heatmap. `focusCell()` al hacer click en una celda:
- Atenúa el resto (`.dimmed` en el board), resalta la **fila y columna** (`.in-row`/`.in-col`).
- Pone **badges de salto** (`.step-badge`) en los 4 vecinos ortogonales (`addStepBadge()`):
  un paso a la derecha suma la **fila**, un paso hacia abajo suma la **columna**
  (ej. sé 6×5=30 → +6 → 6×6=36).
- Marca con borde punteado (`.iso`) las celdas que dan el **mismo resultado** (cluster).
- Volver a tocar la misma celda = quitar foco (`clearFocus()`).

### 6. Iguales (`same`) — con submodo Memotest
- **Explorar (`sameSub="explore"`)**: `highlightSame()` — al tocar una celda resalta **todas**
  las que dan ese mismo resultado (`.iso`) y atenúa el resto. Reutiliza el estilo del heatmap.
- **Memotest (`sameSub="memotest"`)**: juego de memoria **sobre la misma grilla**. Todas las
  celdas quedan dadas vuelta con "?" (`makeMemoGridCell`).
  `onMemoClick()`: destapás dos; si dan el **mismo resultado**, quedan emparejadas (`matched`).
  La cara de atrás tiene dos partes: `.memo-main` (arriba) y `.memo-sub` (abajo, chiquita).
  Destapada muestra la operación en `.memo-main` y `.memo-sub` vacía; al emparejar,
  `matchMemoCell()` pasa el **resultado** a `.memo-main` y la **operación** a `.memo-sub`,
  para que quede a la vista de dónde salió ese número. La celda toma además el **color que ese
  resultado tiene en el heatmap** (`--memo-color`) y el color de texto que contrasta con él
  (`--memo-text`), así el tablero terminado se parece al modo Heatmap.
  Detalles importantes:
  - Los resultados **únicos** (1, 25, 49, 64, 81, 100 — los cuadrados sin otra
    factorización dentro del rango) se muestran con "?" pero no cuentan para ganar
    (no tienen par). Por eso el objetivo es **94** y no 100.
  - Los resultados con **cantidad impar de celdas** (ej. 16 = 2×8, 8×2, 4×4): emparejás dos y
    la que queda **suelta** se cierra destapándola y tocando una del mismo resultado **ya
    emparejada** (ver el `if (cell.classList.contains("matched"))` en `onMemoClick`).
  - El **switch** `#hide-mirror-input` ("Apagar mitad de arriba (espejo)") saca el triángulo
    superior (`r<c`) para dejar pares más limpios. `computeMemoData()` respeta ese switch.
  - Objetivo (`memoTarget`) = cantidad de celdas cuyo resultado aparece 2+ veces.

---

## Config y utilidades clave

- **`MIN` / `MAX`** (líneas ~2-3): rango de la tabla, hoy **1 a 10**. Para llegar hasta el 12,
  poné `MAX = 12`; para incluir la tabla del 0, `MIN = 0`. El resto (grilla, colores,
  memotest, totales) se adapta solo. `MAX_PRODUCT = MAX*MAX` (para el color).
  Ojo: los textos que dicen "del 1 al 10" (`index.html`, `manifest.webmanifest`) son
  literales y hay que cambiarlos a mano.
- **`heatHsl(value)`**: la fuente de verdad del color — devuelve `{h, s, l}` (h de 240° azul
  a 0° rojo según `value/MAX_PRODUCT`).
- **`heatColor(value)`**: el `hsl(...)` listo para CSS.
- **`heatTextColor(value)`**: `#0b1220` o `#f8fafc` según la luminancia del fondo. Hace falta
  porque la escala arranca en azul oscuro, pasa por verdes/amarillos claros y termina en rojo
  oscuro: **ningún color de texto fijo se lee en todo el rango**. Los 42 resultados posibles
  quedan en AA (≥4.5:1); el peor es el 12 con 4.59:1. Si tocás `heatHsl`, revisá esto.
- **`showWin()` + `launchConfetti()`**: cartel de victoria + confeti mínimo (CSS `.confetti`).

### Foco compartido (Vecinos e Iguales)
Los dos modos con "enfocar una celda y atenuar el resto" usan los mismos helpers:

- **`startFocus(cell)`**: aplica `.dimmed` + `.focus` y devuelve `{r, c, p}`; devuelve
  `null` si la celda ya estaba enfocada (tocar de nuevo = volver a la vista completa).
- **`markSameResult(cell, p)`**: marca `.iso` en las demás celdas que dan `p` y devuelve
  cuántas marcó.
- **`isVisibleCell(cell)`**: `false` para el triángulo de arriba cuando el switch de espejo
  está prendido (esas celdas son `visibility: hidden`, no se resaltan ni se cuentan).
- **`clearFocus()`**: limpia clases de foco y saca los `.step-badge`.

---

## Convenciones / reglas para el próximo agente

1. **Mantener vanilla**: nada de frameworks, bundlers ni dependencias. Debe seguir abriéndose
   con doble click y funcionar en GitHub Pages sin build.
2. **Un solo archivo JS, un solo CSS**: no fragmentar salvo que crezca mucho. Si crece,
   proponerlo antes.
3. **UI en español** (rioplatense: "practicá", "tocá", "seguí"). Mantener el tono.
4. **Rutas relativas** en `index.html` (no absolutas) para que ande en cualquier subpath.
5. **Rendimiento**: `buildBoard()` recrea el DOM entero en cada `resetGame()`. Está bien para
   11×11. Si se agranda mucho la grilla, considerar no recrear todo.
6. **Clases CSS que importan** (no romperlas): `.cell`, `.card/.card-face/.card-front/.card-back/.flipped`,
   `.diagonal`, `.diagonal-heat/.tri-lower/.tri-upper`, `.dimmed`, `.focus/.in-row/.in-col/.neighbor/.iso`,
   `.step-badge`, `.memo-cover/.memo-op/.memo-main/.memo-sub/.matched/.memo-blank`, `.hide-mirror`,
   `.confetti`.
7. **Al agregar un modo nuevo**: (a) agregar una `.tab` con `data-mode` en `index.html`,
   (b) manejar el `mode` en `buildBoard`, `setStatusAndHint`, `resetGame` y `checkWin`,
   (c) crear su `makeXCell` o su handler de click.

---

## Ideas de mejora (roadmap sugerido)

Cosas que quedaron pendientes o que suman valor educativo, ordenadas de más fácil a más ambicioso:

- **Cronómetro y contador de aciertos/errores** por partida (y mejor tiempo guardado en
  `localStorage`).
- **Elegir qué tabla practicar** (solo la del 7, por ejemplo) o rango personalizado (MIN/MAX
  desde la UI).
- **Sonidos** opcionales (acierto/error/victoria) con toggle.
- **Persistencia**: guardar progreso y preferencias (modo, switch espejo) en `localStorage`.
- **Modo contrarreloj** / desafío diario.
- **Vecinos con 8 direcciones** (incluir diagonales, ej. 5×5 → 6×6) y **flechas dibujadas**
  entre ancla y vecino (SVG) en vez de solo badges.
- **Accesibilidad**: navegación por teclado en la grilla, `aria-*`, foco visible, contraste.
- **Animaciones**: transición al cambiar de modo; feedback más rico en aciertos.
- **PWA** (✅ hecho): manifest + service worker. Mejora pendiente: aviso de "hay una versión
  nueva, recargá" cuando cambia el service worker.
- **i18n**: separar los textos para poder traducir (hoy están hardcodeados en español).
- **Tests**: no hay suite en el repo (a propósito: cero dependencias). Si necesitás verificar
  un cambio, `jsdom` **fuera del repo** alcanza para un smoke test completo: cargás
  `index.html`, hacés `window.eval(script.js)` y disparás clicks sobre las tabs y las celdas.
  Así se validaron el pase a MIN=1 y el refactor del foco. Nota: jsdom normaliza los
  `hsl()` de `heatColor` a `rgb()` al leer `style.backgroundColor`.

---

## Notas de contexto

- El proyecto nació como práctica para un chico aprendiendo las tablas; priorizar **claridad
  visual** y **memoria por asociación** (de ahí los modos Vecinos, Heatmap e Iguales).
- La idea pedagógica central: la tabla es **simétrica en la diagonal** y los resultados están
  **relacionados por saltos** (sumar la fila/columna). Muchos modos refuerzan eso visualmente.
