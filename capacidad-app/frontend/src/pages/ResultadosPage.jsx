import React, { useState } from "react";
import { useToast } from "../components/Toast";
import { calcularEscenario0 } from "../services/escenario0";
import useStore from "../state";

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtH(v)    { return v != null ? Number(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }
function fmtKg(v)   { return v != null ? Number(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }
function fmtPct(v)  { return v != null ? `${(Number(v) * 100).toFixed(1)} %` : "—"; }
function fmtPct1(v) { return v != null ? `${Number(v).toFixed(1)} %` : "—"; }

function ocupColor(v) {
  if (v == null) return "var(--text-muted)";
  if (v > 1)    return "var(--error)";
  if (v > 0.85) return "var(--warning)";
  return "var(--success)";
}

// ── Progress Bar ───────────────────────────────────────────────────────────────

function ProgressBar({ progress, message }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
        <span>{message}</span>
        <span>{Math.round(progress)} %</span>
      </div>
      <div style={{ background: "var(--bg-surface-2)", borderRadius: 4, overflow: "hidden", height: 6 }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", transition: "width 0.25s ease", borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ── CM Summary Table ───────────────────────────────────────────────────────────

function CmSummaryTable({ rows }) {
  const [sort, setSort] = useState({ col: "OCUPACION", dir: "desc" });

  const sorted = [...rows].sort((a, b) => {
    const v = sort.dir === "asc" ? 1 : -1;
    return (a[sort.col] > b[sort.col] ? 1 : -1) * v;
  });

  function th(col, label) {
    const active = sort.col === col;
    return (
      <th
        style={{ cursor: "pointer", userSelect: "none", color: active ? "var(--accent)" : undefined }}
        onClick={() => setSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }))}
      >
        {label} {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
      </th>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table" style={{ width: "100%" }}>
        <thead>
          <tr>
            {th("CM",                "CM")}
            {th("HORAS_DISPONIBLES", "HORAS DISPONIBLES")}
            {th("HORAS_CARGADAS",   "HORAS CARGADAS")}
            {th("OCUPACION",        "OCUPACIÓN")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.CM}>
              <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{row.CM}</td>
              <td style={{ textAlign: "right" }}>{fmtH(row.HORAS_DISPONIBLES)}</td>
              <td style={{ textAlign: "right" }}>{fmtH(row.HORAS_CARGADAS)}</td>
              <td style={{ textAlign: "right", fontWeight: 700, color: ocupColor(row.OCUPACION), fontFamily: "var(--font-mono)" }}>
                {fmtPct(row.OCUPACION)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Reference Detail Table ─────────────────────────────────────────────────────

const DETAIL_COLS = [
  { key: "REFERENCIA",       label: "REFERENCIA",        align: "left" },
  { key: "VARIANTE",         label: "VARIANTE",          align: "center" },
  { key: "CM",               label: "CM",                align: "left" },
  { key: "KG_DEMANDA_ANUAL", label: "KG DEMANDA ANUAL",  align: "right", fmt: fmtKg },
  { key: "KG_ASIGNADOS",     label: "KG ASIGNADOS",      align: "right", fmt: fmtKg },
  { key: "PCT_ASIGNADO",     label: "% ASIGNADO",        align: "right", fmt: fmtPct1 },
  { key: "RENDIMIENTO_KGH",  label: "REND. (KG/H)",      align: "right", fmt: fmtH },
  { key: "HORAS_REQUERIDAS", label: "HORAS REQUERIDAS",  align: "right", fmt: fmtH },
  { key: "OCUPACION_CM",     label: "OCUP. CM",          align: "right" },
];

const PAGE_SIZE = 100;

function RefDetailTable({ rows }) {
  const [sort,   setSort]   = useState({ col: "HORAS_REQUERIDAS", dir: "desc" });
  const [filter, setFilter] = useState("");
  const [page,   setPage]   = useState(0);

  const filtered = filter.trim()
    ? rows.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(filter.toLowerCase()))
      )
    : rows;

  const sorted = [...filtered].sort((a, b) => {
    const v = sort.dir === "asc" ? 1 : -1;
    const av = a[sort.col], bv = b[sort.col];
    return (av > bv ? 1 : av < bv ? -1 : 0) * v;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageRows   = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function toggleSort(col) {
    setSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));
    setPage(0);
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <input
          className="form-control"
          placeholder="Filtrar por referencia, CM, variante..."
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(0); }}
          style={{ maxWidth: 340, fontSize: 12 }}
        />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              {DETAIL_COLS.map(({ key, label }) => {
                const active = sort.col === key;
                return (
                  <th
                    key={key}
                    style={{ cursor: "pointer", userSelect: "none", color: active ? "var(--accent)" : undefined }}
                    onClick={() => toggleSort(key)}
                  >
                    {label} {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={DETAIL_COLS.length} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px 0" }}>Sin registros</td></tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={i}>
                  {DETAIL_COLS.map(({ key, align, fmt }) => {
                    if (key === "OCUPACION_CM") {
                      return (
                        <td key={key} style={{ textAlign: "right", fontWeight: 700, color: ocupColor(row[key]), fontFamily: "var(--font-mono)" }}>
                          {fmtPct(row[key])}
                        </td>
                      );
                    }
                    if (key === "VARIANTE") {
                      const isDoble = row[key] === "Doble";
                      return (
                        <td key={key} style={{ textAlign: "center" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isDoble ? "var(--accent-dim)" : "var(--bg-surface-2)", color: isDoble ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${isDoble ? "var(--border-accent)" : "var(--border)"}` }}>
                            {row[key]}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={key} style={{ textAlign: align }}>
                        {fmt ? fmt(row[key]) : String(row[key] ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary btn-sm" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>← Anterior</button>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {safePage + 1} / {totalPages} · {sorted.length.toLocaleString("es-ES")} filas
          </span>
          <button className="btn btn-secondary btn-sm" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ResultadosPage() {
  const toast = useToast();

  const masters             = useStore((s) => s.masters);
  const enrutFactibles      = useStore((s) => s.intermedias_calculadas.ENRUTAMIENTOS_FACTIBLES);
  const escenario0          = useStore((s) => s.escenario0);
  const setEscenario0Store  = useStore((s) => s.setEscenario0);

  const [running,  setRunning]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [progMsg,  setProgMsg]  = useState("");
  const [activeTab, setActiveTab] = useState("cm"); // "cm" | "refs"

  const demanda    = masters.DEMANDA?.records    ?? [];
  const calendario = masters.CALENDARIO?.records ?? [];

  const canRun = demanda.length > 0 && calendario.length > 0 && enrutFactibles.length > 0;

  const missingLabel = [
    demanda.length === 0         && "DEMANDA",
    calendario.length === 0      && "CALENDARIO",
    enrutFactibles.length === 0  && "ENRUTAMIENTOS FACTIBLES",
  ].filter(Boolean).join(", ");

  async function handleEscenario0() {
    if (!canRun) return;
    setRunning(true);
    setProgress(0);
    setProgMsg("Iniciando...");
    try {
      const result = await calcularEscenario0({
        enrutamientosFactibles: enrutFactibles,
        demanda,
        calendario,
        onProgress: (pct, msg) => { setProgress(pct); setProgMsg(msg); },
      });
      setEscenario0Store(result);
      if (result.warnings.length > 0) {
        result.warnings.forEach((w) => toast.warning(w));
      }
      toast.success(
        `Escenario 0 calculado — Pico: ${(result.maxOcupacion * 100).toFixed(1)} % · ` +
        `Carga total: ${((result.totalHorasCargadas / result.totalHorasDisponibles) * 100).toFixed(1)} %`
      );
    } catch (err) {
      toast.error(`Error en el cálculo: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  const e0 = escenario0;
  const hasResults = e0.calculated_at != null;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">RESULTADOS</h1>
        <p className="page-subtitle">
          Escenarios de cálculo de capacidad productiva.
        </p>
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Card Escenario 0 ── */}
        <div className="card" style={{
          borderColor: hasResults ? "var(--card-success-border)" : "var(--border)",
          background:  hasResults ? "var(--card-success-bg)"     : "var(--bg-surface)",
        }}>
          <div className="card-header">
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: hasResults ? "var(--text-primary)" : "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>
                ESCENARIO 0 — ROUGH CUT CAPACITY ANUAL
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Asignación óptima de demanda anual a CMs minimizando la ocupación pico
              </div>
            </div>
            {hasResults && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: e0.maxOcupacion > 1 ? "rgba(245,158,11,0.12)" : "var(--success-dim)", color: e0.maxOcupacion > 1 ? "var(--warning)" : "var(--success)", border: `1px solid ${e0.maxOcupacion > 1 ? "rgba(245,158,11,0.4)" : "rgba(16,185,129,0.3)"}`, whiteSpace: "nowrap" }}>
                Pico {(e0.maxOcupacion * 100).toFixed(1)} %
              </span>
            )}
          </div>

          {!canRun && (
            <div style={{ fontSize: 12, color: "var(--warning)", marginBottom: 12 }}>
              Faltan datos requeridos: {missingLabel}. Calcula primero los Enrutamientos Factibles.
            </div>
          )}

          {hasResults && !running && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
              {[
                { label: "Ocupación pico",  val: fmtPct(e0.maxOcupacion),         color: ocupColor(e0.maxOcupacion) },
                { label: "Horas disponibles", val: fmtH(e0.totalHorasDisponibles), color: "var(--text-primary)" },
                { label: "Horas cargadas",   val: fmtH(e0.totalHorasCargadas),    color: "var(--accent)" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color, marginBottom: 2 }}>{val}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {running && <ProgressBar progress={progress} message={progMsg} />}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleEscenario0}
              disabled={!canRun || running}
              title={canRun ? "Ejecutar optimización Escenario 0" : `Faltan: ${missingLabel}`}
            >
              {running ? "Calculando..." : hasResults ? "Recalcular" : "Calcular Escenario 0"}
            </button>
          </div>
        </div>

        {/* ── Resultados Escenario 0 ── */}
        {hasResults && !running && (
          <div className="card">
            {/* Warnings */}
            {e0.warnings?.length > 0 && (
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                {e0.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
              {[
                { id: "cm",   label: `Resumen por CM (${e0.cmSummary.length})` },
                { id: "refs", label: `Detalle por referencia (${e0.refDetail.length})` },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "8px 16px", fontSize: 12, fontWeight: 600,
                    color: activeTab === id ? "var(--accent)" : "var(--text-muted)",
                    borderBottom: activeTab === id ? "2px solid var(--accent)" : "2px solid transparent",
                    marginBottom: -1, transition: "color var(--transition)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "cm"   && <CmSummaryTable rows={e0.cmSummary} />}
            {activeTab === "refs" && <RefDetailTable rows={e0.refDetail} />}
          </div>
        )}
      </div>
    </>
  );
}
