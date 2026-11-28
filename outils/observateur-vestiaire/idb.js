// VRM Observateur Vestiaire — la base locale (IndexedDB de l'extension). Partagée par le fond et la page.
// Rien ne sort : IndexedDB vit dans le profil du navigateur, sous l'origine chrome-extension:// de l'observateur.
(function (racine) {
  'use strict';
  const NOM = 'vrm-observateur-vestiaire';
  const MAGASIN = 'ev';
  let ouverture = null;

  function ouvrir() {
    if (ouverture) return ouverture;
    ouverture = new Promise((ok, ko) => {
      const r = indexedDB.open(NOM, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(MAGASIN)) {
          const s = db.createObjectStore(MAGASIN, { keyPath: 'k', autoIncrement: true });
          s.createIndex('t', 't');
        }
      };
      r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); ouverture = null; }; ok(db); };
      r.onerror = () => { ouverture = null; ko(r.error); };
    });
    return ouverture;
  }

  function fin(tx) { return new Promise((ok, ko) => { tx.oncomplete = () => ok(); tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error); }); }

  async function ajouter(evs) {
    if (!evs.length) return;
    const db = await ouvrir();
    const tx = db.transaction(MAGASIN, 'readwrite');
    const s = tx.objectStore(MAGASIN);
    for (const e of evs) { const c = Object.assign({}, e); delete c.k; s.add(c); }
    await fin(tx);
  }

  async function compter() {
    const db = await ouvrir();
    return new Promise((ok, ko) => { const r = db.transaction(MAGASIN).objectStore(MAGASIN).count(); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  }

  // Garder les `plafond` plus récents (par heure de l'événement, index « t ») : les plus anciens sortent.
  async function tailler(plafond) {
    const n = await compter();
    if (n <= plafond) return 0;
    const db = await ouvrir();
    const tx = db.transaction(MAGASIN, 'readwrite');
    let reste = n - plafond;
    const r = tx.objectStore(MAGASIN).index('t').openCursor();
    r.onsuccess = () => { const c = r.result; if (!c || reste <= 0) return; c.delete(); reste--; c.continue(); };
    await fin(tx);
    return n - plafond;
  }

  async function tout() {
    const db = await ouvrir();
    return new Promise((ok, ko) => { const r = db.transaction(MAGASIN).objectStore(MAGASIN).getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => ko(r.error); });
  }

  async function effacer() {
    const db = await ouvrir();
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).clear();
    await fin(tx);
  }

  racine.VRMBase = { ouvrir, ajouter, compter, tailler, tout, effacer };
})(typeof self !== 'undefined' ? self : globalThis);
