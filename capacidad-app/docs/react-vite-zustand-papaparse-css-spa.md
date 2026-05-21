# Stack Técnico — React + Vite + Zustand + PapaParse + CSS puro (SPA file://)

> **Instrucciones de uso**: Pasa este documento al inicio de cualquier nueva sesión de Claude Code en la que quieras construir una aplicación con este stack exacto. Indica los requisitos funcionales de tu nueva herramienta y Claude replicará la arquitectura, estructura de ficheros y convenciones aquí descritas.

---

## Resumen ejecutivo

Este stack produce una **SPA (Single Page Application) completamente autocontenida** que se distribuye como uno o dos ficheros estáticos y se abre directamente en cualquier navegador moderno haciendo doble clic, sin instalar nada, sin servidor, sin conexión a internet.

| Característica | Valor |
|---|---|
| Tipo de aplicación | SPA client-side, sin backend |
| Distribución | 2 ficheros: `index.html` + `estilos.css` |
| Instalación en el cliente | Ninguna — doble clic y funciona |
| Protocolo | Compatible con `file://` y `http://` |
| Persistencia de datos | Solo en RAM (se pierde al cerrar la pestaña) |
| Autenticación | Ninguna — acceso libre al fichero |

---

## Dependencias y versiones

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.3",
    "zustand": "^4.5.2",
    "papaparse": "^5.4.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.21",
    "vite-plugin-singlefile": "^2.0.2"
  }
}
```

> **Nota**: No hay librerías de componentes (no MUI, no Chakra, no shadcn, no Ant Design, no Tailwind). Todo el CSS es propio.

---

## Tecnología por tecnología

### 1. React 18

Framework de UI. Se usa con **JSX** y **hooks funcionales** exclusivamente. No se usan class components.

**Hooks más utilizados:**
- `useState` — estado local de componente
- `useEffect` — efectos secundarios (inicialización, listeners)
- `useMemo` — memoización de cálculos costosos (schemas derivados, datos filtrados)
- `useRef` — referencias a elementos DOM (inputs de fichero, etc.)

**Lo que NO se usa de React:**
- Context API (sustituida por Zustand)
- Redux / cualquier otro estado global
- Suspense / lazy loading (bundle único)
- Server Components (no hay servidor)

---

### 2. Vite 5

Build tool y servidor de desarrollo.

**Configuración clave (`vite.config.js`):**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Plugin propio: elimina el atributo crossorigin del <link rel="stylesheet">
// Necesario para que el CSS cargue correctamente con el protocolo file://
const stripCrossorigin = {
  name: "strip-crossorigin-links",
  transformIndexHtml: {
    order: "post",
    handler: (html) => html.replace(/(<link\b[^>]*?)\scrossorigin(?==|\s|>)/g, "$1"),
  },
};

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile({ inlinePattern: ["**/*.js"] }), // Solo incrusta JS; el CSS queda separado
    stripCrossorigin,
  ],
  base: "./",           // Rutas relativas — imprescindible para file://
  build: {
    outDir: "../dist",  // Ajustar según estructura del proyecto
    emptyOutDir: true,
    assetsInlineLimit: 0,
    cssCodeSplit: false, // Un único fichero CSS de salida
    rollupOptions: {
      output: {
        // El CSS de salida se llama estilos.css (no lleva hash)
        assetFileNames: (info) =>
          info.name?.endsWith(".css") ? "estilos.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
  server: { port: 5173 },
});
```

**Por qué `vite-plugin-singlefile`**: incrusta todo el JavaScript dentro del `index.html` para que no haya imports externos. El CSS se mantiene separado (en `estilos.css`) para poder editarlo sin recompilar.

**Por qué `stripCrossorigin`**: Vite añade automáticamente el atributo `crossorigin` al `<link rel="stylesheet">`. Con el protocolo `file://`, ese atributo hace que el navegador intente una petición CORS que siempre falla, dejando la página sin estilos.

**Por qué `base: "./"`**: garantiza que todas las rutas de assets sean relativas. Sin esto, las rutas empiezan por `/` y no funcionan al abrir el fichero directamente desde el disco.

---

### 3. React Router v6 — HashRouter

Se usa **HashRouter** (no BrowserRouter) porque la navegación basada en hash (`#/ruta`) no requiere servidor para funcionar. BrowserRouter necesita que el servidor gestione las rutas; HashRouter funciona con `file://`.

```jsx
import { HashRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="/inicio" element={<InicioPage />} />
        <Route path="/mi-seccion" element={<MiSeccionPage />} />
      </Routes>
    </HashRouter>
  );
}
```

Los enlaces de navegación usan `NavLink` (no `<a>`), que añade automáticamente la clase `active` cuando la ruta coincide:

```jsx
<NavLink
  to="/mi-seccion"
  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
>
  MI SECCIÓN
</NavLink>
```

---

### 4. Zustand

Gestión de estado global. Alternativa ligera a Redux. No necesita Provider ni Context. Los componentes se suscriben directamente al store con un selector.

**Estructura del store (`src/state.js`):**

```js
import { create } from "zustand";

const useStore = create((set, get) => ({
  // ── Estado ──────────────────────────────────────────
  items: [],
  configuracion: { tema: "dark" },

  // ── Acciones ────────────────────────────────────────
  setItems(items) {
    set({ items });
  },

  addItem(item) {
    set((s) => ({ items: [...s.items, item] }));
  },

  updateItem(id, cambios) {
    set((s) => ({
      items: s.items.map((i) => i.id === id ? { ...i, ...cambios } : i),
    }));
  },

  deleteItem(id) {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  // ── Derivados ────────────────────────────────────────
  getResumen() {
    const { items } = get();
    return { total: items.length, activos: items.filter((i) => i.activo).length };
  },
}));

export default useStore;
```

**Cómo consumirlo en un componente:**

```jsx
// Selector granular — solo re-renderiza si items cambia
const items = useStore((s) => s.items);

// Múltiples selectores — un selector por acción para evitar re-renders innecesarios
const addItem    = useStore((s) => s.addItem);
const deleteItem = useStore((s) => s.deleteItem);

// Acceso directo al store fuera de componentes (ej. en servicios)
useStore.getState().setItems(nuevosItems);
```

**Convenciones:**
- El estado vive en RAM. Al recargar el navegador, se pierde todo. No hay persistencia local por diseño.
- Las acciones van en el mismo create(). No hay "reducers" separados.
- Los derivados (getters) usan `get()` dentro del store para acceder al estado actual.

---

### 5. PapaParse

Librería de parseo de CSV en el browser. Soporta detección automática de delimitador (`,`, `;`, `\t`), codificación y cabeceras.

**Uso típico:**

```js
import Papa from "papaparse";

export function parsearCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,           // Primera fila como cabeceras
      skipEmptyLines: true,   // Ignorar líneas vacías
      dynamicTyping: false,   // Mantener todo como string (validar manualmente)
      encoding: "UTF-8",
      complete: (result) => resolve(result),
      error:    (error)  => reject(error),
    });
  });
}
```

**Por qué `dynamicTyping: false`**: PapaParse convierte automáticamente `"1234"` a `1234` y `"true"` a `true`. Esto interfiere con la validación manual posterior. Es mejor recibir todo como string y convertir explícitamente según el schema.

---

### 6. CSS puro

Sin Tailwind, sin librerías de componentes. Todo el diseño está en un único fichero `src/index.css` que Vite compila a `dist/estilos.css`.

**Arquitectura del CSS:**

```
src/index.css
├── :root { ... }              → Variables CSS del tema oscuro (design tokens)
├── [data-theme="light"] { }  → Overrides para tema claro
├── Reset + base               → box-sizing, body, html, #root
├── Layout                     → .app-layout, .nav-sidebar, .main-content
├── Navegación                 → .nav-logo, .nav-links, .nav-link, .nav-icon
├── Páginas                    → .page-header, .page-title, .page-body
├── Tarjetas                   → .card, .card-header, .card-title
├── Botones                    → .btn, .btn-primary/secondary/ghost/danger, .btn-sm/lg
├── Formularios                → .form-group, .form-label, .form-control
├── Tablas                     → .table-wrap, .data-table
├── Pasos                      → .steps, .step, .step-bubble, .step-connector
├── Badges                     → .badge, .badge-success/error/warning/info
├── Alertas                    → .alert, .alert-success/error/warning/info
├── Toasts                     → .toast-container, .toast, .toast-dot
├── Spinner                    → .spinner (@keyframes spin)
├── Upload zone                → .upload-zone
├── Utilidades                 → .mono, .flex, .grid-2/3/4, .gap-*, .mt-*, .mb-*
└── Scrollbar                  → ::-webkit-scrollbar
```

**Reglas de oro del CSS:**
1. **Nunca hardcodear colores hexadecimales en JSX**. Siempre usar `var(--nombre-variable)`.
2. Los colores de estado de tarjeta usan variables propias: `--card-success-bg`, `--card-success-border`, `--card-warning-bg`, `--card-warning-border`.
3. El modo claro/oscuro funciona solo con CSS (sin JS extra) cambiando `data-theme` en `document.documentElement`.

---

## Estructura de ficheros del proyecto

```
mi-proyecto/
├── frontend/                        ← Código fuente
│   ├── src/
│   │   ├── main.jsx                 ← Punto de entrada React
│   │   ├── App.jsx                  ← Layout principal + Router + Nav
│   │   ├── state.js                 ← Store Zustand único
│   │   ├── index.css                ← Design system completo
│   │   ├── pages/                   ← Una página por sección de la app
│   │   │   ├── InicioPage.jsx
│   │   │   └── MiSeccionPage.jsx
│   │   ├── components/              ← Componentes reutilizables
│   │   │   ├── Toast.jsx            ← Sistema de notificaciones
│   │   │   └── StatusBar.jsx        ← Panel lateral de estado
│   │   └── services/                ← Lógica de negocio pura (sin React)
│   │       ├── miServicio.js
│   │       └── csvParser.js
│   ├── public/                      ← Assets estáticos copiados a dist/ en build
│   │   └── logo.png
│   ├── package.json
│   ├── vite.config.js
│   └── index.html                   ← Template HTML (Vite lo procesa)
├── dist/                            ← ⬅ Resultado del build (distribuir estos ficheros)
│   ├── index.html                   ← App completa con JS embebido
│   ├── estilos.css                  ← Design system (editable sin rebuild)
│   └── logo.png                     ← Assets de public/
└── docs/                            ← Documentación del proyecto
```

**Convención de nombres:**
- Páginas: `NombrePage.jsx` (PascalCase + sufijo Page)
- Componentes: `NombreComponente.jsx` (PascalCase)
- Servicios: `nombreServicio.js` (camelCase)
- CSS classes: `kebab-case`
- Variables Zustand: `camelCase`
- Variables CSS: `--kebab-case`

---

## Plantilla `main.jsx`

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Plantilla `App.jsx`

```jsx
import React, { useEffect, useState } from "react";
import { HashRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import InicioPage from "./pages/InicioPage";
import MiSeccionPage from "./pages/MiSeccionPage";

// ── Iconos: SVG Heroicons v1 solid 20×20 ──────────────────────────────────────
const NAV_ITEMS = [
  {
    to: "/inicio",
    label: "INICIO",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    to: "/mi-seccion",
    label: "MI SECCIÓN",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
];

// ── Toggle de tema claro/oscuro ───────────────────────────────────────────────
function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("appTheme") ?? "dark"
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  function toggle() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("appTheme", next);
      return next;
    });
  }
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "8px 16px",
        background: "none", border: "none", borderTop: "1px solid var(--border)",
        color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
        fontFamily: "var(--font-ui)", letterSpacing: "0.04em",
      }}
    >
      {isDark
        ? <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
        : <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
      }
      {isDark ? "Modo oscuro" : "Modo claro"}
    </button>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────
function AppInner() {
  return (
    <div className="app-layout">
      <nav className="nav-sidebar">
        <div className="nav-logo">
          <img
            src="./logo.png"
            alt="Logo"
            className="nav-company-logo"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="nav-logo-text">MI APP</div>
          <div className="nav-logo-sub">Descripción breve v1.0</div>
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
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/inicio" replace />} />
          <Route path="/inicio"     element={<InicioPage />} />
          <Route path="/mi-seccion" element={<MiSeccionPage />} />
        </Routes>
      </main>
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
```

---

## Plantilla de página

```jsx
// src/pages/MiSeccionPage.jsx
import React, { useState } from "react";
import useStore from "../state";
import { useToast } from "../components/Toast";

export default function MiSeccionPage() {
  const toast   = useToast();
  const items   = useStore((s) => s.items);
  const addItem = useStore((s) => s.addItem);

  const [calculado, setCalculado] = useState(false);

  function handleAccion() {
    // lógica...
    toast.success("Acción completada correctamente.");
    setCalculado(true);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">MI SECCIÓN</h1>
        <p className="page-subtitle">
          Descripción de lo que hace esta sección.
        </p>
      </div>

      <div className="page-body">
        <div className="grid-2">
          {/* Tarjeta con estados */}
          <div
            className="card"
            style={{
              borderColor: calculado ? "var(--card-success-border)" : "var(--border)",
              background:  calculado ? "var(--card-success-bg)"     : "var(--bg-surface)",
            }}
          >
            <div className="card-header">
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                              color: calculado ? "var(--text-primary)" : "var(--text-muted)",
                              letterSpacing: "0.06em", marginBottom: 2 }}>
                  TÍTULO TARJETA
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Descripción de la tarjeta
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                background: calculado ? "var(--success-dim)"  : "var(--bg-surface-2)",
                color:      calculado ? "var(--success)"      : "var(--text-muted)",
                border:     `1px solid ${calculado ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
              }}>
                {calculado ? "CALCULADO" : "SIN DATOS"}
              </span>
            </div>

            {calculado && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12,
                            color: "var(--text-muted)", marginBottom: 14, padding: "8px 0",
                            borderTop: "1px solid var(--border)" }}>
                <span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700,
                                 color: "var(--accent)", marginRight: 6 }}>
                    {items.length.toLocaleString("es-ES")}
                  </span>
                  registros
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-sm" onClick={handleAccion}>
                Calcular
              </button>
              <button className="btn btn-secondary btn-sm" disabled={!calculado}>
                Visualizar
              </button>
              <button className="btn btn-secondary btn-sm" disabled={!calculado}>
                Exportar CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

---

## Comandos de desarrollo y build

```bash
# Instalar dependencias (solo la primera vez o al clonar)
cd frontend
npm install

# Desarrollo con hot reload (localhost:5173)
npm run dev

# Build de producción
npm run build
# → genera dist/index.html + dist/estilos.css (+ assets de public/)

# Abrir en producción
# Abrir dist/index.html con doble clic en el explorador de ficheros
# Asegurarse de que estilos.css y logo.png están en la misma carpeta
```

---

## Preguntas frecuentes

**¿Puedo añadir más páginas?**
Sí. Crear el fichero en `src/pages/`, importarlo en `App.jsx`, añadir la entrada al array `NAV_ITEMS` y la `<Route>` correspondiente.

**¿Puedo añadir más campos al store?**
Sí. El store es un objeto plano en Zustand. Añadir el campo con su valor inicial y las acciones que lo modifican.

**¿Puedo añadir librerías externas?**
Sí, con precaución. Las librerías que usan `document` o APIs del browser funcionan bien. Evitar librerías que requieran un servidor (SSR, fetch a APIs propias, WebSockets). Las librerías pesadas (ej. chart.js, recharts) aumentan el tamaño del bundle.

**¿Cómo añado gráficas?**
Instalar `recharts` (`npm install recharts`) e importar los componentes necesarios. Recharts funciona 100% client-side.

**¿Cómo persisto datos entre sesiones?**
Usar `localStorage` o `IndexedDB`. Por ejemplo, guardar el estado de Zustand en `localStorage` con el middleware `persist` de Zustand: `import { persist } from "zustand/middleware"`.

**¿Puedo usar TypeScript?**
Sí. Renombrar los ficheros `.jsx` a `.tsx` y `.js` a `.ts`. Actualizar `vite.config.js` y añadir `tsconfig.json`. Las dependencias de tipos están en `@types/react`, `@types/react-dom`, `@types/papaparse`.

**¿Cómo depuro en producción?**
Abrir las DevTools del navegador (F12). El bundle tiene sourcemaps en desarrollo. En producción, los errores se ven en la consola. Añadir `build: { sourcemap: true }` en `vite.config.js` para incluir sourcemaps en producción.
