import React, { useState } from "react";
import { importarUltimosCsv, ALL_TYPES, TYPE_LABELS } from "../services/importarUltimos";

function fmtDate(d) {
  if (!d) return "—";
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusCell({ row }) {
  if (!row.estado) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  if (row.estado === "procesando") return <span style={{ color: "var(--accent)" }}>⟳ Procesando…</span>;
  if (row.estado === "no_encontrado") return <span style={{ color: "var(--text-muted)" }}>✗ No encontrado</span>;
  if (row.estado === "error") return (
    <span style={{ color: "var(--error)", fontWeight: 700 }} title={row.razon}>✗ Error</span>
  );
  if (row.estado === "ok") return (
    <span style={{ color: "var(--success)", fontWeight: 700 }}>✓ OK</span>
  );
  return null;
}

export default function ImportarUltimosPage() {
  const [running,  setRunning]  = useState(false);
  const [results,  setResults]  = useState(null); // null = not started

  function updateResult(item) {
    setResults((prev) => {
      const base = prev ?? [];
      const idx  = base.findIndex((r) => r.type === item.type);
      if (idx >= 0) { const next = [...base]; next[idx] = item; return next; }
      return [...base, item];
    });
  }

  async function handleImport() {
    setRunning(true);
    setResults([]);
    const res = await importarUltimosCsv({ onProgress: updateResult });
    if (res.cancelled) setResults(null);
    setRunning(false);
  }

  // All rows in canonical order, merged with live results
  const rows = ALL_TYPES.map((type) => {
    const found = results?.find((r) => r.type === type);
    return found ?? { type, filename: null, fecha: null, count: null, estado: null };
  });

  const doneCount = results?.filter((r) => r.estado === "ok").length ?? 0;
  const errCount  = results?.filter((r) => r.estado === "error").length ?? 0;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">IMPORTAR ÚLTIMOS CSV</h1>
        <p className="page-subtitle">
          Selecciona la carpeta de exportación y se importará automáticamente
          el CSV más reciente de cada tipo.
        </p>
      </div>

      <div className="page-body">
        {/* ── Acciones ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={handleImport} disabled={running}>
            {running
              ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Importando…</>
              : "Seleccionar carpeta e importar"}
          </button>
          {results !== null && !running && (
            <button className="btn btn-secondary" onClick={handleImport}>
              Reimportar
            </button>
          )}
        </div>

        {/* ── Estado inicial ── */}
        {results === null && !running && (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Pulsa el botón para seleccionar la carpeta y cargar los archivos más recientes de cada tipo.
          </div>
        )}

        {/* ── Tabla de resultados ── */}
        {results !== null && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Resultado de importación</span>
              {!running && results.length > 0 && (
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {doneCount > 0 && <span style={{ color: "var(--success)", marginRight: 10 }}>✓ {doneCount} importados</span>}
                  {errCount  > 0 && <span style={{ color: "var(--error)"   }}>✗ {errCount} errores</span>}
                </span>
              )}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Archivo</th>
                    <th>Fecha</th>
                    <th style={{ textAlign: "right" }}>Registros</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.type}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>
                        {TYPE_LABELS[row.type] ?? row.type}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: row.filename ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {row.filename ?? "—"}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {fmtDate(row.fecha)}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right" }}>
                        {row.count != null
                          ? <>
                              {row.count.toLocaleString("es-ES")}
                              {row.omitidos > 0 && (
                                <span style={{ color: "var(--warning)", fontSize: 10, marginLeft: 4 }}>
                                  ({row.omitidos} omitidos)
                                </span>
                              )}
                            </>
                          : "—"}
                      </td>
                      <td><StatusCell row={row} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
