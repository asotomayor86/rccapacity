import React from "react";
import useStore from "../state";

const MASTER_LABELS = {
  DEMANDA: "Demanda",
  PRODUCTO: "Producto",
  ENRUTAMIENTO_MEZCLAS: "Enrutamiento Mezclas",
  CALENDARIO: "Calendario",
};

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatusBar({ collapsed, onToggle }) {
  const getMasterStatus = useStore((s) => s.getMasterStatus);
  const masters = useStore((s) => s.masters);
  // Subscribe to masters so component re-renders on change
  void masters;
  const status = getMasterStatus();

  return (
    <aside
      style={{
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 0.2s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 12px",
          borderBottom: "1px solid var(--border)",
          gap: 8,
        }}
      >
        {!collapsed && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Estado Maestros
          </span>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={onToggle}
          title={collapsed ? "Expandir panel" : "Colapsar panel"}
          style={{ padding: "4px 6px", marginLeft: "auto" }}
        >
          {collapsed ? "‹" : "›"}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
          {Object.entries(MASTER_LABELS).map(([key, label]) => {
            const s = status[key] || {};
            const loaded = s.loaded;
            return (
              <div
                key={key}
                style={{
                  background: "var(--bg-surface-2)",
                  border: `1px solid ${loaded ? "rgba(16,185,129,0.25)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: loaded ? 6 : 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: loaded ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
                    {key}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: loaded ? "var(--success-dim)" : "var(--bg-surface-3)", color: loaded ? "var(--success)" : "var(--text-muted)" }}>
                    {loaded ? "OK" : "VACÍO"}
                  </span>
                </div>
                {loaded && (
                  <>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                      {s.count?.toLocaleString("es-ES")} registros
                    </div>
                    {s.loaded_at && (
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        {fmtDate(s.loaded_at)}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
