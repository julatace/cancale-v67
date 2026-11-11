// ══════════════════════════════════════════════════════════════════════════════
//  LES GESTES FAITS HORS LIGNE — UNE FILE PAR COMPTE VRM, REJOUÉE UN PAR UN
//  (11 nov. 2026, demande de Julien : « toute l'app utilisable hors ligne, au
//  relais, en brocante, au dépôt, et synchronisée sans conflit au retour »)
// ══════════════════════════════════════════════════════════════════════════════
// Ce qui existait et reste : la valeur tapée va dans le navigateur (`save`), la
// FILE D'ENVOI (src/fileEnvoi.js) garde la base de la fusion par CLÉ et
// `cloudPush` fusionne à trois voies. Ce qu'elle ne savait pas faire : dire QUEL
// geste attend, et ne jamais écraser une valeur qu'un AUTRE appareil a changée
// pendant la coupure (la règle « le geste de l'appareil gagne » d'une sous-valeur
// changée des deux côtés réécrivait l'autre, sans un mot).
//
// Ici, chaque geste fait sans réseau est noté, PAR SOUS-VALEUR (un colis, un
// prix d'achat d'un N°, une note, un achat, un champ d'une fiche) avec ce que
// l'appareil voyait AVANT et ce qu'il a mis APRÈS, un identifiant unique et un
// numéro d'ordre. Rangé dans IndexedDB au nom du compte VRM : il survit à la
// fermeture de l'app et au redémarrage du téléphone.
//
// AU RETOUR DU RÉSEAU (`rejouer`), UN PAR UN, dans l'ordre :
//   · la ligne `main` est LUE (une lecture ratée n'écrit RIEN, §4) ;
//   · l'identifiant du geste est déjà dans `vrm_gestes_faits` ⇒ déjà appliqué
//     (envoyé sans réponse) : rien n'est appliqué deux fois ;
//   · la base porte déjà la valeur du geste ⇒ « envoyé » sans écrire ;
//   · la base porte encore ce que l'appareil voyait AVANT ⇒ on écrit le geste,
//     COMPARER-ET-ÉCHANGER sur `data.rev` (devancé ⇒ on relit, on rejuge) ;
//   · la base porte une AUTRE valeur (changée ailleurs pendant la coupure) :
//       – un ENSEMBLE (colis retiré, fait, déposé) : les deux disent « fait »
//         ⇒ rien à écrire (la règle du domaine : l'union) ;
//       – sinon ⇒ À TRANCHER : le geste garde les DEUX versions, rien n'est
//         écrit, l'appareil reprend la valeur de la base (sinon l'envoi suivant
//         l'écraserait). « Garder la mienne » le rejoue (contre la valeur vue) ;
//         « Garder l'autre » le range. Rien n'est jamais perdu.
//   · 429, 5xx, réseau ⇒ on s'arrête là, le geste reste « en attente », la
//     suite au prochain passage (aucun geste sauté, l'ordre est gardé).
//
// ⚠️ LES NUMÉROS (§5). Un N° saisi à la main hors ligne se rejoue seulement si
//    aucune AUTRE fiche de la base ne le porte et s'il n'est pas entré dans le
//    pool pendant la coupure (un autre appareil l'a donné) — sinon à trancher.
//    Le pool reçoit le N° (union, jamais un retrait). Un NOUVEAU N° ne se
//    réserve JAMAIS hors ligne : l'appelant le refuse (« N° au retour du réseau »).
//
// Module PUR : le stockage, la lecture et l'écriture sont passés en paramètre.
// Exécuté tel quel par `scripts/audit-gestes-hors-ligne.cjs`.

import { egal, jsonStable, CLE_POOL } from './fusionNuage.js';

export const CLE_FAITS = 'vrm_gestes_faits';
export const FAITS_MAX = 400;
export const ENVOYES_GARDES = 30;

// Les clés dont un geste se note hors ligne, et la règle de leur domaine.
//   sorte 'ensemble' : « fait » des deux côtés = d'accord (l'union) ;
//   sorte 'champ'    : une valeur changée des deux côtés = à trancher ;
//   forme 'fiches'   : une carte d'objets, jugée CHAMP PAR CHAMP (une fiche dont
//                      l'extension a relu la photo n'est pas « changée ailleurs »).
export const REGLES_GESTES = Object.freeze({
  vrm_colis_collected: { sorte: 'ensemble', quoi: 'retire' },
  vrm_colis_collected_at: { sorte: 'ensemble', quoi: 'retire' },
  vinted_pickup_done: { sorte: 'ensemble', quoi: 'retire' },
  vinted_ship_done: { sorte: 'ensemble', quoi: 'colisfait' },
  vinted_bords_shipped: { sorte: 'ensemble', quoi: 'depose' },
  vrm_lbc_colis_done: { sorte: 'ensemble', quoi: 'colisfait' },
  vrm_vc_colis_done: { sorte: 'ensemble', quoi: 'colisfait' },
  vinted_buyprice_by_num: { sorte: 'champ', quoi: 'prix' },
  vinted_achat_notes: { sorte: 'champ', quoi: 'note' },
  vrm_notes_paires: { sorte: 'champ', quoi: 'note' },
  vrm_rappels: { sorte: 'champ', quoi: 'rappel' },
  vinted_offvinted_buys: { sorte: 'champ', quoi: 'achat' },
  vinted_annonce_numeros: { sorte: 'champ', forme: 'fiches', quoi: 'fiche' },
  vrm_vc_liens: { sorte: 'champ', forme: 'fiches', quoi: 'ecrit' },
});
export const CLES_GESTES_HORS_LIGNE = Object.freeze(Object.keys(REGLES_GESTES));

const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const vide = (v) => v === undefined || v === null || v === '' || v === false;
const memeVal = (a, b) => (vide(a) && vide(b)) || egal(a, b);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const estListeId = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => estObjet(x) && x.id != null && String(x.id) !== '');

// ── Le chemin d'une sous-valeur ──────────────────────────────────────────────
// Un segment : une chaîne (clé d'objet), `{ id }` (élément d'une liste d'objets
// par son identifiant), `{ el }` (présence d'une valeur simple dans une liste).
export const cleChemin = (k, chemin) => k + '|' + jsonStable(chemin);
export function valeurA(val, chemin) {
  let v = val;
  for (const s of chemin) {
    if (v === undefined || v === null) return undefined;
    if (typeof s === 'string') v = estObjet(v) ? v[s] : undefined;
    else if (s && 'id' in s) v = Array.isArray(v) ? v.find((x) => estObjet(x) && String(x.id) === String(s.id)) : undefined;
    else if (s && 'el' in s) v = Array.isArray(v) && v.some((x) => jsonStable(x) === jsonStable(s.el)) ? true : undefined;
    else return undefined;
  }
  return v;
}
export function poserA(val, chemin, nv) {
  if (!chemin.length) return clone(nv);
  const [s, ...reste] = chemin;
  if (typeof s === 'string') {
    const o = estObjet(val) ? { ...val } : {};
    const sous = reste.length ? poserA(o[s], reste, nv) : clone(nv);
    if (sous === undefined || (reste.length && estObjet(sous) && !Object.keys(sous).length && nv === undefined)) delete o[s];
    else o[s] = sous;
    return o;
  }
  const l = Array.isArray(val) ? [...val] : [];
  if (s && 'el' in s) {
    const i = l.findIndex((x) => jsonStable(x) === jsonStable(s.el));
    if (vide(nv)) { if (i >= 0) l.splice(i, 1); } else if (i < 0) l.push(clone(s.el));
    return l;
  }
  if (s && 'id' in s) {
    const i = l.findIndex((x) => estObjet(x) && String(x.id) === String(s.id));
    const sous = reste.length ? poserA(i >= 0 ? l[i] : undefined, reste, nv) : clone(nv);
    if (sous === undefined) { if (i >= 0) l.splice(i, 1); } else if (i >= 0) l[i] = sous; else l.unshift(sous);
    return l;
  }
  return val;
}

// ── Ce qu'un `save` a changé, sous-valeur par sous-valeur ───────────────────
export function differences(k, avant, apres) {
  const regle = REGLES_GESTES[k]; if (!regle) return [];
  const out = [];
  if (Array.isArray(avant) || Array.isArray(apres)) {
    const a = Array.isArray(avant) ? avant : [], b = Array.isArray(apres) ? apres : [];
    if (estListeId(a) || estListeId(b)) {
      const ids = new Set([...a, ...b].filter(estObjet).map((x) => String(x.id)));
      for (const id of ids) {
        const va = valeurA(a, [{ id }]), vb = valeurA(b, [{ id }]);
        if (!egal(va, vb)) out.push({ chemin: [{ id }], avant: va, apres: vb });
      }
    } else {
      const sa = new Set(a.map(jsonStable)), sb = new Set(b.map(jsonStable));
      for (const x of b) if (!sa.has(jsonStable(x))) out.push({ chemin: [{ el: x }], avant: undefined, apres: true });
      for (const x of a) if (!sb.has(jsonStable(x))) out.push({ chemin: [{ el: x }], avant: true, apres: undefined });
    }
    return out;
  }
  const a = estObjet(avant) ? avant : {}, b = estObjet(apres) ? apres : {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (egal(a[id], b[id])) continue;
    if (regle.forme === 'fiches' && (estObjet(a[id]) || estObjet(b[id]))) {
      const fa = estObjet(a[id]) ? a[id] : {}, fb = estObjet(b[id]) ? b[id] : {};
      if (!estObjet(a[id]) || !estObjet(b[id])) { out.push({ chemin: [id], avant: a[id], apres: b[id] }); continue; }
      for (const c of new Set([...Object.keys(fa), ...Object.keys(fb)])) if (!egal(fa[c], fb[c])) out.push({ chemin: [id, c], avant: fa[c], apres: fb[c] });
    } else out.push({ chemin: [id], avant: a[id], apres: b[id] });
  }
  return out;
}

// ── Le registre (un par compte VRM) ─────────────────────────────────────────
// `stockage.lire(uid)` → { uid, seq, gestes } | null (pas su) ;
// `stockage.ecrire(uid, reg)` → true | false. Toute erreur = « pas su ».
export function stockageMemoireGestes() {
  const m = new Map();
  return {
    m,
    async lire(uid) { const r = m.get(uid); return r ? clone(r) : { uid, seq: 0, gestes: [] }; },
    async ecrire(uid, reg) { m.set(uid, clone({ ...reg, uid })); return true; },
    async effacer(uid) { m.delete(uid); return true; },
  };
}
export function stockageIdbGestes(idb = (typeof indexedDB !== 'undefined' ? indexedDB : null)) {
  const NOM = 'vrm-gestes', MAG = 'registres';
  let ouverte = null;
  const ouvrir = () => {
    if (!idb) return Promise.resolve(null);
    if (ouverte) return ouverte;
    ouverte = new Promise((ok) => {
      try {
        const rq = idb.open(NOM, 1);
        rq.onupgradeneeded = () => { try { rq.result.createObjectStore(MAG, { keyPath: 'uid' }); } catch (_) {} };
        rq.onsuccess = () => ok(rq.result);
        rq.onerror = () => ok(null);
        rq.onblocked = () => ok(null);
      } catch (_) { ok(null); }
    }).then((db) => { if (!db) ouverte = null; return db; });
    return ouverte;
  };
  return {
    async lire(uid) {
      const db = await ouvrir(); if (!db) return null;
      return new Promise((ok) => {
        try {
          const rq = db.transaction(MAG, 'readonly').objectStore(MAG).get(uid);
          rq.onsuccess = () => { const r = rq.result; ok(r && r.uid === uid && Array.isArray(r.gestes) ? r : { uid, seq: 0, gestes: [] }); };
          rq.onerror = () => ok(null);
        } catch (_) { ok(null); }
      });
    },
    async ecrire(uid, reg) {
      const db = await ouvrir(); if (!db) return false;
      return new Promise((ok) => {
        try {
          const t = db.transaction(MAG, 'readwrite');
          t.objectStore(MAG).put(clone({ ...reg, uid }));
          t.oncomplete = () => ok(true); t.onerror = () => ok(false); t.onabort = () => ok(false);
        } catch (_) { ok(false); }
      });
    },
    async effacer(uid) {
      const db = await ouvrir(); if (!db) return false;
      return new Promise((ok) => { try { const t = db.transaction(MAG, 'readwrite'); t.objectStore(MAG).delete(uid); t.oncomplete = () => ok(true); t.onerror = () => ok(false); } catch (_) { ok(false); } });
    },
  };
}

// Un verrou par compte : deux écritures du registre ne se croisent jamais
// (le dernier `lire → modifier → écrire` attend le précédent).
const _verrous = new Map();
const sousVerrou = (uid, f) => {
  const avant = _verrous.get(uid) || Promise.resolve();
  const p = avant.then(f, f);
  _verrous.set(uid, p.catch(() => {}));
  return p;
};
const nouvelId = (uid, seq, maintenant) => `g_${String(uid).slice(0, 8)}_${maintenant.toString(36)}_${seq.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// NOTER : un `save` fait hors ligne. Un geste déjà en attente sur la MÊME
// sous-valeur garde son « avant » d'origine et son identifiant (le prix tapé
// chiffre par chiffre, « Fait » puis « Annuler ») ; revenu à son avant, il part.
// `extra(d)` ajoute ce que la règle du domaine doit savoir (le N° déjà au pool).
// Rend { notes: n, ids } ou null (pas su : le registre ne se lit pas).
export function noterGestes(stockage, uid, k, avant, apres, { maintenant = Date.now(), extra = null } = {}) {
  const regle = REGLES_GESTES[k];
  if (!uid || !regle) return Promise.resolve({ notes: 0, ids: [] });
  const diffs = differences(k, avant, apres);
  if (!diffs.length) return Promise.resolve({ notes: 0, ids: [] });
  return sousVerrou(uid, async () => {
    const reg = await stockage.lire(uid).catch(() => null);
    if (!reg) return null;
    const gestes = Array.isArray(reg.gestes) ? reg.gestes : [];
    let seq = Number.isSafeInteger(reg.seq) ? reg.seq : 0;
    const ids = [];
    for (const d of diffs) {
      const c = cleChemin(k, d.chemin);
      const i = gestes.findIndex((g) => g.etat === 'attente' && cleChemin(g.k, g.chemin) === c);
      if (i >= 0) {
        const g = gestes[i];
        if (memeVal(g.avant, d.apres)) { gestes.splice(i, 1); continue; }
        gestes[i] = { ...g, apres: clone(d.apres), at: maintenant };
        ids.push(g.id);
        continue;
      }
      seq += 1;
      const g = { id: nouvelId(uid, seq, maintenant), uid, k, chemin: clone(d.chemin), avant: clone(d.avant), apres: clone(d.apres), sorte: regle.sorte, quoi: regle.quoi, at: maintenant, seq, etat: 'attente' };
      if (typeof extra === 'function') { try { Object.assign(g, extra(g) || {}); } catch (_) {} }
      gestes.push(g); ids.push(g.id);
    }
    const ok = await stockage.ecrire(uid, { uid, seq, gestes }).catch(() => false);
    return ok ? { notes: ids.length, ids } : null;
  });
}

// Une LIGNE à part (la photo d'un achat, `achat_hors_photo_{id}`) : pas dans `main`,
// envoyée telle quelle au retour par `envoyerLigne(g)` (l'écriture d'avant, qui
// remplace la ligne : la rejouer deux fois écrit la même chose).
export function noterLigne(stockage, uid, { ligne, id, valeur, quoi = 'photo' }, { maintenant = Date.now() } = {}) {
  if (!uid || !ligne || id == null) return Promise.resolve(null);
  return sousVerrou(uid, async () => {
    const reg = await stockage.lire(uid).catch(() => null);
    if (!reg) return null;
    const gestes = (Array.isArray(reg.gestes) ? reg.gestes : []).filter((g) => !(g.etat === 'attente' && g.ligne === ligne && g.chemin[0] === String(id)));
    const seq = (Number.isSafeInteger(reg.seq) ? reg.seq : 0) + 1;
    const g = { id: nouvelId(uid, seq, maintenant), uid, ligne, k: ligne, chemin: [String(id)], apres: valeur, sorte: 'ligne', quoi, at: maintenant, seq, etat: 'attente' };
    gestes.push(g);
    const ok = await stockage.ecrire(uid, { uid, seq, gestes }).catch(() => false);
    return ok ? g : null;
  });
}

export async function lireGestes(stockage, uid) {
  if (!uid) return null;
  const r = await stockage.lire(uid).catch(() => null);
  return r && Array.isArray(r.gestes) ? r.gestes.filter((g) => g && g.uid === uid) : null;
}
export const attenteSur = (gestes, k) => (gestes || []).some((g) => g && g.etat === 'attente' && g.k === k && !g.ligne);
export const compter = (gestes) => {
  const n = { attente: 0, atrancher: 0, envoye: 0 };
  for (const g of gestes || []) if (g && n[g.etat] !== undefined) n[g.etat]++;
  return n;
};

// ── La règle d'UN geste face à la base ──────────────────────────────────────
// Rend { etat: 'deja' } | { etat: 'ecrire', data } | { etat: 'conflit', autre, raison }.
export function decider(g, data, { cleNum = (x) => String(x) } = {}) {
  const D = estObjet(data) ? data : {};
  const faits = Array.isArray(D[CLE_FAITS]) ? D[CLE_FAITS] : [];
  if (faits.includes(g.id)) return { etat: 'deja', raison: 'identifiant' };
  const cur = valeurA(D[g.k], g.chemin);
  if (memeVal(cur, g.apres)) return { etat: 'deja', raison: 'egal' };
  if (g.sorte === 'ensemble' && !vide(cur) && !vide(g.apres)) return { etat: 'deja', raison: 'union' };
  if (!memeVal(cur, g.avant)) return { etat: 'conflit', autre: clone(cur), raison: 'change-ailleurs' };
  let data2 = { ...D, [g.k]: poserA(D[g.k], g.chemin, g.apres) };
  // Le N° d'une fiche, saisi à la main (§5) : jamais deux paires sous un N°,
  // jamais un N° donné ailleurs pendant la coupure.
  if (g.k === 'vinted_annonce_numeros' && g.chemin.length === 2 && g.chemin[1] === 'numero' && !vide(g.apres)) {
    const n = cleNum(g.apres);
    const fiches = estObjet(D.vinted_annonce_numeros) ? D.vinted_annonce_numeros : {};
    const autre = Object.keys(fiches).find((id) => id !== g.chemin[0] && estObjet(fiches[id]) && !vide(fiches[id].numero) && cleNum(fiches[id].numero) === n);
    if (autre) return { etat: 'conflit', autre: clone(cur), raison: 'numero-porte', fiche: autre };
    const pool = Array.isArray(D[CLE_POOL]) ? D[CLE_POOL] : [];
    const dansPool = pool.some((x) => cleNum(x) === n);
    if (dansPool && !g.dejaDansPool) return { etat: 'conflit', autre: clone(cur), raison: 'numero-pris' };
    if (!dansPool) data2 = { ...data2, [CLE_POOL]: [...pool, g.apres] };
  }
  return { etat: 'ecrire', data: { ...data2, [CLE_FAITS]: [...faits, g.id].slice(-FAITS_MAX) } };
}

// ── LE REJEU ────────────────────────────────────────────────────────────────
// `lire()` → { existe, data, rev } | undefined (pas su) ;
// `ecrire(data, rev)` → { ok:true } | { devance:true } | { status } (data porte
// déjà `rev + 1`) ; `poserLocal(k, chemin, valeur)` remet la valeur de la base
// sur l'appareil après un conflit. Rend { envoyes, conflits, deja, arret }.
//   arret : null (tout jugé) · 'pas-su' · 'sans-ligne' · 'occupe' · un statut HTTP.
const _enCours = new Set();
export async function rejouer({ stockage, uid, lire, ecrire, poserLocal = null, cleNum, maintenant = Date.now, essaisMax = 5, surGeste = null, envoyerLigne = null }) {
  const bilan = { envoyes: 0, conflits: 0, deja: 0, arret: null };
  if (!uid) { bilan.arret = 'pas-su'; return bilan; }
  if (_enCours.has(uid)) { bilan.arret = 'occupe'; return bilan; }
  _enCours.add(uid);
  try {
    const tous = await lireGestes(stockage, uid);
    if (!tous) { bilan.arret = 'pas-su'; return bilan; }
    const file = tous.filter((g) => g.etat === 'attente').sort((a, b) => a.seq - b.seq);
    if (!file.length) return bilan;
    let snap = await Promise.resolve().then(lire).catch(() => undefined);
    if (!snap) { bilan.arret = 'pas-su'; return bilan; }
    if (!snap.existe) { bilan.arret = 'sans-ligne'; return bilan; }
    for (const g0 of file) {
      // Le geste a pu changer entre-temps (une nouvelle saisie, « Annuler ») : on relit le registre.
      const actuels = await lireGestes(stockage, uid);
      if (!actuels) { bilan.arret = 'pas-su'; return bilan; }
      const g = actuels.find((x) => x.id === g0.id);
      if (!g || g.etat !== 'attente') continue;
      if (g.ligne) {
        const r = typeof envoyerLigne === 'function' ? await Promise.resolve().then(() => envoyerLigne(g)).catch(() => ({ status: 0 })) : { status: 0 };
        if (r === true || (r && r.ok)) {
          await marquer(stockage, uid, g.id, { etat: 'envoye', envoyeAt: maintenant(), apres: null });
          bilan.envoyes++;
          if (typeof surGeste === 'function') { try { surGeste(g, 'envoye'); } catch (_) {} }
          continue;
        }
        bilan.arret = (r && r.status) || 0; return bilan;
      }
      let fini = false;
      for (let essai = 0; essai < essaisMax && !fini; essai++) {
        const dec = decider(g, snap.data, { cleNum });
        if (dec.etat === 'deja') { await marquer(stockage, uid, g.id, { etat: 'envoye', envoyeAt: maintenant() }); bilan.deja++; bilan.envoyes++; fini = true; break; }
        if (dec.etat === 'conflit') {
          await marquer(stockage, uid, g.id, { etat: 'atrancher', nuage: dec.autre === undefined ? null : dec.autre, raison: dec.raison, trancheAt: null });
          if (typeof poserLocal === 'function') { try { poserLocal(g.k, g.chemin, dec.autre); } catch (_) {} }
          bilan.conflits++; fini = true; break;
        }
        const rev0 = Number.isSafeInteger(snap.rev) ? snap.rev : null;
        const data = { ...dec.data, rev: (rev0 == null ? 0 : rev0) + 1 };
        const r = await Promise.resolve().then(() => ecrire(data, rev0)).catch(() => ({ status: 0 }));
        if (r && r.ok) {
          snap = { existe: true, data, rev: data.rev };
          await marquer(stockage, uid, g.id, { etat: 'envoye', envoyeAt: maintenant() });
          bilan.envoyes++; fini = true;
          if (typeof surGeste === 'function') { try { surGeste(g, 'envoye'); } catch (_) {} }
          break;
        }
        if (r && r.devance) {
          const s2 = await Promise.resolve().then(lire).catch(() => undefined);
          if (!s2 || !s2.existe) { bilan.arret = 'pas-su'; return bilan; }
          snap = s2; continue;
        }
        bilan.arret = (r && r.status) || 0; return bilan;
      }
      if (!fini) { bilan.arret = 'devance'; return bilan; }
    }
    await ranger(stockage, uid);
    return bilan;
  } finally { _enCours.delete(uid); }
}

export function marquer(stockage, uid, id, patch) {
  return sousVerrou(uid, async () => {
    const reg = await stockage.lire(uid).catch(() => null); if (!reg) return false;
    const gestes = (reg.gestes || []).map((g) => (g.id === id ? { ...g, ...clone(patch) } : g));
    return stockage.ecrire(uid, { ...reg, gestes }).catch(() => false);
  });
}
// Les « envoyés » ne s'accumulent pas : on garde les derniers (pour « Envoyés ✓ »).
export function ranger(stockage, uid) {
  return sousVerrou(uid, async () => {
    const reg = await stockage.lire(uid).catch(() => null); if (!reg) return false;
    const env = reg.gestes.filter((g) => g.etat === 'envoye').sort((a, b) => (b.envoyeAt || 0) - (a.envoyeAt || 0)).slice(0, ENVOYES_GARDES).map((g) => g.id);
    const gestes = reg.gestes.filter((g) => g.etat !== 'envoye' || env.includes(g.id));
    if (gestes.length === reg.gestes.length) return true;
    return stockage.ecrire(uid, { ...reg, gestes }).catch(() => false);
  });
}

// TRANCHER : « mien » ⇒ le geste repart en attente CONTRE la valeur vue dans la
// base (si elle a encore changé : à trancher de nouveau) ; « autre » ⇒ rangé.
// Rend le geste tranché (l'appelant remet « mien » sur l'appareil) ou null.
export function trancher(stockage, uid, id, choix, maintenant = Date.now()) {
  return sousVerrou(uid, async () => {
    const reg = await stockage.lire(uid).catch(() => null); if (!reg) return null;
    const g = (reg.gestes || []).find((x) => x.id === id && x.etat === 'atrancher');
    if (!g) return null;
    const ng = choix === 'mien'
      ? { ...g, etat: 'attente', avant: g.nuage === null ? undefined : g.nuage, nuage: undefined, raison: undefined, at: maintenant, tranche: 'mien' }
      : { ...g, etat: 'envoye', envoyeAt: maintenant, tranche: 'autre' };
    const gestes = reg.gestes.map((x) => (x.id === id ? ng : x));
    const ok = await stockage.ecrire(uid, { ...reg, gestes }).catch(() => false);
    return ok ? ng : null;
  });
}

// Ce qui ne se fait PAS hors ligne : les raisons sont des textes (`tr('horsligne.interdit.*')`,
// src/i18n) ; la liste des sortes est ici.
export const SORTES_INTERDITES = Object.freeze(['extension', 'paiement', 'numero', 'suppression']);
