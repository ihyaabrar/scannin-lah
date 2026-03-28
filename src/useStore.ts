import { useState, useEffect } from 'react';
import { store } from './store';
import { DocFile } from './types';

export function useStore() {
  const [docs, setDocs] = useState<DocFile[]>(() => store.getDocs());

  useEffect(() => {
    const unsub = store.subscribe(() => setDocs([...store.getDocs()]));
    return () => { unsub(); };
  }, []);

  return {
    docs,
    addDoc: store.addDoc.bind(store),
    updateDoc: store.updateDoc.bind(store),
    deleteDoc: store.deleteDoc.bind(store),
    getDataUrl: store.getDataUrl.bind(store),
  };
}
