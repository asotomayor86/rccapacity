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
