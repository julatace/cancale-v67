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
// ── (17 oct.) L'ARGENT REÇU : LA LIGNE PUBLIÉE PAR L'APP, JAMAIS LES EMAILS ──
// Le widget calculait `received` sur `email_final_*` pendant que Ma journée dit
// « Reçu en {mois} » avec `recuDuMois` (publié dans `vinted_urssaf_mois.recu`).
// On sert à chaque vendeur des emails de finalisation à 999 € (le piège) et une
// ligne publiée qui dit autre chose, et on exige : le montant PUBLIÉ, celui de
// SON vendeur ; ligne absente / ancienne / illisible / d'avant `recu` ⇒ AUCUN
// nombre (jamais 0, jamais les emails) ; une source illisible ⇒ `received`
// vide et le montant connu dans `receivedAuMoins`. La projection `select=` de
// `main` est APPLIQUÉE (§6.3) : une clé non projetée n'arrive pas.
// `WIDGET_SRC=/chemin/api/widget.js` lance le banc sur une copie (mutation).
// §6.1 : sur le code mono-vendeur (origin/main, lectures non filtrées), les
// totaux sont identiques pour A et B (A+B) et les lectures ne portent aucun
// `owner=eq.` → ces exigences TOMBENT.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

// Deux vendeurs, chacun SA clé et SON nombre de colis à expédier (1 vs 3) : si le
// widget renvoie le même total aux deux, c'est qu'il agrège tout le monde.
const YM = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 7);
const SRC_OK = { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'nonRelie' };
const publie = (recu, extra = {}) => ({ mois: [{ ym: YM, n: 3, ca: 300 }], aDater: { n: 0, ca: 0, par: {} }, ecartees: 0,
  sources: SRC_OK, declare: 'lu', recu: { [YM]: recu }, at: Date.now() - 60000, ...extra });
const V = {
  A: { tok: 'CLE-AAAAAAAAAAAA', sold: ['TA1'], urssaf: publie(412.6) },
  B: { tok: 'CLE-BBBBBBBBBBBB', sold: ['TB1', 'TB2', 'TB3'], urssaf: publie(87.2) },
};
// La projection de `main` : `alias:data->cle` ⇒ { alias: data[cle] }.
const projette = (u, data) => {
  const m = decodeURIComponent(u).match(/select=([^&]+)/);
  if (!m) return data;
  const out = {};
  for (const part of m[1].split(',')) {
    const r = part.match(/^([\w]+):data->>?([\w]+)$/);
    if (r) { if (data[r[2]] !== undefined) out[r[1]] = data[r[2]]; } else if (part === 'data') return { data };
  }
  return out;
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
    if (/id=eq\.main/.test(u)) {
      const d = { vrm_widget_token: (o && V[o]) ? V[o].tok : '', vinted_pickup_done: {}, vinted_bords_printed: {} };
      if (o && V[o] && V[o].urssaf !== undefined) d.vinted_urssaf_mois = V[o].urssaf;
      return J([projette(u, d)]);
    }
    if (/id=eq\.widget_stats/.test(u)) return J([]);
    if (/id=like\.email_bord_/.test(u)) return J([]);
    // Le piège : des emails de finalisation de ce mois, à 999 €.
    if (/id=like\.email_final_/.test(u)) return J([{ id: 'email_final_x', data: { receivedAt: YM + '-02T10:00:00Z', montant: '999' }, receivedAt: YM + '-02T10:00:00Z', montant: '999' }]);
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
  const mod = await import('file://' + (process.env.WIDGET_SRC || path.join(RACINE, 'api', 'widget.js')));
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

  // ── L'ARGENT REÇU ────────────────────────────────────────────────────────
  const c = (r) => r.res.corps || {};
  dit(c(A).received === 413, 'reçu de A : le montant PUBLIÉ par l\'app (412,60 € → 413), jamais les emails (999)', 'received=' + c(A).received);
  dit(c(B).received === 87, 'reçu de B : SON montant publié (87), pas celui de A', 'received=' + c(B).received);
  const cas = async (nom, urssaf, test, msg) => {
    const avant = V.A.urssaf; V.A.urssaf = urssaf;
    const r = await appeler(V.A.tok); V.A.urssaf = avant;
    const k = c(r);
    dit(r.res.code === 200 && test(k), msg, `HTTP ${r.res.code} · received=${k.received} · auMoins=${k.receivedAuMoins} · raison=${k.receivedRaison}`);
  };
  const sansNombre = (k) => k.received === null && k.receivedAuMoins === null;
  await cas('absente', undefined, (k) => sansNombre(k) && k.receivedRaison === 'absente', 'ligne publiée absente ⇒ aucun nombre (ni 0, ni les emails)');
  await cas('ancienne', publie(412.6, { at: Date.now() - 5 * 86400000 }), (k) => sansNombre(k) && k.receivedRaison === 'ancienne', 'ligne publiée de plus de 3 jours ⇒ aucun nombre');
  await cas('illisible', { mois: 'x', at: Date.now() }, (k) => sansNombre(k) && k.receivedRaison === 'illisible', 'ligne publiée illisible ⇒ aucun nombre');
  await cas('ancienne-app', (() => { const p = publie(1); delete p.recu; return p; })(), (k) => sansNombre(k) && k.receivedRaison === 'ancienne-app', 'ligne publiée par une app d\'avant `recu` ⇒ aucun nombre');
  await cas('partiel', publie(412.6, { sources: { ...SRC_OK, Leboncoin: 'pasSu' } }),
    (k) => k.received === null && k.receivedAuMoins === 413 && Array.isArray(k.receivedManque) && k.receivedManque.includes('Leboncoin'),
    'une source illisible ⇒ `received` vide (jamais présenté complet), « au moins 413 » et ce qui manque nommé');
  await cas('zero', publie(0, { recu: {} }), (k) => k.received === 0 && k.receivedRaison === null, 'ligne lue, de ce mois, sans rien reçu ⇒ un vrai 0 (le sien)');
  await cas('adater', publie(50, { aDater: { n: 2, ca: 70, par: { Vinted: { n: 2, ca: 70.4 } } } }),
    (k) => k.received === 50 && k.receivedADater && k.receivedADater.n === 2 && k.receivedADater.ca === 70, 'ventes finalisées pas encore datées : dites à côté (la couverture, comme sur l\'app)');

  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTous les contrôles passent — chaque vendeur a SON widget, filtré sur lui.');
  process.exit(ko ? 1 : 0);
})();
