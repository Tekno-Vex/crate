// Tiny key-value store over IndexedDB (db "crate", store "kv"). Every call degrades to a no-op /
// undefined when IndexedDB is missing or broken — the cache is an optimisation, never a dependency.

import { log } from './log';

const DB_NAME = __APP_ID__;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    if (!idb) return resolve(null);
    try {
      const req = idb.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        log.warn('IndexedDB open failed; running without cache', req.error);
        resolve(null);
      };
      req.onblocked = () => resolve(null);
    } catch (e) {
      log.warn('IndexedDB unavailable; running without cache', e);
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => {
            log.warn(`IndexedDB ${mode} failed`, req.error);
            resolve(undefined);
          };
        } catch (e) {
          log.warn(`IndexedDB ${mode} threw`, e);
          resolve(undefined);
        }
      }),
  );
}

export const kv = {
  get: <T>(key: string) => run<T>('readonly', (s) => s.get(key)),
  set: (key: string, value: unknown) => run<IDBValidKey>('readwrite', (s) => s.put(value, key)).then(() => undefined),
};

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}
