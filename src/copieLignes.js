// ════════════════════════════════════════════════════════════════════════════
//  LES LISTES GARDÉES SUR L'APPAREIL, REVALIDÉES PAR LEUR VERSION
//  (10 nov., lot K « ouverture encore plus légère », proposition 12)
// ════════════════════════════════════════════════════════════════════════════
//  Mesuré au banc (`_mesure-demarrage.cjs`, 390 px, 4G) : à CHAQUE ouverture, les
//  mêmes lignes lourdes repartaient en entier — ventes et achats de chaque compte
//  (~1,26 Mo), dressings (~160 Ko), boîtes de réception (~170 Ko) — même quand
//  rien n'avait changé depuis la veille.
//
//  ⇒ La dernière copie LUE d'une de ces lignes est gardée sur l'appareil
//    (IndexedDB). À l'ouverture suivante, on demande d'abord au serveur la
//    VERSION de chaque ligne — une projection SCALAIRE (`SEL_VERSION` : date
//    d'écriture, date de capture, `data.rev`, marque « vidée »), jamais
//    `select=data` (§4.4) — puis :
//      · version identique ⇒ la copie EST la ligne du serveur : rien à télécharger ;
//      · version différente (ou ligne pas gardée) ⇒ seule CETTE ligne est relue ;
//      · ligne absente des versions ⇒ elle n'existe plus : la copie part.
//
//  ⚠️ CE QUI NE DOIT JAMAIS ARRIVER, et ce que la règle fait à la place :
//   · une copie présentée comme fraîche sans que le serveur l'ait confirmée :
//     une lecture des versions RATÉE ne rend JAMAIS la copie ; on relit comme
//     avant (la ligne entière) et, si ça rate aussi, « pas su » (`ok:false`),
//     exactement l'ancien chemin. La copie reste sur l'appareil (jamais vidée)
//     et l'app dit « pas relu » (`etatCopies`, la mention de la coque) ;
//   · une écriture qui partirait d'une copie : la copie n'est rendue QUE
//     confirmée par la version du serveur lue à l'instant — c'est la ligne du
//     serveur, octet pour octet. Aucun écran, aucun publieur ne reçoit autre chose ;
//   · une copie plus vieille que sa version : la version est lue AVANT la ligne
//     (une écriture entre les deux range une ligne plus NEUVE sous l'ancienne
//     version ⇒ relue la fois suivante, jamais l'inverse) ; une ligne relue dont
//     la version n'a pas été lue n'est pas gardée ;
//   · la copie d'un autre compte VRM : clé ET valeur portent l'uid, vérifié à la
//     lecture ; écrire pour un uid efface les copies de tout autre uid ; la
//     déconnexion et le changement de vendeur effacent tout (`effacerCopies`) ;
//   · un PDF ou une photo lourde gardés : seules les projections des lectures
//     de moisson passent ici (aucun `pdfB64`) ; une ligne qui en porterait un, ou
//     de plus de `MAX_LIGNE` caractères, n'est pas gardée.
// ════════════════════════════════════════════════════════════════════════════

// La version d'une ligne : tout ce qui change quand l'extension, le serveur
// (`api/_lib/commandes-leger.js`, `data.rev` + 1) ou « Supprimer des données… »
// (`supprime`, `purgedAt`) l'écrivent. Scalaires seulement.
export const SEL_VERSION = 'id,updated_at,cap:data->>capturedAt,rev:data->>rev,sup:data->>supprime,pg:data->>purgedAt';
export const MAX_LIGNE = 4000000;
const CLE_VU = 'vrm_copies_vu';   // `vrm_` : effacée avec les données locales (wipeLocalData)

export function versionDe(r) {
  if (!r || typeof r !== 'object') return null;
  const n = (x) => (x === undefined || x === '' ? null : x);
  return JSON.stringify([n(r.updated_at), n(r.cap), n(r.rev), n(r.sup), n(r.pg)]);
}

const gardable = (row) => {
  try {
    const t = JSON.stringify(row);
    return typeof t === 'string' && t.length <= MAX_LIGNE && !/"pdfB64"\s*:\s*"[^"]/.test(t);
  } catch (_) { return false; }
};

// ── Le stockage ──────────────────────────────────────────────────────────────
// `lire(uid, famille, ids)` → Map(id → { v, row }) ; `ecrire(uid, famille, [{id, v, row}])` ;
// `retirer(uid, famille, ids)` ; `effacer()`. Toute erreur = « rien de gardé ».
export function stockageMemoire() {
  const m = new Map();
  return {
    m,
    async lire(uid, famille, ids) {
      const out = new Map();
      for (const id of ids) { const e = m.get(`${uid}|${famille}|${id}`); if (e && e.uid === uid && e.id === id) out.set(id, { v: e.v, row: JSON.parse(JSON.stringify(e.row)) }); }
      return out;
    },
    async ecrire(uid, famille, lignes) {
      for (const k of [...m.keys()]) if (m.get(k).uid !== uid) m.delete(k);
      for (const l of lignes) m.set(`${uid}|${famille}|${l.id}`, { k: `${uid}|${famille}|${l.id}`, uid, id: l.id, v: l.v, row: JSON.parse(JSON.stringify(l.row)) });
    },
    async retirer(uid, famille, ids) { for (const id of ids) m.delete(`${uid}|${famille}|${id}`); },
    async effacer() { m.clear(); },
  };
}

const NOM_BASE = 'vrm_copies', MAGASIN = 'lignes';
export function stockageIdb(idb = (typeof indexedDB !== 'undefined' ? indexedDB : null)) {
  let ouverte = null;
  const ouvrir = () => {
    if (!idb) return Promise.resolve(null);
    if (ouverte) return ouverte;
    ouverte = new Promise((ok) => {
      try {
        const rq = idb.open(NOM_BASE, 1);
        rq.onupgradeneeded = () => { try { rq.result.createObjectStore(MAGASIN, { keyPath: 'k' }); } catch (_) {} };
        rq.onsuccess = () => { const db = rq.result; try { db.onversionchange = () => { try { db.close(); } catch (_) {} ouverte = null; }; } catch (_) {} ok(db); };
        rq.onerror = () => ok(null);
        rq.onblocked = () => ok(null);
      } catch (_) { ok(null); }
    }).then((db) => { if (!db) ouverte = null; return db; });
    return ouverte;
  };
  const tx = async (mode, f) => {
    const db = await ouvrir();
    if (!db) return null;
    return new Promise((ok) => {
      try {
        const t = db.transaction(MAGASIN, mode);
        const s = t.objectStore(MAGASIN);
        const res = f(s);
        t.oncomplete = () => ok(res && typeof res.then !== 'function' ? res : true);
        t.onerror = () => ok(null);
        t.onabort = () => ok(null);
      } catch (_) { ok(null); }
    });
  };
  return {
    async lire(uid, famille, ids) {
      const out = new Map();
      await tx('readonly', (s) => {
        for (const id of ids) {
          const rq = s.get(`${uid}|${famille}|${id}`);
          rq.onsuccess = () => { const e = rq.result; if (e && e.uid === uid && e.id === id && e.f === famille) out.set(id, { v: e.v, row: e.row }); };
        }
        return out;
      });
      return out;
    },
    async ecrire(uid, famille, lignes) {
      await tx('readwrite', (s) => {
        // Un seul compte VRM sur l'appareil : les copies d'un autre uid partent.
        const c = s.openCursor();
        c.onsuccess = () => { const cur = c.result; if (!cur) return; if (!cur.value || cur.value.uid !== uid) cur.delete(); cur.continue(); };
        for (const l of lignes) s.put({ k: `${uid}|${famille}|${l.id}`, uid, f: famille, id: l.id, v: l.v, row: l.row });
        return true;
      });
    },
    async retirer(uid, famille, ids) { await tx('readwrite', (s) => { for (const id of ids) s.delete(`${uid}|${famille}|${id}`); return true; }); },
    async effacer() {
      try { const db = await ouverte; if (db) db.close(); } catch (_) {}
      ouverte = null;
      if (!idb) return;
      await new Promise((ok) => { try { const rq = idb.deleteDatabase(NOM_BASE); rq.onsuccess = rq.onerror = rq.onblocked = () => ok(); } catch (_) { ok(); } });
    },
  };
}

// ── L'état pour l'écran : « vu à hh:mm · pas relu » ─────────────────────────
// `pasRelu` : les lignes gardées dont la relecture a échoué (id → heure de la
// dernière confirmation). Vide ⇒ rien à dire.
const _etat = { pasRelu: new Map() };
const _ecoutes = new Set();
const signaler = () => { for (const f of _ecoutes) { try { f(); } catch (_) {} } };
export function ecouterCopies(f) { _ecoutes.add(f); return () => _ecoutes.delete(f); }
export function etatCopies() {
  if (!_etat.pasRelu.size) return null;
  const ts = [..._etat.pasRelu.values()].filter((t) => Number.isFinite(t));
  return { n: _etat.pasRelu.size, vuA: ts.length ? Math.min(...ts) : null };
}
const noterPasRelu = (ids, vuA) => { let ch = false; for (const id of ids) { if (_etat.pasRelu.get(id) !== vuA) { _etat.pasRelu.set(id, vuA); ch = true; } } if (ch) signaler(); };
const noterRelu = (ids) => { let ch = false; for (const id of ids) if (_etat.pasRelu.delete(id)) ch = true; if (ch) signaler(); };
export function oublierEtatCopies() { if (_etat.pasRelu.size) { _etat.pasRelu.clear(); signaler(); } }

// L'heure de la dernière confirmation par le serveur, par compte VRM (sur l'appareil).
function lireVu(stock, uid) {
  try { const o = JSON.parse(stock.getItem(CLE_VU) || 'null'); return o && o.uid === uid && Number.isFinite(o.at) ? o.at : null; } catch (_) { return null; }
}
function noterVu(stock, uid, at) { try { stock.setItem(CLE_VU, JSON.stringify({ uid, at })); } catch (_) {} }

// ── La règle ─────────────────────────────────────────────────────────────────
// `lireVersions(ids)` → tableau de lignes `SEL_VERSION` ou `null` (pas su).
// `lireLignes(ids)` → tableau de lignes entières (projection de l'appelant) ou `null`.
// Rend `{ ok:true, rows, telecharges, depuisCopie }` ou `{ ok:false }` (pas su) —
// `rows` : exactement ce que `lireLignes(ids)` aurait rendu (lignes existantes).
export async function lireAvecCopie({ uid, famille, ids, lireVersions, lireLignes, stockage, local = null, maintenant = Date.now }) {
  const tous = [...new Set((ids || []).map(String))];
  const direct = async () => {
    const r = await lireLignes(tous).catch(() => null);
    return Array.isArray(r) ? { ok: true, rows: r, telecharges: tous, depuisCopie: [] } : { ok: false };
  };
  if (!uid || !tous.length || !stockage) return direct();
  let copies = new Map();
  try { copies = (await stockage.lire(uid, famille, tous)) || new Map(); } catch (_) { copies = new Map(); }
  const vers = await Promise.resolve().then(() => lireVersions(tous)).catch(() => null);
  if (!Array.isArray(vers)) {
    // Pas su : jamais la copie. L'ancien chemin (la ligne entière) ; raté ⇒ pas su,
    // et les lignes gardées sont dites « pas relues » (la copie, elle, reste).
    const r = await direct();
    if (r.ok) noterRelu(tous);
    else if (copies.size) noterPasRelu([...copies.keys()], local ? lireVu(local, uid) : null);
    return r;
  }
  const v = new Map();
  for (const x of vers) if (x && x.id != null && tous.includes(String(x.id))) v.set(String(x.id), versionDe(x));
  const aRelire = tous.filter((id) => v.has(id) && !(copies.has(id) && copies.get(id).v === v.get(id)));
  const disparues = [...copies.keys()].filter((id) => !v.has(id));
  let frais = [];
  if (aRelire.length) {
    const r = await lireLignes(aRelire).catch(() => null);
    if (!Array.isArray(r)) {
      if (copies.size) noterPasRelu([...copies.keys()], local ? lireVu(local, uid) : null);
      return { ok: false };
    }
    frais = r;
  }
  const parId = new Map(frais.filter((x) => x && x.id != null).map((x) => [String(x.id), x]));
  // Des lignes que les versions disent exister et que la relecture ne rend pas : la
  // réponse ne se comprend pas (un serveur qui ignore `in.(…)` rend `[]`, §4.1) ⇒ on
  // ne devine pas, l'appelant relit comme avant (`incoherent`). Rien n'est gardé.
  if (aRelire.some((id) => !parId.has(id))) return { ok: false, incoherent: true };
  const rows = [];
  for (const id of tous) {
    if (!v.has(id)) { if (parId.has(id)) rows.push(parId.get(id)); continue; }
    if (aRelire.includes(id)) { if (parId.has(id)) rows.push(parId.get(id)); }
    else rows.push(copies.get(id).row);
  }
  // Ranger : seulement une ligne relue dont la version a été lue AVANT elle.
  const aGarder = aRelire.filter((id) => parId.has(id) && gardable(parId.get(id))).map((id) => ({ id, v: v.get(id), row: parId.get(id) }));
  try { if (aGarder.length) await stockage.ecrire(uid, famille, aGarder); } catch (_) {}
  try { if (disparues.length) await stockage.retirer(uid, famille, disparues); } catch (_) {}
  noterRelu(tous);
  if (local) noterVu(local, uid, maintenant());
  return { ok: true, rows, telecharges: aRelire, depuisCopie: tous.filter((id) => v.has(id) && !aRelire.includes(id)) };
}

// ── L'instance de l'app ─────────────────────────────────────────────────────
let _stock = null;
export function stockageApp() {
  if (_stock) return _stock;
  try { _stock = (typeof indexedDB !== 'undefined' && indexedDB) ? stockageIdb() : null; } catch (_) { _stock = null; }
  return _stock;
}
export function effacerCopies() {
  oublierEtatCopies();
  try { const s = stockageApp(); if (s) return s.effacer().catch(() => {}); } catch (_) {}
  return Promise.resolve();
}
export function heureVu(ts) {
  if (!Number.isFinite(ts)) return null;
  try { return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); } catch (_) { return null; }
}
