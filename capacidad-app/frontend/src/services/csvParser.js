import Papa from "papaparse";
import { MASTER_SCHEMAS_META } from "../masterSchemas";
import useStore from "../state";

// ── Encoding detection ────────────────────────────────────────────────────────

async function readFileText(file) {
  const buffer = await file.arrayBuffer();
  for (const enc of ["utf-8", "windows-1252", "iso-8859-1"]) {
    try {
      const text = new TextDecoder(enc, { fatal: true }).decode(buffer);
      return text;
    } catch {
      /* try next */
    }
  }
  return new TextDecoder("utf-8").decode(buffer);
}

// ── Date parser ───────────────────────────────────────────────────────────────

const DATE_PATTERNS = [
  // [regex, builder(match) → Date]
  [/^(\d{2})\/(\d{2})\/(\d{4})$/, (m) => new Date(+m[3], +m[2] - 1, +m[1])],  // DD/MM/YYYY
  [/^(\d{4})-(\d{2})-(\d{2})$/, (m) => new Date(+m[1], +m[2] - 1, +m[3])],    // YYYY-MM-DD
  [/^(\d{2})-(\d{2})-(\d{4})$/, (m) => new Date(+m[3], +m[2] - 1, +m[1])],    // DD-MM-YYYY
  [/^(\d{4})\/(\d{2})\/(\d{2})$/, (m) => new Date(+m[1], +m[2] - 1, +m[3])],  // YYYY/MM/DD
  [/^(\d{2})\/(\d{4})$/, (m) => new Date(+m[2], +m[1] - 1, 1)],               // MM/YYYY
  [/^(\d{4})-(\d{2})$/, (m) => new Date(+m[1], +m[2] - 1, 1)],                // YYYY-MM
  [/^(\d{2})-(\d{4})$/, (m) => new Date(+m[2], +m[1] - 1, 1)],                // MM-YYYY
  [/^(\d{2})\/(\d{2})\/(\d{2})$/, (m) => {                                     // DD/MM/YY
    const y = +m[3] < 50 ? 2000 + +m[3] : 1900 + +m[3];
    return new Date(y, +m[2] - 1, +m[1]);
  }],
];

export function parseFecha(value) {
  const v = String(value).trim();
  for (const [re, build] of DATE_PATTERNS) {
    const m = v.match(re);
    if (m) {
      const d = build(m);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${mo}-01`;
    }
  }
  throw new Error(`No se pudo parsear '${v}' como fecha. Formatos aceptados: DD/MM/YYYY, YYYY-MM-DD, MM/YYYY, etc.`);
}

// ── Decimal parser ────────────────────────────────────────────────────────────

export function parseDecimal(value) {
  let v = String(value).trim();
  if (!v) throw new Error("Valor vacío");

  if (v.includes(",") && v.includes(".")) {
    const lastComma = v.lastIndexOf(",");
    const lastDot = v.lastIndexOf(".");
    if (lastComma > lastDot) {
      // EU: "1.234,56"
      v = v.replace(/\./g, "").replace(",", ".");
    } else {
      // US: "1,234.56"
      v = v.replace(/,/g, "");
    }
  } else if (v.includes(",")) {
    const parts = v.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      v = v.replace(",", ".");
    } else {
      v = v.replace(/,/g, "");
    }
  }

  const n = parseFloat(v);
  if (isNaN(n)) throw new Error(`No se pudo parsear '${value}' como número decimal`);
  return n;
}

// ── String parser ─────────────────────────────────────────────────────────────

export function parseString(value) {
  return String(value).trim().toUpperCase();
}

// ── Boolean parser ────────────────────────────────────────────────────────────

export function parseBoolean(value) {
  return ["sí", "si", "yes", "1", "true"].includes(String(value).trim().toLowerCase());
}

// ── Type validator ────────────────────────────────────────────────────────────

export function validateValue(value, fieldType) {
  const raw = value != null ? String(value).trim() : "";
  if (!raw || ["nan", "none", "null", "<na>"].includes(raw.toLowerCase())) {
    return [null, "Valor vacío o nulo"];
  }
  try {
    if (fieldType === "fecha")    return [parseFecha(raw), null];
    if (fieldType === "string")   return [parseString(raw), null];
    if (fieldType === "decimal")  return [parseDecimal(raw), null];
    if (fieldType === "boolean")  return [parseBoolean(raw), null];
    return [raw, null];
  } catch (e) {
    return [null, e.message];
  }
}

// ── Filters ───────────────────────────────────────────────────────────────────

function applyFilter(row, f) {
  const cell = String(row[f.column] ?? "").trim();
  const val = String(f.value ?? "").trim();
  const val2 = String(f.value2 ?? "").trim();
  const op = f.op;

  if (!cell && op !== "igual_a" && op !== "no_igual_a") return false;

  switch (op) {
    case "igual_a":      return cell.toLowerCase() === val.toLowerCase();
    case "no_igual_a":   return cell.toLowerCase() !== val.toLowerCase();
    case "contiene":     return cell.toLowerCase().includes(val.toLowerCase());
    case "starts_with":  return cell.toLowerCase().startsWith(val.toLowerCase());
    case "mayor_que":
    case "mayor_igual":
    case "menor_que":
    case "menor_igual":
    case "entre": {
      try {
        const cn = parseDecimal(cell);
        const vn = parseDecimal(val);
        if (op === "mayor_que")  return cn > vn;
        if (op === "mayor_igual") return cn >= vn;
        if (op === "menor_que")  return cn < vn;
        if (op === "menor_igual") return cn <= vn;
        if (op === "entre") return cn >= vn && cn <= parseDecimal(val2);
      } catch { return false; }
      break;
    }
    case "desde":
    case "hasta":
    case "igual_mes": {
      try {
        const cd = parseFecha(cell);
        const vd = parseFecha(val);
        if (op === "desde")     return cd >= vd;
        if (op === "hasta")     return cd <= vd;
        if (op === "igual_mes") return cd === vd;
      } catch { return false; }
      break;
    }
    default: return true;
  }
  return true;
}

export function applyFilters(raw, filters) {
  if (!filters || filters.length === 0) return raw;
  return raw.filter((row) => filters.every((f) => applyFilter(row, f)));
}

// ── Parse from string (no File object needed) ─────────────────────────────────

export function parseCsvText(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  return { raw: result.data, columns: result.meta.fields ?? [] };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function parseCsvFile(file) {
  const text = await readFileText(file);

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimitersToGuess: [",", ";", "\t", "|"],
  });

  const raw = result.data;
  const columns = result.meta.fields ?? [];

  const uploadId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const data = { raw, columns, filename: file.name };
  useStore.getState().setUpload(uploadId, data);

  return {
    uploadId,
    columns,
    preview: raw.slice(0, 20),
    row_count: raw.length,
  };
}

// ── Mapping + validation ──────────────────────────────────────────────────────

export function applyMappingAndValidate(raw, filters, mapping, masterName) {
  const schema = MASTER_SCHEMAS_META[masterName] ?? [];
  const filtered = applyFilters(raw, filters);

  const validRows = [];
  const errors = [];

  for (let i = 0; i < filtered.length; i++) {
    const row = filtered[i];
    const mapped = {};
    const rowErrors = [];

    for (const field of schema) {
      const { name: fname, type: ftype, required, positive } = field;
      const rawCol = mapping[fname];

      if (!rawCol) {
        if (required) {
          rowErrors.push({ field: fname, value: "", reason: "Campo requerido sin columna mapeada" });
        } else {
          mapped[fname] = null;
        }
        continue;
      }

      const rawValue = row[rawCol] ?? "";
      const [parsed, error] = validateValue(rawValue, ftype);

      if (error) {
        if (required) {
          rowErrors.push({ field: fname, value: rawValue, reason: error });
        } else {
          mapped[fname] = null;
        }
      } else {
        if (positive && typeof parsed === "number" && parsed <= 0) {
          rowErrors.push({ field: fname, value: rawValue, reason: `Debe ser mayor que 0 (recibido: ${parsed})` });
        } else {
          mapped[fname] = parsed;
        }
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ row: i + 1, errors: rowErrors });
    } else {
      validRows.push(mapped);
    }
  }

  const total = filtered.length;
  const valid_count = validRows.length;
  const error_count = errors.length;

  return {
    validRows,
    errors: errors.slice(0, 100),
    preview: validRows.slice(0, 10),
    total,
    valid_count,
    error_count,
    success_pct: total > 0 ? Math.round((valid_count / total) * 1000) / 10 : 0,
  };
}

// ── Auto-import de reglas de factibilidad ─────────────────────────────────────

const REGLAS_FACT_COLS = [
  "REGLA_ID", "CAMPO_DESTINO", "PRIORIDAD",
  "COND_FUENTE", "COND_CAMPO", "COND_OPERADOR", "COND_VALOR",
  "RESULTADO_TIPO", "RESULTADO_VALOR",
];

export async function autoImportReglasFact(file) {
  let text;
  try { text = await readFileText(file); }
  catch { return { success: false, reason: "No se pudo leer el archivo." }; }

  const { raw, columns } = parseCsvText(text);
  if (raw.length === 0) return { success: false, reason: "El archivo está vacío." };

  const colSet  = new Set(columns);
  const missing = REGLAS_FACT_COLS.filter((c) => !colSet.has(c));
  if (missing.length > 0) return { success: false, reason: `Columnas faltantes: ${missing.join(", ")}` };

  const reglaMap = new Map();
  for (const row of raw) {
    const id = (row.REGLA_ID ?? "").trim();
    if (!id) continue;
    if (!reglaMap.has(id)) {
      reglaMap.set(id, {
        id,
        campo:       (row.CAMPO_DESTINO  ?? "FACTIBLE").trim(),
        prioridad:   parseInt(row.PRIORIDAD) || 1,
        condiciones: [],
        resultado: {
          tipo:  (row.RESULTADO_TIPO  ?? "valor_fijo").trim(),
          valor: (row.RESULTADO_VALOR ?? "NO").trim(),
        },
      });
    }
    const fuente   = (row.COND_FUENTE   ?? "").trim();
    const campo    = (row.COND_CAMPO    ?? "").trim();
    const operador = (row.COND_OPERADOR ?? "").trim();
    if (fuente && campo && operador) {
      reglaMap.get(id).condiciones.push({ fuente, campo, operador, valor: (row.COND_VALOR ?? "").trim() });
    }
  }
  return { success: true, reglas: Array.from(reglaMap.values()) };
}

// ── Auto-import de cálculos ───────────────────────────────────────────────────

const CALCULOS_CSV_COLS = ["CALCULO_ID", "NOMBRE", "DESCRIPCION", "UNIDAD", "ARBOL_JSON"];

export async function autoImportCalculos(file) {
  let text;
  try {
    text = await readFileText(file);
  } catch {
    return { success: false, reason: "No se pudo leer el archivo." };
  }

  const { raw, columns } = parseCsvText(text);
  if (raw.length === 0) return { success: false, reason: "El archivo está vacío." };

  const colSet = new Set(columns);
  const missing = CALCULOS_CSV_COLS.filter((c) => !colSet.has(c));
  if (missing.length > 0) {
    return { success: false, reason: `Columnas faltantes: ${missing.join(", ")}` };
  }

  const definiciones = [];
  for (const row of raw) {
    const id = (row.CALCULO_ID ?? "").trim();
    if (!id) continue;
    let arbol = null;
    try { arbol = JSON.parse(row.ARBOL_JSON ?? "null"); } catch { arbol = null; }
    definiciones.push({
      id,
      nombre:      (row.NOMBRE      ?? "").trim(),
      descripcion: (row.DESCRIPCION ?? "").trim(),
      unidad:      (row.UNIDAD      ?? "").trim(),
      inputs:      [],
      arbol,
    });
  }

  return { success: true, definiciones };
}

// ── Auto-import de reglas ─────────────────────────────────────────────────────

const REGLAS_CSV_COLS = [
  "REGLA_ID", "CAMPO_DESTINO", "PRIORIDAD",
  "COND_FUENTE", "COND_CAMPO", "COND_OPERADOR", "COND_VALOR",
  "RESULTADO_TIPO", "RESULTADO_VALOR",
];

export async function autoImportReglas(file) {
  let text;
  try {
    text = await readFileText(file);
  } catch {
    return { success: false, reason: "No se pudo leer el archivo." };
  }

  const { raw, columns } = parseCsvText(text);
  if (raw.length === 0) return { success: false, reason: "El archivo está vacío." };

  const colSet = new Set(columns);
  const missing = REGLAS_CSV_COLS.filter((c) => !colSet.has(c));
  if (missing.length > 0) {
    return { success: false, reason: `Columnas faltantes: ${missing.join(", ")}` };
  }

  const reglaMap = new Map();
  for (const row of raw) {
    const id = (row.REGLA_ID ?? "").trim();
    if (!id) continue;

    if (!reglaMap.has(id)) {
      reglaMap.set(id, {
        id,
        campo:       (row.CAMPO_DESTINO  ?? "").trim(),
        prioridad:   parseInt(row.PRIORIDAD) || 1,
        condiciones: [],
        resultado: {
          tipo:  (row.RESULTADO_TIPO  ?? "valor_fijo").trim(),
          valor: (row.RESULTADO_VALOR ?? "").trim(),
        },
      });
    }

    const fuente   = (row.COND_FUENTE   ?? "").trim();
    const campo    = (row.COND_CAMPO    ?? "").trim();
    const operador = (row.COND_OPERADOR ?? "").trim();
    if (fuente && campo && operador) {
      reglaMap.get(id).condiciones.push({
        fuente,
        campo,
        operador,
        valor: (row.COND_VALOR ?? "").trim(),
      });
    }
  }

  const reglas = Array.from(reglaMap.values());
  return { success: true, reglas };
}

// ── Auto-import ───────────────────────────────────────────────────────────────
// For CSVs previously exported by this tool: column names match the schema exactly.
// Returns { success, rows, meta, valid_count, error_count } or { success: false, reason }

export async function autoImport(file, masterName) {
  let text;
  try {
    text = await readFileText(file);
  } catch {
    return { success: false, reason: "No se pudo leer el archivo." };
  }

  const { raw, columns } = parseCsvText(text);
  if (raw.length === 0) return { success: false, reason: "El archivo está vacío." };

  const schema = MASTER_SCHEMAS_META[masterName] ?? [];
  const schemaFields = schema.map((f) => f.name);
  const colSet = new Set(columns);

  const missing = schemaFields.filter((f) => !colSet.has(f));
  if (missing.length > 0) {
    return {
      success: false,
      reason: `Columnas faltantes: ${missing.join(", ")}`,
    };
  }

  // Extract _META_* fields from the first row
  const meta = {};
  for (const [k, v] of Object.entries(raw[0] ?? {})) {
    if (k.startsWith("_META_")) meta[k] = String(v ?? "").trim();
  }

  // Identity mapping: schema field → same CSV column name
  const mapping = Object.fromEntries(schemaFields.map((f) => [f, f]));
  const result = applyMappingAndValidate(raw, [], mapping, masterName);

  return {
    success: true,
    rows: result.validRows,
    meta,
    valid_count: result.valid_count,
    error_count: result.error_count,
  };
}
