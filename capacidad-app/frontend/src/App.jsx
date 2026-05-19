import React, { useEffect, useState } from "react";
import { HashRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import StatusBar from "./components/StatusBar";
import MaestrosPage from "./pages/MaestrosPage";
import CargadorPage from "./pages/CargadorPage";
import ReglasPage from "./pages/ReglasPage";
import ReglasProductoComplejoPage from "./pages/ReglasProductoComplejoPage";
import ReglasEnrutamientoFactiblePage from "./pages/ReglasEnrutamientoFactiblePage";
import CalculosPage from "./pages/CalculosPage";
import ResultadosPage from "./pages/ResultadosPage";
import SetupExtrusorasPage from "./pages/SetupExtrusorasPage";
import IntermediasPage from "./pages/IntermediasPage";
import IntermediasCalculadasPage from "./pages/IntermediasCalculadasPage";
import { loadDirectoryHandle, pickDirectory } from "./services/fileSystemAccess";
import ImportarUltimosPage from "./pages/ImportarUltimosPage";
import VerificacionesPage from "./pages/VerificacionesPage";
import useStore from "./state";

const NAV_ITEMS = [
  {
    to: "/maestros",
    label: "MAESTROS",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: "/verificaciones",
    label: "VERIFICACIONES",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: "/reglas",
    label: "REGLAS",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: "/intermedias",
    label: "INTERMEDIAS BASADO EN REGLAS",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: "/calculos",
    label: "CÁLCULOS",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: "/intermedias-calculadas",
    label: "INTERMEDIAS CALCULADAS",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
      </svg>
    ),
  },
  {
    to: "/setup-extrusoras",
    label: "SETUP EXTRUSORAS",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: "/importar-ultimos",
    label: "IMPORTAR ÚLTIMOS CSV",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: "/resultados",
    label: "RESULTADOS",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
];

function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("rcCapacityTheme") ?? "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("rcCapacityTheme", next);
      return next;
    });
  }

  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "8px 16px",
        background: "none", border: "none", borderTop: "1px solid var(--border)",
        color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
        fontFamily: "var(--font-ui)", letterSpacing: "0.04em",
        transition: "color var(--transition)",
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
      onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
    >
      {isDark
        ? <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14, flexShrink: 0 }}><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
        : <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14, flexShrink: 0 }}><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
      }
      {isDark ? "Modo oscuro" : "Modo claro"}
    </button>
  );
}

function ExportDirIndicator() {
  const dirName = useStore((s) => s.exportDirName);

  return (
    <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
      <div style={{ marginBottom: 4 }}>SPA · Sin servidor · Estado en RAM</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: dirName ? "var(--accent)" : "var(--text-muted)" }}>
          📁 {dirName ?? "Sin carpeta fija"}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 9, padding: "1px 5px", marginLeft: "auto" }}
          onClick={async () => await pickDirectory()}
          title="Seleccionar carpeta de exportación"
        >
          Cambiar
        </button>
      </div>
    </div>
  );
}

function AppInner() {
  const [statusCollapsed, setStatusCollapsed] = useState(false);

  useEffect(() => { loadDirectoryHandle(); }, []);

  return (
    <div className={`app-layout ${statusCollapsed ? "status-collapsed" : ""}`}>
      <nav className="nav-sidebar">
        <div className="nav-logo">
          <img
            src="./logo.png"
            alt="Walki Plasbel"
            className="nav-company-logo"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="nav-logo-text">RCCapacity</div>
          <div className="nav-logo-sub">Planificación de capacidad v2.0</div>
        </div>

        <div className="nav-links">
          <span className="nav-section-label">Navegación</span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>

        <ThemeToggle />
        <ExportDirIndicator />
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/maestros" replace />} />
          <Route path="/maestros" element={<MaestrosPage />} />
          <Route path="/verificaciones" element={<VerificacionesPage />} />
          <Route path="/cargador" element={<CargadorPage />} />
          <Route path="/reglas" element={<ReglasPage />} />
          <Route path="/reglas/producto-complejo" element={<ReglasProductoComplejoPage />} />
          <Route path="/reglas/enrutamiento-factible" element={<ReglasEnrutamientoFactiblePage />} />
          <Route path="/calculos" element={<CalculosPage />} />
          <Route path="/intermedias" element={<IntermediasPage />} />
          <Route path="/intermedias-calculadas" element={<IntermediasCalculadasPage />} />
          <Route path="/importar-ultimos" element={<ImportarUltimosPage />} />
          <Route path="/setup-extrusoras" element={<SetupExtrusorasPage />} />
          <Route path="/resultados" element={<ResultadosPage />} />
        </Routes>
      </main>

      <StatusBar
        collapsed={statusCollapsed}
        onToggle={() => setStatusCollapsed((c) => !c)}
      />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </HashRouter>
  );
}
