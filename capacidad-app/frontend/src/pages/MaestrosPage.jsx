import React, { useRef, useState, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../state";
import MasterViewer from "../components/MasterViewer";
import { autoImport } from "../services/csvParser";
import { useToast } from "../components/Toast";
import { MASTER_SCHEMAS_META } from "../masterSchemas";

const MASTER_INFO = {
  DEMANDA: {
    label: "Demanda",
    desc: "Unidades demandadas por mes y referencia",
    fields: ["MES", "REFERENCIA", "CANTIDAD"],
  },
  PRODUCTO: {
    label: "Producto",
    desc: "Catálogo de referencias con atributos del producto",
    fields: ["REFERENCIA", "ANCHO (MM)", "GALGA", "TIPO", "MEZCLA", "TRATAMIENTO", "ABREFACIL"],
  },
  ENRUTAMIENTO_MEZCLAS: {
    label: "Enrutamiento Mezclas",
    desc: "Relación mezcla → extrusora con rangos RS y límite soldadura",
    fields: ["MEZCLA", "EXTRUSORA", "RS MIN", "RS MÁXIMO", "GMAX SOLDADURA"],
  },
  CALENDARIO: {
    label: "Calendario",
    desc: "Horas disponibles por CM y mes",
    fields: ["MES", "CM", "CT", "HORAS TOTALES", "%EFICIENCIA", "HORAS EFICIENTES"],
  },
  MEZCLAS: {
    label: "Mezclas",
    desc: "Catálogo de mezclas (solo la clave MEZCLA por ahora)",
    fields: ["MEZCLA"],
    optional: true,
  },
};

// Los 4 maestros requeridos para el motor de cálculo (MEZCLAS es opcional, solo
// necesario si las fórmulas usan el modelo de cuellos).
const CORE_MASTERS = ["DEMANDA", "PRODUCTO", "ENRUTAMIENTO_MEZCLAS", "CALENDARIO"];

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Lista de campos en pills. Si su altura natural supera 2 líneas, colapsa a una
// sola línea con un desplegable; si cabe en ≤2 líneas, se muestra entera.
function CamposPills({ campos, loaded, masterKey, onPillEnter, onPillLeave }) {
  const ref = useRef(null);
  const [expanded, setExpanded]       = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [lineH, setLineH]             = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const first = el.firstElementChild;
      const ph = first ? first.offsetHeight : 20;
      setLineH(ph);
      // scrollHeight = altura total del contenido (ignora el recorte por maxHeight).
      // Supera 2 líneas → necesita desplegable.
      setOverflowing(el.scrollHeight > ph * 2 + 6);
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => ro && ro.disconnect();
  }, [campos]);

  const collapsed = overflowing && !expanded;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        ref={ref}
        style={{
          display: "flex", flexWrap: "wrap", gap: 5,
          maxHeight: collapsed && lineH ? lineH : undefined,
          overflow: collapsed ? "hidden" : undefined,
        }}
      >
        {campos.map((f) => (
          <span
            key={f}
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: loaded ? "default" : undefined, whiteSpace: "nowrap" }}
            onMouseEnter={loaded ? (e) => onPillEnter(e, masterKey, f) : undefined}
            onMouseLeave={loaded ? onPillLeave : undefined}
          >
            {f}
          </span>
        ))}
      </div>
      {overflowing && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 10, padding: "2px 6px", marginTop: 5, color: "var(--accent)" }}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "▴ Ver menos" : `▾ Ver todos (${campos.length})`}
        </button>
      )}
    </div>
  );
}

export default function MaestrosPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const getMasterStatus = useStore((s) => s.getMasterStatus);
  const masters = useStore((s) => s.masters);
  void masters;
  const status = getMasterStatus();
  const importMasterAction = useStore((s) => s.importMaster);
  const setSetupExtrusorasRevision = useStore((s) => s.setSetupExtrusorasRevision);
  const setupRevision = useStore((s) => s.setupExtrusorasRevision);

  const [viewing, setViewing] = useState(null);
  const [tooltip, setTooltip] = useState(null); // { label, count, x, y }

  // Only the 4 core masters need to be loaded for calculation
  const allCoreLoaded = CORE_MASTERS.every((k) => status[k]?.loaded);

  // ── Distinct-count tooltip ────────────────────────────────────────────────
  function resolveFieldName(masterKey, fieldLabel) {
    const schema = MASTER_SCHEMAS_META[masterKey] ?? [];
    return (
      schema.find((f) => (f.label ?? f.name) === fieldLabel)?.name ??
      schema.find((f) => f.name === fieldLabel)?.name ??
      fieldLabel
    );
  }

  function handlePillEnter(e, masterKey, fieldLabel) {
    const records = masters[masterKey]?.records ?? [];
    if (records.length === 0) return;
    const fieldName = resolveFieldName(masterKey, fieldLabel);
    const count = new Set(
      records.map((r) => r[fieldName]).filter((v) => v != null && v !== "")
    ).size;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ label: fieldLabel, count, x: rect.left, y: rect.bottom + 6 });
  }

  function handlePillLeave() { setTooltip(null); }

  // ── Auto-import handler ───────────────────────────────────────────────────
  function triggerAutoImport(masterName) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const result = await autoImport(file, masterName);
      if (!result.success) {
        toast.error(
          `El archivo no tiene el formato esperado. Usa la importación asistida. (${result.reason})`
        );
        return;
      }
      importMasterAction(masterName, result.rows);
      if (masterName === "SETUP_EXTRUSORAS") {
        const rev = result.meta["_META_FECHA_REVISION"];
        if (rev) setSetupExtrusorasRevision(rev);
      }
      toast.success(
        `${result.valid_count} registros cargados correctamente${result.error_count > 0 ? ` (${result.error_count} omitidos)` : ""}.`
      );
    };
    input.click();
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">MAESTROS</h1>
        <p className="page-subtitle">
          Carga los cuatro maestros para ejecutar el motor de cálculo. Setup Extrusoras es independiente.
        </p>
      </div>

      <div className="page-body">
        {allCoreLoaded && (
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            ✓ Todos los maestros de cálculo están cargados. Puedes ejecutar el cálculo en Resultados.
          </div>
        )}

        {/* ── All 5 masters in one unified grid ── */}
        <div className="grid-2">
          {Object.entries(MASTER_INFO).map(([key, info]) => {
            const s = status[key] || {};
            const loaded = s.loaded;
            return (
              <div key={key} className="card card-compact" style={{ borderColor: loaded ? "var(--card-success-border)" : "var(--border)", background: loaded ? "var(--card-success-bg)" : "var(--bg-surface)" }}>
                <div className="card-header">
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: loaded ? "var(--text-primary)" : "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>
                      {key.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{info.desc}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: loaded ? "var(--success-dim)" : "var(--bg-surface-2)", color: loaded ? "var(--success)" : "var(--text-muted)", border: `1px solid ${loaded ? "rgba(16,185,129,0.3)" : "var(--border)"}` }}>
                    {loaded ? "CARGADO" : "VACÍO"}
                  </span>
                </div>

                <CamposPills campos={info.fields} loaded={loaded} masterKey={key} onPillEnter={handlePillEnter} onPillLeave={handlePillLeave} />

                {loaded && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, padding: "5px 0", borderTop: "1px solid var(--border)" }}>
                    <span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--accent)", marginRight: 6 }}>
                        {s.count?.toLocaleString("es-ES")}
                      </span>
                      registros
                    </span>
                    <span>{fmtDate(s.loaded_at)}</span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/cargador?maestro=${key}`)}>
                    Importación asistida
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => triggerAutoImport(key)} title="Para CSVs exportados previamente por esta herramienta">
                    Importación automática
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!loaded}
                    onClick={() => setViewing(key)}
                    title={loaded ? `Ver ${s.count} registros` : "Sin datos cargados"}
                  >
                    Visualizar
                  </button>
                </div>
              </div>
            );
          })}

          {/* ── SETUP EXTRUSORAS — 5th card, same grid cell ── */}
          {(() => {
            const loaded = status.SETUP_EXTRUSORAS?.loaded;
            const s = status.SETUP_EXTRUSORAS || {};
            const setupCampos = (MASTER_SCHEMAS_META.SETUP_EXTRUSORAS ?? []).map((f) => f.label ?? f.name);
            return (
              <div className="card card-compact" style={{ borderColor: loaded ? "var(--card-success-border)" : "var(--border)", background: loaded ? "var(--card-success-bg)" : "var(--bg-surface)" }}>
                <div className="card-header">
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: loaded ? "var(--text-primary)" : "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>
                      SETUP EXTRUSORAS
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Configuraciones de líneas de extrusión
                      {setupRevision && (
                        <span style={{ marginLeft: 8, color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                          · Rev. {setupRevision}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: loaded ? "var(--success-dim)" : "var(--bg-surface-2)", color: loaded ? "var(--success)" : "var(--text-muted)", border: `1px solid ${loaded ? "rgba(16,185,129,0.3)" : "var(--border)"}` }}>
                    {loaded ? "CARGADO" : "VACÍO"}
                  </span>
                </div>

                <CamposPills campos={setupCampos} loaded={loaded} masterKey="SETUP_EXTRUSORAS" onPillEnter={handlePillEnter} onPillLeave={handlePillLeave} />

                {loaded && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, padding: "5px 0", borderTop: "1px solid var(--border)" }}>
                    <span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--accent)", marginRight: 6 }}>
                        {s.count?.toLocaleString("es-ES")}
                      </span>
                      configuraciones
                    </span>
                    <span>{fmtDate(s.loaded_at)}</span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate("/cargador?maestro=SETUP_EXTRUSORAS")}>
                    Importación asistida
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => triggerAutoImport("SETUP_EXTRUSORAS")} title="Para CSVs exportados previamente por esta herramienta">
                    Importación automática
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!loaded}
                    onClick={() => setViewing("SETUP_EXTRUSORAS")}
                    title={loaded ? `Ver ${s.count} configuraciones` : "Sin datos cargados"}
                  >
                    Visualizar
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {viewing && <MasterViewer masterName={viewing} onClose={() => setViewing(null)} />}

      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x,
          top: tooltip.y,
          zIndex: 9999,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "5px 12px",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
          whiteSpace: "nowrap",
        }}>
          <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
            {tooltip.count.toLocaleString("es-ES")}
          </span>
          {" "}valores distintos
        </div>
      )}
    </>
  );
}
