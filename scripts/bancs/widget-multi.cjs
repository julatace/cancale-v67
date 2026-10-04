// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE WIDGET D'ÉCRAN D'ACCUEIL, PAR VENDEUR (node scripts/bancs/widget-multi.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 — une route serveur n'est vérifiée que si un banc l'EXÉCUTE.
// Le widget prenait le PREMIER `main` venu et tous ses balayages
// (`email_bord_*`, `harvest_%_orders_*`, `email_sale_*`…) lisaient TOUS les
// vendeurs d'un coup : le vendeur B, en ouvrant SON widget, voyait les chiffres
// agrégés de A. C'est le pendant symétrique du cron `ship-reminders`.
// On sert une base CLOISONNÉE à DEUX vendeurs, chacun sa clé `?k=` et ses
// propres colis à expédier, et on exige :
//   • la clé de A ⇒ lectures filtrées `owner=eq.A`, et SON total (pas A+B) ;
//   • la clé de B ⇒ `owner=eq.B`, et SON total ;
//   • JAMAIS une lecture lourde globale (sans filtre owner) ni le scope de
//     l'autre vendeur pendant la requête d'un vendeur ;
//   • une clé inconnue ⇒ 401, jamais les chiffres de quelqu'un d'autre.
// §6.1 : sur le code mono-vendeur (origin/main, lectures non filtrées), les
// totaux sont identiques pour A et B (A+B) et les lectures ne portent aucun
// `owner=eq.` → ces exigences TOMBENT.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

// Deux vendeurs, chacun SA clé et SON nombre de colis à expédier (1 vs 3) : si le
// widget renvoie le même total aux deux, c'est qu'il agrège tout le monde.
const V = {
  A: { tok: 'CLE-AAAAAAAAAAAA', sold: ['TA1'] },
  B: { tok: 'CLE-BBBBBBBBBBBB', sold: ['TB1', 'TB2', 'TB3'] },
};

const lus = []; // toutes les URL GET vues pendant la requête courante

function poserFetch() {
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    if ((opts.method || 'GET') !== 'GET') return new Response('', { status: 201 });
    lus.push(u);
    // 1. Sonde de cloisonnement : la colonne owner existe.
    if (/select=owner&limit=1/.test(u)) return J([{ owner: 'A' }]);
    // 2. Énumération des vendeurs (clé de service, SANS filtre owner, volontaire) :
    //    un `main` par vendeur, avec SA clé de widget.
    if (/id=eq\.main/.test(u) && /select=owner/.test(u) && !/owner=eq\./.test(u))
      return J([{ owner: 'A', vrm_widget_token: V.A.tok }, { owner: 'B', vrm_widget_token: V.B.tok }]);
    // À partir d'ici, tout DOIT être filtré par vendeur.
    const mo = u.match(/owner=eq\.([^&]+)/);
    const o = mo ? decodeURIComponent(mo[1]) : null;
    if (/id=eq\.main/.test(u)) return J([{ vrm_widget_token: (o && V[o]) ? V[o].tok : '', vinted_pickup_done: {}, vinted_bords_printed: {} }]);
    if (/id=eq\.widget_stats/.test(u)) return J([]);
    if (/id=like\.email_bord_/.test(u)) return J([]);
    if (/id=like\.email_final_/.test(u)) return J([]);
    if (/id=like\.email_sale_/.test(u)) return J([]);
    // Le résumé des commandes à expédier. SANS filtre owner (code mono-vendeur),
    // on renvoie l'union A+B → un total qui ne correspond à PERSONNE.
    if (/orders_sold/.test(u)) {
      const txns = o && V[o] ? V[o].sold : [...V.A.sold, ...V.B.sold];
      return J([{ txns }]);
    }
    if (/orders_purchased/.test(u)) return J([{ txns: [] }]);
    return J([]);
  };
}

async function appeler(k) {
  lus.length = 0;
  poserFetch();
  const mod = await import('file://' + path.join(RACINE, 'api', 'widget.js'));
  const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
  await mod.default({ method: 'GET', headers: {}, query: k ? { k } : {} }, res);
  const lourdes = lus.filter(u => /email_bord_|orders_sold|orders_purchased|email_sale_|email_final_|id=eq\.widget_stats/.test(u));
  const scopes = new Set(lourdes.map(u => (u.match(/owner=eq\.([^&]+)/) || [])[1]).filter(Boolean));
  const globale = lourdes.some(u => !/owner=eq\./.test(u));
  return { res, lourdes, scopes, globale };
}

(async () => {
  // ── Requête du vendeur A (sa clé) ─────────────────────────────────────────
  const A = await appeler(V.A.tok);
  dit(A.res.code === 200, 'clé de A : réponse rendue', 'HTTP ' + A.res.code);
  dit(A.res.corps && A.res.corps.ship && A.res.corps.ship.total === 1,
    'clé de A : SON total à expédier (1), pas l\'agrégat A+B',
    'ship.total=' + (A.res.corps && A.res.corps.ship && A.res.corps.ship.total));
  dit(A.scopes.has('A') && !A.scopes.has('B'),
    'clé de A : les lectures lourdes sont filtrées owner=eq.A, jamais B',
    'scopes=' + [...A.scopes].join(','));
  dit(!A.globale, 'clé de A : aucune lecture lourde globale (sans filtre owner)',
    A.globale ? 'une lecture a balayé tous les vendeurs' : '');

  // ── Requête du vendeur B (sa clé) → des chiffres DIFFÉRENTS ────────────────
  const B = await appeler(V.B.tok);
  dit(B.res.code === 200, 'clé de B : réponse rendue', 'HTTP ' + B.res.code);
  dit(B.res.corps && B.res.corps.ship && B.res.corps.ship.total === 3,
    'clé de B : SON total à expédier (3), pas celui de A',
    'ship.total=' + (B.res.corps && B.res.corps.ship && B.res.corps.ship.total));
  dit(B.scopes.has('B') && !B.scopes.has('A'),
    'clé de B : les lectures lourdes sont filtrées owner=eq.B, jamais A',
    'scopes=' + [...B.scopes].join(','));

  // Le cœur : deux vendeurs, deux widgets, deux totaux. S'ils sont égaux, le
  // widget agrège tout le monde (le défaut mono-vendeur).
  const egaux = A.res.corps && B.res.corps && A.res.corps.ship && B.res.corps.ship
    && A.res.corps.ship.total === B.res.corps.ship.total;
  dit(!egaux, 'A et B n\'obtiennent PAS le même widget (chacun ses colis)',
    egaux ? 'les deux reçoivent ship.total=' + A.res.corps.ship.total + ' → agrégat partagé' : '');

  // ── Clé inconnue sur base cloisonnée multi-vendeurs → fermé ────────────────
  const X = await appeler('CLE-INCONNUE-ZZ');
  dit(X.res.code === 401, 'clé inconnue : 401, jamais les chiffres d\'un autre vendeur',
    'HTTP ' + X.res.code + (X.res.corps && X.res.corps.ship ? ' + a servi un widget !' : ''));

  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTous les contrôles passent — chaque vendeur a SON widget, filtré sur lui.');
  process.exit(ko ? 1 : 0);
})();
