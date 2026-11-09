// ══════════════════════════════════════════════════════════════════════════════
//  UN NOUVEAU COMPTE RELIÉ — LA RÈGLE (8 nov. 2026)
//  Julien : « Quand de nouveaux comptes sont liés, je veux des notifications, des
//  animations, un accompagnement. » Relier un compte doit être un moment clair,
//  pas silencieux. Ce module ne lit ni n'écrit rien : l'app (src/CompteRelie.jsx)
//  et le serveur (api/_lib/compte-relie.js) l'importent tels quels (§11).
//
//  ⚠️ « NOUVEAU » SE PROUVE PAR UNE IDENTITÉ, JAMAIS PAR UN NOM (§5) :
//     vinted:{vinted_user_id} · leboncoin:{id du compte} · vestiaire:{id du
//     compte} · ebay:{principal | clé du registre}. Un pseudo qui ressemble ne
//     relie rien ; une capture Vestiaire « non identifiée » n'a pas d'identité ⇒
//     jamais accueillie.
//  ⚠️ LA MÉMOIRE est SA ligne `vrm_comptes_relies` (synchronisée, au nom du
//     vendeur), écrite en lire-fusionner-réécrire, comparer-et-échanger sur
//     `data.rev` : `connus[cle] = { at, base?, accueilli?, notifie? }`.
//       · `base` : le compte était déjà là quand VRM a commencé à regarder cette
//         plateforme (`bases[plateforme]`) ⇒ jamais accueilli, jamais notifié :
//         Julien ne reçoit pas neuf feuilles le jour où ceci arrive ;
//       · une identité jamais vue après ce point de départ est NOUVELLE ;
//       · on n'oublie jamais une identité : un compte supprimé puis relié de
//         nouveau n'est pas « nouveau » (il a déjà été accueilli).
//     Le POINT DE DÉPART d'une plateforme n'est posé que par l'APP, sur une
//     lecture RÉUSSIE de ses comptes (une plateforme « pas su » n'en reçoit pas :
//     sinon tous ses comptes paraîtraient neufs à la lecture suivante). Le serveur
//     ne pose jamais de point de départ (`sansBase`) : il ne fait qu'ajouter.
//     Un vendeur inscrit depuis moins de 48 h : les comptes déjà là au point de
//     départ sont accueillis quand même (il vient de les relier).
//  ⚠️ UNE FOIS : la feuille ne paraît qu'une fois son `accueilli` ÉCRIT (un
//     rechargement ne la ramène pas, l'autre appareil non plus) ; la notification
//     ne part qu'une fois son `notifie` ÉCRIT (le serveur « réserve » avant
//     d'envoyer : deux appels en même temps n'envoient qu'une fois).
//  ⚠️ « PAS SU ≠ OUI » : la progression de la première lecture a trois états par
//     étape — `lu` (une ligne captée, avec le nombre lu s'il est écrit), `en-cours`
//     (lecture réussie, rien encore), `pas-su` (lecture ratée). Jamais un nombre
//     inventé, jamais « 0 » pour « rien lu ».
// ══════════════════════════════════════════════════════════════════════════════
import { SANS_COMPTE_VC } from '../api/_lib/comptes-exclus.js';

export const LIGNE_COMPTES_RELIES = 'vrm_comptes_relies';
export const CAT_COMPTE_RELIE = 'compte';
export const PLATEFORMES_RELIEES = Object.freeze(['vinted', 'leboncoin', 'vestiaire', 'ebay']);
export const NOM_PLATEFORME_RELIEE = Object.freeze({ vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective', ebay: 'eBay' });
export const NOUVEAU_VENDEUR_MS = 48 * 3600e3;
export const ATTENTE_ETAPE_MS = 3 * 60e3;       // une étape « en cours » depuis 3 min ⇒ le geste est dit
export const NOTIF_MAX_MS = 7 * 864e5;         // un compte vu il y a plus de 7 j ne sonne plus
export const MAX_CONNUS = 2000;
export const MAX_FEUILLE = 8;

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const ms = (v) => { const n = typeof v === 'number' ? v : (/^\d{10,}$/.test(String(v || '')) ? Number(v) : Date.parse(String(v || ''))); return Number.isFinite(n) && n > 0 ? n : null; };

// ── L'IDENTITÉ ──────────────────────────────────────────────────────────────
export function cleCompte(plateforme, id) {
  const x = String(id == null ? '' : id).trim();
  if (plateforme === 'vinted') return /^\d{1,20}$/.test(x) ? `vinted:${x}` : '';
  if (plateforme === 'leboncoin') { const y = x.replace(/^lbc-account:/i, ''); return /^[\w-]{1,64}$/.test(y) ? `leboncoin:${y}` : ''; }
  if (plateforme === 'vestiaire') return /^[\w-]{1,40}$/.test(x) && x !== SANS_COMPTE_VC ? `vestiaire:${x}` : '';
  if (plateforme === 'ebay') return (x === 'principal' || /^[0-9a-f]{16}$/.test(x)) ? `ebay:${x}` : '';
  return '';
}
export const decouperCle = (cle) => { const m = /^(vinted|leboncoin|vestiaire|ebay):(.+)$/.exec(String(cle || '')); return m ? { plateforme: m[1], id: m[2] } : null; };

// Les comptes présents, par plateforme : `null`/`undefined` = pas su (jamais
// « aucun »). Entrée : { vinted: [{ id, nom }] | null, … }. Sortie : une liste de
// { cle, plateforme, id, nom } (identités valides seulement, sans doublon) et la
// liste des plateformes LUES.
export function comptesPresents(parPlateforme) {
  const p = objet(parPlateforme);
  const liste = [], lues = [], vus = new Set();
  for (const pl of PLATEFORMES_RELIEES) {
    if (!Array.isArray(p[pl])) continue;
    lues.push(pl);
    for (const c of p[pl]) {
      if (!c || c.nonIdentifie || c.ecarte) continue;
      const cle = cleCompte(pl, c.id);
      if (!cle || vus.has(cle)) continue;
      vus.add(cle);
      liste.push({ cle, plateforme: pl, id: cle.slice(pl.length + 1), nom: String(c.nom || '').trim().slice(0, 64) });
    }
  }
  return { liste, lues };
}

// ── LA MÉMOIRE ──────────────────────────────────────────────────────────────
export function normaliserMemoire(d) {
  const m = objet(d);
  const bases = {};
  for (const [p, t] of Object.entries(objet(m.bases))) if (PLATEFORMES_RELIEES.includes(p) && ms(t)) bases[p] = ms(t);
  const connus = {};
  for (const [cle, e] of Object.entries(objet(m.connus))) {
    if (!decouperCle(cle) || !e || typeof e !== 'object') continue;
    const at = ms(e.at); if (!at) continue;
    const x = { at };
    if (e.base === true) x.base = true;
    if (ms(e.accueilli)) x.accueilli = ms(e.accueilli);
    if (ms(e.notifie)) x.notifie = ms(e.notifie);
    if (e.nom && typeof e.nom === 'string') x.nom = e.nom.slice(0, 64);
    connus[cle] = x;
  }
  return { v: 1, bases, connus };
}
// Fusionne les comptes présents dans la mémoire. `memo` : l'objet lu (`null` =
// ligne absente). Rend { memo, change, nouveaux: [cle] }.
//   · `sansBase` (le serveur) : une plateforme sans point de départ est IGNORÉE ;
//   · `nouveauVendeur` : au point de départ, les comptes déjà là sont accueillis.
export function fusionnerComptes(memo, presents, { maintenant = Date.now(), sansBase = false, nouveauVendeur = false } = {}) {
  const m = normaliserMemoire(memo);
  const { liste, lues } = presents && Array.isArray(presents.liste) ? presents : comptesPresents(presents);
  let change = false;
  const nouveaux = [];
  for (const p of lues) {
    const depart = !m.bases[p];
    if (depart && sansBase) continue;
    if (depart) { m.bases[p] = maintenant; change = true; }
    for (const c of liste) {
      if (c.plateforme !== p) continue;
      const e = m.connus[c.cle];
      if (e) { if (c.nom && e.nom !== c.nom && !e.base) { m.connus[c.cle] = { ...e, nom: c.nom }; change = true; } continue; }
      if (depart && !nouveauVendeur) m.connus[c.cle] = { at: maintenant, base: true };
      else { m.connus[c.cle] = { at: maintenant, ...(c.nom ? { nom: c.nom } : {}) }; nouveaux.push(c.cle); }
      change = true;
    }
  }
  // Borne : on retire d'abord les plus anciens points de départ, jamais un compte à accueillir.
  const cles = Object.keys(m.connus);
  if (cles.length > MAX_CONNUS) {
    const ordre = cles.sort((a, b) => (m.connus[a].base ? 0 : 1) - (m.connus[b].base ? 0 : 1) || m.connus[a].at - m.connus[b].at);
    for (const k of ordre.slice(0, cles.length - MAX_CONNUS)) delete m.connus[k];
    change = true;
  }
  return { memo: m, change, nouveaux };
}
const presentsSet = (presents) => new Set((presents && Array.isArray(presents.liste) ? presents.liste : []).map((c) => c.cle));
// Les comptes à accueillir : nouveaux, pas encore accueillis, toujours là — le plus ancien d'abord.
export function aAccueillir(memo, presents) {
  const m = normaliserMemoire(memo), ici = presentsSet(presents);
  return Object.entries(m.connus).filter(([cle, e]) => !e.base && !e.accueilli && ici.has(cle))
    .sort((a, b) => a[1].at - b[1].at || a[0].localeCompare(b[0])).slice(0, MAX_FEUILLE).map(([cle]) => cle);
}
// Les comptes à notifier : nouveaux, jamais notifiés, toujours là, vus depuis moins de 7 j.
export function aNotifier(memo, presents, maintenant = Date.now()) {
  const m = normaliserMemoire(memo), ici = presentsSet(presents);
  return Object.entries(m.connus).filter(([cle, e]) => !e.base && !e.notifie && ici.has(cle) && maintenant - e.at <= NOTIF_MAX_MS)
    .sort((a, b) => a[1].at - b[1].at || a[0].localeCompare(b[0])).map(([cle]) => cle);
}
// Les derniers comptes reliés (« Revoir l'accueil ») : les nouveaux encore là,
// le plus récent d'abord ; aucun ⇒ `[]`.
export function derniersRelies(memo, presents) {
  const m = normaliserMemoire(memo), ici = presentsSet(presents);
  return Object.entries(m.connus).filter(([cle, e]) => !e.base && ici.has(cle))
    .sort((a, b) => b[1].at - a[1].at || a[0].localeCompare(b[0])).slice(0, MAX_FEUILLE).map(([cle]) => cle);
}
export function marquer(memo, cles, champ, maintenant = Date.now()) {
  const m = normaliserMemoire(memo);
  for (const k of cles || []) if (m.connus[k] && !m.connus[k][champ]) m.connus[k] = { ...m.connus[k], [champ]: maintenant };
  return m;
}
export const vuDepuis = (memo, cle) => { const e = normaliserMemoire(memo).connus[cle]; return e ? e.at : null; };

// ── LA PREMIÈRE LECTURE, ÉTAPE PAR ÉTAPE ────────────────────────────────────
// Vinted : les lignes captées par l'extension, projetées (id, capture, nombre) :
//   `harvest_{uid}_listings` · `_orders_sold` · `_orders_purchased` ·
//   `_billing` ou `_releve_*` (le porte-monnaie).
// `lignes` : le tableau lu (`null` = pas su).
export const ETAPES_VINTED = Object.freeze([
  { id: 'annonces', suffixe: 'listings', titre: 'Annonces', un: 'annonce', plusieurs: 'annonces',
    geste: 'Ouvre ton profil sur vinted.fr, connecté à ce compte : ses annonces arrivent.' },
  { id: 'ventes', suffixe: 'orders_sold', titre: 'Ventes', un: 'vente', plusieurs: 'ventes',
    geste: 'Ouvre une fois Mes commandes › Ventes sur vinted.fr.' },
  { id: 'achats', suffixe: 'orders_purchased', titre: 'Achats', un: 'achat', plusieurs: 'achats',
    geste: 'Ouvre une fois Mes commandes › Achats sur vinted.fr.' },
  { id: 'portemonnaie', suffixe: 'billing', titre: 'Porte-monnaie', un: '', plusieurs: '',
    geste: 'Ouvre une fois ton Porte-monnaie sur vinted.fr.' },
]);
export const idsLignesVinted = (uid) => ETAPES_VINTED.map((e) => `harvest_${uid}_${e.suffixe}`);
const GESTE_AUTRE = {
  leboncoin: 'Ouvre « Mes annonces » sur leboncoin.fr, connecté à ce compte.',
  vestiaire: 'Ouvre Vestiaire Collective dans le navigateur où est l’extension VRM.',
  ebay: 'Ouvre eBay → Actualiser dans VRM.',
};
const nombreLu = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : null; };
// Rend [{ id, titre, etat, n, texte, geste }]. `depuis` : quand le compte a été vu
// relié (le geste n'est dit qu'après ATTENTE_ETAPE_MS).
export function etapesPremiereLecture({ plateforme, uid = '', lignes, lu = undefined, passu = false, depuis = null, maintenant = Date.now() }) {
  const attendu = depuis != null && maintenant - depuis >= ATTENTE_ETAPE_MS;
  if (plateforme === 'vinted') {
    const parId = new Map();
    if (Array.isArray(lignes)) for (const r of lignes) if (r && r.id) parId.set(String(r.id), r);
    return ETAPES_VINTED.map((e) => {
      if (!Array.isArray(lignes)) return { id: e.id, titre: e.titre, etat: 'pas-su', n: null, texte: 'Pas su — je réessaie', geste: '' };
      let r = parId.get(`harvest_${uid}_${e.suffixe}`);
      if (e.id === 'portemonnaie' && !(r && ms(r.cap))) r = [...parId.values()].find((x) => new RegExp(`^harvest_${uid}_releve_`).test(String(x.id)) && ms(x.cap)) || null;
      if (r && ms(r.cap) && !r.sup) {
        const n = e.un ? nombreLu(r.n) : null;
        const texte = n == null ? 'Lu' : `${n} ${n > 1 ? e.plusieurs : e.un} lue${n > 1 ? 's' : ''}`;
        return { id: e.id, titre: e.titre, etat: 'lu', n, texte, geste: '' };
      }
      return { id: e.id, titre: e.titre, etat: 'en-cours', n: null, texte: 'En cours', geste: attendu ? e.geste : '' };
    });
  }
  // Les autres plateformes : une étape, la première lecture (la date que
  // « Comptes liés » montre déjà, src/comptesLies.js).
  if (passu) return [{ id: 'lecture', titre: 'Première lecture', etat: 'pas-su', n: null, texte: 'Pas su — je réessaie', geste: '' }];
  if (ms(lu)) return [{ id: 'lecture', titre: 'Première lecture', etat: 'lu', n: null, texte: 'Lu', geste: '' }];
  return [{ id: 'lecture', titre: 'Première lecture', etat: 'en-cours', n: null, texte: 'En cours', geste: attendu ? (GESTE_AUTRE[plateforme] || '') : '' }];
}
export const lectureFinie = (etapes) => Array.isArray(etapes) && etapes.length > 0 && etapes.every((e) => e.etat === 'lu');

// ── LA NOTIFICATION ─────────────────────────────────────────────────────────
// `comptes` : [{ plateforme, nom, id }]. Un nom absent ⇒ l'identifiant court
// (jamais un nom deviné).
const nomDe = (c) => (c && c.nom) || (c && c.plateforme === 'ebay' && c.id === 'principal' ? 'Ton compte eBay' : `n° ${String((c && c.id) || '').slice(0, 8)}`);
export function texteCompteRelie(comptes) {
  const l = (Array.isArray(comptes) ? comptes : []).filter(Boolean);
  if (!l.length) return null;
  if (l.length === 1) {
    const c = l[0];
    return { title: `🔗 ${nomDe(c)} est relié à VRM`, body: `Compte ${NOM_PLATEFORME_RELIEE[c.plateforme] || ''} · la première lecture commence. Ouvre VRM pour la suivre.` };
  }
  const noms = l.slice(0, 3).map(nomDe);
  const reste = l.length - noms.length;
  return { title: `🔗 ${l.length} comptes reliés à VRM`, body: `${noms.join(', ')}${reste > 0 ? ` et ${reste} autre${reste > 1 ? 's' : ''}` : ''} · la première lecture commence. Ouvre VRM pour la suivre.` };
}
