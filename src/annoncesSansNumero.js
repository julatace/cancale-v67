// ════════════════════════════════════════════════════════════════════════════
//  LES ANNONCES EN LIGNE SANS N° (4 nov., choix de Julien n° 4)
//  La règle automatique (§5 « une annonce sans numéro en reçoit un », l'effet
//  « Numérotation AUTOMATIQUE des annonces en ligne » de src/App.jsx) numérote
//  déjà toute seule chaque annonce Vinted mise en ligne APRÈS la remise à zéro
//  du 9 octobre (`annonceNumerotable`). Cette liste ne montre donc que celles
//  qui restent VRAIMENT sans N°, avec en un mot pourquoi :
//   · « avant le 9 oct. »  — mise en ligne avant la remise à zéro : la règle
//     n'y touche pas (son carton porte peut-être un ancien N°, qui ne se redonne
//     JAMAIS — §5) ;
//   · « date inconnue »    — la date de mise en ligne n'a pas été lue ;
//   · « lecture ancienne » — son compte n'a pas été relu depuis plus de 24 h ;
//   · « pas encore lue »   — la règle n'a pas encore tourné (nuage, ventes ou
//     numéros réservés pas encore lus) ;
//   · « pas reliée »       — Leboncoin / eBay : elle se RELIE à une paire (N°
//     existant), elle ne reçoit pas un N° neuf d'ici.
//  « Numéroter » (une, ou toutes — confirmé) donne des N° par `prochainLibre`
//  (le plus haut + 1 : jamais un trou, jamais un ancien) et les met dans la
//  liste « nouveaux numéros à écrire sur tes cartons » (`aEcrire`) jusqu'à
//  « C'est écrit ».
//  Fonctions PURES (scripts/audit-annonces-sans-numero.cjs les exécute).
// ════════════════════════════════════════════════════════════════════════════

export const RAISONS = {
  'avant-remise': 'avant le 9 oct.',
  'date-inconnue': 'date inconnue',
  'lecture-ancienne': 'lecture ancienne',
  'pas-encore-lue': 'pas encore lue',
  'pas-reliee': 'pas reliée',
};
const H24 = 24 * 3600e3;
const aUnNumero = (f) => !!(f && f.numero != null && String(f.numero).trim());

// a = { id, site, date (ms|null), lueAt (ms|null), numero? }
// o = { coupure (ms|null), maintenant, regleEnAttente (bool), fiches: {id: fiche} }
export function raisonSansNumero(a, o = {}) {
  const site = a.site || 'vinted';
  if (site === 'leboncoin' || site === 'ebay') return 'pas-reliee';
  const maint = o.maintenant || Date.now();
  if (a.lueAt == null) return 'pas-encore-lue';
  if (maint - a.lueAt > H24) return 'lecture-ancienne';
  if (o.coupure != null) {
    if (a.date == null) return 'date-inconnue';
    if (a.date < o.coupure) return 'avant-remise';
  }
  // La règle automatique la numérotera : elle n'est pas « vraiment sans N° »,
  // sauf si la règle attend encore une lecture (alors c'est dit).
  return o.regleEnAttente ? 'pas-encore-lue' : null;
}

// La liste : chaque annonce en ligne SANS N°, avec sa raison ; celles que la
// règle automatique va numéroter d'elle-même n'y sont pas.
export function annoncesSansNumero(annonces, o = {}) {
  const fiches = o.fiches || {};
  const out = [];
  for (const a of (Array.isArray(annonces) ? annonces : [])) {
    if (!a || a.id == null) continue;
    if (aUnNumero(a) || aUnNumero(fiches[String(a.id)])) continue;
    const r = raisonSansNumero(a, o);
    if (r) out.push({ ...a, raison: r, mot: RAISONS[r], numerotable: a.site !== 'leboncoin' && a.site !== 'ebay' });
  }
  return out;
}

// Numéroter : des N° NEUFS par `prochainLibre` (passé par l'app, la MÊME
// fonction que partout), dans l'ordre reçu. `pris` / `prisCles` sont COPIÉS
// (l'appelant garde les siens) et contiennent TOUT le pool (fiches, ventes,
// garage, ancien pool, archive B…). Rend { fiches: { [id]: patch }, numeros: [..] }.
// Une annonce qui a déjà un N° (entre-temps) n'en reçoit pas un second.
export function numeroter(annonces, { pris, prisCles, pref = '', prochainLibre, cleNum, fiches = {}, maintenant = Date.now() }) {
  const p = new Set(pris || []), pk = new Set(prisCles || []);
  const at = new Date(maintenant).toISOString();
  const res = {}, nums = [];
  for (const a of (Array.isArray(annonces) ? annonces : [])) {
    if (!a || a.id == null || !a.numerotable) continue;
    if (aUnNumero(a) || aUnNumero(fiches[String(a.id)])) continue;
    const n = String(prochainLibre(p, pk, pref));
    const k = cleNum(n);
    if (!k || nums.some((x) => cleNum(x) === k)) throw new Error('numéro pas sûr');
    pk.add(k);
    res[String(a.id)] = { numero: n, auto: false, numberedAt: at, manuelAt: at, cartonVerifie: null, aEcrire: { vers: n, at } };
    nums.push(n);
  }
  return { fiches: res, numeros: nums };
}

// « nouveaux numéros à écrire sur tes cartons » : une fiche numérotée d'ici et
// pas encore marquée « C'est écrit ».
export const numeroAEcrire = (f) => !!(f && f.aEcrire && !f.aEcrire.ecrit && f.numero != null && String(f.numero) === String(f.aEcrire.vers));
