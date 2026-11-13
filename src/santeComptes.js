// ═══════════════════════════════════════════════════════════════════════════
// LA SANTÉ DE CHAQUE COMPTE VINTED (11 nov., lot sante-comptes) — LA RÈGLE
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé) : pour CHAQUE compte, ce qui le fait « glisser » aux yeux de
// Vinted et des acheteurs — la note, les avis bas, le délai d'envoi, les colis
// envoyés après la date limite, les annulations, la modération, la fraîcheur.
// Chaque indicateur : SA valeur, SA tendance (30 j contre les 30 j d'avant),
// SA source, et « pas su » + raison quand il n'est pas lu. Un état simple :
// « En forme » / « À surveiller » (LA raison, LE geste) / « Pas assez lu ».
//
// JAMAIS DE SCORE OPAQUE : il n'y a pas de note calculée ; l'état est « à
// surveiller » dès qu'UN indicateur LU passe SON seuil (écrit ci-dessous,
// montré à l'écran), « en forme » quand assez d'indicateurs sont lus et
// qu'aucun ne passe le sien. « Pas su » ne vaut ni « oui » ni « non » (§5) :
// un indicateur pas lu ne fait JAMAIS « à surveiller » et ne fait pas non plus
// « en forme » (il est compté dans « N lus sur 7 »).
//
// Ce module ne lit ni n'écrit rien. Il ne redécide aucune notion :
//   · la note et les avis : `notesParCompte` (src/notesRecues.js, la règle de
//     Statistiques) — la note AFFICHÉE par Vinted, la page des 20 derniers avis,
//     l'historique daté des lectures (`avishisto`, 5.340) ;
//   · le départ d'un colis et sa date : `lignesVitesse` (src/vitesseEnvoi.js,
//     règle `raisonDepartVente`) — publié par l'écran propriétaire avec la date
//     limite LUE dans l'e-mail du bordereau (`vrm_sante_envois`, ci-dessous) ;
//     une limite ESTIMÉE (vente + 7 j) ne prouve AUCUN retard
//     (api/_lib/limite-envoi.js : la vraie tombe jusqu'à 3 jours plus tard) ;
//   · « annulée » : `estAnnulee` passée par l'app (`classifyOrderStatus` ⇒
//     `PAS_UNE_VENTE`). ⚠️ Vinted ne dit pas QUI a annulé dans l'état lu : toute
//     annulation compte, et l'écran le dit (jamais « annulée par toi » inventé) ;
//   · banni / actif : `panel_comptes_etat` (`noterEtatCompte`, 5.181) ; restreint,
//     masquée, disparue : `moderation_vinted_{uid}` (lot alerte-moderation) quand
//     la ligne existe — absente ⇒ seul l'état du profil compte, dit.
// ⚠️ Les avis Vinted ne portent AUCUNE date (mesuré le 10 nov.) : « récents »
//    veut dire « parmi les 10 plus récents lus » (l'ordre de la page), et la
//    tendance des avis bas compare ces 10 aux 10 d'avant — jamais « ce mois ».
// Exécuté par scripts/audit-sante-comptes.cjs.
// ═══════════════════════════════════════════════════════════════════════════

import { notesParCompte } from './notesRecues.js';

const J = 86400000, H = 3600000;
export const FENETRE_J = 30;

// ── LES SEUILS (une seule source : l'écran les montre tels quels) ───────────
export const SEUILS = Object.freeze({
  note: 4.5,              // note Vinted SOUS 4,5/5 ⇒ à surveiller
  avisBas: 2,             // 2 avis de 3★ ou moins parmi les 10 plus récents lus
  etoilesBas: 3,          // « bas » = 3★ ou moins (le seuil du lot avis-negatif)
  delaiH: 72,             // médiane vente ⇒ dépôt AU-DESSUS de 3 jours (30 j)
  delaiMinColis: 3,       // médiane jugée à partir de 3 colis datés
  retards: 2,             // 2 colis partis après la limite lue (30 j), ou 1 encore à poster après elle
  annulees: 3,            // 3 annulations sur 30 j…
  annuleesTaux: 10,       // …ou 10 % des ventes (à partir de 5 ventes)
  annuleesMinVentes: 5,
  restreintJ: 7,          // une restriction de moins de 7 jours compte encore
  fraicheH: 48,           // lecture du profil de plus de 48 h ⇒ « ancienne » (dit, jamais une alerte)
  minLus: 3,              // « en forme » seulement si 3 indicateurs au moins sont lus
  freinsRefus: 2,         // (12 nov., ext. 5.370) 2 refus 403/429 de Vinted sur 7 j, ou une vérification / un arrêt
});

// L'ORDRE des raisons (la plus grave d'abord) — LA raison de l'état est la première qui passe.
export const ORDRE = Object.freeze(['moderation', 'retards', 'annulees', 'avisBas', 'note', 'delai']);
export const INDICATEURS = Object.freeze(['note', 'avisBas', 'delai', 'retards', 'annulees', 'moderation', 'fraicheur']);
// Où mène le geste de chaque raison (un lien interne `?tab=…`, jamais une action).
export const GESTES = Object.freeze({
  moderation: '?tab=settings&section=santecomptes',
  retards: '?tab=ventes',
  annulees: '?tab=stats',
  avisBas: '?tab=stats',
  note: '?tab=stats',
  delai: '?tab=ventes',
  freins: '?tab=settings&section=discretion',
});
// (12 nov., ext. 5.370 — discrétion, point 14) LES FREINS DE VINTED SUR 7 JOURS : refus 403/429,
// pauses, vérifications (captcha), prudences, notés par l'extension (champ `ev` de
// `actions_compte_…`, réunis par `carnetDuCompte`, src/discretion.js). Un point de PLUS, rangé
// après les autres raisons (l'ordre des sept reste celui d'avant) ; il ne compte pas dans
// « N points lus » (le carnet n'existe qu'à partir de l'extension 5.370).
export const FREINS = 'freins';
function indicFreins(c) {
  if (c === undefined) return pasLu('freins', 'encours');
  if (!c) return pasLu('freins', 'freins');
  const refus = (Number(c.n403) || 0) + (Number(c.n429) || 0);
  return { k: 'freins', lu: true, valeur: Number(c.total) || 0, refus, pauses: Number(c.pauses) || 0, captchas: Number(c.captchas) || 0, prudences: Number(c.prudences) || 0, dernier: c.dernier || null,
    tendance: null, alerte: (Number(c.captchas) || 0) > 0 || refus >= SEUILS.freinsRefus };
}

const str = (v) => String(v == null ? '' : v);
const fini = (x) => typeof x === 'number' && Number.isFinite(x);
const mediane = (xs) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b), k = s.length >> 1;
  return s.length % 2 ? s[k] : Math.round((s[k - 1] + s[k]) / 2);
};
const sens = (apres, avant) => (apres == null || avant == null ? null : apres > avant ? 'hausse' : apres < avant ? 'baisse' : 'egal');
const tendance = (apres, avant) => (apres == null || avant == null ? null : { apres, avant, sens: sens(apres, avant) });

// ── LA PUBLICATION DES ENVOIS (propriétaire : l'écran qui calcule `partisVinted`) ──
// Une ligne par vente partie ou à poster : [tx, compte, vente, depart|null, limite|null, aEnvoyer 0|1]
// `limite` : l'instant LU dans l'e-mail du bordereau, sinon null (une estimée n'est jamais publiée).
export const CLE_ENVOIS = 'vrm_sante_envois';
export const EVT_ENVOIS = 'vrm:sante-envois';
export function lignesEnvois({ vitesse, aPoster = [], limiteLue = () => null } = {}) {
  if (!Array.isArray(vitesse)) return null;
  const out = [], vus = new Set();
  for (const l of vitesse) {
    if (!l || vus.has(str(l.tx))) continue;
    vus.add(str(l.tx));
    out.push({ tx: str(l.tx), compte: str(l.compte), vente: l.vente, depart: fini(l.depart) ? l.depart : null, limite: limiteLue(str(l.tx)), aEnvoyer: false });
  }
  for (const x of Array.isArray(aPoster) ? aPoster : []) {
    if (!x || x.tx == null || vus.has(str(x.tx)) || !fini(x.vente)) continue;
    vus.add(str(x.tx));
    out.push({ tx: str(x.tx), compte: str(x.compte), vente: x.vente, depart: null, limite: limiteLue(str(x.tx)), aEnvoyer: true });
  }
  return out;
}
export function publierEnvois(lignes, { owner = '', partiel = false } = {}) {
  if (!Array.isArray(lignes)) return;
  const l = lignes.map((x) => [x.tx, x.compte, x.vente, fini(x.depart) ? x.depart : null, fini(x.limite) ? x.limite : null, x.aEnvoyer ? 1 : 0]);
  const p = { v: 1, owner: str(owner), partiel: !!partiel, l };
  try {
    const avant = localStorage.getItem(CLE_ENVOIS), neuf = JSON.stringify(p);
    if (avant && avant.replace(/,"at":\d+}$/, '}') === neuf) return;
    localStorage.setItem(CLE_ENVOIS, JSON.stringify({ ...p, at: Date.now() }));
  } catch (_) { /* stockage refusé : la santé dit « — » */ }
  try { window.dispatchEvent(new CustomEvent(EVT_ENVOIS)); } catch (_) {}
}
// null = jamais publiée pour CE compte VRM (pas su ⇒ « — »).
export function lireEnvois(owner = '') {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_ENVOIS) || 'null');
    if (!p || p.v !== 1 || str(p.owner) !== str(owner) || !Array.isArray(p.l)) return null;
    return { partiel: !!p.partiel, at: p.at || null, lignes: p.l.map(([tx, compte, vente, depart, limite, a]) => ({ tx: str(tx), compte: str(compte), vente, depart: fini(depart) ? depart : null, limite: fini(limite) ? limite : null, aEnvoyer: a === 1 })) };
  } catch (_) { return null; }
}

// ── CHAQUE INDICATEUR ───────────────────────────────────────────────────────
// Un indicateur : { k, lu, valeur, tendance, alerte, raison?, n?, ... }.
// `lu: false` ⇒ `raison` dit pourquoi (un code : l'écran le traduit).
const pasLu = (k, raison, extra) => ({ k, lu: false, valeur: null, tendance: null, alerte: false, raison, ...(extra || {}) });

// La note affichée par Vinted et son évolution (moyenne de la page lue, point de
// l'historique le plus proche d'il y a 30 j contre le dernier).
function indicNote(c, hist, maintenant) {
  if (!c || c.etat !== 'lu') return pasLu('note', 'profil');
  if (c.note == null) return pasLu('note', c.n === 0 ? 'aucunAvis' : 'profil', { n: c.n });
  const t = tendanceHisto(hist, maintenant);
  return { k: 'note', lu: true, valeur: c.note, n: c.n, nouveaux: t ? t.nouveaux : null, tendance: t ? t.note : null, alerte: c.note < SEUILS.note };
}
// Les points de l'historique : [{ at, total, c:[1★…5★] }]. « 30 j » = le point le plus
// récent AVANT maintenant − 30 j (au plus 60 j) contre le dernier ; sinon null.
function tendanceHisto(hist, maintenant) {
  if (!Array.isArray(hist)) return null;
  const pts = hist.map((p) => {
    const t = Date.parse(str(p && p.at));
    const c = p && Array.isArray(p.c) && p.c.length === 5 && p.c.every((x) => Number.isInteger(x) && x >= 0) ? p.c : null;
    if (!Number.isFinite(t) || t > maintenant + 60000 || !c) return null;
    const n = c.reduce((a, b) => a + b, 0);
    return { t, total: Number.isInteger(p.total) && p.total >= 0 ? p.total : null, moy: n ? Math.round(c.reduce((a, x, i) => a + x * (i + 1), 0) / n * 10) / 10 : null };
  }).filter(Boolean).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const dernier = pts[pts.length - 1];
  const lim = maintenant - FENETRE_J * J;
  const avant = pts.filter((p) => p.t <= lim && p.t >= lim - FENETRE_J * J).pop();
  if (!avant) return null;
  const nouveaux = avant.total != null && dernier.total != null && dernier.total >= avant.total ? dernier.total - avant.total : null;
  return { note: tendance(dernier.moy, avant.moy), nouveaux };
}
// Les avis bas parmi les 10 plus récents lus (la page va du plus récent au plus ancien).
function indicAvisBas(c) {
  if (!c || c.etat !== 'lu') return pasLu('avisBas', 'profil');
  const L = c.liste;
  if (!L) return pasLu('avisBas', 'liste');
  const tous = Array.isArray(L.dernieres) ? L.dernieres : null;   // nDernieres: 20 ⇒ toute la page, du plus récent au plus ancien
  if (!tous || !tous.length) return pasLu('avisBas', L.lus === 0 ? 'aucunAvis' : 'liste');
  const bas = (xs) => xs.filter((x) => x.note <= SEUILS.etoilesBas).length;
  const recents = tous.slice(0, 10), avant = tous.slice(10, 20);
  const v = bas(recents);
  return { k: 'avisBas', lu: true, valeur: v, sur: recents.length, tendance: avant.length >= 5 ? tendance(v, bas(avant)) : null, alerte: v >= SEUILS.avisBas };
}
// Délai médian vente ⇒ dépôt, 30 j (date de la VENTE) contre les 30 j d'avant.
function indicDelai(lignes, maintenant, partiel) {
  if (!Array.isArray(lignes)) return pasLu('delai', 'envois');
  const de = maintenant - FENETRE_J * J, de2 = de - FENETRE_J * J;
  const d = [], d2 = [];
  let sansDate = 0;
  for (const l of lignes) {
    if (l.aEnvoyer || !fini(l.vente) || l.vente > maintenant) continue;
    const ok = fini(l.depart);
    if (l.vente >= de) { if (ok) d.push(Math.max(0, l.depart - l.vente)); else sansDate++; }
    else if (l.vente >= de2 && ok) d2.push(Math.max(0, l.depart - l.vente));
  }
  if (!d.length) return pasLu('delai', sansDate ? 'sansDate' : 'aucunColis', { sansDate });
  const m = mediane(d), m2 = d2.length >= SEUILS.delaiMinColis ? mediane(d2) : null;
  return { k: 'delai', lu: true, valeur: m, n: d.length, sansDate, partiel: !!partiel, tendance: tendance(m, m2), alerte: d.length >= SEUILS.delaiMinColis && m > SEUILS.delaiH * H };
}
// Les colis envoyés APRÈS la date limite LUE (30 j) + ceux encore à poster dont la limite lue est passée.
function indicRetards(lignes, maintenant) {
  if (!Array.isArray(lignes)) return pasLu('retards', 'envois');
  const de = maintenant - FENETRE_J * J, de2 = de - FENETRE_J * J;
  let apres = 0, apres2 = 0, enRetard = 0, avecLimite = 0, sansLimite = 0;
  for (const l of lignes) {
    if (!fini(l.vente) || l.vente > maintenant) continue;
    if (l.aEnvoyer) { if (fini(l.limite) && maintenant >= l.limite) enRetard++; continue; }
    const dedans = l.vente >= de, avantF = !dedans && l.vente >= de2;
    if (!dedans && !avantF) continue;
    if (!fini(l.limite) || !fini(l.depart)) { if (dedans) sansLimite++; continue; }
    if (dedans) avecLimite++;
    if (l.depart > l.limite) { if (dedans) apres++; else apres2++; }
  }
  if (!avecLimite && !enRetard) return pasLu('retards', sansLimite ? 'sansLimite' : 'aucunColis', { sansLimite });
  return { k: 'retards', lu: true, valeur: apres, enRetard, sur: avecLimite, sansLimite, tendance: tendance(apres, apres2), alerte: apres >= SEUILS.retards || enRetard >= 1 };
}
// Les annulations, 30 j (date de la vente) contre les 30 j d'avant.
function indicAnnulees(ventes, estAnnulee, maintenant) {
  if (!Array.isArray(ventes)) return pasLu('annulees', 'ventes');
  const de = maintenant - FENETRE_J * J, de2 = de - FENETRE_J * J;
  let n = 0, a = 0, a2 = 0, n2 = 0;
  for (const o of ventes) {
    if (!o || !str(o.status).trim()) continue;          // une conversation n'est pas une vente
    const t = Date.parse(str(o.date));
    if (!Number.isFinite(t) || t > maintenant || t < de2) continue;
    const an = !!estAnnulee(o);
    if (t >= de) { n++; if (an) a++; } else { n2++; if (an) a2++; }
  }
  if (!n) return pasLu('annulees', 'aucuneVente');
  const taux = Math.round(a / n * 1000) / 10;
  return { k: 'annulees', lu: true, valeur: a, n, taux, tendance: tendance(a, n2 ? a2 : null), alerte: a >= SEUILS.annulees || (n >= SEUILS.annuleesMinVentes && taux >= SEUILS.annuleesTaux) };
}
// Banni (profil) · restreint, masquées, disparues (ligne de modération, si elle existe).
function indicModeration(etat, mod, maintenant) {
  const ev = etat && (etat.etat === 'banni' || etat.etat === 'actif') ? etat : null;
  const e = mod && Array.isArray(mod.e) ? mod.e : null;
  if (!ev && !e) return pasLu('moderation', etat === undefined ? 'encours' : 'etat');
  const de = maintenant - FENETRE_J * J, de2 = de - FENETRE_J * J;
  const ts = (x) => (fini(x && x.t) ? x.t : null);
  const recents = e ? e.filter((x) => ts(x) != null && ts(x) >= de && ts(x) <= maintenant + 60000) : [];
  const avant = e ? e.filter((x) => ts(x) != null && ts(x) >= de2 && ts(x) < de) : [];
  const restreint = e ? e.some((x) => x.s === 'restreint' && ts(x) != null && maintenant - ts(x) <= SEUILS.restreintJ * J && !fini(x.f)) : false;
  const masquees = e ? e.filter((x) => x.s === 'masquee' && !fini(x.f) && ts(x) != null && ts(x) >= de).length : null;
  const banni = !!(ev && ev.etat === 'banni');
  const sorte = banni ? 'banni' : restreint ? 'restreint' : masquees ? 'masquee' : 'ok';
  return {
    k: 'moderation', lu: true, valeur: recents.length, sorte, masquees, ligne: !!e, etatAt: ev && ev.at ? Date.parse(ev.at) || null : null,
    tendance: e ? tendance(recents.length, avant.length) : null, alerte: sorte !== 'ok',
  };
}
// La fraîcheur : l'âge de la lecture du profil (jamais une alerte : dite).
function indicFraicheur(c, maintenant) {
  if (!c || c.etat !== 'lu' || !fini(c.at)) return pasLu('fraicheur', 'profil');
  const age = Math.max(0, maintenant - c.at);
  return { k: 'fraicheur', lu: true, valeur: age, ancienne: age > SEUILS.fraicheH * H, tendance: null, alerte: false };
}

// ── LE TOUT, COMPTE PAR COMPTE ──────────────────────────────────────────────
// comptes : [{ uid, nom }] (les comptes sélectionnés — un exclu n'y est pas)
// profils : la lecture de Statistiques (`undefined` en cours · `null` ratée · tableau)
// etats : `panel_comptes_etat.comptes` ({ uid: { etat, at } }) · moderation : { uid: { e } }
// envois : `lireEnvois` (null = pas publié) · ventes : les ventes Vinted (`useVentesCoque`)
// ko : comptes dont la lecture des ventes a raté (aucun chiffre de ventes pour eux)
export function santeComptes({ comptes = [], profils, etats, moderation, envois, ventes, ko = [], estAnnulee = () => false, maintenant = Date.now(), freins } = {}) {
  const N = notesParCompte({ profils, comptes, maintenant, nDernieres: 20 });
  const parUid = new Map((N.comptes || []).map((c) => [c.uid, c]));
  const hist = new Map((Array.isArray(profils) ? profils : []).filter((p) => p && p.uid).map((p) => [str(p.uid), p.hist]));
  const koSet = new Set((ko || []).map(str));
  const lignesEnv = envois && Array.isArray(envois.lignes) ? envois.lignes : null;
  const out = comptes.map((cpt) => {
    const uid = str(cpt.uid);
    const c = parUid.get(uid);
    const mesEnvois = lignesEnv ? lignesEnv.filter((l) => l.compte === uid) : null;
    const mesVentes = !Array.isArray(ventes) || koSet.has(uid) ? null : ventes.filter((o) => str(o && o._acc && o._acc.vinted_user_id) === uid);
    const etat = etats === undefined ? undefined : etats && typeof etats === 'object' ? etats[uid] || null : null;
    const ind = {
      note: indicNote(c, hist.get(uid), maintenant),
      avisBas: indicAvisBas(c),
      delai: indicDelai(mesEnvois, maintenant, envois && envois.partiel),
      retards: indicRetards(mesEnvois, maintenant),
      annulees: indicAnnulees(mesVentes, estAnnulee, maintenant),
      moderation: indicModeration(etat, moderation && typeof moderation === 'object' ? moderation[uid] : null, maintenant),
      fraicheur: indicFraicheur(c, maintenant),
      freins: indicFreins(freins === undefined ? undefined : (freins && typeof freins === 'object' ? (freins[uid] === undefined ? null : freins[uid]) : null)),
    };
    const lus = INDICATEURS.filter((k) => k !== 'fraicheur' && ind[k].lu).length;
    const raisonK = ORDRE.find((k) => ind[k].alerte) || (ind.freins.alerte ? FREINS : null);
    const etatCompte = raisonK ? 'surveiller' : (lus >= SEUILS.minLus && (ind.note.lu || ind.delai.lu)) ? 'forme' : 'passu';
    return {
      uid, nom: cpt.nom || (c && c.nom) || uid, etat: etatCompte,
      raison: raisonK ? { k: raisonK, ...ind[raisonK], geste: GESTES[raisonK] } : null,
      alertes: ORDRE.filter((k) => ind[k].alerte).concat(ind.freins.alerte ? [FREINS] : []),
      lus, sur: INDICATEURS.length - 1, indicateurs: ind,
    };
  });
  return {
    etat: profils === undefined && etats === undefined ? 'encours' : 'lu',
    comptes: out,
    aSurveiller: out.filter((x) => x.etat === 'surveiller'),
  };
}
