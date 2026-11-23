// ═══════════════════════════════════════════════════════════════════════════
// « VINTED A BLOQUÉ {COMPTE} » — LA RÈGLE (19 nov., lot compte-bloque)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (19 nov.) : « Est-ce que tu peux faire en sorte que l'extension détecte
// les comptes bloqués stp, je veux que ça demande pour mettre en suspens les
// annonces et que ça les remette si jamais le compte est débloqué. »
//
// LA PREUVE (jamais une absence, jamais un statut HTTP) : le profil Vinted du
// compte connecté (`/api/v2/users/current`), que l'extension lit DÉJÀ, porte
// `is_account_banned`. `noterEtatCompte` (5.181) le range dans
// `panel_comptes_etat.comptes[uid] = { etat: 'banni' | 'actif', at, preuve,
// depuis? }`. Un 401 (session expirée), un 403 (frein / refus) ou un 429 n'y
// arrivent jamais (le profil n'est pas rendu) ; un champ absent ⇒ « pas su »,
// qui ne remplace jamais un verdict lu. « Débloqué » = une lecture réussie du
// même profil avec `is_account_banned === false`.
// `depuis` (ext. 5.409) : l'heure où l'état a CHANGÉ — un épisode de blocage.
// Une extension plus ancienne ne l'écrit pas : la règle marche sans (voir plus bas).
//
// SON CHOIX : `main.vrm_comptes_bloques[uid] = { choix, at, episode, n, fin? }`,
// dans SYNC_KEYS, écrit SEULEMENT sur son toucher (Oui / Garder / Plus tard,
// puis « OK » quand VRM lui dit que le compte est débloqué). L'extension le LIT
// (5.409, `pauseCompteBloqueDit`) : en pause, plus aucun geste automatique sur
// ce compte Vinted. Les mêmes paires sur Leboncoin / eBay / Vestiaire ne bougent pas.
//
// « EN PAUSE » N'EST PAS UNE ÉCRITURE CHEZ VINTED : VRM sort ses annonces des
// totaux et de « en ligne » (comptées « en pause · compte bloqué »). Rien n'est
// supprimé, aucun N° ne change, ses VENTES restent dans tous les totaux (une
// vente faite est de l'argent gagné). Débloqué (prouvé) ⇒ la pause tombe d'elle-
// même (`cbEnPause` exige « banni ») : ses annonces reviennent, ses gestes
// automatiques repartent selon ses réglages d'avant (VRM n'en a changé aucun).
//
// Le bloc entre les balises est RECOPIÉ tel quel dans
// vinted-sync-extension/background.js (`node scripts/audit-compte-bloque.cjs
// --recopie`), jamais réécrit à la main là-bas.
// ═══════════════════════════════════════════════════════════════════════════

export const CLE_COMPTES_BLOQUES = 'vrm_comptes_bloques';

// <compte-bloque-regle>
const CB_CHOIX = ['pause', 'garder', 'plus_tard'];
const CB_PLUS_TARD_MS = 24 * 3600 * 1000;
function cbTs(v) { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : null; }
// L'état lu par l'extension, ou null (pas su). Seuls « banni » et « actif » sont des verdicts.
function cbEtatLu(etat) {
  if (!etat || typeof etat !== 'object') return null;
  return etat.etat === 'banni' || etat.etat === 'actif' ? etat : null;
}
// Le choix vaut-il pour CE blocage ? Un choix clos (`fin` : il a lu « débloqué »)
// ne vaut plus jamais ; un épisode différent (ext. 5.409 : `depuis`) non plus.
function cbChoixVaut(choix, etat) {
  if (!choix || typeof choix !== 'object' || !CB_CHOIX.includes(choix.choix)) return false;
  if (choix.fin) return false;
  const ep = etat && typeof etat.depuis === 'string' && etat.depuis ? etat.depuis : null;
  if (choix.episode && ep && String(choix.episode) !== ep) return false;
  return true;
}
// EN PAUSE : bloqué PROUVÉ (« banni » lu) ET son choix « pause » pour ce blocage.
// Pas su ⇒ pas en pause (on ne retire rien d'un total sur un doute).
function cbEnPause(choix, etat) {
  const e = cbEtatLu(etat);
  return !!(e && e.etat === 'banni' && cbChoixVaut(choix, e) && choix.choix === 'pause');
}
// Ce que l'app montre pour un compte :
//   'passu'    rien de lu ⇒ rien ;
//   'question' bloqué, aucun choix pour ce blocage (ou « plus tard » d'il y a 24 h) ⇒ LA question ;
//   'pause' · 'garder' · 'plus_tard' bloqué, son choix ;
//   'remis'    débloqué (actif lu APRÈS son choix « pause ») et pas encore dit ⇒ « N annonces remises » ;
//   'normal'   actif, rien à dire.
function cbPhase(choix, etat, maintenant) {
  const e = cbEtatLu(etat);
  if (!e) return 'passu';
  if (e.etat === 'banni') {
    if (!cbChoixVaut(choix, e)) return 'question';
    const t = cbTs(choix.at);
    if (choix.choix === 'plus_tard' && (t == null || maintenant - t >= CB_PLUS_TARD_MS)) return 'question';
    return choix.choix;
  }
  if (choix && typeof choix === 'object' && choix.choix === 'pause' && !choix.fin) {
    const ta = cbTs(e.at), tc = cbTs(choix.at);
    if (ta != null && tc != null && ta >= tc) return 'remis';
  }
  return 'normal';
}
// </compte-bloque-regle>

export { CB_CHOIX, CB_PLUS_TARD_MS, cbChoixVaut, cbEnPause, cbPhase };

// Les comptes en pause (Set d'uid), d'après les deux lectures. Pas su ⇒ Set vide.
export function uidsEnPause(choix, etats) {
  const out = new Set();
  if (!etats || typeof etats !== 'object') return out;
  const c = choix && typeof choix === 'object' ? choix : {};
  for (const uid of Object.keys(etats)) if (cbEnPause(c[uid], etats[uid])) out.add(String(uid));
  return out;
}
// Les comptes BLOQUÉS prouvés (« banni » lu), quel que soit son choix : leurs alertes
// de fraîcheur et « n'envoie aucun e-mail » se taisent tant qu'ils le sont.
export function uidsBloques(etats) {
  const out = new Set();
  if (!etats || typeof etats !== 'object') return out;
  for (const uid of Object.keys(etats)) { const e = cbEtatLu(etats[uid]); if (e && e.etat === 'banni') out.add(String(uid)); }
  return out;
}
// Les cartes à montrer, une par compte lié (jamais un compte retiré) :
// { uid, phase, n } — `n` = annonces lues (scalaire `nItems`) ou null.
export function cartesComptesBloques({ choix, etats, comptes, annonces = {}, maintenant = Date.now() }) {
  if (!etats || typeof etats !== 'object') return [];
  const c = choix && typeof choix === 'object' ? choix : {};
  const out = [];
  for (const a of Array.isArray(comptes) ? comptes : []) {
    const uid = String((a && a.vinted_user_id) || '');
    if (!uid) continue;
    const phase = cbPhase(c[uid], etats[uid], maintenant);
    if (phase !== 'question' && phase !== 'remis') continue;
    const nLu = Number(annonces[uid]);
    const nChoix = Number(c[uid] && c[uid].n);
    const n = phase === 'remis' ? (Number.isFinite(nChoix) && nChoix >= 0 ? nChoix : null) : (Number.isFinite(nLu) && nLu >= 0 ? nLu : null);
    out.push({ uid, phase, n });
  }
  return out;
}
// Le choix à écrire, sur SON toucher. `etat` : la ligne lue (pour l'épisode).
export function choixPose(choix, etat, n, maintenant = Date.now()) {
  if (!CB_CHOIX.includes(choix)) return null;
  const ep = etat && typeof etat.depuis === 'string' && etat.depuis ? etat.depuis : null;
  return { choix, at: new Date(maintenant).toISOString(), episode: ep, n: Number.isFinite(Number(n)) && n != null ? Number(n) : null };
}
// « OK » après « débloqué » : le choix est clos (jamais effacé — l'histoire reste).
export function choixClos(avant, maintenant = Date.now()) {
  if (!avant || typeof avant !== 'object') return null;
  return { ...avant, fin: new Date(maintenant).toISOString() };
}

// ── LA NOTIFICATION (serveur : api/_lib/compte-bloque-notif.js) ──────────────
// Une fois par blocage (`b:{uid}:{depuis}` ; sans `depuis`, `b:{uid}:x`, oublié dès
// qu'on lit le compte actif — un nouveau blocage sonnera) et une fois par remise
// (`r:{uid}:{at du choix}`). `cles` : la mémoire du serveur { cle: ms }.
export const LIGNE_COMPTE_BLOQUE_NOTIFIE = 'vrm_compte_bloque_notifie';
export function aNotifierComptesBloques({ etats, choix, uids, cles = {}, maintenant = Date.now() }) {
  const out = [], oublier = [];
  if (!etats || typeof etats !== 'object') return { out, oublier };
  const c = choix && typeof choix === 'object' ? choix : {};
  const permis = uids instanceof Set ? uids : new Set(uids || []);
  for (const uid of Object.keys(etats)) {
    if (!permis.has(String(uid))) continue;
    const e = etats[uid];
    if (!e || (e.etat !== 'banni' && e.etat !== 'actif')) continue;
    const phase = cbPhase(c[uid], e, maintenant);
    if (e.etat === 'banni') {
      const cle = `b:${uid}:${typeof e.depuis === 'string' && e.depuis ? e.depuis : 'x'}`;
      if (!cles[cle]) out.push({ cle, sorte: 'bloque', uid: String(uid) });
    } else {
      if (cles[`b:${uid}:x`]) oublier.push(`b:${uid}:x`);
      if (phase === 'remis') {
        const cle = `r:${uid}:${c[uid].at}`;
        const n = Number(c[uid].n);
        if (!cles[cle]) out.push({ cle, sorte: 'remis', uid: String(uid), n: Number.isFinite(n) ? n : null });
      }
    }
  }
  return { out, oublier };
}
// Le texte (français, comme les autres notifications du serveur).
export function texteNotifComptesBloques(liste, nomDe = () => '') {
  const nom = (uid) => nomDe(uid) || `n° ${uid}`;
  const b = liste.filter((x) => x.sorte === 'bloque'), r = liste.filter((x) => x.sorte === 'remis');
  if (b.length === 1 && !r.length) return { title: `⛔ Vinted a bloqué ${nom(b[0].uid)}`, body: 'Mettre ses annonces en pause ? Réponds dans VRM.' };
  if (r.length === 1 && !b.length) {
    const n = r[0].n;
    return { title: `✅ ${nom(r[0].uid)} est débloqué`, body: n != null ? `${n} annonce${n > 1 ? 's' : ''} remise${n > 1 ? 's' : ''} dans VRM.` : 'Ses annonces sont remises dans VRM.' };
  }
  const morceaux = [];
  if (b.length) morceaux.push(`${b.length > 1 ? `${b.length} comptes bloqués` : `${nom(b[0].uid)} bloqué`} par Vinted`);
  if (r.length) morceaux.push(`${r.length > 1 ? `${r.length} comptes débloqués` : `${nom(r[0].uid)} débloqué`}`);
  return { title: '⛔ Comptes Vinted', body: `${morceaux.join(' · ')}. Ouvre VRM.` };
}
