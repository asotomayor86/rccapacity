import useStore from "../state";
import { MASTER_SCHEMAS_META } from "../masterSchemas";

const SE_TYPE_MAP = Object.fromEntries((MASTER_SCHEMAS_META.SETUP_EXTRUSORAS ?? []).map((f) => [f.name, f.type]));
const PC_TYPE_MAP = Object.fromEntries((MASTER_SCHEMAS_META.PRODUCTO_COMPLEJO ?? []).map((f) => [f.name, f.type]));

const ENR_FIXED_TYPES = {
  REFERENCIA_COMPLEJA: "string", MEZCLA: "string", EXTRUSORA: "string",
  SOLDADOR_LONGITUDINAL: "boolean", ABIERTA_LATERAL: "boolean", ABIERTA_CENTRO: "boolean",
  ABREFACIL_LATERAL: "boolean", ABREFACIL_CENTRAL: "boolean", TRATADA_PC: "boolean",
  ES_ACTUAL: "boolean", RS_CALCULADA: "decimal", RENDIMIENTO_CALCULADO: "decimal",
};

function getEnrType(campo) {
  return ENR_FIXED_TYPES[campo] ?? PC_TYPE_MAP[campo] ?? SE_TYPE_MAP[campo] ?? "string";
}

const BOOL_TRUTHY = new Set(["si", "sí", "yes", "1", "true"]);
function toBool(v) {
  if (typeof v === "boolean") return v;
  return BOOL_TRUTHY.has(String(v ?? "").trim().toLowerCase());
}

function compararFact(rawVal, operador, valorStr, tipo) {
  if (operador === "is_null")     return rawVal == null || rawVal === "";
  if (operador === "is_not_null") return rawVal != null && rawVal !== "";
  if (rawVal == null) return false;
  if (tipo === "boolean") {
    const a = toBool(rawVal), b = toBool(valorStr);
    if (operador === "eq")  return a === b;
    if (operador === "neq") return a !== b;
    return false;
  }
  if (tipo === "decimal") {
    const a = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal).replace(",", "."));
    const b = parseFloat(String(valorStr).replace(",", "."));
    if (isNaN(a) || isNaN(b)) return false;
    switch (operador) {
      case "eq":  return a === b;
      case "neq": return a !== b;
      case "gt":  return a > b;
      case "lt":  return a < b;
      case "gte": return a >= b;
      case "lte": return a <= b;
      default:    return false;
    }
  }
  const a = String(rawVal).trim().toLowerCase();
  const b = String(valorStr).trim().toLowerCase();
  switch (operador) {
    case "eq":          return a === b;
    case "neq":         return a !== b;
    case "contains":    return a.includes(b);
    case "starts_with": return a.startsWith(b);
    default: return false;
  }
}

function findSeRow(setupExtrusoras, extrusoraName, rowIsActual) {
  const candidates = setupExtrusoras.filter((se) => norm(se.NOMBRE_EXTRUSORA) === norm(extrusoraName));
  if (candidates.length === 0) return null;
  return candidates.find((se) => se.ES_ACTUAL === rowIsActual) ?? candidates[0];
}

export function calcularFactibles({ enrutamientos, reglasFactibilidad, setupExtrusoras = [] }) {
  const sorted   = [...reglasFactibilidad].sort((a, b) => a.prioridad - b.prioridad);
  const factibles = [];
  const log       = [];

  for (const fila of enrutamientos) {
    const seRow  = findSeRow(setupExtrusoras, fila.EXTRUSORA ?? "", fila.ES_ACTUAL);
    const motivos = [];

    for (const regla of sorted) {
      if (!regla.condiciones?.length) continue;
      const cumple = regla.condiciones.every((cond) => {
        const { fuente, campo, operador, valor } = cond;
        const rawVal = fuente === "SETUP_EXTRUSORAS" ? (seRow?.[campo] ?? null) : (fila[campo] ?? null);
        const tipo   = fuente === "SETUP_EXTRUSORAS" ? (SE_TYPE_MAP[campo] ?? "string") : getEnrType(campo);
        return compararFact(rawVal, operador, valor ?? "", tipo);
      });
      if (cumple) motivos.push(regla.descripcion || `Regla #${regla.prioridad}`);
    }

    const factible = motivos.length === 0 ? "SI" : "NO";
    factibles.push({ ...fila, FACTIBLE: factible, _motivos: motivos });
    if (motivos.length > 0) log.push({ referencia: fila.REFERENCIA_COMPLEJA, motivos });
  }

  return { factibles, log };
}

export function evaluarArbol(nodo, fila) {
  if (!nodo) return null;
  if (nodo.tipo === "constante") return nodo.valor;
  if (nodo.tipo === "campo") {
    const valor = fila[nodo.campo];
    return valor !== undefined && valor !== null ? Number(valor) : null;
  }
  if (nodo.tipo === "operacion") {
    const izq = evaluarArbol(nodo.hijos?.[0] ?? null, fila);
    const der = evaluarArbol(nodo.hijos?.[1] ?? null, fila);
    if (izq === null || der === null) return null;
    switch (nodo.operador) {
      case "+": return izq + der;
      case "-": return izq - der;
      case "*": return izq * der;
      case "/": return der === 0 ? null : izq / der;
      case "^": return Math.pow(izq, der);
      default:  return null;
    }
  }
  return null;
}

export function camposDeArbol(nodo) {
  if (!nodo) return [];
  if (nodo.tipo === "campo")     return [{ fuente: nodo.fuente, campo: nodo.campo }];
  if (nodo.tipo === "constante") return [];
  if (nodo.tipo === "operacion") {
    return [
      ...camposDeArbol(nodo.hijos?.[0] ?? null),
      ...camposDeArbol(nodo.hijos?.[1] ?? null),
    ];
  }
  return [];
}

export function calcularEnrutamientos({ productoComplejo, producto, enrutamientoMezclas, setupExtrusoras, calculos }) {
  const rows   = [];
  const errors = [];

  // Extraer campos requeridos por los árboles RS y RENDIMIENTO (deduplicados)
  const defRS          = (calculos ?? []).find((d) => d.nombre === "RS");
  const defRENDIMIENTO = (calculos ?? []).find((d) => d.nombre === "RENDIMIENTO");
  const camposPC = new Set();
  const camposSE = new Set();
  for (const def of [defRS, defRENDIMIENTO].filter(Boolean)) {
    for (const { fuente, campo } of camposDeArbol(def.arbol)) {
      if (fuente === "PRODUCTO_COMPLEJO") camposPC.add(campo);
      if (fuente === "SETUP_EXTRUSORAS")  camposSE.add(campo);
    }
  }

  // Maps de búsqueda
  const productoMap = new Map();
  for (const p of producto) productoMap.set(norm(p.REFERENCIA), norm(p.MEZCLA ?? ""));

  const emMap = new Map();
  for (const em of enrutamientoMezclas) {
    const key = norm(em.MEZCLA);
    if (!emMap.has(key)) emMap.set(key, []);
    emMap.get(key).push(em);
  }

  const seMap = new Map();
  for (const se of (setupExtrusoras ?? [])) {
    const key = norm(se.NOMBRE_EXTRUSORA);
    if (!seMap.has(key)) seMap.set(key, []);
    seMap.get(key).push(se);
  }

  for (const pc of productoComplejo) {
    const ref    = norm(pc.REFERENCIA);
    const mezcla = productoMap.get(ref) ?? "";

    if (!mezcla) {
      errors.push({ tipo: "MEZCLA_NO_RESUELTA", referencia: pc.REFERENCIA, mezcla: "", extrusora: "", descripcion: "No encontrada en PRODUCTO o sin MEZCLA" });
      continue;
    }

    const emRows = emMap.get(mezcla) ?? [];
    if (emRows.length === 0) {
      errors.push({ tipo: "SIN_EXTRUSORAS_EM", referencia: pc.REFERENCIA, mezcla, extrusora: "", descripcion: `MEZCLA ${mezcla} sin entradas en ENRUTAMIENTO_MEZCLAS` });
      continue;
    }

    for (const em of emRows) {
      const extrusora = norm(em.EXTRUSORA ?? "");
      const seRows    = seMap.get(extrusora) ?? [];

      if (seRows.length === 0) {
        errors.push({ tipo: "SIN_SETUP", referencia: pc.REFERENCIA, mezcla, extrusora: em.EXTRUSORA ?? extrusora, descripcion: `EXTRUSORA ${em.EXTRUSORA ?? extrusora} no encontrada en SETUP_EXTRUSORAS` });
        continue;
      }

      for (const se of seRows) {
        const row = {
          REFERENCIA_COMPLEJA:     pc.REFERENCIA_COMPLEJA     ?? null,
          MEZCLA:                  mezcla,
          EXTRUSORA:               em.EXTRUSORA               ?? null,
          SOLDADOR_LONGITUDINAL:   pc.SOLDADOR_LONGITUDINAL   ?? null,
          ABIERTA_LATERAL:         pc.ABIERTA_LATERAL         ?? null,
          ABIERTA_CENTRO:          pc.ABIERTA_CENTRO          ?? null,
          ABREFACIL_LATERAL:       pc.ABREFACIL_LATERAL       ?? null,
          ABREFACIL_CENTRAL:       pc.ABREFACIL_CENTRAL       ?? null,
          TRATADA_PC:              pc.TRATADA_PC              ?? null,
        };
        for (const c of camposPC) row[c] = pc[c] ?? null;
        row.ES_ACTUAL = se.ES_ACTUAL ?? null;
        for (const c of camposSE) row[c] = se[c] ?? null;

        const rs          = defRS          ? evaluarArbol(defRS.arbol,          row) : null;
        const rendimiento = defRENDIMIENTO ? evaluarArbol(defRENDIMIENTO.arbol, row) : null;

        // Campos de fórmula que entran en RS/RENDIMIENTO — se incluyen en el error
        // para que el viewer los muestre dinámicamente según la fórmula activa
        const formulaFields = Object.fromEntries(
          [...camposPC, ...camposSE].map((c) => [c, row[c] ?? null])
        );

        if (rs === null) {
          errors.push({
            tipo: "RS_NULA", referencia: row.REFERENCIA_COMPLEJA,
            mezcla: row.MEZCLA, extrusora: row.EXTRUSORA,
            descripcion: "Árbol RS devolvió null (campo faltante o división por cero)",
            ...formulaFields,
          });
        }
        if (rendimiento === null) {
          errors.push({
            tipo: "RENDIMIENTO_NULO", referencia: row.REFERENCIA_COMPLEJA,
            mezcla: row.MEZCLA, extrusora: row.EXTRUSORA,
            descripcion: "Árbol RENDIMIENTO devolvió null",
            ...formulaFields,
          });
        }

        row.RS_CALCULADA          = rs !== null ? Math.round(rs * 100) / 100 : null;
        row.RENDIMIENTO_CALCULADO = rendimiento;
        rows.push(row);
      }
    }
  }

  return { rows, errors };
}

function norm(v) {
  return String(v ?? "").trim().toUpperCase();
}

// ── Motor de cálculo ───────────────────────────────────────────────────────────
// Modelo de datos:
//   DEMANDA          → MES, REFERENCIA, CANTIDAD
//   PRODUCTO         → REFERENCIA, MEZCLA (y otros atributos)
//   ENRUTAMIENTO_MEZCLAS → MEZCLA, EXTRUSORA, RS_MIN, RS_MAXIMO, GMAX_SOLDADURA
//   CALENDARIO       → MES, CM, CT, HORAS_TOTALES, EFICIENCIA, HORAS_EFICIENTES
//
// Cadena de join:
//   DEMANDA.REFERENCIA → PRODUCTO (obtener MEZCLA y atributos del producto)
//   PRODUCTO.MEZCLA → ENRUTAMIENTO_MEZCLAS (obtener EXTRUSORA y rangos)
//   (MES, EXTRUSORA=CM) → CALENDARIO (obtener horas disponibles)
//
// TODO: lógica de cálculo de CARGA y OCUPACION pendiente de definición.
//       El motor actualmente une los datos y devuelve las filas enriquecidas
//       con CARGA = null y OCUPACION = null hasta que se especifique la fórmula.

export function calculate({ demanda, producto, enrutamientoMezclas, calendario }) {
  const log = [];

  log.push(`DEMANDA: ${demanda.length} registros`);
  log.push(`PRODUCTO: ${producto.length} registros`);
  log.push(`ENRUTAMIENTO_MEZCLAS: ${enrutamientoMezclas.length} registros`);
  log.push(`CALENDARIO: ${calendario.length} registros`);

  // ── Map: REFERENCIA → producto ────────────────────────────────────────────
  const productoByRef = new Map();
  for (const p of producto) {
    productoByRef.set(norm(p.REFERENCIA), p);
  }

  // ── Map: MEZCLA → [rutas enrutamiento_mezclas] ────────────────────────────
  const rutasByMezcla = new Map();
  for (const r of enrutamientoMezclas) {
    const key = norm(r.MEZCLA);
    if (!rutasByMezcla.has(key)) rutasByMezcla.set(key, []);
    rutasByMezcla.get(key).push(r);
  }

  // ── Map: (MES|CM) → calendario ────────────────────────────────────────────
  // EXTRUSORA en enrutamiento se asume equivalente a CM en calendario
  const calendarioByMesCM = new Map();
  for (const c of calendario) {
    const key = `${c.MES}|${norm(c.CM)}`;
    calendarioByMesCM.set(key, c);
  }

  log.push(`Mapa PRODUCTO: ${productoByRef.size} refs únicas`);
  log.push(`Mapa ENRUTAMIENTO_MEZCLAS: ${rutasByMezcla.size} mezclas únicas`);
  log.push(`Mapa CALENDARIO: ${calendarioByMesCM.size} entradas MES×CM`);

  // ── Join y cálculo ─────────────────────────────────────────────────────────
  const records = [];
  let sinProd = 0;
  let sinMezcla = 0;
  let sinRuta = 0;
  let sinCal = 0;

  for (const d of demanda) {
    const mes = d.MES;
    const ref = norm(d.REFERENCIA);
    const cantidad = Number(d.CANTIDAD) || 0;

    const prod = productoByRef.get(ref);
    if (!prod) {
      sinProd++;
      continue;
    }

    const mezcla = norm(prod.MEZCLA ?? "");
    if (!mezcla) {
      sinMezcla++;
      log.push(`⚠ REFERENCIA=${ref} sin MEZCLA definida (omitido)`);
      continue;
    }

    const rutas = rutasByMezcla.get(mezcla) ?? [];
    if (rutas.length === 0) {
      sinRuta++;
      log.push(`⚠ Sin rutas en ENRUTAMIENTO_MEZCLAS para MEZCLA=${mezcla} (omitido)`);
      continue;
    }

    for (const ruta of rutas) {
      const extrusora = norm(ruta.EXTRUSORA ?? "");
      const calKey = `${mes}|${extrusora}`;
      const cal = calendarioByMesCM.get(calKey) ?? null;

      if (!cal) {
        sinCal++;
        log.push(`⚠ Sin calendario para MES=${mes} CM=${extrusora}`);
      }

      // TODO: lógica de cálculo de CARGA y OCUPACION pendiente de definición
      records.push({
        MES: mes,
        REFERENCIA: ref,
        MEZCLA: mezcla,
        EXTRUSORA: extrusora,
        CANTIDAD: cantidad,
        TIPO: prod.TIPO ?? null,
        ANCHO: prod.ANCHO ?? null,
        GALGA: prod.GALGA ?? null,
        TRATAMIENTO: prod.TRATAMIENTO ?? null,
        ABREFACIL: prod.ABREFACIL ?? null,
        RS_MIN: ruta.RS_MIN ?? null,
        RS_MAXIMO: ruta.RS_MAXIMO ?? null,
        GMAX_SOLDADURA: ruta.GMAX_SOLDADURA ?? null,
        CT: cal?.CT ?? null,
        HORAS_TOTALES: cal?.HORAS_TOTALES ?? null,
        EFICIENCIA: cal?.EFICIENCIA ?? null,
        HORAS_EFICIENTES: cal?.HORAS_EFICIENTES ?? null,
        CARGA: null,    // TODO: fórmula pendiente de definición
        OCUPACION: null, // TODO: fórmula pendiente de definición
      });
    }
  }

  log.push(`Registros generados: ${records.length}`);
  if (sinProd > 0)   log.push(`⚠ ${sinProd} registros de DEMANDA sin producto en PRODUCTO`);
  if (sinMezcla > 0) log.push(`⚠ ${sinMezcla} productos sin campo MEZCLA`);
  if (sinRuta > 0)   log.push(`⚠ ${sinRuta} mezclas sin rutas en ENRUTAMIENTO_MEZCLAS`);
  if (sinCal > 0)    log.push(`⚠ ${sinCal} combinaciones MES×EXTRUSORA sin entrada en CALENDARIO`);
  log.push("ℹ CARGA y OCUPACION no calculadas — lógica pendiente de definición");

  useStore.getState().setResults(records, log);
  return { records, log };
}
