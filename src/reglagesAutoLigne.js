// ════════════════════════════════════════════════════════════════════════
// LES RÉGLAGES DES AUTOMATISATIONS, UNE SEULE SOURCE (20 nov., ext. 5.410)
// ════════════════════════════════════════════════════════════════════════
// Julien (20 nov.) : « toute action doit être faite dans l'extension » — les automatisations vivent dans le
// panneau de l'extension, qui doit ÉCRIRE leurs réglages sur SON toucher. L'extension n'écrit JAMAIS `main` :
// les réglages des moteurs vivent dans une LIGNE DÉDIÉE `vrm_reglages_auto` (une par compte VRM, comme `main`) :
//   { v: 1, rev, at, par: 'extension'|'app', cles: { vinted_offres_auto, vinted_offre_refus_msg,
//     vinted_offre_refus_variantes, vinted_offres_paliers, vinted_baisse_regle } }
// LA RÈGLE DE LECTURE, la même pour l'app et pour l'extension : une clé PRÉSENTE dans la ligne gagne sur `main` ;
// absente ⇒ la valeur de `main` (les réglages d'avant restent valables tant qu'on ne les a pas changés). Ligne
// illisible ⇒ le moteur ne fait rien (« pas su » ne vaut pas « oui »).
// L'ÉCRITURE : une valeur passe par `reglageAutoNormalise` (mêmes bornes que l'écran de l'app : paliers de baisse
// 5/10/15 % et 7/14/30 j, paliers de contre-offre 1–100 %, 6 au plus, messages 1 000 caractères) ; ALLUMER exige
// `confirme` (son toucher sur « Oui, allumer ») ; tout est éteint par défaut ; aucun plafond n'est réglé ici.
// Le bloc <reglages-auto-ligne> est recopié TEL QUEL dans vinted-sync-extension/background.js
// (node scripts/audit-reglages-auto.cjs --recopie) ; l'audit exécute les deux.
// <reglages-auto-ligne> — la RÈGLE, recopiée telle quelle dans vinted-sync-extension/background.js (node scripts/audit-reglages-auto.cjs --recopie).
const REGLAGES_AUTO_ID = 'vrm_reglages_auto';
const REGLAGES_AUTO_CLES = ['vinted_offres_auto', 'vinted_offre_refus_msg', 'vinted_offre_refus_variantes', 'vinted_offres_paliers', 'vinted_baisse_regle', 'vinted_cadence'];
// (20 nov., Julien « vas-y fais ») LA CADENCE, SON réglage PAR COMPTE (`vinted_cadence.comptes[uid]`). Défauts INCHANGÉS ;
// un champ absent = le défaut (le plafond du jour absent = celui de « Discrétion », 200 par défaut). Restent NON réglables :
// arrêt au captcha / refus + prudence 24 h, pause 403/429, un compte à la fois, une requête à la fois, compte de
// l'onglet, temps d'écriture, réserve de 5 gestes.
const RA_CADENCE_DEFAUT = { favorisHeure: 15, actionsHeure: 50, parJour: null, pauseMin: 40, pauseMax: 90 };
const RA_CADENCE_BORNES = { favorisHeure: [1, 60], actionsHeure: [10, 100], parJour: [20, 1000], pauseMin: [20, 240], pauseMax: [20, 240] };
// La cadence d'UN compte, toujours complète (défauts pour ce qui n'est pas posé ou pas lisible).
function cadenceDe(regle, uid) {
  const c = regle && typeof regle === 'object' && regle.comptes && typeof regle.comptes === 'object' ? regle.comptes[String(uid)] : null;
  const out = Object.assign({}, RA_CADENCE_DEFAUT);
  if (!c || typeof c !== 'object') return out;
  for (const k of Object.keys(RA_CADENCE_BORNES)) { const v = Number(c[k]), b = RA_CADENCE_BORNES[k]; if (Number.isInteger(v) && v >= b[0] && v <= b[1]) out[k] = v; }
  if (!(out.pauseMax > out.pauseMin)) { out.pauseMin = RA_CADENCE_DEFAUT.pauseMin; out.pauseMax = RA_CADENCE_DEFAUT.pauseMax; }
  return out;
}
const RA_BAISSE_PCT = [5, 10, 15];
const RA_BAISSE_JOURS = [7, 14, 30];
const RA_TEXTE_MAX = 1000;
const RA_VARIANTES_MAX = 4;
// La valeur lue : `main` superposé de la ligne (clé présente dans la ligne ⇒ elle gagne).
function superposerReglagesAuto(main, ligne) {
  const out = Object.assign({}, main && typeof main === 'object' ? main : {});
  const c = ligne && typeof ligne === 'object' && ligne.cles && typeof ligne.cles === 'object' && !Array.isArray(ligne.cles) ? ligne.cles : null;
  if (c) for (const k of REGLAGES_AUTO_CLES) if (Object.prototype.hasOwnProperty.call(c, k)) out[k] = c[k];
  return out;
}
function raTexte(v) { return typeof v === 'string' && v.trim().length <= RA_TEXTE_MAX ? v.trim() : null; }
function raPaliers(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const pcts = (Array.isArray(o.paliers) ? o.paliers : [50, 80, 100]).map(Number).filter((x) => Number.isFinite(x) && x > 0 && x <= 100);
  const uniques = [...new Set(pcts.map((x) => Math.round(x)))].sort((a, b) => a - b).slice(0, 6);
  const rm = Number(o.remiseMax);
  return { actif: o.actif === true, remiseMax: Number.isFinite(rm) && rm > 0 && rm < 90 ? Math.round(rm) : null, paliers: uniques.length ? uniques : [50, 80, 100],
    messages: (Array.isArray(o.messages) ? o.messages : []).map((t) => String(t == null ? '' : t).trim()).filter((t) => t && t.length <= RA_TEXTE_MAX).slice(0, 5), arrondi: o.arrondi !== false };
}
// Une demande d'écriture → { ok: true, valeur } ou { ok: false, code, raison }. `actuelle` = la valeur lue avant
// (superposée) ; `confirme` = SON toucher sur la confirmation ; `maintenant` = l'heure.
function reglageAutoNormalise(cle, demande, actuelle, confirme, maintenant) {
  if (!REGLAGES_AUTO_CLES.includes(cle)) return { ok: false, code: 'cle', raison: 'Ce réglage ne se règle pas ici.' };
  const allume = (avant, apres) => apres === true && avant !== true;
  const refus = { ok: false, code: 'confirmation', raison: 'Rien n’a changé : confirme « Allumer ».' };
  if (cle === 'vinted_offres_auto') {
    if (typeof demande !== 'boolean') return { ok: false, code: 'forme', raison: 'Oui ou non.' };
    if (allume(actuelle, demande) && confirme !== true) return refus;
    return { ok: true, valeur: demande };
  }
  if (cle === 'vinted_offre_refus_msg') {
    const t = raTexte(demande);
    return t == null ? { ok: false, code: 'forme', raison: `Un texte de ${RA_TEXTE_MAX} caractères au plus.` } : { ok: true, valeur: t };
  }
  if (cle === 'vinted_offre_refus_variantes') {
    if (!Array.isArray(demande)) return { ok: false, code: 'forme', raison: 'Une liste de textes.' };
    const l = demande.map(raTexte);
    if (l.some((t) => t == null)) return { ok: false, code: 'forme', raison: `Chaque version : ${RA_TEXTE_MAX} caractères au plus.` };
    const pleines = l.filter(Boolean);
    if (pleines.length > RA_VARIANTES_MAX) return { ok: false, code: 'forme', raison: `${RA_VARIANTES_MAX + 1} versions au plus.` };
    return { ok: true, valeur: pleines };
  }
  if (cle === 'vinted_offres_paliers') {
    if (!demande || typeof demande !== 'object' || Array.isArray(demande)) return { ok: false, code: 'forme', raison: 'Réglage illisible.' };
    const v = raPaliers(demande);
    const avant = actuelle && typeof actuelle === 'object' && actuelle.actif === true;
    if (allume(avant, v.actif) && confirme !== true) return refus;
    return { ok: true, valeur: v };
  }
  if (cle === 'vinted_cadence') {
    // { uid, favorisHeure, actionsHeure, parJour, pauseMin, pauseMax } pour UN compte ; plus vite que le défaut ⇒ `confirme`.
    const d = demande && typeof demande === 'object' ? demande : {};
    const uid = String(d.uid == null ? '' : d.uid);
    if (!/^\d{1,20}$/.test(uid)) return { ok: false, code: 'forme', raison: 'Compte inconnu.' };
    const c = {};
    for (const k of Object.keys(RA_CADENCE_BORNES)) {
      if (d[k] == null || d[k] === '') continue;
      const v = Number(d[k]), b = RA_CADENCE_BORNES[k];
      if (!Number.isInteger(v) || v < b[0] || v > b[1]) return { ok: false, code: 'bornes', raison: `Hors des bornes (${k} : ${b[0]} à ${b[1]}).` };
      c[k] = v;
    }
    const pm = c.pauseMin != null ? c.pauseMin : RA_CADENCE_DEFAUT.pauseMin, px = c.pauseMax != null ? c.pauseMax : RA_CADENCE_DEFAUT.pauseMax;
    if (!(px > pm)) return { ok: false, code: 'bornes', raison: 'La pause doit rester une plage (au hasard) : le maximum au-dessus du minimum.' };
    const plusVite = (c.favorisHeure || 0) > RA_CADENCE_DEFAUT.favorisHeure || (c.actionsHeure || 0) > RA_CADENCE_DEFAUT.actionsHeure || pm < RA_CADENCE_DEFAUT.pauseMin || (c.parJour != null && c.parJour > 200);
    if (plusVite && confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’a changé : confirme la cadence plus rapide.' };
    const comptes = actuelle && typeof actuelle === 'object' && actuelle.comptes && typeof actuelle.comptes === 'object' ? Object.assign({}, actuelle.comptes) : {};
    comptes[uid] = Object.assign(c, { at: Number(maintenant) || 0 });
    return { ok: true, valeur: { v: 1, comptes } };
  }
  // vinted_baisse_regle : { uid, actif, pct, jours } pour UN compte ; les autres comptes ne bougent pas.
  const d = demande && typeof demande === 'object' ? demande : {};
  const uid = String(d.uid == null ? '' : d.uid);
  if (!/^(\d{1,20}|lbc:[\w-]{1,40}|vc:[\w-]{1,40})$/.test(uid)) return { ok: false, code: 'forme', raison: 'Compte inconnu.' };
  const pct = Number(d.pct), jours = Number(d.jours);
  if (!RA_BAISSE_PCT.includes(pct) || !RA_BAISSE_JOURS.includes(jours)) return { ok: false, code: 'forme', raison: 'Choisis 5, 10 ou 15 % après 7, 14 ou 30 jours.' };
  const comptes = actuelle && typeof actuelle === 'object' && actuelle.comptes && typeof actuelle.comptes === 'object' ? Object.assign({}, actuelle.comptes) : {};
  const avant = comptes[uid] && comptes[uid].actif === true;
  if (allume(avant, d.actif === true) && confirme !== true) return refus;
  comptes[uid] = { actif: d.actif === true, pct, jours, at: Number(maintenant) || 0 };
  return { ok: true, valeur: { v: 1, comptes } };
}
// La ligne à écrire après SON geste (les autres clés de la ligne ne bougent pas).
function ligneAvecReglage(ligne, cle, valeur, par, maintenant) {
  const cles = Object.assign({}, ligne && ligne.cles && typeof ligne.cles === 'object' ? ligne.cles : {});
  cles[cle] = valeur;
  return { v: 1, at: Number(maintenant) || 0, par: par === 'app' ? 'app' : 'extension', cles };
}
// </reglages-auto-ligne>

export { REGLAGES_AUTO_ID, REGLAGES_AUTO_CLES, RA_BAISSE_PCT, RA_BAISSE_JOURS, RA_CADENCE_DEFAUT, RA_CADENCE_BORNES, cadenceDe, superposerReglagesAuto, reglageAutoNormalise, ligneAvecReglage };
