import React from "react";

export default function DataPreview({ columns, rows, maxRows = 5, caption }) {
  if (!columns || columns.length === 0) return null;
  const displayed = rows.slice(0, maxRows);

  return (
    <div>
      {caption && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: 8,
          }}
        >
          {caption}
        </div>
      )}
      <div className="table-wrap" style={{ maxHeight: 220 }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>
                    {row[col] === null || row[col] === undefined ? (
                      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                        —
                      </span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, textAlign: "right" }}>
          Mostrando {maxRows} de {rows.length} filas
        </div>
      )}
    </div>
  );
}
