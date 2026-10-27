/*
 * TASTBAAR moodboard — persistence.
 *
 * Debounced autosave to IndexedDB, and restore the last open board on load.
 * The document and the id of the open board are stored side by side.
 */

const DB_NAME = "tastbaar-moodboard";
const DB_VERSION = 1;
const STORE_NAME = "docs";
const KEY = "autosave";
const CURRENT_KEY = "current-board";

let db = null;
let saveTimer = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

export async function save(doc, currentBoardId = null) {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(doc, KEY);
    store.put(currentBoardId, CURRENT_KEY);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch (e) {
    console.error("Failed to save:", e);
    return false;
  }
}

/** Save after a quiet moment; getDoc is read then, so the latest state is stored. */
export function autosave(read, delay = 1000) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const { doc, currentBoardId } = read();
    save(doc, currentBoardId);
  }, delay);
}

/** Returns { doc, currentBoardId } or null when nothing was saved. */
export async function load() {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const get = (key) => new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
    const [doc, currentBoardId] = await Promise.all([get(KEY), get(CURRENT_KEY)]);
    return doc ? { doc, currentBoardId } : null;
  } catch (e) {
    console.error("Failed to load:", e);
    return null;
  }
}

export async function clear() {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(KEY);
    store.delete(CURRENT_KEY);
  } catch (e) {
    console.error("Failed to clear:", e);
  }
}
