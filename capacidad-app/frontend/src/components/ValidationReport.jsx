import React, { useState } from "react";

export default function ValidationReport({ report }) {
  const [showErrors, setShowErrors] = useState(false);
  if (!report) return null;

  const { total, valid_count, error_count, success_pct, errors, preview } = report;
  const ok = error_count === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        {[
          { label: "Total CSV", value: total?.toLocaleString("es-ES"), color: "var(--text-primary)" },
          { label: "Válidas", value: valid_count?.toLocaleString("es-ES"), color: "var(--success)" },
          { label: "Con error", value: error_count?.toLocaleString("es-ES"), color: error_count > 0 ? "var(--error)" : "var(--text-muted)" },
          { label: "Éxito", value: `${success_pct}%`, color: ok ? "var(--success)" : success_pct >= 90 ? "var(--warning)" : "var(--error)" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "var(--bg-surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Status alert */}
      <div className={`alert alert-${ok ? "success" : error_count < total * 0.1 ? "warning" : "error"}`}>
        {ok
          ? "✓ Todas las filas son válidas. Puedes proceder a importar."
          : error_count === total
          ? "✗ Todas las filas tienen errores. Revisa el mapeo de columnas."
          : `⚠ ${error_count} filas tienen errores y serán omitidas. Se importarán ${valid_count} filas válidas.`}
      </div>

      {/* Error list */}
      {errors && errors.length > 0 && (
        <div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowErrors(!showErrors)}
            style={{ marginBottom: 8 }}
          >
            {showErrors ? "▲ Ocultar errores" : `▼ Ver errores (${errors.length})`}
          </button>
          {showErrors && (
            <div
              style={{
                maxHeight: 220,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Fila CSV</th>
                    <th>Campo</th>
                    <th>Valor recibido</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.flatMap((e) =>
                    e.errors.map((fe, j) => (
                      <tr key={`${e.row}-${j}`}>
                        <td style={{ color: "var(--text-muted)" }}>{e.row}</td>
                        <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fe.field}</td>
                        <td style={{ color: "var(--error)", fontFamily: "var(--font-mono)" }}>
                          {fe.value ?? "—"}
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>{fe.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Preview valid rows */}
      {preview && preview.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Preview — primeras filas válidas
          </div>
          <div className="table-wrap" style={{ maxHeight: 180 }}>
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j}>
                        {val === null || val === undefined ? (
                          <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
