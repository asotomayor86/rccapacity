import React from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../state";
import { exportReglasCsv, exportReglasFact } from "../services/exporter";
import { autoImportReglas, autoImportReglasFact } from "../services/csvParser";
import { useToast } from "../components/Toast";

function RuleCard({ title, desc, hasReglas, count, navTo, onExportar, onImportar }) {
  const navigate = useNavigate();
  return (
    <div
      className="card"
      style={{ borderColor: hasReglas ? "rgba(16,185,129,0.25)" : "var(--border)", background: hasReglas ? "#0d1f17" : "var(--bg-surface)" }}
    >
      <div className="card-header">
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: hasReglas ? "var(--text-primary)" : "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: hasReglas ? "var(--success-dim)" : "var(--bg-surface-2)", color: hasReglas ? "var(--success)" : "var(--text-muted)", border: `1px solid ${hasReglas ? "rgba(16,185,129,0.3)" : "var(--border)"}` }}>
          {hasReglas ? `${count} regla${count !== 1 ? "s" : ""}` : "SIN REGLAS"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" onClick={() => navigate(navTo)}>
          Establecer reglas
        </button>
        <button className="btn btn-secondary btn-sm" disabled={!hasReglas} onClick={onExportar}>
          Exportar reglas
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onImportar}>
          Importar reglas
        </button>
      </div>
    </div>
  );
}

export default function ReglasPage() {
  const toast        = useToast();
  const reglas       = useStore((s) => s.reglas.PRODUCTO_A_COMPLEJO);
  const reglasFact   = useStore((s) => s.reglas.ENRUTAMIENTO_A_FACTIBLE);
  const setReglas    = useStore((s) => s.setReglas);
  const setReglasFact = useStore((s) => s.setReglasFact);

  function makeImportar(fn, key, storeFn) {
    return () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".csv,.txt";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const res = await fn(file);
        if (!res.success) { toast.error(`No se pudo importar: ${res.reason}`); return; }
        storeFn(res.reglas);
        toast.success(`${res.reglas.length} reglas importadas.`);
      };
      input.click();
    };
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">REGLAS</h1>
        <p className="page-subtitle">Reglas de negocio y transformaciones de producto.</p>
      </div>

      <div className="page-body">
        <div className="grid-2">
          <RuleCard
            title="PRODUCTO A PRODUCTO COMPLEJO"
            desc="Transformación de referencias simples a productos complejos"
            hasReglas={reglas.length > 0}
            count={reglas.length}
            navTo="/reglas/producto-complejo"
            onExportar={() => { if (!reglas.length) { toast.warning("No hay reglas para exportar."); return; } exportReglasCsv(reglas); }}
            onImportar={makeImportar(autoImportReglas, "PRODUCTO_A_COMPLEJO", (r) => setReglas("PRODUCTO_A_COMPLEJO", r))}
          />
          <RuleCard
            title="ENRUTAMIENTO A FACTIBLE"
            desc="Filtrado de ENRUTAMIENTOS → ENRUTAMIENTOS FACTIBLES por exclusión"
            hasReglas={reglasFact.length > 0}
            count={reglasFact.length}
            navTo="/reglas/enrutamiento-factible"
            onExportar={() => { if (!reglasFact.length) { toast.warning("No hay reglas para exportar."); return; } exportReglasFact(reglasFact); }}
            onImportar={makeImportar(autoImportReglasFact, "ENRUTAMIENTO_A_FACTIBLE", setReglasFact)}
          />
        </div>
      </div>
    </>
  );
}
