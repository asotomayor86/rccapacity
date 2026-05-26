// Script auxiliar para regenerar la plantilla CSV del modelo de cuellos a partir
// de la fuente programática en src/services/modeloCuellos.js.
// Uso (desde frontend/):
//   node scripts/gen_plantilla_modelo_cuellos.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODELO_CUELLOS_DEFS } from "../src/services/modeloCuellos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir    = path.join(__dirname, "..", "public", "plantillas");
const outFile   = path.join(outDir, "CALCULOS_MODELO_CUELLOS.csv");

fs.mkdirSync(outDir, { recursive: true });

const COLS = ["CALCULO_ID", "NOMBRE", "DESCRIPCION", "UNIDAD", "ARBOL_JSON"];

function escapeCell(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const lines = [COLS.join(",")];
for (const def of MODELO_CUELLOS_DEFS) {
  const row = {
    CALCULO_ID:  def.id,
    NOMBRE:      def.nombre,
    DESCRIPCION: def.descripcion ?? "",
    UNIDAD:      def.unidad ?? "",
    ARBOL_JSON:  JSON.stringify(def.arbol),
  };
  lines.push(COLS.map((c) => escapeCell(row[c])).join(","));
}

fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");
console.log(`Generated ${outFile} with ${MODELO_CUELLOS_DEFS.length} rows`);
