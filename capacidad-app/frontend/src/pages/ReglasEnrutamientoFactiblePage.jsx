import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../state";
import { calcularFactibles } from "../services/engine";
import { exportReglasFact } from "../services/exporter";
import { autoImportReglasFact } from "../services/csvParser";
import { schemaDeDefiniciones } from "../utils/enrutamientosSchema";
import { MASTER_SCHEMAS_META } from "../masterSchemas";
import { useToast } from "../components/Toast";

// ── Operators by field type ────────────────────────────────────────────────────

const OPS_STRING = [
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

const SE_CAMPOS = MASTER_SCHEMAS_META.SETUP_EXTRUSORAS ?? [];

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getCampoMeta(fuente, campoName, enrCampos) {
  const list = fuente === "SETUP_EXTRUSORAS" ? SE_CAMPOS : enrCampos;
  return list.find((f) => f.name === campoName) ?? { name: campoName, type: "string" };
}

function condLabel(cond, enrCampos) {
  const src     = cond.fuente === "SETUP_EXTRUSORAS" ? "SE" : "ENR";
  const meta    = getCampoMeta(cond.fuente, cond.campo, enrCampos);
  const ops     = OPS_BY_TYPE[meta.type] ?? OPS_STRING;
  const opLbl   = ops.find((o) => o.code === cond.operador)?.label ?? cond.operador;
  if (NO_VALOR_OPS.has(cond.operador)) return `${src}.${cond.campo} ${opLbl}`;
  return `${src}.${cond.campo} ${opLbl} "${cond.valor}"`;
}

function reglaDesc(regla, enrCampos) {
  const cuando = regla.condiciones.length === 0
    ? "Siempre"
    : regla.condiciones.map((c) => condLabel(c, enrCampos)).join(" Y ");
  return `${cuando}  →  FACTIBLE = NO`;
}

// ── Condition row ──────────────────────────────────────────────────────────────

const SEL = {
  fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 6px",
  borderRadius: "var(--radius)", border: "1px solid var(--border)",
  background: "var(--bg-surface-2)", color: "var(--text-primary)", height: 28,
};

function CondicionRow({ cond, enrCampos, onChange, onDelete }) {
  const fuente    = cond.fuente ?? "ENRUTAMIENTOS";
  const campos    = fuente === "SETUP_EXTRUSORAS" ? SE_CAMPOS : enrCampos;
  const campoName = cond.campo ?? campos[0]?.name ?? "";
  const meta      = getCampoMeta(fuente, campoName, enrCampos);
  const ops       = OPS_BY_TYPE[meta.type] ?? OPS_STRING;
  const op        = cond.operador ?? ops[0]?.code ?? "eq";
  const showValor = !NO_VALOR_OPS.has(op);

  function upd(patch) { onChange({ ...cond, ...patch }); }

  function onFuente(e) {
    const f  = e.target.value;
    const cs = f === "SETUP_EXTRUSORAS" ? SE_CAMPOS : enrCampos;
    const c  = cs[0]?.name ?? "";
    const t  = getCampoMeta(f, c, enrCampos).type;
    onChange({ ...cond, fuente: f, campo: c, operador: (OPS_BY_TYPE[t] ?? OPS_STRING)[0].code, valor: "" });
  }

  function onCampo(e) {
    const c = e.target.value;
    const t = getCampoMeta(fuente, c, enrCampos).type;
    onChange({ ...cond, campo: c, operador: (OPS_BY_TYPE[t] ?? OPS_STRING)[0].code, valor: "" });
  }

  function onOp(e) {
    const newOp = e.target.value;
    onChange({ ...cond, operador: newOp, valor: NO_VALOR_OPS.has(newOp) ? "" : (cond.valor ?? "") });
  }

  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
      <select style={SEL} value={fuente} onChange={onFuente}>
        <option value="ENRUTAMIENTOS">ENRUTAMIENTOS</option>
        <option value="SETUP_EXTRUSORAS">SETUP EXTRUSORAS</option>
      </select>
      <select style={SEL} value={campoName} onChange={onCampo}>
        {campos.map((f) => <option key={f.name} value={f.name}>{f.label ?? f.name}</option>)}
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
        ) : (
          <input
            style={{ ...SEL, minWidth: 80 }}
            placeholder="valor"
            value={cond.valor ?? ""}
            onChange={(e) => upd({ valor: e.target.value })}
          />
        )
      )}
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 13, padding: "2px 8px" }} onClick={onDelete}>✕</button>
    </div>
  );
}

// ── Rule modal ─────────────────────────────────────────────────────────────────

function ReglaModal({ reglaInicial, enrCampos, onGuardar, onCancelar }) {
  const [condiciones, setCondiciones] = useState(reglaInicial?.condiciones ?? []);

  function addCond() {
    const primer = enrCampos[0];
    setCondiciones((p) => [...p, { fuente: "ENRUTAMIENTOS", campo: primer?.name ?? "", operador: "eq", valor: "" }]);
  }

  function save() {
    onGuardar({
      id:          reglaInicial?.id ?? newId(),
      campo:       "FACTIBLE",
      prioridad:   reglaInicial?.prioridad ?? 999,
      condiciones,
      resultado:   { tipo: "valor_fijo", valor: "NO" },
    });
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancelar(); }}
    >
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", width: "min(92vw, 700px)", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.07em" }}>
            {reglaInicial ? "EDITAR REGLA" : "NUEVA REGLA DE EXCLUSIÓN"}
          </span>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 16 }} onClick={onCancelar}>✕ Cerrar</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Fixed campo/resultado display */}
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, textTransform: "uppercase" }}>Campo destino</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 8px", background: "var(--bg-surface-2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                FACTIBLE (fijo)
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, textTransform: "uppercase" }}>Resultado</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 8px", background: "var(--bg-surface-2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", color: "var(--error)" }}>
                FACTIBLE = NO (fijo)
              </div>
            </div>
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
                enrCampos={enrCampos}
                onChange={(c) => setCondiciones((p) => p.map((x, idx) => idx === i ? c : x))}
                onDelete={() => setCondiciones((p) => p.filter((_, idx) => idx !== i))}
              />
            ))}
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={addCond} disabled={enrCampos.length === 0}>
              + Añadir condición
            </button>
            {enrCampos.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 4 }}>
                Define primero los cálculos RS y RENDIMIENTO en CÁLCULOS.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReglasEnrutamientoFactiblePage() {
  const navigate = useNavigate();
  const toast    = useToast();

  const reglasFact      = useStore((s) => s.reglas.ENRUTAMIENTO_A_FACTIBLE);
  const setReglasFact   = useStore((s) => s.setReglasFact);
  const addReglaFact    = useStore((s) => s.addReglaFact);
  const updateReglaFact = useStore((s) => s.updateReglaFact);
  const deleteReglaFact = useStore((s) => s.deleteReglaFact);

  const enrutamientos   = useStore((s) => s.intermedias_calculadas.ENRUTAMIENTOS);
  const setupExtrusoras = useStore((s) => s.masters.SETUP_EXTRUSORAS?.records ?? []);
  const setEnrutamientosFactibles = useStore((s) => s.setEnrutamientosFactibles);
  const definiciones    = useStore((s) => s.calculos.DEFINICIONES);

  const [modal, setModal] = useState(null);

  const enrCampos = useMemo(() => schemaDeDefiniciones(definiciones), [definiciones]);
  const sorted    = [...reglasFact].sort((a, b) => a.prioridad - b.prioridad);

  function handleCalcular() {
    if (enrutamientos.length === 0) { toast.error("Calcula primero ENRUTAMIENTOS."); return; }
    const { factibles, log } = calcularFactibles({ enrutamientos, reglasFactibilidad: reglasFact, setupExtrusoras });
    setEnrutamientosFactibles(factibles);
    const noFact = factibles.filter((r) => r.FACTIBLE === "NO").length;
    toast.success(`${factibles.length} filas · ${noFact} marcadas NO FACTIBLE.`);
  }

  function makeImportar() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".csv,.txt";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const res = await autoImportReglasFact(file);
      if (!res.success) { toast.error(`No se pudo importar: ${res.reason}`); return; }
      setReglasFact(res.reglas);
      toast.success(`${res.reglas.length} reglas importadas.`);
    };
    input.click();
  }

  function handleGuardar(reglaData) {
    if (modal.regla) {
      updateReglaFact(reglaData.id, reglaData);
    } else {
      addReglaFact({ ...reglaData, prioridad: reglasFact.length + 1 });
    }
    setModal(null);
  }

  function moveRegla(id, dir) {
    const idx = sorted.findIndex((r) => r.id === id);
    const nxt = dir === "up" ? idx - 1 : idx + 1;
    if (nxt < 0 || nxt >= sorted.length) return;
    const arr = [...sorted];
    [arr[idx], arr[nxt]] = [arr[nxt], arr[idx]];
    setReglasFact(arr.map((r, i) => ({ ...r, prioridad: i + 1 })));
  }

  return (
    <>
      <div className="page-header">
        <div style={{ marginBottom: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/reglas")} style={{ fontSize: 12 }}>
            ← Volver a Reglas
          </button>
        </div>
        <h1 className="page-title">REGLAS ENRUTAMIENTO FACTIBLE</h1>
        <p className="page-subtitle">
          Reglas de exclusión: si todas las condiciones se cumplen → FACTIBLE = NO.
        </p>
      </div>

      <div className="page-body">
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={handleCalcular}>
            ▶ Calcular Enrutamientos Factibles
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { if (!reglasFact.length) return; exportReglasFact(reglasFact); }} disabled={!reglasFact.length}>
            ⬇ Exportar reglas CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={makeImportar}>
            ⬆ Importar reglas CSV
          </button>
        </div>

        {/* Lista de reglas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Sin reglas definidas — todas las filas tendrán FACTIBLE = SI.
            </div>
          ) : (
            sorted.map((regla, idx) => (
              <div
                key={regla.id}
                style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", background: "var(--bg-surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--error)", fontWeight: 700, minWidth: 20, paddingTop: 1 }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 12, color: "var(--text-primary)", cursor: "pointer", lineHeight: 1.6 }}
                    onClick={() => setModal({ regla })}
                  >
                    {reglaDesc(regla, enrCampos)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "1px 6px", fontSize: 12 }} disabled={idx === 0} onClick={() => moveRegla(regla.id, "up")}>↑</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "1px 6px", fontSize: 12 }} disabled={idx === sorted.length - 1} onClick={() => moveRegla(regla.id, "down")}>↓</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "1px 6px", fontSize: 12, color: "var(--error)" }} onClick={() => deleteReglaFact(regla.id)}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setModal({})}>
          + Añadir regla de exclusión
        </button>
      </div>

      {modal && (
        <ReglaModal
          reglaInicial={modal.regla}
          enrCampos={enrCampos}
          onGuardar={handleGuardar}
          onCancelar={() => setModal(null)}
        />
      )}
    </>
  );
}
