import React, { useMemo, useState } from "react";
import useStore from "../state";
import { calcularEnrutamientos, calcularFactibles } from "../services/engine";
import { exportEnrutamientos } from "../services/exporter";
import MasterViewer from "../components/MasterViewer";
import { useToast } from "../components/Toast";
import { schemaDeDefiniciones } from "../utils/enrutamientosSchema";

const SCHEMA_ERRORES = [
  { name: "tipo",        type: "string", label: "TIPO"        },
  { name: "referencia",  type: "string", label: "REFERENCIA"  },
  { name: "descripcion", type: "string", label: "DESCRIPCIÓN" },
];

const SCHEMA_NO_FACTIBLES = [
  { name: "REFERENCIA_COMPLEJA", type: "string", label: "REFERENCIA COMPLEJA" },
  { name: "MEZCLA",              type: "string", label: "MEZCLA"              },
  { name: "EXTRUSORA",           type: "string", label: "EXTRUSORA"           },
  { name: "MOTIVOS",             type: "string", label: "MOTIVOS"             },
];

export default function IntermediasCalculadasPage() {
  const toast = useToast();

  const rows             = useStore((s) => s.intermedias_calculadas.ENRUTAMIENTOS);
  const setEnrutamientos = useStore((s) => s.setEnrutamientos);
  const rowsFactibles    = useStore((s) => s.intermedias_calculadas.ENRUTAMIENTOS_FACTIBLES);
  const setEnrutamientosFactibles = useStore((s) => s.setEnrutamientosFactibles);
  const reglasFact       = useStore((s) => s.reglas.ENRUTAMIENTO_A_FACTIBLE);

  const productoComplejo = useStore((s) => s.intermedias.PRODUCTO_COMPLEJO);
  const producto         = useStore((s) => s.masters.PRODUCTO?.records         ?? []);
  const enrutaMezclas    = useStore((s) => s.masters.ENRUTAMIENTO_MEZCLAS?.records ?? []);
  const setupExtrusoras  = useStore((s) => s.masters.SETUP_EXTRUSORAS?.records  ?? []);
  const definiciones     = useStore((s) => s.calculos.DEFINICIONES);

  const [lastErrors,         setLastErrors]         = useState([]);
  const [calculated,         setCalculated]         = useState(false);
  const [viewing,            setViewing]            = useState(false);
  const [viewingErrors,      setViewingErrors]      = useState(false);
  const [calculatedFact,     setCalculatedFact]     = useState(false);
  const [viewingFactibles,   setViewingFactibles]   = useState(false);
  const [viewingNoFactibles, setViewingNoFactibles] = useState(false);

  const hasRS          = definiciones.some((d) => d.nombre === "RS");
  const hasRENDIMIENTO = definiciones.some((d) => d.nombre === "RENDIMIENTO");
  const hasPrereqs     = hasRS && hasRENDIMIENTO;

  const schema = useMemo(() => schemaDeDefiniciones(definiciones), [definiciones]);

  const schemaFactibles = useMemo(() => [
    ...schema,
    {
      name: "FACTIBLE", label: "FACTIBLE", type: "string",
      valueColors: { SI: "var(--success)", NO: "var(--error)" },
    },
  ], [schema]);

  const extraColumns          = schema.slice(3).map((f) => f.name);
  const extraColumnsFactibles = [...extraColumns, "FACTIBLE"];

  const canCalculate     = hasPrereqs && productoComplejo.length > 0 && enrutaMezclas.length > 0;
  const hasRows          = rows.length > 0;
  const hasRowsFactibles = rowsFactibles.length > 0;
  const canCalculateFact = hasRows;

  const missingDataLabel = [
    !hasPrereqs                   && "Cálculos RS/RENDIMIENTO",
    productoComplejo.length === 0 && "Producto Simple y Doble",
    enrutaMezclas.length === 0    && "Enrutamiento Mezclas",
  ].filter(Boolean).join(", ");

  function handleCalcular() {
    const { rows: newRows, errors } = calcularEnrutamientos({
      productoComplejo,
      producto,
      enrutamientoMezclas: enrutaMezclas,
      setupExtrusoras,
      calculos: definiciones,
    });
    setEnrutamientos(newRows);
    setLastErrors(errors);
    setCalculated(true);
    if (newRows.length > 0) {
      toast.success(`${newRows.length.toLocaleString("es-ES")} combinaciones generadas${errors.length > 0 ? ` · ${errors.length} errores` : ""}.`);
    } else {
      toast.warning(`Sin combinaciones. ${errors.length} errores.`);
    }
  }

  function handleCalcularFactibles() {
    if (!hasRows) { toast.error("Calcula primero ENRUTAMIENTOS."); return; }
    const { factibles } = calcularFactibles({ enrutamientos: rows, reglasFactibilidad: reglasFact, setupExtrusoras });
    setEnrutamientosFactibles(factibles);
    setCalculatedFact(true);
    const noFact = factibles.filter((r) => r.FACTIBLE === "NO").length;
    if (reglasFact.length === 0) {
      toast.info ? toast.info(`${factibles.length} filas · Sin reglas definidas, todas con FACTIBLE = SI.`)
                 : toast.success(`${factibles.length} filas · Sin reglas, todas con FACTIBLE = SI.`);
    } else {
      toast.success(`${factibles.length} filas · ${noFact} marcadas NO FACTIBLE.`);
    }
  }

  const noFactibles = rowsFactibles.filter((r) => r.FACTIBLE === "NO");
  const noFactiblesParaViewer = noFactibles.map((r) => ({
    REFERENCIA_COMPLEJA: r.REFERENCIA_COMPLEJA,
    MEZCLA:              r.MEZCLA,
    EXTRUSORA:           r.EXTRUSORA,
    MOTIVOS:             (r._motivos ?? []).join("; "),
  }));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">INTERMEDIAS CALCULADAS</h1>
        <p className="page-subtitle">Tablas intermedias generadas por cruce de datos.</p>
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ── Card ENRUTAMIENTOS ── */}
        <div
          className="card"
          style={{
            borderColor: calculated && lastErrors.length > 0 ? "var(--card-warning-border)" : hasRows ? "var(--card-success-border)" : "var(--border)",
            background:  calculated && lastErrors.length > 0 ? "var(--card-warning-bg)"   : hasRows ? "var(--card-success-bg)"   : "var(--bg-surface)",
          }}
        >
          <div className="card-header">
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: hasRows ? "var(--text-primary)" : "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>
                ENRUTAMIENTOS
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Cruce PRODUCTO SIMPLE Y DOBLE → MEZCLA → EXTRUSORA × SETUP_EXTRUSORAS
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
              background: calculated && lastErrors.length > 0 ? "rgba(245,158,11,0.12)" : hasRows ? "var(--success-dim)"  : "var(--bg-surface-2)",
              color:      calculated && lastErrors.length > 0 ? "var(--warning)"        : hasRows ? "var(--success)"      : "var(--text-muted)",
              border:     `1px solid ${calculated && lastErrors.length > 0 ? "rgba(245,158,11,0.4)" : hasRows ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
            }}>
              {calculated && lastErrors.length > 0
                ? `ERRORES (${lastErrors.length})`
                : hasRows ? `${rows.length.toLocaleString("es-ES")} filas` : "SIN DATOS"}
            </span>
          </div>

          {!hasPrereqs && (
            <div style={{ fontSize: 12, color: "var(--warning)", marginBottom: 10 }}>
              Para calcular esta tabla debes definir primero los cálculos RS y RENDIMIENTO en CÁLCULOS.
            </div>
          )}
          {hasPrereqs && !canCalculate && (
            <div style={{ fontSize: 12, color: "var(--warning)", marginBottom: 10 }}>
              Faltan datos: {missingDataLabel}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={handleCalcular} disabled={!canCalculate}>
              Calcular
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!hasRows}
              onClick={() => setViewing(true)}
              title={hasRows ? `Ver ${rows.length.toLocaleString("es-ES")} filas` : "Sin datos calculados"}
            >
              Visualizar
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!hasRows}
              onClick={() => exportEnrutamientos(rows, extraColumns)}
              title={hasRows ? "Exportar CSV" : "Sin datos calculados"}
            >
              Exportar CSV
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!calculated || lastErrors.length === 0}
              onClick={() => setViewingErrors(true)}
              title={lastErrors.length > 0 ? `Ver ${lastErrors.length} errores` : "Sin errores"}
            >
              Ver errores
            </button>
          </div>
        </div>

        {/* ── Card ENRUTAMIENTOS FACTIBLES ── */}
        <div
          className="card"
          style={{
            borderColor: hasRowsFactibles ? "var(--card-success-border)" : "var(--border)",
            background:  hasRowsFactibles ? "var(--card-success-bg)"   : "var(--bg-surface)",
          }}
        >
          <div className="card-header">
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: hasRowsFactibles ? "var(--text-primary)" : "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>
                ENRUTAMIENTOS FACTIBLES
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                ENRUTAMIENTOS con campo FACTIBLE (SI / NO) según reglas de exclusión
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: hasRowsFactibles ? "var(--success-dim)" : "var(--bg-surface-2)", color: hasRowsFactibles ? "var(--success)" : "var(--text-muted)", border: `1px solid ${hasRowsFactibles ? "rgba(16,185,129,0.3)" : "var(--border)"}` }}>
              {hasRowsFactibles ? `${rowsFactibles.length.toLocaleString("es-ES")} filas` : "SIN DATOS"}
            </span>
          </div>

          {!hasRows && (
            <div style={{ fontSize: 12, color: "var(--warning)", marginBottom: 10 }}>
              Calcula primero la tabla ENRUTAMIENTOS.
            </div>
          )}
          {hasRows && reglasFact.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              Sin reglas ENRUTAMIENTO_A_FACTIBLE — todas las filas saldrán con FACTIBLE = SI.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={handleCalcularFactibles} disabled={!canCalculateFact}>
              Calcular
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!hasRowsFactibles}
              onClick={() => setViewingFactibles(true)}
              title={hasRowsFactibles ? `Ver ${rowsFactibles.length.toLocaleString("es-ES")} filas` : "Sin datos calculados"}
            >
              Visualizar
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!hasRowsFactibles}
              onClick={() => exportEnrutamientos(rowsFactibles, extraColumnsFactibles)}
              title={hasRowsFactibles ? "Exportar CSV" : "Sin datos calculados"}
            >
              Exportar CSV
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!calculatedFact || noFactibles.length === 0}
              onClick={() => setViewingNoFactibles(true)}
              title={noFactibles.length > 0 ? `Ver ${noFactibles.length} filas excluidas` : "Sin filas excluidas"}
            >
              Ver errores
            </button>
          </div>
        </div>
      </div>

      {/* ── MasterViewer ENRUTAMIENTOS ── */}
      {viewing && (
        <MasterViewer
          masterName="ENRUTAMIENTOS"
          records={rows}
          schema={schema}
          onExport={() => exportEnrutamientos(rows, extraColumns)}
          onClose={() => setViewing(false)}
        />
      )}

      {/* ── MasterViewer ENRUTAMIENTOS FACTIBLES ── */}
      {viewingFactibles && (
        <MasterViewer
          masterName="ENRUTAMIENTOS FACTIBLES"
          records={rowsFactibles}
          schema={schemaFactibles}
          onExport={() => exportEnrutamientos(rowsFactibles, extraColumnsFactibles)}
          onClose={() => setViewingFactibles(false)}
          collapsibleGroup={{ field: "FACTIBLE", value: "NO", label: "filas no factibles" }}
        />
      )}

      {/* ── MasterViewer errores ENRUTAMIENTOS ── */}
      {viewingErrors && (
        <MasterViewer
          masterName="ERRORES · ENRUTAMIENTOS"
          records={lastErrors}
          schema={SCHEMA_ERRORES}
          onClose={() => setViewingErrors(false)}
        />
      )}

      {/* ── MasterViewer filas NO FACTIBLES ── */}
      {viewingNoFactibles && (
        <MasterViewer
          masterName="EXCLUIDAS · ENRUTAMIENTOS FACTIBLES"
          records={noFactiblesParaViewer}
          schema={SCHEMA_NO_FACTIBLES}
          onClose={() => setViewingNoFactibles(false)}
        />
      )}
    </>
  );
}
