import { create } from "zustand";

const MASTER_NAMES = ["DEMANDA", "PRODUCTO", "ENRUTAMIENTO_MEZCLAS", "CALENDARIO", "SETUP_EXTRUSORAS"];

const emptyMaster = () => ({ records: [], loaded_at: null, count: 0 });

const useStore = create((set, get) => ({
  masters: Object.fromEntries(MASTER_NAMES.map((n) => [n, emptyMaster()])),
  uploads: {},
  results: { records: [], log: [], calculated_at: null },
  savedFilters: {},
  setupExtrusorasRevision: null,
  exportDirName: null,
  intermedias: {
    PRODUCTO_COMPLEJO: [],
  },
  reglas: {
    PRODUCTO_A_COMPLEJO:       [],
    ENRUTAMIENTO_A_FACTIBLE:   [],
  },
  calculos: {
    DEFINICIONES: [],
  },
  intermedias_calculadas: {
    ENRUTAMIENTOS:          [],
    ENRUTAMIENTOS_FACTIBLES: [],
  },
  verificaciones: {
    REFS_SIN_PRODUCTO:     null,
    REFS_SIN_MEZCLA:       null,
    REFS_SIN_ENRUTAMIENTO: null,
  },

  // ── Actions ──────────────────────────────────────────────────────────────

  setUpload(uploadId, data) {
    set((s) => ({ uploads: { ...s.uploads, [uploadId]: data } }));
  },

  importMaster(name, records) {
    let finalRecords = records;

    if (name === "DEMANDA") {
      const map = new Map();
      for (const r of records) {
        const key = `${r.MES}||${r.REFERENCIA}`;
        if (map.has(key)) {
          map.get(key).CANTIDAD += Number(r.CANTIDAD) || 0;
        } else {
          map.set(key, { ...r, CANTIDAD: Number(r.CANTIDAD) || 0 });
        }
      }
      finalRecords = Array.from(map.values());
    }

    if (name === "CALENDARIO") {
      // Normalize EFICIENCIA: if value > 1 it was expressed as %, convert to ratio
      finalRecords = records.map((r) => {
        const ef = Number(r.EFICIENCIA);
        if (!isNaN(ef) && ef > 1) return { ...r, EFICIENCIA: ef / 100 };
        return r;
      });
    }

    if (name === "SETUP_EXTRUSORAS") {
      // Strip _META_* columns
      finalRecords = records.map((r) => {
        const clean = {};
        for (const [k, v] of Object.entries(r)) {
          if (!k.startsWith("_META_")) clean[k] = v;
        }
        return clean;
      });

      // Enforce ES_ACTUAL invariant per NOMBRE_EXTRUSORA group:
      // only the FIRST true per group is kept; rest → false.
      const seenActual = new Set();
      finalRecords = finalRecords.map((r) => {
        const nombre = r.NOMBRE_EXTRUSORA;
        if (r.ES_ACTUAL === true) {
          if (!seenActual.has(nombre)) {
            seenActual.add(nombre);
            return r;
          }
          return { ...r, ES_ACTUAL: false };
        }
        return r;
      });
    }

    set((s) => ({
      masters: {
        ...s.masters,
        [name]: { records: finalRecords, count: finalRecords.length, loaded_at: new Date().toISOString() },
      },
      results: { records: [], log: [], calculated_at: null },
    }));
  },

  setResults(records, log) {
    set({ results: { records, log: log ?? [], calculated_at: new Date().toISOString() } });
  },

  setSavedFilter(name, filters) {
    set((s) => ({ savedFilters: { ...s.savedFilters, [name]: filters } }));
  },

  deleteSavedFilter(name) {
    set((s) => {
      const { [name]: _removed, ...rest } = s.savedFilters;
      return { savedFilters: rest };
    });
  },

  setSetupExtrusorasRevision(fecha) {
    set({ setupExtrusorasRevision: fecha });
  },

  setExportDirName(name) {
    set({ exportDirName: name });
  },

  setIntermedia(name, records) {
    set((s) => ({ intermedias: { ...s.intermedias, [name]: records } }));
  },

  setReglas(nombre, reglas) {
    set((s) => ({ reglas: { ...s.reglas, [nombre]: reglas } }));
  },

  addRegla(nombre, regla) {
    set((s) => ({ reglas: { ...s.reglas, [nombre]: [...(s.reglas[nombre] ?? []), regla] } }));
  },

  updateRegla(nombre, id, regla) {
    set((s) => ({
      reglas: {
        ...s.reglas,
        [nombre]: (s.reglas[nombre] ?? []).map((r) => (r.id === id ? regla : r)),
      },
    }));
  },

  deleteRegla(nombre, id) {
    set((s) => ({
      reglas: {
        ...s.reglas,
        [nombre]: (s.reglas[nombre] ?? []).filter((r) => r.id !== id),
      },
    }));
  },

  setEnrutamientos(rows) {
    set((s) => ({ intermedias_calculadas: { ...s.intermedias_calculadas, ENRUTAMIENTOS: rows } }));
  },

  setEnrutamientosFactibles(rows) {
    set((s) => ({ intermedias_calculadas: { ...s.intermedias_calculadas, ENRUTAMIENTOS_FACTIBLES: rows } }));
  },

  setReglasFact(reglas) {
    set((s) => ({ reglas: { ...s.reglas, ENRUTAMIENTO_A_FACTIBLE: reglas } }));
  },

  addReglaFact(regla) {
    set((s) => ({ reglas: { ...s.reglas, ENRUTAMIENTO_A_FACTIBLE: [...s.reglas.ENRUTAMIENTO_A_FACTIBLE, regla] } }));
  },

  updateReglaFact(id, regla) {
    set((s) => ({
      reglas: {
        ...s.reglas,
        ENRUTAMIENTO_A_FACTIBLE: s.reglas.ENRUTAMIENTO_A_FACTIBLE.map((r) => (r.id === id ? regla : r)),
      },
    }));
  },

  deleteReglaFact(id) {
    set((s) => ({
      reglas: {
        ...s.reglas,
        ENRUTAMIENTO_A_FACTIBLE: s.reglas.ENRUTAMIENTO_A_FACTIBLE.filter((r) => r.id !== id),
      },
    }));
  },

  setVerificacion(name, records) {
    set((s) => ({ verificaciones: { ...s.verificaciones, [name]: records } }));
  },

  addCalculo(def) {
    set((s) => ({ calculos: { ...s.calculos, DEFINICIONES: [...s.calculos.DEFINICIONES, def] } }));
  },

  updateCalculo(id, def) {
    set((s) => ({
      calculos: {
        ...s.calculos,
        DEFINICIONES: s.calculos.DEFINICIONES.map((d) => (d.id === id ? def : d)),
      },
    }));
  },

  deleteCalculo(id) {
    set((s) => ({
      calculos: {
        ...s.calculos,
        DEFINICIONES: s.calculos.DEFINICIONES.filter((d) => d.id !== id),
      },
    }));
  },

  reorderReglas(nombre, ids) {
    set((s) => {
      const map = new Map((s.reglas[nombre] ?? []).map((r) => [r.id, r]));
      return {
        reglas: {
          ...s.reglas,
          [nombre]: ids.map((id) => map.get(id)).filter(Boolean),
        },
      };
    });
  },

  // Mark a specific config as actual within its NOMBRE_EXTRUSORA group.
  // All other configs of the same nombre are set to false.
  markAsActual(nombreExtrusora, index) {
    set((s) => {
      const all = s.masters.SETUP_EXTRUSORAS?.records ?? [];
      const records = all.map((r, i) => {
        if (r.NOMBRE_EXTRUSORA !== nombreExtrusora) return r;
        return { ...r, ES_ACTUAL: i === index };
      });
      return {
        masters: {
          ...s.masters,
          SETUP_EXTRUSORAS: { ...s.masters.SETUP_EXTRUSORAS, records },
        },
      };
    });
  },

  // Partial update of a config by globalIndex. NOMBRE_EXTRUSORA and ES_ACTUAL are protected.
  updateSetupExtrusora(globalIndex, campos) {
    set((s) => {
      const records = [...(s.masters.SETUP_EXTRUSORAS?.records ?? [])];
      if (!records[globalIndex]) return {};
      // Strip protected fields from the incoming changes
      const { NOMBRE_EXTRUSORA: _n, ES_ACTUAL: _a, ...safeChanges } = campos;
      records[globalIndex] = { ...records[globalIndex], ...safeChanges };
      return {
        masters: {
          ...s.masters,
          SETUP_EXTRUSORAS: { ...s.masters.SETUP_EXTRUSORAS, records },
        },
      };
    });
  },

  // ── Derived ───────────────────────────────────────────────────────────────

  getMasterStatus() {
    const { masters } = get();
    return Object.fromEntries(
      Object.entries(masters).map(([name, data]) => [
        name,
        { loaded: data.count > 0, count: data.count, loaded_at: data.loaded_at },
      ])
    );
  },
}));

export default useStore;
