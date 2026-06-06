RCCapacity trabaja con **7 maestros** entre fuentes originales y tablas derivadas. Los 4 primeros son obligatorios para el motor; los demás cubren casos específicos.

## DEMANDA

Unidades demandadas por mes y referencia. Es el punto de partida: solo se calculan referencias que aparecen aquí. Al importar, se agrega por `MES + REFERENCIA` (si el CSV trae duplicados, se suman).

{{MAESTRO:DEMANDA}}

## PRODUCTO

Catálogo de referencias con sus atributos físicos. Cruza con DEMANDA por `REFERENCIA` y con MEZCLAS por `MEZCLA`. El campo `TIPO` define si la referencia se expande a variante Simple, Doble o ambas en las reglas de Producto Complejo.

{{MAESTRO:PRODUCTO}}

<!-- detalles -->
- `ANCHO (MM)` es el ancho extendido del film, no el ancho de cabezal (eso vive en SETUP_EXTRUSORAS como `D_DIE`).
- `MEZCLA` debe coincidir literalmente con la clave del maestro MEZCLAS y con la columna `MEZCLA` de ENRUTAMIENTO_MEZCLAS.
- Campos `TRATAMIENTO` y `ABREFACIL` son señales: activan los cuellos `Q_POST_CORONA` y `Q_POST_ABREFACIL` del modelo de rendimiento.
<!-- /detalles -->

## ENRUTAMIENTO_MEZCLAS

Define qué extrusoras pueden producir cada mezcla y con qué rango de RS. Una mezcla puede asignarse a varias extrusoras; cada combinación tiene su rango propio.

{{MAESTRO:ENRUTAMIENTO_MEZCLAS}}

<!-- detalles -->
`RS MIN` y `RS MÁXIMO` definen la ventana operativa: si la RS calculada para una combinación cae fuera del rango, ENRUTAMIENTOS la marca como no factible. `GMAX SOLDADURA` es el grosor máximo permitido cuando la referencia requiere soldadura longitudinal.
<!-- /detalles -->

## CALENDARIO

Horas disponibles por centro de mecanizado (CM) y mes. Usado por el Escenario 0 para calcular la capacidad anual de cada CM.

{{MAESTRO:CALENDARIO}}

<!-- detalles -->
`HORAS_EFICIENTES` = `HORAS_TOTALES` × `EFICIENCIA`. Es el campo que el motor usa realmente. Si no se proporciona, se rechaza la fila. El Escenario 0 agrega por CM sumando todos los meses del año.
<!-- /detalles -->

## MEZCLAS (opcional)

Propiedades físicas de cada mezcla para el modelo de cuellos de botella. Solo es necesario si las fórmulas activas usan campos de esta fuente (típicamente RENDIMIENTO con el modelo de cuellos).

{{MAESTRO:MEZCLAS}}

<!-- detalles -->
- `K_HUSILLO`: factor de eficiencia del husillo para la mezcla (~0,75-1,00).
- `DSO_EF`: Die Specific Output en kg/h por mm de perímetro de hilera (~0,07-0,30).
- `RHO_FILM`: densidad del film sólido en kg/m³ (~918-955).
- `PCT_PCR` y `RESINA_DOMINANTE` son documentales — no entran en las fórmulas estándar.
<!-- /detalles -->

## SETUP_EXTRUSORAS

Configuraciones físicas de cada extrusora. Una extrusora puede tener varias configuraciones (`NOMBRE_EXTRUSORA` agrupa); exactamente **una** debe estar marcada como `ES_ACTUAL=true` por extrusora — esa es la que usa el motor.

{{MAESTRO:SETUP_EXTRUSORAS}}

<!-- detalles -->
Los últimos cinco campos (`D_DIE`, `COOLING_FACTOR`, `CORONA_KW`, `V_MAX_SOLDADOR`, `V_MAX_ABREFACIL`) son los parámetros del modelo de cuellos. El modal de Setup Extrusoras los agrupa en la sección "Parámetros de rendimiento".

La invariante `ES_ACTUAL` tiene **scope por extrusora**: una extrusora con 3 configuraciones tiene exactamente un `true` entre ellas, independientemente de otras extrusoras. Al importar un CSV que la viola, el sistema corrige automáticamente y deja un warning en el log.
<!-- /detalles -->

## PRODUCTO_COMPLEJO (derivado)

Tabla intermedia generada a partir de PRODUCTO + reglas de expansión Simple/Doble + filtrado por referencias con demanda. No se importa: se calcula desde la sección **Intermedias basado en reglas**.

{{MAESTRO:PRODUCTO_COMPLEJO}}

<!-- detalles -->
Cada referencia base genera 0, 1 o 2 filas (Simple, Doble, ambas) según las reglas. Los campos `TIPO_PRODUCTO`, `ABREFACIL`, `TRATADA` y los flags `SOLDADOR_LONGITUDINAL`, `ABIERTA_*`, `ABREFACIL_*` se derivan de la combinación regla × producto base.
<!-- /detalles -->

---

## Cruces clave

- `DEMANDA.REFERENCIA → PRODUCTO.REFERENCIA` — alerta si falta (V1).
- `PRODUCTO.MEZCLA → MEZCLAS.MEZCLA` — alerta si falta (V4) y la fórmula usa MEZCLAS.
- `PRODUCTO.MEZCLA → ENRUTAMIENTO_MEZCLAS.MEZCLA` — alerta si falta (V3).
- `ENRUTAMIENTO_MEZCLAS.EXTRUSORA → SETUP_EXTRUSORAS.NOMBRE_EXTRUSORA` — el motor solo evalúa la configuración con `ES_ACTUAL=true`.
- `CALENDARIO.CM` agrupa horas; el Escenario 0 ofrece capacidad por CM.
