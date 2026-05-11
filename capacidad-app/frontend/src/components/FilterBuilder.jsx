import React, { useState } from "react";
import { useToast } from "./Toast";
import useStore from "../state";

const STRING_OPS = [
  { value: "igual_a", label: "es igual a" },
  { value: "no_igual_a", label: "es distinto de" },
  { value: "contiene", label: "contiene" },
  { value: "starts_with", label: "comienza por" },
];

const DECIMAL_OPS = [
  { value: "mayor_que", label: ">" },
  { value: "mayor_igual", label: ">=" },
  { value: "menor_que", label: "<" },
  { value: "menor_igual", label: "<=" },
  { value: "entre", label: "entre" },
];

const DATE_OPS = [
  { value: "desde", label: "desde (>=)" },
  { value: "hasta", label: "hasta (<=)" },
  { value: "igual_mes", label: "igual a mes" },
];

function opsForType(type) {
  if (type === "decimal") return DECIMAL_OPS;
  if (type === "fecha") return DATE_OPS;
  return STRING_OPS;
}

function getColType(colName, schema, mapping) {
  for (const field of schema) {
    if (mapping[field.name] === colName) return field.type;
  }
  return "string";
}

function opLabel(op) {
  const all = [...STRING_OPS, ...DECIMAL_OPS, ...DATE_OPS];
  return all.find((o) => o.value === op)?.label ?? op.replace(/_/g, " ");
}

let _seq = 0;

export default function FilterBuilder({ rawColumns, schema, mapping, filters, onChange }) {
  const toast = useToast();

  const savedFilters = useStore((s) => s.savedFilters);
  const setSavedFilter = useStore((s) => s.setSavedFilter);
  const deleteSavedFilter = useStore((s) => s.deleteSavedFilter);

  const [newCol, setNewCol] = useState("");
  const [newOp, setNewOp] = useState("");
  const [newVal, setNewVal] = useState("");
  const [newVal2, setNewVal2] = useState("");
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");

  const colType = newCol ? getColType(newCol, schema, mapping) : "string";
  const ops = opsForType(colType);
  const presetNames = Object.keys(savedFilters).sort();

  function addFilter() {
    if (!newCol || !newOp) return;
    onChange([...filters, { _id: ++_seq, column: newCol, op: newOp, value: newVal, value2: newVal2 }]);
    setNewVal("");
    setNewVal2("");
  }

  function removeFilter(id) {
    onChange(filters.filter((f) => f._id !== id));
  }

  function handleSavePreset() {
    const name = saveName.trim();
    if (!name) return;
    if (filters.length === 0) { toast.warning("No hay filtros activos que guardar"); return; }
    const payload = filters.map(({ _id, ...rest }) => rest);
    setSavedFilter(name, payload);
    toast.success(`Preset "${name}" guardado`);
    setSaveName("");
    setShowSaveInput(false);
  }

  function handleDeletePreset(name) {
    deleteSavedFilter(name);
    toast.info(`Preset "${name}" eliminado`);
    if (selectedPreset === name) setSelectedPreset("");
  }

  function handleLoadPreset(name) {
    const raw = savedFilters[name];
    if (!raw) return;
    onChange(raw.map((f) => ({ ...f, _id: ++_seq })));
    setSelectedPreset(name);
    toast.info(`Preset "${name}" cargado — ${raw.length} filtros`);
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
        Los filtros se aplican sobre las columnas del CSV original antes del mapeo.
        {filters.length === 0 && " Sin filtros activos — se importarán todas las filas."}
      </div>

      {/* Active filters */}
      {filters.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          {filters.map((f) => (
            <div key={f._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600 }}>{f.column}</span>
              <span style={{ color: "var(--text-muted)" }}>{opLabel(f.op)}</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{f.value}{f.value2 && ` — ${f.value2}`}</span>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", padding: "2px 6px", color: "var(--error)" }} onClick={() => removeFilter(f._id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add new filter */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr auto", gap: 8, alignItems: "end" }}>
        <div className="form-group">
          <label className="form-label">Columna CSV</label>
          <select className="form-control" value={newCol} onChange={(e) => { setNewCol(e.target.value); setNewOp(""); setNewVal(""); setNewVal2(""); }}>
            <option value="">Seleccionar…</option>
            {rawColumns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Operador</label>
          <select className="form-control" value={newOp} onChange={(e) => setNewOp(e.target.value)} disabled={!newCol}>
            <option value="">—</option>
            {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{newOp === "entre" ? "Valor mínimo" : "Valor"}</label>
          <input className="form-control" value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="valor…" disabled={!newOp} onKeyDown={(e) => e.key === "Enter" && addFilter()} />
        </div>
        <div style={{ paddingBottom: 1 }}>
          <button className="btn btn-secondary" onClick={addFilter} disabled={!newCol || !newOp} style={{ height: 34 }}>+ Añadir</button>
        </div>
      </div>

      {newOp === "entre" && (
        <div className="form-group" style={{ marginTop: 8 }}>
          <label className="form-label">Valor máximo</label>
          <input className="form-control" value={newVal2} onChange={(e) => setNewVal2(e.target.value)} placeholder="valor máximo…" />
        </div>
      )}

      {/* Preset toolbar */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Presets</span>

        {presetNames.length > 0 && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <select className="form-control" style={{ fontSize: 12, padding: "4px 8px", height: 30 }} value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}>
              <option value="">Cargar preset…</option>
              {presetNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" disabled={!selectedPreset} onClick={() => handleLoadPreset(selectedPreset)}>Cargar</button>
            <button className="btn btn-sm" disabled={!selectedPreset} onClick={() => handleDeletePreset(selectedPreset)} style={{ background: "var(--error-dim)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.25)", opacity: selectedPreset ? 1 : 0.4 }}>Borrar</button>
          </div>
        )}

        {!showSaveInput ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSaveInput(true)} disabled={filters.length === 0} title={filters.length === 0 ? "Añade filtros primero" : "Guardar filtros actuales como preset"}>
            + Guardar filtros
          </button>
        ) : (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input className="form-control" style={{ fontSize: 12, padding: "4px 8px", height: 30, width: 160 }} placeholder="Nombre del preset…" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); if (e.key === "Escape") setShowSaveInput(false); }} autoFocus />
            <button className="btn btn-primary btn-sm" onClick={handleSavePreset} disabled={!saveName.trim()}>Guardar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowSaveInput(false); setSaveName(""); }}>×</button>
          </div>
        )}

        {presetNames.length === 0 && !showSaveInput && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Sin presets guardados</span>
        )}
      </div>
    </div>
  );
}
