// `name`: clave canónica interna (store, CSV, engine)
// `label`: texto visible en UI (ColumnMapper, MasterViewer, ValidationReport)
// Si `label` está ausente, se usa `name` como fallback

export const MASTER_SCHEMAS_META = {
  DEMANDA: [
    { name: "MES",        type: "fecha",   required: true },
    { name: "REFERENCIA", type: "string",  required: true },
    { name: "CANTIDAD",   type: "decimal", required: true },
  ],

  PRODUCTO: [
    { name: "REFERENCIA",  type: "string",  required: true  },
    { name: "ANCHO",       type: "decimal", required: false, label: "ANCHO (MM)" },
    { name: "GALGA",       type: "decimal", required: false },
    { name: "TIPO",        type: "string",  required: false },
    { name: "MEZCLA",      type: "string",  required: false },
    { name: "TRATAMIENTO", type: "boolean", required: false },
    { name: "ABREFACIL",   type: "boolean", required: false },
    { name: "FUELLE",      type: "decimal", required: false },
  ],

  ENRUTAMIENTO_MEZCLAS: [
    { name: "MEZCLA",          type: "string",  required: true,  label: "MEZCLA"         },
    { name: "EXTRUSORA",       type: "string",  required: false, label: "EXTRUSORA"      },
    { name: "RS_MIN",          type: "decimal", required: false, label: "RS MIN"         },
    { name: "RS_MAXIMO",       type: "decimal", required: false, label: "RS MÁXIMO"      },
    { name: "GMAX_SOLDADURA",  type: "decimal", required: false, label: "GMAX SOLDADURA" },
  ],

  CALENDARIO: [
    { name: "MES",              type: "fecha",   required: true,  label: "MES"             },
    { name: "CM",               type: "string",  required: true,  label: "CM"              },
    { name: "CT",               type: "string",  required: true,  label: "CT"              },
    { name: "HORAS_TOTALES",    type: "decimal", required: true,  label: "HORAS TOTALES"   },
    { name: "EFICIENCIA",       type: "decimal", required: true,  label: "%EFICIENCIA"     },
    { name: "HORAS_EFICIENTES", type: "decimal", required: true,  label: "HORAS EFICIENTES"},
  ],

  PRODUCTO_COMPLEJO: [
    { name: "REFERENCIA",            type: "string",  label: "REFERENCIA"              },
    { name: "TIPO",                  type: "string",  label: "TIPO"                    },
    { name: "REFERENCIA_COMPLEJA",   type: "string",  label: "REFERENCIA COMPLEJA"     },
    { name: "TIPO_PRODUCTO",         type: "string",  label: "TIPO PRODUCTO",  color: "purple" },
    { name: "ABREFACIL",             type: "boolean", label: "ABREFÁCIL",      color: "purple" },
    { name: "TRATADA",               type: "boolean", label: "TRATADA",        color: "purple" },
    { name: "ANCHO_EXTRUSION",       type: "decimal", label: "ANCHO EXTRUSIÓN (MM)"    },
    { name: "GALGA",                 type: "decimal", label: "GALGA"                   },
    { name: "SOLDADOR_LONGITUDINAL", type: "boolean", label: "SOLDADOR LONGITUDINAL"   },
    { name: "ABIERTA_LATERAL",       type: "boolean", label: "ABIERTA LATERAL"         },
    { name: "ABIERTA_CENTRO",        type: "boolean", label: "ABIERTA CENTRO"          },
    { name: "ABREFACIL_LATERAL",     type: "boolean", label: "ABREFÁCIL LATERAL"       },
    { name: "ABREFACIL_CENTRAL",     type: "boolean", label: "ABREFÁCIL CENTRAL"       },
    { name: "TRATADA_PC",             type: "boolean", label: "TRATADA PC"              },
  ],

  SETUP_EXTRUSORAS: [
    { name: "NOMBRE_EXTRUSORA",      type: "string",  required: true,  label: "NOMBRE EXTRUSORA"      },
    { name: "ES_ACTUAL",             type: "boolean", required: true,  label: "ES ACTUAL"             },
    { name: "CAPAS",                 type: "decimal", required: false, label: "CAPAS"                 },
    { name: "HILERA",                type: "string",  required: false, label: "HILERA"                },
    { name: "HUSILLOS",              type: "string",  required: false, label: "HUSILLOS"              },
    { name: "VMAX_KG_H",             type: "decimal", required: false, label: "VMAX KG/H",   positive: true },
    { name: "VMAX_M_MIN",            type: "decimal", required: false, label: "VMAX M/MIN",  positive: true },
    { name: "RPM_MAX",               type: "string",  required: false, label: "RPM MAX"               },
    { name: "SOPLADO_HD",            type: "boolean", required: false, label: "SOPLADO HD"            },
    { name: "SOPLADO_LD",            type: "boolean", required: false, label: "SOPLADO LD"            },
    { name: "ANCHO_MAXIMO",          type: "decimal", required: false, label: "ANCHO MAXIMO", positive: true },
    { name: "CORTE_LATERAL",         type: "boolean", required: false, label: "CORTE LATERAL"         },
    { name: "CORTE_CENTRAL",         type: "boolean", required: false, label: "CORTE CENTRAL"         },
    { name: "ABREFACIL_LATERAL",     type: "boolean", required: false, label: "ABREFACIL LATERAL"     },
    { name: "ABREFACIL_CENTRAL",     type: "boolean", required: false, label: "ABREFACIL CENTRAL"     },
    { name: "SOLDADOR_LONGITUDINAL", type: "boolean", required: false, label: "SOLDADOR LONGITUDINAL" },
    { name: "MADERAS_PLEGADO",       type: "boolean", required: false, label: "MADERAS PLEGADO"       },
    { name: "VENTANA_MIN_PLEGADO",   type: "decimal", required: false, label: "VENTANA MIN PLEGADO",  positive: true },
    { name: "FUELLE_MAXIMO",         type: "decimal", required: false, label: "FUELLE MAXIMO",        positive: true },
    { name: "TRATADOR_CORONA",       type: "boolean", required: false, label: "TRATADOR CORONA"       },
    { name: "CORTE_LAMINA",          type: "boolean", required: false, label: "CORTE LAMINA"          },
  ],
};
