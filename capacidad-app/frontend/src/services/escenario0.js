// Escenario 0 — Rough-Cut Annual Capacity
//
// LP continuo: para cada referencia base R con demanda anual Q[R] kg,
// se busca la asignación f[R,v,c] ≥ 0 (fracción a variante v en CM c) tal que:
//   Σ_{v,c} f[R,v,c] = 1   (toda la demanda queda asignada, sin doble conteo)
//   minimiza max_c LOAD[c]/CAP[c]  →  luego minimiza Σ LOAD[c]/CAP[c]
//
// Algoritmo: water-filling entrópico con blending (LR=0.15).
// Cede control al UI cada 15 iteraciones para actualizar la barra de progreso.

function tick() {
  return new Promise((r) => setTimeout(r, 0));
}

export async function calcularEscenario0({
  enrutamientosFactibles,
  demanda,
  calendario,
  onProgress,
}) {
  onProgress(5, "Anualizando demanda y capacidad...");
  await tick();

  // ── 1. Demanda anual por referencia ─────────────────────────────────────────
  const demandaAnual = new Map(); // REFERENCIA → kg totales
  for (const d of demanda) {
    const ref = String(d.REFERENCIA ?? "").trim();
    if (!ref) continue;
    demandaAnual.set(ref, (demandaAnual.get(ref) || 0) + (Number(d.CANTIDAD) || 0));
  }

  // ── 2. Capacidad anual por CM ────────────────────────────────────────────────
  const capacidadAnual = new Map(); // CM → horas totales
  for (const c of calendario) {
    const cm = String(c.CM ?? "").trim().toUpperCase();
    if (!cm) continue;
    capacidadAnual.set(cm, (capacidadAnual.get(cm) || 0) + (Number(c.HORAS_EFICIENTES) || 0));
  }

  // ── 3. Rutas factibles (ES_ACTUAL=true) ─────────────────────────────────────
  // routes: Map<baseRef, [{variant, cm, rendimiento, refCompleja}]>
  const routes = new Map();

  for (const row of enrutamientosFactibles) {
    if (row.FACTIBLE !== "SI") continue;
    if (!row.ES_ACTUAL) continue; // solo configuración activa

    const rendimiento = Number(row.RENDIMIENTO_CALCULADO);
    if (!rendimiento || rendimiento <= 0) continue;

    const refCompleja = String(row.REFERENCIA_COMPLEJA ?? "").trim();
    if (refCompleja.length < 2) continue;

    const variant = refCompleja.slice(-1);       // "S" o "D"
    const baseRef = refCompleja.slice(0, -1);     // referencia base
    const cm      = String(row.EXTRUSORA ?? "").trim().toUpperCase();

    if (!cm || !baseRef) continue;
    if (!capacidadAnual.has(cm)) continue; // CM sin calendario → ignorar

    if (!routes.has(baseRef)) routes.set(baseRef, []);
    routes.get(baseRef).push({ variant, cm, rendimiento, refCompleja });
  }

  // ── 4. Referencias a procesar ────────────────────────────────────────────────
  const refsToProcess = [...routes.keys()].filter((r) => (demandaAnual.get(r) || 0) > 0);

  const warnings = [];
  const refsWithNoRoutes = [...demandaAnual.keys()].filter((r) => !routes.has(r));
  if (refsWithNoRoutes.length > 0) {
    warnings.push(`${refsWithNoRoutes.length} referencia(s) en Demanda sin rutas factibles y no se han asignado.`);
  }

  if (refsToProcess.length === 0) {
    return {
      cmSummary: [], refDetail: [], maxOcupacion: 0,
      totalHorasDisponibles: 0, totalHorasCargadas: 0, warnings,
    };
  }

  onProgress(15, `${refsToProcess.length} referencias — inicializando asignación...`);
  await tick();

  // ── 5. Inicialización: proporcional al rendimiento ───────────────────────────
  const assignment = new Map(); // baseRef → [fracciones]
  for (const ref of refsToProcess) {
    const rts = routes.get(ref);
    const totalRend = rts.reduce((s, r) => s + r.rendimiento, 0);
    assignment.set(ref, rts.map((r) => r.rendimiento / totalRend));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function computeLoads() {
    const loads = new Map();
    for (const ref of refsToProcess) {
      const q     = demandaAnual.get(ref);
      const rts   = routes.get(ref);
      const fracs = assignment.get(ref);
      for (let i = 0; i < rts.length; i++) {
        const { cm, rendimiento } = rts[i];
        const h = (fracs[i] * q) / rendimiento;
        loads.set(cm, (loads.get(cm) || 0) + h);
      }
    }
    return loads;
  }

  function computeUtils(loads) {
    const utils = new Map();
    for (const [cm, cap] of capacidadAnual) {
      utils.set(cm, (loads.get(cm) || 0) / cap);
    }
    return utils;
  }

  function currentMaxUtil(utils) {
    let max = 0;
    for (const v of utils.values()) if (v > max) max = v;
    return max;
  }

  // ── 6. Optimización: water-filling entrópico con blending ────────────────────
  const MAX_ITER = 300;
  const LR = 0.15; // tasa de mezcla (previene oscilaciones)

  let bestMaxUtil    = Infinity;
  let bestAssignment = new Map(refsToProcess.map((r) => [r, [...assignment.get(r)]]));

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const loads = computeLoads();
    const utils = computeUtils(loads);
    const curMax = currentMaxUtil(utils);

    // Guardar mejor solución encontrada
    if (curMax < bestMaxUtil) {
      bestMaxUtil = curMax;
      for (const ref of refsToProcess) bestAssignment.set(ref, [...assignment.get(ref)]);
    }

    // Temperatura decrece de 1.0 a ~0 (annealing entrópico)
    const T = Math.max(0.004, 1.0 - (iter / MAX_ITER) * 1.3);

    // Actualizar cada referencia
    for (const ref of refsToProcess) {
      const rts = routes.get(ref);
      if (rts.length <= 1) continue;

      const oldFracs = assignment.get(ref);

      // Puntuación: penaliza CMs más cargados, premia mayor rendimiento
      const scores = rts.map((r) => {
        const u = utils.get(r.cm) || 0;
        return Math.exp(-u / T) * r.rendimiento;
      });

      const totalScore = scores.reduce((s, x) => s + x, 0);
      if (totalScore <= 0) continue;

      const targetFracs = scores.map((s) => s / totalScore);

      // Actualización mezclada (blend) para evitar oscilaciones
      const newFracs = oldFracs.map((f, i) => (1 - LR) * f + LR * targetFracs[i]);
      const total    = newFracs.reduce((s, f) => s + f, 0);
      assignment.set(ref, total > 0 ? newFracs.map((f) => f / total) : oldFracs);
    }

    // Ceder al UI y reportar progreso cada 15 iteraciones
    if (iter % 15 === 0) {
      onProgress(
        15 + (iter / MAX_ITER) * 77,
        `Optimizando... iter ${iter}/${MAX_ITER} · Pico actual: ${(curMax * 100).toFixed(1)}%`
      );
      await tick();
    }
  }

  // Restaurar mejor solución
  for (const ref of refsToProcess) assignment.set(ref, bestAssignment.get(ref));

  onProgress(93, "Generando resultados...");
  await tick();

  // ── 7. Construir salidas ──────────────────────────────────────────────────────
  const finalLoads = computeLoads();
  const finalUtils = computeUtils(finalLoads);

  // Resumen por CM
  const cmSummary = [];
  for (const [cm, cap] of capacidadAnual) {
    const carga = finalLoads.get(cm) || 0;
    cmSummary.push({
      CM:                cm,
      HORAS_DISPONIBLES: round2(cap),
      HORAS_CARGADAS:    round2(carga),
      OCUPACION:         carga / cap,
    });
  }
  cmSummary.sort((a, b) => b.OCUPACION - a.OCUPACION);

  // Detalle por referencia (omitir fracciones < 0.1%)
  const refDetail = [];
  for (const ref of refsToProcess) {
    const q     = demandaAnual.get(ref);
    const rts   = routes.get(ref);
    const fracs = assignment.get(ref);
    for (let i = 0; i < rts.length; i++) {
      if (fracs[i] < 0.001) continue;
      const { variant, cm, rendimiento } = rts[i];
      const kg    = fracs[i] * q;
      const hours = kg / rendimiento;
      refDetail.push({
        REFERENCIA:       ref,
        VARIANTE:         variant === "D" ? "Doble" : "Simple",
        CM:               cm,
        KG_DEMANDA_ANUAL: round2(q),
        KG_ASIGNADOS:     round2(kg),
        PCT_ASIGNADO:     round1(fracs[i] * 100),
        RENDIMIENTO_KGH:  round2(rendimiento),
        HORAS_REQUERIDAS: round2(hours),
        OCUPACION_CM:     finalUtils.get(cm) || 0,
      });
    }
  }
  refDetail.sort((a, b) => b.HORAS_REQUERIDAS - a.HORAS_REQUERIDAS);

  const totalHorasDisponibles = [...capacidadAnual.values()].reduce((s, v) => s + v, 0);
  const totalHorasCargadas    = [...finalLoads.values()].reduce((s, v) => s + v, 0);

  onProgress(100, "Completado");

  return {
    cmSummary,
    refDetail,
    maxOcupacion:         bestMaxUtil,
    totalHorasDisponibles: round2(totalHorasDisponibles),
    totalHorasCargadas:    round2(totalHorasCargadas),
    warnings,
  };
}

function round2(v) { return Math.round(v * 100) / 100; }
function round1(v) { return Math.round(v * 10)  / 10;  }
