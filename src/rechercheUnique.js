// ═══════════════════════════════════════════════════════════════════════════
// LA RECHERCHE UNIQUE (3 novembre) — une loupe qui trouve tout
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « une seule loupe qui trouve tout ». Le N° de rangement garde son bloc
// « Tout sur le N° » (src/rechercheNumero.js, par `cleNum`) ; ce module cherche le
// RESTE dans un index préparé une fois :
//   · le pseudo de l'acheteur (e-mail de vente `email_sale_*` : pseudo + n° de
//     transaction ; champ de la commande s'il existe) ;
//   · le n° de suivi (bordereau de la vente `email_bord_*`, e-mail transporteur
//     `email_track_*`) et le code de retrait (`email_track_*`) ;
//   · le n° de transaction / de commande ;
//   · le titre (mots, sans accents, dans n'importe quel ordre).
// ⚠️ Le titre ne sert qu'à CHERCHER (une liste de résultats où il CHOISIT) —
//    jamais à relier : une ligne trouvée par son titre ouvre SA vente (sa
//    transaction), jamais celle d'une jumelle (§5). Un pseudo, un suivi ou un
//    code ne s'attache à une vente que par le n° de transaction écrit À CÔTÉ
//    (même e-mail, même bordereau) — jamais par ressemblance.
// Rapide sur des milliers d'articles : l'index (chaînes déjà normalisées) est
// mémorisé tant que les sources sont les mêmes objets (`indexMemo`) ; une
// frappe = un parcours linéaire sans allocation lourde.
// Module PUR, sans React : l'écran et `scripts/audit-recherche-unique.cjs`
// appellent les mêmes fonctions.

const str = (v) => String(v == null ? '' : v);
export const normaliser = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[ \s]+/g, ' ').trim();
// Une identité (suivi, code, transaction) : lettres et chiffres seulement, en majuscules.
export const alnum = (s) => str(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

export const TYPES = ['vente', 'achat', 'colis'];
export const MAX_PAR_GROUPE = 25;

// sources : { ventes, achats, pseudos: [{ tx, pseudo }], bordereaux: [{ tx, suivi }],
//             colis: [{ id, suivi, code, code2, lieu, art, status, sens, carrier, at }] }
// Chaque source peut manquer (null/undefined) : on indexe ce qu'on a.
export function indexRecherche(sources) {
  const S = sources || {};
  const parTx = (rows, champ) => {
    const m = new Map();
    for (const r of Array.isArray(rows) ? rows : []) {
      const tx = alnum(r && r.tx); const v = str(r && r[champ]).trim();
      if (!tx || !v) continue;
      if (!m.has(tx)) m.set(tx, new Set());
      m.get(tx).add(v);
    }
    return m;
  };
  const pseudosTx = parTx(S.pseudos, 'pseudo');
  const suivisTx = parTx(S.bordereaux, 'suivi');
  const entrees = [];
  const vus = new Set();
  const commande = (type, o) => {
    if (!o) return;
    const tx = alnum(o.transaction_id);
    const cle = type + ':' + (tx || entrees.length);
    if (tx && vus.has(cle)) return;
    vus.add(cle);
    const pseudos = new Set(pseudosTx.get(tx) || []);
    for (const p of [o.user_login, o.buyer && o.buyer.login, o.opposite_user && o.opposite_user.login]) if (str(p).trim()) pseudos.add(str(p).trim());
    const suivis = [...(suivisTx.get(tx) || [])].map(alnum).filter((x) => x.length >= 6);
    entrees.push({ type, cle, tx, o, titre: str(o.title), t: normaliser(o.title), pseudos: [...pseudos].map(normaliser).filter(Boolean), pseudosAff: [...pseudos], suivis, codes: [], date: str(o.date) });
  };
  for (const o of Array.isArray(S.ventes) ? S.ventes : []) commande('vente', o);
  for (const o of Array.isArray(S.achats) ? S.achats : []) commande('achat', o);
  // Les colis des e-mails de transporteur : une entrée par n° de suivi (le même
  // suivi reçu deux fois est UN colis), ou par ligne s'il n'y a pas de suivi.
  const parSuivi = new Map();
  for (const c of Array.isArray(S.colis) ? S.colis : []) {
    if (!c) continue;
    const s = alnum(c.suivi);
    const codes = [c.code, c.code2].map(alnum).filter((x) => x.length >= 3);
    const k = s ? 'colis:' + s : 'colis:' + str(c.id);
    const p = parSuivi.get(k);
    if (p) { for (const x of codes) if (!p.codes.includes(x)) p.codes.push(x); if (!p.titre && c.art) { p.titre = str(c.art); p.t = normaliser(c.art); } if (str(c.at) > p.date) { p.date = str(c.at); p.c = c; } continue; }
    const e = { type: 'colis', cle: k, tx: '', o: null, c, titre: str(c.art), t: normaliser(c.art), pseudos: [], pseudosAff: [], suivis: s.length >= 6 ? [s] : [], codes, date: str(c.at) };
    parSuivi.set(k, e); entrees.push(e);
  }
  return { entrees, n: entrees.length };
}

// Mémo : le même index tant que les sources sont les MÊMES objets.
let _memo = { cles: null, index: null };
export function indexMemo(sources) {
  const S = sources || {};
  const cles = [S.ventes, S.achats, S.pseudos, S.bordereaux, S.colis];
  if (_memo.cles && _memo.cles.length === cles.length && _memo.cles.every((x, i) => x === cles[i])) return _memo.index;
  const index = indexRecherche(S);
  _memo = { cles, index };
  return index;
}

// Le rang d'une trouvaille : une identité exacte d'abord, puis une identité
// partielle, le pseudo, enfin le titre.
const RANG = { code: 0, suivi: 1, transaction: 1, pseudo: 3, titre: 4 };

// Cherche `q` dans l'index. Rend { q, groupes: { vente: [...], achat: [...], colis: [...] }, total }
// chaque résultat = { e (l'entrée), par: 'code'|'suivi'|'transaction'|'pseudo'|'titre', exact, valeur }.
export function chercherPartout(index, q, { max = MAX_PAR_GROUPE } = {}) {
  const groupes = { vente: [], achat: [], colis: [] };
  const qn = normaliser(q);
  const qa = alnum(q);
  if (!index || !qn) return { q: qn, groupes, total: 0 };
  const mots = qn.split(' ').filter(Boolean);
  const chiffres = /^\d+$/.test(qa);
  const trouve = [];
  for (const e of index.entrees) {
    let par = null, exact = false, valeur = '';
    if (qa.length >= 4 && e.codes.length) { const c = e.codes.find((x) => x === qa); if (c) { par = 'code'; exact = true; valeur = c; } }
    if (!par && qa.length >= 6 && e.suivis.length) { const s = e.suivis.find((x) => x.includes(qa)); if (s) { par = 'suivi'; exact = s === qa; valeur = s; } }
    if (!par && chiffres && qa.length >= 5 && e.tx && e.tx.includes(qa)) { par = 'transaction'; exact = e.tx === qa; valeur = e.tx; }
    if (!par && qn.length >= 3 && e.pseudos.length) { const i = e.pseudos.findIndex((p) => p.includes(qn)); if (i >= 0) { par = 'pseudo'; exact = e.pseudos[i] === qn; valeur = e.pseudosAff[i]; } }
    if (!par && e.t && mots.every((m) => e.t.includes(m))) { par = 'titre'; }
    if (par) trouve.push({ e, par, exact, valeur, rang: RANG[par] - (exact ? 0.5 : 0) });
  }
  trouve.sort((a, b) => a.rang - b.rang || (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0));
  for (const t of trouve) { const g = groupes[t.e.type]; if (g && g.length < max) g.push(t); }
  return { q: qn, groupes, total: trouve.length };
}

// Où mène un résultat (l'écran existant, par IDENTITÉ) : { tab, cible }.
export function destinationResultat(r) {
  const e = r && r.e; if (!e) return null;
  if (e.type === 'vente') return e.tx ? { tab: 'ventes', cible: { type: 'vente', tx: e.tx } } : { tab: 'ventes', cible: null };
  if (e.type === 'achat') return e.tx ? { tab: 'achats', cible: { type: 'achat', tx: e.tx } } : { tab: 'achats', cible: null };
  if (e.type === 'colis') {
    const c = e.c || {};
    if (str(c.sens) === 'sortant') return { tab: 'cat_bord', cible: { type: 'colonne', colonne: 'partis' } };
    return { tab: 'cat_bord', cible: str(c.suivi).trim() ? { type: 'retrait', suivi: str(c.suivi).trim(), tx: '' } : { type: 'colonne', colonne: 'retirer' } };
  }
  return null;
}
