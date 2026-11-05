// ── SÉCURITÉ DU COMPTE VRM — les règles de l'écran (4 nov.) ──────────────────
// Trois gestes de Paramètres → Mon compte, chacun avec une règle pure que
// `scripts/audit-securite-compte.cjs` exécute :
//   · « Se déconnecter partout » (`deconnecterPartout`) : Supabase ferme TOUTES
//     les sessions (scope global). On n'efface ce navigateur QU'APRÈS que
//     Supabase a dit oui : une panne ne fait croire à rien (« pas su » ≠ fait).
//   · « Appareils connectés » : la liste vient de `/api/compte?mode=appareils`.
//   · « Ce que VRM a fait » (`ligneJournal`, `filtrerJournal`) : chaque ligne
//     nomme l'article par son IDENTITÉ (l'identifiant d'annonce ⇒ sa fiche N°),
//     jamais par un titre ; sans fiche, « article » + l'identifiant, pas un N°
//     deviné (§5 : mieux vaut un blanc qu'un faux).

// Rend 'ok' · 'refuse' (jeton refusé : déjà déconnecté ailleurs) · 'injoignable'.
export async function deconnecterPartout({ fetch: f, url, apikey, jeton }) {
  if (!jeton) return 'refuse';
  try {
    const r = await f(`${url}/auth/v1/logout?scope=global`, { method: 'POST', headers: { apikey, Authorization: `Bearer ${jeton}` } });
    if (r && (r.status === 204 || r.status === 200)) return 'ok';
    if (r && (r.status === 401 || r.status === 403)) return 'refuse';
    return 'injoignable';
  } catch (_) { return 'injoignable'; }
}

// Ce que dit la confirmation. L'extension a SA propre session VRM (fabriquée
// par `/api/compte?mode=session-extension`) : « partout » la ferme aussi. Une
// extension qui sait la liaison (5.171+) se reconnecte toute seule quand VRM est
// rouvert et connecté dans ce Chrome ; une plus ancienne demande son mot de passe.
export function texteConfirmationPartout({ extension }) {
  const base = 'VRM se fermera sur ce téléphone, cet ordinateur et tous les autres. Tu devras te reconnecter partout.';
  if (extension === 'liaison') return base + ' L’extension VRM sera déconnectée aussi : elle se reconnecte toute seule quand tu rouvres VRM dans son navigateur.';
  if (extension === 'ancienne') return base + ' L’extension VRM sera déconnectée aussi : reconnecte-la avec ton mot de passe VRM.';
  return base + ' L’extension VRM, si tu l’utilises, sera déconnectée aussi.';
}

// ── Le journal ──────────────────────────────────────────────────────────────
export const LIBELLES_TYPE = {
  favori: 'Message à un favori',
  favori_offre: 'Message et offre',
  republication: 'Republication',
  ebay_retrait: 'Retrait eBay automatique',
  ebay_action: 'Action eBay',
  bordereau: 'Bordereau récupéré',
};
export const LIBELLES_RESULTAT = { ok: 'Fait', refuse: 'Refusé', pause: 'En pause', verifier: 'À vérifier', en_cours: 'En cours' };
// Les filtres de type (puces) : regroupés comme Julien les nomme.
export const FILTRES_TYPE = [
  ['tous', 'Tout'], ['favoris', 'Favoris'], ['republication', 'Republications'], ['ebay', 'eBay'], ['bordereau', 'Bordereaux'],
];
const familleType = (t) => (t === 'favori' || t === 'favori_offre' ? 'favoris' : t === 'ebay_retrait' || t === 'ebay_action' ? 'ebay' : t);

export function filtrerJournal(evts, { compte = '*', type = 'tous' } = {}) {
  return (Array.isArray(evts) ? evts : []).filter((e) => e
    && (compte === '*' || !compte || String(e.compte || '') === String(compte))
    && (type === 'tous' || !type || familleType(e.type) === type));
}

// `numeroDeItem(itemId)` : le N° de la fiche de CET identifiant, ou null.
// `nomCompte(uid)` : le pseudo du compte, ou null.
export function ligneJournal(e, { numeroDeItem, nomCompte } = {}) {
  const c = (e && e.cle) || {};
  let article = null;
  if (c.item && numeroDeItem) { const n = numeroDeItem(c.item); if (n) article = 'N°' + n; }
  if (!article && c.ancien && numeroDeItem) { const n = numeroDeItem(c.ancien); if (n) article = 'N°' + n; }
  if (!article && c.sku) article = 'SKU ' + c.sku;
  if (!article && c.item) article = 'article ' + c.item;
  if (!article && c.tx) article = 'commande ' + c.tx;
  const compte = e && e.compte ? ((nomCompte && nomCompte(e.compte)) || (e.compte === 'principal' ? 'compte eBay principal' : null)) : null;
  const titre = (e && e.type === 'ebay_action' && e.action) ? e.action : (LIBELLES_TYPE[e && e.type] || 'Action');
  return { titre, article, compte, resultat: LIBELLES_RESULTAT[e && e.resultat] || '—', aVerifier: !!e && (e.resultat === 'verifier' || e.resultat === 'refuse') };
}

// Les comptes présents dans le journal (pour les puces de compte), dans l'ordre
// de la première apparition.
export function comptesDuJournal(evts) {
  const vus = []; const s = new Set();
  for (const e of Array.isArray(evts) ? evts : []) if (e && e.compte && !s.has(String(e.compte))) { s.add(String(e.compte)); vus.push(String(e.compte)); }
  return vus;
}
