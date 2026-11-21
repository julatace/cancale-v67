// ═══════════════════════════════════════════════════════════════════════════
// UNE LECTURE PAGINÉE PORTE TOUJOURS UN ORDRE STABLE (7 nov., audit « 1 000 vendeurs »)
// ═══════════════════════════════════════════════════════════════════════════
// Une lecture par pages (en-tête `Range`, ou `offset=`) SANS `order=` laisse
// Postgres rendre les lignes dans l'ordre qui l'arrange : d'une page à l'autre,
// une ligne peut SAUTER (jamais lue) ou être lue DEUX fois. Avec quelques
// centaines de lignes ça ne se voit pas ; avec 1 000 vendeurs, c'est un colis
// pas rappelé ou un vendeur traité deux fois.
// `ordreStable(chemin)` ajoute un tri TOTAL (sur la clé primaire de la table)
// quand la requête n'en porte pas déjà un ; une requête qui a son `order=`
// reste telle quelle (elle sait ce qu'elle veut).
// Tenu par scripts/audit-pagination-ordre.cjs (chaque `Range` du serveur passe
// par ici ou nomme son `order=`).
// ═══════════════════════════════════════════════════════════════════════════

// La clé primaire de chaque table lue par pages — un tri total, jamais deux
// lignes à égalité (app_data : (owner, id), migration 001/002).
export const ORDRE_PAR_TABLE = {
  app_data: 'owner.asc,id.asc',
  vinted_accounts: 'owner.asc,vinted_user_id.asc',
  abonnements: 'owner.asc',
  essais_gratuits: 'cle.asc',   // (11 nov.) clé primaire `cle` (migration 022), lue par api/_lib/pilotage.js
};

// `chemin` : « table?filtres… » ou l'URL complète « …/rest/v1/table?filtres… ».
export function ordreStable(chemin) {
  const s = String(chemin == null ? '' : chemin);
  const q = s.indexOf('?');
  const requete = q >= 0 ? s.slice(q + 1) : '';
  if (/(^|&)order=/.test(requete)) return s;
  const avant = q >= 0 ? s.slice(0, q) : s;
  const table = avant.slice(avant.lastIndexOf('/') + 1);
  const ordre = ORDRE_PAR_TABLE[table] || ORDRE_PAR_TABLE.app_data;
  return s + (q >= 0 ? (requete ? '&' : '') : '?') + 'order=' + ordre;
}

// (11 nov., lot « limites-client ») LA FIN DE LISTE À UNE FRONTIÈRE EXACTE.
// Une famille d'exactement 1 000 (2 000…) lignes : la page suivante peut être
// refusée par un 416 « Requested range not satisfiable » qui porte
// `Content-Range: */1000`. Ce n'est PAS une panne, c'est la fin de la liste
// (l'app le sait déjà, `lireTout`). Mesuré au banc « gros client » : le widget
// d'un vendeur à 1 000 e-mails de vente répondait « base injoignable ».
// Vrai seulement si le total dit est EXACTEMENT le début de la page demandée.
export function finALaFrontiere(r, debut) {
  if (!r || r.status !== 416 || !(debut > 0)) return false;
  const cr = r.headers && typeof r.headers.get === 'function' ? r.headers.get('content-range') : '';
  const m = /^\*\/(\d+)$/.exec(String(cr || '').trim());
  return !!m && Number(m[1]) === debut;
}
