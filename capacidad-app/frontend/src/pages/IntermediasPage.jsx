import React, { useState } from "react";
import useStore from "../state";
import MasterViewer from "../components/MasterViewer";
import { calcularProductoComplejo } from "../services/intermedias";
import { exportMasterCsv } from "../services/exporter";
import { useToast } from "../components/Toast";

export default function IntermediasPage() {
  const toast = useToast();
  const productoRecords = useStore((s) => s.masters.PRODUCTO?.records ?? []);
  const productoComplejo = useStore((s) => s.intermedias.PRODUCTO_COMPLEJO);
  const setIntermedia = useStore((s) => s.setIntermedia);
  const reglas = useStore((s) => s.reglas.PRODUCTO_A_COMPLEJO);

  const [viewing, setViewing] = useState(false);

  const productoLoaded = productoRecords.length > 0;
  const calculado = productoComplejo.length > 0;

  function handleCalcular() {
    if (!productoLoaded) {
      toast.error("Carga primero el maestro PRODUCTO.");
      return;
    }
    const result = calcularProductoComplejo(productoRecords, reglas);
    setIntermedia("PRODUCTO_COMPLEJO", result);
    toast.success(`Producto Complejo calculado: ${result.length} registros.`);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">INTERMEDIAS BASADO EN REGLAS</h1>
        <p className="page-subtitle">
          Tablas calculadas a partir de los maestros. Se recalculan pulsando el botón correspondiente.
        </p>
      </div>

      <div className="page-body">
        <div className="grid-2">
          {/* ── PRODUCTO COMPLEJO ── */}
          <div
            className="card"
            style={{
              borderColor: calculado ? "rgba(16,185,129,0.25)" : "var(--border)",
              background: calculado ? "#0d1f17" : "var(--bg-surface)",
            }}
          >
            <div className="card-header">
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: calculado ? "var(--text-primary)" : "var(--text-muted)",
                    letterSpacing: "0.06em",
                    marginBottom: 2,
                  }}
                >
                  PRODUCTO COMPLEJO
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Referencias en versión Simple y Doble generadas desde PRODUCTO
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: calculado ? "var(--success-dim)" : "var(--bg-surface-2)",
                  color: calculado ? "var(--success)" : "var(--text-muted)",
                  border: `1px solid ${calculado ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                }}
              >
                {calculado ? "CALCULADO" : "SIN DATOS"}
              </span>
            </div>

            {calculado && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: 14,
                  padding: "8px 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--accent)",
                      marginRight: 6,
                    }}
                  >
                    {productoComplejo.length.toLocaleString("es-ES")}
                  </span>
                  registros
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCalcular}
                disabled={!productoLoaded}
                title={productoLoaded ? "Calcular Producto Complejo" : "Carga primero el maestro PRODUCTO"}
              >
                Calcular
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={!calculado}
                onClick={() => setViewing(true)}
                title={calculado ? `Ver ${productoComplejo.length} registros` : "Sin datos calculados"}
              >
                Visualizar
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={!calculado}
                onClick={() => exportMasterCsv("PRODUCTO_COMPLEJO", productoComplejo)}
                title={calculado ? "Exportar CSV" : "Sin datos calculados"}
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewing && (
        <MasterViewer
          masterName="PRODUCTO_COMPLEJO"
          records={productoComplejo}
          onClose={() => setViewing(false)}
        />
      )}
    </>
  );
}
