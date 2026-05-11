import React, { useMemo, useState } from "react";
import useStore from "../state";
import { exportSetupExtrusoras } from "../services/exporter";

// ── Design tokens ─────────────────────────────────────────────────────────────

const BOOL_TRUE  = <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span>;
const BOOL_FALSE = <span style={{ color: "var(--text-muted)" }}>—</span>;

// ── Shared sub-components ─────────────────────────────────────────────────────

function BoolCell({ value }) {
  return value == null ? BOOL_FALSE : value ? BOOL_TRUE : BOOL_FALSE;
}

function NumCell({ value, decimals = 0 }) {
  if (value == null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  return (
    <span style={{ fontFamily: "var(--font-mono)", display: "block", textAlign: "right" }}>
      {Number(value).toLocaleString("es-ES", { maximumFractionDigits: decimals })}
    </span>
  );
}

// SVG radio indicator for the "Actual" column
function ActualRadio({ isActual, onClick }) {
  return (
    <div
      onClick={onClick}
      title={isActual ? "Configuración actual" : "Marcar como actual"}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: isActual ? "default" : "pointer", padding: "2px" }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke={isActual ? "var(--accent)" : "var(--border)"} strokeWidth="1.5" />
        {isActual && <circle cx="8" cy="8" r="4" fill="var(--accent)" />}
      </svg>
    </div>
  );
}

function Toggle({ value, onChange }) {
  const isOn = !!value;
  return (
    <div
      role="switch"
      aria-checked={isOn}
      onClick={() => onChange(!isOn)}
      style={{
        width: 40, height: 20, borderRadius: 10, position: "relative",
        background: isOn ? "var(--accent)" : "var(--bg-surface-3)",
        border: `1px solid ${isOn ? "var(--accent)" : "var(--border)"}`,
        cursor: "pointer", transition: "background 0.18s, border-color 0.18s", flexShrink: 0,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 8, background: "#fff",
        position: "absolute", top: 1, left: isOn ? 22 : 1,
        transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
      }} />
    </div>
  );
}

// ── Modal section layout ──────────────────────────────────────────────────────

function SectionTitle({ title }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase",
      letterSpacing: "0.1em", borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 6,
      gridColumn: "1 / -1",
    }}>
      {title}
    </div>
  );
}

// View-mode field row
function ViewField({ label, value, bool = false }) {
  let display;
  if (bool) {
    display = value == null ? "—" : value ? "SÍ" : "NO";
  } else if (value == null || value === "") {
    display = <span style={{ color: "var(--text-muted)" }}>—</span>;
  } else {
    display = <span style={{ fontFamily: "var(--font-mono)" }}>{String(value)}</span>;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid rgba(45,55,72,0.35)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 12, color: bool && value ? "var(--accent)" : "var(--text-primary)", fontWeight: bool && value ? 600 : 400 }}>
        {display}
      </span>
    </div>
  );
}

// Edit-mode field row
function EditField({ label, fieldKey, type, draft, onDraftChange, error, positive }) {
  const val = draft[fieldKey];

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "3px 0", borderBottom: "1px solid rgba(45,55,72,0.35)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
        {type === "boolean" ? (
          <Toggle value={val} onChange={(v) => onDraftChange(fieldKey, v)} />
        ) : type === "decimal" ? (
          <input
            type="number"
            step="any"
            min={positive ? "0.000001" : undefined}
            value={val ?? ""}
            onChange={(e) => onDraftChange(fieldKey, e.target.value === "" ? null : Number(e.target.value))}
            className="form-control"
            style={{ width: 110, fontSize: 12, padding: "3px 7px", fontFamily: "var(--font-mono)", textAlign: "right" }}
          />
        ) : (
          <input
            type="text"
            value={val ?? ""}
            onChange={(e) => onDraftChange(fieldKey, e.target.value || null)}
            className="form-control"
            style={{ width: 150, fontSize: 12, padding: "3px 7px" }}
          />
        )}
      </div>
      {error && <span style={{ fontSize: 10, color: "var(--error)", marginTop: 2, textAlign: "right" }}>{error}</span>}
    </div>
  );
}

// ── Field definitions for the modal ──────────────────────────────────────────

const MODAL_SECTIONS = [
  {
    title: "Capacidades",
    fields: [
      { key: "VMAX_KG_H",   label: "Velocidad máx. (kg/h)",  type: "decimal",  positive: true },
      { key: "VMAX_M_MIN",  label: "Velocidad máx. (m/min)", type: "decimal",  positive: true },
      { key: "RPM_MAX",     label: "RPM máximo",              type: "string"  },
      { key: "CAPAS",       label: "Capas",                   type: "decimal"  },
      { key: "HILERA",      label: "Hilera",                  type: "string"  },
      { key: "HUSILLOS",    label: "Husillos",                type: "string"  },
      { key: "ANCHO_MAXIMO",label: "Ancho máximo (mm)",       type: "decimal",  positive: true },
    ],
  },
  {
    title: "Soplado",
    fields: [
      { key: "SOPLADO_HD", label: "Soplado HD", type: "boolean" },
      { key: "SOPLADO_LD", label: "Soplado LD", type: "boolean" },
    ],
  },
  {
    title: "Corte y acabado",
    fields: [
      { key: "CORTE_LATERAL",         label: "Corte lateral",         type: "boolean" },
      { key: "CORTE_CENTRAL",         label: "Corte central",         type: "boolean" },
      { key: "ABREFACIL_LATERAL",     label: "Abrefácil lateral",     type: "boolean" },
      { key: "ABREFACIL_CENTRAL",     label: "Abrefácil central",     type: "boolean" },
      { key: "SOLDADOR_LONGITUDINAL", label: "Soldador longitudinal", type: "boolean" },
      { key: "CORTE_LAMINA",          label: "Corte lámina",          type: "boolean" },
    ],
  },
  {
    title: "Plegado y extras",
    fields: [
      { key: "MADERAS_PLEGADO",     label: "Maderas plegado",          type: "boolean" },
      { key: "VENTANA_MIN_PLEGADO", label: "Ventana mín. plegado (mm)", type: "decimal", positive: true },
      { key: "FUELLE_MAXIMO",       label: "Fuelle máximo (mm)",        type: "decimal", positive: true },
      { key: "TRATADOR_CORONA",     label: "Tratador corona",           type: "boolean" },
    ],
  },
];

const POSITIVE_FIELDS = new Set(
  MODAL_SECTIONS.flatMap((s) => s.fields.filter((f) => f.positive).map((f) => f.key))
);

// ── Modal ─────────────────────────────────────────────────────────────────────

function ExtrusoraModal({ row, globalIndex, onClose, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(() => ({ ...row }));
  const [fieldErrors, setFieldErrors] = useState({});

  // Keep draft fresh with store changes when in view mode
  // (edit mode intentionally holds its own draft)
  const displayRow = editMode ? draft : row;

  function handleDraftChange(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  }

  function handleEdit() {
    setDraft({ ...row });
    setFieldErrors({});
    setEditMode(true);
  }

  function handleCancel() {
    setDraft({ ...row });
    setFieldErrors({});
    setEditMode(false);
  }

  function handleSave() {
    const errors = {};
    for (const key of POSITIVE_FIELDS) {
      const v = draft[key];
      if (v != null && typeof v === "number" && v <= 0) {
        errors[key] = "Debe ser > 0";
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    onSave(globalIndex, draft);
    setEditMode(false);
    setFieldErrors({});
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget && !editMode) onClose(); }}
    >
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", width: "min(92vw, 680px)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {row.NOMBRE_EXTRUSORA}
            </span>
            {row.ES_ACTUAL && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--border-accent)" }}>
                ACTUAL
              </span>
            )}
            {editMode && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--info-dim)", color: "var(--info)", border: "1px solid rgba(59,130,246,0.3)" }}>
                EDITANDO
              </span>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { if (!editMode) onClose(); else handleCancel(); }} style={{ fontSize: 16 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "14px 20px", flex: 1 }}>
          {MODAL_SECTIONS.map((section) => (
            <div key={section.title} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 6 }}>
                {section.title}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                {section.fields.map((f) =>
                  editMode ? (
                    <EditField
                      key={f.key}
                      label={f.label}
                      fieldKey={f.key}
                      type={f.type}
                      positive={f.positive}
                      draft={draft}
                      onDraftChange={handleDraftChange}
                      error={fieldErrors[f.key]}
                    />
                  ) : (
                    <ViewField
                      key={f.key}
                      label={f.label}
                      value={displayRow[f.key]}
                      bool={f.type === "boolean"}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "12px 20px", borderTop: "1px solid var(--border)", flexShrink: 0, gap: 8 }}>
          {!editMode ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={handleEdit}>Editar</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                NOMBRE_EXTRUSORA y ES_ACTUAL no son editables aquí.
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={handleCancel}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Table columns ─────────────────────────────────────────────────────────────

const TABLE_BOOL_COLS = [
  "SOPLADO_HD", "SOPLADO_LD", "CORTE_LATERAL", "CORTE_CENTRAL",
  "ABREFACIL_LATERAL", "ABREFACIL_CENTRAL", "SOLDADOR_LONGITUDINAL",
  "MADERAS_PLEGADO", "TRATADOR_CORONA", "CORTE_LAMINA",
];

const TABLE_NUM_COLS = [
  { key: "CAPAS",       label: "Capas",       dec: 0 },
  { key: "VMAX_KG_H",   label: "Vmax kg/h",   dec: 1 },
  { key: "VMAX_M_MIN",  label: "Vmax m/min",  dec: 1 },
  { key: "ANCHO_MAXIMO",label: "Ancho máx.",  dec: 0 },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SetupExtrusorasPage() {
  const records              = useStore((s) => s.masters.SETUP_EXTRUSORAS?.records ?? []);
  const revision             = useStore((s) => s.setupExtrusorasRevision);
  const markAsActual         = useStore((s) => s.markAsActual);
  const updateSetupExtrusora = useStore((s) => s.updateSetupExtrusora);

  const [selectedGlobalIndex, setSelectedGlobalIndex] = useState(null);

  const isEmpty = records.length === 0;

  // Derive selected row reactively from store
  const selectedRow = selectedGlobalIndex != null ? records[selectedGlobalIndex] : null;

  // Stable order: insertion order from the store, no sort applied
  const tableRows = useMemo(
    () => records.map((row, globalIndex) => ({ row, globalIndex })),
    [records]
  );

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title">SETUP EXTRUSORAS</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
              <p className="page-subtitle" style={{ margin: 0 }}>
                Configuraciones de líneas de extrusión. Click en una fila para ver el detalle.
              </p>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Última revisión: </span>
                {revision
                  ? <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600 }}>{revision}</span>
                  : <span style={{ color: "var(--text-muted)" }}>—</span>
                }
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!isEmpty && (
              <button className="btn btn-primary" onClick={() => exportSetupExtrusoras(records, revision)}>
                ⬇ Exportar CSV
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* ── Empty state ── */}
        {isEmpty && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <svg viewBox="0 0 48 48" fill="none" style={{ width: 64, height: 64, margin: "0 auto 16px", opacity: 0.2 }}>
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
              <path d="M16 24a8 8 0 0116 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="18" cy="20" r="2" fill="currentColor" />
              <circle cx="30" cy="20" r="2" fill="currentColor" />
              <path d="M24 12v4M24 32v4M12 24h4M32 24h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>Sin datos de extrusoras</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carga los datos desde la página de Maestros.</div>
          </div>
        )}

        {/* ── Table ── */}
        {!isEmpty && (
          <div className="table-wrap" style={{ maxHeight: "calc(100vh - 200px)" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--bg-surface-2)", minWidth: 180 }}>
                    EXTRUSORA
                  </th>
                  <th style={{ textAlign: "center", width: 48 }}>Actual</th>
                  {TABLE_NUM_COLS.map((c) => (
                    <th key={c.key} style={{ textAlign: "right" }}>{c.label}</th>
                  ))}
                  {TABLE_BOOL_COLS.map((c) => (
                    <th key={c} style={{ textAlign: "center", fontSize: 9, letterSpacing: "0.04em" }}>
                      {c.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(({ row, globalIndex }, ti) => {
                  const rowBg = ti % 2 === 0 ? "transparent" : "rgba(26,29,39,0.5)";
                  const stickyBg = ti % 2 === 0 ? "var(--bg-primary)" : "var(--bg-surface)";
                  return (
                    <tr
                      key={globalIndex}
                      onClick={() => setSelectedGlobalIndex(globalIndex)}
                      style={{
                        cursor: "pointer",
                        background: rowBg,
                        borderLeft: row.ES_ACTUAL ? "3px solid var(--accent)" : "3px solid transparent",
                      }}
                    >
                      {/* Sticky name column */}
                      <td style={{ position: "sticky", left: 0, zIndex: 1, background: stickyBg, fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                            {row.NOMBRE_EXTRUSORA}
                          </span>
                          {row.ES_ACTUAL && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent)" }}>
                              ACTUAL
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Actual radio column */}
                      <td
                        style={{ textAlign: "center" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!row.ES_ACTUAL) markAsActual(row.NOMBRE_EXTRUSORA, globalIndex);
                        }}
                      >
                        <ActualRadio isActual={!!row.ES_ACTUAL} onClick={() => {}} />
                      </td>
                      {TABLE_NUM_COLS.map((c) => (
                        <td key={c.key} style={{ textAlign: "right" }}>
                          <NumCell value={row[c.key]} decimals={c.dec} />
                        </td>
                      ))}
                      {TABLE_BOOL_COLS.map((c) => (
                        <td key={c} style={{ textAlign: "center" }}>
                          <BoolCell value={row[c]} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail / Edit modal ── */}
      {selectedRow && (
        <ExtrusoraModal
          key={selectedGlobalIndex}
          row={selectedRow}
          globalIndex={selectedGlobalIndex}
          onClose={() => setSelectedGlobalIndex(null)}
          onSave={(idx, campos) => updateSetupExtrusora(idx, campos)}
        />
      )}
    </>
  );
}
