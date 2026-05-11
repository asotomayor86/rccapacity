import { autoImport, autoImportReglas, autoImportCalculos, autoImportReglasFact } from "./csvParser";
import { loadDirectoryHandle } from "./fileSystemAccess";
import useStore from "../state";

// Orden de detección: los keywords más específicos (más largos) primero para
// evitar falsos positivos.
const DETECTION_KEYWORDS = [
  { type: "REGLAS_FACTIBLES",     keyword: "reglas_factibilidad"      },
  { type: "REGLAS",               keyword: "reglas_producto_complejo" },
  { type: "ENRUTAMIENTO_MEZCLAS", keyword: "enrutamiento"  },
  { type: "DEMANDA",              keyword: "demanda"       },
  { type: "PRODUCTO",             keyword: "producto"      },
  { type: "CALENDARIO",           keyword: "calendario"    },
  { type: "SETUP_EXTRUSORAS",     keyword: "setup"         },
  { type: "CALCULOS",             keyword: "calculos"      },
];

// Orden canónico para mostrar en la tabla resumen
export const ALL_TYPES = [
  "DEMANDA", "PRODUCTO", "CALENDARIO", "ENRUTAMIENTO_MEZCLAS",
  "SETUP_EXTRUSORAS", "REGLAS", "REGLAS_FACTIBLES", "CALCULOS",
];
export const TYPE_LABELS = {
  DEMANDA:              "Demanda",
  PRODUCTO:             "Producto",
  CALENDARIO:           "Calendario",
  ENRUTAMIENTO_MEZCLAS: "Enrutamiento Mezclas",
  SETUP_EXTRUSORAS:     "Setup Extrusoras",
  REGLAS:               "Reglas",
  REGLAS_FACTIBLES:     "Reglas Factibilidad",
  CALCULOS:             "Cálculos",
};

function detectType(filename) {
  const lower = filename.toLowerCase();
  for (const { type, keyword } of DETECTION_KEYWORDS) {
    if (lower.includes(keyword)) return type;
  }
  return null;
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function importarUltimosCsv({ onProgress } = {}) {
  const notify = (item) => onProgress && onProgress(item);

  let dirHandle;
  try {
    const prevDir = await loadDirectoryHandle();
    dirHandle = await window.showDirectoryPicker({
      mode: "read",
      startIn: prevDir ?? "documents",
    });
  } catch {
    return { cancelled: true };
  }

  // Scan directory: keep newest CSV per type
  const winners = new Map();
  for await (const entry of dirHandle.values()) {
    if (entry.kind !== "file") continue;
    if (!entry.name.toLowerCase().endsWith(".csv")) continue;
    const type = detectType(entry.name);
    if (!type) continue;
    const file = await entry.getFile();
    const existing = winners.get(type);
    if (!existing || file.lastModified > existing.file.lastModified) {
      winners.set(type, { name: entry.name, file });
    }
  }

  const store   = useStore.getState();
  const summary = [];

  for (const type of ALL_TYPES) {
    const winner = winners.get(type);

    if (!winner) {
      const item = { type, filename: null, fecha: null, count: null, estado: "no_encontrado" };
      summary.push(item);
      notify(item);
      continue;
    }

    notify({ type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: null, estado: "procesando" });

    try {
      let item;

      if (type === "REGLAS_FACTIBLES") {
        const res = await autoImportReglasFact(winner.file);
        if (res.success) {
          store.setReglasFact(res.reglas);
          item = { type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: res.reglas.length, estado: "ok" };
        } else {
          item = { type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: null, estado: "error", razon: res.reason };
        }

      } else if (type === "REGLAS") {
        const res = await autoImportReglas(winner.file);
        if (res.success) {
          store.setReglas("PRODUCTO_A_COMPLEJO", res.reglas);
          item = { type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: res.reglas.length, estado: "ok" };
        } else {
          item = { type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: null, estado: "error", razon: res.reason };
        }

      } else if (type === "CALCULOS") {
        const res = await autoImportCalculos(winner.file);
        if (res.success) {
          res.definiciones.forEach((d) => store.addCalculo({ ...d, id: newId() }));
          item = { type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: res.definiciones.length, estado: "ok" };
        } else {
          item = { type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: null, estado: "error", razon: res.reason };
        }

      } else {
        const res = await autoImport(winner.file, type);
        if (res.success) {
          store.importMaster(type, res.rows);
          if (type === "SETUP_EXTRUSORAS") {
            const rev = res.meta?.["_META_FECHA_REVISION"];
            if (rev) store.setSetupExtrusorasRevision(String(rev).trim());
          }
          item = { type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: res.valid_count, estado: "ok", omitidos: res.error_count };
        } else {
          item = { type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: null, estado: "error", razon: res.reason };
        }
      }

      summary.push(item);
      notify(item);

    } catch (e) {
      const item = { type, filename: winner.name, fecha: new Date(winner.file.lastModified), count: null, estado: "error", razon: e.message };
      summary.push(item);
      notify(item);
    }
  }

  return { cancelled: false, summary };
}
