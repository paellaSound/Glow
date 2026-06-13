'use client';

/**
 * Local scene library for the 3D dev tools — IndexedDB-backed.
 *
 * GLB/HDR binaries are stored as Blobs (localStorage can't hold them: text-only
 * and ~5MB cap, which a handful of GLBs blow past). The whole scene record —
 * config + palette + per-level GLB blobs + optional HDR — lives in one object
 * store keyed by id, so saving/loading is a single structured-clone round-trip.
 *
 * This is the dev stand-in for the future Nivel 2 (Supabase): same shape of
 * data, persisted locally so we can validate the config-driven render without a
 * backend and without touching the production energy-orb.
 */

import type { Scene3DConfig } from 'glow-visuals-3d';

const DB_NAME = 'glow-visuals3d-dev';
const STORE = 'scenes';
const VERSION = 1;

export type StoredAsset = { name: string; blob: Blob };

export type StoredScene = {
  id: string;
  name: string;
  savedAt: number;
  palette: string[];
  config: Scene3DConfig;
  /** GLB blob per energy level (sparse). */
  glbs: Record<number, StoredAsset>;
  hdr?: StoredAsset;
};

export type SceneMeta = {
  id: string;
  name: string;
  savedAt: number;
  levels: number[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveScene(scene: StoredScene): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(scene);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listScenes(): Promise<SceneMeta[]> {
  const db = await openDb();
  const all = await request(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
  db.close();
  return (all as StoredScene[])
    .map((s) => ({
      id: s.id,
      name: s.name,
      savedAt: s.savedAt,
      levels: Object.keys(s.glbs).map(Number).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function loadScene(id: string): Promise<StoredScene | undefined> {
  const db = await openDb();
  const scene = await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
  db.close();
  return scene as StoredScene | undefined;
}

export async function deleteScene(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
