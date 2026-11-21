// ════════════════════════════════════════════════════════════════════════════
//  « RELIER » PLUS FACILE — CE QUE LA FEUILLE MET EN AVANT (21 nov. 2026, lot relier-code)
// ════════════════════════════════════════════════════════════════════════════
// Julien (21 nov.) : « Rends relier les achats à la vente / à l'annonce plus facile. »
// Ce module ne CALCULE aucune ressemblance : il RANGE ce que la règle pondérée existante
// (src/liaisonAchat.js, `propositionsArticle` / `pistesArticle` / l'affectation globale) a déjà
// rendu, pour la feuille « Lier à un achat » (src/natif/ecrans/LierAchatGrille.jsx) :
//   · LA MEILLEURE proposition, mise en avant : la « très probable » de l'affectation ; sinon la
//     première piste SEULEMENT si elle devance nettement la suivante (ECART_TRES_PROBABLE, le même
//     écart que l'affectation) et que le moteur ne l'a pas dite « ambiguë ». 50 paires identiques ⇒
//     aucune meilleure (égalité) : la feuille dit « à égalité, vérifie la photo ».
//   · 2 à 3 autres suggestions, dans l'ordre du score ;
//   · POURQUOI, en morceaux que l'écran traduit (« même modèle « spezial » · taille 42 · arrivé le 12 nov. »).
// §5 de CLAUDE.md : une proposition peut utiliser la ressemblance ; c'est TOUJOURS son toucher qui relie
// (« Relier » puis « Oui ») — rien ici n'écrit, rien n'appelle `relierAchat`.
// Module PUR, exécuté par scripts/audit-relier-facile.cjs (avec mutations).
import { ECART_TRES_PROBABLE, morceauxPourquoi, cleRefusLiaison } from './liaisonAchat.js';
import { lotDe } from './suggestionsAchat.js';

const txDe = (a) => (a && a.transaction_id != null ? String(a.transaction_id) : '');
const prixNum = (p) => { const v = p && typeof p === 'object' ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

// ── Une vente / une annonce : les achats proposés ────────────────────────────
// tres : `propositionsArticle(...)` (au plus une, « très probable ») · pistes : `pistesArticle(...)` ·
// montrable(achat) → bool (libre ET arrivé : la règle de la grille) · refus : { [`${key}>${tx}`]: … } (« Pas celle-ci ») ·
// key : la clé de l'article dans l'affectation (`v:<tx>` / `a:<id>`).
// Rend { meilleure: proposition | null, autres: [proposition], egalite: bool }.
export function rangerPropositions({ tres = [], pistes = [], montrable = () => true, refus = null, key = '', max = 3 } = {}) {
  const vus = new Set();
  const out = [];
  for (const p of [...(Array.isArray(tres) ? tres : []), ...(Array.isArray(pistes) ? pistes : [])]) {
    const tx = txDe(p && p.achat);
    if (!tx || vus.has(tx)) continue;
    vus.add(tx);
    if (refus && key && refus[cleRefusLiaison(key, tx)]) continue;
    let ok = false; try { ok = !!montrable(p.achat); } catch (_) { ok = false; }
    if (!ok) continue;
    out.push(p);
  }
  let meilleure = null;
  const p0 = out[0], p1 = out[1];
  if (p0 && p0.niveau === 'tres-probable') meilleure = p0;
  else if (p0 && !p0.ambigu && (!p1 || (Number(p0.score) - Number(p1.score)) >= ECART_TRES_PROBABLE)) meilleure = p0;
  const autres = out.filter((p) => p !== meilleure).slice(0, max);
  return { meilleure, autres, egalite: !meilleure && autres.length > 1 };
}

// ── POURQUOI, en morceaux (l'écran les traduit : clés `la.r.*`) ───────────────
// Les morceaux de la règle (`morceauxPourquoi`) rendus plus courts, puis ce que la feuille sait en plus :
// la date d'arrivée LUE (livraison ou retrait), le prix payé sous le prix de vente.
export function raisonsProposition(p, { prixVente = null, prixAchat = null } = {}) {
  const out = [];
  for (const m of morceauxPourquoi(p)) {
    if (m.cle === 'mots' && m.vars.mots) out.push({ cle: 'modele', vars: { mots: m.vars.mots } });
    else if (m.cle === 'taille' || m.cle === 'tailleUs') out.push({ cle: 'taille', vars: { taille: m.vars.taille } });
    else if (m.cle === 'couleur' || m.cle === 'couleurPhoto') out.push({ cle: 'couleur', vars: { couleur: m.vars.couleur } });
    else if (m.cle === 'photo') out.push({ cle: 'photo', vars: {} });
    else if (m.cle === 'generique') out.push({ cle: 'marque', vars: {} });
  }
  if (p && p.recu && Number.isFinite(Number(p.recu.ms))) out.push({ cle: p.recu.source === 'clic' ? 'retire' : 'arrive', vars: { ms: Number(p.recu.ms) } });
  const pv = prixNum(prixVente), pa = prixAchat != null ? prixNum(prixAchat) : prixNum(p && p.achat && p.achat.price);
  if (pv != null && pa != null && pa < pv && !(p && lotDe(p.achat).lot)) out.push({ cle: 'prix', vars: {} });
  return out;
}

// ── Depuis un ACHAT : les ventes / annonces proposées (le geste inverse) ──────
// La MÊME affectation globale, lue dans l'autre sens : `parAchat[tx]` (la très probable, au plus une) puis chaque article
// qui a cet achat parmi ses pistes. La meilleure : la très probable ; sinon le premier article SEULEMENT si cet achat est
// SA première piste (non ambiguë) et qu'il devance nettement le deuxième article. Jamais une égalité tranchée.
// liaison : le résultat d'`affecterPropositions` · montrable(key) → bool (l'article est à relier) · refus comme plus haut.
// Rend { meilleure: { key, p } | null, autres: [{ key, p }], egalite }.
export function propositionsPourAchat({ liaison, tx, montrable = () => true, refus = null, max = 3 } = {}) {
  const vide = { meilleure: null, autres: [], egalite: false };
  const t = String(tx == null ? '' : tx);
  if (!liaison || !t) return vide;
  const ok = (key) => { if (refus && refus[cleRefusLiaison(key, t)]) return false; try { return !!montrable(key); } catch (_) { return false; } };
  const out = [];
  const vus = new Set();
  for (const [key, l] of Object.entries(liaison.parArticle || {})) {
    const p = l && l[0];
    if (p && txDe(p.achat) === t && ok(key) && !vus.has(key)) { vus.add(key); out.push({ key, p, premier: true }); }
  }
  for (const [key, l] of Object.entries(liaison.pistes || {})) {
    if (vus.has(key) || !Array.isArray(l)) continue;
    const i = l.findIndex((p) => txDe(p && p.achat) === t);
    if (i < 0 || !ok(key)) continue;
    vus.add(key);
    out.push({ key, p: l[i], premier: i === 0 && !(liaison.parArticle && liaison.parArticle[key] && liaison.parArticle[key].length) });
  }
  out.sort((x, y) => ((x.p.niveau === 'tres-probable') === (y.p.niveau === 'tres-probable') ? (Number(y.p.score) - Number(x.p.score)) : (x.p.niveau === 'tres-probable' ? -1 : 1)) || (x.key < y.key ? -1 : 1));
  let meilleure = null;
  const a0 = out[0], a1 = out[1];
  if (a0 && a0.p.niveau === 'tres-probable') meilleure = a0;
  else if (a0 && a0.premier && !a0.p.ambigu && (!a1 || (Number(a0.p.score) - Number(a1.p.score)) >= ECART_TRES_PROBABLE)) meilleure = a0;
  const autres = out.filter((x) => x !== meilleure).slice(0, max).map(({ key, p }) => ({ key, p }));
  return { meilleure: meilleure ? { key: meilleure.key, p: meilleure.p } : null, autres, egalite: !meilleure && autres.length > 1 };
}

// ── Un LOT : combien de ses articles sont déjà reliés (jamais un prix divisé) ──
// Rend null (pas un lot) ou { n (nombre lu, null = pas su), relies }.
export function etatLot(achat, liens) {
  const l = lotDe(achat);
  if (!l.lot) return null;
  const relies = (liens && typeof liens.get === 'function' ? liens.get(txDe(achat)) : 0) || 0;
  return { n: l.n == null ? null : l.n, relies };
}
