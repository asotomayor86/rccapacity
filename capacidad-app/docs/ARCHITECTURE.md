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
│   │   │   ├── engine.js       # calcularEnrutamientos + AST de fórmulas (eval, deps, ciclos)
│   │   │   ├── escenario0.js   # LP water-filling anual (Escenario 0)
│   │   │   ├── exporter.js     # Exportación CSV/TXT
│   │   │   ├── intermedias.js  # calcularProductoComplejo (filtra por Demanda)
│   │   │   ├── modeloCuellos.js   # Modelo de rendimiento por cuellos: defs por defecto
│   │   │   ├── verificaciones.js  # Funciones puras V1/V2/V3/V4 de cruce entre maestros
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
│   │   ├── estilos_old.css   # Tema anterior ámbar/industrial (backup)
│   │   └── plantillas/
│   │       └── CALCULOS_MODELO_CUELLOS.csv  # 8 definiciones del modelo de cuellos (regenerable)
│   ├── scripts/
│   │   └── gen_plantilla_modelo_cuellos.mjs  # Regenera el CSV desde modeloCuellos.js
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

### AST de fórmulas con propagación de null y orden topológico
Las definiciones de cálculo (`calculos.DEFINICIONES`) son árboles (`NodoFormula`) con los tipos: `constante`, `nulo`, `campo`, `operacion` (binaria `+ − × ÷ ^`), `operacion_naria` (min/max ≥2 hijos), `si_aplica` (condición booleana → valor o null), `booleana` (and/or/not) y `referencia_calculo` (resuelto por NOMBRE). El motor `evaluarArbol(nodo, fila, ctx)` propaga `null` aguas arriba en aritmética (`2 + null = null`, `0 × null = null`), ignora null en min/max (todos null → null), y aplica corto-circuito en booleanas. `ordenarCalculosPorDependencia` calcula un orden topológico vía DFS y detecta ciclos: si A→B y B→A se devuelve un error `CICLO_EN_CALCULOS` antes de evaluar cualquier fila. **Caché por fila**: el `ctx` contiene un `Map` reutilizado al evaluar referencias dentro de la misma fila, de modo que `Q_HUSILLO` referenciado por `RENDIMIENTO` y por otro cálculo en debug se computa una sola vez. **Identidad de referencia**: las referencias se resuelven por `nombre` (no por `id`), lo que permite que el modelo embebido sobreviva a regeneraciones de UUIDs al importar/exportar.

### MEZCLAS como maestro opcional y tercera fuente del constructor
El maestro `MEZCLAS` (clave `MEZCLA`, propiedades `K_HUSILLO`, `DSO_EF`, `RHO_FILM`, `PCT_PCR`, `RESINA_DOMINANTE`) **no está en `CORE_MASTERS`**: el motor de Enrutamientos puede ejecutarse sin él. Sólo se exige cuando algún árbol activo de RS/RENDIMIENTO usa `fuente === "MEZCLAS"`; en ese caso el motor emite `MEZCLA_SIN_PROPIEDADES` para mezclas con demanda que no tienen ficha. Esto permite que los proyectos legacy (modelo con sólo `+ − × ÷ ^` sobre PC/SE) sigan funcionando sin cargar MEZCLAS. En el constructor de árboles, el `InputSelector` muestra tres columnas (PC, SE, MEZCLAS) pero filtra MEZCLA/RESINA_DOMINANTE del dropdown numérico. El schema dinámico de la tabla de salida `ENRUTAMIENTOS` añade columnas `MZ_*` solo si los árboles las usan (misma lógica que las existentes `PC_*`/`SE_*`).

### Modelo de cuellos: fuente embebida + plantilla CSV regenerable
El modelo de rendimiento por cuellos de botella se define **una sola vez** en `services/modeloCuellos.js` con helpers funcionales (`mul/div/cte/pc/se/mz/ref/minN/siAplica/or`) que producen árboles legibles. El botón "Cargar modelo por defecto" en `CalculosPage` invoca un upsert por NOMBRE contra esa lista embebida (no necesita fetch). La plantilla CSV física `public/plantillas/CALCULOS_MODELO_CUELLOS.csv` se mantiene como artefacto intercambiable y se **regenera con `scripts/gen_plantilla_modelo_cuellos.mjs`** desde la misma fuente embebida — evita duplicar la verdad. `RS` queda fuera del modelo: la plantilla nunca lo toca para no pisar la fórmula que el usuario ya tenga.

---

## Servicios JS

| Módulo | Función | Descripción |
|--------|---------|-------------|
| `csvParser.js` | `parseCsvFile(file)` | Lee File → PapaParse → store.setUpload |
| `csvParser.js` | `applyFilters(raw, filters)` | Filtra filas raw por operadores |
| `csvParser.js` | `applyMappingAndValidate(...)` | Mapea + valida tipos → informe |
| `engine.js` | `calculate({...})` | Motor de cálculo → store.setResults |
| `engine.js` | `calcularEnrutamientos({..., mezclas, calculos})` | Cruza Producto Simple/Doble × Mezcla × Extrusora × Setup. Resuelve fila de MEZCLAS por `PRODUCTO.MEZCLA → MEZCLAS[MEZCLA]`. RS redondeada a 2dp. Errores incluyen mezcla, extrusora y campos de fórmula (transitivos via referencias). |
| `engine.js` | `evaluarArbol(nodo, fila, ctx?)` | Evalúa AST de fórmula. Soporta: constante/nulo/campo/operacion/operacion_naria/si_aplica/booleana/referencia_calculo. Propaga `null` en aritmética; ignora null en min/max; ctx provee caché por fila y resolución de referencias por NOMBRE. |
| `engine.js` | `camposDeArbol(nodo, defs?)` | Recolecta `{fuente, campo}` usados por el árbol; sigue transitivamente las referencias entre cálculos cuando se pasan las definiciones. |
| `engine.js` | `ordenarCalculosPorDependencia(defs)` | Devuelve `{ orden, ciclos }`: orden topológico de cálculos (referenciados antes que referenciadores) y lista de ciclos detectados. |
| `exporter.js` | `exportToCsv(records)` | Genera y descarga CSV resultado |
| `exporter.js` | `exportLog(lines)` | Genera y descarga log TXT |
| `exporter.js` | `exportSetupExtrusoras(records, fechaRevision)` | CSV de extrusoras con metainfo (incluye D_DIE, COOLING_FACTOR, CORONA_KW, V_MAX_SOLDADOR, V_MAX_ABREFACIL) |
| `intermedias.js` | `calcularProductoComplejo(rows, reglas)` | Genera PRODUCTO_COMPLEJO desde reglas |
| `escenario0.js` | `calcularEscenario0({...})` | LP water-filling anual: asigna demanda a (variante,CM) minimizando ocupación pico |
| `modeloCuellos.js` | `MODELO_CUELLOS_DEFS` | Lista exportable con las 8 definiciones del modelo (Q_HUSILLO, Q_DSO, Q_LINEA, Q_POST_*, Q_POST, RENDIMIENTO). |
| `modeloCuellos.js` | `MODELO_CUELLOS_REQUIERE` | Variables externas requeridas agrupadas por maestro. Usado por el modal informativo. |
| `modeloCuellos.js` | `MODELO_CUELLOS_RANGOS` | Rangos típicos de calibración (K_HUSILLO, DSO_EF, RHO_FILM, COOLING_FACTOR). |
| `verificaciones.js` | `verificarRefsDemandaNoEnProducto(d, p)` | V1: refs en Demanda sin ficha en Producto |
| `verificaciones.js` | `verificarRefsSinMezcla(d, p)` | V2: refs con demanda cuya MEZCLA está vacía en Producto |
| `verificaciones.js` | `verificarMezclaSinEnrutamiento(d, p, e)` | V3: refs cuya mezcla no está en Enrutamiento |
| `verificaciones.js` | `verificarMezclasSinFicha(d, p, m)` | V4: mezclas con demanda sin ficha en el maestro MEZCLAS. Granularidad por MEZCLA única. |
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

### 2026-05-23 — v3.0 Sprint 13 / 14 / 15 — Modelo de rendimiento por cuellos de botella

Tres sprints implementados en bloque (estrictamente A → B → C por dependencia) que sustituyen la fórmula única de `RENDIMIENTO` por un modelo de cuellos de botella:

```
RENDIMIENTO [kg/h] = min(Q_HUSILLO, Q_DSO, Q_LINEA, Q_POST)
```

donde cada `Q_i` modela un subsistema físico (plastificación del husillo, cabezal+enfriamiento, estiraje, post-procesos: corona/soldador/abrefácil).

**Sprint 13 — Operadores avanzados en árboles (`engine.js` + `CalculosPage.jsx`):**
- Cinco nuevos tipos de `NodoFormula`: `operacion_naria` (min/max, ≥2 hijos), `nulo`, `si_aplica` (condición booleana → valor o null), `booleana` (and/or/not, NOT colapsa a un único operando), `referencia_calculo` (resuelta por `nombre`).
- `evaluarArbol(nodo, fila, ctx?)` propaga `null` aguas arriba en aritmética (`2 + null = null`), ignora null en n-arias (`min(5, 3, null) = 3`), aplica corto-circuito en booleanas, evalúa `si_aplica` sólo cuando la condición es truthy. El `ctx` lleva `calculosByNombre`, `cache: Map<nombre, resultado>` por fila, `errors` y `missingReported: Set<nombre>` para dedupe.
- `ordenarCalculosPorDependencia(defs)` con DFS y onStack detecta ciclos. Si `A` referencia a `B` y `B` a `A` → error `CICLO_EN_CALCULOS` antes de evaluar ninguna fila.
- `camposDeArbol(nodo, defs)` recolecta transitivamente los campos del árbol referenciado (con `visited` para cortar ciclos teóricos durante la recolección).
- Constructor visual: nuevos botones en `SlotVacio` (**Min, Max, Nulo, Si aplica, Booleano, Cálculo**); `NodoOperacionNaria` con "+ añadir hijo" (mínimo 2); `NodoSiAplica` con slot `condición` que se marca en rojo si no termina en boolean (`esCondicionBoolean`); `NodoBooleana` con selector AND/OR/NOT (transición NOT↔otros recompone hijos); `NodoReferenciaCalculo` con dropdown filtrado y badge rojo si el nombre referenciado no existe. Colores: azul (operación n-aria), gris (nulo), naranja (si_aplica), púrpura (booleana), azul claro (referencia).
- Enum `DEFINICION_CALCULO.nombre` ampliado a `{ RS | RENDIMIENTO | Q_HUSILLO | Q_DSO | Q_LINEA | Q_POST | Q_POST_CORONA | Q_POST_SOLDADOR | Q_POST_ABREFACIL | AUX_1 | AUX_2 | AUX_3 }`. RS y RENDIMIENTO siguen siendo los únicos obligatorios para habilitar "Calcular".
- Compatibilidad hacia atrás: cálculos previos con sólo `+ − × ÷ ^` sobre PC/SE siguen funcionando sin cambios (el `ctx` es opcional y no es necesario sin referencias).

**Sprint 14 — Maestro MEZCLAS y parámetros de rendimiento (`masterSchemas.js`, `SetupExtrusorasPage.jsx`, `verificaciones.js`):**
- Nuevo maestro `MEZCLAS` con schema: `MEZCLA` (clave, cruza con `PRODUCTO.MEZCLA`), `RESINA_DOMINANTE` (documental: LDPE/LLDPE/mLLDPE/HDPE/MIX), `PCT_PCR` (0-100, documental), `K_HUSILLO` (factor ~0,75-1,00), `DSO_EF` (Die Specific Output kg/h·mm, ~0,07-0,30), `RHO_FILM` (densidad sólido kg/m³, ~918-955). Registrado en `MASTER_NAMES`; **no incluido en CORE_MASTERS** (opcional, sólo necesario si las fórmulas usan campos de MEZCLAS). Tarjeta dedicada en `MaestrosPage` con tooltip de distintos; opción en `CargadorPage`.
- `SETUP_EXTRUSORAS` ampliado con cinco campos del modelo de cuellos: `D_DIE` (mm, diámetro del cabezal; no confundir con `HILERA` string), `COOLING_FACTOR` (multiplicador, ~1,0 single / 1,5 dual / 2,0 triple+chiller), `CORONA_KW` (potencia tratador, 0 si no hay), `V_MAX_SOLDADOR` (m/min), `V_MAX_ABREFACIL` (m/min). Nueva sección "Parámetros de rendimiento" en `ExtrusoraModal`. `SETUP_EXTRUSORAS_COLS` en `exporter.js` actualizado.
- MEZCLAS expuesto como **tercera fuente** en el constructor de árboles: el `InputSelector` muestra 3 columnas (PC, SE, MEZCLAS), filtrando MEZCLA/RESINA_DOMINANTE del dropdown numérico. `enrutamientosSchema.schemaDeDefiniciones` extendido para emitir columnas `MZ_*` cuando los árboles activos usan campos de MEZCLAS.
- `engine.calcularEnrutamientos` acepta `mezclas` (nuevo parámetro). Por cada fila resuelve `PRODUCTO_COMPLEJO.REFERENCIA → PRODUCTO.MEZCLA → MEZCLAS[MEZCLA]` y rellena los campos requeridos. Si el árbol activo usa MEZCLAS y la mezcla no tiene ficha → error `MEZCLA_SIN_PROPIEDADES` (deduplicado por mezcla).
- **V4 — `verificarMezclasSinFicha(demanda, producto, mezclas)`** en `verificaciones.js`: granularidad por MEZCLA única, columnas `MEZCLA · n_REFERENCIAS_AFECTADAS`. Tarjeta en `VerificacionesPage` con el mismo diseño que V1-V3. Key `MEZCLAS_SIN_FICHA` añadida al store.

**Sprint 15 — Definiciones por defecto del modelo (`modeloCuellos.js` + plantilla CSV):**
- `services/modeloCuellos.js`: definiciones embebidas en código con helpers funcionales (`mul/div/cte/pc/se/mz/ref/minN/siAplica/or`) que producen árboles legibles. Ocho definiciones: `Q_HUSILLO`, `Q_DSO`, `Q_LINEA`, `Q_POST_CORONA`, `Q_POST_SOLDADOR`, `Q_POST_ABREFACIL`, `Q_POST` (min de los tres post), `RENDIMIENTO` (min de los cuatro cuellos). El `id` interno coincide con el `nombre` para que las referencias entre cálculos sobrevivan a regeneraciones de UUIDs. RS queda fuera de la plantilla: el modelo no depende de RS.
- Botón "**CARGAR MODELO POR DEFECTO**" en cabecera de `CalculosPage` con modal de confirmación que enumera los cálculos a añadir/reemplazar. Hace upsert por `nombre` preservando el `id` del cálculo existente.
- Botón "**i**" informativo abre modal con: variables requeridas agrupadas por maestro, advertencia de prerequisitos, tabla de rangos típicos (K_HUSILLO ∈ [0,75; 1,00], DSO_EF ∈ [0,07; 0,30] kg/h·mm, RHO_FILM ∈ [918; 955] kg/m³, COOLING_FACTOR ∈ [1,0; 2,0]).
- Plantilla CSV en `public/plantillas/CALCULOS_MODELO_CUELLOS.csv` con la serialización JSON minified de los 8 árboles. **Regenerable** desde la fuente única (`modeloCuellos.js`) con `scripts/gen_plantilla_modelo_cuellos.mjs` (mismo formato que produce `exporter.exportCalculos`). El botón de importación CSV existente (`autoImportCalculos`) hace upsert por `nombre` y por tanto también acepta esta plantilla.
- Nuevo error `CALCULO_AUXILIAR_FALTANTE`: cuando un nodo `referencia_calculo` apunta a un nombre sin definir, el motor emite el error una sola vez (dedupe via `missingReported`) y la referencia devuelve `null`; el cálculo padre sigue evaluándose con los Q_* disponibles (si todos faltan → RENDIMIENTO = null).

**Archivos nuevos/modificados:**
- Nuevos: `services/modeloCuellos.js`, `scripts/gen_plantilla_modelo_cuellos.mjs`, `public/plantillas/CALCULOS_MODELO_CUELLOS.csv`.
- Modificados: `services/engine.js` (AST, ciclos, refs, mezclas), `services/verificaciones.js` (+V4), `services/exporter.js` (cols SE), `masterSchemas.js` (MEZCLAS + SE), `state.js` (registro MEZCLAS + key V4), `utils/enrutamientosSchema.js` (MZ_* + transitiva), `pages/CalculosPage.jsx` (rediseño completo del constructor), `pages/SetupExtrusorasPage.jsx` (sección PR), `pages/MaestrosPage.jsx` (tarjeta MEZCLAS), `pages/CargadorPage.jsx` (MEZCLAS), `pages/VerificacionesPage.jsx` (V4), `pages/IntermediasCalculadasPage.jsx` (pasa mezclas y tipos MEZCLAS).

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
