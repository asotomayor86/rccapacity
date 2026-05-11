import React, { useState } from "react";
import { useToast } from "../components/Toast";
import { calculate } from "../services/engine";
import { exportToCsv, exportLog } from "../services/exporter";
import useStore from "../state";

const COL_FORMAT = {
  CANTIDAD:         (v) => (v != null ? Number(v).toLocaleString("es-ES") : "—"),
  ANCHO:            (v) => (v != null ? Number(v).toFixed(0) : "—"),
  GALGA:            (v) => (v != null ? Number(v).toFixed(2) : "—"),
  RS_MIN:           (v) => (v != null ? Number(v).toFixed(2) : "—"),
  RS_MAXIMO:        (v) => (v != null ? Number(v).toFixed(2) : "—"),
  GMAX_SOLDADURA:   (v) => (v != null ? Number(v).toFixed(2) : "—"),
  HORAS_TOTALES:    (v) => (v != null ? Number(v).toFixed(2) : "—"),
  EFICIENCIA:       (v) => (v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—"),
  HORAS_EFICIENTES: (v) => (v != null ? Number(v).toFixed(2) : "—"),
  CARGA:            (v) => (v != null ? Number(v).toFixed(2) : "—"),
  OCUPACION:        (v) => (v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—"),
};

function fmtCell(col, val) {
  if (val === null || val === undefined || val === "") return "—";
  if (COL_FORMAT[col]) return COL_FORMAT[col](val);
  return String(val);
}

function ocupacionColor(row) {
  const v = row.OCUPACION;
  if (v == null) return "var(--text-muted)";
  if (v > 1) return "var(--error)";
  if (v > 0.85) return "var(--warning)";
  return "var(--success)";
}

const DISPLAY_COLS = [
  "MES", "REFERENCIA", "MEZCLA", "EXTRUSORA", "CT",
  "CANTIDAD", "ANCHO", "GALGA", "TIPO",
  "HORAS_TOTALES", "EFICIENCIA", "HORAS_EFICIENTES",
  "CARGA", "OCUPACION",
];

export default function ResultadosPage() {
  const toast = useToast();
  const [calculating, setCalculating] = useState(false);
  const [filter, setFilter] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const masters = useStore((s) => s.masters);
  const results = useStore((s) => s.results);

  async function handleCalculate() {
    setCalculating(true);
    try {
      const { records, log } = calculate({
        demanda: masters.DEMANDA.records,
        producto: masters.PRODUCTO.records,
        enrutamientoMezclas: masters.ENRUTAMIENTO_MEZCLAS.records,
        calendario: masters.CALENDARIO.records,
      });
      toast.success(`Motor ejecutado: ${records.length} registros generados`);
      if (log.some((l) => l.startsWith("⚠"))) {
        log.filter((l) => l.startsWith("⚠")).forEach((w) => toast.warning(w));
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCalculating(false);
    }
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const rows = results.records ?? [];
  const log = results.log ?? [];
  const lowFilter = filter.toLowerCase();

  let filtered = filter
    ? rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(lowFilter)))
    : rows;

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const totalCarga = rows.reduce((s, r) => s + (r.CARGA || 0), 0);
  const sinCap = rows.filter((r) => r.HORAS_DISPONIBLES === null).length;
  const overloaded = rows.filter((r) => r.OCUPACION != null && r.OCUPACION > 1).length;
  const total = rows.length;

  const missingMasters = Object.entries(masters)
    .filter(([, d]) => d.count === 0)
    .map(([n]) => n);

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title">RESULTADOS</h1>
            <p className="page-subtitle">Ejecuta el motor de cálculo y analiza la carga de trabajo por CM/CT/MES.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={handleCalculate} disabled={calculating || missingMasters.length > 0} title={missingMasters.length > 0 ? `Faltan maestros: ${missingMasters.join(", ")}` : ""}>
              {calculating ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Calculando…</> : "▶ Ejecutar cálculo"}
            </button>
            {total > 0 && (
              <>
                <button className="btn btn-secondary" onClick={() => exportToCsv(rows)}>⬇ Exportar CSV</button>
                {log.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => exportLog(log)}>📋 Log</button>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        {missingMasters.length > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            ⚠ Maestros sin cargar: <strong>{missingMasters.join(", ")}</strong>. Carga todos para ejecutar el cálculo.
          </div>
        )}

        {!total && !calculating && missingMasters.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>⚙</div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: "var(--text-secondary)" }}>Sin resultados</div>
            <div style={{ fontSize: 13 }}>Todos los maestros están cargados. Haz clic en "Ejecutar cálculo".</div>
          </div>
        )}

        {calculating && (
          <div className="flex items-center gap-3" style={{ padding: "40px 0" }}>
            <div className="spinner" />
            <span style={{ color: "var(--text-muted)" }}>Ejecutando motor de cálculo…</span>
          </div>
        )}

        {total > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid-4">
              {[
                { label: "Registros", value: total.toLocaleString("es-ES"), color: "var(--accent)" },
                { label: "Carga total (h)", value: totalCarga.toFixed(1), color: "var(--text-primary)" },
                { label: "Sin capacidad def.", value: sinCap, color: sinCap > 0 ? "var(--warning)" : "var(--text-muted)" },
                { label: "CM sobrecargadas", value: overloaded, color: overloaded > 0 ? "var(--error)" : "var(--success)" },
              ].map((k) => (
                <div key={k.label} className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input className="form-control" style={{ maxWidth: 320 }} placeholder="Filtrar resultados…" value={filter} onChange={(e) => setFilter(e.target.value)} />
              {filter && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{filtered.length} de {rows.length} filas</span>}
            </div>

            <div className="table-wrap" style={{ maxHeight: "calc(100vh - 380px)" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {DISPLAY_COLS.map((col) => (
                      <th key={col} onClick={() => handleSort(col)} style={{ cursor: "pointer", userSelect: "none" }}>
                        {col}
                        {sortCol === col && <span style={{ marginLeft: 4, color: "var(--accent)" }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((row, i) => (
                    <tr key={i}>
                      {DISPLAY_COLS.map((col) => (
                        <td key={col} style={col === "OCUPACION" ? { color: ocupacionColor(row), fontWeight: 600 } : {}}>
                          {fmtCell(col, row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 500 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                Mostrando 500 de {filtered.length} filas (exporta el CSV para ver todos)
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
