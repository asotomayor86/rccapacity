import { MASTER_SCHEMAS_META } from "../masterSchemas";
import { camposDeArbol } from "../services/engine";

export const PC_TYPE_MAP = Object.fromEntries((MASTER_SCHEMAS_META.PRODUCTO_COMPLEJO ?? []).map((f) => [f.name, f.type]));
export const SE_TYPE_MAP = Object.fromEntries((MASTER_SCHEMAS_META.SETUP_EXTRUSORAS  ?? []).map((f) => [f.name, f.type]));

export const FIXED_COLS = [
  { name: "REFERENCIA_COMPLEJA", label: "REFERENCIA COMPLEJA", type: "string" },
  { name: "MEZCLA",              label: "MEZCLA",              type: "string" },
  { name: "EXTRUSORA",           label: "EXTRUSORA",           type: "string" },
];

export const FIXED_PC_BOOL = [
  { name: "SOLDADOR_LONGITUDINAL", label: "SOLDADOR LONGITUDINAL" },
  { name: "ABIERTA_LATERAL",       label: "ABIERTA LATERAL"       },
  { name: "ABIERTA_CENTRO",        label: "ABIERTA CENTRO"        },
  { name: "ABREFACIL_LATERAL",     label: "ABREFÁCIL LATERAL"     },
  { name: "ABREFACIL_CENTRAL",     label: "ABREFÁCIL CENTRAL"     },
  { name: "TRATADA_PC",            label: "TRATADA PC"            },
];
export const FIXED_PC_NAMES = new Set(FIXED_PC_BOOL.map((f) => f.name));

export function schemaDeDefiniciones(definiciones) {
  const camposPC = new Set();
  const camposSE = new Set();
  for (const def of (definiciones ?? []).filter((d) => d.nombre === "RS" || d.nombre === "RENDIMIENTO")) {
    for (const { fuente, campo } of camposDeArbol(def.arbol)) {
      if (fuente === "PRODUCTO_COMPLEJO") camposPC.add(campo);
      if (fuente === "SETUP_EXTRUSORAS")  camposSE.add(campo);
    }
  }
  const varPC = [...camposPC].filter((c) => !FIXED_PC_NAMES.has(c));
  return [
    ...FIXED_COLS,
    ...FIXED_PC_BOOL.map((f) => ({ ...f, type: "boolean", group: "PC" })),
    ...varPC.map((c) => ({ name: c, label: `PC ${c.replace(/_/g, " ")}`, type: PC_TYPE_MAP[c] ?? "string", group: "PC" })),
    { name: "ES_ACTUAL",           label: "ES ACTUAL",           type: "boolean", group: "SE" },
    ...[...camposSE].map((c) => ({ name: c, label: `SE ${c.replace(/_/g, " ")}`, type: SE_TYPE_MAP[c] ?? "string", group: "SE" })),
    { name: "RS_CALCULADA",          label: "RS CALCULADA",          type: "decimal", group: "CALC" },
    { name: "RENDIMIENTO_CALCULADO", label: "RENDIMIENTO CALCULADO", type: "decimal", group: "CALC" },
  ];
}
