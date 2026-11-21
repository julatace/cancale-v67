// ── L'HISTORIQUE DES REPUBLICATIONS D'UNE ANNONCE (11 nov., lot republier-programme) ──
// Julien : « combien de fois, quand, et ce que chacune a donné (favoris, vues, vente) »
// — « republiée 3 fois · dernière il y a 12 j · +4 favoris ».
//
// ⚠️ PAR IDENTITÉ SEULEMENT, JAMAIS PAR TITRE (§5) : une republication est un LIEN
//    « nouvelle annonce → ancienne » prouvé :
//      · la table de l'extension (`recrees` : `vinted_brouillon_*.ancienId`,
//        `coffre_*.recreeDe`, et les liens qu'IL a posés « à la main » — `recreesEff`) ;
//      · la fiche de VRM (`vinted_annonce_numeros[nouvelId].recreeDe`, posé quand le N°
//        est repris, src/repriseNumero.js) ;
//      · le journal écrit par VRM AU MOMENT où l'extension rend « fait » avec l'identifiant
//        neuf (`vrm_repub_journal`, ce module).
//    La chaîne se remonte d'identifiant en identifiant (bornée, sans boucle).
// ⚠️ CE QUE CHACUNE A DONNÉ = les compteurs LUS de l'annonce qu'elle a créée :
//      · encore en ligne ⇒ ses favoris / vues lus aujourd'hui ;
//      · remplacée depuis ⇒ ceux notés AU MOMENT où elle a été republiée à son tour
//        (le journal garde les compteurs de l'ancienne, lus dans la liste au lancement) ;
//      · vendue ⇒ « vendue » (une vente prouvée qui porte CET identifiant d'annonce).
//    Rien de lu ⇒ `null` (« — »), jamais 0. Une republication d'avant ce journal compte
//    (le lien existe) mais sa date et son résultat peuvent être « pas su ».
// Module PUR : src/HistoriqueRepub.jsx, Republier, la fiche de l'annonce, et
// scripts/audit-republier-programme.cjs.
import { lireLigne, modifierLigne } from './ligneCas.js';

export const LIGNE_JOURNAL = 'vrm_repub_journal';
export const MAX_ENTREES = 1500;
export const MAX_CHAINE = 60;
const str = (v) => String(v == null ? '' : v).trim();
const idOk = (v) => (/^\d{3,20}$/.test(str(v)) ? str(v) : '');
const ms = (v) => { const t = typeof v === 'number' ? v : Date.parse(v || ''); return Number.isFinite(t) ? t : null; };
const nb = (v) => (v == null || v === '' ? null : (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null));
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

// Une entrée : [ancienId, atMs, favorisAvant|null, vuesAvant|null, action]
export function entreesDe(data) {
  const e = objet(data) && objet(data.e) ? data.e : {};
  const out = {};
  for (const k of Object.keys(e)) {
    const v = e[k]; const nid = idOk(k); if (!nid || !Array.isArray(v)) continue;
    const anc = idOk(v[0]); if (!anc || anc === nid) continue;
    out[nid] = { anc, at: ms(v[1]), fav: nb(v[2]), vues: nb(v[3]), action: str(v[4]) || 'recreer' };
  }
  return out;
}

// Noter une republication FAITE (l'extension a rendu l'identifiant neuf). Rend la donnée
// à écrire, ou undefined (déjà notée, ou identités illisibles).
export function noterRepublication(data, { ancienId, nouvelId, at = Date.now(), favoris = null, vues = null, action = 'recreer' }) {
  const anc = idOk(ancienId), nid = idOk(nouvelId);
  if (!anc || !nid || anc === nid) return undefined;
  const e = { ...((objet(data) && objet(data.e)) || {}) };
  if (Array.isArray(e[nid]) && idOk(e[nid][0]) === anc) return undefined;
  e[nid] = [anc, ms(at) || Date.now(), nb(favoris), nb(vues), str(action) || 'recreer'];
  const cles = Object.keys(e);
  if (cles.length > MAX_ENTREES) {
    cles.sort((a, b) => (Number(e[a][1]) || 0) - (Number(e[b][1]) || 0));
    for (const k of cles.slice(0, cles.length - MAX_ENTREES)) delete e[k];
  }
  return { ...(objet(data) || {}), v: 1, e };
}

// L'ancienne d'une annonce, par identité, dans l'ordre de confiance.
function ancienneDe(id, { recrees, numeros, journal }) {
  const r = recrees && idOk(recrees[id]); if (r) return { anc: r, src: 'extension' };
  const f = numeros && numeros[id] && idOk(numeros[id].recreeDe); if (f) return { anc: f, src: 'fiche' };
  const j = journal && journal[id] && journal[id].anc; if (j) return { anc: j, src: 'journal' };
  return null;
}

// L'historique d'UNE annonce (la plus récente, celle en ligne).
// d : { recrees, numeros, journal (entreesDe), stats: { [id]: { favoris, vues } } (lus aujourd'hui),
//       vendues: Set d'identifiants d'annonce vendus (prouvé) | null (pas su) }
// Rend { n, derniere (ms|null), liste: [{ nouvelId, ancienId, at, resultat }], gainFavoris } — la
// plus récente d'abord. `resultat` = { favoris, vues, vendue, enLigne } (null par champ = pas su).
export function historiqueAnnonce(id, d = {}) {
  const depart = idOk(id); if (!depart) return null;
  const journal = d.journal || {};
  const stats = d.stats || {};
  const vendues = d.vendues instanceof Set ? d.vendues : null;
  const liste = [];
  const vus = new Set([depart]);
  let cur = depart;
  for (let i = 0; i < MAX_CHAINE; i++) {
    const a = ancienneDe(cur, d); if (!a || vus.has(a.anc)) break;
    vus.add(a.anc);
    const j = journal[cur] || null;
    const f = d.numeros && d.numeros[cur];
    const at = (j && j.at) || ms(f && f.recreeAt);
    liste.push({ nouvelId: cur, ancienId: a.anc, at: at == null ? null : at, source: a.src });
    cur = a.anc;
  }
  // Le résultat de chaque republication = l'annonce qu'elle a créée (`nouvelId`).
  for (let k = 0; k < liste.length; k++) {
    const x = liste[k];
    const enLigne = x.nouvelId === depart;
    let favoris = null, vues = null;
    if (enLigne) { const s = stats[depart] || {}; favoris = nb(s.favoris); vues = nb(s.vues); }
    else { const suivante = liste[k - 1]; const j = suivante && journal[suivante.nouvelId]; if (j && j.anc === x.nouvelId) { favoris = j.fav; vues = j.vues; } }
    x.resultat = { favoris, vues, enLigne, vendue: vendues ? vendues.has(x.nouvelId) : null };
  }
  const derniere = liste.length ? liste[0].at : null;
  return { n: liste.length, derniere, liste, gainFavoris: liste.length ? liste[0].resultat.favoris : null };
}

// Le résumé d'une ligne : { n, jours (null = date pas sue), favoris (null = pas su) }.
export function resumeHistorique(h, maintenant = Date.now()) {
  if (!h || !h.n) return null;
  const jours = h.derniere == null ? null : Math.max(0, Math.floor((maintenant - h.derniere) / 86400000));
  return { n: h.n, jours, favoris: h.gainFavoris };
}

export async function lireJournal(ctx) {
  const lu = await lireLigne(LIGNE_JOURNAL, ctx);
  if (!lu) return null;
  return entreesDe(lu.data);
}
export async function ecrireRepublication(e, ctx) {
  const r = await modifierLigne(LIGNE_JOURNAL, (d) => noterRepublication(d, e), ctx);
  return r ? entreesDe(r.data) : null;
}
