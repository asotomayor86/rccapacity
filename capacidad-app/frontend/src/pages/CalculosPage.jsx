import React, { useMemo, useState } from "react";
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
  "CTE_DADO",
];

const OPS    = ["+", "-", "*", "/", "^"];
const OP_SYM = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^" };

// Precedencia y asociatividad para el compilador de tokens y el render de texto.
const PREC = { "+": 2, "-": 2, "*": 3, "/": 3, "^": 4 };
const RIGHT_ASSOC = { "^": true };

// RS y RENDIMIENTO son los dos cálculos "maestro" (nombre fijo) que viajan a las
// tablas intermedias. Cualquier otro cálculo es intermedio y lleva nombre libre.
const RESERVADOS = ["RS", "RENDIMIENTO"];

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Texto de la fórmula (precedencia-aware, paréntesis mínimos) ────────────────

function formulaTexto(nodo, parentOp = null, side = "root") {
  if (!nodo) return "?";
  if (nodo.tipo === "constante") return String(nodo.valor ?? "?");
  if (nodo.tipo === "nulo")      return "null";
  if (nodo.tipo === "campo")     return nodo.campo ?? "?";
  if (nodo.tipo === "operacion") {
    const sym = OP_SYM[nodo.operador] ?? nodo.operador;
    const izq = formulaTexto(nodo.hijos?.[0] ?? null, nodo.operador, "left");
    const der = formulaTexto(nodo.hijos?.[1] ?? null, nodo.operador, "right");
    const s = `${izq} ${sym} ${der}`;
    const p  = PREC[nodo.operador] ?? 0;
    const pp = parentOp ? (PREC[parentOp] ?? 0) : 0;
    let paren = false;
    if (parentOp) {
      if (p < pp) paren = true;
      else if (p === pp) {
        if (side === "right" && !RIGHT_ASSOC[parentOp]) paren = true;
        if (side === "left"  &&  RIGHT_ASSOC[parentOp]) paren = true;
      }
    }
    return paren ? `(${s})` : s;
  }
  if (nodo.tipo === "operacion_naria") {
    return `${nodo.operador}(${(nodo.hijos ?? []).map((h) => formulaTexto(h)).join(", ")})`;
  }
  if (nodo.tipo === "si_aplica") {
    return `si_aplica(${formulaTexto(nodo.condicion)}, ${formulaTexto(nodo.valor)})`;
  }
  if (nodo.tipo === "booleana") {
    const hijos = (nodo.hijos ?? []).map((h) => formulaTexto(h));
    if (nodo.operador === "not") return `not(${hijos[0] ?? "?"})`;
    return `${nodo.operador}(${hijos.join(", ")})`;
  }
  if (nodo.tipo === "referencia_calculo") return `[${nodo.calculo_id ?? "?"}]`;
  return "?";
}

// Texto de la secuencia de fichas tal cual la construye el usuario: conserva
// TODOS los paréntesis colocados (a diferencia de formulaTexto, que aplica
// paréntesis mínimos sobre la AST ya compilada).
function tokensTexto(tokens) {
  let s = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let pieza = "?";
    if      (t.k === "(")     pieza = "(";
    else if (t.k === ")")     pieza = ")";
    else if (t.k === ",")     pieza = ",";
    else if (t.k === "func")  pieza = `${t.name}(`;
    else if (t.k === "op")    pieza = OP_SYM[t.op] ?? t.op;
    else if (t.k === "campo") pieza = t.campo;
    else if (t.k === "const") pieza = String(t.valor);
    else if (t.k === "ref")   pieza = `[${t.calculo_id}]`;
    if (i === 0) { s = pieza; continue; }
    const prev = tokens[i - 1];
    const pegar = t.k === ")" || t.k === "," || prev.k === "(" || prev.k === "func";
    s += pegar ? pieza : ` ${pieza}`;
  }
  return s;
}

// ── Compilación tokens → AST y linearización AST → tokens ─────────────────────

function tokenANodo(t) {
  if (t.k === "campo") return { tipo: "campo", fuente: t.fuente, campo: t.campo };
  if (t.k === "const") return { tipo: "constante", valor: t.valor };
  if (t.k === "ref")   return { tipo: "referencia_calculo", calculo_id: t.calculo_id };
  return null;
}

// Compila una secuencia infija de tokens a la AST existente (parser de
// descenso recursivo con precedencia). Lanza Error con mensaje legible si la
// secuencia no es una expresión válida. Tipos de nodo producidos: `operacion`,
// `operacion_naria` (min/max), `campo`, `constante` y `referencia_calculo`.
//
// Gramática:
//   expr   := term (('+'|'-') term)*
//   term   := factor (('*'|'/') factor)*
//   factor := base ('^' factor)?              // ^ asociativo a la derecha
//   base   := operando | '(' expr ')' | FUNC expr (',' expr)* ')'
function compilarTokens(tokens) {
  let i = 0;
  const peek = () => tokens[i];

  function parseExpr() {
    let left = parseTerm();
    while (peek() && peek().k === "op" && (peek().op === "+" || peek().op === "-")) {
      const op = tokens[i++].op;
      left = { tipo: "operacion", operador: op, hijos: [left, parseTerm()] };
    }
    return left;
  }
  function parseTerm() {
    let left = parseFactor();
    while (peek() && peek().k === "op" && (peek().op === "*" || peek().op === "/")) {
      const op = tokens[i++].op;
      left = { tipo: "operacion", operador: op, hijos: [left, parseFactor()] };
    }
    return left;
  }
  function parseFactor() {
    const base = parseBase();
    if (peek() && peek().k === "op" && peek().op === "^") {
      i++;
      return { tipo: "operacion", operador: "^", hijos: [base, parseFactor()] };
    }
    return base;
  }
  function parseBase() {
    const t = peek();
    if (!t) throw new Error("La fórmula está incompleta (falta un operando).");
    if (t.k === "campo" || t.k === "const" || t.k === "ref") { i++; return tokenANodo(t); }
    if (t.k === "(") {
      i++;
      const e = parseExpr();
      if (!peek() || peek().k !== ")") throw new Error("Falta cerrar un paréntesis.");
      i++;
      return e;
    }
    if (t.k === "func") {
      i++;
      const args = [parseExpr()];
      while (peek() && peek().k === ",") { i++; args.push(parseExpr()); }
      if (!peek() || peek().k !== ")") throw new Error(`Falta cerrar ${t.name}( con ')'.`);
      i++;
      if (args.length < 2) throw new Error(`${t.name}() necesita al menos 2 argumentos.`);
      return { tipo: "operacion_naria", operador: t.name, hijos: args };
    }
    if (t.k === "op") throw new Error(`El operador ${OP_SYM[t.op] ?? t.op} necesita un operando a su izquierda.`);
    if (t.k === ")") throw new Error("Hay un ')' sin apertura o un grupo vacío.");
    if (t.k === ",") throw new Error("Hay una ',' fuera de una función MIN().");
    throw new Error("Ficha desconocida.");
  }

  if (tokens.length === 0) throw new Error("La fórmula está vacía.");
  const ast = parseExpr();
  if (i < tokens.length) {
    const t = tokens[i];
    if (t.k === ")") throw new Error("Hay un ')' sin '(' que lo abra.");
    if (t.k === ",") throw new Error("Hay una ',' fuera de una función MIN().");
    throw new Error("Sobran fichas tras una expresión completa (¿falta un operador?).");
  }
  return ast;
}

// Convierte una AST aritmética a tokens (para editar definiciones antiguas o
// importadas que solo tienen `arbol`). Devuelve { ok:false } si contiene nodos
// no representables en modo lineal (min/max, si_aplica, booleana, nulo).
function linearizar(nodo) {
  const out = [];
  const rec = (n, parentOp, side) => {
    if (!n) return false;
    if (n.tipo === "campo")              { out.push({ k: "campo", fuente: n.fuente, campo: n.campo }); return true; }
    if (n.tipo === "constante")          { out.push({ k: "const", valor: n.valor }); return true; }
    if (n.tipo === "referencia_calculo") { out.push({ k: "ref", calculo_id: n.calculo_id }); return true; }
    if (n.tipo === "operacion") {
      const p  = PREC[n.operador] ?? 0;
      const pp = parentOp ? (PREC[parentOp] ?? 0) : 0;
      let paren = false;
      if (parentOp) {
        if (p < pp) paren = true;
        else if (p === pp) {
          if (side === "right" && !RIGHT_ASSOC[parentOp]) paren = true;
          if (side === "left"  &&  RIGHT_ASSOC[parentOp]) paren = true;
        }
      }
      if (paren) out.push({ k: "(" });
      if (!rec(n.hijos?.[0] ?? null, n.operador, "left"))  return false;
      out.push({ k: "op", op: n.operador });
      if (!rec(n.hijos?.[1] ?? null, n.operador, "right")) return false;
      if (paren) out.push({ k: ")" });
      return true;
    }
    if (n.tipo === "operacion_naria" && (n.operador === "min" || n.operador === "max")) {
      const hijos = n.hijos ?? [];
      if (hijos.length < 2) return false;
      out.push({ k: "func", name: n.operador });
      for (let j = 0; j < hijos.length; j++) {
        if (j > 0) out.push({ k: "," });
        if (!rec(hijos[j] ?? null, null, "root")) return false; // cada arg es expresión independiente
      }
      out.push({ k: ")" });
      return true;
    }
    return false; // nulo, si_aplica, booleana
  };
  const ok = rec(nodo, null, "root");
  return ok ? { ok: true, tokens: out } : { ok: false, tokens: [] };
}

// Decide el estado inicial del constructor para una definición dada.
function deducirTokensIniciales(def) {
  if (!def) return { tokens: [], avanzado: false };
  if (Array.isArray(def.tokens)) return { tokens: def.tokens, avanzado: false };
  if (!def.arbol) return { tokens: [], avanzado: false };
  const lin = linearizar(def.arbol);
  if (lin.ok) return { tokens: lin.tokens, avanzado: false };
  return { tokens: [], avanzado: true };
}

// ── Chip (ficha individual) ───────────────────────────────────────────────────

function Chip({ t, onDelete }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 9px", borderRadius: 6, userSelect: "none" };
  let label = "?", style = {}, title = "";
  if (t.k === "(" || t.k === ")") {
    label = t.k;
    style = { background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontWeight: 700 };
    title = "Paréntesis";
  } else if (t.k === ",") {
    label = ",";
    style = { background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontWeight: 700 };
    title = "Separador de argumentos";
  } else if (t.k === "func") {
    label = `${t.name}(`;
    style = { background: "rgba(20,184,166,0.14)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)", fontWeight: 700 };
    title = t.name === "min" ? "Mínimo de los argumentos" : "Máximo de los argumentos";
  } else if (t.k === "op") {
    label = OP_SYM[t.op] ?? t.op;
    style = { background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)", fontWeight: 700 };
    title = "Operador";
  } else if (t.k === "campo") {
    label = t.campo;
    style = { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" };
    title = `${t.fuente}.${t.campo}`;
  } else if (t.k === "const") {
    label = String(t.valor);
    style = { background: "var(--bg-surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" };
    title = "Constante";
  } else if (t.k === "ref") {
    label = `[${t.calculo_id}]`;
    style = { background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" };
    title = `Referencia a ${t.calculo_id}`;
  }
  return (
    <span style={{ ...base, ...style }} title={title}>
      {label}
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: "0 3px", color: "inherit", opacity: 0.7 }} onClick={onDelete} title="Quitar ficha">×</button>
    </span>
  );
}

// ── ConstructorLineal (secuencia de fichas) ───────────────────────────────────

function ConstructorLineal({ tokens, setTokens, definiciones, currentNombre }) {
  const [adding, setAdding] = useState(null); // null | "campo" | "const" | "ref"
  const [cteVal, setCteVal] = useState("");

  const push  = (tok) => setTokens([...tokens, tok]);
  const delAt = (i)   => setTokens(tokens.filter((_, idx) => idx !== i));

  const refs = (definiciones ?? []).filter((d) => d.nombre && d.nombre !== currentNombre);
  const divider = <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />;

  function commitConst() {
    const n = parseFloat(cteVal);
    if (!isNaN(n)) push({ k: "const", valor: n });
    setAdding(null); setCteVal("");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }} onClick={() => push({ k: "(" })} title="Abrir paréntesis">(</button>
        <button className="btn btn-ghost btn-sm" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }} onClick={() => push({ k: ")" })} title="Cerrar paréntesis">)</button>
        <button className="btn btn-ghost btn-sm" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }} onClick={() => push({ k: "," })} title="Separador de argumentos (dentro de MIN)">,</button>
        {divider}
        {OPS.map((op) => (
          <button key={op} className="btn btn-ghost btn-sm" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "#3b82f6" }} onClick={() => push({ k: "op", op })} title={`Operador ${OP_SYM[op]}`}>{OP_SYM[op]}</button>
        ))}
        {divider}
        <button className="btn btn-ghost btn-sm" style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "#14b8a6" }} onClick={() => push({ k: "func", name: "min" })} title="Mínimo de varios argumentos: MIN(a, b, …)">MIN(</button>
        {divider}
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: "#f59e0b" }} onClick={() => setAdding("campo")} title="Añadir campo">+ Campo</button>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: "var(--text-secondary)" }} onClick={() => { setAdding("const"); setCteVal(""); }} title="Añadir constante">+ Constante</button>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: "#60a5fa" }} onClick={() => setAdding("ref")} disabled={refs.length === 0} title={refs.length === 0 ? "No hay otros cálculos" : "Añadir referencia a otro cálculo"}>+ Cálculo</button>
      </div>

      {adding === "campo" && (
        <select
          className="form-control"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 240, marginBottom: 12 }}
          defaultValue=""
          autoFocus
          onChange={(e) => {
            if (!e.target.value) { setAdding(null); return; }
            const [fuente, campo] = e.target.value.split("|");
            push({ k: "campo", fuente, campo });
            setAdding(null);
          }}
          onBlur={() => setAdding(null)}
        >
          <option value="">-- selecciona campo --</option>
          <optgroup label="PRODUCTO_COMPLEJO">
            {PRODUCTO_COMPLEJO_FIELDS.map((c) => <option key={`pc|${c}`} value={`PRODUCTO_COMPLEJO|${c}`}>{c}</option>)}
          </optgroup>
          <optgroup label="SETUP_EXTRUSORAS">
            {SETUP_FIELDS.map((c) => <option key={`se|${c}`} value={`SETUP_EXTRUSORAS|${c}`}>{c}</option>)}
          </optgroup>
        </select>
      )}
      {adding === "const" && (
        <input
          type="number"
          className="form-control"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, width: 130, marginBottom: 12 }}
          placeholder="valor"
          value={cteVal}
          autoFocus
          onChange={(e) => setCteVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitConst();
            if (e.key === "Escape") { setAdding(null); setCteVal(""); }
          }}
          onBlur={commitConst}
        />
      )}
      {adding === "ref" && (
        <select
          className="form-control"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 200, marginBottom: 12 }}
          defaultValue=""
          autoFocus
          onChange={(e) => {
            if (!e.target.value) { setAdding(null); return; }
            push({ k: "ref", calculo_id: e.target.value });
            setAdding(null);
          }}
          onBlur={() => setAdding(null)}
        >
          <option value="">-- selecciona cálculo --</option>
          {refs.map((d) => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
        </select>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", minHeight: 46, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg-surface-2)" }}>
        {tokens.length === 0
          ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Añade fichas para construir la fórmula…</span>
          : tokens.map((t, i) => <Chip key={i} t={t} onDelete={() => delAt(i)} />)}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setTokens(tokens.slice(0, -1))} disabled={tokens.length === 0}>⌫ Borrar última</button>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--error)" }} onClick={() => setTokens([])} disabled={tokens.length === 0}>Limpiar todo</button>
      </div>
    </div>
  );
}

// ── ConstructorPanel ──────────────────────────────────────────────────────────

function ConstructorPanel({ defInicial, isNew, definiciones, onSave, onDelete }) {
  const inicialReservado = RESERVADOS.includes(defInicial?.nombre);
  const [tipoNombre,  setTipoNombre]  = useState(inicialReservado ? defInicial.nombre : "OTRO");
  const [nombrePers,  setNombrePers]  = useState(inicialReservado ? "" : (defInicial?.nombre ?? ""));
  const [descripcion, setDescripcion] = useState(defInicial?.descripcion ?? "");
  const [unidad,      setUnidad]      = useState(defInicial?.unidad      ?? "");

  const init = deducirTokensIniciales(defInicial);
  const [tokens,   setTokens]   = useState(init.tokens);
  const [avanzado, setAvanzado] = useState(init.avanzado);

  const nombre = tipoNombre === "OTRO" ? nombrePers.trim() : tipoNombre;
  const nombreError = (() => {
    if (tipoNombre !== "OTRO") return null;
    if (!nombre) return "Escribe un nombre para el cálculo.";
    if (RESERVADOS.some((r) => r.toUpperCase() === nombre.toUpperCase())) return "RS y RENDIMIENTO se eligen desde la lista.";
    if ((definiciones ?? []).some((d) => d.id !== defInicial?.id && d.nombre === nombre)) return "Ya existe un cálculo con ese nombre.";
    return null;
  })();

  // Compila los tokens a AST en vivo: alimenta validación y preview.
  const compilado = useMemo(() => {
    if (avanzado)            return { ok: true, arbol: defInicial?.arbol ?? null, error: null };
    if (tokens.length === 0) return { ok: true, arbol: null, error: null };
    try   { return { ok: true,  arbol: compilarTokens(tokens), error: null }; }
    catch (e) { return { ok: false, arbol: null, error: e.message }; }
  }, [tokens, avanzado, defInicial]);

  const guardarDisabled = !nombre || !!nombreError || (!avanzado && !compilado.ok);

  function handleSave() {
    if (guardarDisabled) return;
    const base = {
      id:          defInicial?.id ?? newId(),
      nombre,
      descripcion: descripcion.trim(),
      unidad:      unidad.trim(),
      inputs:      [],
    };
    if (avanzado) onSave({ ...base, arbol: defInicial?.arbol ?? null });
    else          onSave({ ...base, arbol: compilado.arbol, tokens });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="card-header"><span className="card-title">Definición</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px", gap: 10, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, textTransform: "uppercase" }}>Nombre *</div>
            <select className="form-control" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} value={tipoNombre} onChange={(e) => setTipoNombre(e.target.value)}>
              <option value="RS">RS</option>
              <option value="RENDIMIENTO">RENDIMIENTO</option>
              <option value="OTRO">OTRO (personalizado)</option>
            </select>
            {tipoNombre === "OTRO" && (
              <input
                className="form-control"
                style={{ fontFamily: "var(--font-mono)", fontSize: 12, marginTop: 6 }}
                placeholder="NOMBRE_CALCULO"
                value={nombrePers}
                onChange={(e) => setNombrePers(e.target.value)}
              />
            )}
            {nombreError && (
              <div style={{ fontSize: 10, color: "var(--error)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{nombreError}</div>
            )}
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
        <div className="card-header"><span className="card-title">Fórmula</span></div>
        {avanzado ? (
          <div>
            <div style={{ padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
              ⚠ Esta fórmula usa operadores avanzados (min/max, si_aplica o booleanos) que no se pueden editar en el constructor lineal. Se muestra en solo lectura.
            </div>
            <div style={{ padding: "7px 10px", background: "var(--bg-surface-2)", borderRadius: "var(--radius)" }}>
              <code style={{ fontSize: 12, color: "var(--accent)" }}>{formulaTexto(defInicial?.arbol ?? null)}</code>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, fontSize: 12, color: "var(--error)" }} onClick={() => { setAvanzado(false); setTokens([]); }}>
              Reconstruir con el constructor lineal (se descarta la fórmula actual)
            </button>
          </div>
        ) : (
          <>
            <ConstructorLineal tokens={tokens} setTokens={setTokens} definiciones={definiciones} currentNombre={nombre} />
            {!compilado.ok && (
              <div style={{ marginTop: 10, padding: "7px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid var(--error)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--error)", fontFamily: "var(--font-mono)" }}>
                ⚠ {compilado.error}
              </div>
            )}
            {compilado.ok && tokens.length > 0 && (
              <div style={{ marginTop: 10, padding: "7px 10px", background: "var(--bg-surface-2)", borderRadius: "var(--radius)", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginRight: 8, textTransform: "uppercase" }}>Fórmula:</span>
                <code style={{ fontSize: 12, color: "var(--accent)" }}>{tokensTexto(tokens)}</code>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={guardarDisabled}>
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

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h1 className="page-title">CÁLCULOS</h1>
            <p className="page-subtitle">Constructor visual de fórmulas de cálculo.</p>
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
    </>
  );
}
