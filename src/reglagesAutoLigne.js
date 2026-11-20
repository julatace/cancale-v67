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
// (20 nov., « pratique pas chiant ») `vrm_agent_publier` : SES réponses aux questions de « Publier sur… » (la mémoire de
// l'agent, src/publier/agent.js) — retenues par le panneau dans cette même ligne, lues par l'app et le panneau par la
// même règle : une question déjà répondue ne se repose plus.
const REGLAGES_AUTO_CLES = ['vinted_offres_auto', 'vinted_offre_refus_msg', 'vinted_offre_refus_variantes', 'vinted_offres_paliers', 'vinted_baisse_regle', 'vinted_cadence', 'vrm_agent_publier', 'vinted_bleam'];
const RA_MEMOIRE_MAX = 200000;
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
    messages: (Array.isArray(o.messages) ? o.messages : []).map((t) => String(t == null ? '' : t).trim()).filter((t) => t && t.length <= RA_TEXTE_MAX).slice(0, 5), arrondi: o.arrondi !== false,
    ...paliersPlus(o) };
}
// 5.410.4 (« comme Bleam / Vintex ») — la négociation étendue, champs NEUTRES par défaut (absents = comme avant) :
//   tranches [{ de, a, baisse }] (euros : « de 20 € à 40 € : baisse max 6 € »), bonusLot (% de baisse en plus si
//   l'acheteur prend plusieurs articles), pas (arrondi 1 € ou 0,50 €), flexible { actif, ecart } (accepter si l'écart
//   au palier ≤ ecart €), messages par étape (accepte / contre / finale, versions tirées au hasard, {price}),
//   delais { min, max } (minutes, tirées au hasard). Le plancher ABSOLU reste le prix mini / l'achat + 10 %.
function paliersPlus(o) {
  const out = {};
  const tr = (Array.isArray(o.tranches) ? o.tranches : []).map((x) => ({ de: Number(x && x.de), a: Number(x && x.a), baisse: Number(x && x.baisse) }))
    .filter((x) => Number.isFinite(x.de) && Number.isFinite(x.a) && Number.isFinite(x.baisse) && x.de >= 0 && x.a > x.de && x.a <= 100000 && x.baisse > 0 && x.baisse < x.a)
    .map((x) => ({ de: Math.round(x.de * 100) / 100, a: Math.round(x.a * 100) / 100, baisse: Math.round(x.baisse * 100) / 100 })).sort((x, y) => x.de - y.de).slice(0, 8);
  if (tr.length) out.tranches = tr;
  const bl = Number(o.bonusLot); if (Number.isInteger(bl) && bl > 0 && bl <= 50) out.bonusLot = bl;
  if (Number(o.pas) === 0.5) out.pas = 0.5;
  const fx = o.flexible && typeof o.flexible === 'object' ? o.flexible : null;
  if (fx && fx.actif === true) { const e = Number(fx.ecart); out.flexible = { actif: true, ecart: Number.isFinite(e) && e > 0 && e <= 10 ? Math.round(e * 100) / 100 : 2 }; }
  for (const k of ['msgAccepte', 'msgContre', 'msgFinale']) { const l = (Array.isArray(o[k]) ? o[k] : []).map((t) => String(t == null ? '' : t).trim()).filter((t) => t && t.length <= RA_TEXTE_MAX).slice(0, 5); if (l.length) out[k] = l; }
  const d = o.delais && typeof o.delais === 'object' ? o.delais : null;
  if (d) { const mn = Number(d.min), mx = Number(d.max); if (Number.isInteger(mn) && Number.isInteger(mx) && mn >= 1 && mx > mn && mx <= 240) out.delais = { min: mn, max: mx }; }
  return out;
}
// ══ 5.410.4 — « COMME BLEAM », LA SUITE : un réglage PAR COMPTE (`vinted_bleam.comptes[uid][section]`), TOUT éteint
//    par défaut, allumer = SA confirmation. Sections : bordereau (commande auto, Colissimo relais / boîte), messages à
//    l'acheteur (vente, finalisée, rappel au point relais, demande d'évaluation : versions au hasard), évaluation
//    5 étoiles, stock auto (quantités par N°), cycle de vie (stratégie + rythme), filtres des favoris, sauvegarde
//    automatique, dressing amélioré. Aucun plafond ni garde-fou ne se règle ici.
const BLEAM_SECTIONS = ['bordereau', 'msgVente', 'msgFinalise', 'msgRelais', 'msgEvaluation', 'eval5', 'stockAuto', 'cycle', 'favoris', 'sauvegarde', 'dressing'];
const BLEAM_STRATEGIES = ['anti', 'destock', 'vierge'];
const BLEAM_TRIS = ['recentes', 'anciennes', 'vues_plus', 'vues_moins', 'favoris', 'prix_bas', 'prix_haut', 'republiees'];
// Les stratégies prêtes (Bleam) : étapes en jours depuis la mise en ligne de l'annonce, `repeter` (jours après la
// dernière étape), `plafondPct` (baisse totale au plus, depuis le prix d'origine), `ensuite` (republier tous les N j
// une fois le plafond atteint ; 0 = rien de plus).
const BLEAM_PRESETS = {
  anti: { etapes: [{ apres: 7, action: 'baisse', pct: 10 }, { apres: 10, action: 'republier' }], repeter: 7, plafondPct: 20, ensuite: 0 },
  destock: { etapes: [{ apres: 3, action: 'baisse', pct: 10 }, { apres: 6, action: 'baisse', pct: 10 }, { apres: 9, action: 'baisse', pct: 10 }, { apres: 12, action: 'baisse', pct: 10 }, { apres: 15, action: 'republier' }], repeter: 12, plafondPct: 20, ensuite: 7 },
};
const bleamEnt = (v, a, b, d) => { const n = Number(v); return Number.isInteger(n) && n >= a && n <= b ? n : d; };
const bleamTextes = (l) => (Array.isArray(l) ? l : []).map(raTexte).filter((t) => t).slice(0, 5);
function bleamEtapes(l) {
  return (Array.isArray(l) ? l : []).map((e) => (e && typeof e === 'object' ? e : {}))
    .map((e) => (e.action === 'republier' ? { apres: bleamEnt(e.apres, 1, 90, null), action: 'republier' } : { apres: bleamEnt(e.apres, 1, 90, null), action: 'baisse', pct: bleamEnt(e.pct, 1, 30, null) }))
    .filter((e) => e.apres != null && (e.action === 'republier' || e.pct != null)).sort((a, b) => a.apres - b.apres).slice(0, 8);
}
function bleamSection(nom, v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const actif = o.actif === true;
  if (nom === 'bordereau') return { actif, colissimo: o.colissimo === 'boite' ? 'boite' : 'relais' };
  if (nom === 'msgVente' || nom === 'msgFinalise') return { actif, textes: bleamTextes(o.textes) };
  if (nom === 'msgRelais' || nom === 'msgEvaluation') return { actif, textes: bleamTextes(o.textes), heures: bleamEnt(o.heures, 1, 168, 24) };
  if (nom === 'eval5') return { actif, textes: bleamTextes(o.textes) };
  if (nom === 'stockAuto') {
    const st = {}; const s0 = o.stock && typeof o.stock === 'object' ? o.stock : {};
    for (const k of Object.keys(s0).slice(0, 500)) { const n = bleamEnt(s0[k], 2, 99, null); let c = String(k).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(c)) c = String(parseInt(c, 10)); /* = cleNum (app et extension) */ if (n != null && /^[A-Z]{0,3}\d{1,6}$/.test(c)) st[c] = n; }
    return { actif, stock: st };
  }
  if (nom === 'cycle') {
    const strategie = BLEAM_STRATEGIES.includes(o.strategie) ? o.strategie : 'anti';
    const p = BLEAM_PRESETS[strategie];
    const base = p ? { etapes: p.etapes.map((e) => Object.assign({}, e)), repeter: p.repeter, plafondPct: p.plafondPct, ensuite: p.ensuite }
      : { etapes: bleamEtapes(o.etapes), repeter: bleamEnt(o.repeter, 0, 90, 0), plafondPct: bleamEnt(o.plafondPct, 1, 50, 20), ensuite: bleamEnt(o.ensuite, 0, 90, 0) };
    const r = o.rythme && typeof o.rythme === 'object' ? o.rythme : {};
    const paire = (x, max) => { const mx = bleamEnt(x && x.max, 0, max, null); if (mx == null) return null; const mn = bleamEnt(x && x.min, 0, mx, mx); return { min: mn, max: mx }; };
    const jours = [...new Set((Array.isArray(r.jours) ? r.jours : [0, 1, 2, 3, 4, 5, 6]).map(Number).filter((j) => Number.isInteger(j) && j >= 0 && j <= 6))].sort();
    const hd = bleamEnt(r.heureDebut, 0, 23, 9), hf = bleamEnt(r.heureFin, 1, 24, 21);
    return Object.assign({ actif, strategie }, base, { rythme: { repub: paire(r.repub, 50) || { min: 5, max: 10 }, prix: paire(r.prix, 50) || { min: 5, max: 10 }, jours: jours.length ? jours : [0, 1, 2, 3, 4, 5, 6], heureDebut: hf > hd ? hd : 9, heureFin: hf > hd ? hf : 21 } });
  }
  if (nom === 'favoris') return { actif, noteMin: bleamEnt(o.noteMin, 0, 5, 0), parArticle: bleamEnt(o.parArticle, 0, 50, 0), periodeJours: bleamEnt(o.periodeJours, 0, 90, 0), apresMin: bleamEnt(o.apresMin, 0, 1440, 0), reecrireJours: bleamEnt(o.reecrireJours, 0, 30, 1) };
  if (nom === 'dressing') return { actif, tri: BLEAM_TRIS.includes(o.tri) ? o.tri : 'recentes', filtre: ['toutes', 'sauvegardees', 'non'].includes(o.filtre) ? o.filtre : 'toutes' };
  return { actif };   // sauvegarde
}
// Le réglage COMPLET d'un compte (chaque section, éteinte si rien n'est posé ou lisible).
function bleamDe(regle, uid) {
  const c = regle && typeof regle === 'object' && regle.comptes && typeof regle.comptes === 'object' ? regle.comptes[String(uid)] : null;
  const out = {};
  for (const s of BLEAM_SECTIONS) out[s] = bleamSection(s, c && typeof c === 'object' ? c[s] : null);
  return out;
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
  if (cle === 'vrm_agent_publier') {
    let n = 0; try { n = JSON.stringify(demande).length; } catch (_) { n = Infinity; }
    if (!demande || typeof demande !== 'object' || Array.isArray(demande) || !(n <= RA_MEMOIRE_MAX)) return { ok: false, code: 'forme', raison: 'Mémoire illisible ou trop grande.' };
    return { ok: true, valeur: demande };
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
  if (cle === 'vinted_bleam') {
    // { uid, section, valeur } : UNE section d'UN compte ; allumer (éteint → allumé) exige `confirme`.
    const d = demande && typeof demande === 'object' ? demande : {};
    const uid = String(d.uid == null ? '' : d.uid);
    if (!/^\d{1,20}$/.test(uid)) return { ok: false, code: 'forme', raison: 'Compte inconnu.' };
    if (!BLEAM_SECTIONS.includes(d.section)) return { ok: false, code: 'forme', raison: 'Réglage inconnu.' };
    const v = bleamSection(d.section, d.valeur);
    const avant = bleamDe(actuelle, uid)[d.section];
    if (allume(avant.actif, v.actif) && confirme !== true) return refus;
    const comptes = actuelle && typeof actuelle === 'object' && actuelle.comptes && typeof actuelle.comptes === 'object' ? Object.assign({}, actuelle.comptes) : {};
    comptes[uid] = Object.assign({}, comptes[uid] && typeof comptes[uid] === 'object' ? comptes[uid] : {}, { [d.section]: v, at: Number(maintenant) || 0 });
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

export { BLEAM_SECTIONS, BLEAM_PRESETS, bleamDe, bleamSection, REGLAGES_AUTO_ID, REGLAGES_AUTO_CLES, RA_BAISSE_PCT, RA_BAISSE_JOURS, RA_CADENCE_DEFAUT, RA_CADENCE_BORNES, cadenceDe, superposerReglagesAuto, reglageAutoNormalise, ligneAvecReglage };
