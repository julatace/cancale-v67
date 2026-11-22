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
// (21 nov.) les deux règles que ce bloc appelle (rrReglage, lrReglageLot, lrReglageRelance) : dans background.js, leurs
// blocs sont recopiés à côté ; ici, importées.
import { rrReglage } from './reponsesRapides.js';
import { lrReglageLot, lrReglageRelance } from './lotRelance.js';
import { agReglage } from './agentVrm.js';
import { naReglage } from './noteAcheteur.js';
// <reglages-auto-ligne> — la RÈGLE, recopiée telle quelle dans vinted-sync-extension/background.js (node scripts/audit-reglages-auto.cjs --recopie).
const REGLAGES_AUTO_ID = 'vrm_reglages_auto';
// (20 nov., « pratique pas chiant ») `vrm_agent_publier` : SES réponses aux questions de « Publier sur… » (la mémoire de
// l'agent, src/publier/agent.js) — retenues par le panneau dans cette même ligne, lues par l'app et le panneau par la
// même règle : une question déjà répondue ne se repose plus.
// (21 nov., ext. 5.432) `vrm_seuil_prix` : SON seuil de la garde du prix ({ seuil }, 10 à 90 %, 40 par défaut — src/gardePrix.js).
// (21 nov., ext. 5.421) `vrm_reponses_rapides` : SES modèles de réponses rapides par catégorie (src/reponsesRapides.js,
// `rrReglage`), lus par le panneau ET par l'écran Messages de l'app — ce n'est pas une automatisation (rien ne part seul).
const REGLAGES_AUTO_CLES = ['vinted_offres_auto', 'vinted_offre_refus_msg', 'vinted_offre_refus_variantes', 'vinted_offres_paliers', 'vinted_baisse_regle', 'vinted_cadence', 'vrm_agent_publier', 'vinted_bleam', 'vrm_reponses_rapides', 'vrm_seuil_prix', 'vrm_retirer_partout_reglage'];
const RA_MEMOIRE_MAX = 200000;
// (20 nov., Julien « vas-y fais ») LA CADENCE, SON réglage PAR COMPTE (`vinted_cadence.comptes[uid]`). Défauts INCHANGÉS ;
// un champ absent = le défaut (le plafond du jour absent = celui de « Discrétion », 200 par défaut). Restent NON réglables :
// arrêt au captcha / refus + prudence 24 h, pause 403/429, un compte à la fois, une requête à la fois, compte de
// l'onglet, temps d'écriture, réserve de 5 gestes.
// (21 nov., ext. 5.419 — Julien : « les trois minutes d'attente à chaque fois, ce n'est pas obligé, c'est beaucoup trop ») :
// la pause PAR DÉFAUT entre deux messages aux favoris passe de 40–90 s à 20–60 s, toujours tirée au hasard, jamais deux
// fois la même ; les autres défauts ne bougent pas.
const RA_CADENCE_DEFAUT = { favorisHeure: 15, actionsHeure: 50, parJour: null, pauseMin: 20, pauseMax: 60 };
// (22 nov., ext. 5.437 — Julien : « Vinted bloque au-delà de 15 messages aux favoris par heure ») : le maximum réglable
// des favoris passe de 60 à 15 (la limite de Vinted) ; le défaut reste 15, les actions/h (50, max 100) ne bougent pas.
const RA_CADENCE_BORNES = { favorisHeure: [1, 15], actionsHeure: [10, 100], parJour: [20, 1000], pauseMin: [20, 240], pauseMax: [20, 240] };
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
// (21 nov., ext. 5.421) `lotFavoris` (taux du lot proposé aux favoris, pas une automatisation : `actif` toujours faux) et
// `relanceOffres` (jours avant la relance, taux de la contre-offre ; `actif` = « Relancer seul », éteint par défaut,
// allumer = SA confirmation) — la règle : <lot-relance-regle> (src/lotRelance.js, `lrReglageLot`, `lrReglageRelance`).
// (21 nov., ext. 5.430) `noteAcheteurs` : SON seuil de note (1,5 ★ par défaut) et « compte sans évaluation : accepter quand
// même » (oui par défaut) — pas une automatisation (`actif` toujours faux : la protection ne s'éteint pas) ; la règle :
// la règle de la note des acheteurs (src/noteAcheteur.js, `naReglage`).
// (22 nov., ext. 5.438) `precieux` (Julien, choix 2 : « compte précieux », un interrupteur par compte — cadence divisée par
// deux, pas de republication en série, favoris à la main seulement, aucune acceptation automatique ; la règle :
// la règle sante-note de src/santeNote.js). Il PROTÈGE : l'allumer ne demande rien, l'ÉTEINDRE demande SA confirmation.
// `brouillonsAuto` (choix 11 : les brouillons Vinted préparés SEULS depuis ses fiches prêtes, publiés sur SON toucher ;
// éteint par défaut, allumer = SA confirmation). `lotFavoris.actif` = « Proposer seul » (choix 6, éteint par défaut).
const BLEAM_SECTIONS = ['bordereau', 'msgVente', 'msgFinalise', 'msgRelais', 'msgEvaluation', 'eval5', 'stockAuto', 'cycle', 'favoris', 'sauvegarde', 'dressing', 'favMessages', 'lotFavoris', 'relanceOffres', 'relances', 'agent', 'noteAcheteurs', 'precieux', 'brouillonsAuto'];
// ══ 5.417 (`favorisperso2`, Julien 21 nov. : « on n'a pas la possibilité de personnaliser ») — SES MESSAGES AUX FAVORIS,
//    PAR COMPTE (`vinted_bleam.comptes[uid].favMessages`) : versions « 1 article » (`un`), versions « lot » (plusieurs
//    articles aimés), messages conditionnels (`regles` : plage d'heures de Paris, jours, prix de l'article, marques ;
//    chacune ses versions). Ce n'est PAS une automatisation : `actif` reste toujours faux (rien à allumer, aucune
//    confirmation) ; les versions servent dès qu'il y en a une « 1 article », sinon les textes d'avant restent la
//    source (`vrm_favoris_reglages_{uid}` + le message lot de « comme Bleam »). Le choix du texte : <favoris-perso-regle>.
//    Limite d'un message Vinted : 2 000 caractères (la borne de l'envoi, `body.message.length > 2000`).
const FP_TEXTE_MAX = 2000, FP_VERSIONS_MAX = 8, FP_REGLES_MAX = 10, FP_REGLE_VERSIONS_MAX = 5, FP_MARQUES_MAX = 12;
const fpId = (v) => (typeof v === 'string' && /^[a-z0-9]{1,16}$/.test(v) ? v : '');
function fpVersions(l, pre, max) {
  const out = [], vus = new Set();
  for (const x of Array.isArray(l) ? l : []) {
    const t = typeof x === 'string' ? x : x && typeof x === 'object' ? x.texte : null;
    if (typeof t !== 'string' || !t.trim() || t.trim().length > FP_TEXTE_MAX) continue;
    let id = fpId(x && x.id) || pre + (out.length + 1);
    while (vus.has(id)) id = pre + (out.length + 1) + 'x' + vus.size;
    vus.add(id); out.push({ id, texte: t.trim() });
    if (out.length >= max) break;
  }
  return out;
}
function fpRegles(l) {
  const out = [], vus = new Set();
  for (const r of Array.isArray(l) ? l : []) {
    if (!r || typeof r !== 'object') continue;
    const h = r.heures && typeof r.heures === 'object' ? r.heures : null;
    const hd = h ? bleamEnt(h.de, 0, 23, null) : null, hf = h ? bleamEnt(h.a, 1, 24, null) : null;
    const jours = Array.isArray(r.jours) ? [...new Set(r.jours.map(Number).filter((j) => Number.isInteger(j) && j >= 0 && j <= 6))].sort() : [];
    const p = r.prix && typeof r.prix === 'object' ? r.prix : null;
    const pn = p && p.min != null && p.min !== '' ? Number(p.min) : null, px = p && p.max != null && p.max !== '' ? Number(p.max) : null;
    const prixOk = (pn == null || (Number.isFinite(pn) && pn >= 0 && pn <= 100000)) && (px == null || (Number.isFinite(px) && px > 0 && px <= 100000)) && !(pn != null && px != null && px < pn);
    const marques = (Array.isArray(r.marques) ? r.marques : []).map((m) => String(m == null ? '' : m).replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean);
    let id = fpId(r.id) || 'r' + (out.length + 1);
    while (vus.has(id)) id = 'r' + (out.length + 1) + 'x' + vus.size;
    const regle = { id,
      heures: hd != null && hf != null && hd !== hf ? { de: hd, a: hf } : null,
      jours: jours.length && jours.length < 7 ? jours : null,
      prix: prixOk && (pn != null || px != null) ? { min: pn != null ? Math.round(pn * 100) / 100 : null, max: px != null ? Math.round(px * 100) / 100 : null } : null,
      marques: marques.length ? [...new Set(marques)].slice(0, FP_MARQUES_MAX) : null,
      textes: fpVersions(r.textes, id + 'v', FP_REGLE_VERSIONS_MAX) };
    // Une règle sans condition ou sans texte ne s'appliquerait jamais (ou toujours) : elle n'est pas gardée.
    if (!regle.textes.length || !(regle.heures || regle.jours || regle.prix || regle.marques)) continue;
    vus.add(id); out.push(regle);
    if (out.length >= FP_REGLES_MAX) break;
  }
  return out;
}
function fpReglage(o) {
  return { actif: false, v: 1, un: fpVersions(o.un, 'u', FP_VERSIONS_MAX), lot: fpVersions(o.lot, 'l', FP_VERSIONS_MAX), regles: fpRegles(o.regles) };
}
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
    return Object.assign({ actif, strategie }, base, { rythme: { repub: paire(r.repub, 50) || { min: 5, max: 10 }, prix: paire(r.prix, 50) || { min: 5, max: 10 }, jours: Array.isArray(r.jours) ? jours : [0, 1, 2, 3, 4, 5, 6], heureDebut: hf > hd ? hd : 9, heureFin: hf > hd ? hf : 21 } });
  }
  if (nom === 'favoris') return { actif, noteMin: bleamEnt(o.noteMin, 0, 5, 0), parArticle: bleamEnt(o.parArticle, 0, 50, 0), periodeJours: bleamEnt(o.periodeJours, 0, 90, 0), apresMin: bleamEnt(o.apresMin, 0, 1440, 0), reecrireJours: bleamEnt(o.reecrireJours, 0, 30, 1) };
  if (nom === 'favMessages') return fpReglage(o);
  if (nom === 'lotFavoris') return typeof lrReglageLot === 'function' ? lrReglageLot(o) : { actif: false };
  if (nom === 'agent') return typeof agReglage === 'function' ? agReglage(o) : { actif: actif };
  if (nom === 'noteAcheteurs') return typeof naReglage === 'function' ? naReglage(o) : { actif: false, seuil: 1.5, neufAccepter: true };
  if (nom === 'relanceOffres') return typeof lrReglageRelance === 'function' ? lrReglageRelance(o) : { actif: actif };
  // 5.425 (`relances`, Julien 21 nov.) : relancer l'acheteur qui ne confirme pas / ne retire pas. `actif` = le mode
  // AUTOMATIQUE (éteint par défaut ; allumer = SA confirmation) ; les seuils, la 2ᵉ relance et SES modèles par motif et
  // par langue servent aussi à l'envoi sur son toucher. Règle de l'envoi : <relances-regle> (src/relancesAcheteurs.js).
  if (nom === 'relances') {
    const modeles = {}; const m0 = o.modeles && typeof o.modeles === 'object' ? o.modeles : {};
    for (const motif of ['livre', 'relais']) { const mm = m0[motif] && typeof m0[motif] === 'object' ? m0[motif] : {}; const out = {};
      for (const lg of ['fr', 'en', 'es', 'it', 'de']) { const l = (Array.isArray(mm[lg]) ? mm[lg] : []).map((t) => (typeof t === 'string' && t.trim() && t.trim().length <= FP_TEXTE_MAX ? t.trim() : null)).filter(Boolean).slice(0, 5); if (l.length) out[lg] = l; }
      if (Object.keys(out).length) modeles[motif] = out; }
    return { actif, livreJours: bleamEnt(o.livreJours, 1, 14, 2), relaisJours: bleamEnt(o.relaisJours, 1, 14, 3), deuxieme: o.deuxieme === true, modeles };
  }
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
  if (cle === 'vrm_seuil_prix') {
    // (21 nov., ext. 5.432) SON seuil de la garde du prix : un entier de 10 à 90 (%) ; desserrer au-delà du défaut (40) ⇒ `confirme`.
    const v = Number(demande && typeof demande === 'object' ? demande.seuil : demande);
    if (!Number.isInteger(v) || v < 10 || v > 90) return { ok: false, code: 'bornes', raison: 'Un seuil de 10 à 90 %.' };
    const avant = actuelle && typeof actuelle === 'object' && Number.isInteger(Number(actuelle.seuil)) ? Number(actuelle.seuil) : 40;
    if (v > 40 && v > avant && confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’a changé : confirme le seuil plus large.' };
    return { ok: true, valeur: { seuil: v } };
  }
  if (cle === 'vrm_reponses_rapides') {
    // SES modèles par catégorie : normalisés par la règle (une version refusée n'est pas gardée) ; rien à allumer.
    if (!demande || typeof demande !== 'object' || Array.isArray(demande) || typeof rrReglage !== 'function') return { ok: false, code: 'forme', raison: 'Réglage illisible.' };
    return { ok: true, valeur: rrReglage(demande) };
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
    if (d.section === 'precieux' ? (avant.actif === true && v.actif !== true && confirme !== true) : (allume(avant.actif, v.actif) && confirme !== true)) return d.section === 'precieux' ? { ok: false, code: 'confirmation', raison: 'Rien n’a changé : confirme « Ce compte n’est plus précieux ».' } : refus;
    const comptes = actuelle && typeof actuelle === 'object' && actuelle.comptes && typeof actuelle.comptes === 'object' ? Object.assign({}, actuelle.comptes) : {};
    comptes[uid] = Object.assign({}, comptes[uid] && typeof comptes[uid] === 'object' ? comptes[uid] : {}, { [d.section]: v, at: Number(maintenant) || 0 });
    return { ok: true, valeur: { v: 1, comptes } };
  }
  if (cle === 'vrm_retirer_partout_reglage') {
    // (21 nov., ext. 5.426 — « une paire vendue est retirée partout ») { site, actif } : UN site (Leboncoin, Vestiaire) ;
    // Vinted (masquer) ne se règle pas ici, eBay a son propre réglage. Allumer (éteint → allumé) exige `confirme`.
    const d = demande && typeof demande === 'object' ? demande : {};
    if (!['leboncoin', 'vestiaire'].includes(d.site) || typeof d.actif !== 'boolean') return { ok: false, code: 'forme', raison: 'Réglage inconnu.' };
    const avantV = actuelle && typeof actuelle === 'object' && !Array.isArray(actuelle) ? actuelle : {};
    if (allume(avantV[d.site] === true, d.actif) && confirme !== true) return refus;
    return { ok: true, valeur: { v: 1, leboncoin: d.site === 'leboncoin' ? d.actif : avantV.leboncoin === true, vestiaire: d.site === 'vestiaire' ? d.actif : avantV.vestiaire === true, at: Number(maintenant) || 0 } };
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

export { FP_TEXTE_MAX, FP_VERSIONS_MAX, FP_REGLES_MAX, FP_REGLE_VERSIONS_MAX, fpReglage, BLEAM_SECTIONS, BLEAM_PRESETS, bleamDe, bleamSection, REGLAGES_AUTO_ID, REGLAGES_AUTO_CLES, RA_BAISSE_PCT, RA_BAISSE_JOURS, RA_CADENCE_DEFAUT, RA_CADENCE_BORNES, cadenceDe, superposerReglagesAuto, reglageAutoNormalise, ligneAvecReglage };
