import { createStore, del, delMany, get, set } from 'idb-keyval';

const drawingStore = createStore('riser-drawings', 'files');

export const saveDrawingBlob = (id: string, blob: Blob) => set(id, blob, drawingStore);
export const getDrawingBlob = (id: string) => get<Blob>(id, drawingStore);
export const deleteDrawingBlob = (id: string) => del(id, drawingStore);
export const deleteManyDrawingBlobs = (ids: string[]) => delMany(ids, drawingStore);
