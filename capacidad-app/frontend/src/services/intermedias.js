import { MASTER_SCHEMAS_META } from "../masterSchemas";

const PRODUCTO_TYPE_MAP = Object.fromEntries(
  MASTER_SCHEMAS_META.PRODUCTO.map((f) => [f.name, f.type])
);

const PC_TYPE_MAP = Object.fromEntries(
  MASTER_SCHEMAS_META.PRODUCTO_COMPLEJO.map((f) => [f.name, f.type])
);

// ANCHO_EXTRUSION y GALGA son siempre hardcodeados, no pasan por el motor de reglas.
const CONFIGURABLE_CAMPOS = [
  "SOLDADOR_LONGITUDINAL",
  "ABIERTA_LATERAL",
  "ABIERTA_CENTRO",
  "ABREFACIL_LATERAL",
  "ABREFACIL_CENTRAL",
  "TRATADA_PC",
];

const BOOL_TRUTHY = new Set(["si", "sí", "yes", "1", "true"]);

function toBool(v) {
  if (typeof v === "boolean") return v;
  return BOOL_TRUTHY.has(String(v).trim().toLowerCase());
}

function comparar(rawVal, operador, valorStr, tipo) {
  if (operador === "is_null")     return rawVal == null || rawVal === "";
  if (operador === "is_not_null") return rawVal != null && rawVal !== "";
  if (rawVal == null) return false;

  if (tipo === "boolean") {
    const a = toBool(rawVal);
    const b = toBool(valorStr);
    if (operador === "eq")  return a === b;
    if (operador === "neq") return a !== b;
    return false;
  }

  if (tipo === "decimal") {
    const a = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal).replace(",", "."));
    const b = parseFloat(String(valorStr).replace(",", "."));
    if (isNaN(a) || isNaN(b)) return false;
    switch (operador) {
      case "eq":  return a === b;
      case "neq": return a !== b;
      case "gt":  return a > b;
      case "lt":  return a < b;
      case "gte": return a >= b;
      case "lte": return a <= b;
      default: return false;
    }
  }

  // string (default)
  const a = String(rawVal).trim().toLowerCase();
  const b = String(valorStr).trim().toLowerCase();
  switch (operador) {
    case "eq":          return a === b;
    case "neq":         return a !== b;
    case "contains":    return a.includes(b);
    case "starts_with": return a.startsWith(b);
    default: return false;
  }
}

function resolverResultado(resultado, productoRow, destTipo) {
  if (resultado.tipo === "campo_copiado") {
    return productoRow[resultado.valor] ?? null;
  }
  const v = String(resultado.valor ?? "").trim();
  if (!v) return null;
  if (destTipo === "boolean") return toBool(v);
  if (destTipo === "decimal") {
    const n = parseFloat(v.replace(",", "."));
    return isNaN(n) ? null : n;
  }
  return v;
}

function evaluarCampo(campo, reglas, productoRow, tipoPc) {
  const sorted = reglas
    .filter((r) => r.campo === campo)
    .sort((a, b) => a.prioridad - b.prioridad);

  for (const regla of sorted) {
    const cumple = regla.condiciones.every((cond) => {
      let rawVal, tipo;
      if (cond.fuente === "PRODUCTO") {
        rawVal = productoRow[cond.campo];
        tipo = PRODUCTO_TYPE_MAP[cond.campo] ?? "string";
      } else {
        rawVal = cond.campo === "TIPO" ? tipoPc : null;
        tipo = "string";
      }
      return comparar(rawVal, cond.operador, cond.valor ?? "", tipo);
    });

    if (cumple) {
      return resolverResultado(regla.resultado, productoRow, PC_TYPE_MAP[campo] ?? "string");
    }
  }

  return undefined; // no rule matched → use hardcoded fallback
}

export function calcularProductoComplejo(productoRows, reglas = []) {
  const result = [];

  for (const p of productoRows) {
    const ref   = p.REFERENCIA ?? "";
    const ancho = p.ANCHO ?? null;
    const galga = p.GALGA ?? null;
    const tipos = (Number(p.FUELLE) || 0) !== 0 ? ["Simple"] : ["Simple", "Doble"];

    for (const tipo of tipos) {
      const registro = {
        REFERENCIA:          ref,
        TIPO:                tipo,
        REFERENCIA_COMPLEJA: ref + (tipo === "Simple" ? "S" : "D"),
        TIPO_PRODUCTO:       p.TIPO        ?? null,
        ABREFACIL:           p.ABREFACIL   ?? null,
        TRATADA:             p.TRATAMIENTO ?? null,
        ANCHO_EXTRUSION:     (tipo === "Doble" && ancho != null) ? ancho * 2 : ancho,
        GALGA:               galga,
      };

      for (const campo of CONFIGURABLE_CAMPOS) {
        const ruleVal = evaluarCampo(campo, reglas, p, tipo);
        registro[campo] = ruleVal !== undefined ? ruleVal : null;
      }

      result.push(registro);
    }
  }

  return result;
}
