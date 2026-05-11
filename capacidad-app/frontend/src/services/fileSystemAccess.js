import useStore from "../state";

const DB_NAME  = "capacidad-app-fs";
const DB_STORE = "handles";
const DIR_KEY  = "lastExportDir";

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isFileSystemAccessSupported() {
  return typeof window.showSaveFilePicker === "function";
}

export async function saveDirectoryHandle(handle) {
  await idbSet(DIR_KEY, handle);
  useStore.getState().setExportDirName(handle.name);
}

export async function loadDirectoryHandle() {
  try {
    const handle = await idbGet(DIR_KEY);
    if (!handle) return null;

    let perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      perm = await handle.requestPermission({ mode: "readwrite" });
    }
    if (perm !== "granted") return null;

    useStore.getState().setExportDirName(handle.name);
    return handle;
  } catch {
    return null;
  }
}

// For the UI indicator "Cambiar carpeta" button
export async function pickDirectory() {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await saveDirectoryHandle(handle);
    return handle;
  } catch {
    return null;
  }
}

export function fallbackDownload(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function saveCSV(filename, csvString) {
  const withBom = "﻿" + csvString;

  if (!isFileSystemAccessSupported()) {
    fallbackDownload(filename, withBom);
    return;
  }

  const dirHandle = await loadDirectoryHandle();

  try {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: filename,
      startIn: dirHandle ?? "documents",
      types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }],
    });

    // Persist the parent directory so next dialog opens there
    try {
      if (typeof fileHandle.getParent === "function") {
        const parent = await fileHandle.getParent();
        await saveDirectoryHandle(parent);
      }
    } catch { /* getParent not available in this browser */ }

    const writable = await fileHandle.createWritable();
    await writable.write(withBom);
    await writable.close();
  } catch {
    // user cancelled
  }
}
