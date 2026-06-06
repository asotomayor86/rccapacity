import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import MdRenderer from "./ayuda/mdRenderer";
import flujoMd from "./ayuda/contenido/flujo.md?raw";
import maestrosMd from "./ayuda/contenido/maestros.md?raw";

const SECCIONES = [
  {
    id: "flujo",
    titulo: "Flujo de trabajo",
    descripcion: "Orden canónico de los 8 pasos y dependencias entre ellos.",
    md: flujoMd,
    icono: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="ayuda-card-icon">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: "maestros",
    titulo: "Maestros",
    descripcion: "Las 7 fuentes de datos: columnas, tipos, cruces y obligatoriedad.",
    md: maestrosMd,
    icono: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="ayuda-card-icon">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export function AyudaIndicePage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">AYUDA</h1>
        <p className="page-subtitle">
          Documentación de RCCapacity. Selecciona una sección para empezar.
        </p>
      </div>

      <div className="page-body">
        <div className="ayuda-cards">
          {SECCIONES.map((s) => (
            <Link key={s.id} to={`/ayuda/${s.id}`} className="ayuda-card">
              <div className="ayuda-card-icon-wrap">{s.icono}</div>
              <div className="ayuda-card-body">
                <div className="ayuda-card-titulo">{s.titulo}</div>
                <div className="ayuda-card-desc">{s.descripcion}</div>
              </div>
              <span className="ayuda-card-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export function AyudaSeccionPage() {
  const { seccion } = useParams();
  const navigate = useNavigate();
  const def = SECCIONES.find((s) => s.id === seccion);

  if (!def) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">AYUDA</h1>
          <p className="page-subtitle">Sección no encontrada.</p>
        </div>
        <div className="page-body">
          <Link to="/ayuda" className="btn btn-secondary">← Volver a Ayuda</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="ayuda-page-back-row">
          <button
            type="button"
            className="ayuda-back-btn"
            onClick={() => navigate("/ayuda")}
            title="Volver al índice de ayuda"
          >
            ← Ayuda
          </button>
        </div>
        <h1 className="page-title">{def.titulo}</h1>
        <p className="page-subtitle">{def.descripcion}</p>
      </div>

      <div className="page-body">
        <article className="ayuda-articulo">
          <MdRenderer source={def.md} />
        </article>
      </div>
    </>
  );
}
