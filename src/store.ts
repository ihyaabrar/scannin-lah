/**
 * Global in-memory store with localStorage persistence.
 * Acts as the single source of truth shared across all pages.
 */

import { DocFile } from './types';

const STORAGE_KEY = 'docai_documents';

function loadFromStorage(): DocFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DocFile[];
  } catch {
    return [];
  }
}

function saveToStorage(docs: DocFile[]) {
  try {
    const slim = docs.map(d => ({ ...d, dataUrl: undefined }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch (e) {
    // Storage quota exceeded — notify via custom event
    window.dispatchEvent(new CustomEvent('storage-full', { detail: e }));
  }
}

// In-memory map for dataUrls (large blobs, not persisted)
const dataUrlMap: Record<string, string> = {};

// Expose dataUrlMap globally so OCR service can access it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__docaiDataUrls = dataUrlMap;

type Listener = () => void;
const listeners = new Set<Listener>();

let _docs: DocFile[] = loadFromStorage();

export const store = {
  getDocs(): DocFile[] {
    return _docs;
  },

  getDataUrl(id: string): string | undefined {
    return dataUrlMap[id];
  },

  addDoc(doc: DocFile, dataUrl?: string) {
    _docs = [doc, ..._docs];
    if (dataUrl) dataUrlMap[doc.id] = dataUrl;
    saveToStorage(_docs);
    listeners.forEach(l => l());
  },

  updateDoc(id: string, updates: Partial<DocFile>, dataUrl?: string) {
    _docs = _docs.map(d => d.id === id ? { ...d, ...updates } : d);
    if (dataUrl) dataUrlMap[id] = dataUrl;
    saveToStorage(_docs);
    listeners.forEach(l => l());
  },

  deleteDoc(id: string) {
    _docs = _docs.filter(d => d.id !== id);
    delete dataUrlMap[id];
    saveToStorage(_docs);
    listeners.forEach(l => l());
  },

  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
