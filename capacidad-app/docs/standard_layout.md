# Standard Layout — RCCapacity Design System

> **Instrucciones de uso**: Pasa este documento como contexto al inicio de una nueva sesión de Claude Code cuando quieras construir una herramienta con la misma identidad visual y estructura que RCCapacity. Indica también el stack y los requisitos funcionales de tu nueva herramienta.

---

## Stack técnico obligatorio

| Capa | Tecnología |
|------|-----------|
| Framework UI | React 18 + Vite 5 |
| Router | React Router v6 — **HashRouter** (compatible con `file://`) |
| Estado global | Zustand 4.5+ |
| Parseo CSV | PapaParse 5.4+ |
| Estilos | CSS puro — sin Tailwind, sin librerías de componentes |
| Build | vite-plugin-singlefile (JS incrustado) + CSS separado como `estilos.css` |
| Fuentes | DM Sans (UI) + JetBrains Mono (datos/código) |

El build genera exactamente **dos ficheros** en `dist/`:
- `index.html` — app completa con JS embebido
- `estilos.css` — design system completo (editable sin rebuild)

Ambos ficheros deben estar en la misma carpeta para funcionar. Se abren directamente con doble clic, sin servidor.

---

## Variables CSS (design tokens)

Todas las variables se definen en `:root` (tema oscuro por defecto) y se sobreescriben en `[data-theme="light"]`.

```css
:root {
  /* ── Fondos ── */
  --bg-primary:   #05101e;   /* fondo de página */
  --bg-surface:   #091828;   /* tarjetas, sidebar */
  --bg-surface-2: #0e2038;   /* filas hover, cabeceras tabla, inputs */
  --bg-surface-3: #152848;   /* elementos anidados */

  /* ── Acento (Walki blue) ── */
  --accent:           #009ee1;
  --accent-hover:     #007ec0;
  --accent-dim:       rgba(0, 158, 225, 0.12);
  --accent-dim-hover: rgba(0, 158, 225, 0.22);

  /* ── Texto ── */
  --text-primary:   #ddeef8;
  --text-secondary: #7aafc9;
  --text-muted:     #466a84;
  --text-accent:    #009ee1;

  /* ── Bordes ── */
  --border:        #153050;
  --border-dim:    rgba(21, 48, 80, 0.8);
  --border-accent: rgba(0, 158, 225, 0.45);

  /* ── Semánticos ── */
  --success:     #10b981;   --success-dim: rgba(16, 185, 129, 0.12);
  --error:       #ef4444;   --error-dim:   rgba(239, 68, 68, 0.12);
  --warning:     #f59e0b;   --warning-dim: rgba(245, 158, 11, 0.12);
  --info:        #009ee1;   --info-dim:    rgba(0, 158, 225, 0.12);

  /* ── Estados de tarjeta ── */
  --card-success-bg:     #051a12;
  --card-success-border: rgba(16, 185, 129, 0.28);
  --card-warning-bg:     #1c1500;
  --card-warning-border: rgba(245, 158, 11, 0.32);

  /* ── Tipografía ── */
  --font-ui:   "DM Sans", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;

  /* ── Geometría ── */
  --radius-sm: 4px;
  --radius:    6px;
  --radius-lg: 10px;
  --shadow:    0 4px 20px rgba(0, 0, 0, 0.55);
  --transition: 150ms ease;
}

[data-theme="light"] {
  --bg-primary:   #f4f9ff;
  --bg-surface:   #ffffff;
  --bg-surface-2: #e6f1ff;
  --bg-surface-3: #cce0f5;
  --accent:       #0047a1;
  --accent-hover: #00377d;
  --accent-dim:       rgba(0, 71, 161, 0.10);
  --accent-dim-hover: rgba(0, 71, 161, 0.18);
  --text-primary:   #00253d;
  --text-secondary: #4c6480;
  --text-muted:     #8d9eae;
  --text-accent:    #0047a1;
  --border:        #b8d0e8;
  --border-dim:    rgba(184, 208, 232, 0.7);
  --border-accent: rgba(0, 71, 161, 0.4);
  --shadow:        0 4px 20px rgba(0, 37, 61, 0.10);
  --card-success-bg:     #f0fdf9;
  --card-success-border: rgba(16, 185, 129, 0.40);
  --card-warning-bg:     #fffbeb;
  --card-warning-border: rgba(245, 158, 11, 0.45);
}
```

---

## Estructura de layout (App.jsx)

```
┌─────────────────────────────────────────────────────────────┐
│  .nav-sidebar (220px)  │  .main-content (flex:1)  │ StatusBar│
│  ─────────────────────  │  ───────────────────────  │ (280px) │
│  .nav-logo             │  .page-header             │         │
│    img.nav-company-logo│    h1.page-title           │         │
│    .nav-logo-text      │    p.page-subtitle         │         │
│    .nav-logo-sub       │  .page-body                │         │
│  .nav-links            │    (contenido)             │         │
│    .nav-section-label  │                            │         │
│    NavLink.nav-link    │                            │         │
│      .nav-icon (SVG)   │                            │         │
│      label text        │                            │         │
│  ThemeToggle           │                            │         │
│  ExportDirIndicator    │                            │         │
└─────────────────────────────────────────────────────────────┘
```

CSS del layout:
```css
.app-layout {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  grid-template-rows: 100vh;
  height: 100vh;
  overflow: hidden;
}
.app-layout.status-collapsed { grid-template-columns: 220px 1fr 36px; }
.nav-sidebar    { background: var(--bg-surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
.main-content   { overflow-y: auto; background: var(--bg-primary); display: flex; flex-direction: column; }
.page-header    { padding: 28px 32px 20px; border-bottom: 1px solid var(--border); }
.page-title     { font-size: 22px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.page-subtitle  { font-size: 13px; color: var(--text-muted); }
.page-body      { padding: 24px 32px; flex: 1; }
```

---

## Componentes — clases CSS

### Botones
```html
<button class="btn btn-primary">Acción principal</button>
<button class="btn btn-secondary">Acción secundaria</button>
<button class="btn btn-ghost">Acción fantasma</button>
<button class="btn btn-danger">Acción destructiva</button>

<!-- Tamaños -->
<button class="btn btn-primary btn-sm">Pequeño</button>
<button class="btn btn-primary btn-lg">Grande</button>

<!-- Deshabilitado -->
<button class="btn btn-primary" disabled>Deshabilitado</button>
```

### Tarjetas (card)
```html
<!-- Tarjeta base -->
<div class="card">
  <div class="card-header">
    <div>
      <div style="font-family:var(--font-mono);font-size:13px;font-weight:700;letter-spacing:0.06em">
        TÍTULO TARJETA
      </div>
      <div style="font-size:12px;color:var(--text-muted)">Descripción breve</div>
    </div>
    <span style="...badge styles...">ESTADO</span>
  </div>
  <!-- Contenido -->
  <div style="display:flex;gap:8px">
    <button class="btn btn-primary btn-sm">Acción</button>
  </div>
</div>

<!-- Tarjeta con estado cargado (verde) -->
<div class="card" style="border-color:var(--card-success-border);background:var(--card-success-bg)">
  ...
</div>

<!-- Tarjeta con estado de alerta (ámbar) -->
<div class="card" style="border-color:var(--card-warning-border);background:var(--card-warning-bg)">
  ...
</div>
```

### Badges de estado
```jsx
// SIN DATOS (gris)
<span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999,
  background:"var(--bg-surface-2)", color:"var(--text-muted)", border:"1px solid var(--border)" }}>
  SIN DATOS
</span>

// OK / CARGADO (verde)
<span style={{ ..., background:"var(--success-dim)", color:"var(--success)", border:"1px solid rgba(16,185,129,0.3)" }}>
  OK
</span>

// ALERTA / ERROR (ámbar)
<span style={{ ..., background:"rgba(245,158,11,0.12)", color:"var(--warning)", border:"1px solid rgba(245,158,11,0.4)" }}>
  ALERTAS (N)
</span>
```

### Grids
```html
<div class="grid-2">  <!-- 2 columnas iguales, gap 16px -->
<div class="grid-3">  <!-- 3 columnas iguales -->
<div class="grid-4">  <!-- 4 columnas iguales -->
```

### Tabla de datos
```html
<div class="table-wrap">
  <table class="data-table">
    <thead>
      <tr><th>COLUMNA A</th><th>COLUMNA B</th></tr>
    </thead>
    <tbody>
      <tr><td>valor</td><td>valor</td></tr>
    </tbody>
  </table>
</div>
```

### Formularios
```html
<div class="form-group">
  <label class="form-label">Campo</label>
  <input  class="form-control" type="text" />
  <select class="form-control">...</select>
  <textarea class="form-control"></textarea>
</div>
```

### Alertas (banners)
```html
<div class="alert alert-success">Mensaje de éxito</div>
<div class="alert alert-error">Mensaje de error</div>
<div class="alert alert-warning">Mensaje de advertencia</div>
<div class="alert alert-info">Mensaje informativo</div>
```

### Pasos (wizard)
```html
<div class="steps">
  <div class="step done">
    <div class="step-bubble">✓</div>
    <span class="step-label">Paso 1</span>
  </div>
  <div class="step-connector"></div>
  <div class="step active">
    <div class="step-bubble">2</div>
    <span class="step-label">Paso actual</span>
  </div>
  <div class="step-connector"></div>
  <div class="step">
    <div class="step-bubble">3</div>
    <span class="step-label">Paso futuro</span>
  </div>
</div>
```

### Separador
```html
<div class="divider"></div>
```

---

## Plantilla de página nueva

```jsx
// src/pages/MiPaginaPage.jsx
import React from "react";
import useStore from "../state";

export default function MiPaginaPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">NOMBRE DE LA SECCIÓN</h1>
        <p className="page-subtitle">
          Descripción breve de lo que hace esta sección.
        </p>
      </div>

      <div className="page-body">
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                              color: "var(--text-primary)", letterSpacing: "0.06em", marginBottom: 2 }}>
                  TÍTULO TARJETA
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Descripción de la tarjeta
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                             background: "var(--bg-surface-2)", color: "var(--text-muted)",
                             border: "1px solid var(--border)" }}>
                SIN DATOS
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm">Acción principal</button>
              <button className="btn btn-secondary btn-sm">Acción secundaria</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

---

## Añadir una página al router (App.jsx)

```jsx
// 1. Importar la página
import MiPaginaPage from "./pages/MiPaginaPage";

// 2. Añadir al array NAV_ITEMS
{
  to: "/mi-pagina",
  label: "MI PÁGINA",
  icon: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
      {/* SVG Heroicons path */}
    </svg>
  ),
},

// 3. Añadir la ruta
<Route path="/mi-pagina" element={<MiPaginaPage />} />
```

Los iconos son SVGs de **Heroicons v1** (solid, 20×20). Usar la clase `nav-icon`.

---

## Patrón Zustand (state.js)

```js
import { create } from "zustand";

const useStore = create((set, get) => ({
  // Estado
  misDatos: [],

  // Acciones
  setMisDatos(datos) {
    set({ misDatos: datos });
  },
  addItem(item) {
    set((s) => ({ misDatos: [...s.misDatos, item] }));
  },
  updateItem(id, changes) {
    set((s) => ({
      misDatos: s.misDatos.map((i) => i.id === id ? { ...i, ...changes } : i),
    }));
  },
  deleteItem(id) {
    set((s) => ({ misDatos: s.misDatos.filter((i) => i.id !== id) }));
  },
}));

export default useStore;
```

---

## Modo oscuro / claro

El tema se gestiona con `data-theme` en `document.documentElement`. El componente `ThemeToggle` en `App.jsx` lo controla y persiste la preferencia en `localStorage` (clave: `rcCapacityTheme`).

No usar colores hexadecimales hardcodeados en JSX. Usar siempre variables CSS:
```jsx
// ✅ Correcto
style={{ background: "var(--card-success-bg)", borderColor: "var(--card-success-border)" }}

// ❌ Incorrecto
style={{ background: "#0d1f17", borderColor: "rgba(16,185,129,0.25)" }}
```

---

## Color-coding de ocupación (patrón recurrente)

```js
function ocupColor(v) {
  if (v == null) return "var(--text-muted)";
  if (v > 1)    return "var(--error)";    // >100% — rojo
  if (v > 0.85) return "var(--warning)";  // 85-100% — ámbar
  return "var(--success)";                // <85% — verde
}
```

---

## Configuración Vite (vite.config.js)

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

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
    viteSingleFile({ inlinePattern: ["**/*.js"] }),
    stripCrossorigin,
  ],
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: (info) =>
          info.name?.endsWith(".css") ? "estilos.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
  server: { port: 5173 },
});
```

---

## Comandos de desarrollo

```bash
cd frontend
npm install
npm run dev     # Dev server en localhost:5173 con hot reload
npm run build   # Genera dist/index.html + dist/estilos.css
```

Para abrir la app en producción: abrir `dist/index.html` directamente en el navegador (asegurarse de que `estilos.css` y `logo.png` están en la misma carpeta).
