import React, { useState } from "react";
import useStore from "../state";
import { exportCalculos } from "../services/exporter";
import { autoImportCalculos } from "../services/csvParser";
import { useToast } from "../components/Toast";

// ── Constantes ────────────────────────────────────────────────────────────────

const PRODUCTO_COMPLEJO_FIELDS = [
  "REFERENCIA", "TIPO", "REFERENCIA_COMPLEJA",
  "TIPO_PRODUCTO", "ABREFACIL", "TRATADA",
  "ANCHO_EXTRUSION", "GALGA",
  "SOLDADOR_LONGITUDINAL", "ABIERTA_LATERAL", "ABIERTA_CENTRO",
  "ABREFACIL_LATERAL", "ABREFACIL_CENTRAL", "TRATADA_PC",
];

const SETUP_FIELDS = [
  "NOMBRE_EXTRUSORA", "CAPAS", "HILERA", "HUSILLOS", "VMAX_KG_H", "VMAX_M_MIN", "RPM_MAX",
  "SOPLADO_HD", "SOPLADO_LD", "ANCHO_MAXIMO", "CORTE_LATERAL", "CORTE_CENTRAL",
  "ABREFACIL_LATERAL", "ABREFACIL_CENTRAL", "SOLDADOR_LONGITUDINAL", "MADERAS_PLEGADO",
  "VENTANA_MIN_PLEGADO", "FUELLE_MAXIMO", "TRATADOR_CORONA", "CORTE_LAMINA",
];

const OPS     = ["+", "-", "*", "/", "^"];
const OP_SYM  = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^" };

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Formula text (infix) ──────────────────────────────────────────────────────

function formulaTexto(nodo) {
  if (!nodo) return "?";
  if (nodo.tipo === "constante") return String(nodo.valor ?? "?");
  if (nodo.tipo === "campo")     return nodo.campo ?? "?";
  if (nodo.tipo === "operacion") {
    const op = OP_SYM[nodo.operador] ?? nodo.operador;
    return `(${formulaTexto(nodo.hijos?.[0] ?? null)} ${op} ${formulaTexto(nodo.hijos?.[1] ?? null)})`;
  }
  return "?";
}

// ── SlotVacío ─────────────────────────────────────────────────────────────────

function SlotVacio({ inputs, onReplace }) {
  const [mode,   setMode]   = useState(null);
  const [cteVal, setCteVal] = useState("");

  if (mode === "campo") {
    return (
      <select
        className="form-control"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 200 }}
        defaultValue=""
        autoFocus
        onChange={(e) => {
          if (!e.target.value) return;
          const [fuente, campo] = e.target.value.split("|");
          onReplace({ tipo: "campo", fuente, campo });
          setMode(null);
        }}
        onBlur={() => setMode(null)}
      >
        <option value="">-- selecciona campo --</option>
        {inputs.map((inp) => (
          <option key={`${inp.fuente}|${inp.campo}`} value={`${inp.fuente}|${inp.campo}`}>
            {inp.fuente}.{inp.campo}
          </option>
        ))}
      </select>
    );
  }

  if (mode === "constante") {
    return (
      <input
        type="number"
        className="form-control"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, width: 110 }}
        placeholder="0"
        value={cteVal}
        autoFocus
        onChange={(e) => setCteVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const n = parseFloat(cteVal);
            if (!isNaN(n)) onReplace({ tipo: "constante", valor: n });
            setMode(null); setCteVal("");
          }
          if (e.key === "Escape") { setMode(null); setCteVal(""); }
        }}
        onBlur={() => {
          const n = parseFloat(cteVal);
          if (!isNaN(n)) onReplace({ tipo: "constante", valor: n });
          setMode(null); setCteVal("");
        }}
      />
    );
  }

  return (
    <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: "5px 10px", display: "inline-flex", gap: 6, alignItems: "center", background: "var(--bg-surface-2)" }}>
      <button
        className="btn btn-ghost btn-sm"
        style={{ fontSize: 11, color: "#f59e0b" }}
        onClick={() => setMode("campo")}
        disabled={inputs.length === 0}
        title={inputs.length === 0 ? "Selecciona inputs primero" : "Insertar campo"}
      >
        Campo
      </button>
      <button
        className="btn btn-ghost btn-sm"
        style={{ fontSize: 11, color: "var(--text-muted)" }}
        onClick={() => setMode("constante")}
      >
        Constante
      </button>
    </div>
  );
}

// ── NodoCampo ─────────────────────────────────────────────────────────────────

function NodoCampo({ nodo, inputs, onReplace }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <select
        className="form-control"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 200 }}
        defaultValue={`${nodo.fuente}|${nodo.campo}`}
        autoFocus
        onChange={(e) => {
          if (!e.target.value) { setEditing(false); return; }
          const [fuente, campo] = e.target.value.split("|");
          onReplace({ tipo: "campo", fuente, campo });
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
      >
        <option value="">-- selecciona campo --</option>
        {inputs.map((inp) => (
          <option key={`${inp.fuente}|${inp.campo}`} value={`${inp.fuente}|${inp.campo}`}>
            {inp.fuente}.{inp.campo}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        onClick={() => setEditing(true)}
        title="Clic para cambiar"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", cursor: "pointer", userSelect: "none" }}
      >
        {nodo.campo}
      </span>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "#3b82f6" }} onClick={() => onReplace({ tipo: "operacion", operador: "*", hijos: [nodo, null] })} title="Envolver en operación">( )</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "var(--error)" }} onClick={() => onReplace(null)} title="Eliminar">✕</button>
    </span>
  );
}

// ── NodoConstante ─────────────────────────────────────────────────────────────

function NodoConstante({ nodo, onReplace }) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(String(nodo.valor ?? ""));

  if (editing) {
    return (
      <input
        type="number"
        className="form-control"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, width: 100 }}
        value={val}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { const n = parseFloat(val); if (!isNaN(n)) onReplace({ ...nodo, valor: n }); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={() => { const n = parseFloat(val); if (!isNaN(n)) onReplace({ ...nodo, valor: n }); setEditing(false); }}
      />
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        onClick={() => { setVal(String(nodo.valor ?? "")); setEditing(true); }}
        title="Clic para editar"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "var(--bg-surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)", cursor: "pointer", userSelect: "none" }}
      >
        {nodo.valor}
      </span>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "#3b82f6" }} onClick={() => onReplace({ tipo: "operacion", operador: "*", hijos: [nodo, null] })} title="Envolver en operación">( )</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "var(--error)" }} onClick={() => onReplace(null)} title="Eliminar">✕</button>
    </span>
  );
}

// ── NodoOperacion ─────────────────────────────────────────────────────────────

function NodoOperacion({ nodo, inputs, onReplace }) {
  function updateHijo(i, nuevo) {
    const hijos = [...(nodo.hijos ?? [null, null])];
    hijos[i] = nuevo;
    onReplace({ ...nodo, hijos });
  }

  return (
    <div style={{ display: "inline-block", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "var(--radius)", background: "rgba(59,130,246,0.05)", padding: "8px 10px" }}>
      {/* Operator selector row */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 10 }}>
        {OPS.map((op) => (
          <button
            key={op}
            className="btn btn-ghost btn-sm"
            style={{ fontFamily: "var(--font-mono)", fontSize: 14, padding: "1px 8px", fontWeight: nodo.operador === op ? 700 : 400, color: nodo.operador === op ? "#3b82f6" : "var(--text-muted)", borderBottom: nodo.operador === op ? "2px solid #3b82f6" : "2px solid transparent" }}
            onClick={() => onReplace({ ...nodo, operador: op })}
          >
            {OP_SYM[op]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "var(--error)" }} onClick={() => onReplace(null)} title="Eliminar nodo y hijos">✕</button>
      </div>

      {/* Children */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>izq</div>
          <NodoBuilder nodo={nodo.hijos?.[0] ?? null} inputs={inputs} onReplace={(n) => updateHijo(0, n)} />
        </div>
        <div style={{ fontSize: 18, color: "rgba(59,130,246,0.5)", paddingTop: 18, userSelect: "none" }}>{OP_SYM[nodo.operador]}</div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>der</div>
          <NodoBuilder nodo={nodo.hijos?.[1] ?? null} inputs={inputs} onReplace={(n) => updateHijo(1, n)} />
        </div>
      </div>
    </div>
  );
}

// ── NodoBuilder (dispatch) ────────────────────────────────────────────────────

function NodoBuilder({ nodo, inputs, onReplace }) {
  if (!nodo)                   return <SlotVacio inputs={inputs} onReplace={onReplace} />;
  if (nodo.tipo === "constante") return <NodoConstante nodo={nodo} onReplace={onReplace} />;
  if (nodo.tipo === "campo")     return <NodoCampo nodo={nodo} inputs={inputs} onReplace={onReplace} />;
  if (nodo.tipo === "operacion") return <NodoOperacion nodo={nodo} inputs={inputs} onReplace={onReplace} />;
  return null;
}

// ── InputSelector ─────────────────────────────────────────────────────────────

function InputSelector({ inputs, onChange }) {
  function toggle(fuente, campo) {
    const exists = inputs.some((i) => i.fuente === fuente && i.campo === campo);
    onChange(exists
      ? inputs.filter((i) => !(i.fuente === fuente && i.campo === campo))
      : [...inputs, { fuente, campo }]
    );
  }
  function checked(fuente, campo) {
    return inputs.some((i) => i.fuente === fuente && i.campo === campo);
  }

  const colStyle = { flex: 1, minWidth: 0 };
  const labelStyle = (selected) => ({
    display: "flex", alignItems: "center", gap: 6, fontSize: 11,
    fontFamily: "var(--font-mono)", color: selected ? "#f59e0b" : "var(--text-muted)",
    marginBottom: 3, cursor: "pointer",
  });
  const sectionLabel = { fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 };

  return (
    <div style={{ display: "flex", gap: 20 }}>
      <div style={colStyle}>
        <div style={sectionLabel}>PRODUCTO COMPLEJO</div>
        {PRODUCTO_COMPLEJO_FIELDS.map((campo) => {
          const sel = checked("PRODUCTO_COMPLEJO", campo);
          return (
            <label key={campo} style={labelStyle(sel)}>
              <input type="checkbox" checked={sel} onChange={() => toggle("PRODUCTO_COMPLEJO", campo)} style={{ accentColor: "#f59e0b" }} />
              {campo}
            </label>
          );
        })}
      </div>
      <div style={colStyle}>
        <div style={sectionLabel}>SETUP EXTRUSORAS</div>
        {SETUP_FIELDS.map((campo) => {
          const sel = checked("SETUP_EXTRUSORAS", campo);
          return (
            <label key={campo} style={labelStyle(sel)}>
              <input type="checkbox" checked={sel} onChange={() => toggle("SETUP_EXTRUSORAS", campo)} style={{ accentColor: "#f59e0b" }} />
              {campo}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── ConstructorPanel ──────────────────────────────────────────────────────────

function ConstructorPanel({ defInicial, isNew, onSave, onDelete }) {
  const [nombre,      setNombre]      = useState(defInicial?.nombre      ?? "RS");
  const [descripcion, setDescripcion] = useState(defInicial?.descripcion ?? "");
  const [unidad,      setUnidad]      = useState(defInicial?.unidad      ?? "");
  const [inputs,      setInputs]      = useState(defInicial?.inputs      ?? []);
  const [arbol,       setArbol]       = useState(defInicial?.arbol       ?? null);

  function handleSave() {
    if (!nombre.trim()) return;
    onSave({
      id:          defInicial?.id ?? newId(),
      nombre:      nombre,
      descripcion: descripcion.trim(),
      unidad:      unidad.trim(),
      inputs,
      arbol,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Definición */}
      <div className="card">
        <div className="card-header"><span className="card-title">Definición</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 80px", gap: 10, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase" }}>Nombre *</div>
            <select className="form-control" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} value={nombre} onChange={(e) => setNombre(e.target.value)}>
              <option value="RS">RS</option>
              <option value="RENDIMIENTO">RENDIMIENTO</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase" }}>Descripción</div>
            <input className="form-control" style={{ fontSize: 12, width: "100%" }} placeholder="Relación de Soplado…" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase" }}>Unidad</div>
            <input className="form-control" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} placeholder="—" value={unidad} onChange={(e) => setUnidad(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Inputs de la fórmula</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {inputs.length} seleccionado{inputs.length !== 1 ? "s" : ""}
          </span>
        </div>
        <InputSelector inputs={inputs} onChange={setInputs} />
      </div>

      {/* Árbol */}
      <div className="card">
        <div className="card-header"><span className="card-title">Árbol de la fórmula</span></div>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <NodoBuilder nodo={arbol} inputs={inputs} onReplace={setArbol} />
        </div>
        {arbol && (
          <div style={{ marginTop: 10, padding: "7px 10px", background: "var(--bg-surface-2)", borderRadius: "var(--radius)", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginRight: 8, textTransform: "uppercase" }}>Fórmula:</span>
            <code style={{ fontSize: 12, color: "var(--accent)" }}>{formulaTexto(arbol)}</code>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={!nombre.trim()}>
          {isNew ? "Guardar cálculo" : "Actualizar cálculo"}
        </button>
        {!isNew && (
          <button className="btn btn-secondary" style={{ color: "var(--error)" }} onClick={onDelete}>
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalculosPage() {
  const toast         = useToast();
  const definiciones  = useStore((s) => s.calculos.DEFINICIONES);
  const addCalculo    = useStore((s) => s.addCalculo);
  const updateCalculo = useStore((s) => s.updateCalculo);
  const deleteCalculo = useStore((s) => s.deleteCalculo);

  const [selectedId, setSelectedId] = useState(null);
  const [isNew,      setIsNew]      = useState(false);

  const selectedDef = definiciones.find((d) => d.id === selectedId) ?? null;
  const showConstructor = isNew || selectedDef !== null;

  function handleNuevo() { setSelectedId(null); setIsNew(true); }
  function handleSelect(id) { setSelectedId(id); setIsNew(false); }

  function handleSave(def) {
    if (isNew) {
      addCalculo(def);
      setIsNew(false);
      setSelectedId(def.id);
    } else {
      updateCalculo(def.id, def);
    }
    toast.success(`Cálculo "${def.nombre}" guardado.`);
  }

  function handleDelete() {
    if (!selectedDef) return;
    deleteCalculo(selectedDef.id);
    setSelectedId(null);
    setIsNew(false);
    toast.success("Cálculo eliminado.");
  }

  function handleExportar() {
    if (definiciones.length === 0) { toast.warning("No hay cálculos para exportar."); return; }
    exportCalculos(definiciones);
  }

  function handleImportar() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const res = await autoImportCalculos(file);
      if (!res.success) { toast.error(`No se pudo importar: ${res.reason}`); return; }
      res.definiciones.forEach((d) => addCalculo({ ...d, id: newId() }));
      toast.success(`${res.definiciones.length} cálculo${res.definiciones.length !== 1 ? "s" : ""} importado${res.definiciones.length !== 1 ? "s" : ""}.`);
    };
    input.click();
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">CÁLCULOS</h1>
        <p className="page-subtitle">Constructor visual de fórmulas de cálculo.</p>
      </div>

      <div className="page-body" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* ── Panel izquierdo ── */}
        <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleNuevo} style={{ width: "100%" }}>
            + Nuevo cálculo
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={handleExportar} title="Exportar cálculos CSV">⬇ Exportar</button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={handleImportar} title="Importar cálculos CSV">⬆ Importar</button>
          </div>

          {definiciones.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
              Sin cálculos definidos
            </div>
          )}

          {definiciones.map((def) => {
            const sel = selectedId === def.id;
            return (
              <div
                key={def.id}
                onClick={() => handleSelect(def.id)}
                style={{ padding: "10px 12px", borderRadius: "var(--radius)", border: `1px solid ${sel ? "rgba(245,158,11,0.4)" : "var(--border)"}`, background: sel ? "rgba(245,158,11,0.06)" : "var(--bg-surface)", cursor: "pointer" }}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: sel ? "#f59e0b" : "var(--text-primary)" }}>
                  {def.nombre}
                </div>
                {def.descripcion && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{def.descripcion}</div>
                )}
                {def.unidad && (
                  <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>[{def.unidad}]</div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Panel derecho ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!showConstructor ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "60px 0", fontSize: 13 }}>
              Selecciona un cálculo de la lista o crea uno nuevo
            </div>
          ) : (
            <ConstructorPanel
              key={selectedId ?? "new"}
              defInicial={isNew ? null : selectedDef}
              isNew={isNew}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
    </>
  );
}
