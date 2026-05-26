import { MASTER_SCHEMAS_META } from "../masterSchemas";
import { saveCSV } from "./fileSystemAccess";

const VERSION = "2.0";

const COLUMN_ORDER = [
  "MES", "REFERENCIA", "MEZCLA", "EXTRUSORA", "CT",
  "CANTIDAD", "ANCHO", "GALGA", "TIPO", "TRATAMIENTO", "ABREFACIL",
  "RS_MIN", "RS_MAXIMO", "GMAX_SOLDADURA",
  "HORAS_TOTALES", "EFICIENCIA", "HORAS_EFICIENTES",
  "CARGA", "OCUPACION",
  "VERSION", "TIMESTAMP_EXPORT",
];

function fmtNum(v) {
  if (v == null) return "";
  const s = v.toFixed(6);
  return s.replace(/\.?0+$/, "");
}

function escapeCell(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function datestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function exportToCsv(records) {
  if (!records || records.length === 0) return;
  const timestamp = new Date().toISOString().slice(0, 19);
  const header = COLUMN_ORDER.join(",");
  const rows = records.map((r) =>
    COLUMN_ORDER.map((col) => {
      if (col === "VERSION") return VERSION;
      if (col === "TIMESTAMP_EXPORT") return timestamp;
      const val = r[col];
      if (val == null) return "";
      if (typeof val === "number") return escapeCell(fmtNum(val));
      return escapeCell(val);
    }).join(",")
  );
  await saveCSV(`capacidad_resultado_${datestamp()}.csv`, [header, ...rows].join("\n"));
}

const SETUP_EXTRUSORAS_COLS = [
  "NOMBRE_EXTRUSORA", "ES_ACTUAL", "CAPAS", "HILERA", "HUSILLOS",
  "VMAX_KG_H", "VMAX_M_MIN", "RPM_MAX", "SOPLADO_HD", "SOPLADO_LD",
  "ANCHO_MAXIMO", "CORTE_LATERAL", "CORTE_CENTRAL", "ABREFACIL_LATERAL",
  "ABREFACIL_CENTRAL", "SOLDADOR_LONGITUDINAL", "MADERAS_PLEGADO",
  "VENTANA_MIN_PLEGADO", "FUELLE_MAXIMO", "TRATADOR_CORONA", "CORTE_LAMINA",
  // Parámetros de rendimiento (modelo de cuellos)
  "D_DIE", "COOLING_FACTOR", "CORONA_KW", "V_MAX_SOLDADOR", "V_MAX_ABREFACIL",
];

const BOOL_FIELDS = new Set([
  "ES_ACTUAL", "SOPLADO_HD", "SOPLADO_LD", "CORTE_LATERAL", "CORTE_CENTRAL",
  "ABREFACIL_LATERAL", "ABREFACIL_CENTRAL", "SOLDADOR_LONGITUDINAL",
  "MADERAS_PLEGADO", "TRATADOR_CORONA", "CORTE_LAMINA",
]);

export async function exportSetupExtrusoras(records, fechaRevision) {
  if (!records || records.length === 0) return;
  const fechaExportacion = new Date().toISOString();
  const allCols = [...SETUP_EXTRUSORAS_COLS, "_META_FECHA_REVISION", "_META_FECHA_EXPORTACION"];
  const header = allCols.join(",");
  const rows = records.map((r) =>
    allCols.map((col) => {
      if (col === "_META_FECHA_REVISION")    return escapeCell(fechaRevision ?? "");
      if (col === "_META_FECHA_EXPORTACION") return escapeCell(fechaExportacion);
      const val = r[col];
      if (val == null) return "";
      if (BOOL_FIELDS.has(col)) return val ? "SI" : "NO";
      if (typeof val === "number") return escapeCell(fmtNum(val));
      return escapeCell(String(val));
    }).join(",")
  );
  await saveCSV(`setup_extrusoras_${datestamp()}.csv`, [header, ...rows].join("\n"));
}

export async function exportMasterCsv(masterName, records) {
  if (!records || records.length === 0) return;
  const schema = MASTER_SCHEMAS_META[masterName] ?? [];
  const fields = schema.map((f) => f.name);
  if (fields.length === 0) return;
  const header = fields.join(",");
  const rows = records.map((r) =>
    fields.map((field) => {
      const val = r[field];
      if (val == null) return "";
      if (typeof val === "boolean") return val ? "SI" : "NO";
      if (typeof val === "string")  return escapeCell(val);
      if (typeof val === "number")  return escapeCell(fmtNum(val));
      return escapeCell(String(val));
    }).join(",")
  );
  const filename = `${masterName.toLowerCase().replace(/_/g, "_")}_${datestamp()}.csv`;
  await saveCSV(filename, [header, ...rows].join("\n"));
}

const REGLAS_CSV_COLS = [
  "REGLA_ID", "CAMPO_DESTINO", "PRIORIDAD",
  "COND_FUENTE", "COND_CAMPO", "COND_OPERADOR", "COND_VALOR",
  "RESULTADO_TIPO", "RESULTADO_VALOR",
];

export async function exportReglasCsv(reglas) {
  if (!reglas || reglas.length === 0) return;
  const header = REGLAS_CSV_COLS.join(",");
  const rows = [];
  for (const regla of reglas) {
    const base = {
      REGLA_ID: regla.id, CAMPO_DESTINO: regla.campo, PRIORIDAD: String(regla.prioridad),
      RESULTADO_TIPO: regla.resultado.tipo, RESULTADO_VALOR: regla.resultado.valor ?? "",
    };
    const condiciones = regla.condiciones.length > 0 ? regla.condiciones : [{}];
    for (const cond of condiciones) {
      const row = { ...base, COND_FUENTE: cond.fuente ?? "", COND_CAMPO: cond.campo ?? "", COND_OPERADOR: cond.operador ?? "", COND_VALOR: cond.valor ?? "" };
      rows.push(REGLAS_CSV_COLS.map((col) => escapeCell(row[col] ?? "")).join(","));
    }
  }
  await saveCSV(`reglas_producto_complejo_${datestamp()}.csv`, [header, ...rows].join("\n"));
}

export async function exportEnrutamientos(rows, extraColumns = []) {
  if (!rows || rows.length === 0) return;
  const cols    = ["REFERENCIA_COMPLEJA", "MEZCLA", "EXTRUSORA", ...extraColumns];
  const header  = cols.join(",");
  const csvRows = rows.map((row) =>
    cols.map((col) => {
      const val = row[col];
      if (val == null) return "";
      if (typeof val === "boolean") return val ? "SI" : "NO";
      if (typeof val === "number")  return escapeCell(fmtNum(val));
      return escapeCell(String(val));
    }).join(",")
  );
  await saveCSV(`enrutamientos_${datestamp()}.csv`, [header, ...csvRows].join("\n"));
}

const REGLAS_FACT_COLS = [
  "REGLA_ID", "CAMPO_DESTINO", "PRIORIDAD",
  "COND_FUENTE", "COND_CAMPO", "COND_OPERADOR", "COND_VALOR",
  "RESULTADO_TIPO", "RESULTADO_VALOR",
];

export async function exportReglasFact(reglas) {
  if (!reglas || reglas.length === 0) return;
  const header = REGLAS_FACT_COLS.join(",");
  const rows = [];
  for (const regla of reglas) {
    const base = {
      REGLA_ID:        regla.id,
      CAMPO_DESTINO:   regla.campo ?? "FACTIBLE",
      PRIORIDAD:       String(regla.prioridad),
      RESULTADO_TIPO:  regla.resultado?.tipo  ?? "valor_fijo",
      RESULTADO_VALOR: regla.resultado?.valor ?? "NO",
    };
    const condiciones = regla.condiciones?.length > 0 ? regla.condiciones : [{}];
    for (const cond of condiciones) {
      const row = {
        ...base,
        COND_FUENTE:   cond.fuente   ?? "",
        COND_CAMPO:    cond.campo    ?? "",
        COND_OPERADOR: cond.operador ?? "",
        COND_VALOR:    cond.valor    ?? "",
      };
      rows.push(REGLAS_FACT_COLS.map((col) => escapeCell(row[col] ?? "")).join(","));
    }
  }
  await saveCSV(`reglas_factibilidad_${datestamp()}.csv`, [header, ...rows].join("\n"));
}

const CALCULOS_CSV_COLS = ["CALCULO_ID", "NOMBRE", "DESCRIPCION", "UNIDAD", "ARBOL_JSON"];

export async function exportCalculos(definiciones) {
  if (!definiciones || definiciones.length === 0) return;
  const header = CALCULOS_CSV_COLS.join(",");
  const rows = definiciones.map((def) =>
    CALCULOS_CSV_COLS.map((col) => {
      if (col === "CALCULO_ID")  return escapeCell(def.id);
      if (col === "NOMBRE")      return escapeCell(def.nombre ?? "");
      if (col === "DESCRIPCION") return escapeCell(def.descripcion ?? "");
      if (col === "UNIDAD")      return escapeCell(def.unidad ?? "");
      if (col === "ARBOL_JSON")  return escapeCell(JSON.stringify(def.arbol ?? null));
      return "";
    }).join(",")
  );
  await saveCSV(`calculos_${datestamp()}.csv`, [header, ...rows].join("\n"));
}

export async function exportLog(logLines) {
  if (!logLines || logLines.length === 0) return;
  const content = `LOG DE CÁLCULO — ${new Date().toLocaleString("es-ES")}\n${"─".repeat(60)}\n${logLines.join("\n")}\n`;
  await saveCSV(`calculo_log_${datestamp()}.txt`, content);
}
