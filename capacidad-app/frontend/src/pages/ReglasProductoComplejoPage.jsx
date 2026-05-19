import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../state";
import { calcularProductoComplejo } from "../services/intermedias";
import { useToast } from "../components/Toast";

// ── Metadata ───────────────────────────────────────────────────────────────────

const CONFIGURABLE_CAMPOS = [
  { name: "SOLDADOR_LONGITUDINAL", type: "boolean", label: "SOLDADOR LONGITUDINAL" },
  { name: "ABIERTA_LATERAL",       type: "boolean", label: "ABIERTA LATERAL"       },
  { name: "ABIERTA_CENTRO",        type: "boolean", label: "ABIERTA CENTRO"        },
  { name: "ABREFACIL_LATERAL",     type: "boolean", label: "ABREFÁCIL LATERAL"     },
  { name: "ABREFACIL_CENTRAL",     type: "boolean", label: "ABREFÁCIL CENTRAL"     },
  { name: "TRATADA_PC",             type: "boolean", label: "TRATADA PC"            },
];

const PRODUCTO_CAMPOS = [
  { name: "REFERENCIA",  type: "string"  },
  { name: "ANCHO",       type: "decimal" },
  { name: "GALGA",       type: "decimal" },
  { name: "TIPO",        type: "string"  },
  { name: "MEZCLA",      type: "string"  },
  { name: "FUELLE",      type: "decimal" },
  { name: "TRATAMIENTO", type: "boolean" },
  { name: "ABREFACIL",   type: "boolean" },
];

const PC_CAMPOS = [
  { name: "TIPO", type: "string", values: ["Simple", "Doble"] },
];

const OPS_STRING  = [
  { code: "eq",          label: "es igual a"            },
  { code: "neq",         label: "es distinto de"        },
  { code: "contains",    label: "contiene"              },
  { code: "starts_with", label: "empieza por"           },
  { code: "is_null",     label: "es nulo / vacío"       },
  { code: "is_not_null", label: "no es nulo / no vacío" },
];
const OPS_DECIMAL = [
  { code: "eq",          label: "es igual a"            },
  { code: "neq",         label: "es distinto de"        },
  { code: "gt",          label: "mayor que"             },
  { code: "lt",          label: "menor que"             },
  { code: "gte",         label: "mayor o igual que"     },
  { code: "lte",         label: "menor o igual que"     },
  { code: "is_null",     label: "es nulo / vacío"       },
  { code: "is_not_null", label: "no es nulo / no vacío" },
];
const OPS_BOOLEAN = [
  { code: "eq",          label: "es igual a"            },
  { code: "neq",         label: "es distinto de"        },
  { code: "is_null",     label: "es nulo / vacío"       },
  { code: "is_not_null", label: "no es nulo / no vacío" },
];
const OPS_BY_TYPE  = { string: OPS_STRING, decimal: OPS_DECIMAL, boolean: OPS_BOOLEAN };
const NO_VALOR_OPS = new Set(["is_null", "is_not_null"]);

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getCampoMeta(fuente, campoName) {
  const list = fuente === "PRODUCTO" ? PRODUCTO_CAMPOS : PC_CAMPOS;
  return list.find((f) => f.name === campoName) ?? { name: campoName, type: "string" };
}

function condLabel(cond) {
  const src  = cond.fuente === "PRODUCTO" ? "PROD" : "PC";
  const tipo = getCampoMeta(cond.fuente, cond.campo).type;
  const ops  = OPS_BY_TYPE[tipo] ?? OPS_STRING;
  const opLbl = ops.find((o) => o.code === cond.operador)?.label ?? cond.operador;
  if (NO_VALOR_OPS.has(cond.operador)) return `${src}.${cond.campo} ${opLbl}`;
  return `${src}.${cond.campo} ${opLbl} "${cond.valor}"`;
}

function reglaDesc(regla) {
  const cuando = regla.condiciones.length === 0
    ? "Siempre"
    : regla.condiciones.map(condLabel).join(" Y ");
  const res = regla.resultado.tipo === "valor_fijo"
    ? `→ ${regla.resultado.valor || "(vacío)"}`
    : `→ copiar PRODUCTO.${regla.resultado.valor}`;
  return `${cuando}  ${res}`;
}

// ── Condition row ──────────────────────────────────────────────────────────────

const SEL = {
  fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 6px",
  borderRadius: "var(--radius)", border: "1px solid var(--border)",
  background: "var(--bg-surface-2)", color: "var(--text-primary)", height: 28,
};

function CondicionRow({ cond, onChange, onDelete }) {
  const fuente    = cond.fuente   ?? "PRODUCTO";
  const campos    = fuente === "PRODUCTO" ? PRODUCTO_CAMPOS : PC_CAMPOS;
  const campoName = cond.campo    ?? campos[0]?.name ?? "";
  const meta      = getCampoMeta(fuente, campoName);
  const ops       = OPS_BY_TYPE[meta.type] ?? OPS_STRING;
  const op        = cond.operador ?? ops[0]?.code ?? "eq";
  const showValor = !NO_VALOR_OPS.has(op);
  const isPcTipo  = fuente === "PRODUCTO_COMPLEJO" && campoName === "TIPO";

  function upd(patch) { onChange({ ...cond, ...patch }); }

  function onFuente(e) {
    const f = e.target.value;
    const c = (f === "PRODUCTO" ? PRODUCTO_CAMPOS : PC_CAMPOS)[0]?.name ?? "";
    const t = getCampoMeta(f, c).type;
    onChange({ ...cond, fuente: f, campo: c, operador: (OPS_BY_TYPE[t] ?? OPS_STRING)[0].code, valor: "" });
  }

  function onCampo(e) {
    const c = e.target.value;
    const t = getCampoMeta(fuente, c).type;
    onChange({ ...cond, campo: c, operador: (OPS_BY_TYPE[t] ?? OPS_STRING)[0].code, valor: "" });
  }

  function onOp(e) {
    const newOp = e.target.value;
    onChange({ ...cond, operador: newOp, valor: NO_VALOR_OPS.has(newOp) ? "" : (cond.valor ?? "") });
  }

  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
      <select style={SEL} value={fuente} onChange={onFuente}>
        <option value="PRODUCTO">PRODUCTO</option>
        <option value="PRODUCTO_COMPLEJO">PRODUCTO COMPLEJO</option>
      </select>
      <select style={SEL} value={campoName} onChange={onCampo}>
        {campos.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
      </select>
      <select style={SEL} value={op} onChange={onOp}>
        {ops.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
      </select>
      {showValor && (
        meta.type === "boolean" ? (
          <select style={SEL} value={cond.valor ?? ""} onChange={(e) => upd({ valor: e.target.value })}>
            <option value="">--</option>
            <option value="SI">SI</option>
            <option value="NO">NO</option>
          </select>
        ) : isPcTipo ? (
          <select style={SEL} value={cond.valor ?? ""} onChange={(e) => upd({ valor: e.target.value })}>
            <option value="">--</option>
            <option value="Simple">Simple</option>
            <option value="Doble">Doble</option>
          </select>
        ) : (
          <input
            style={{ ...SEL, minWidth: 80 }}
            placeholder="valor"
            value={cond.valor ?? ""}
            onChange={(e) => upd({ valor: e.target.value })}
          />
        )
      )}
      <button
        className="btn btn-ghost btn-sm"
        style={{ fontSize: 13, padding: "2px 8px" }}
        onClick={onDelete}
      >✕</button>
    </div>
  );
}

// ── Rule modal ─────────────────────────────────────────────────────────────────

function ReglaModal({ campoInicial, reglaInicial, onGuardar, onCancelar }) {
  const [campo,       setCampo]       = useState(campoInicial ?? CONFIGURABLE_CAMPOS[0].name);
  const [condiciones, setCondiciones] = useState(reglaInicial?.condiciones ?? []);
  const [resultado,   setResultado]   = useState(reglaInicial?.resultado   ?? { tipo: "valor_fijo", valor: "" });

  const destMeta   = CONFIGURABLE_CAMPOS.find((c) => c.name === campo) ?? CONFIGURABLE_CAMPOS[0];
  const isDestBool = destMeta.type === "boolean";

  function addCond() {
    setCondiciones((prev) => [...prev, { fuente: "PRODUCTO", campo: "TIPO", operador: "eq", valor: "" }]);
  }

  function save() {
    onGuardar({
      id:        reglaInicial?.id ?? newId(),
      campo,
      prioridad: reglaInicial?.prioridad ?? 999,
      condiciones,
      resultado,
    });
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancelar(); }}
    >
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", width: "min(92vw, 700px)", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.07em" }}>
            {reglaInicial ? "EDITAR REGLA" : "NUEVA REGLA"}
          </span>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 16 }} onClick={onCancelar}>✕ Cerrar</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Campo destino */}
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, textTransform: "uppercase" }}>Campo destino</div>
            <select
              className="form-control"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
              value={campo}
              onChange={(e) => setCampo(e.target.value)}
              disabled={!!campoInicial}
            >
              {CONFIGURABLE_CAMPOS.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}
            </select>
          </div>

          {/* Condiciones */}
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase" }}>
              Condiciones&nbsp;
              <span style={{ fontWeight: 400, textTransform: "none" }}>(AND implícito — sin condiciones = aplica siempre)</span>
            </div>
            {condiciones.map((cond, i) => (
              <CondicionRow
                key={i}
                cond={cond}
                onChange={(c) => setCondiciones((prev) => prev.map((x, idx) => idx === i ? c : x))}
                onDelete={() => setCondiciones((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={addCond}>
              + Añadir condición
            </button>
          </div>

          {/* Resultado */}
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase" }}>Resultado</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
              {["valor_fijo", "campo_copiado"].map((t) => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                  <input type="radio" value={t} checked={resultado.tipo === t} onChange={() => setResultado({ tipo: t, valor: "" })} />
                  {t === "valor_fijo" ? "Valor fijo" : "Copiar campo de PRODUCTO"}
                </label>
              ))}
            </div>
            {resultado.tipo === "valor_fijo" ? (
              isDestBool ? (
                <select
                  className="form-control"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, maxWidth: 160 }}
                  value={resultado.valor ?? ""}
                  onChange={(e) => setResultado((r) => ({ ...r, valor: e.target.value }))}
                >
                  <option value="">-- selecciona --</option>
                  <option value="SI">SI</option>
                  <option value="NO">NO</option>
                </select>
              ) : (
                <input
                  className="form-control"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, maxWidth: 240 }}
                  placeholder="valor numérico"
                  value={resultado.valor ?? ""}
                  onChange={(e) => setResultado((r) => ({ ...r, valor: e.target.value }))}
                />
              )
            ) : (
              <select
                className="form-control"
                style={{ fontFamily: "var(--font-mono)", fontSize: 12, maxWidth: 280 }}
                value={resultado.valor ?? ""}
                onChange={(e) => setResultado((r) => ({ ...r, valor: e.target.value }))}
              >
                <option value="">-- selecciona campo --</option>
                {PRODUCTO_CAMPOS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReglasProductoComplejoPage() {
  const navigate = useNavigate();
  const toast    = useToast();

  const reglas      = useStore((s) => s.reglas.PRODUCTO_A_COMPLEJO);
  const setReglas   = useStore((s) => s.setReglas);
  const addRegla    = useStore((s) => s.addRegla);
  const updateRegla = useStore((s) => s.updateRegla);
  const deleteRegla = useStore((s) => s.deleteRegla);

  const productoRows  = useStore((s) => s.masters.PRODUCTO?.records ?? []);
  const demandaRows   = useStore((s) => s.masters.DEMANDA?.records  ?? []);
  const setIntermedia = useStore((s) => s.setIntermedia);

  const [expanded, setExpanded] = useState(null);
  const [modal,    setModal]    = useState(null);

  // ── Header actions ────────────────────────────────────────────────────────

  function handleCalcular() {
    if (productoRows.length === 0) {
      toast.error("Carga primero el maestro PRODUCTO.");
      return;
    }
    const result = calcularProductoComplejo(productoRows, reglas, demandaRows);
    setIntermedia("PRODUCTO_COMPLEJO", result);
    const filtrado = demandaRows.length > 0 ? " (filtrado por Demanda)" : "";
    toast.success(`Producto Simple y Doble calculado: ${result.length} registros${filtrado}.`);
  }

  // ── Rule CRUD ─────────────────────────────────────────────────────────────

  function handleGuardar(reglaData) {
    if (modal.regla) {
      updateRegla("PRODUCTO_A_COMPLEJO", reglaData.id, reglaData);
    } else {
      const campoReglas = reglas.filter((r) => r.campo === reglaData.campo);
      addRegla("PRODUCTO_A_COMPLEJO", { ...reglaData, prioridad: campoReglas.length + 1 });
    }
    setModal(null);
  }

  function moveRegla(campo, id, dir) {
    const sorted = reglas
      .filter((r) => r.campo === campo)
      .sort((a, b) => a.prioridad - b.prioridad);
    const idx = sorted.findIndex((r) => r.id === id);
    const nxt = dir === "up" ? idx - 1 : idx + 1;
    if (nxt < 0 || nxt >= sorted.length) return;
    const arr = [...sorted];
    [arr[idx], arr[nxt]] = [arr[nxt], arr[idx]];
    const reassigned = arr.map((r, i) => ({ ...r, prioridad: i + 1 }));
    const ids = new Set(reassigned.map((r) => r.id));
    setReglas("PRODUCTO_A_COMPLEJO", [...reglas.filter((r) => !ids.has(r.id)), ...reassigned]);
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/reglas")} style={{ fontSize: 12 }}>
            ← Volver a Reglas
          </button>
        </div>
        <h1 className="page-title">REGLAS PRODUCTO COMPLEJO</h1>
        <p className="page-subtitle">
          Define las reglas para calcular los 6 campos booleanos del Producto Complejo.
          ANCHO EXTRUSIÓN y GALGA se calculan automáticamente.
        </p>
      </div>

      <div className="page-body">
        {/* ── Action bar ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={handleCalcular}>
            ▶ Calcular Producto Complejo
          </button>
        </div>

        {/* ── Accordion ── */}
        {CONFIGURABLE_CAMPOS.map((campoMeta) => {
          const campoReglas = reglas
            .filter((r) => r.campo === campoMeta.name)
            .sort((a, b) => a.prioridad - b.prioridad);
          const isOpen = expanded === campoMeta.name;

          return (
            <div key={campoMeta.name} className="card" style={{ marginBottom: 8 }}>
              {/* Accordion header */}
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
                onClick={() => setExpanded((p) => p === campoMeta.name ? null : campoMeta.name)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.06em" }}>
                    {campoMeta.label}
                  </span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: campoReglas.length > 0 ? "var(--accent-dim)" : "var(--bg-surface-2)", color: campoReglas.length > 0 ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${campoReglas.length > 0 ? "var(--border-accent)" : "var(--border)"}` }}>
                    {campoReglas.length} regla{campoReglas.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {/* Accordion body */}
              {isOpen && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  {campoReglas.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                      Sin reglas — el campo quedará como — (nulo).
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                      {campoReglas.map((regla, idx) => (
                        <div
                          key={regla.id}
                          style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "var(--bg-surface-2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
                        >
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", fontWeight: 700, minWidth: 18, paddingTop: 1 }}>
                            {idx + 1}
                          </span>
                          <span
                            style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", cursor: "pointer", lineHeight: 1.6 }}
                            onClick={() => setModal({ campo: campoMeta.name, regla })}
                          >
                            {reglaDesc(regla)}
                          </span>
                          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                            <button className="btn btn-ghost btn-sm" style={{ padding: "1px 6px", fontSize: 12 }} disabled={idx === 0} onClick={() => moveRegla(campoMeta.name, regla.id, "up")} title="Subir prioridad">↑</button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: "1px 6px", fontSize: 12 }} disabled={idx === campoReglas.length - 1} onClick={() => moveRegla(campoMeta.name, regla.id, "down")} title="Bajar prioridad">↓</button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: "1px 6px", fontSize: 12, color: "var(--error)" }} onClick={() => deleteRegla("PRODUCTO_A_COMPLEJO", regla.id)} title="Eliminar">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => setModal({ campo: campoMeta.name })}>
                    + Añadir regla
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <ReglaModal
          campoInicial={modal.campo}
          reglaInicial={modal.regla}
          onGuardar={handleGuardar}
          onCancelar={() => setModal(null)}
        />
      )}
    </>
  );
}
