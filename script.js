// ===== Configuración =====
const MIN = 0;
const MAX = 10;
const NUMS = [];
for (let n = MIN; n <= MAX; n++) NUMS.push(n);
const MAX_PRODUCT = MAX * MAX;

// ===== Referencias al DOM =====
const board = document.getElementById("board");
const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const legend = document.getElementById("legend");
const resetBtn = document.getElementById("reset-btn");
const sameToggle = document.getElementById("same-toggle");
const hideMirrorRow = document.getElementById("hide-mirror-row");
const hideMirrorInput = document.getElementById("hide-mirror-input");
const tabs = document.querySelectorAll(".tab");

const modal = document.getElementById("modal");
const modalQuestion = document.getElementById("modal-question");
const modalFeedback = document.getElementById("modal-feedback");
const answerForm = document.getElementById("answer-form");
const answerInput = document.getElementById("answer-input");
const modalCancel = document.getElementById("modal-cancel");

const winBanner = document.getElementById("win-banner");
const winText = document.getElementById("win-text");
const winAgain = document.getElementById("win-again");

// ===== Estado =====
let mode = "op-to-result";
let solved = new Set();
let totalSolvable = 0;

// Modo resultado -> operación
let currentTarget = null;
let targetCells = [];

// Modo espejo
let firstPick = null;
let matchedPairs = 0;
let totalPairs = 0;

// Celda del modal activo
let activeCell = null;

// Modo Iguales / Memotest
let sameSub = "explore"; // "explore" | "memotest"
let memoFirst = null;
let memoLock = false;
let memoMatched = 0;
let memoTarget = 0;

const key = (r, c) => `${r},${c}`;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== Color del heatmap (frío 0 -> cálido 100) =====
function heatColor(value) {
  const t = Math.max(0, Math.min(1, value / MAX_PRODUCT));
  const hue = 240 - 240 * t; // 240 azul -> 0 rojo
  const light = 42 + 12 * Math.sin(Math.PI * t); // un poco más claro en el medio
  return `hsl(${hue}, 78%, ${light}%)`;
}

// ===== Construcción del tablero =====
function buildBoard() {
  board.innerHTML = "";
  board.classList.remove("dimmed");
  board.style.gap = "";
  const size = NUMS.length + 1;
  board.style.gridTemplateColumns = `repeat(${size}, auto)`;

  const memotest = mode === "same" && sameSub === "memotest";
  let memoActive = null;
  if (memotest) {
    memoFirst = null;
    memoLock = false;
    memoMatched = 0;
    const data = computeMemoData();
    memoActive = data.active;
    memoTarget = data.target;
  }

  const corner = document.createElement("div");
  corner.className = "head-cell corner-cell";
  corner.textContent = "×";
  board.appendChild(corner);

  for (const c of NUMS) {
    const h = document.createElement("div");
    h.className = "head-cell";
    h.textContent = c;
    board.appendChild(h);
  }

  const useHeatStyle = mode === "heatmap" || mode === "neighbors" || mode === "same";
  for (const r of NUMS) {
    const rowHead = document.createElement("div");
    rowHead.className = "head-cell";
    rowHead.textContent = r;
    board.appendChild(rowHead);

    for (const c of NUMS) {
      if (memotest) {
        board.appendChild(makeMemoGridCell(r, c, memoActive));
      } else if (useHeatStyle) {
        board.appendChild(makeHeatCell(r, c));
      } else {
        board.appendChild(makeCell(r, c));
      }
    }
  }
}

function makeCell(r, c) {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.dataset.r = r;
  cell.dataset.c = c;
  cell.dataset.product = r * c;

  if (r === c) cell.classList.add("diagonal");

  const card = document.createElement("div");
  card.className = "card";

  const front = document.createElement("div");
  front.className = "card-face card-front";
  front.textContent = `${r}×${c}`;

  const back = document.createElement("div");
  back.className = "card-face card-back";
  back.textContent = r * c;

  card.appendChild(front);
  card.appendChild(back);
  cell.appendChild(card);

  cell.addEventListener("click", () => onCellClick(cell));
  return cell;
}

function makeHeatCell(r, c) {
  const p = r * c;
  const cell = document.createElement("div");
  cell.className = "cell heat";
  if (r === c) cell.classList.add("diagonal-heat");
  else if (r > c) cell.classList.add("tri-lower");
  else cell.classList.add("tri-upper");
  cell.dataset.r = r;
  cell.dataset.c = c;
  cell.style.backgroundColor = heatColor(p);
  cell.title = `${r} × ${c} = ${p}`;

  const val = document.createElement("span");
  val.className = "heat-value";
  val.textContent = p;

  const op = document.createElement("span");
  op.className = "heat-op";
  op.textContent = `${r}×${c}`;

  cell.appendChild(val);
  cell.appendChild(op);

  if (mode === "neighbors") {
    cell.classList.add("clickable");
    cell.addEventListener("click", () => focusCell(cell));
  } else if (mode === "same") {
    cell.classList.add("clickable");
    cell.addEventListener("click", () => highlightSame(cell));
  }

  return cell;
}

// ===== Modo Iguales: resaltar el mismo resultado =====
function highlightSame(cell) {
  const wasFocused = cell.classList.contains("focus");
  clearFocus();
  if (wasFocused) {
    setStatusAndHint();
    return;
  }

  const r = +cell.dataset.r;
  const c = +cell.dataset.c;
  const p = r * c;

  board.classList.add("dimmed");
  cell.classList.add("focus");

  let count = 1;
  board.querySelectorAll(".cell").forEach((o) => {
    if (o === cell) return;
    if (+o.dataset.r * +o.dataset.c === p) {
      o.classList.add("iso");
      count++;
    }
  });

  statusEl.innerHTML =
    `<span class="target">${r}×${c} = ${p}</span><br>` +
    `<span style="color:var(--text-dim)">${count} celda(s) dan ${p} (resaltadas).</span>`;
}

// ===== Memotest (sobre la grilla): emparejar operaciones con igual resultado =====
// Todas las celdas (menos ×0) quedan jugables con "?". Devuelve las celdas activas
// y cuántos pares se pueden formar (para el progreso/victoria).
function computeMemoData() {
  const hide = hideMirrorInput.checked;
  const active = new Set();
  const counts = {};
  for (let r = 1; r <= MAX; r++) {
    for (let c = 1; c <= MAX; c++) {
      if (hide && r < c) continue; // sin la mitad de arriba (espejo)
      active.add(key(r, c));
      const p = r * c;
      counts[p] = (counts[p] || 0) + 1;
    }
  }
  // Objetivo = todas las celdas cuyo resultado aparece 2+ veces (incluye grupos impares completos)
  let target = 0;
  for (const p in counts) if (counts[p] >= 2) target += counts[p];
  return { active, target };
}

function makeMemoGridCell(r, c, active) {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.dataset.r = r;
  cell.dataset.c = c;
  cell.dataset.product = r * c;
  if (r === c) cell.classList.add("diagonal");
  else if (r > c) cell.classList.add("tri-lower");
  else cell.classList.add("tri-upper");

  // Sin ×0 y sin las celdas no activas (mitad espejada apagada): quedan en blanco.
  if (r === 0 || c === 0 || !active.has(key(r, c))) {
    cell.classList.add("memo-blank");
    return cell;
  }

  const card = document.createElement("div");
  card.className = "card";

  const front = document.createElement("div");
  front.className = "card-face card-front memo-cover";
  front.textContent = "?";

  const back = document.createElement("div");
  back.className = "card-face card-back memo-op";
  back.textContent = `${r}×${c}`;

  card.appendChild(front);
  card.appendChild(back);
  cell.appendChild(card);
  cell.addEventListener("click", () => onMemoClick(cell));
  return cell;
}

function matchMemoCell(cell) {
  const p = +cell.dataset.product;
  cell.style.setProperty("--memo-color", heatColor(p));
  cell.classList.remove("revealed");
  cell.classList.add("matched");
  cell.querySelector(".card").classList.add("flipped");
  cell.querySelector(".memo-op").textContent = `= ${p}`;
  memoMatched++;
}

function onMemoClick(cell) {
  if (memoLock) return;
  if (cell.classList.contains("revealed")) return; // ya es el primero destapado

  // Tocar una celda ya emparejada sirve para cerrar una celda huérfana del mismo resultado
  if (cell.classList.contains("matched")) {
    if (memoFirst && +cell.dataset.product === +memoFirst.dataset.product) {
      matchMemoCell(memoFirst);
      memoFirst = null;
      afterMemoMatch(+cell.dataset.product);
    }
    return;
  }

  cell.classList.add("revealed");
  cell.querySelector(".card").classList.add("flipped");

  if (!memoFirst) {
    memoFirst = cell;
    return;
  }
  if (cell === memoFirst) return;

  const p1 = +memoFirst.dataset.product;
  const p2 = +cell.dataset.product;

  if (p1 === p2) {
    matchMemoCell(memoFirst);
    matchMemoCell(cell);
    memoFirst = null;
    afterMemoMatch(p1);
  } else {
    memoLock = true;
    statusEl.innerHTML = `${p1} ≠ ${p2}, no coinciden. ¡Probá de nuevo!`;
    const first = memoFirst;
    memoFirst = null;
    setTimeout(() => {
      first.classList.remove("revealed");
      cell.classList.remove("revealed");
      first.querySelector(".card").classList.remove("flipped");
      cell.querySelector(".card").classList.remove("flipped");
      memoLock = false;
    }, 900);
  }
}

function afterMemoMatch(product) {
  updateMemoProgress();
  statusEl.innerHTML = `¡Bien! Coinciden en <span class="target">${product}</span> 🎉`;
  if (memoMatched >= memoTarget) showWin();
}

function updateMemoProgress() {
  const pct = memoTarget ? Math.round((memoMatched / memoTarget) * 100) : 0;
  progressFill.style.width = pct + "%";
  progressText.textContent = `${memoMatched} / ${memoTarget}`;
}

// ===== Modo Vecinos: enfoque + saltos =====
function clearFocus() {
  board.classList.remove("dimmed");
  board.querySelectorAll(".cell").forEach((c) => {
    c.classList.remove("focus", "in-row", "in-col", "neighbor", "iso");
    const badge = c.querySelector(".step-badge");
    if (badge) badge.remove();
  });
}

function addStepBadge(nr, nc, focusR, focusC) {
  const neighbor = getCell(nr, nc);
  if (!neighbor) return null;
  neighbor.classList.add("neighbor");
  const np = nr * nc;
  const fp = focusR * focusC;
  const diff = fp - np; // cuánto sumar para llegar al foco
  const arrow =
    nc < focusC ? "→" : nc > focusC ? "←" : nr < focusR ? "↓" : "↑";
  const sign = diff >= 0 ? "+" : "−";
  const badge = document.createElement("span");
  badge.className = "step-badge";
  badge.textContent = `${sign}${Math.abs(diff)} ${arrow}`;
  neighbor.appendChild(badge);
  return { nr, nc, np };
}

function focusCell(cell) {
  // Si toco la celda que ya estaba enfocada, quito el foco y vuelvo a la vista completa
  const wasFocused = cell.classList.contains("focus");
  clearFocus();
  if (wasFocused) {
    setStatusAndHint();
    return;
  }

  const r = +cell.dataset.r;
  const c = +cell.dataset.c;
  const p = r * c;

  board.classList.add("dimmed");
  cell.classList.add("focus");

  board.querySelectorAll(".cell").forEach((o) => {
    if (o === cell) return;
    const or = +o.dataset.r;
    const oc = +o.dataset.c;
    if (or === r) o.classList.add("in-row");
    if (oc === c) o.classList.add("in-col");
    if (or * oc === p) o.classList.add("iso");
  });

  const left = addStepBadge(r, c - 1, r, c);
  const right = addStepBadge(r, c + 1, r, c);
  const up = addStepBadge(r - 1, c, r, c);
  const down = addStepBadge(r + 1, c, r, c);

  // Contar el cluster de mismo resultado (sin contar el foco)
  const isoCount = board.querySelectorAll(".cell.iso").length;

  const parts = [`<span class="target">${r}×${c} = ${p}</span>`];
  if (left) parts.push(`desde ${r}×${c - 1}=${left.np} sumás ${r}`);
  if (up) parts.push(`desde ${r - 1}×${c}=${up.np} sumás ${c}`);
  let msg = parts.join(" · ");
  if (isoCount > 0) {
    msg += `<br><span style="color:var(--text-dim)">También dan ${p}: ${isoCount} celda(s) más (borde punteado).</span>`;
  }
  statusEl.innerHTML = msg;
}

function getCell(r, c) {
  return board.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function flip(cell) {
  cell.querySelector(".card").classList.add("flipped");
}

function shake(cell) {
  cell.classList.add("shake");
  setTimeout(() => cell.classList.remove("shake"), 350);
}

// ===== Clicks según modo =====
function onCellClick(cell) {
  if (cell.classList.contains("done")) return;
  if (mode === "op-to-result") openModal(cell);
  else if (mode === "result-to-op") handleResultMode(cell);
  else if (mode === "mirror") handleMirrorMode(cell);
}

// ---- Modo 1: Operación -> Resultado ----
function openModal(cell) {
  activeCell = cell;
  const r = +cell.dataset.r;
  const c = +cell.dataset.c;
  modalQuestion.textContent = `${r} × ${c} = ?`;
  modalFeedback.textContent = "";
  modalFeedback.className = "modal-feedback";
  answerInput.value = "";
  modal.hidden = false;
  setTimeout(() => answerInput.focus(), 50);
}

function closeModal() {
  modal.hidden = true;
  activeCell = null;
}

answerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!activeCell) return;
  const r = +activeCell.dataset.r;
  const c = +activeCell.dataset.c;
  const expected = r * c;
  const got = Number(answerInput.value);

  if (answerInput.value.trim() === "" || Number.isNaN(got)) {
    modalFeedback.textContent = "Escribí un número.";
    modalFeedback.className = "modal-feedback bad";
    return;
  }

  if (got === expected) {
    modalFeedback.textContent = "¡Correcto! 🎉";
    modalFeedback.className = "modal-feedback good";
    const cell = activeCell;
    flip(cell);
    cell.classList.add("done");
    solved.add(key(r, c));
    updateProgress();
    setTimeout(closeModal, 500);
    checkWin();
  } else {
    modalFeedback.textContent = "Casi... probá de nuevo 🤔";
    modalFeedback.className = "modal-feedback bad";
    shake(activeCell);
    answerInput.select();
  }
});

modalCancel.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

// ---- Modo 2: Resultado -> Operación ----
function pickNewTarget() {
  const remaining = {};
  for (const r of NUMS) {
    for (const c of NUMS) {
      if (solved.has(key(r, c))) continue;
      const p = r * c;
      (remaining[p] = remaining[p] || []).push([r, c]);
    }
  }
  const products = Object.keys(remaining);
  if (products.length === 0) {
    currentTarget = null;
    return;
  }
  const chosen = products[Math.floor(Math.random() * products.length)];
  currentTarget = Number(chosen);
  targetCells = remaining[chosen].map(([r, c]) => key(r, c));
  statusEl.innerHTML = `Buscá todas las que dan <span class="target">${currentTarget}</span>`;
}

function handleResultMode(cell) {
  const r = +cell.dataset.r;
  const c = +cell.dataset.c;
  const p = r * c;

  if (p === currentTarget) {
    if (solved.has(key(r, c))) return;
    flip(cell);
    cell.classList.add("done");
    solved.add(key(r, c));
    targetCells = targetCells.filter((k) => k !== key(r, c));
    updateProgress();

    if (targetCells.length === 0) {
      statusEl.innerHTML = `¡Encontraste todas las de <span class="target">${currentTarget}</span>! 👏`;
      if (!checkWin()) setTimeout(pickNewTarget, 900);
    }
  } else {
    shake(cell);
    statusEl.innerHTML = `${r}×${c} = ${p}, no es <span class="target">${currentTarget}</span>. ¡Seguí!`;
    setTimeout(() => {
      if (currentTarget !== null) {
        statusEl.innerHTML = `Buscá todas las que dan <span class="target">${currentTarget}</span>`;
      }
    }, 1400);
  }
}

// ---- Modo 3: Espejo (Memotest) ----
function handleMirrorMode(cell) {
  const r = +cell.dataset.r;
  const c = +cell.dataset.c;

  if (r === c) {
    if (cell.classList.contains("done")) return;
    flip(cell);
    cell.classList.add("done");
    solved.add(key(r, c));
    updateProgress();
    checkWin();
    return;
  }

  if (cell.classList.contains("done")) return;

  if (!firstPick) {
    firstPick = cell;
    cell.classList.add("selected", "revealed");
    cell.querySelector(".card-front").textContent = `= ${r * c}`;
    statusEl.innerHTML = `Da <span class="target">${r * c}</span>. Buscá el espejo (${c}×${r}).`;
    return;
  }

  if (cell === firstPick) {
    resetPick();
    return;
  }

  const fr = +firstPick.dataset.r;
  const fc = +firstPick.dataset.c;
  const isMirror = r === fc && c === fr;

  if (isMirror) {
    flip(firstPick);
    flip(cell);
    firstPick.classList.remove("selected", "revealed");
    firstPick.querySelector(".card-front").textContent = `${fr}×${fc}`;
    firstPick.classList.add("done");
    cell.classList.add("done");
    solved.add(key(fr, fc));
    solved.add(key(r, c));
    matchedPairs++;
    firstPick = null;
    updateProgress();
    statusEl.innerHTML = `¡Par! ${fr}×${fc} = ${c}×${r} = <span class="target">${r * c}</span>`;
    checkWin();
  } else {
    shake(cell);
    statusEl.innerHTML = `${r}×${c} no es el espejo. El espejo de ${fr}×${fc} es ${fc}×${fr}.`;
  }
}

function resetPick() {
  if (firstPick) {
    const fr = +firstPick.dataset.r;
    const fc = +firstPick.dataset.c;
    firstPick.classList.remove("selected", "revealed");
    firstPick.querySelector(".card-front").textContent = `${fr}×${fc}`;
    firstPick = null;
  }
}

// ===== Progreso / victoria =====
function computeTotals() {
  if (mode === "mirror") {
    const diag = NUMS.length;
    const offDiag = NUMS.length * NUMS.length - diag;
    totalPairs = offDiag / 2;
    totalSolvable = offDiag + diag;
  } else {
    totalSolvable = NUMS.length * NUMS.length;
  }
}

function updateProgress() {
  const done = solved.size;
  const pct = totalSolvable ? Math.round((done / totalSolvable) * 100) : 0;
  progressFill.style.width = pct + "%";
  progressText.textContent = `${done} / ${totalSolvable}`;
}

function checkWin() {
  if (mode === "heatmap" || mode === "neighbors" || mode === "same") return false;
  if (solved.size >= totalSolvable && totalSolvable > 0) {
    showWin();
    return true;
  }
  return false;
}

function showWin() {
  const messages = {
    "op-to-result": "Resolviste toda la tabla de multiplicar. ¡Genial!",
    "result-to-op": "Encontraste todas las operaciones. ¡Sos un crack!",
    "mirror": "Emparejaste todos los espejos de la diagonal. ¡Excelente memoria!",
    "same": "¡Encontraste todos los pares con igual resultado! 🧠",
  };
  winText.textContent = messages[mode] || "¡Muy bien!";
  winBanner.hidden = false;
  launchConfetti();
}

function launchConfetti() {
  const colors = ["#38bdf8", "#a78bfa", "#22c55e", "#f59e0b", "#ef4444", "#e2e8f0"];
  const pieces = 28;
  for (let i = 0; i < pieces; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.style.left = Math.random() * 100 + "vw";
    el.style.background = colors[i % colors.length];
    el.style.animationDelay = Math.random() * 0.35 + "s";
    el.style.animationDuration = 1.3 + Math.random() * 0.8 + "s";
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

winAgain.addEventListener("click", () => {
  winBanner.hidden = true;
  resetGame();
});

// ===== Reset / cambio de modo =====
function resetGame() {
  solved = new Set();
  currentTarget = null;
  targetCells = [];
  firstPick = null;
  matchedPairs = 0;
  winBanner.hidden = true;
  modal.hidden = true;

  const isMemotest = mode === "same" && sameSub === "memotest";

  buildBoard();
  if (!isMemotest) computeTotals();

  setStatusAndHint();

  // Leyenda de color: en modos con grilla coloreada
  const usesColor =
    mode === "heatmap" || mode === "neighbors" || (mode === "same" && sameSub === "explore");
  legend.hidden = !usesColor;

  // Barra de progreso: solo en modos jugables con avance
  const showsProgress =
    mode === "op-to-result" || mode === "result-to-op" || mode === "mirror" || isMemotest;
  progressWrap.hidden = !showsProgress;

  // Botón Memotest: solo en modo Iguales
  sameToggle.hidden = mode !== "same";
  if (mode === "same") {
    sameToggle.textContent = isMemotest ? "◀ Volver a explorar" : "▶ Jugar Memotest";
  }

  // Switch para apagar el espejo: en todo el modo Iguales (explorar y memotest)
  const showMirrorSwitch = mode === "same";
  hideMirrorRow.hidden = !showMirrorSwitch;
  board.classList.toggle("hide-mirror", showMirrorSwitch && hideMirrorInput.checked);

  if (isMemotest) updateMemoProgress();
  else updateProgress();

  if (mode === "result-to-op") pickNewTarget();
}

function setStatusAndHint() {
  if (mode === "op-to-result") {
    statusEl.textContent = "Tocá una carta y escribí el resultado.";
    hintEl.textContent =
      "Hacé click en una carta (ej. 5×3), escribí cuánto da y, si acertás, la carta se da vuelta.";
  } else if (mode === "result-to-op") {
    statusEl.textContent = "Preparando...";
    hintEl.textContent =
      "Te damos un resultado y tenés que encontrar TODAS las cartas de la grilla que dan ese número.";
  } else if (mode === "mirror") {
    statusEl.textContent = "Encontrá los espejos de la diagonal.";
    hintEl.textContent =
      "La tabla es simétrica en la diagonal (3×4 = 4×3). Tocá una carta para ver su resultado y buscá su espejo del otro lado. Las de la diagonal (2×2, 3×3...) se resuelven con un click.";
  } else if (mode === "heatmap") {
    statusEl.innerHTML = "Mapa de calor de la tabla. La <span class=\"target\">diagonal</span> está resaltada.";
    hintEl.innerHTML =
      "Colores: fríos (azul) cerca de 0, cálidos (rojo) cerca de 100. La <b>diagonal</b> (los cuadrados n×n) tiene borde blanco y brillo. El <b>triángulo de abajo</b> se ve más brilloso y el <b>de arriba (el espejo)</b> más apagado, para que notes la simetría. Pasá el mouse para ver la operación.";
  } else if (mode === "same") {
    if (sameSub === "memotest") {
      statusEl.textContent = "Encontrá las celdas que dan el mismo resultado.";
      hintEl.innerHTML =
        "Memotest sobre la grilla: todas las celdas (menos ×0) están dadas vuelta. Descubrí dos y, si dan el <b>mismo resultado</b> (ej. 3×4 y 6×2 = 12), quedan emparejadas. Si un resultado tiene 3 celdas (ej. 16 = 2×8, 8×2 y 4×4), descubrí la que quedó suelta y tocá una del mismo resultado ya emparejada para cerrarla. Probá el switch para apagar la mitad espejada.";
    } else {
      statusEl.textContent = "Tocá una celda para resaltar las que dan el mismo número.";
      hintEl.innerHTML =
        "Al tocar una celda se iluminan <b>todas</b> las que dan ese mismo resultado (ej. 12 = 2×6, 3×4, 4×3, 6×2). Tocá de nuevo para volver. Probá el <b>Memotest</b> con el botón de arriba.";
    }
    return;
  } else if (mode === "neighbors") {
    statusEl.textContent = "Tocá una celda para ver sus vecinos y los saltos.";
    hintEl.innerHTML =
      "Apoyate en lo que ya sabés: un paso a la derecha suma el número de la fila y un paso hacia abajo suma el de la columna. Ej.: sé 6×5=30 → +6 → 6×6=36. Los colores parecidos = resultados cercanos; el borde punteado marca las celdas que dan el mismo número. <b>Tocá de nuevo la misma celda para volver a la vista completa.</b>";
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    mode = tab.dataset.mode;
    if (mode === "same") sameSub = "explore";
    resetGame();
  });
});

sameToggle.addEventListener("click", () => {
  sameSub = sameSub === "explore" ? "memotest" : "explore";
  resetGame();
});

hideMirrorInput.addEventListener("change", () => {
  if (mode === "same" && sameSub === "memotest") {
    // Cambian los pares disponibles: rehago el juego
    resetGame();
  } else {
    board.classList.toggle("hide-mirror", hideMirrorInput.checked);
    clearFocus();
    setStatusAndHint();
  }
});

resetBtn.addEventListener("click", resetGame);

// ===== Service worker (para instalar y usar offline en el celu) =====
// Solo funciona servido por http/https (GitHub Pages, etc.), no con file://
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// ===== Inicio =====
resetGame();
