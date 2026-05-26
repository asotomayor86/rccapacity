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

---

## Pendiente

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
