// Fusion des commandes Vinted par n° de transaction et empreinte d'une commande : partagées avec le service worker (scripts/sync-commandes.cjs).
// ══ LES VENTES ET LES ACHATS SE FUSIONNENT PAR N° DE TRANSACTION (5.323) ═════
// Récit : `docs/passation/2026-11-06-extension-5323.md`. Une lecture PARTIELLE
// des commandes (les pages récentes) se fusionne dans la liste rangée, par
// IDENTITÉ (`transaction_id`, §5 — jamais un titre) : une transaction relue
// remplace sa copie (l'état le plus frais), une transaction hors de la fenêtre
// reste telle quelle (loi 2), une neuve s'ajoute (en tête si la lecture part de
// la page 1). Une ligne sans `transaction_id` n'est ni ajoutée ni rapprochée.
// 5.326 (8 nov.) : CE TEXTE est la seule définition. Il est recopié tel quel
// dans `background.js` (bloc COMMANDES PARTAGEES) et importé par le serveur
// (`api/_lib/commandes-leger.js`) : l'extension et le serveur fusionnent avec
// la MÊME règle, au caractère près (`node scripts/sync-commandes.cjs --verifier`).
export const cleTxCommande = (o) => { const t = o && o.transaction_id; return t == null || String(t).trim() === '' ? null : String(t); };
// La lecture part-elle du HAUT de la liste ? Les trois lecteurs partent de la
// page 1 et concatènent ; une page profonde SEULE (capture passive d'une page 3)
// ne vole pas le haut : ses transactions remplacent leur copie en place, une
// neuve va en queue.
export function lectureDuHaut(neuf) {
  const pg = (neuf && neuf.pagination) || {};
  const cp = Number(pg.current_page != null ? pg.current_page : pg.page);
  const per = Number(pg.per_page);
  const n = ((neuf && neuf.my_orders) || []).length;
  return !(isFinite(cp) && cp > 1 && (!isFinite(per) || n <= per));
}
export function fusionnerCommandes(avant, neuf) {
  const lus = neuf && Array.isArray(neuf.my_orders) ? neuf.my_orders : null;
  if (!lus) return null;
  const fen = new Map();
  for (const o of lus) { const k = cleTxCommande(o); if (k && !fen.has(k)) fen.set(k, o); }
  if (!fen.size) return null;                                   // aucune identité : forme inconnue
  const ranges = avant && Array.isArray(avant.my_orders) ? avant.my_orders : [];
  const dejaRangees = new Set(ranges.map(cleTxCommande).filter(Boolean));
  const neuves = [...fen.entries()].filter(([k]) => !dejaRangees.has(k)).map(([, o]) => o);
  const places = new Set(), corps = [];
  for (const o of ranges) {
    const k = cleTxCommande(o);
    if (k && fen.has(k)) { if (!places.has(k)) { places.add(k); corps.push(fen.get(k)); } }
    else corps.push(o);                                         // hors fenêtre (ou sans identité) : tel quel
  }
  const haut = lectureDuHaut(neuf);
  const my_orders = haut ? neuves.concat(corps) : corps.concat(neuves);
  const pagination = (haut || !(avant && avant.pagination)) ? ((neuf && neuf.pagination) || (avant && avant.pagination) || null) : avant.pagination;
  return Object.assign({}, avant && typeof avant === 'object' ? avant : {}, neuf, { pagination, my_orders });
}
// L'EMPREINTE D'UNE COMMANDE (5.326) : deux copies de la même commande (celle
// que l'extension vient de lire, celle rangée en base) ont la même empreinte si
// et seulement si leur CONTENU est le même. La base (jsonb) range les clés dans
// son propre ordre : on trie les clés à chaque niveau avant de hacher. Deux
// hachages de 32 bits (FNV-1a et djb2) : une collision sur la même transaction
// est hors de portée. Elle ne sert qu'à dire « déjà rangée telle quelle » — une
// empreinte inconnue fait ENVOYER la commande, jamais la deviner.
export function canonCommande(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canonCommande).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonCommande(v[k])).join(',') + '}';
}
export function empreinteCommande(o) {
  const t = canonCommande(o);
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a ^= c; a = Math.imul(a, 0x01000193) >>> 0; b = (Math.imul(b, 33) + c) >>> 0; }
  return a.toString(36) + b.toString(36);
}
