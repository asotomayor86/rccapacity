import React, { useMemo, useState } from "react";
import useStore from "../state";
import { exportCalculos } from "../services/exporter";
import { autoImportCalculos } from "../services/csvParser";
import { useToast } from "../components/Toast";
import { MASTER_SCHEMAS_META } from "../masterSchemas";
import {
  MODELO_CUELLOS_DEFS,
  MODELO_CUELLOS_REQUIERE,
  MODELO_CUELLOS_RANGOS,
} from "../services/modeloCuellos";

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
  // Parámetros de rendimiento (Sprint B)
  "D_DIE", "COOLING_FACTOR", "CORONA_KW", "V_MAX_SOLDADOR", "V_MAX_ABREFACIL",
];

// MEZCLA es string clave; RESINA_DOMINANTE es string documental → excluidos del dropdown numérico
const MEZCLAS_FIELDS = ["K_HUSILLO", "DSO_EF", "RHO_FILM", "PCT_PCR"];

const OPS    = ["+", "-", "*", "/", "^"];
const OP_SYM = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^" };

const NOMBRES_PERMITIDOS = [
  "RS", "RENDIMIENTO",
  "Q_HUSILLO", "Q_DSO", "Q_LINEA", "Q_POST",
  "Q_POST_CORONA", "Q_POST_SOLDADOR", "Q_POST_ABREFACIL",
  "AUX_1", "AUX_2", "AUX_3",
];

// Mapas tipo por (fuente, campo)
const TYPE_BY_SOURCE = {
  PRODUCTO_COMPLEJO: Object.fromEntries((MASTER_SCHEMAS_META.PRODUCTO_COMPLEJO ?? []).map((f) => [f.name, f.type])),
  SETUP_EXTRUSORAS:  Object.fromEntries((MASTER_SCHEMAS_META.SETUP_EXTRUSORAS  ?? []).map((f) => [f.name, f.type])),
  MEZCLAS:           Object.fromEntries((MASTER_SCHEMAS_META.MEZCLAS           ?? []).map((f) => [f.name, f.type])),
};

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Determina si un nodo puede usarse como condición boolean (para validación
// visual del slot "condición" de si_aplica). Permisivo con referencia_calculo.
function esCondicionBoolean(nodo) {
  if (!nodo) return false;
  if (nodo.tipo === "booleana") return true;
  if (nodo.tipo === "campo") {
    const t = TYPE_BY_SOURCE[nodo.fuente]?.[nodo.campo];
    return t === "boolean";
  }
  if (nodo.tipo === "referencia_calculo") return true; // no podemos saber sin evaluar
  return false;
}

function formulaTexto(nodo) {
  if (!nodo) return "?";
  if (nodo.tipo === "constante") return String(nodo.valor ?? "?");
  if (nodo.tipo === "nulo")      return "null";
  if (nodo.tipo === "campo")     return nodo.campo ?? "?";
  if (nodo.tipo === "operacion") {
    const op = OP_SYM[nodo.operador] ?? nodo.operador;
    return `(${formulaTexto(nodo.hijos?.[0] ?? null)} ${op} ${formulaTexto(nodo.hijos?.[1] ?? null)})`;
  }
  if (nodo.tipo === "operacion_naria") {
    return `${nodo.operador}(${(nodo.hijos ?? []).map(formulaTexto).join(", ")})`;
  }
  if (nodo.tipo === "si_aplica") {
    return `si_aplica(${formulaTexto(nodo.condicion)}, ${formulaTexto(nodo.valor)})`;
  }
  if (nodo.tipo === "booleana") {
    const hijos = (nodo.hijos ?? []).map(formulaTexto);
    if (nodo.operador === "not") return `not(${hijos[0] ?? "?"})`;
    return `${nodo.operador}(${hijos.join(", ")})`;
  }
  if (nodo.tipo === "referencia_calculo") return `[${nodo.calculo_id ?? "?"}]`;
  return "?";
}

// ── SlotVacío ─────────────────────────────────────────────────────────────────

function SlotVacio({ inputs, definiciones, currentNombre, onReplace }) {
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

  if (mode === "referencia_calculo") {
    const disponibles = (definiciones ?? []).filter((d) => d.nombre && d.nombre !== currentNombre);
    return (
      <select
        className="form-control"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 200 }}
        defaultValue=""
        autoFocus
        onChange={(e) => {
          if (!e.target.value) return;
          onReplace({ tipo: "referencia_calculo", calculo_id: e.target.value });
          setMode(null);
        }}
        onBlur={() => setMode(null)}
      >
        <option value="">-- selecciona cálculo --</option>
        {disponibles.map((d) => (
          <option key={d.id} value={d.nombre}>{d.nombre}</option>
        ))}
      </select>
    );
  }

  return (
    <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: "5px 10px", display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", background: "var(--bg-surface-2)" }}>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#f59e0b" }} onClick={() => setMode("campo")} disabled={inputs.length === 0} title={inputs.length === 0 ? "Selecciona inputs primero" : "Insertar campo"}>Campo</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--text-muted)" }} onClick={() => setMode("constante")}>Constante</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#3b82f6" }} onClick={() => onReplace({ tipo: "operacion", operador: "*", hijos: [null, null] })} title="Insertar operación binaria">Op</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#3b82f6" }} onClick={() => onReplace({ tipo: "operacion_naria", operador: "min", hijos: [null, null] })} title="Insertar mínimo n-ario">Min</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#3b82f6" }} onClick={() => onReplace({ tipo: "operacion_naria", operador: "max", hijos: [null, null] })} title="Insertar máximo n-ario">Max</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--text-muted)" }} onClick={() => onReplace({ tipo: "nulo" })} title="Insertar valor nulo">Nulo</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#f97316" }} onClick={() => onReplace({ tipo: "si_aplica", condicion: null, valor: null })} title="Insertar si_aplica">Si aplica</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#a855f7" }} onClick={() => onReplace({ tipo: "booleana", operador: "and", hijos: [null, null] })} title="Insertar operación booleana">Booleano</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#60a5fa" }} onClick={() => setMode("referencia_calculo")} disabled={(definiciones ?? []).filter((d) => d.nombre !== currentNombre).length === 0} title="Insertar referencia a otro cálculo">Cálculo</button>
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
        title={`${nodo.fuente}.${nodo.campo} · clic para cambiar`}
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

// ── NodoNulo ──────────────────────────────────────────────────────────────────

function NodoNulo({ onReplace }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        title="Constante null"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)", userSelect: "none" }}
      >
        null
      </span>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "var(--error)" }} onClick={() => onReplace(null)} title="Eliminar">✕</button>
    </span>
  );
}

// ── NodoReferenciaCalculo ─────────────────────────────────────────────────────

function NodoReferenciaCalculo({ nodo, definiciones, currentNombre, onReplace }) {
  const [editing, setEditing] = useState(false);
  const disponibles = (definiciones ?? []).filter((d) => d.nombre && d.nombre !== currentNombre);

  if (editing) {
    return (
      <select
        className="form-control"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 200 }}
        defaultValue={nodo.calculo_id ?? ""}
        autoFocus
        onChange={(e) => {
          if (!e.target.value) { setEditing(false); return; }
          onReplace({ tipo: "referencia_calculo", calculo_id: e.target.value });
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
      >
        <option value="">-- selecciona cálculo --</option>
        {disponibles.map((d) => (
          <option key={d.id} value={d.nombre}>{d.nombre}</option>
        ))}
      </select>
    );
  }

  const existe = (definiciones ?? []).some((d) => d.nombre === nodo.calculo_id);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        onClick={() => setEditing(true)}
        title={existe ? `Referencia a cálculo "${nodo.calculo_id}"` : `Cálculo "${nodo.calculo_id}" no existe`}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 999,
          background: "rgba(96,165,250,0.12)", color: existe ? "#60a5fa" : "var(--error)",
          border: `1px solid ${existe ? "rgba(96,165,250,0.3)" : "var(--error)"}`,
          cursor: "pointer", userSelect: "none",
        }}
      >
        [{nodo.calculo_id ?? "?"}]
      </span>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "#3b82f6" }} onClick={() => onReplace({ tipo: "operacion", operador: "*", hijos: [nodo, null] })} title="Envolver en operación">( )</button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "var(--error)" }} onClick={() => onReplace(null)} title="Eliminar">✕</button>
    </span>
  );
}

// ── NodoOperacion (binaria) ───────────────────────────────────────────────────

function NodoOperacion({ nodo, inputs, definiciones, currentNombre, onReplace }) {
  function updateHijo(i, nuevo) {
    const hijos = [...(nodo.hijos ?? [null, null])];
    hijos[i] = nuevo;
    onReplace({ ...nodo, hijos });
  }

  return (
    <div style={{ display: "inline-block", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "var(--radius)", background: "rgba(59,130,246,0.05)", padding: "8px 10px" }}>
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

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>izq</div>
          <NodoBuilder nodo={nodo.hijos?.[0] ?? null} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={(n) => updateHijo(0, n)} />
        </div>
        <div style={{ fontSize: 18, color: "rgba(59,130,246,0.5)", paddingTop: 18, userSelect: "none" }}>{OP_SYM[nodo.operador]}</div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>der</div>
          <NodoBuilder nodo={nodo.hijos?.[1] ?? null} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={(n) => updateHijo(1, n)} />
        </div>
      </div>
    </div>
  );
}

// ── NodoOperacionNaria (min/max con ≥2 hijos) ─────────────────────────────────

function NodoOperacionNaria({ nodo, inputs, definiciones, currentNombre, onReplace }) {
  const hijos = nodo.hijos ?? [];

  function updateHijo(i, nuevo) {
    const next = [...hijos];
    next[i] = nuevo;
    onReplace({ ...nodo, hijos: next });
  }
  function addHijo()       { onReplace({ ...nodo, hijos: [...hijos, null] }); }
  function removeHijo(i)   {
    if (hijos.length <= 2) return; // mantener mínimo 2
    onReplace({ ...nodo, hijos: hijos.filter((_, idx) => idx !== i) });
  }

  return (
    <div style={{ display: "inline-block", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "var(--radius)", background: "rgba(59,130,246,0.05)", padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 10 }}>
        {["min", "max"].map((op) => (
          <button
            key={op}
            className="btn btn-ghost btn-sm"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "1px 10px", fontWeight: nodo.operador === op ? 700 : 400, color: nodo.operador === op ? "#3b82f6" : "var(--text-muted)", borderBottom: nodo.operador === op ? "2px solid #3b82f6" : "2px solid transparent" }}
            onClick={() => onReplace({ ...nodo, operador: op })}
          >
            {op}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "var(--error)" }} onClick={() => onReplace(null)} title="Eliminar nodo y hijos">✕</button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        {hijos.map((hijo, i) => (
          <div key={i} style={{ position: "relative" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>arg {i + 1}</span>
              {hijos.length > 2 && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, padding: "0 4px", color: "var(--error)" }} onClick={() => removeHijo(i)} title="Eliminar este argumento">✕</button>
              )}
            </div>
            <NodoBuilder nodo={hijo} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={(n) => updateHijo(i, n)} />
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "4px 10px", color: "#3b82f6", alignSelf: "flex-start", marginTop: 18 }} onClick={addHijo} title="Añadir argumento">+ añadir hijo</button>
      </div>
    </div>
  );
}

// ── NodoSiAplica ──────────────────────────────────────────────────────────────

function NodoSiAplica({ nodo, inputs, definiciones, currentNombre, onReplace }) {
  const condicionInvalid = nodo.condicion !== null && nodo.condicion !== undefined && !esCondicionBoolean(nodo.condicion);

  return (
    <div style={{ display: "inline-block", border: "1px solid rgba(249,115,22,0.4)", borderRadius: "var(--radius)", background: "rgba(249,115,22,0.05)", padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#f97316" }}>si_aplica</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "var(--error)" }} onClick={() => onReplace(null)} title="Eliminar">✕</button>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ padding: condicionInvalid ? 4 : 0, border: condicionInvalid ? "1px dashed var(--error)" : "1px dashed transparent", borderRadius: 4 }}>
          <div style={{ fontSize: 9, color: condicionInvalid ? "var(--error)" : "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>condición</div>
          <NodoBuilder nodo={nodo.condicion ?? null} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={(n) => onReplace({ ...nodo, condicion: n })} />
          {condicionInvalid && (
            <div style={{ fontSize: 9, color: "var(--error)", marginTop: 3, fontFamily: "var(--font-mono)" }}>
              ⚠ debe ser boolean
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>valor</div>
          <NodoBuilder nodo={nodo.valor ?? null} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={(n) => onReplace({ ...nodo, valor: n })} />
        </div>
      </div>
    </div>
  );
}

// ── NodoBooleana ──────────────────────────────────────────────────────────────

function NodoBooleana({ nodo, inputs, definiciones, currentNombre, onReplace }) {
  const operador = nodo.operador ?? "and";
  const isNot    = operador === "not";
  const hijos    = nodo.hijos ?? (isNot ? [null] : [null, null]);

  function setOperador(op) {
    let nuevosHijos = hijos;
    if (op === "not" && hijos.length > 1) nuevosHijos = [hijos[0]];
    if (op !== "not" && hijos.length < 2) nuevosHijos = [hijos[0] ?? null, null];
    onReplace({ ...nodo, operador: op, hijos: nuevosHijos });
  }
  function updateHijo(i, nuevo) {
    const next = [...hijos];
    next[i] = nuevo;
    onReplace({ ...nodo, hijos: next });
  }
  function addHijo()     { if (!isNot) onReplace({ ...nodo, hijos: [...hijos, null] }); }
  function removeHijo(i) {
    if (isNot || hijos.length <= 2) return;
    onReplace({ ...nodo, hijos: hijos.filter((_, idx) => idx !== i) });
  }

  return (
    <div style={{ display: "inline-block", border: "1px solid rgba(168,85,247,0.4)", borderRadius: "var(--radius)", background: "rgba(168,85,247,0.05)", padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
        {["and", "or", "not"].map((op) => (
          <button
            key={op}
            className="btn btn-ghost btn-sm"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "1px 10px", fontWeight: operador === op ? 700 : 400, color: operador === op ? "#a855f7" : "var(--text-muted)", borderBottom: operador === op ? "2px solid #a855f7" : "2px solid transparent" }}
            onClick={() => setOperador(op)}
          >
            {op}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "1px 5px", color: "var(--error)" }} onClick={() => onReplace(null)} title="Eliminar">✕</button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        {hijos.map((hijo, i) => (
          <div key={i}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
              <span>{isNot ? "operando" : `arg ${i + 1}`}</span>
              {!isNot && hijos.length > 2 && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, padding: "0 4px", color: "var(--error)" }} onClick={() => removeHijo(i)} title="Eliminar este argumento">✕</button>
              )}
            </div>
            <NodoBuilder nodo={hijo} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={(n) => updateHijo(i, n)} />
          </div>
        ))}
        {!isNot && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "4px 10px", color: "#a855f7", alignSelf: "flex-start", marginTop: 18 }} onClick={addHijo} title="Añadir argumento">+ añadir hijo</button>
        )}
      </div>
    </div>
  );
}

// ── NodoBuilder (dispatch) ────────────────────────────────────────────────────

function NodoBuilder({ nodo, inputs, definiciones, currentNombre, onReplace }) {
  if (!nodo) return <SlotVacio inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={onReplace} />;
  if (nodo.tipo === "constante")           return <NodoConstante nodo={nodo} onReplace={onReplace} />;
  if (nodo.tipo === "campo")               return <NodoCampo    nodo={nodo} inputs={inputs} onReplace={onReplace} />;
  if (nodo.tipo === "operacion")           return <NodoOperacion       nodo={nodo} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={onReplace} />;
  if (nodo.tipo === "operacion_naria")     return <NodoOperacionNaria  nodo={nodo} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={onReplace} />;
  if (nodo.tipo === "nulo")                return <NodoNulo            onReplace={onReplace} />;
  if (nodo.tipo === "si_aplica")           return <NodoSiAplica        nodo={nodo} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={onReplace} />;
  if (nodo.tipo === "booleana")            return <NodoBooleana        nodo={nodo} inputs={inputs} definiciones={definiciones} currentNombre={currentNombre} onReplace={onReplace} />;
  if (nodo.tipo === "referencia_calculo")  return <NodoReferenciaCalculo nodo={nodo} definiciones={definiciones} currentNombre={currentNombre} onReplace={onReplace} />;
  return null;
}

// ── InputSelector (3 columnas: PC, SE, MEZCLAS) ───────────────────────────────

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
      <div style={colStyle}>
        <div style={sectionLabel}>MEZCLAS</div>
        {MEZCLAS_FIELDS.map((campo) => {
          const sel = checked("MEZCLAS", campo);
          return (
            <label key={campo} style={labelStyle(sel)}>
              <input type="checkbox" checked={sel} onChange={() => toggle("MEZCLAS", campo)} style={{ accentColor: "#f59e0b" }} />
              {campo}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── ConstructorPanel ──────────────────────────────────────────────────────────

function ConstructorPanel({ defInicial, isNew, definiciones, onSave, onDelete }) {
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

  // Construir lista de nombres permitidos (enum + nombre actual si no está en la lista)
  const nombresEnSelect = NOMBRES_PERMITIDOS.includes(nombre)
    ? NOMBRES_PERMITIDOS
    : [...NOMBRES_PERMITIDOS, nombre];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="card-header"><span className="card-title">Definición</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px", gap: 10, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase" }}>Nombre *</div>
            <select className="form-control" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} value={nombre} onChange={(e) => setNombre(e.target.value)}>
              {nombresEnSelect.map((n) => <option key={n} value={n}>{n}</option>)}
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

      <div className="card">
        <div className="card-header">
          <span className="card-title">Inputs de la fórmula</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {inputs.length} seleccionado{inputs.length !== 1 ? "s" : ""}
          </span>
        </div>
        <InputSelector inputs={inputs} onChange={setInputs} />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Árbol de la fórmula</span></div>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <NodoBuilder
            nodo={arbol}
            inputs={inputs}
            definiciones={definiciones}
            currentNombre={nombre}
            onReplace={setArbol}
          />
        </div>
        {arbol && (
          <div style={{ marginTop: 10, padding: "7px 10px", background: "var(--bg-surface-2)", borderRadius: "var(--radius)", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginRight: 8, textTransform: "uppercase" }}>Fórmula:</span>
            <code style={{ fontSize: 12, color: "var(--accent)" }}>{formulaTexto(arbol)}</code>
          </div>
        )}
      </div>

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

// ── Modal de confirmación "Cargar modelo por defecto" ─────────────────────────

function ConfirmModeloModal({ existentesPorReemplazar, onCancel, onConfirm }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onCancel}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", width: "min(92vw, 540px)", padding: "20px 24px", boxShadow: "var(--shadow)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginBottom: 10 }}>
          CARGAR MODELO POR DEFECTO
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Esto añadirá <strong>{MODELO_CUELLOS_DEFS.length} definiciones</strong> de cálculo: Q_HUSILLO, Q_DSO, Q_LINEA, Q_POST_CORONA, Q_POST_SOLDADOR, Q_POST_ABREFACIL, Q_POST y RENDIMIENTO.
          {existentesPorReemplazar.length > 0 && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius)" }}>
              <div style={{ fontSize: 12, color: "var(--warning)", fontWeight: 600, marginBottom: 4 }}>⚠ Se reemplazarán {existentesPorReemplazar.length} cálculo(s) existente(s):</div>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                {existentesPorReemplazar.join(", ")}
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
            Recuerda que el modelo requiere los maestros <strong>MEZCLAS</strong> cargado y los campos de <strong>SETUP_EXTRUSORAS</strong> (D_DIE, COOLING_FACTOR, etc.) rellenos.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={onConfirm}>Continuar</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal informativo del modelo de cuellos ───────────────────────────────────

function ModeloInfoModal({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", width: "min(92vw, 720px)", maxHeight: "90vh", overflowY: "auto", padding: "22px 26px", boxShadow: "var(--shadow)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
            MODELO DE RENDIMIENTO POR CUELLOS DE BOTELLA
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 16 }}>✕</button>
        </div>

        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)", marginBottom: 14 }}>
          El modelo calcula <code style={{ color: "var(--accent)" }}>RENDIMIENTO [kg/h]</code> como el mínimo de cuatro
          cuellos físicos de la línea:
        </p>
        <div style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)", marginBottom: 16 }}>
          RENDIMIENTO = min(Q_HUSILLO, Q_DSO, Q_LINEA, Q_POST)
        </div>

        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
          Variables requeridas
        </div>
        <div style={{ marginBottom: 14 }}>
          {Object.entries(MODELO_CUELLOS_REQUIERE).map(([maestro, campos]) => (
            <div key={maestro} style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 700 }}>{maestro}:</span>{" "}
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{campos.join(", ")}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius)", marginBottom: 14, fontSize: 12, color: "var(--text-secondary)" }}>
          ⚠ Estos campos deben estar cargados en sus maestros (MEZCLAS, SETUP EXTRUSORAS) antes de ejecutar el cálculo.
          Si falta alguno, el valor de RENDIMIENTO se calculará con los cuellos que sí tengan datos.
        </div>

        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
          Rangos típicos
        </div>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Variable</th>
              <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Mín</th>
              <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Máx</th>
              <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Unidad</th>
            </tr>
          </thead>
          <tbody>
            {MODELO_CUELLOS_RANGOS.map((r) => (
              <tr key={r.variable}>
                <td style={{ padding: "4px 8px", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{r.variable}</td>
                <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{r.min}</td>
                <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{r.max}</td>
                <td style={{ padding: "4px 8px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{r.unidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

  const [selectedId,     setSelectedId]     = useState(null);
  const [isNew,          setIsNew]          = useState(false);
  const [confirmModelo,  setConfirmModelo]  = useState(false);
  const [showInfoModal,  setShowInfoModal]  = useState(false);

  const selectedDef = definiciones.find((d) => d.id === selectedId) ?? null;
  const showConstructor = isNew || selectedDef !== null;

  const nombresExistentes = useMemo(
    () => new Set(definiciones.map((d) => d.nombre).filter(Boolean)),
    [definiciones]
  );
  const existentesPorReemplazar = useMemo(
    () => MODELO_CUELLOS_DEFS.map((d) => d.nombre).filter((n) => nombresExistentes.has(n)),
    [nombresExistentes]
  );

  function handleNuevo()      { setSelectedId(null); setIsNew(true); }
  function handleSelect(id)   { setSelectedId(id); setIsNew(false); }

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
      // Upsert por NOMBRE: si ya existe, lo reemplazamos preservando el id existente
      const definicionesActuales = useStore.getState().calculos.DEFINICIONES;
      const porNombre = new Map(definicionesActuales.map((d) => [d.nombre, d]));
      let reemplazados = 0, nuevos = 0;
      for (const d of res.definiciones) {
        if (!d.nombre) continue;
        const existing = porNombre.get(d.nombre);
        if (existing) {
          updateCalculo(existing.id, { ...d, id: existing.id });
          reemplazados++;
        } else {
          addCalculo({ ...d, id: d.id || newId() });
          nuevos++;
        }
      }
      toast.success(`Importados: ${nuevos} nuevo(s), ${reemplazados} reemplazado(s).`);
    };
    input.click();
  }

  function handleCargarModelo() {
    setConfirmModelo(true);
  }

  function confirmCargarModelo() {
    const definicionesActuales = useStore.getState().calculos.DEFINICIONES;
    const porNombre = new Map(definicionesActuales.map((d) => [d.nombre, d]));
    let reemplazados = 0, nuevos = 0;
    for (const d of MODELO_CUELLOS_DEFS) {
      const existing = porNombre.get(d.nombre);
      if (existing) {
        updateCalculo(existing.id, { ...d, id: existing.id });
        reemplazados++;
      } else {
        addCalculo({ ...d });
        nuevos++;
      }
    }
    setConfirmModelo(false);
    toast.success(`Modelo cargado: ${nuevos} nuevo(s), ${reemplazados} reemplazado(s).`);
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h1 className="page-title">CÁLCULOS</h1>
            <p className="page-subtitle">Constructor visual de fórmulas de cálculo.</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-secondary btn-sm" onClick={handleCargarModelo} title="Cargar definiciones del modelo de cuellos de botella">
              Cargar modelo por defecto
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowInfoModal(true)}
              title="Información sobre el modelo de cuellos"
              style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border)", padding: 0, fontSize: 13, fontFamily: "var(--font-mono)" }}
            >
              i
            </button>
          </div>
        </div>
      </div>

      <div className="page-body" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
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
              definiciones={definiciones}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {confirmModelo && (
        <ConfirmModeloModal
          existentesPorReemplazar={existentesPorReemplazar}
          onCancel={() => setConfirmModelo(false)}
          onConfirm={confirmCargarModelo}
        />
      )}
      {showInfoModal && <ModeloInfoModal onClose={() => setShowInfoModal(false)} />}
    </>
  );
}
