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

// ── (6 nov., statut des colis) « PEUT-ÊTRE EN DOUBLE », EXPLIQUÉ UNE FOIS ──────────
// Mesuré sur sa base : 19 moitiés Vinted (« Ton achat t'attend… ») au point où des colis du
// transporteur sont arrivés les mêmes jours, sans AUCUNE identité commune (ni n° de suivi, ni
// code, ni commande relue : 18 arrivent sur une adresse qu'aucun compte relié ne porte). La
// section ne disait que « À relier » sur chaque ligne. La phrase dit le fait, pourquoi ils ne
// comptent pas, et le geste — une fois, en tête de section (§7). `n` : le nombre de lignes.
export function explicationEnDouble(n) {
  if (!Number.isFinite(n) || n <= 0) return '';
  const un = n === 1;
  return `${un ? 'Vinted annonce ce colis' : `Vinted annonce ces ${n} colis`} à un point où un colis du transporteur est arrivé à 3 jours près, sans rien qui les relie (ni n° de suivi, ni code, ni achat relu). `
    + `${un ? 'C’est sans doute le même carton vu deux fois : il ne compte pas.' : 'Ce sont sans doute les mêmes cartons vus deux fois : ils ne comptent pas.'} `
    + 'Pour les relier : relis sur Vinted le compte de l’achat, ou relie l’adresse qui reçoit ces e-mails (E-mails → Relier ma boîte).';
}

// ── (27 nov.) DEUX MOITIÉS DU MÊME COLIS, UNE COMPTÉE ET UNE « À VÉRIFIER » : UN COLIS, PAR IDENTITÉ ─────────
// Julien (capture iPhone, Achats, point « Joubert Peintures ») : la MÊME paire au MÊME code 978 216, deux fois —
// « Au point · 20 nov. » comptée, puis sous « Pas compté dans à retirer » « Au point · 19 nov. », son QR et « Date limite
// dépassée ». Mesuré (passation du 23 nov.) : le colis Vinted Go est `email_track_vinted_{n°}`, code 978 216, au point
// le 19, limite LUE le 25 ; le rappel du 22 est tombé sur la MÊME ligne (son n°). La 2e ligne est l'e-mail de Vinted
// « ton achat t'attend » (`source: 'vinted-commande'`, relié à SA commande par la conversation, SANS code écrit, sans
// limite). Jusqu'au 25, `regrouperArrivees` les fusionnait (même commande). Le 25 passé, l'e-mail Vinted Go est sorti
// « à vérifier » AVANT ce regroupement ; la moitié Vinted est restée seule, comptée (aucune limite lue ⇒ rien de
// dépassé). La règle du 26 nov. (`absorberAVerifierParCode`) ne regardait que le code ÉCRIT sur chaque ligne
// (`t.code`) : la moitié Vinted n'en a pas — son code est celui de la conversation de SA commande.
// LA RÈGLE (§5, une seule) : deux lignes qui partagent UNE identité — le code de retrait (le sien OU celui lu dans la
// conversation de sa commande), le n° de suivi, la transaction — sont UN colis, sauf preuve du contraire : deux n° de
// suivi différents sans la même transaction (on ne choisit pas), ou deux transactions différentes. Jamais le titre, le
// lieu ni la date. Le colis réuni porte les identités des deux ; la ligne qui fait foi est celle du TRANSPORTEUR (sa date
// d'arrivée lue, `fiable`), la moitié Vinted ne fait que compléter (une date Vinted n'est qu'une estimation) ; la limite
// est celle qui a été LUE ; puis il est JUGÉ À NOUVEAU (`juger`) : limite lue et passée ⇒ « à vérifier », sinon compté.
// Un INCIDENT du transporteur reste à part ; un « peut-être en double » qui partage une identité est CE colis, sans elle il reste seul.
const ensemble = (v) => new Set((Array.isArray(v) ? v : [v]).map((x) => String(x == null ? '' : x).trim()).filter(Boolean));
const croise = (a, b) => { for (const x of a) if (b.has(x)) return true; return false; };
const unir = (a, b) => ({ codes: new Set([...a.codes, ...b.codes]), suivis: new Set([...a.suivis, ...b.suivis]), txs: new Set([...a.txs, ...b.txs]) });

// Les identités d'une ligne : { codes, suivis, txs } (des ensembles de chaînes déjà normalisées par l'appelant).
export function identitesColis(t, { codesDe = () => [], suiviDe = () => '', txDe = () => '' } = {}) {
  return { codes: ensemble(codesDe(t)), suivis: ensemble(suiviDe(t)), txs: ensemble(txDe(t)) };
}

// Le même colis ? Une identité partagée ET aucune preuve contraire.
export function memeColisParIdentite(a, b) {
  if (!a || !b) return false;
  const tx = croise(a.txs, b.txs), su = croise(a.suivis, b.suivis), co = croise(a.codes, b.codes);
  if (!(tx || su || co)) return false;
  if (a.txs.size && b.txs.size && !tx) return false;                       // deux commandes : deux colis
  if (a.suivis.size && b.suivis.size && !su && !tx) return false;          // deux n° de suivi : on ne choisit pas
  return true;
}

// Les groupes de lignes qui sont le MÊME colis (indices dans `items`) : chaque ligne rejoint le premier groupe dont
// l'identité réunie la reconnaît sans contradiction, sinon ouvre le sien.
export function grouperParIdentite(items, opts = {}) {
  const groupes = [];
  (items || []).forEach((t, i) => {
    const id = identitesColis(t, opts);
    const g = (id.codes.size || id.suivis.size || id.txs.size) ? groupes.find((x) => memeColisParIdentite(x.id, id)) : null;
    if (g) { g.ids.push(i); g.id = unir(g.id, id); } else groupes.push({ ids: [i], id });
  });
  return groupes.map((g) => g.ids);
}

// `liste` : les colis comptés « à retirer » ; `aVerifier` : `{ kind, t, e, o }`. Rend `{ liste, aVerifier, fusions }`
// (les MÊMES tableaux si rien ne bouge). `fusions` : `[{ t, de: [lignes réunies], o }]` (l'appelant y reporte la commande).
// Options : `codesDe`, `suiviDe`, `txDe` (identités) · `score` (ligne la plus complète) · `fiable` (ligne du transporteur /
// de l'e-mail du transporteur : sa date fait foi) · `fusion(m, s)` · `juger(t)` → l'état « à vérifier » ou null · `cle(t)`.
export function reunirParIdentite(liste, aVerifier, { codesDe = () => [], suiviDe = () => '', txDe = () => '', score = () => 0, fiable = () => true, fusion = (m, s) => ({ ...s, ...m }), juger = () => null, cle = () => '' } = {}) {
  const items = [];
  (liste || []).forEach((t, i) => { if (t) items.push({ t, compte: true, i }); });
  (aVerifier || []).forEach((x, i) => {
    if (!x || x.kind !== 'email' || !x.t) return;
    const et = x.e && x.e.etat;
    // Un incident du transporteur est un fait à part. Un « peut-être en double » (`doute_meme_relais`) n'entre que s'il PARTAGE
    // une identité (mesuré au banc du 27 nov. : la moitié Vinted sans code ÉCRIT, dont SA commande porte le code 978216, était
    // jugée « sans identité » par le seul code de sa ligne) ; sans identité commune, `grouperParIdentite` le laisse seul.
    if (et === 'transporteur') return;
    items.push({ t: x.t, compte: false, i, x });
  });
  const groupes = grouperParIdentite(items.map((it) => it.t), { codesDe, suiviDe, txDe })
    .map((ids) => ids.map((k) => items[k]))
    .filter((g) => g.length > 1 && g.some((it) => !it.compte));         // deux comptés : les règles d'avant (n°, code, commande)
  if (!groupes.length) return { liste, aVerifier, fusions: [] };
  const L = [...(liste || [])], V = [...(aVerifier || [])];
  const retirerL = new Set(), retirerV = new Set(), fusions = [];
  for (const g of groupes) {
    // La ligne qui fait foi : celle du transporteur d'abord (sa date est lue), puis la plus complète.
    const ordre = [...g].sort((a, b) => (fiable(b.t) ? 1 : 0) - (fiable(a.t) ? 1 : 0) || score(b.t) - score(a.t));
    let f = ordre[0].t; for (const s of ordre.slice(1)) f = fusion(f, s.t);
    const suivi = ordre.map((it) => suiviDe(it.t)).find(Boolean);
    const cles = [...new Set(g.flatMap((it) => (Array.isArray(it.t.clesMoities) && it.t.clesMoities.length ? it.t.clesMoities : [cle(it.t)])).filter(Boolean))];
    f = { ...f, ...(suivi && !f.suivi ? { suivi } : {}), ...(cles.length ? { clesMoities: cles } : {}) };
    const o = (g.find((it) => !it.compte && it.x.o) || {}).x?.o || null;
    fusions.push({ t: f, de: g.map((it) => it.t), o });
    const e = juger(f);
    const premierL = g.filter((it) => it.compte).map((it) => it.i).sort((a, b) => a - b)[0];
    const premierV = g.filter((it) => !it.compte).map((it) => it.i).sort((a, b) => a - b)[0];
    for (const it of g) (it.compte ? retirerL : retirerV).add(it.i);
    if (e) { V[premierV] = { kind: 'email', t: f, e, o }; retirerV.delete(premierV); }
    else if (premierL !== undefined) { L[premierL] = f; retirerL.delete(premierL); }
    else { L.push(f); }
  }
  return { liste: L.filter((_, i) => !retirerL.has(i)), aVerifier: V.filter((_, i) => !retirerV.has(i)), fusions };
}
