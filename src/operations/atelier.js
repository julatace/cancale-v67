// ═══════════════════════════════════════════════════════════════════════════
//  L'ATELIER (10 nov., lot N) — les étapes d'une paire achetée, dans Organisation
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Étapes d'atelier pour le stock … ça doit être dans Organisation ».
// Une colonne par étape (reçue → nettoyée → photographiée → mise en ligne, SES
// étapes, modifiables), une carte par paire, désignée par son IDENTITÉ :
//   • `a:{n° de transaction}` — l'achat Vinted (ou `a:ob_…`, un achat hors
//     plateforme saisi dans VRM) ;
//   • `n:{cleNum}` — un N° de rangement tapé par lui (paire sans achat lu).
// Jamais un titre, jamais une ressemblance (§5) : deux achats identiques font
// deux cartes, une carte ne change d'étape que sur SON geste.
//
// Rangé dans SA ligne `vrm_operations_v1` (la route Organisation, `metier.js`,
// commandes `atelier.*`). Le mode équipe n'y touche pas : un membre ne fait que
// `mission.etat` / `mission.etape` (bornes inchangées) et sa projection ne
// porte que ses missions. Rien n'est envoyé à Vinted.
//
// Module PUR : la route, l'écran, Ma journée et scripts/audit-atelier.cjs
// exécutent les MÊMES fonctions (§11).
// ─────────────────────────────────────────────────────────────────────────────

export const ETAPES_DEFAUT = Object.freeze([
  { id: 'recue', nom: 'Reçue' },
  { id: 'nettoyee', nom: 'Nettoyée' },
  { id: 'photographiee', nom: 'Photographiée' },
  { id: 'en_ligne', nom: 'Mise en ligne' },
]);
export const ETAPES_MIN = 2, ETAPES_MAX = 8, NOM_ETAPE_MAX = 30;
// Une paire qui attend depuis plus de 7 jours à une étape (hors la dernière :
// « mise en ligne », c'est fini) est dite en ambre — dans l'écran et Ma journée.
export const ATTENTE_JOURS = 7;
const JOUR = 86400000;

// L'identité d'une carte. `a:` + n° de transaction (chiffres) ou id d'un achat
// hors plateforme (`ob_…`) ; `n:` + N° normalisé (majuscules, sans espace,
// « 007 » = « 7 » — la même `cleNum` que partout).
export const cleNumAtelier = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/^N°\s*/, '').replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return /^[A-Z]{0,3}\d{1,6}$/.test(s) ? s : '';
};
export const ID_PAIRE = /^(a:(\d{4,20}|ob_[a-z0-9]{4,30})|n:[A-Z]{0,3}\d{1,6})$/;
export const idAchat = (tx) => { const s = String(tx == null ? '' : tx).trim(); const id = 'a:' + s; return ID_PAIRE.test(id) ? id : ''; };
export const idNumero = (n) => { const c = cleNumAtelier(n); return c ? 'n:' + c : ''; };

// L'atelier d'un espace : celui rangé, ou les étapes par défaut (rien n'est
// écrit tant qu'il n'a rien fait).
export function atelierDe(donnees) {
  const a = donnees && donnees.atelier;
  const etapes = a && Array.isArray(a.etapes) && a.etapes.length >= ETAPES_MIN ? a.etapes : ETAPES_DEFAUT.map((e) => ({ ...e }));
  const paires = a && Array.isArray(a.paires) ? a.paires : [];
  return { etapes, paires };
}

// Depuis combien de jours une paire est à son étape (`null` = pas su).
export function joursAttente(p, maintenant) {
  const t = Date.parse(p && p.depuis), now = Date.parse(maintenant);
  if (!Number.isFinite(t) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.floor((now - t) / JOUR));
}
// « Attend trop » : plus de 7 jours, et pas à la dernière étape. Pas su ⇒ non.
export function attendTrop(p, atelier, maintenant) {
  const etapes = atelier.etapes, derniere = etapes[etapes.length - 1];
  if (!p || (derniere && p.etape === derniere.id)) return false;
  const j = joursAttente(p, maintenant);
  return j != null && j > ATTENTE_JOURS;
}

// Le nombre par étape (une paire rangée sous une étape disparue va dans la
// première : rien ne se perd), et celles qui attendent trop.
export function resumeAtelier(donnees, maintenant) {
  const atelier = atelierDe(donnees);
  const ids = new Set(atelier.etapes.map((e) => e.id));
  const premiere = atelier.etapes[0].id;
  const parEtape = atelier.etapes.map((e) => ({ id: e.id, nom: e.nom, n: 0, enRetard: 0 }));
  const idx = Object.fromEntries(parEtape.map((e, i) => [e.id, i]));
  for (const p of atelier.paires) {
    const e = parEtape[idx[ids.has(p.etape) ? p.etape : premiere]];
    e.n += 1;
    if (attendTrop(p, atelier, maintenant)) e.enRetard += 1;
  }
  const enRetard = parEtape.reduce((s, e) => s + e.enRetard, 0);
  return { etapes: parEtape, total: atelier.paires.length, enRetard };
}

// La ligne de Ma journée — seulement s'il y a des paires qui attendent > 7 j.
// (`null` sinon : rien à dire, pas de ligne.)
export function ligneAtelierJournee(resume) {
  if (!resume || !(resume.enRetard > 0)) return null;
  const n = resume.enRetard, lourdes = resume.etapes.filter((e) => e.enRetard > 0);
  const court = lourdes.length === 1
    ? `${n} paire${n > 1 ? 's' : ''} à « ${lourdes[0].nom} » depuis plus de ${ATTENTE_JOURS} j`
    : `${n} paires bloquées à l’atelier depuis plus de ${ATTENTE_JOURS} j`;
  const detail = lourdes.map((e) => `${e.nom} ${e.enRetard}`).join(' · ');
  return { n, court, detail };
}

// Les étapes qu'il propose → les étapes rangées. Une étape gardée garde son id
// (ses paires restent avec elle) ; une nouvelle reçoit un id neuf. Rend
// { etapes } ou { erreur } (une phrase, ce qu'il faut changer).
export function etapesProposees(proposees, avant, neuf) {
  if (!Array.isArray(proposees)) return { erreur: 'Liste d’étapes attendue.' };
  if (proposees.length < ETAPES_MIN || proposees.length > ETAPES_MAX) return { erreur: `Entre ${ETAPES_MIN} et ${ETAPES_MAX} étapes.` };
  const anciens = new Set((avant || []).map((e) => e.id)), vus = new Set(), noms = new Set(), etapes = [];
  for (let i = 0; i < proposees.length; i++) {
    const e = proposees[i] || {};
    const nom = typeof e.nom === 'string' ? e.nom.trim().replace(/\s+/g, ' ') : '';
    if (!nom || nom.length > NOM_ETAPE_MAX) return { erreur: `Chaque étape a un nom (${NOM_ETAPE_MAX} lettres au plus).` };
    const k = nom.toLocaleLowerCase('fr');
    if (noms.has(k)) return { erreur: `Deux étapes s’appellent « ${nom} ».` };
    noms.add(k);
    let id = typeof e.id === 'string' && anciens.has(e.id) && !vus.has(e.id) ? e.id : '';
    if (!id) id = `${neuf}:${i}`;
    vus.add(id); etapes.push({ id, nom });
  }
  return { etapes };
}

// ── Les achats proposés (publiés par l'écran qui les lit, §11) ──────────────
// Comptabilité (Ma journée, Achats) publie `vrm_atelier_achats` sur CET
// appareil : les achats lus EN ENTIER, hors annulés, des 90 derniers jours, par
// n° de transaction, avec leur N° quand un geste les a reliés (`buyFromId`).
// Un compte pas lu ⇒ rien publié (la dernière publication complète reste).
export const CLE_ACHATS_ATELIER = 'vrm_atelier_achats';
export const FENETRE_ACHATS_JOURS = 90, ACHATS_MAX = 200;
export function achatsPourAtelier({ vinted = [], hors = [], numParTx = {}, annule = () => false, photo = () => '', maintenant = Date.now() } = {}) {
  const depuis = Number(maintenant) - FENETRE_ACHATS_JOURS * JOUR, l = [], vus = new Set();
  const pousse = (id, ph, titre, date, compte, num) => {
    if (!id || vus.has(id)) return;
    const t = Date.parse(date || '');
    if (Number.isFinite(t) && t < depuis) return;
    vus.add(id);
    l.push({ id, titre: String(titre || '').slice(0, 160), photo: /^https:\/\//.test(String(ph || '')) ? String(ph).slice(0, 500) : '', date: Number.isFinite(t) ? new Date(t).toISOString() : null, compte: String(compte || '').slice(0, 60), num: num != null && String(num).trim() ? String(num).trim() : '' });
  };
  for (const o of Array.isArray(vinted) ? vinted : []) {
    if (!o || annule(o)) continue;
    const tx = o.transaction_id != null ? o.transaction_id : null;
    pousse(idAchat(tx), photo(o), o.title, o.date, o._acc && (o._acc.login || o._acc.vinted_user_id), numParTx[String(tx)]);
  }
  for (const o of Array.isArray(hors) ? hors : []) {
    if (!o) continue;
    pousse(idAchat(o.id), '', o.title || o.titre, o.date || o.createdAt, 'Hors plateforme', o.numero);
  }
  l.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return l.slice(0, ACHATS_MAX);
}
// Lire la publication de CET appareil, pour CE compte. `null` = pas su.
export function lireAchatsAtelier(uid, stockage) {
  try {
    const s = stockage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const t = s && s.getItem(CLE_ACHATS_ATELIER);
    const v = t ? JSON.parse(t) : null;
    if (!v || v.v !== 1 || !Array.isArray(v.l) || (uid && v.uid !== uid)) return null;
    return v;
  } catch (_) { return null; }
}
