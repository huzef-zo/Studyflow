/**
 * StudyFlow - AudioDB Module
 * Handles IndexedDB storage for audio recording blobs.
 */

const AudioDB = (function() {
  'use strict';

  const DB_NAME = 'studyflow_audio';
  const DB_VERSION = 1;
  const STORE_NAME = 'recordings';

  let dbPromise = null;

  function getDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB is not supported or available.'));
      }

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = (event) => {
          const db = event.target.result;
          db.onversionchange = () => {
            db.close();
            dbPromise = null;
          };
          resolve(db);
        };

        request.onerror = () => {
          dbPromise = null;
          reject(request.error || new Error('Failed to open IndexedDB database'));
        };
      } catch (err) {
        dbPromise = null;
        reject(err);
      }
    });

    return dbPromise;
  }

  function saveBlob(id, blob) {
    return getDB().then((db) => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(blob, id);

          req.onsuccess = () => resolve(id);
          req.onerror = () => reject(req.error || new Error('Failed to save blob to IndexedDB'));
          tx.onerror = () => reject(tx.error || new Error('Transaction error saving blob'));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  function getBlob(id) {
    return getDB().then((db) => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(id);

          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error || new Error('Failed to get blob from IndexedDB'));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  function deleteBlob(id) {
    return getDB().then((db) => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(id);

          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error || new Error('Failed to delete blob from IndexedDB'));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  function clearAll() {
    return getDB().then((db) => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.clear();

          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error || new Error('Failed to clear IndexedDB audio store'));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  function getTotalSize() {
    return getDB().then((db) => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.openCursor();
          let totalSize = 0;

          req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const val = cursor.value;
              if (val && typeof val.size === 'number') {
                totalSize += val.size;
              }
              cursor.continue();
            } else {
              resolve(totalSize);
            }
          };

          req.onerror = () => reject(req.error || new Error('Failed to compute total size from IndexedDB'));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  return {
    saveBlob,
    getBlob,
    deleteBlob,
    clearAll,
    getTotalSize
  };
})();

if (typeof window !== 'undefined') {
  window.AudioDB = AudioDB;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioDB;
}
