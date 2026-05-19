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
