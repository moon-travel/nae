export const DB_NAME = 'squat-research';
export const DB_VERSION = 1;
export const SESSION_STORE = 'sessions';

export function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('このブラウザではIndexedDBを利用できません。'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('データベースを開けませんでした。'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        store.createIndex('startedAt', 'startedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export function transactionRequest<T>(db: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = db.transaction(SESSION_STORE, mode); } catch (error) { reject(error); return; }
    let request: IDBRequest<T> | undefined;
    let requestError: DOMException | null = null;
    tx.oncomplete = () => requestError ? reject(requestError) : resolve(request?.result as T);
    tx.onabort = () => reject(tx.error ?? requestError ?? new Error('データベース操作が中断されました。'));
    tx.onerror = () => { requestError = tx.error ?? requestError; };
    try { request = action(tx.objectStore(SESSION_STORE)); } catch (error) { reject(error); return; }
    request.onerror = () => { requestError = request?.error ?? null; };
  });
}
