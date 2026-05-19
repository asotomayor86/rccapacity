# ARCHITECTURE — Calculador de Capacidades

> Documento vivo. Gestionado por Claude.ai — Claude Code no debe modificar este archivo.

---

## Stack (v2.0 — SPA client-side)

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework UI | React + Vite | 18 / 5 |
| Router | React Router v6 (HashRouter) | 6.22+ |
| Estado global | Zustand | 4.5+ |
| Parseo CSV | PapaParse | 5.4+ |
| Gráficas (futuro) | Recharts | 2.10+ |
| Estado | RAM del navegador | — |
| Persistencia | Ninguna | — |
| ~~Backend~~ | ~~Python + FastAPI~~ | ~~eliminado en v2.0~~ |

---

## Estructura de carpetas

```
capacidad-app/
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Layout + HashRouter + ToastProvider + ThemeToggle
│   │   ├── masterSchemas.js    # Schemas de todos los maestros
│   │   ├── index.css           # Design system: variables CSS, componentes base, temas
│   │   ├── pages/
│   │   │   ├── MaestrosPage.jsx              # Vista de estado de los 4 maestros + tooltip distinct
│   │   │   ├── VerificacionesPage.jsx        # Cruces entre maestros (V1, V2, V3)
│   │   │   ├── IntermediasPage.jsx           # Producto Simple y Doble (filtrado por Demanda)
│   │   │   ├── IntermediasCalculadasPage.jsx # Enrutamientos + Factibles + Ver errores dinámico
│   │   │   ├── CargadorPage.jsx              # Flujo 4 pasos: upload→mapeo→validación→import
│   │   │   ├── ResultadosPage.jsx            # Cálculo, tabla de resultados, exportación
│   │   │   └── SetupExtrusorasPage.jsx       # Tabla de configuraciones de extrusoras
│   │   ├── services/
│   │   │   ├── csvParser.js    # Parseo, filtros, mapeo y validación de CSVs
│   │   │   ├── engine.js       # calcularEnrutamientos (RS 2dp, errores dinámicos)
│   │   │   ├── escenario0.js   # LP water-filling anual (Escenario 0)
│   │   │   ├── exporter.js     # Exportación CSV/TXT
│   │   │   ├── intermedias.js  # calcularProductoComplejo (filtra por Demanda)
│   │   │   ├── verificaciones.js  # Funciones puras V1/V2/V3 de cruce entre maestros
│   │   │   └── state.js        # Store Zustand
│   │   └── components/
│   │       ├── MasterViewer.jsx   # Modal paginado con filtros, schema dinámico
│   │       ├── ColumnMapper.jsx
│   │       ├── FilterBuilder.jsx
│   │       ├── DataPreview.jsx
│   │       ├── ValidationReport.jsx
│   │       ├── StatusBar.jsx
│   │       └── Toast.jsx
│   ├── public/
│   │   ├── logo.png          # Logo corporativo Walki Plasbel (copiado a dist/ en build)
│   │   └── estilos_old.css   # Tema anterior ámbar/industrial (backup)
│   ├── vite.config.js        # singlefile solo JS; CSS separado; stripCrossorigin plugin
│   └── package.json
├── dist/                     # Build de producción (3 ficheros para distribuir)
│   ├── index.html            # App completa con JS embebido
│   ├── estilos.css           # Design system Walki Plasbel (editable sin rebuild)
│   ├── estilos_old.css       # Tema anterior (backup)
│   └── logo.png              # Logo corporativo
├── docs/
│   ├── ARCHITECTURE.md  # Este archivo
│   └── BACKLOG.md       # Sprints completados y trabajo pendiente
└── README.md
```

---

## Flujo de datos (v2.0 — todo en el browser)

```
Usuario
  │
  ├─ Sube CSV ──────────────────► csvParser.parseCsvFile(File)
  │                                    │ PapaParse (auto-sep, auto-encoding)
  │                                    ▼
  │                               store.setUpload(uuid, { raw, columns })
  │
  ├─ Mapea + filtra ────────────► csvParser.applyMappingAndValidate(raw, filters, mapping, master)
  │                                    │ validadores JS (fecha, decimal, string, boolean)
  │                                    ▼
  │                               { validRows, errors, preview, success_pct }
  │
  ├─ Confirma import ───────────► store.importMaster(name, validRows)
  │                                    │ Zustand → actualiza masters[name]
  │                                    │ Para SETUP_EXTRUSORAS: extrae _META_*, valida
  │                                    │ ES_ACTUAL por grupo NOMBRE_EXTRUSORA
  │                                    ▼
  │                               StatusBar se re-renderiza automáticamente
  │
  ├─ Edita extrusora ───────────► store.updateSetupExtrusora(nombre, index, campos)
  │                                    │ Merge parcial en la fila del store
  │                                    ▼
  │                               Modal y tabla se re-renderizan por reactividad Zustand
  │
  ├─ Ejecuta cálculo ───────────► engine.calculate({ demanda, producto, enrutamiento, calendario })
  │                                    │ lógica JS pura (Maps nativos)
  │                                    ▼
  │                               store.setResults(records, log)
  │
  └─ Exporta ───────────────────► exporter.exportToCsv(records)
                                  exporter.exportSetupExtrusoras(records, fechaRevision)
                                       │ Blob + URL.createObjectURL
                                       ▼
                                  descarga en el browser
```

---

## Decisiones de diseño

### Estado en RAM
No hay requisito de persistencia entre sesiones. **Consecuencia**: al recargar el navegador, el estado se pierde. Las ediciones hechas en el modal deben exportarse a CSV antes de cerrar si se quieren conservar.

### Upload temporal por UUID
Cada subida de CSV genera un `upload_id` (UUID4) que vincula las llamadas de validación e importación. Permite re-validar con distintos mappings/filtros sin resubir el archivo.

### Motor prioriza rutas Principal > Alternativa
Si una referencia tiene rutas de TIPO "Principal" en ENRUTAMIENTO, se usan únicamente esas. Solo si no existen se caen a "Alternativa".

### Resultado como filas detalladas (no agregado)
El engine produce una fila por cada combinación (MES × REFERENCIA × CM). Permite filtrado granular, exportación completa y comparación con versiones previas.

### SPA con HashRouter
Build estático en `dist/` abierto directamente en el navegador sin servidor. HashRouter garantiza compatibilidad con el protocolo `file://`.

### Identidad visual Walki Plasbel
Paleta corporativa alineada con walki.com y plasbel.com. **Oscuro** (default): navy `#05101e` / `#091828`, acento azul brillante `#009ee1`. **Claro**: fondo `#f4f9ff`, acento `#0047a1`, texto `#00253d`. Tipografía: DM Sans (UI) + JetBrains Mono (datos). Sin librerías de componentes externas. El tema anterior (ámbar/industrial) se conserva en `estilos_old.css`.

### Distribución en dos/tres ficheros
El build genera `dist/index.html` (JS embebido, ~352 KB) + `dist/estilos.css` (CSS separado, ~11 KB) + `dist/logo.png`. Los tres ficheros deben estar en la misma carpeta. El `<link rel="stylesheet" href="./estilos.css">` usa ruta relativa para compatibilidad con `file://`. El atributo `crossorigin` se elimina automáticamente mediante el plugin `stripCrossorigin` en `vite.config.js`.

### Modo claro / oscuro con CSS custom properties
El tema se controla con `data-theme="light"|"dark"` en `document.documentElement`. El bloque `[data-theme="light"]` en `estilos.css` redefine las variables estructurales. Los JSX no tienen colores hardcodeados: usan `var(--card-success-bg)`, `var(--card-warning-bg)`, etc. La preferencia se persiste en `localStorage` (clave: `rcCapacityTheme`).

### Metainfo en columnas `_META_*`
Los CSV con metainformación transportan campos en columnas prefijadas `_META_`. El validador los extrae antes de procesar campos de negocio. Al exportar se reinyectan junto con `_META_FECHA_EXPORTACION` (timestamp ISO 8601 del momento de exportación).

### ES_ACTUAL con scope por extrusora
El campo `ES_ACTUAL` en SETUP_EXTRUSORAS indica la configuración activa **dentro de cada extrusora**, no de forma global. La invariante es: exactamente un `true` por cada valor distinto de `NOMBRE_EXTRUSORA`. Si se viola al importar, se corrige automáticamente con warning en el log. El botón "Marcar como actual" en el modal afecta únicamente a las filas del mismo `NOMBRE_EXTRUSORA`.

### Edición en modal sin persistencia externa
Las ediciones de configuraciones de extrusoras se aplican directamente al store Zustand mediante `updateSetupExtrusora`. No hay endpoint ni fichero intermedio: la exportación CSV desde el header siempre refleja el estado actual del store, incluyendo ediciones. Los campos `NOMBRE_EXTRUSORA` y `ES_ACTUAL` están protegidos contra edición directa en el modal (se gestionan con acciones propias).

---

## Servicios JS

| Módulo | Función | Descripción |
|--------|---------|-------------|
| `csvParser.js` | `parseCsvFile(file)` | Lee File → PapaParse → store.setUpload |
| `csvParser.js` | `applyFilters(raw, filters)` | Filtra filas raw por operadores |
| `csvParser.js` | `applyMappingAndValidate(...)` | Mapea + valida tipos → informe |
| `engine.js` | `calculate({...})` | Motor de cálculo → store.setResults |
| `engine.js` | `calcularEnrutamientos({...})` | Cruza Producto Simple/Doble × Mezcla × Extrusora × Setup. RS redondeada a 2dp. Errores incluyen mezcla, extrusora y campos de fórmula. |
| `exporter.js` | `exportToCsv(records)` | Genera y descarga CSV resultado |
| `exporter.js` | `exportLog(lines)` | Genera y descarga log TXT |
| `exporter.js` | `exportSetupExtrusoras(records, fechaRevision)` | CSV de extrusoras con metainfo |
| `intermedias.js` | `calcularProductoComplejo(rows, reglas)` | Genera PRODUCTO_COMPLEJO desde reglas |
| `escenario0.js` | `calcularEscenario0({...})` | LP water-filling anual: asigna demanda a (variante,CM) minimizando ocupación pico |
| `verificaciones.js` | `verificarRefsDemandaNoEnProducto(d, p)` | V1: refs en Demanda sin ficha en Producto |
| `verificaciones.js` | `verificarRefsSinMezcla(d, p)` | V2: refs con demanda cuya MEZCLA está vacía en Producto |
| `verificaciones.js` | `verificarMezclaSinEnrutamiento(d, p, e)` | V3: refs cuya mezcla no está en Enrutamiento |
| `state.js` | `importMaster(name, records)` | Actualiza maestro en Zustand store |
| `state.js` | `setVerificacion(name, records)` | Guarda resultado de una verificación (null = sin calcular) |
| `state.js` | `updateSetupExtrusora(nombre, index, campos)` | Edición parcial de una configuración |
| `state.js` | `getMasterStatus()` | Estado derivado de los maestros |
| `state.js` | `setSavedFilter / deleteSavedFilter` | CRUD presets de filtros en store |

---

## Instrucciones de uso

```bash
# Desarrollo
cd frontend && npm install && npm run dev

# Build
cd frontend && npm run build
# → dist/index.html + dist/estilos.css + dist/logo.png
# Los tres ficheros deben estar juntos al abrir en el navegador
```

---

## Historial de cambios arquitecturales

### 2026-05-09 — v1.0 inicial
Creación completa del proyecto: backend FastAPI + React/Vite + motor de cálculo + exportación CSV. Diseño visual industrial/utilitario con paleta oscura y acentos ámbar.

### 2026-05-09 — v1.1 Sprint 2
1. **Operador "Comienza por"** (`starts_with`) en `FilterBuilder.jsx` y `loaders._apply_filter`.
2. **Presets de filtros en sesión**: CRUD en store + UI en `FilterBuilder.jsx`.

### 2026-05-09 — v2.0 Migración client-side
Eliminación completa del backend Python/FastAPI. Lógica migrada a JS en `src/services/`. Estado global con Zustand. HashRouter para compatibilidad `file://`.

### 2026-05-09 — v2.1 Sprint 4
1. **Agregación DEMANDA** por MES+REFERENCIA en `importMaster`.
2. **Campo ASIGNACION** en ENRUTAMIENTO (decimal, fracción directa).
3. **Motor reescrito**: CARGA = CANTIDAD × TIEMPO_UNITARIO × ASIGNACION; OCUPACION = CARGA / HORAS_DISPONIBLES.
4. **MasterViewer**: modal paginado con filtros por columna en MaestrosPage.

### 2026-05-10 — v2.2 Sprint 5
Nuevo módulo Setup Extrusoras:
- Schema `SETUP_EXTRUSORAS` (21 campos + metainfo `_META_*`).
- Store: campo `setupExtrusorasRevision` + invariante ES_ACTUAL (scope global, corregida en Sprint 6).
- `exportSetupExtrusoras()` con `_META_FECHA_REVISION` y `_META_FECHA_EXPORTACION`.
- `SetupExtrusorasPage.jsx`: tabla horizontal, modal de detalle por secciones, acción "Marcar como actual".

### 2026-05-19 — v2.9 Sprint 12
**Escenario 0 — Rough Cut Capacity Anual**

Nuevo módulo de optimización de capacidad en `ResultadosPage`. Reemplaza el antiguo botón "Ejecutar cálculo".

**Modelo (LP continuo):**
- Variable `f[R,v,c]` ≥ 0: fracción de la demanda anual de la referencia base R asignada a variante v ∈ {S,D} en CM c.
- Restricción de demanda: `Σ_{v,c} f[R,v,c] = 1` (toda la demanda cubierta sin doble conteo).
- Restricción de rutas: `f[R,v,c] = 0` si (R+v, c) no es factible.
- Carga en CM c: `LOAD[c] = Σ_{R,v} f[R,v,c] × Q[R] / REND[R,v,c]` (en horas).
- Capacidad anual: `CAP[c] = Σ_meses HORAS_EFICIENTES[c,mes]`.
- Objetivo bifásico: min `max_c LOAD[c]/CAP[c]`, después min `Σ_c LOAD[c]/CAP[c]`.

**Algoritmo (water-filling entrópico con blending):**
1. Inicialización proporcional al rendimiento de cada ruta.
2. 300 iteraciones de annealing entrópico: `score[r] = exp(−u[cm_r] / T) × rend[r]`, temperatura T decrece de 1.0 a 0.
3. Actualización mezclada: `f_nuevo = (1−LR)·f_viejo + LR·f_target` con LR=0.15 (previene oscilaciones).
4. Guarda la mejor asignación encontrada (min max utilización).
5. Cede al UI (`setTimeout(0)`) cada 15 iteraciones para actualizar la barra de progreso.

**Entradas:**
- `ENRUTAMIENTOS_FACTIBLES` (FACTIBLE=SI, ES_ACTUAL=true)
- `DEMANDA` anualizada por referencia
- `CALENDARIO` anualizado por CM

**Salidas:**
- `cmSummary`: resumen por CM con HORAS_DISPONIBLES, HORAS_CARGADAS, OCUPACION
- `refDetail`: detalle por (ref, variante, CM) con KG asignados, % asignado, horas requeridas, ocupación CM

**Archivos nuevos/modificados:**
- `services/escenario0.js`: algoritmo puro (async, sin dependencias de store)
- `state.js`: campo `escenario0` + acción `setEscenario0`
- `pages/ResultadosPage.jsx`: rediseño completo con barra de progreso, KPIs, tablas por pestaña

### 2026-05-19 — v2.8 Sprint 11
**RS a 2 decimales + errores dinámicos en ENRUTAMIENTOS**
- `engine.js`: `RS_CALCULADA = Math.round(rs * 100) / 100`. Todos los registros de error enriquecidos con campos `mezcla` y `extrusora`. Para `RS_NULA` y `RENDIMIENTO_NULO`, los valores de los campos de fórmula (`camposPC` ∪ `camposSE`) se spread directamente en el objeto de error.
- `IntermediasCalculadasPage`: `SCHEMA_ERRORES` estático reemplazado por `buildErrorSchema(errors)` que deriva columnas dinámicamente de las claves reales de los registros. Columnas fijas: `TIPO · REFERENCIA · MEZCLA · EXTRUSORA · DESCRIPCIÓN`. Columnas extra: una por campo de fórmula activo, con tipo resuelto vía `MASTER_SCHEMAS_META`. Recompuesto con `useMemo` al cambiar `lastErrors`. **Sin redespliegue** al cambiar las fórmulas de cálculo.

### 2026-05-19 — v2.7 Sprint 10
**Identidad visual Walki Plasbel + logo corporativo**
- Paleta rediseñada en `index.css` con colores de walki.com / plasbel.com. Oscuro: navy `#05101e`, acento `#009ee1`. Claro: `#f4f9ff` bg, `#0047a1` acento, `#00253d` texto. `btn-primary color: #000 → #fff`. Override de colores de alerta para modo claro.
- Logo corporativo: `<img src="./logo.png" className="nav-company-logo">` en cabecera nav. Guardado en `frontend/public/` (Vite lo copia a `dist/` en cada build). Filtro `brightness(0) invert(1)` en modo oscuro; colores originales en modo claro. `onError` lo oculta si el fichero no existe.
- `estilos_old.css` conservado en `frontend/public/` → disponible en `dist/` en cada build.
- Bug fix: atributo `crossorigin` en `<link rel="stylesheet">` rompe la carga CSS con `file://`. Plugin `stripCrossorigin` en `vite.config.js` lo elimina en post-build.
- Bug fix: labels del toggle de tema invertidos. Ahora muestra el modo activo (luna = oscuro, sol = claro).

### 2026-05-19 — v2.6 Sprint 9
**CSS separado + modo claro / modo oscuro**
- CSS extraído del HTML embebido a `dist/estilos.css` mediante `vite-plugin-singlefile { inlinePattern: ["**/*.js"] }`. Carpeta `frontend/public/` para assets estáticos copiados al `dist/`. Plugin `stripCrossorigin` elimina atributo problemático del `<link>`.
- Toggle sol/luna en el pie de la barra lateral (`ThemeToggle` en `App.jsx`). Preferencia persistida en `localStorage` con clave `rcCapacityTheme`.
- Tema aplicado como `data-theme="light"|"dark"` en `document.documentElement`. Bloque `[data-theme="light"]` en `estilos.css` redefine variables de color.
- Variables nuevas: `--card-success-bg/border`, `--card-warning-bg/border`, `--border-dim`. Todos los hexadecimales hardcodeados en JSX reemplazados por `var()`.

### 2026-05-19 — v2.5 Sprint 8
Tres mejoras sobre la capa de intermedias y maestros:
1. **Ver errores en tarjeta** (`IntermediasCalculadasPage`): eliminados los paneles `CollapsibleLog` independientes. Cada tarjeta (ENRUTAMIENTOS y ENRUTAMIENTOS FACTIBLES) añade un 4º botón "Ver errores" que abre `MasterViewer` con esquema propio. La tarjeta ENRUTAMIENTOS adopta borde/fondo ámbar cuando el último cálculo produjo errores.
2. **Producto Simple y Doble** (`intermedias.js`, `IntermediasPage`, `ReglasProductoComplejoPage`): renombrada la tabla intermedia (UI). La función `calcularProductoComplejo` acepta `demandaRows` opcional y filtra PRODUCTO a las referencias con demanda antes de expandir variantes Simple/Doble. Claves internas (`PRODUCTO_COMPLEJO`, `fuente` en reglas) sin cambiar.
3. **Tooltip de valores distintos** (`MaestrosPage`): hover sobre los pills de campo de un maestro cargado muestra un tooltip `position: fixed` con el recuento de valores distintos (non-null) de ese campo. Resolución label→name vía `MASTER_SCHEMAS_META` para campos con etiqueta distinta al nombre interno (e.g. `"ANCHO (MM)"` → `"ANCHO"`).

### 2026-05-19 — v2.4 Sprint 7
Nueva sección **VERIFICACIONES** (entre MAESTROS y REGLAS en la nav lateral):
- `verificaciones.js`: 3 funciones puras de cruce entre maestros. Granularidad por REFERENCIA única.
- `VerificacionesPage.jsx`: 3 tarjetas con diseño idéntico a Intermedias. Badge tri-estado: SIN DATOS / OK (verde) / ALERTAS N (ámbar).
- V1: `verificarRefsDemandaNoEnProducto` — DEMANDA × PRODUCTO → refs sin ficha. Columnas: REFERENCIA.
- V2: `verificarRefsSinMezcla` — refs con demanda cuya MEZCLA está vacía en Producto. Columnas: REFERENCIA.
- V3: `verificarMezclaSinEnrutamiento` — DEMANDA → PRODUCTO → ENRUTAMIENTO_MEZCLAS → refs con demanda sin asignación MO>EX. Columnas: REFERENCIA, MEZCLA.
- Store: campo `verificaciones` con keys `REFS_SIN_PRODUCTO`, `REFS_SIN_MEZCLA`, `REFS_SIN_ENRUTAMIENTO`. `null` = sin calcular, `[]` = OK, `[...]` = alertas.

### 2026-05-10 — v2.3 Sprint 6
Dos correcciones sobre el módulo Setup Extrusoras:
1. **ES_ACTUAL con scope por extrusora**: invariante corregida de "un único true global" a "exactamente un true por NOMBRE_EXTRUSORA". Validación y autocorrección en `importMaster`. Tabla agrupa visualmente por extrusora con la configuración actual destacada dentro de cada grupo. "Marcar como actual" solo afecta al grupo de la extrusora seleccionada.
2. **Modal editable**: modo vista / modo edición con toggle "Editar". Inputs inline por tipo (text, number, toggle boolean). Campos protegidos: `NOMBRE_EXTRUSORA` y `ES_ACTUAL`. Nueva acción `updateSetupExtrusora(nombre, index, campos)` en store para merge parcial. Validación con error inline antes de guardar. La exportación refleja ediciones sin cambios adicionales en el exportador.
