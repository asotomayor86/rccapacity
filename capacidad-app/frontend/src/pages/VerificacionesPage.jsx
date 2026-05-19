import React, { useState } from "react";
import useStore from "../state";
import MasterViewer from "../components/MasterViewer";
import { useToast } from "../components/Toast";
import {
  verificarRefsDemandaNoEnProducto,
  verificarRefsSinMezcla,
  verificarMezclaSinEnrutamiento,
} from "../services/verificaciones";

const SCHEMA_REF = [{ name: "REFERENCIA", type: "string" }];
const SCHEMA_REF_MEZCLA = [
  { name: "REFERENCIA", type: "string" },
  { name: "MEZCLA",     type: "string" },
];

// null = sin calcular | [] = OK (0 alertas) | [...] = alertas
function badgeProps(result) {
  if (result === null) {
    return { label: "SIN DATOS", bg: "var(--bg-surface-2)", color: "var(--text-muted)", border: "var(--border)" };
  }
  if (result.length === 0) {
    return { label: "OK", bg: "var(--success-dim)", color: "var(--success)", border: "rgba(16,185,129,0.3)" };
  }
  return {
    label: `ALERTAS (${result.length})`,
    bg: "rgba(245,158,11,0.12)",
    color: "var(--warning)",
    border: "rgba(245,158,11,0.4)",
  };
}

function cardStyle(result) {
  if (result === null) return { borderColor: "var(--border)", background: "var(--bg-surface)" };
  if (result.length === 0) return { borderColor: "rgba(16,185,129,0.25)", background: "#0d1f17" };
  return { borderColor: "rgba(245,158,11,0.3)", background: "#1c1500" };
}

function VerifCard({ title, desc, requiredMasters, result, onCalcular, onVisualizar }) {
  const allLoaded = requiredMasters.every((m) => m.loaded);
  const badge = badgeProps(result);
  const cs    = cardStyle(result);
  const calculated = result !== null;

  return (
    <div className="card" style={cs}>
      <div className="card-header">
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: calculated ? "var(--text-primary)" : "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, whiteSpace: "nowrap" }}>
          {badge.label}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
        {requiredMasters.map((m) => (
          <span
            key={m.name}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 7px", borderRadius: 4,
              background: m.loaded ? "var(--success-dim)" : "var(--bg-surface-2)",
              color:      m.loaded ? "var(--success)"    : "var(--text-muted)",
              border:     `1px solid ${m.loaded ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
            }}
          >
            {m.name}
          </span>
        ))}
      </div>

      {calculated && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 14, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
          <span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: result.length > 0 ? "var(--warning)" : "var(--success)", marginRight: 6 }}>
              {result.length.toLocaleString("es-ES")}
            </span>
            {result.length === 1 ? "referencia con problema" : result.length === 0 ? "referencias — todo OK" : "referencias con problemas"}
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={onCalcular}
          disabled={!allLoaded}
          title={allLoaded ? "Ejecutar verificación" : "Faltan maestros requeridos"}
        >
          Verificar
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={!result || result.length === 0}
          onClick={onVisualizar}
          title={result?.length > 0 ? `Ver ${result.length} referencias` : "Sin alertas que mostrar"}
        >
          Ver alertas
        </button>
      </div>
    </div>
  );
}

const VIEWER_CONFIG = {
  V1: { masterName: "REFS EN DEMANDA SIN PRODUCTO",  schema: SCHEMA_REF },
  V2: { masterName: "REFS CON DEMANDA SIN MEZCLA EN PRODUCTO", schema: SCHEMA_REF },
  V3: { masterName: "REFS SIN ENRUTAMIENTO",          schema: SCHEMA_REF_MEZCLA },
};

export default function VerificacionesPage() {
  const toast = useToast();

  const demanda      = useStore((s) => s.masters.DEMANDA?.records              ?? []);
  const producto     = useStore((s) => s.masters.PRODUCTO?.records             ?? []);
  const enrutamiento = useStore((s) => s.masters.ENRUTAMIENTO_MEZCLAS?.records ?? []);
  const verificaciones  = useStore((s) => s.verificaciones);
  const setVerificacion = useStore((s) => s.setVerificacion);

  const [viewing, setViewing] = useState(null); // "V1" | "V2" | "V3" | null

  const demandaLoaded  = demanda.length > 0;
  const productoLoaded = producto.length > 0;
  const enrutLoaded    = enrutamiento.length > 0;

  const v1 = verificaciones.REFS_SIN_PRODUCTO;
  const v2 = verificaciones.REFS_SIN_MEZCLA;
  const v3 = verificaciones.REFS_SIN_ENRUTAMIENTO;

  function calcV1() {
    const r = verificarRefsDemandaNoEnProducto(demanda, producto);
    setVerificacion("REFS_SIN_PRODUCTO", r);
    toast[r.length > 0 ? "warning" : "success"](
      r.length > 0
        ? `${r.length} referencia(s) en Demanda no encontradas en Producto.`
        : "Todas las referencias de Demanda están en Producto."
    );
  }

  function calcV2() {
    const r = verificarRefsSinMezcla(demanda, producto);
    setVerificacion("REFS_SIN_MEZCLA", r);
    toast[r.length > 0 ? "warning" : "success"](
      r.length > 0
        ? `${r.length} referencia(s) sin mezcla asignada en Producto.`
        : "Todas las referencias tienen mezcla asignada en Producto."
    );
  }

  function calcV3() {
    const r = verificarMezclaSinEnrutamiento(demanda, producto, enrutamiento);
    setVerificacion("REFS_SIN_ENRUTAMIENTO", r);
    toast[r.length > 0 ? "warning" : "success"](
      r.length > 0
        ? `${r.length} referencia(s) cuya mezcla no tiene cobertura en Enrutamiento Mezclas.`
        : "Todas las mezclas tienen cobertura en Enrutamiento Mezclas."
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">VERIFICACIONES</h1>
        <p className="page-subtitle">
          Cruces entre maestros para detectar inconsistencias antes de ejecutar el cálculo. Resuelve en orden: V1 → V2 → V3.
        </p>
      </div>

      <div className="page-body">
        <div className="grid-2">
          <VerifCard
            title="V1 · REFERENCIAS EN DEMANDA SIN PRODUCTO"
            desc="Bobinas en Demanda que no tienen ficha en el catálogo de Producto"
            requiredMasters={[
              { name: "DEMANDA",  loaded: demandaLoaded },
              { name: "PRODUCTO", loaded: productoLoaded },
            ]}
            result={v1}
            onCalcular={calcV1}
            onVisualizar={() => setViewing("V1")}
          />

          <VerifCard
            title="V2 · REFERENCIAS CON DEMANDA SIN MEZCLA EN PRODUCTO"
            desc="Bobinas con demanda cuya ficha en Producto no tiene mezcla asignada"
            requiredMasters={[
              { name: "DEMANDA",  loaded: demandaLoaded },
              { name: "PRODUCTO", loaded: productoLoaded },
            ]}
            result={v2}
            onCalcular={calcV2}
            onVisualizar={() => setViewing("V2")}
          />

          <VerifCard
            title="V3 · REFERENCIAS SIN ENRUTAMIENTO"
            desc="Bobinas en Demanda cuya mezcla (vía Producto) no aparece en Enrutamiento Mezclas"
            requiredMasters={[
              { name: "DEMANDA",              loaded: demandaLoaded  },
              { name: "PRODUCTO",             loaded: productoLoaded },
              { name: "ENRUTAMIENTO MEZCLAS", loaded: enrutLoaded    },
            ]}
            result={v3}
            onCalcular={calcV3}
            onVisualizar={() => setViewing("V3")}
          />
        </div>
      </div>

      {viewing && (
        <MasterViewer
          masterName={VIEWER_CONFIG[viewing].masterName}
          records={verificaciones[viewing === "V1" ? "REFS_SIN_PRODUCTO" : viewing === "V2" ? "REFS_SIN_MEZCLA" : "REFS_SIN_ENRUTAMIENTO"] ?? []}
          schema={VIEWER_CONFIG[viewing].schema}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
