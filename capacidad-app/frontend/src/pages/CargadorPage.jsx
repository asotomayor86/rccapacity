import React, { useCallback, useRef, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../components/Toast";
import ColumnMapper from "../components/ColumnMapper";
import FilterBuilder from "../components/FilterBuilder";
import DataPreview from "../components/DataPreview";
import ValidationReport from "../components/ValidationReport";
import { MASTER_SCHEMAS_META } from "../masterSchemas";
import { parseCsvFile, applyMappingAndValidate } from "../services/csvParser";
import useStore from "../state";

const MASTERS = ["DEMANDA", "PRODUCTO", "ENRUTAMIENTO_MEZCLAS", "CALENDARIO", "SETUP_EXTRUSORAS", "MEZCLAS"];

// Display labels for master selectors and UI text (internal keys use underscores)
const MASTER_LABELS = {
  DEMANDA: "DEMANDA",
  PRODUCTO: "PRODUCTO",
  ENRUTAMIENTO_MEZCLAS: "ENRUTAMIENTO MEZCLAS",
  CALENDARIO: "CALENDARIO",
  SETUP_EXTRUSORAS: "SETUP EXTRUSORAS",
  MEZCLAS: "MEZCLAS",
};

const STEPS = [
  { n: 1, label: "Selección y subida" },
  { n: 2, label: "Mapeo y filtros" },
  { n: 3, label: "Validación" },
  { n: 4, label: "Importado" },
];

export default function CargadorPage() {
  const [params] = useSearchParams();
  const toast = useToast();
  const fileRef = useRef();

  const [step, setStep] = useState(1);
  const [master, setMaster] = useState(params.get("maestro") || "DEMANDA");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [filters, setFilters] = useState([]);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const importMaster = useStore((s) => s.importMaster);
  const setSetupExtrusorasRevision = useStore((s) => s.setSetupExtrusorasRevision);
  const uploads = useStore((s) => s.uploads);
  const schema = MASTER_SCHEMAS_META[master] || [];

  function reset() {
    setStep(1);
    setUploadData(null);
    setMapping({});
    setFilters([]);
    setValidationResult(null);
    setImportResult(null);
  }

  useEffect(() => { reset(); }, [master]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    try {
      const data = await parseCsvFile(file);
      setUploadData(data);
      setMapping({});
      setFilters([]);
      setValidationResult(null);
      setStep(2);
      toast.success(`CSV cargado: ${data.row_count} filas, ${data.columns.length} columnas`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  const handleDrop = useCallback(
    (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); },
    [master] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function handleValidate() {
    setValidating(true);
    setValidationResult(null);
    try {
      const upload = uploads[uploadData.uploadId];
      if (!upload) throw new Error("Datos de upload no encontrados. Vuelve a subir el archivo.");
      const result = applyMappingAndValidate(upload.raw, filters.map(({ _id, ...r }) => r), mapping, master);
      setValidationResult(result);
      setStep(3);
      if (result.error_count === 0) {
        toast.success("Validación exitosa — todas las filas son válidas");
      } else {
        toast.warning(`${result.error_count} filas con errores (${result.success_pct}% de éxito)`);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setValidating(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const upload = uploads[uploadData.uploadId];
      if (!upload) throw new Error("Datos de upload no encontrados. Vuelve a subir el archivo.");
      const result = applyMappingAndValidate(upload.raw, filters.map(({ _id, ...r }) => r), mapping, master);

      // For SETUP_EXTRUSORAS: extract _META_ meta and validate ES_ACTUAL per group
      if (master === "SETUP_EXTRUSORAS") {
        const firstRaw = upload.raw?.[0];
        const fechaRevision = firstRaw?.["_META_FECHA_REVISION"] ?? null;
        if (fechaRevision) setSetupExtrusorasRevision(String(fechaRevision).trim());

        // Check ES_ACTUAL per NOMBRE_EXTRUSORA group
        const grupos = {};
        for (const r of result.validRows) {
          const n = r.NOMBRE_EXTRUSORA ?? "(sin nombre)";
          grupos[n] = (grupos[n] ?? []);
          grupos[n].push(r);
        }
        for (const [nombre, rows] of Object.entries(grupos)) {
          const actualCount = rows.filter((r) => r.ES_ACTUAL === true).length;
          if (actualCount === 0)
            toast.warning(`⚠ Extrusora "${nombre}": ninguna config marcada como actual.`);
          else if (actualCount > 1)
            toast.warning(`⚠ Extrusora "${nombre}": ${actualCount} configs como actual — se conservará solo la primera.`);
        }
      }

      importMaster(master, result.validRows);
      setImportResult({ imported_count: result.valid_count, error_count: result.error_count });
      setStep(4);
      toast.success(`✓ ${result.valid_count} registros importados en ${MASTER_LABELS[master] ?? master}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  }

  const requiredMapped = schema.filter((f) => f.required).every((f) => mapping[f.name]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Cargador de CSV</h1>
        <p className="page-subtitle">
          Sube un archivo CSV, mapea columnas, añade filtros e importa al maestro seleccionado.
        </p>
      </div>

      <div className="page-body">
        <div className="steps">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className={`step ${step === s.n ? "active" : step > s.n ? "done" : ""}`} style={{ flex: "none" }}>
                <div className="step-bubble">{step > s.n ? "✓" : s.n}</div>
                <span className="step-label">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="step-connector" />}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Selecciona el maestro</span></div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {MASTERS.map((m) => (
                  <button key={m} className={`btn ${master === m ? "btn-primary" : "btn-secondary"}`} onClick={() => setMaster(m)}>{MASTER_LABELS[m] ?? m}</button>
                ))}
              </div>
              {schema.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {schema.map((f) => (
                    <span key={f.name} style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 8px", borderRadius: 4, background: f.required ? "var(--accent-dim)" : "var(--bg-surface-2)", color: f.required ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${f.required ? "var(--border-accent)" : "var(--border)"}` }}>
                      {f.name}{f.required ? " *" : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Subir archivo CSV</span></div>
              <div
                className={`upload-zone ${dragOver ? "drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="upload-zone-icon">⬆</div>
                <div className="upload-zone-text">{uploading ? "Procesando…" : "Arrastra un CSV aquí o haz clic para seleccionar"}</div>
                <div className="upload-zone-hint">CSV con separador coma, punto y coma, tabulador o pipe. UTF-8 o Latin-1.</div>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              </div>
              {uploading && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="spinner" />
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Parseando CSV…</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2 + 3 ── */}
        {step >= 2 && uploadData && step < 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13 }}>
              <span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 700, marginRight: 6 }}>{MASTER_LABELS[master] ?? master}</span>
                <span style={{ color: "var(--text-muted)" }}>· {uploadData.row_count?.toLocaleString("es-ES")} filas · {uploadData.columns.length} columnas</span>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={reset}>← Cambiar archivo</button>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Preview del CSV original</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>primeras filas</span>
              </div>
              <DataPreview columns={uploadData.columns} rows={uploadData.preview} />
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Mapeo de columnas</span></div>
              <ColumnMapper schema={schema} rawColumns={uploadData.columns} mapping={mapping} onChange={setMapping} />
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Filtros</span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {filters.length > 0 ? `${filters.length} activos` : "ninguno"}
                </span>
              </div>
              <FilterBuilder rawColumns={uploadData.columns} schema={schema} mapping={mapping} filters={filters} onChange={setFilters} />
            </div>

            {step === 3 && validationResult && (
              <div className="card">
                <div className="card-header"><span className="card-title">Resultado de validación</span></div>
                <ValidationReport report={validationResult} />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {step === 2 && (
                <button className="btn btn-primary" onClick={handleValidate} disabled={validating || !requiredMapped}>
                  {validating ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Validando…</> : "Validar datos"}
                </button>
              )}
              {step === 3 && (
                <>
                  <button className="btn btn-secondary" onClick={handleValidate} disabled={validating}>Re-validar</button>
                  <button className="btn btn-primary" onClick={handleImport} disabled={importing || !validationResult || validationResult.valid_count === 0}>
                    {importing ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Importando…</> : `Importar ${validationResult?.valid_count?.toLocaleString("es-ES") ?? ""} registros`}
                  </button>
                </>
              )}
              {!requiredMapped && <span style={{ fontSize: 12, color: "var(--error)" }}>Faltan campos obligatorios por mapear</span>}
            </div>
          </div>
        )}

        {/* ── STEP 4 ── */}
        {step === 4 && importResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
            <div className="alert alert-success">
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>✓ Importación completada</div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--success)", marginRight: 6 }}>
                    {importResult.imported_count?.toLocaleString("es-ES")}
                  </span>
                  registros importados en <strong>{MASTER_LABELS[master] ?? master}</strong>.
                  {importResult.error_count > 0 && <span style={{ color: "var(--warning)", marginLeft: 8 }}>{importResult.error_count} filas omitidas por errores.</span>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={reset}>Cargar otro maestro</button>
              <button className="btn btn-secondary" onClick={() => { setMaster(MASTERS[(MASTERS.indexOf(master) + 1) % MASTERS.length]); reset(); }}>
                Siguiente maestro
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
