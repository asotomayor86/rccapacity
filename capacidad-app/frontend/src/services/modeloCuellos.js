// Definiciones por defecto del modelo de rendimiento por cuellos de botella.
//
// El modelo sustituye la fórmula única de RENDIMIENTO por el mínimo de cuatro
// cuellos físicos (husillo, cabezal+enfriamiento, estiraje, post-procesos):
//   RENDIMIENTO [kg/h] = min(Q_HUSILLO, Q_DSO, Q_LINEA, Q_POST)
//
// Cada Q_i es un cálculo independiente que se compone como referencia desde
// RENDIMIENTO y, en el caso de Q_POST, desde Q_POST_CORONA/SOLDADOR/ABREFACIL.

// ── Helpers de construcción de árboles ────────────────────────────────────────

const mul = (...hijos) => hijos.reduce((izq, der) => ({ tipo: "operacion", operador: "*", hijos: [izq, der] }));
const div = (a, b)     => ({ tipo: "operacion", operador: "/", hijos: [a, b] });
const cte = (valor)    => ({ tipo: "constante", valor });
const pc  = (campo)    => ({ tipo: "campo", fuente: "PRODUCTO_COMPLEJO", campo });
const se  = (campo)    => ({ tipo: "campo", fuente: "SETUP_EXTRUSORAS", campo });
const mz  = (campo)    => ({ tipo: "campo", fuente: "MEZCLAS", campo });
const ref = (nombre)   => ({ tipo: "referencia_calculo", calculo_id: nombre });
const minN     = (...hijos) => ({ tipo: "operacion_naria", operador: "min", hijos });
const siAplica = (condicion, valor) => ({ tipo: "si_aplica", condicion, valor });
const or       = (...hijos) => ({ tipo: "booleana", operador: "or", hijos });

// Conversiones reutilizables
const ANCHO_M = div(pc("ANCHO_EXTRUSION"), cte(1000));      // mm → m
const GALGA_M = div(pc("GALGA"),           cte(1000000));   // µm → m
const PI       = cte(3.14159265);

// Factor común de los Q_POST: 60 [s/min] × 2 [caras] × ANCHO[m] × GALGA[m] × RHO_FILM[kg/m³]
const FACTOR_POST = (vel) => mul(vel, cte(60), cte(2), ANCHO_M, GALGA_M, mz("RHO_FILM"));

// ── Definiciones del modelo ───────────────────────────────────────────────────

function defConst(nombre, descripcion, unidad, arbol) {
  // Usamos `nombre` también como id estable, para que las referencias entre
  // cálculos sigan funcionando aun cuando el usuario los regenere.
  return { id: nombre, nombre, descripcion, unidad, inputs: [], arbol };
}

export const MODELO_CUELLOS_DEFS = [
  defConst("Q_HUSILLO",
    "Cuello de plastificación: capacidad efectiva del husillo",
    "kg/h",
    mul(se("VMAX_KG_H"), mz("K_HUSILLO"))
  ),

  defConst("Q_DSO",
    "Cuello de cabezal y enfriamiento: Die Specific Output × perímetro × factor de enfriamiento",
    "kg/h",
    mul(mz("DSO_EF"), PI, se("D_DIE"), se("COOLING_FACTOR"))
  ),

  defConst("Q_LINEA",
    "Cuello de estiraje: velocidad de línea × geometría del film × densidad",
    "kg/h",
    mul(
      se("VMAX_M_MIN"), cte(60), cte(2),
      ANCHO_M, GALGA_M, mz("RHO_FILM")
    )
  ),

  defConst("Q_POST_CORONA",
    "Cuello del tratador corona (sólo si la referencia es tratada)",
    "kg/h",
    siAplica(
      pc("TRATADA"),
      FACTOR_POST(div(se("CORONA_KW"), mul(cte(1.8), ANCHO_M, cte(1))))
    )
  ),

  defConst("Q_POST_SOLDADOR",
    "Cuello del soldador longitudinal (sólo si la referencia lo requiere)",
    "kg/h",
    siAplica(
      pc("SOLDADOR_LONGITUDINAL"),
      FACTOR_POST(se("V_MAX_SOLDADOR"))
    )
  ),

  defConst("Q_POST_ABREFACIL",
    "Cuello del abrefácil lateral o central (sólo si la referencia lo requiere)",
    "kg/h",
    siAplica(
      or(pc("ABREFACIL_LATERAL"), pc("ABREFACIL_CENTRAL")),
      FACTOR_POST(se("V_MAX_ABREFACIL"))
    )
  ),

  defConst("Q_POST",
    "Cuello agregado de post-procesos: mínimo entre corona, soldador y abrefácil",
    "kg/h",
    minN(ref("Q_POST_CORONA"), ref("Q_POST_SOLDADOR"), ref("Q_POST_ABREFACIL"))
  ),

  defConst("RENDIMIENTO",
    "Modelo de cuellos: mínimo entre husillo, cabezal+enfriamiento, estiraje y post-procesos",
    "kg/h",
    minN(ref("Q_HUSILLO"), ref("Q_DSO"), ref("Q_LINEA"), ref("Q_POST"))
  ),
];

// Lista de variables externas que el modelo requiere para evaluar, agrupadas
// por maestro. Útil para mostrar en el modal informativo.
export const MODELO_CUELLOS_REQUIERE = {
  MEZCLAS:         ["K_HUSILLO", "DSO_EF", "RHO_FILM"],
  SETUP_EXTRUSORAS:["D_DIE", "COOLING_FACTOR", "CORONA_KW", "V_MAX_SOLDADOR", "V_MAX_ABREFACIL", "VMAX_KG_H", "VMAX_M_MIN"],
  PRODUCTO_COMPLEJO:["ANCHO_EXTRUSION", "GALGA", "TRATADA", "SOLDADOR_LONGITUDINAL", "ABREFACIL_LATERAL", "ABREFACIL_CENTRAL"],
};

export const MODELO_CUELLOS_RANGOS = [
  { variable: "K_HUSILLO",      min: 0.75, max: 1.00, unidad: "—"        },
  { variable: "DSO_EF",         min: 0.07, max: 0.30, unidad: "kg/h·mm"  },
  { variable: "RHO_FILM",       min: 918,  max: 955,  unidad: "kg/m³"    },
  { variable: "COOLING_FACTOR", min: 1.0,  max: 2.0,  unidad: "—"        },
];
