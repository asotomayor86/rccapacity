import React, { useEffect, useMemo, useState } from "react";
import useStore from "../state";
import { MASTER_SCHEMAS_META } from "../masterSchemas";
import { exportMasterCsv } from "../services/exporter";

const PAGE_SIZE = 50;

export default function MasterViewer({
  masterName,
  records: recordsProp,
  schema: schemaProp,
  onExport,
  onClose,
  // Optional: { field: "FACTIBLE", value: "NO", label: "filas no factibles" }
  collapsibleGroup,
}) {
  const storeRecords = useStore((s) => s.masters[masterName]?.records ?? []);
  const records  = recordsProp ?? storeRecords;
  const schema   = schemaProp ?? MASTER_SCHEMAS_META[masterName] ?? [];
  const columns  = schema.map((f) => f.name);
  const labels   = schema.map((f) => f.label ?? f.name);
  const boolCols = new Set(schema.filter((f) => f.type === "boolean").map((f) => f.name));
  const colColor = Object.fromEntries(schema.filter((f) => f.color).map((f) => [f.name, f.color]));
  // valueColors: { fieldName: { "SI": "#color", "NO": "#color", ... } }
  const valueColorsMap = Object.fromEntries(
    schema.filter((f) => f.valueColors).map((f) => [f.name, f.valueColors])
  );

  const [colFilters,    setColFilters]    = useState(() => Object.fromEntries(columns.map((c) => [c, ""])));
  const [page,          setPage]          = useState(0);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [groupExpanded, setGroupExpanded] = useState(false);

  // ── Keyboard: Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (isFullscreen) { setIsFullscreen(false); }
      else { onClose(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, onClose]);

  // ── Split records into normal + grouped (if collapsibleGroup) ─────────────
  const { normalRecords, groupedRecords } = useMemo(() => {
    if (!collapsibleGroup) return { normalRecords: records, groupedRecords: [] };
    const { field, value } = collapsibleGroup;
    return {
      normalRecords:  records.filter((r) => String(r[field] ?? "") !== String(value)),
      groupedRecords: records.filter((r) => String(r[field] ?? "") === String(value)),
    };
  }, [records, collapsibleGroup]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const active = columns.filter((c) => colFilters[c]?.trim());

  const filtered = useMemo(() => {
    if (active.length === 0) return normalRecords;
    return normalRecords.filter((row) =>
      active.every((c) => String(row[c] ?? "").toLowerCase().includes(colFilters[c].toLowerCase()))
    );
  }, [normalRecords, colFilters, active]);

  const filteredGrouped = useMemo(() => {
    if (active.length === 0) return groupedRecords;
    return groupedRecords.filter((row) =>
      active.every((c) => String(row[c] ?? "").toLowerCase().includes(colFilters[c].toLowerCase()))
    );
  }, [groupedRecords, colFilters, active]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageRows   = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const startIdx   = safePage * PAGE_SIZE + 1;
  const endIdx     = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  function setFilter(col, val) { setColFilters((prev) => ({ ...prev, [col]: val })); setPage(0); }

  // ── Cell renderer ─────────────────────────────────────────────────────────
  function renderCell(col, row) {
    const val       = row[col];
    const cellColor = colColor[col] === "purple" ? "#a855f7" : "var(--accent)";

    // valueColors: conditional coloring based on cell value (e.g., SI=green, NO=red)
    const vc = valueColorsMap[col];
    if (vc) {
      const vcColor = vc[String(val ?? "")];
      if (vcColor) {
        return (
          <td key={col} style={{ textAlign: boolCols.has(col) ? "center" : undefined }}>
            <span style={{ color: vcColor, fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {String(val ?? "")}
            </span>
          </td>
        );
      }
    }

    if (boolCols.has(col)) {
      return (
        <td key={col} style={{ textAlign: "center" }}>
          {val == null
            ? <span style={{ color: "var(--text-muted)" }}>—</span>
            : val
              ? <span style={{ color: cellColor, fontWeight: 700 }}>✓</span>
              : <span style={{ color: "var(--text-muted)" }}>—</span>
          }
        </td>
      );
    }
    return (
      <td key={col}>
        {val === null || val === undefined ? (
          <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
        ) : (
          <span style={colColor[col] ? { color: cellColor } : undefined}>
            {String(val)}
          </span>
        )}
      </td>
    );
  }

  // ── Overlay & modal styles ─────────────────────────────────────────────────
  const overlayStyle = isFullscreen
    ? { position: "fixed", inset: 0, zIndex: 1000, display: "flex" }
    : { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };

  const modalStyle = {
    background: "var(--bg-surface)",
    border: isFullscreen ? "none" : "1px solid var(--border)",
    borderRadius: isFullscreen ? 0 : "var(--radius-lg)",
    width:  isFullscreen ? "100vw" : "min(95vw, 1100px)",
    height: isFullscreen ? "100vh" : undefined,
    maxHeight: isFullscreen ? "100vh" : "88vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: isFullscreen ? "none" : "var(--shadow)",
    transition: "border-radius 0.2s ease, box-shadow 0.2s ease",
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (!isFullscreen && e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.07em" }}>
              MAESTRO: {masterName}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 12 }}>
              {records.length.toLocaleString("es-ES")} registros totales
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(onExport || masterName !== "SETUP_EXTRUSORAS") && schema.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onExport ? onExport() : exportMasterCsv(masterName, records)}
              >
                ⬇ Exportar CSV
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setIsFullscreen((f) => !f)}
              title={isFullscreen ? "Restaurar tamaño" : "Pantalla completa"}
              style={{ fontSize: 15, lineHeight: 1 }}
            >
              {isFullscreen ? "❐" : "⛶"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 16 }}>
              ✕ Cerrar
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
          <table className="data-table" style={{ minWidth: "100%" }}>
            <thead>
              <tr>
                {columns.map((col, i) => <th key={col}>{labels[i]}</th>)}
              </tr>
              <tr>
                {columns.map((col, i) => (
                  <th key={col} style={{ background: "var(--bg-surface-2)", padding: "6px 6px" }}>
                    <input
                      className="form-control"
                      style={{ fontSize: 11, padding: "3px 6px", fontFamily: "var(--font-mono)", minWidth: 60, width: "100%", boxSizing: "border-box" }}
                      placeholder={labels[i]}
                      value={colFilters[col] ?? ""}
                      onChange={(e) => setFilter(col, e.target.value)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && !collapsibleGroup ? (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px 0" }}>
                    Sin registros que coincidan con los filtros
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => renderCell(col, row))}
                  </tr>
                ))
              )}

              {/* ── Collapsible group section ── */}
              {collapsibleGroup && (
                <>
                  <tr
                    style={{ cursor: "pointer", background: "var(--bg-surface-2)", userSelect: "none" }}
                    onClick={() => setGroupExpanded((g) => !g)}
                  >
                    <td
                      colSpan={columns.length}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--warning)", padding: "8px 12px", fontWeight: 700 }}
                    >
                      {groupExpanded ? "▼" : "▶"}&nbsp;
                      {filteredGrouped.length.toLocaleString("es-ES")} {collapsibleGroup.label}
                      {filteredGrouped.length !== groupedRecords.length && (
                        <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>
                          (filtrado de {groupedRecords.length.toLocaleString("es-ES")})
                        </span>
                      )}
                    </td>
                  </tr>
                  {groupExpanded && filteredGrouped.map((row, i) => (
                    <tr key={`g-${i}`} style={{ opacity: 0.8 }}>
                      {columns.map((col) => renderCell(col, row))}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer / Pagination ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border)", flexShrink: 0, gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {filtered.length === 0
              ? collapsibleGroup ? `0 filas visibles` : "Sin resultados"
              : `Mostrando ${startIdx}–${endIdx} de ${filtered.length.toLocaleString("es-ES")} registros`}
            {filtered.length !== normalRecords.length && (
              <span style={{ color: "var(--accent)", marginLeft: 6 }}>
                (filtrado de {normalRecords.length.toLocaleString("es-ES")})
              </span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
              ← Anterior
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", minWidth: 80, textAlign: "center" }}>
              Página {safePage + 1} de {totalPages}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
