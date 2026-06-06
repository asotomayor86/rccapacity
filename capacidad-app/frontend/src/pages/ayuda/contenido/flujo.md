El flujo canónico de RCCapacity sigue este orden. Cada paso depende de los datos producidos por los anteriores.

## 1. Maestros

Carga los CSV con los datos base de planificación. Son **obligatorios** para el motor: `DEMANDA`, `PRODUCTO`, `ENRUTAMIENTO_MEZCLAS`, `CALENDARIO`. El maestro `MEZCLAS` es opcional — solo se necesita si las fórmulas usan el modelo de cuellos.

<!-- detalles -->
Cada maestro se importa con el wizard de 4 pasos: subir CSV, mapear columnas, validar e importar. El validador detecta tipos (`fecha`, `decimal`, `string`, `boolean`) y reporta filas erróneas antes de aceptar la importación. Acepta separadores `,`, `;`, tab o `|` y codificaciones UTF-8 / Latin-1.
<!-- /detalles -->

## 2. Verificaciones

Cruces entre maestros para detectar inconsistencias antes de calcular. Cuatro verificaciones disponibles: refs sin producto (V1), refs sin mezcla asignada (V2), mezclas sin enrutamiento (V3), mezclas con demanda sin ficha en MEZCLAS (V4).

<!-- detalles -->
Cada verificación produce una tabla con la lista de afectados. Las tarjetas se vuelven ámbar si hay alertas y verdes si están OK. No bloquean el cálculo, pero conviene resolver las alertas críticas (V1 y V3) antes de avanzar.
<!-- /detalles -->

## 3. Reglas

Define cómo expandir los maestros a las tablas intermedias. Dos conjuntos: `PRODUCTO_A_COMPLEJO` (genera variantes Simple/Doble por referencia) y `ENRUTAMIENTO_A_FACTIBLE` (filtra rutas factibles).

## 4. Intermedias

Aplica las reglas para generar `PRODUCTO_COMPLEJO`. Esta tabla derivada cruza referencias × variantes (Simple / Doble) y filtra por demanda, por lo que solo aparecen las referencias con demanda real.

## 5. Cálculos

Define las fórmulas de **RS** (relación de soplado) y **RENDIMIENTO** (kg/h). Para el modelo de cuellos de botella, RENDIMIENTO se calcula como el mínimo de varios cuellos físicos (Q_HUSILLO, Q_DSO, Q_LINEA, Q_POST). Carga el modelo por defecto desde el botón **"Cargar modelo por defecto"**.

<!-- detalles -->
El constructor visual permite armar árboles de fórmula con operaciones aritméticas, n-arias (min/max), condicionales (`si_aplica`), booleanas (and/or/not) y referencias a otros cálculos. El motor evalúa los cálculos en orden topológico, detecta ciclos y propaga `null` aguas arriba en aritmética.
<!-- /detalles -->

## 6. Intermedias Calculadas

Evalúa las fórmulas sobre el cruce PRODUCTO_COMPLEJO × MEZCLA × EXTRUSORA. Produce `ENRUTAMIENTOS` (todas las combinaciones) y `ENRUTAMIENTOS_FACTIBLES` (solo las que cumplen rangos RS y están dentro de la configuración actual).

## 7. Setup Extrusoras

Configuraciones físicas de cada extrusora (capas, hilera, husillos, VMAX, D_DIE, COOLING_FACTOR, etc.). Una configuración por extrusora se marca como **`ES_ACTUAL`** y es la usada por el motor. Las ediciones del modal se aplican al estado en memoria — exporta a CSV si quieres conservarlas.

## 8. Resultados — Escenario 0

Ejecuta el cálculo anual de capacidad (Rough Cut). Asigna la demanda de cada referencia a las combinaciones (variante × CM) factibles minimizando la ocupación pico. Devuelve resumen por CM (horas disponibles, horas cargadas, ocupación) y detalle por referencia.

<!-- detalles -->
Es un LP continuo resuelto con water-filling entrópico: 300 iteraciones de annealing con blending (LR=0.15). El objetivo bifásico es minimizar primero la ocupación pico de cualquier CM y, después, la suma de ocupaciones. La barra de progreso muestra el avance en tiempo real.
<!-- /detalles -->

---

## Dependencias entre pasos

- **Verificaciones** necesitan los 4 maestros core (+ MEZCLAS para V4).
- **Intermedias** necesitan `PRODUCTO` y `DEMANDA` cargados y reglas definidas.
- **Cálculos** son independientes de los maestros — solo definen fórmulas.
- **Intermedias Calculadas** necesitan PRODUCTO_COMPLEJO + ENRUTAMIENTO_MEZCLAS + SETUP_EXTRUSORAS + Cálculos. Si las fórmulas usan campos de MEZCLAS, también el maestro MEZCLAS.
- **Resultados (Escenario 0)** necesitan ENRUTAMIENTOS_FACTIBLES + DEMANDA + CALENDARIO.
