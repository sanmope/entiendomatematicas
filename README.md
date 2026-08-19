# Práctica de Tablas

Juego web para practicar las **tablas de multiplicar** (del 0 al 10) con varios modos:
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

---

## Estructura de archivos

```
practica-tablas/
├── index.html   # Estructura: sidebar (tabs + panel de info) + tablero + modal + cartel de victoria
├── style.css    # Todo el estilo. Tema oscuro. Variables CSS en :root. Layout de 2 columnas.
└── script.js    # Toda la lógica. Vanilla JS, sin módulos. Un solo archivo.
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
- **`buildBoard()`** dibuja la grilla 11×11 (encabezados 0–10 + celdas). Según el modo
  crea celdas distintas:
  - `makeCell(r,c)` → carta con volteo (modos op-to-result / result-to-op / mirror).
  - `makeHeatCell(r,c)` → celda coloreada (modos heatmap / neighbors / same-explore).
  - `makeMemoGridCell(r,c,active)` → carta tapada con "?" (modo same-memotest).

Cada celda guarda `data-r`, `data-c` y `data-product` (= r*c). Helper `key(r,c)` → `"r,c"`.

### Estado (variables globales relevantes)
- `solved` (Set de `"r,c"`): celdas resueltas en los modos con `updateProgress()`.
- `currentTarget`, `targetCells`: modo Resultado → Operación.
- `firstPick`, `matchedPairs`: modo Espejo.
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
`heatColor(p)` (frío azul cerca de 0 → cálido rojo cerca de 100). La **diagonal** se resalta
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
  celdas (menos la fila/columna del 0) quedan dadas vuelta con "?" (`makeMemoGridCell`).
  `onMemoClick()`: destapás dos; si dan el **mismo resultado**, quedan emparejadas (`matched`).
  Detalles importantes:
  - Los resultados **únicos** (5×5=25, 7×7=49, etc.) se muestran con "?" pero no cuentan
    para ganar (no tienen par).
  - Los resultados con **cantidad impar de celdas** (ej. 16 = 2×8, 8×2, 4×4): emparejás dos y
    la que queda **suelta** se cierra destapándola y tocando una del mismo resultado **ya
    emparejada** (ver el `if (cell.classList.contains("matched"))` en `onMemoClick`).
  - El **switch** `#hide-mirror-input` ("Apagar mitad de arriba (espejo)") saca el triángulo
    superior (`r<c`) para dejar pares más limpios. `computeMemoData()` respeta ese switch.
  - Objetivo (`memoTarget`) = cantidad de celdas cuyo resultado aparece 2+ veces.

---

## Config y utilidades clave

- **`MIN` / `MAX`** (líneas ~2-3): rango de la tabla. Para cambiar a "0 al 12", poné `MAX = 12`.
  El resto (grilla, colores, memotest) se adapta solo. `MAX_PRODUCT = MAX*MAX` (para el color).
- **`heatColor(value)`**: HSL de 240° (azul) a 0° (rojo) según `value/MAX_PRODUCT`.
- **`shuffle(arr)`**: Fisher–Yates (por si se necesita barajar).
- **`showWin()` + `launchConfetti()`**: cartel de victoria + confeti mínimo (CSS `.confetti`).

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
   `.step-badge`, `.memo-cover/.memo-op/.matched/.memo-blank`, `.hide-mirror`, `.confetti`.
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
- **PWA**: manifest + service worker para instalarlo y usarlo offline en el celu.
- **i18n**: separar los textos para poder traducir (hoy están hardcodeados en español).
- **Tests**: al no haber build, se podría agregar un set mínimo de pruebas de la lógica pura
  (`heatColor`, `computeMemoData`, emparejamientos) extrayéndola a funciones testeables.

---

## Notas de contexto

- El proyecto nació como práctica para un chico aprendiendo las tablas; priorizar **claridad
  visual** y **memoria por asociación** (de ahí los modos Vecinos, Heatmap e Iguales).
- La idea pedagógica central: la tabla es **simétrica en la diagonal** y los resultados están
  **relacionados por saltos** (sumar la fila/columna). Muchos modos refuerzan eso visualmente.
