# BACKLOG — RCCapacity

> Registro de sprints completados y trabajo pendiente.

---

## Completado

### Sprint 1–3 (2026-05-09) — v1.0 → v2.0
- Backend FastAPI + migración client-side completa
- Motor de cálculo JS (`engine.js`): CARGA, OCUPACION por CM × MES × REFERENCIA
- Importador CSV wizard 4 pasos (upload → mapeo → validación → import)
- Maestros: DEMANDA, PRODUCTO, ENRUTAMIENTO_MEZCLAS, CALENDARIO
- Resultados: tabla ordenable, color-coding ocupación, exportación CSV + log

### Sprint 4 (2026-05-09) — v2.1
- Agregación DEMANDA por MES+REFERENCIA en importMaster
- MasterViewer: modal paginado con filtros por columna
- Motor reescrito con campo ASIGNACION

### Sprint 5–6 (2026-05-10) — v2.2 / v2.3
- Módulo Setup Extrusoras (21 campos, metainfo _META_*)
- Invariante ES_ACTUAL por scope NOMBRE_EXTRUSORA
- Modal editable con modo vista/edición y campos protegidos
- Reglas: PRODUCTO_A_COMPLEJO y ENRUTAMIENTO_A_FACTIBLE
- Intermedias: PRODUCTO_COMPLEJO calculado desde reglas
- Intermedias Calculadas: ENRUTAMIENTOS y ENRUTAMIENTOS_FACTIBLES

### Sprint 7 (2026-05-19) — v2.4
- **Sección VERIFICACIONES** en nav (entre MAESTROS y REGLAS)
  - V1: Referencias en Demanda no encontradas en Producto (`REFS_SIN_PRODUCTO`)
  - V2: Referencias con demanda sin mezcla asignada en Producto (`REFS_SIN_MEZCLA`)
  - V3: Referencias con demanda sin asignación MO>EX (`REFS_SIN_ENRUTAMIENTO`)
- Tarjetas idénticas en diseño a Intermedias (badge OK/ALERTAS/SIN DATOS, color ámbar en alerta)
- `verificaciones.js`: 3 funciones puras, granularidad por REFERENCIA única
- Estado en Zustand: `verificaciones` + `setVerificacion`

### Sprint 8 (2026-05-19) — v2.5
- **IntermediasCalculadas — Ver errores en tarjeta**: eliminados los paneles CollapsibleLog independientes; cada tarjeta tiene ahora 4 botones (Calcular · Visualizar · Exportar CSV · Ver errores). "Ver errores" abre MasterViewer. Tarjeta ENRUTAMIENTOS se vuelve ámbar cuando hay errores de cálculo.
- **Producto Simple y Doble**: renombrada la tabla intermedia (antes "Producto Complejo"). El cálculo ahora filtra PRODUCTO a solo las referencias con demanda antes de generar variantes Simple/Doble. El filtro se aplica tanto desde IntermediasPage como desde el preview en ReglasProductoComplejoPage.
- **Tooltip de valores distintos en Maestros**: al pasar el cursor sobre un campo de un maestro cargado, aparece un tooltip flotante con el número de valores distintos (non-null) de ese campo en los registros.

### Sprint 9 (2026-05-19) — v2.6
- **CSS separado como `estilos.css`**: Vite plugin singlefile configurado para solo incrustar JS; CSS se genera como `dist/estilos.css` referenciado con ruta relativa (`./estilos.css`). La carpeta `frontend/public/` copia archivos estáticos a `dist/` en cada build. Plugin `stripCrossorigin` elimina el atributo `crossorigin` del `<link>` para compatibilidad con `file://`.
- **Modo claro / modo oscuro**: toggle sol/luna en el lateral. Preferencia persistida en localStorage. Tema aplicado con `data-theme` en `<html>`. Variables CSS por tema: `--card-success-bg/border`, `--card-warning-bg/border`, `--border-dim`. Todos los colores hardcodeados en JSX reemplazados por variables CSS.

### Sprint 10 (2026-05-19) — v2.7
- **Identidad visual Walki Plasbel**: paleta rediseñada con colores corporativos. Oscuro: fondo navy `#05101e`, acento azul brillante `#009ee1`. Claro: fondo `#f4f9ff`, acento `#0047a1`, texto `#00253d` (alineado con walki.com y plasbel.com). `btn-primary` pasa a texto blanco. Alertas con texto adaptado para legibilidad en modo claro.
- **Logo corporativo en nav**: `<img src="./logo.png">` en la cabecera lateral por encima de "RCCapacity". Logo guardado en `frontend/public/logo.png` (copiado automáticamente a `dist/` en cada build). En modo oscuro se aplica filtro `brightness(0) invert(1)` para visibilidad sobre fondo navy; en modo claro muestra colores originales. Se oculta automáticamente si el fichero no existe (`onError`).
- **`estilos_old.css`**: tema anterior ámbar/industrial conservado en `frontend/public/estilos_old.css` y disponible en `dist/` en cada build.

### Sprint 11 (2026-05-19) — v2.8
- **RS redondeada a 2 decimales**: `Math.round(rs * 100) / 100` aplicado al almacenar `RS_CALCULADA` en cada fila de ENRUTAMIENTOS.
- **Columnas dinámicas en viewer de errores**: el viewer de "Ver errores" en la tarjeta ENRUTAMIENTOS ahora muestra columnas que se adaptan automáticamente a la fórmula activa.
  - Columnas fijas siempre presentes: `TIPO · REFERENCIA · MEZCLA · EXTRUSORA · DESCRIPCIÓN`
  - Para `MEZCLA_NO_RESUELTA`, `SIN_EXTRUSORAS_EM`, `SIN_SETUP`: columnas fijas con los datos disponibles en cada caso.
  - Para `RS_NULA` y `RENDIMIENTO_NULO`: además de las fijas, una columna por cada campo que entra en la fórmula activa (se leen de los árboles `camposPC` + `camposSE` en tiempo de ejecución). Si la fórmula cambia y se recalcula, las columnas cambian solas sin redespliegue.
  - Schema derivado dinámicamente con `buildErrorSchema(errors)` + `useMemo` en la página. Tipos resueltos vía `MASTER_SCHEMAS_META`.

### Sprint 12 (2026-05-19) — v2.9
- **Escenario 0 — Rough Cut Capacity Anual** en ResultadosPage (sustituye al antiguo "Ejecutar cálculo"):
  - **Modelo LP continuo**: para cada referencia base R con demanda anual Q[R] kg, la variable `f[R,v,c]` (fracción asignada a variante v en CM c) es continua ≥ 0. Una referencia puede repartirse entre múltiples CMs y entre variante Simple y Doble, siempre que la suma total sea el 100 % de su demanda (sin doble conteo de producción). Objetivo bifásico: minimizar primero la ocupación pico de cualquier CM, luego la suma total de ocupaciones.
  - **Algoritmo**: water-filling entrópico con blending (LR=0.15). 300 iteraciones, temperatura decrece de 1.0 a 0 (annealing). Guarda la mejor solución encontrada. Cede control al UI cada 15 iteraciones.
  - **Entradas**: ENRUTAMIENTOS_FACTIBLES (FACTIBLE=SI, ES_ACTUAL=true), DEMANDA anualizada (suma de kg por referencia), CALENDARIO anualizado (suma de HORAS_EFICIENTES por CM).
  - **Barra de progreso** animada con mensaje de iteración y % de ocupación pico en tiempo real.
  - **3 KPIs** tras el cálculo: ocupación pico (color), horas disponibles totales, horas cargadas totales.
  - **Pestaña "Resumen por CM"**: tabla ordenable con HORAS DISPONIBLES / HORAS CARGADAS / OCUPACIÓN.
  - **Pestaña "Detalle por referencia"**: tabla ordenable + búsqueda + paginación (100 filas) con columnas REFERENCIA / VARIANTE (badge Simple/Doble) / CM / KG DEMANDA / KG ASIGNADOS / % ASIGNADO / RENDIMIENTO / HORAS REQUERIDAS / OCUPACIÓN CM.
  - Estado en Zustand: `escenario0` + acción `setEscenario0`.
  - Servicio independiente: `escenario0.js`.

### Sprint 13 — Operadores avanzados en árboles (Sprint A del modelo de cuellos) (2026-05-23)
- **Nuevos tipos de nodo** en `NodoFormula` (engine.js): `operacion_naria` (min/max n-arios), `nulo`, `si_aplica` (condición boolean → valor o null), `booleana` (and/or/not), `referencia_calculo` (resolución a otro cálculo por NOMBRE).
- **evaluarArbol** ampliado:
  - `min`/`max` ignoran hijos null; todos null → null.
  - Aritmética propaga null (`2 + null = null`, `0 × null = null`).
  - `si_aplica(false|null, v) = null`; `si_aplica(true, v) = evaluar(v)`.
  - `and`/`or` con corto-circuito; `not` propaga null.
  - `referencia_calculo` resuelve por NOMBRE, cachea resultados por fila vía `ctx`.
- **ordenarCalculosPorDependencia** con detección de ciclos vía DFS. Si hay ciclo → error `CICLO_EN_CALCULOS` antes de evaluar.
- **camposDeArbol** sigue transitivamente referencias y maneja todos los nuevos tipos. Recibe la lista completa de definiciones para resolución cruzada.
- **UI del constructor** en `CalculosPage`: nuevos botones (Min, Max, Nulo, Si aplica, Booleano, Cálculo) en slot vacío; `NodoOperacionNaria` con "+ añadir hijo"; `NodoSiAplica` con slot condición/valor y validación visual roja si la condición no termina en boolean; `NodoBooleana` con selector AND/OR/NOT (NOT colapsa a un único operando); `NodoReferenciaCalculo` con desplegable filtrado y badge rojo si la referencia no existe. Colores: azul (operación n-aria), gris (nulo), naranja (si_aplica), púrpura (booleana), azul claro (referencia).
- **Enum NOMBRE** ampliado: `{ RS | RENDIMIENTO | Q_HUSILLO | Q_DSO | Q_LINEA | Q_POST | Q_POST_CORONA | Q_POST_SOLDADOR | Q_POST_ABREFACIL | AUX_1 | AUX_2 | AUX_3 }`. Solo RS y RENDIMIENTO siguen siendo prerequisito de cálculo.
- **Compatibilidad hacia atrás**: cálculos previos con sólo `+ − × ÷ ^`, sin referencias y sin MEZCLAS siguen funcionando sin cambios.

### Sprint 14 — Maestro MEZCLAS y parámetros de rendimiento (Sprint B del modelo de cuellos) (2026-05-23)
- **Nuevo maestro MEZCLAS** (schema en `masterSchemas.js`): MEZCLA · RESINA_DOMINANTE · PCT_PCR · K_HUSILLO · DSO_EF · RHO_FILM. Registrado en `state.MASTER_NAMES`; tarjeta dedicada en MaestrosPage (no incluido en CORE_MASTERS porque es opcional); opción en CargadorPage para importación asistida/automática; cruza con `PRODUCTO.MEZCLA`.
- **Ampliación de SETUP_EXTRUSORAS** con cinco campos para el modelo de cuellos: D_DIE (mm), COOLING_FACTOR (factor sobre baseline single-lip), CORONA_KW (potencia tratador), V_MAX_SOLDADOR (m/min), V_MAX_ABREFACIL (m/min). Nueva sección "Parámetros de rendimiento" en el modal de SetupExtrusorasPage. Export CSV (`SETUP_EXTRUSORAS_COLS`) actualizado para incluirlos.
- **MEZCLAS como cuarta fuente** en el constructor de árboles: el `InputSelector` ahora muestra tres columnas (PC, SE, MEZCLAS) y permite campos `MEZCLAS.K_HUSILLO`, `.DSO_EF`, `.RHO_FILM`, `.PCT_PCR` (MEZCLA y RESINA_DOMINANTE son string, excluidos del dropdown numérico).
- **engine.calcularEnrutamientos** acepta `mezclas` como nuevo parámetro. Resuelve por fila `PRODUCTO_COMPLEJO.REFERENCIA → PRODUCTO.MEZCLA → MEZCLAS[MEZCLA]` y rellena la fila con los campos requeridos. Si una mezcla con demanda no está en el maestro y el árbol activo usa campos de MEZCLAS → error `MEZCLA_SIN_PROPIEDADES`. Schema dinámico de ENRUTAMIENTOS (`enrutamientosSchema.schemaDeDefiniciones`) incluye columnas MZ_* cuando los árboles las usan.
- **V4 · MEZCLAS SIN FICHA EN MAESTRO MEZCLAS** (`MEZCLAS_SIN_FICHA`): nueva verificación en `verificaciones.js` con granularidad por MEZCLA única (columnas MEZCLA · n_REFERENCIAS_AFECTADAS). Tarjeta en VerificacionesPage con mismo diseño que V1-V3. Key añadida al store.

### Sprint 15 — Definiciones por defecto del modelo de cuellos (Sprint C) (2026-05-23)
- **`services/modeloCuellos.js`** con el modelo embebido en código (helpers `mul/div/cte/pc/se/mz/ref/minN/siAplica/or` para construir árboles legibles). Definiciones: Q_HUSILLO, Q_DSO, Q_LINEA, Q_POST_CORONA, Q_POST_SOLDADOR, Q_POST_ABREFACIL, Q_POST y RENDIMIENTO (8 cálculos; RS queda fuera porque la plantilla no toca su definición existente).
- **Botón "CARGAR MODELO POR DEFECTO"** en cabecera de CalculosPage. Modal de confirmación que enumera los cálculos a añadir y marca explícitamente cuáles serán reemplazados si ya existen con el mismo NOMBRE. Upsert por NOMBRE preservando el `id` interno del cálculo existente.
- **Botón "i" informativo** junto al botón anterior. Abre modal con: lista de variables requeridas agrupadas por maestro, advertencia sobre prerequisitos, tabla de rangos típicos (K_HUSILLO ∈ [0,75 ; 1,00]; DSO_EF ∈ [0,07 ; 0,30] kg/h·mm; RHO_FILM ∈ [918 ; 955] kg/m³; COOLING_FACTOR ∈ [1,0 ; 2,0]).
- **Plantilla CSV física** en `frontend/public/plantillas/CALCULOS_MODELO_CUELLOS.csv` con la serialización JSON de los 8 árboles. Generada por `scripts/gen_plantilla_modelo_cuellos.mjs` (regenerable). Cargable también vía el botón existente "⬆ Importar" — el handler hace upsert por NOMBRE.
- **CALCULO_AUXILIAR_FALTANTE**: cuando un nodo `referencia_calculo` apunta a un NOMBRE sin definir, el motor emite un error tipo `CALCULO_AUXILIAR_FALTANTE` (deduplicado por id) y el referencia devuelve null; el cálculo padre sigue evaluándose con los Q_* disponibles.

### Sprint 17 — Wrap controlado en el constructor de fórmulas (2026-06-01)
- **Enfoque C** (mejorar el wrap). Solo se reordenan nodos `operacion` existentes; sin tipos de nodo nuevos. Único fichero tocado: `src/pages/CalculosPage.jsx`. Motor, `formulaTexto`, export/import CSV y `modeloCuellos.js` intactos; compatibilidad total con cálculos guardados.
- **`WrapButton` reutilizable**: el botón `( )` abre un popover inline con selector de operador (`+ − × ÷ ^`) y toggle de lado (`x∘▢` / `▢∘x`). Al confirmar crea `{ tipo: "operacion", operador, hijos: side === "left" ? [nodo, null] : [null, nodo] }`. Sustituye al antiguo wrap fijo (`*`, siempre a la izquierda).
- **Wrap universal**: `WrapButton` añadido a **todos** los nodos —hojas (`campo`, `constante`, `nulo`, `referencia_calculo`) vía el componente compartido `NodoActions`, y compuestos (`operacion`, `operacion_naria`, `si_aplica`, `booleana`) en su cabecera. Ahora se puede envolver cualquier subárbol y la **raíz**, permitiendo que la fórmula crezca hacia afuera.
- **Desenvolver (unwrap)**: en `NodoOperacion`, acciones **"⤺ izq"** / **"der ⤻"** que reemplazan el nodo por uno de sus hijos (`onReplace(nodo.hijos?.[lado] ?? null)`), deshabilitadas cuando ese hijo es null. Inverso exacto del wrap: quita un nivel de paréntesis en cualquier punto.
- **Refactor**: los tres bloques duplicados `( )` + `✕` de las hojas unificados en `NodoActions`.
- **Fuera de alcance** (enfoques A/B no elegidos): preview sin paréntesis redundantes en `formulaTexto`; suma/producto n-ario. La Fase 3 (agrupar selección en nodos n-arios) queda pendiente para una iteración futura.

### Sprint 18 — Constructor lineal de fórmulas (reemplaza el árbol) (2026-06-01)
- **Cambio de paradigma**: el constructor visual de árbol se sustituye por un **constructor lineal de fichas** (tokens) que se construye de izquierda a derecha: `(` · `)` · operador (`+ − × ÷ ^`) · **+ Campo** · **+ Constante** · **+ Cálculo** (referencia). Más sencillo y con control literal de los paréntesis. Reemplaza por completo el Sprint 17 (wrap) y todos los componentes `Nodo*`/`WrapButton`/`InputSelector`.
- **Compilación tokens → AST** (`compilarTokens`, shunting-yard con validación de estado): la secuencia infija se compila a la **misma AST existente** (`operacion`/`campo`/`constante`/`referencia_calculo`) con **precedencia matemática estándar** (`^` > `× ÷` > `+ −`, `^` derecha-asociativo) respetando los paréntesis explícitos. El motor (`evaluarArbol`), export/import CSV y `modeloCuellos.js` **no cambian**: el `arbol` sigue siendo la fuente de verdad. Validación en vivo con mensajes legibles; "Guardar" deshabilitado si la expresión no es válida.
- **Persistencia**: la definición guarda además `tokens` (ayuda de edición); `arbol` se recompila desde los tokens en cada guardado. El export CSV sigue serializando solo `ARBOL_JSON` (sin cambios de formato).
- **Round-trip de definiciones antiguas/importadas** (`linearizar`): si una definición solo tiene `arbol` (cargada por "Cargar modelo" o importada por CSV), se intenta convertir a tokens. Si es aritmética pura → editable; si usa nodos avanzados (min/max, si_aplica, booleana) → se muestra en **solo lectura** con aviso, y un botón "Reconstruir con el constructor lineal" permite empezar de cero.
- **`formulaTexto` precedencia-aware**: el preview ahora muestra **paréntesis mínimos** (antes envolvía cada operación binaria). Mantiene el render de los nodos avanzados para el modo solo-lectura.
- **Simplificación**: eliminado el paso de seleccionar "inputs" (el selector de campos ofrece directamente todos los campos de PRODUCTO_COMPLEJO / SETUP_EXTRUSORAS / MEZCLAS; el motor ya deriva los campos del árbol, no de `inputs`). La definición conserva `inputs: []` por compatibilidad.
- **Limitación aceptada**: el constructor lineal no expresa min/max, si_aplica ni and/or/not; esas fórmulas (modelo de cuellos) se cargan con "Cargar modelo por defecto" pero no se editan desde la UI. Único fichero modificado: `src/pages/CalculosPage.jsx`.

### Sprint 19 — MIN(), nombres libres y simplificación de maestros (2026-06-06)

Versión previa al inicio de despliegues a usuarios. Cambia la forma de calcular rendimientos: se retira el modelo de cuellos embebido y el usuario construye RENDIMIENTO a su manera con `MIN()`.

**Herramienta de cálculos:**
- **Operador `MIN()`** (n-ario) en el constructor lineal: botones **MIN(** y **`,`**. El parser pasa de shunting-yard a **descenso recursivo** (`expr/term/factor/base`) para soportar funciones; `MIN(a, b, …)` compila a `operacion_naria` (operador `min`, ≥2 args), que el motor ya evalúa como mínimo ignorando nulos. `linearizar` convierte min/max a tokens (round-trip). `tokensTexto` y `Chip` muestran `min(` y `,` con color teal. Validación: mín. 2 argumentos, paréntesis de función balanceados.
- **Nombres editables**: el desplegable de NOMBRE pasa de enum cerrado a **RS · RENDIMIENTO · OTRO (personalizado)**. RS y RENDIMIENTO siguen siendo fijos (viajan a las intermedias, los localiza el motor por nombre exacto). Con OTRO se escribe nombre libre (cálculo intermedio), con validación: no vacío, no chocar con RS/RENDIMIENTO ni con otro cálculo existente.

**Maestros:**
- **MEZCLAS reducido a solo `MEZCLA`** (schema en `masterSchemas.js`). Se deja casi deshabilitado, previsto para reactivar cuando haya cálculos basados en mezcla. El motor sigue aceptando `mezclas` pero queda inerte (ningún cálculo usa campos MZ). Verificación **V4 (MEZCLAS SIN FICHA) se mantiene** (solo necesita la columna MEZCLA). Actualizada la tarjeta de MaestrosPage.
- **SETUP_EXTRUSORAS restaurado** a las columnas operativas (las del CSV histórico), quitando los 5 parámetros de rendimiento (`D_DIE`, `COOLING_FACTOR`, `CORONA_KW`, `V_MAX_SOLDADOR`, `V_MAX_ABREFACIL`) del schema, del export (`SETUP_EXTRUSORAS_COLS`), de la sección "Parámetros de rendimiento" del modal (`SetupExtrusorasPage`) y del selector de campos del constructor.
- **Nuevo campo `CTE_DADO`** (decimal, "Cte. dado") en SETUP_EXTRUSORAS: schema, export, modal (sección "Capacidades", junto a Hilera) y selector de campos del constructor. Constante por extrusora disponible para las fórmulas de rendimiento.

**Retirada del modelo de cuellos de botella** (decisión: eliminarlo por completo):
- Borrados `services/modeloCuellos.js` y `pages/ayuda/contenido/rendimiento.md`.
- `CalculosPage`: fuera el botón "Cargar modelo por defecto", el botón "i", ambos modales (`ConfirmModeloModal`, `ModeloInfoModal`) y el estado/handlers asociados.
- `AyudaPage`: retirada la sección "Cálculo de rendimiento".
- `mdRenderer`: eliminados los bloques y marcadores `{{MODELO_CUELLOS_*}}`.

**Limpieza**: eliminados también los huérfanos `public/plantillas/CALCULOS_MODELO_CUELLOS.csv` y `scripts/gen_plantilla_modelo_cuellos.mjs`.

---

## Pendiente

### Sprint 16 — Panel de ayuda contextual (v1)

Primer corte del panel lateral de ayuda. Tres secciones iniciales: **Flujo de trabajo**, **Maestros**, **Cálculo de rendimiento**.

**Decisiones de diseño tomadas:**
- **Disparador**: nueva entrada `AYUDA` en `NAV_ITEMS` (`App.jsx`). El handler NO navega a una ruta — abre un drawer overlay. Estado controlado en `AppInner` (`useState ayudaAbierta`).
- **Layout del drawer**: panel derecho overlay sobre `.main-content` (no afecta a `StatusBar`). Ancho fijo ~420px en desktop, full-width en móvil. Las 3 secciones se presentan en **acordeón apilado**: cabecera siempre visible, contenido colapsable. Solo una abierta a la vez (acordeón exclusivo) con la primera expandida por defecto. Cerrable con: botón ✕, tecla Esc, click en backdrop.
- **Contenido**: tres ficheros Markdown en `src/pages/ayuda/contenido/` (`flujo.md`, `maestros.md`, `rendimiento.md`), importados como strings vía `?raw` de Vite. Parseo con **mini-renderer propio** (sin librerías externas, alineado con `standard_layout.md`): subset reducido — `#`/`##`/`###`, `**negrita**`, `*cursiva*`, `` `código` ``, listas `-`/`1.`, tablas pipe `| a | b |`, citas `>`, separador `---`, párrafos. Implementado en `src/pages/ayuda/mdRenderer.jsx` (~150 líneas).
- **Tono**: mixto — operativo por defecto (1-3 frases por bloque) + secciones expandibles `Ver más` (sintaxis markdown propia: `<!-- detalles -->` … `<!-- /detalles -->`, gestionado por el mini-renderer como bloque colapsable inline).
- **Sin duplicación con el código**: el contenido textual vive en MD, pero las listas de columnas de maestros y la tabla de rangos del modelo de cuellos se inyectan dinámicamente. El renderer interpreta marcadores especiales `{{MAESTRO:DEMANDA}}`, `{{MAESTRO:PRODUCTO}}`, etc., y `{{MODELO_CUELLOS_RANGOS}}`, `{{MODELO_CUELLOS_REQUIERE}}` resolviéndolos contra `MASTER_SCHEMAS_META` y `modeloCuellos.js`. Así si se añade una columna a un maestro o un rango al modelo, la ayuda se actualiza sola.

**Contenido de cada sección (alcance v1):**
- **Flujo de trabajo**: orden canónico Maestros → Verificaciones → Reglas → Intermedias (PC) → Cálculos → Intermedias calculadas (ENRUTAMIENTOS) → Setup extrusoras → Resultados (Escenario 0). Mini-stepper visual + qué hace cada paso + dependencias (qué necesita cargado antes). Sin links de navegación (mantenemos el drawer puro de lectura en v1).
- **Maestros**: los 4 core (DEMANDA, PRODUCTO, ENRUTAMIENTO_MEZCLAS, CALENDARIO) + MEZCLAS (opcional) + SETUP_EXTRUSORAS + PRODUCTO_COMPLEJO (derivado). Por cada uno: para qué sirve, columnas con tipo (auto), cruces clave (`PRODUCTO.MEZCLA → MEZCLAS.MEZCLA`, `DEMANDA.REFERENCIA → PRODUCTO.REFERENCIA`, etc.), señal de obligatorio vs opcional.
- **Cálculo de rendimiento**: fórmula `RENDIMIENTO = min(Q_HUSILLO, Q_DSO, Q_LINEA, Q_POST)`, cada cuello con su fórmula y unidades (auto desde `MODELO_CUELLOS_DEFS`), variables requeridas agrupadas por maestro (`MODELO_CUELLOS_REQUIERE`), tabla de rangos típicos (`MODELO_CUELLOS_RANGOS`), explicación de propagación de null y `si_aplica` para los Q_POST condicionales.

**Archivos nuevos:**
- `src/pages/ayuda/contenido/flujo.md`
- `src/pages/ayuda/contenido/maestros.md`
- `src/pages/ayuda/contenido/rendimiento.md`
- `src/pages/ayuda/mdRenderer.jsx`
- `src/components/AyudaDrawer.jsx`

**Archivos modificados:**
- `src/App.jsx` — entrada `AYUDA` en `NAV_ITEMS` con handler `onClick` en vez de `to`, estado `ayudaAbierta` en `AppInner`, listener Esc, render condicional de `<AyudaDrawer />`.
- `src/index.css` — clases `.ayuda-drawer`, `.ayuda-backdrop`, `.ayuda-accordion-item`, `.ayuda-md-*`. Sin colores hardcodeados (todo con `var(--...)`).

**Fuera de alcance (v2+):** búsqueda dentro de la ayuda, tour guiado paso a paso, tooltips inline en otros componentes, internacionalización, más secciones (verificaciones, reglas, escenario 0).

---

### Visualizaciones (Recharts instalado, sin usar)
- Dashboard de ocupación por CM y período (barras apiladas)
- Vista de tendencia de demanda por referencia (líneas)
- Heatmap CM × MES con color-coding de ocupación

### Mejoras de flujo
- Indicador de verificaciones con alertas en la barra de estado (StatusBar)
- Auto-invalidar verificaciones al reimportar maestros afectados
- Exportar resultado de verificaciones a CSV

### Futuro / Sin prioridad
- Persistencia local (localStorage o IndexedDB)
- Autenticación básica
- Más verificaciones: referencias sin CALENDARIO, extrusoras sin cobertura RS
- **Coextrusión multicapa** (extensión del modelo de cuellos):
  - Nuevo maestro `RECETAS_COEX` con campos por capa: `RECETA_ID`, `NUMERO_CAPA`, `MEZCLA_CAPA`, `PCT_CAPA`, `EXTRUSORA_ASIGNADA`.
  - PRODUCTO con campo opcional para enlazar a una receta de coex.
  - Motor de ENRUTAMIENTOS calcula `Q_HUSILLO` por capa y aplica `Q_HUSILLO_COEX = min_i (Q_HUSILLO_i / PCT_CAPA_i)`.
  - Los demás cuellos (Q_DSO, Q_LINEA, Q_POST) se calculan a nivel de línea común una sola vez.
  - Requiere ampliar el motor para iterar por extrusoras de la línea, agruparlas por RECETA y resolver MEZCLA por capa.
