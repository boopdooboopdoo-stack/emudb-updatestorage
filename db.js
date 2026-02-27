/* ───────── INDEXEDDB ───────── */
const DB_NAME = 'EMUDB';
const DB_VER = 3; // Incremented Version

const db = {
  conn: null,
  init: () => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if(!d.objectStoreNames.contains('games')) d.createObjectStore('games', { keyPath: 'id' });
        if(!d.objectStoreNames.contains('bios')) d.createObjectStore('bios', { keyPath: 'system' });
        if(!d.objectStoreNames.contains('saves')) d.createObjectStore('saves', { keyPath: 'gameId' }); // New Saves Store
      };
      req.onsuccess = (e) => { db.conn = e.target.result; resolve(); };
      req.onerror = (e) => reject(e);
    });
  },
  addGame: (game) => {
    return new Promise((resolve) => {
      const tx = db.conn.transaction(['games'], 'readwrite');
      tx.objectStore('games').put(game);
      tx.oncomplete = resolve;
    });
  },
  getAllGames: () => {
    return new Promise((resolve) => {
      const tx = db.conn.transaction(['games'], 'readonly');
      const req = tx.objectStore('games').getAll();
      req.onsuccess = () => resolve(req.result);
    });
  },
  deleteGame: (id) => {
    return new Promise((resolve) => {
      const tx = db.conn.transaction(['games'], 'readwrite');
      tx.objectStore('games').delete(id);
      tx.oncomplete = resolve;
    });
  },
  /* ─── BIOS ─── */
  addBios: async (system, fileBlob, fileName) => {
     const tx = db.conn.transaction(['bios'], 'readwrite');
     const store = tx.objectStore('bios');
     const req = store.get(system);
     req.onsuccess = () => {
         let data = req.result;
         if(!data) data = { system: system, files: [] };
         if(data.blob) { data.files = [{ name: "default.bin", blob: data.blob }]; delete data.blob; }
         data.files.push({ name: fileName, blob: fileBlob });
         store.put(data);
     };
     return new Promise(r => tx.oncomplete = r);
  },
  getBiosEntry: (system) => {
     return new Promise((resolve) => {
         const tx = db.conn.transaction(['bios'], 'readonly');
         const req = tx.objectStore('bios').get(system);
         req.onsuccess = () => {
             let res = req.result;
             if(res && res.blob) { res = { system: system, files: [{name: "default.bin", blob: res.blob}] }; }
             resolve(res);
         };
     });
  },
  removeBiosFile: async (system, fileName) => {
      const tx = db.conn.transaction(['bios'], 'readwrite');
      const store = tx.objectStore('bios');
      const req = store.get(system);
      req.onsuccess = () => {
          let data = req.result;
          if(data && data.files) {
              data.files = data.files.filter(f => f.name !== fileName);
              store.put(data);
          }
      };
      return new Promise(r => tx.oncomplete = r);
  },
  /* ─── SAVES ─── */
  writeSaveState: (gameId, blob) => {
      return new Promise((resolve) => {
          const tx = db.conn.transaction(['saves'], 'readwrite');
          tx.objectStore('saves').put({ gameId: gameId, blob: blob, date: Date.now() });
          tx.oncomplete = resolve;
      });
  },
  readSaveState: (gameId) => {
      return new Promise((resolve) => {
          const tx = db.conn.transaction(['saves'], 'readonly');
          const req = tx.objectStore('saves').get(gameId);
          req.onsuccess = () => resolve(req.result ? req.result.blob : null);
          req.onerror = () => resolve(null);
      });
  },
  deleteSaveState: (gameId) => {
      return new Promise((resolve) => {
          const tx = db.conn.transaction(['saves'], 'readwrite');
          tx.objectStore('saves').delete(gameId);
          tx.oncomplete = resolve;
      });
  },
  getAllSaves: () => {
      return new Promise((resolve) => {
          const tx = db.conn.transaction(['saves'], 'readonly');
          const req = tx.objectStore('saves').getAll();
          req.onsuccess = () => resolve(req.result);
      });
  }
};