import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../state";
import MasterViewer from "../components/MasterViewer";
import { autoImport } from "../services/csvParser";
import { useToast } from "../components/Toast";

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
};

const CORE_MASTERS = Object.keys(MASTER_INFO);

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
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

  // Only the 4 core masters need to be loaded for calculation
  const allCoreLoaded = CORE_MASTERS.every((k) => status[k]?.loaded);

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
              <div key={key} className="card" style={{ borderColor: loaded ? "rgba(16,185,129,0.25)" : "var(--border)", background: loaded ? "#0c1a12" : "var(--bg-surface)" }}>
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

                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                  {info.fields.map((f) => (
                    <span key={f} style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      {f}
                    </span>
                  ))}
                </div>

                {loaded && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 14, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
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
            return (
              <div className="card" style={{ borderColor: loaded ? "rgba(16,185,129,0.25)" : "var(--border)", background: loaded ? "#0c1a12" : "var(--bg-surface)" }}>
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

                {loaded && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 14, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
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
    </>
  );
}
