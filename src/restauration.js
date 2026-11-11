// ════════════════════════════════════════════════════════════════════════════
//  REVENIR EN ARRIÈRE (11 nov. 2026, lot « restauration »)
//  docs/passation/2026-11-11-restauration.md
// ════════════════════════════════════════════════════════════════════════════
// Après une mauvaise manipulation (une saisie en série ratée, un import de
// trop), Paramètres → Sécurité et sauvegarde → « Revenir en arrière » :
//   1. choisir un MOMENT : un point de restauration posé tout seul (avant chaque
//      action en série, avant chaque import, une fois par jour) ou un fichier de
//      « Sauvegarde complète » ;
//   2. voir l'APERÇU précis (« 12 prix d'achat remis · 3 notes · 0 numéro »),
//      ligne par ligne, catégorie par catégorie ;
//   3. choisir QUOI restaurer (prix d'achat, liens achat ↔ vente, notes,
//      dépenses et achats hors plateforme, réglages, numéros) ;
//   4. confirmer. « Annuler la restauration » reste possible ensuite : la
//      restauration pose elle-même un point, qui porte son inverse.
//
// Les règles, chacune tenue ici et vérifiée par scripts/audit-restauration.cjs :
//   · RIEN de plus récent n'est effacé sans être montré : une valeur qui
//     n'existait pas au moment choisi (un prix tapé depuis, une note écrite, une
//     dépense ajoutée) ou retouchée après un point PLUS RÉCENT est un CONFLIT —
//     l'écran le montre et DEMANDE (« garder les récentes » / « remettre aussi ») ;
//     sans réponse, rien n'est écrit.
//   · LES NUMÉROS NE RECULENT JAMAIS (§5) : un N° attribué depuis reste attribué ;
//     le pool (`vinted_used_numeros`) ne fait que grandir ; la restauration ne
//     peut que RENDRE un N° à une fiche qui n'en porte plus, et seulement si ce N°
//     n'est porté par AUCUNE autre (fiche, vente, lien Leboncoin, N° Vestiaire) ni
//     rendu deux fois dans la même restauration. « Annuler la restauration » ne
//     retire jamais un N° rendu.
//   · Chaque morceau est CONDITIONNEL (le moteur de la corbeille, src/corbeille.js) :
//     il ne s'écrit que si la valeur est encore celle vue à l'aperçu ; ce qui a
//     changé entre-temps est gardé et compté. Jamais une fiche créée.
//   · Une lecture ratée n'écrit RIEN (`ecrireRestauration` lit toutes les clés
//     d'abord). Les clés vivent dans la ligne `main` : leur écriture passe par
//     l'écrivain de l'app (comparer-et-échanger sur `data.rev`, `cloudPush`).
//   · Les points vivent sur le SERVEUR, dans des lignes dédiées `restore_{0..23}`
//     (jamais dans `main`, jamais lues ailleurs que sur cet écran) ; la liste se
//     lit par la colonne `meta` (scalaires, §4.4), un point entier seulement quand
//     il est ouvert. Rétention : 30 jours, 24 emplacements par compte — un point
//     neuf prend un emplacement vide ou expiré, sinon le plus ancien. Ni le choix
//     de l'emplacement ni le « point du jour » ne lisent le localStorage : ils
//     lisent la liste du serveur.
//
// Module PUR : aucun stockage, aucune horloge implicite. Exécuté tel quel par
// scripts/audit-restauration.cjs ; branché dans src/App.jsx (`RevenirEnArriere`).
// ════════════════════════════════════════════════════════════════════════════

import { appliquerMorceau as appliquerMorceauCorbeille, egal } from './corbeille.js';

export const PREFIXE_POINT = 'restore_';
export const MAX_POINTS = 24;
export const DUREE_POINTS_J = 30;
export const TAILLE_MAX_POINT = 1_000_000;      // octets (JSON) d'un point
export const TAILLE_MAX_REGLAGE = 50_000;        // un réglage plus gros n'est pas gardé (une image…)
const JOUR = 86400e3;

const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const copie = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const tailleDe = (v) => { try { return JSON.stringify(v === undefined ? null : v).length; } catch (_) { return Infinity; } };

// ── Ce qui se restaure ──────────────────────────────────────────────────────
export const CATEGORIES = [
  { id: 'prix', lib: 'Prix d’achat', un: 'prix d’achat', plusieurs: 'prix d’achat' },
  { id: 'liens', lib: 'Liens achat ↔ vente', un: 'lien', plusieurs: 'liens' },
  { id: 'notes', lib: 'Notes', un: 'note', plusieurs: 'notes' },
  { id: 'depenses', lib: 'Dépenses et achats hors plateforme', un: 'ligne', plusieurs: 'lignes' },
  { id: 'reglages', lib: 'Réglages', un: 'réglage', plusieurs: 'réglages' },
  { id: 'numeros', lib: 'Numéros de rangement', un: 'numéro', plusieurs: 'numéros' },
];
export const CHAMPS_PRIX = ['buyPrice'];
export const CHAMPS_LIENS = ['buyFromId', 'buyFrom', 'buyGros'];
export const LISTES_COMPTA = ['depenses', 'fixes', 'packs', 'abonnements'];
// Les réglages qu'IL a posés. Jamais : la numérotation (`vrm_numerotation` est
// écrit par le serveur, le préfixe et « je numérote moi-même » touchent aux N°),
// les jetons, ni un interrupteur qui AGIT sur un site (offres auto, retrait eBay,
// réponses auto) : il ne revient pas tout seul, il se rallume à la main.
export const REGLAGES = {
  vinted_dark: 'Mode sombre', vrm_apparence: 'Apparence', vrm_affichage: 'Affichage',
  vrm_je_vends: 'Je vends', vrm_prenom: 'Prénom', vrm_ville: 'Ville',
  vinted_regime: 'Régime fiscal', vrm_micro_options: 'Options micro-entreprise', vinted_tva: 'TVA',
  vinted_urssaf_freq: 'Fréquence URSSAF', vinted_urssaf_taux: 'Taux URSSAF',
  vinted_goal: 'Objectif', vrm_objectif_mois: 'Objectif du mois',
  vrm_imprimante: 'Imprimante', vinted_bordereau_formats: 'Formats de bordereau', vrm_tampon_positions: 'Position du tampon',
  vinted_offre_refus_msg: 'Message de refus des offres', vrm_republier_reglages: 'Réglages de Republier',
  vrm_photo_presets: 'Réglages photo', vrm_ebay_rythme: 'Rythme eBay', vinted_invoice_settings: 'Ma facture',
  vrm_comptes_exclus: 'Comptes exclus des totaux', vinted_account_labels: 'Noms des comptes',
  vinted_quick_replies: 'Réponses rapides', vrm_modeles_desc: 'Modèles de description', vrm_emballages: 'Emballages',
  vrm_stream_regles: 'Ce que le stream cache',
};
export const CLE_FICHES = 'vinted_annonce_numeros';
export const CLE_VENTES = 'vinted_sale_overrides';
export const CLE_PRIX_NUM = 'vinted_buyprice_by_num';
export const CLE_POOL = 'vinted_used_numeros';
export const CLE_NOTES = 'vrm_notes_paires';
export const CLE_NOTES_ACHATS = 'vinted_achat_notes';
export const CLE_COMPTA = 'vrm_compta';
export const CLE_HORS = 'vinted_offvinted_buys';
// Toutes les clés qu'un point lit (et qu'une restauration peut écrire).
export const CLES_POINT = [CLE_FICHES, CLE_VENTES, CLE_PRIX_NUM, CLE_POOL, CLE_NOTES, CLE_NOTES_ACHATS, CLE_COMPTA, CLE_HORS, ...Object.keys(REGLAGES)];

const prendre = (o, champs) => {
  const r = {};
  if (!estObjet(o)) return r;
  for (const c of champs) if (o[c] !== undefined && o[c] !== null && !(typeof o[c] === 'string' && o[c].trim() === '')) r[c] = copie(o[c]);
  return r;
};
const vide = (o) => !estObjet(o) || Object.keys(o).length === 0;
// Les champs TELS QU'ILS SONT (null et '' compris) : l'« avant » d'un morceau doit
// être la valeur exacte, sinon l'écriture conditionnelle la croirait changée.
const brut = (o, champs) => { const r = {}; if (!estObjet(o)) return r; for (const c of champs) if (o[c] !== undefined) r[c] = copie(o[c]); return r; };
const CHAMPS_FICHE = [...CHAMPS_PRIX, ...CHAMPS_LIENS, 'numero'];

// ── L'INSTANTANÉ : ce qu'un point garde ─────────────────────────────────────
// `lire(k)` ⇒ la valeur, `null` (absente) ou `undefined` (PAS SU). Un seul « pas
// su » ⇒ `null` : pas de point (un point vide restaurerait du vide, §4.1).
// Les fiches et les ventes sont PROJETÉES (prix, liens, N° — pas les titres ni
// les photos) : un point pèse quelques dizaines de Ko, pas la ligne `main`.
export function instantane(lire) {
  const v = {};
  for (const k of CLES_POINT) {
    let x; try { x = lire(k); } catch (_) { x = undefined; }
    if (x === undefined) return null;
    v[k] = x;
  }
  const projeter = (carte) => {
    const out = {};
    for (const [id, f] of Object.entries(estObjet(carte) ? carte : {})) { const p = prendre(f, CHAMPS_FICHE); if (!vide(p)) out[id] = p; }
    return out;
  };
  const compta = {};
  for (const s of LISTES_COMPTA) if (estObjet(v[CLE_COMPTA]) && Array.isArray(v[CLE_COMPTA][s])) compta[s] = copie(v[CLE_COMPTA][s].filter((x) => estObjet(x) && x.id != null));
  const reglages = {}, tropGros = [];
  for (const k of Object.keys(REGLAGES)) {
    if (v[k] === null || v[k] === undefined) continue;
    if (tailleDe(v[k]) > TAILLE_MAX_REGLAGE) { tropGros.push(k); continue; }
    reglages[k] = copie(v[k]);
  }
  const s = {
    v: 1,
    fiches: projeter(v[CLE_FICHES]),
    ventes: projeter(v[CLE_VENTES]),
    prixParNum: estObjet(v[CLE_PRIX_NUM]) ? copie(v[CLE_PRIX_NUM]) : {},
    notes: estObjet(v[CLE_NOTES]) ? copie(v[CLE_NOTES]) : {},
    notesAchats: estObjet(v[CLE_NOTES_ACHATS]) ? copie(v[CLE_NOTES_ACHATS]) : {},
    compta,
    hors: Array.isArray(v[CLE_HORS]) ? copie(v[CLE_HORS].filter((x) => estObjet(x) && x.id != null)) : [],
    reglages,
  };
  if (tropGros.length) s.tropGros = tropGros;
  return s;
}
export const instantaneValide = (s) => estObjet(s) && s.v === 1 && estObjet(s.fiches) && estObjet(s.ventes) && estObjet(s.reglages);

// Une empreinte (FNV-1a 32 bits sur la forme stable) : deux points identiques
// n'en font qu'un.
const stable = (v) => {
  if (v === undefined || v === null) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
};
export function empreinte(s) {
  const t = stable(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0') + '-' + t.length.toString(36);
}

// ── L'APERÇU ────────────────────────────────────────────────────────────────
// `point` : l'instantané du moment choisi · `actuel(k)` : la valeur COURANTE de
// la clé (celle de l'appareil, le nuage lu) · `plusRecent` : l'instantané du
// point suivant (ou null) — une valeur retouchée APRÈS lui est un conflit.
// `cleNum` : l'identité d'un N° (la même que l'app) · `numerosAilleurs` : les
// cleNum des N° portés hors des fiches et des ventes (liens Leboncoin, N° Vestiaire).
// Rend { lignes, parCat, morceaux } ; chaque ligne :
//   { cat, etat, id, libelle, maintenant, avant, morceaux, raison? }
//   etat : 'remis'    — sera remis à la valeur du moment choisi ;
//          'conflit'  — plus récent que le moment choisi : DEMANDE (garder / remettre) ;
//          'garde'    — ne change pas, et c'est dit (un N° attribué depuis, un réglage posé depuis…) ;
//          'refus'    — ne peut pas revenir, et c'est dit (N° porté ailleurs, fiche disparue).
export function apercu({ point, actuel, plusRecent = null, cleNum = (x) => String(x == null ? '' : x).trim().toUpperCase(), numerosAilleurs = [] } = {}) {
  const lignes = [];
  if (!instantaneValide(point)) return { ok: false, raison: 'point', lignes, parCat: {} };
  const lire = (k) => { const x = actuel(k); return x === undefined ? undefined : x; };
  for (const k of CLES_POINT) if (lire(k) === undefined) return { ok: false, raison: 'lecture', lignes, parCat: {} };
  const L = plusRecent && instantaneValide(plusRecent) ? plusRecent : null;
  const fiches = estObjet(lire(CLE_FICHES)) ? lire(CLE_FICHES) : {};
  const ventes = estObjet(lire(CLE_VENTES)) ? lire(CLE_VENTES) : {};
  const nomFiche = (id, f) => (f && f.numero != null && String(f.numero).trim() ? `N°${String(f.numero).trim()}` : f && (f.title || f.titre) ? String(f.title || f.titre).slice(0, 60) : `annonce ${id}`);
  const nomVente = (id, f) => (f && f.numero != null && String(f.numero).trim() ? `N°${String(f.numero).trim()} · vente ${id}` : `vente ${id}`);
  // Conflit « retouché après le point suivant » : la valeur a bougé entre le
  // point suivant et maintenant ALORS qu'elle avait déjà bougé avant lui.
  const retouche = (pv, lv, cv) => L != null && !egal(pv, lv) && !egal(lv, cv);

  // 1. Champs d'une fiche ou d'une vente (prix, liens).
  const parChamps = (cat, k, snapKey, champs, cur, nom) => {
    const P = point[snapKey] || {}, Lr = L ? L[snapKey] || {} : null;
    for (const id of new Set([...Object.keys(P), ...Object.keys(cur)])) {
      const pv = prendre(P[id], champs), cv = prendre(cur[id], champs);
      if (egal(pv, cv)) continue;
      const lib = nom(id, cur[id] || P[id]);
      if (!estObjet(cur[id])) { lignes.push({ cat, etat: 'refus', id, libelle: lib, maintenant: null, avant: pv, raison: 'fiche-absente', morceaux: [] }); continue; }
      const m = { k, type: 'champs', id, avant: brut(cur[id], champs), apres: pv };
      const lv = Lr ? prendre(Lr[id], champs) : undefined;
      const etat = vide(pv) ? 'conflit' : retouche(pv, lv, cv) ? 'conflit' : 'remis';
      lignes.push({ cat, etat, id, libelle: lib, maintenant: cv, avant: pv, raison: vide(pv) ? 'ajoute-depuis' : etat === 'conflit' ? 'retouche' : undefined, morceaux: [m] });
    }
  };
  parChamps('prix', CLE_FICHES, 'fiches', CHAMPS_PRIX, fiches, nomFiche);
  parChamps('prix', CLE_VENTES, 'ventes', CHAMPS_PRIX, ventes, nomVente);
  parChamps('liens', CLE_FICHES, 'fiches', CHAMPS_LIENS, fiches, nomFiche);
  parChamps('liens', CLE_VENTES, 'ventes', CHAMPS_LIENS, ventes, nomVente);

  // 2. Clés d'une carte (prix par N°, notes).
  const parCle = (cat, k, snapKey, nom) => {
    const P = point[snapKey] || {}, cur = estObjet(lire(k)) ? lire(k) : {}, Lr = L ? L[snapKey] || {} : null;
    for (const id of new Set([...Object.keys(P), ...Object.keys(cur)])) {
      const pv = P[id], cv = cur[id];
      if (egal(pv, cv) && (pv === undefined) === (cv === undefined)) continue;
      const m = { k, type: 'cle', id, avant: copie(cv), apres: copie(pv) };
      if (m.avant === undefined) delete m.avant;
      if (m.apres === undefined) delete m.apres;
      const lv = Lr ? Lr[id] : undefined;
      const etat = pv === undefined ? 'conflit' : retouche(pv, lv, cv) ? 'conflit' : 'remis';
      lignes.push({ cat, etat, id, libelle: nom(id), maintenant: cv === undefined ? null : cv, avant: pv === undefined ? null : pv, raison: pv === undefined ? 'ajoute-depuis' : cv === undefined ? 'retire-depuis' : etat === 'conflit' ? 'retouche' : undefined, morceaux: [m] });
    }
  };
  parCle('prix', CLE_PRIX_NUM, 'prixParNum', (id) => `N°${id}`);
  parCle('notes', CLE_NOTES, 'notes', (id) => (id.startsWith('n:') ? `N°${id.slice(2)}` : `annonce ${id.slice(2)}`));
  parCle('notes', CLE_NOTES_ACHATS, 'notesAchats', (id) => `achat ${id}`);
  // Le prix par N° suit sa fiche : une ligne de prix par PAIRE, pas deux. Le
  // morceau du miroir reste (il s'écrit avec), la ligne en double sort du compte.
  {
    const vus = new Set(lignes.filter((l) => l.cat === 'prix' && l.morceaux[0] && l.morceaux[0].k !== CLE_PRIX_NUM).map((l) => {
      const f = fiches[l.id] || ventes[l.id] || (point.fiches[l.id] || point.ventes[l.id]);
      return f && f.numero != null ? cleNum(f.numero) : null;
    }).filter(Boolean));
    for (const l of lignes) {
      if (l.cat !== 'prix' || !l.morceaux[0] || l.morceaux[0].k !== CLE_PRIX_NUM || !vus.has(cleNum(l.id))) continue;
      const jumelle = lignes.find((x) => x !== l && x.cat === 'prix' && x.morceaux[0] && x.morceaux[0].k !== CLE_PRIX_NUM && (() => { const f = fiches[x.id] || ventes[x.id] || point.fiches[x.id] || point.ventes[x.id]; return f && f.numero != null && cleNum(f.numero) === cleNum(l.id); })());
      if (jumelle && jumelle.etat === l.etat) { jumelle.morceaux.push(...l.morceaux); l.fondue = true; }
    }
    for (let i = lignes.length - 1; i >= 0; i--) if (lignes[i].fondue) lignes.splice(i, 1);
  }

  // 3. Éléments d'une liste (dépenses, coûts fixes, packs, abonnements, achats hors plateforme).
  const nomElement = (x) => { const o = estObjet(x) ? x : {}; return String(o.libelle || o.label || o.nom || o.titre || o.title || o.desc || o.description || o.fournisseur || o.id).slice(0, 60); };
  const parElements = (k, sous, P, cur, Lr) => {
    const parId = (A) => { const m = new Map(); (Array.isArray(A) ? A : []).forEach((x, i) => { if (estObjet(x) && x.id != null) m.set(String(x.id), { x, i }); }); return m; };
    const mp = parId(P), mc = parId(cur), ml = Lr ? parId(Lr) : null;
    const numerosListe = new Set((Array.isArray(cur) ? cur : []).filter((x) => estObjet(x) && x.numero != null && String(x.numero).trim()).map((x) => cleNum(x.numero)));
    for (const id of new Set([...mp.keys(), ...mc.keys()])) {
      const p = mp.get(id), c = mc.get(id);
      const pv = p ? p.x : undefined, cv = c ? c.x : undefined;
      if (egal(pv, cv) && (pv === undefined) === (cv === undefined)) continue;
      const base = { k, idCle: 'id', id: p ? p.x.id : c.x.id };
      if (sous != null) base.sous = sous;
      const lib = nomElement(pv || cv);
      if (cv === undefined) {                                   // retiré depuis : il revient
        // Un élément à N° ne revient pas si un AUTRE élément porte ce N° maintenant (§5).
        if (estObjet(pv) && pv.numero != null && String(pv.numero).trim() && numerosListe.has(cleNum(pv.numero))) {
          lignes.push({ cat: 'depenses', etat: 'refus', id, libelle: lib, maintenant: null, avant: pv, raison: 'numero-pris', morceaux: [] }); continue;
        }
        lignes.push({ cat: 'depenses', etat: 'remis', id, libelle: lib, maintenant: null, avant: pv, raison: 'retire-depuis', morceaux: [{ ...base, type: 'element', index: p.i, apres: copie(pv) }] });
        continue;
      }
      if (pv === undefined) {                                   // ajouté depuis : l'effacer est un conflit
        lignes.push({ cat: 'depenses', etat: 'conflit', id, libelle: lib, maintenant: cv, avant: null, raison: 'ajoute-depuis', morceaux: [{ ...base, type: 'element', avant: copie(cv) }] });
        continue;
      }
      // Modifié : ses champs reviennent (le N° d'un élément ne change jamais ici).
      const sansNum = (o) => { const r = { ...o }; delete r.numero; return r; };
      const pvs = sansNum(pv), cvs = sansNum(cv);
      if (egal(pvs, cvs)) { lignes.push({ cat: 'depenses', etat: 'garde', id, libelle: lib, maintenant: cv, avant: pv, raison: 'numero-garde', morceaux: [] }); continue; }
      const lv = ml && ml.get(id) ? sansNum(ml.get(id).x) : undefined;
      const etat = retouche(pvs, lv, cvs) ? 'conflit' : 'remis';
      lignes.push({ cat: 'depenses', etat, id, libelle: lib, maintenant: cv, avant: pv, raison: etat === 'conflit' ? 'retouche' : 'modifie-depuis', morceaux: [{ ...base, type: 'champs', avant: cvs, apres: pvs }] });
    }
  };
  const comptaCur = estObjet(lire(CLE_COMPTA)) ? lire(CLE_COMPTA) : {};
  for (const s of LISTES_COMPTA) if (point.compta && (Array.isArray(point.compta[s]) || Array.isArray(comptaCur[s]))) parElements(CLE_COMPTA, s, point.compta[s] || [], Array.isArray(comptaCur[s]) ? comptaCur[s] : [], L && L.compta ? L.compta[s] || [] : null);
  parElements(CLE_HORS, null, point.hors || [], Array.isArray(lire(CLE_HORS)) ? lire(CLE_HORS) : [], L ? L.hors || [] : null);

  // 4. Réglages (la valeur entière).
  for (const k of Object.keys(REGLAGES)) {
    const pv = point.reglages[k], cv = lire(k);
    const cvn = cv === null ? undefined : cv;
    if (egal(pv, cvn) && (pv === undefined) === (cvn === undefined)) continue;
    if (pv === undefined) {
      const tropGros = Array.isArray(point.tropGros) && point.tropGros.includes(k);
      lignes.push({ cat: 'reglages', etat: 'garde', id: k, libelle: REGLAGES[k], maintenant: cvn, avant: null, raison: tropGros ? 'trop-gros' : 'pose-depuis', morceaux: [] });
      continue;
    }
    const lv = L ? L.reglages[k] : undefined;
    const etat = retouche(pv, lv, cvn) ? 'conflit' : 'remis';
    const m = { k, type: 'valeur', id: k, apres: copie(pv) };
    if (cvn !== undefined) m.avant = copie(cvn);
    lignes.push({ cat: 'reglages', etat, id: k, libelle: REGLAGES[k], maintenant: cvn === undefined ? null : cvn, avant: pv, raison: etat === 'conflit' ? 'retouche' : undefined, morceaux: [m] });
  }

  // 5. Numéros : un N° ne recule jamais. Seulement RENDRE un N° à une fiche (ou
  //    une vente) qui n'en porte plus, s'il n'est porté nulle part ailleurs.
  const pool = Array.isArray(lire(CLE_POOL)) ? lire(CLE_POOL) : [];
  const dansPool = new Set(pool.map((x) => cleNum(x)));
  const ailleurs = new Set((numerosAilleurs || []).map((x) => cleNum(x)).filter(Boolean));
  const portes = new Map();   // cleNum → [ 'f:id' | 'v:id' ]
  const porter = (n, qui) => { const c = cleNum(n); if (!c) return; if (!portes.has(c)) portes.set(c, []); portes.get(c).push(qui); };
  for (const [id, f] of Object.entries(fiches)) if (estObjet(f) && f.numero != null && String(f.numero).trim()) porter(f.numero, 'f:' + id);
  for (const [id, f] of Object.entries(ventes)) if (estObjet(f) && f.numero != null && String(f.numero).trim()) porter(f.numero, 'v:' + id);
  const rendus = new Set();
  const parNumero = (k, snapKey, cur, pre, nom) => {
    const P = point[snapKey] || {};
    for (const id of new Set([...Object.keys(P), ...Object.keys(cur)])) {
      const pn = P[id] && P[id].numero != null && String(P[id].numero).trim() ? P[id].numero : null;
      const cn = estObjet(cur[id]) && cur[id].numero != null && String(cur[id].numero).trim() ? cur[id].numero : null;
      if (pn == null && cn == null) continue;
      if (pn != null && cn != null && cleNum(pn) === cleNum(cn)) continue;
      if (cn != null) {                                      // attribué depuis (ou changé) : il reste
        lignes.push({ cat: 'numeros', etat: 'garde', id, libelle: nom(id, cur[id]), maintenant: cn, avant: pn, raison: pn == null ? 'attribue-depuis' : 'change-depuis', morceaux: [] });
        continue;
      }
      if (!estObjet(cur[id])) { lignes.push({ cat: 'numeros', etat: 'refus', id, libelle: `N°${pn}`, maintenant: null, avant: pn, raison: 'fiche-absente', morceaux: [] }); continue; }
      const c = cleNum(pn);
      const autres = (portes.get(c) || []).filter((q) => q !== pre + id);
      if (autres.length || ailleurs.has(c) || rendus.has(c)) {
        lignes.push({ cat: 'numeros', etat: 'refus', id, libelle: nom(id, { numero: pn }), maintenant: null, avant: pn, raison: 'numero-pris', morceaux: [] });
        continue;
      }
      rendus.add(c);
      const ms = [{ k, type: 'champs', id, avant: brut(cur[id], ['numero']), apres: { numero: copie(pn) }, sansRetour: true }];
      if (!dansPool.has(c)) { ms.push({ k: CLE_POOL, type: 'element', id: copie(pn), apres: copie(pn), sansRetour: true }); dansPool.add(c); }
      lignes.push({ cat: 'numeros', etat: 'remis', id, libelle: nom(id, { numero: pn }), maintenant: null, avant: pn, raison: 'rendu', morceaux: ms });
    }
  };
  parNumero(CLE_FICHES, 'fiches', fiches, 'f:', nomFiche);
  parNumero(CLE_VENTES, 'ventes', ventes, 'v:', nomVente);

  const parCat = {};
  for (const c of CATEGORIES) parCat[c.id] = { remis: 0, conflit: 0, garde: 0, refus: 0 };
  for (const l of lignes) parCat[l.cat][l.etat]++;
  return { ok: true, lignes, parCat };
}

// Le résumé d'une ligne d'aperçu : « 12 prix d'achat remis · 3 notes · 0 numéro ».
// `choix` : { [cat]: true } — les catégories cochées ; `conflits` : 'garder' | 'remettre'.
export function resume(ap, choix = null, conflits = 'garder') {
  const out = [];
  for (const c of CATEGORIES) {
    if (choix && !choix[c.id]) continue;
    const p = ap.parCat[c.id] || { remis: 0, conflit: 0 };
    const n = p.remis + (conflits === 'remettre' ? p.conflit : 0);
    out.push({ cat: c.id, n, texte: `${n} ${n > 1 ? c.plusieurs : c.un}${c.id === 'prix' ? ' remis' : ''}` });
  }
  return out;
}
export const texteResume = (ap, choix, conflits) => resume(ap, choix, conflits).map((r) => r.texte).join(' · ');

// Les morceaux à écrire pour les catégories cochées. Sans réponse aux conflits
// (`conflits` ni 'garder' ni 'remettre') alors qu'il y en a : RIEN (null).
export function morceauxChoisis(ap, choix, conflits) {
  const lignes = ap.lignes.filter((l) => choix[l.cat]);
  const nConflits = lignes.filter((l) => l.etat === 'conflit').length;
  if (nConflits && conflits !== 'garder' && conflits !== 'remettre') return null;
  const ms = [];
  for (const l of lignes) {
    if (l.etat === 'remis' || (l.etat === 'conflit' && conflits === 'remettre')) ms.push(...l.morceaux);
  }
  return ms;
}

// L'inverse d'une restauration (« Annuler la restauration ») : les mêmes morceaux
// retournés, SAUF les numéros rendus et le pool — un N° ne recule jamais.
const retourne = (m) => { const o = { ...m, avant: m.apres, apres: m.avant }; if (o.avant === undefined) delete o.avant; if (o.apres === undefined) delete o.apres; return o; };
export const morceauxAnnulation = (morceaux) => (Array.isArray(morceaux) ? morceaux : []).filter((m) => m && !m.sansRetour && m.k !== CLE_POOL).map(retourne).reverse();

// ── Appliquer un morceau : le moteur de la corbeille + la valeur ENTIÈRE ─────
// type 'valeur' : la valeur de la clé elle-même (un réglage), conditionnelle
// comme les autres ; jamais retirée (un réglage absent au moment choisi reste).
export function appliquerMorceau(valeur, m, { force = false } = {}) {
  if (m.type === 'valeur') {
    const cur = valeur === null ? undefined : valeur;
    if (m.apres === undefined) return { valeur, change: false, ignore: true };
    if (egal(cur, m.apres) && cur !== undefined) return { valeur, change: false, ignore: false };
    if (!force && !(egal(cur, m.avant) && (cur === undefined) === (m.avant === undefined))) return { valeur, change: false, ignore: true };
    return { valeur: copie(m.apres), change: true, ignore: false };
  }
  if (m.k === CLE_POOL) {
    // Le pool ne fait que GRANDIR : un morceau du pool ne peut qu'ajouter.
    if (m.apres === undefined) return { valeur, change: false, ignore: true };
    const L = Array.isArray(valeur) ? valeur : [];
    if (L.some((x) => egal(x, m.apres) || String(x).trim().toUpperCase() === String(m.apres).trim().toUpperCase())) return { valeur, change: false, ignore: false };
    return { valeur: [...L, copie(m.apres)], change: true, ignore: false };
  }
  return appliquerMorceauCorbeille(valeur, m, 'apres', { force });
}
export function appliquerMorceaux(valeur, morceaux, k = null, opts = {}) {
  let v = valeur, change = false, ignores = 0;
  for (const m of morceaux) {
    if (k != null && m.k !== k) continue;
    const r = appliquerMorceau(v, m, opts);
    v = r.valeur; if (r.change) change = true; if (r.ignore) ignores++;
  }
  return { valeur: v, change, ignores };
}

// ── Écrire : TOUT LIRE d'abord, puis écrire (une lecture ratée n'écrit rien) ──
// `lire(k)` ⇒ valeur | null (absente) | undefined (PAS SU) ; `ecrire(k, v)` ⇒ issue.
export async function ecrireRestauration({ morceaux, lire, ecrire, combiner }) {
  const cles = [...new Set((morceaux || []).map((m) => m.k))];
  const lues = {};
  for (const k of cles) {
    let v; try { v = await lire(k); } catch (_) { v = undefined; }
    if (v === undefined) return { ok: false, definitif: true, ecrit: false, raison: 'lecture', ignores: 0 };
    lues[k] = v;
  }
  const res = []; let ignores = 0;
  for (const k of cles) {
    const r = appliquerMorceaux(lues[k], morceaux, k);
    ignores += r.ignores;
    if (!r.change) continue;
    let w; try { w = await ecrire(k, r.valeur); } catch (e) { w = { ok: false, definitif: true, raison: String((e && e.message) || e) }; }
    res.push(w || { ok: null });
  }
  if (!res.length) return { ok: true, ecrit: false, ignores };
  const c = typeof combiner === 'function' ? combiner(res) : (res.every((r) => r && r.ok === true) ? { ok: true, ecrit: true } : { ok: null, ecrit: true });
  return { ...c, ignores };
}

// ── LES POINTS (lignes `restore_{n}`) ───────────────────────────────────────
// La ligne : { rev, v: 1, at, raison, libelle, empreinte, taille, snap, annulation?, annulee? }.
// `meta` (colonne remplie par la base, migration 004) en porte les scalaires :
// la liste se lit sans jamais rapatrier `snap`.
export const RAISONS = {
  jour: 'Point du jour', serie: 'Avant une action en série', import: 'Avant un import',
  restauration: 'Avant une restauration', annulation: 'Avant l’annulation d’une restauration', main: 'Posé à la main',
};
export const idPoint = (slot) => `${PREFIXE_POINT}${slot}`;
export const slotDe = (id) => { const m = /^restore_(\d{1,2})$/.exec(String(id || '')); const n = m ? Number(m[1]) : NaN; return Number.isInteger(n) && n >= 0 && n < MAX_POINTS ? n : null; };
export const expireLe = (at) => { const t = Date.parse(at); return Number.isFinite(t) ? t + DUREE_POINTS_J * JOUR : 0; };

// Les lignes lues (`select=id,meta`) ⇒ les points montrables, le plus récent d'abord.
// Un point expiré (> 30 j) ou abîmé n'est pas montré (son emplacement sera repris).
export function lirePoints(rows, maintenant = Date.now()) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const slot = slotDe(r && r.id);
    const m = r && estObjet(r.meta) ? r.meta : null;
    if (slot == null || !m || typeof m.at !== 'string' || !Number.isFinite(Date.parse(m.at)) || m.vide === true) continue;
    if (expireLe(m.at) <= maintenant) continue;
    out.push({ slot, id: r.id, at: m.at, raison: RAISONS[m.raison] ? m.raison : 'main', libelle: typeof m.libelle === 'string' ? m.libelle.slice(0, 120) : '',
      empreinte: typeof m.empreinte === 'string' ? m.empreinte : '', annulable: m.annulable === true, annulee: typeof m.annulee === 'string' ? m.annulee : null,
      rev: Number.isSafeInteger(m.rev) ? m.rev : null });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.slot - a.slot);
}
// L'emplacement d'un point neuf : le premier libre (jamais écrit, vidé ou expiré),
// sinon celui du point le plus ancien. `rows` : la liste brute du serveur.
export function choisirEmplacement(rows, maintenant = Date.now()) {
  const vivants = new Map();
  for (const p of lirePoints(rows, maintenant)) vivants.set(p.slot, p);
  const existe = new Map();
  for (const r of Array.isArray(rows) ? rows : []) { const s = slotDe(r && r.id); if (s != null) existe.set(s, r); }
  for (let s = 0; s < MAX_POINTS; s++) if (!vivants.has(s)) {
    const r = existe.get(s);
    return { slot: s, existe: !!r, rev: r && estObjet(r.meta) && Number.isSafeInteger(r.meta.rev) ? r.meta.rev : null };
  }
  const plusVieux = [...vivants.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.slot - b.slot)[0];
  return { slot: plusVieux.slot, existe: true, rev: plusVieux.rev };
}
// Le jour de Paris d'une date (le « point du jour » se compte en jours de Paris).
export const jourParis = (t) => { try { return new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }); } catch (_) { return ''; } };
// Faut-il le point du jour ? Aucun point (de n'importe quelle sorte) aujourd'hui.
// `rows` vient du SERVEUR : `null` (pas su) ⇒ non (on ne pose rien sur un « pas su »).
export function pointDuJourManque(rows, maintenant = Date.now()) {
  if (!Array.isArray(rows)) return false;
  const j = jourParis(maintenant);
  return !lirePoints(rows, maintenant).some((p) => jourParis(Date.parse(p.at)) === j);
}
// Le point suivant (plus récent) d'un point, pour juger « retouché depuis ».
export function pointSuivant(points, p) {
  const L = (points || []).filter((x) => Date.parse(x.at) > Date.parse(p.at)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return L[0] || null;
}
// La ligne d'un point neuf. Trop gros ⇒ null (rien n'est écrit, c'est dit).
export function lignePoint({ snap, raison, libelle = '', maintenant = Date.now(), annulation = null, rev = null }) {
  if (!instantaneValide(snap)) return null;
  const d = {
    rev: (Number.isSafeInteger(rev) ? rev : -1) + 1, v: 1, at: new Date(maintenant).toISOString(),
    raison: RAISONS[raison] ? raison : 'main', libelle: String(libelle || '').slice(0, 120),
    empreinte: empreinte(snap), snap,
  };
  if (Array.isArray(annulation) && annulation.length) { d.annulation = annulation; d.annulable = true; }
  d.taille = tailleDe(d);
  if (d.taille > TAILLE_MAX_POINT) return null;
  return d;
}
// Deux points de suite identiques n'en font qu'un (sauf s'il porte une annulation).
export const pointInutile = (points, snap) => {
  const dernier = (points || [])[0];
  return !!dernier && !dernier.annulable && dernier.empreinte === empreinte(snap);
};

// ── Un fichier de « Sauvegarde complète » comme moment ──────────────────────
// Le fichier porte les clés synchronisées (`keys`). Une sauvegarde d'une AUTRE
// version de numérotation (d'avant la remise à zéro, migration 013) ne rend
// aucun N° : la catégorie est fermée et c'est dit.
export function instantaneFichier(data, versionIci = null) {
  if (!estObjet(data) || !data._cancale_backup || !estObjet(data.keys)) return { ok: false, raison: 'fichier' };
  const K = data.keys;
  const s = instantane((k) => (K[k] === undefined ? null : K[k]));
  if (!s) return { ok: false, raison: 'fichier' };
  let vF = NaN;
  let mk = K.vrm_numerotation; if (typeof mk === 'string') { try { mk = JSON.parse(mk); } catch (_) { mk = null; } }
  if (estObjet(mk)) vF = Number(mk.version);
  const numerosFermes = versionIci != null && vF !== versionIci;
  if (numerosFermes) {
    for (const f of Object.values(s.fiches)) delete f.numero;
    for (const f of Object.values(s.ventes)) delete f.numero;
  }
  return { ok: true, snap: s, at: typeof data.exportDate === 'string' ? data.exportDate : null, numerosFermes };
}
