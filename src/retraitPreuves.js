// ════════════════════════════════════════════════════════════════════════════
//  LA FIN D'UN COLIS À RETIRER, PROUVÉE PAR SES AUTRES IDENTITÉS (5 nov.)
//  Julien : « ça me met que j'ai 33 colis à retirer j'en ai à peine 10 ». Mesuré
//  sur sa base : des colis que le TRANSPORTEUR dit retirés restaient « à retirer »
//  parce que la ligne comptée n'était pas celle qui porte le n° de suivi :
//   · l'e-mail Vinted « ton achat t'attend » (relié à SA commande par la
//     conversation) alors que la commande porte le n° de suivi que Mondial Relay
//     dit « livré au destinataire » — 2 colis ;
//   · l'e-mail Vinted gardé « Ta commande t'attend ici … Utilise le code B12345 »
//     alors que la consigne Vinted Go au MÊME code de retrait est « retirée ».
//  Un code de retrait n'existe que pour UN colis (§5, 4 oct.) ; le n° de suivi de
//  la commande reliée est une identité (§5). Rien ici ne relie par le titre, le
//  lieu ou la date : le DOUTE (même point, mêmes jours) vit dans
//  api/_lib/achat-arrive-relais.js (`regrouperArrivees`) et ne fait que retirer
//  du compte — jamais déclarer « retiré ».
//  Règle unique (§11) : l'écran Achats, Colis → À retirer, Ma journée, la photo
//  hors ligne et la publication `vrm_colis_retirer` (widget, rappel du matin)
//  lisent `pickupUnion`, qui l'appelle.
// ════════════════════════════════════════════════════════════════════════════

const ajouter = (m, k, v) => { if (!k || !v) return; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };

// code de retrait → n° de suivi des colis qui le portent : les lignes de suivi
// (e-mail, transporteur) ET les commandes Vinted (le code lu dans la conversation,
// les n° de suivi relevés par l'extension).
export function indexCodesSuivis(lignes, { codeDe, suiviDe, achats = [], codeAchat = () => '', suivisDeAchat = () => [] } = {}) {
  const m = new Map();
  for (const t of lignes || []) { if (!t) continue; ajouter(m, codeDe(t), suiviDe(t)); }
  for (const o of achats || []) { const c = codeAchat(o); if (!c) continue; for (const s of suivisDeAchat(o) || []) ajouter(m, c, s); }
  return m;
}

// Les AUTRES n° de suivi d'un colis : ceux de sa commande reliée par identité, et
// ceux des lignes au même code de retrait. Son propre n° n'y est pas (il est jugé
// avant, par `sortiParSuivi`).
export function suivisLiesDuColis(t, { codeDe, suiviDe, commande = null, suivisDeAchat = () => [], codes = new Map() } = {}) {
  const propre = suiviDe(t);
  const out = new Set();
  if (commande) for (const s of suivisDeAchat(commande) || []) if (s) out.add(s);
  const c = codeDe(t);
  if (c && codes.has(c)) for (const s of codes.get(c)) out.add(s);
  if (propre) out.delete(propre);
  return [...out];
}

// 'retire' · 'reparti' · 'a_verifier' · null — la règle des fins par n° de suivi
// (`sortiParSuivis`, api/_lib/suivi-colis.js) appliquée à ces autres n°.
export function finParIdentite(t, opts = {}) {
  const { fins, sortiParSuivis } = opts;
  if (!fins || typeof sortiParSuivis !== 'function') return null;
  const ks = suivisLiesDuColis(t, opts);
  return ks.length ? sortiParSuivis(ks, fins, null) : null;
}

// Une ligne SANS n° de suivi au même code de retrait qu'une ligne qui en a un :
// le même colis, une seule ligne (la plus complète garde la place ; le lieu, le
// code, la limite de l'autre la complètent). Deux lignes au même code et à deux
// n° différents : rien n'est fusionné (on ne choisit pas).
export function fusionnerParCode(liste, { codeDe, suiviDe, score = () => 0, fusion = (m, s) => ({ ...s, ...m }) } = {}) {
  const parCode = new Map();
  for (const t of liste || []) { const c = codeDe(t); if (!c) continue; if (!parCode.has(c)) parCode.set(c, []); parCode.get(c).push(t); }
  const remplace = new Map(), retire = new Set();
  for (const [, ts] of parCode) {
    if (ts.length < 2) continue;
    const ns = new Set(ts.map(suiviDe).filter(Boolean));
    if (ns.size > 1) continue;
    const [m, ...autres] = [...ts].sort((a, b) => (suiviDe(b) ? 1 : 0) - (suiviDe(a) ? 1 : 0) || score(b) - score(a));
    let f = m; for (const s of autres) { f = fusion(f, s); retire.add(s); }
    remplace.set(m, f);
  }
  if (!retire.size) return liste;
  return (liste || []).filter((t) => !retire.has(t)).map((t) => remplace.get(t) || t);
}
