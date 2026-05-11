import React from "react";

const TYPE_LABELS = {
  fecha: "FECHA",
  string: "TEXTO",
  decimal: "NÚMERO",
};

const TYPE_COLORS = {
  fecha: "var(--info)",
  string: "var(--text-muted)",
  decimal: "var(--accent)",
};

export default function ColumnMapper({ schema, rawColumns, mapping, onChange }) {
  const mappedCount = schema.filter((f) => mapping[f.name]).length;
  const requiredCount = schema.filter((f) => f.required).length;
  const mappedRequired = schema.filter((f) => f.required && mapping[f.name]).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Asigna cada columna del maestro a una columna de tu archivo CSV
        </span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
          <span style={{ color: mappedRequired === requiredCount ? "var(--success)" : "var(--error)" }}>
            {mappedRequired}/{requiredCount}
          </span>
          <span style={{ color: "var(--text-muted)" }}> obligatorias</span>
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {schema.map((field) => {
          const mapped = mapping[field.name];
          const missing = field.required && !mapped;

          return (
            <div
              key={field.name}
              style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr",
                gap: 12,
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "var(--radius)",
                background: missing
                  ? "rgba(239,68,68,0.06)"
                  : mapped
                  ? "rgba(16,185,129,0.06)"
                  : "var(--bg-surface-2)",
                border: `1px solid ${
                  missing
                    ? "rgba(239,68,68,0.25)"
                    : mapped
                    ? "rgba(16,185,129,0.2)"
                    : "var(--border)"
                }`,
              }}
            >
              {/* Left: master field info */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: mapped
                      ? "var(--success)"
                      : missing
                      ? "var(--error)"
                      : "var(--border)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {field.label ?? field.name}
                    {field.required && (
                      <span style={{ color: "var(--error)", marginLeft: 2 }}>*</span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: TYPE_COLORS[field.type] || "var(--text-muted)",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {TYPE_LABELS[field.type] || field.type}
                    {!field.required && (
                      <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 4 }}>
                        · opcional
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: dropdown */}
              <select
                className="form-control"
                value={mapped || ""}
                onChange={(e) => onChange({ ...mapping, [field.name]: e.target.value || undefined })}
                style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}
              >
                <option value="">— sin mapear —</option>
                {rawColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
        <span style={{ color: "var(--error)" }}>*</span> campos obligatorios
      </div>
    </div>
  );
}
