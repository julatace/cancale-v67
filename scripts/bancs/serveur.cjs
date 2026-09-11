// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES ROUTES SERVEUR, EXÉCUTÉES POUR DE VRAI
//        node scripts/bancs/serveur.cjs
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 — « une fonction serverless n'est vérifiée que si un banc l'EXÉCUTE ».
// `npm run build` ne compile pas `api/`. Aucun banc ne les avait jamais lancées.
//
// Ce qu'il mesure : ce que chaque route RÉPOND quand la base ne répond pas.
// L'app a appris cette leçon cinq fois (« rien lu » ne vaut pas « rien ») ;
// les routes serveur, elles, ne l'avaient jamais apprise — et elles sont le
// seul endroit où le mensonge DÉTRUIT quelque chose :
//
//   api/email-inbound  Un 200 dit au service de réception « je l'ai, tu peux
//                      l'oublier » : l'email est SUPPRIMÉ chez lui. Or la
//                      route répondait 200 sans jamais regarder si l'écriture
//                      avait abouti. Trois jours de base injoignable = trois
//                      jours de ventes, bordereaux, suivis et messages perdus
//                      pour de bon. C'est « on ne jette aucun email » (§5)
//                      retourné. Un 5xx, lui, fait RÉESSAYER.
//   api/widget         Répondait `ship:0, pickup:0, moneyMonth:0` — le widget
//                      de son écran d'accueil affichait « rien à faire » avec
//                      14 colis à expédier. Un chiffre ABSENT est honnête, un
//                      zéro inventé ne l'est pas.
//   api/push           `loadSubs()` rendait `[]` sur une lecture ratée, puis
//                      `subscribe` réécrivait la liste avec le seul appareil
//                      courant : les autres téléphones étaient EFFACÉS. Et la
//                      route répondait `{ok:true}`.
//
// ⚠️ La panne est servie dans sa VRAIE forme (522 + HTML Cloudflare), et les
//    deux sens sont vérifiés : rien ne doit crier en marche normale.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
const HTML522 = '<!DOCTYPE html><html><head><title>522: Connection timed out</title></head><body>Connection timed out</body></html>';

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

// ── Une fausse base, dans les deux états ────────────────────────────────────
const ecrites = [];
// `etat` : 'ok' · 'panne' (tout tombe) · 'lectureKO' (les lectures échouent,
// les écritures passent — le cas qui EFFACE, voir le contrôle push plus bas).
function poserFetch(etat) {
  ecrites.length = 0;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    const panne = etat === 'panne';
    const lecture = (opts.method || 'GET') === 'GET';
    if (panne || (etat === 'lectureKO' && lecture && u.includes('/rest/v1/')))
      return new Response(HTML522, { status: 522, headers: { 'content-type': 'text/html' } });
    if (!u.includes('/rest/v1/')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    if ((opts.method || 'GET') === 'POST') {
      try { JSON.parse(opts.body || '[]').forEach(r => ecrites.push(r.id)); } catch (_) {}
      return new Response('', { status: 201 });
    }
    // La colonne `owner` n'existe pas chez lui : PostgREST répond 400.
    if (/select=owner/.test(u)) return new Response('{"code":"42703"}', { status: 400, headers: { 'content-type': 'application/json' } });
    let corps = '[]';
    if (/id=eq\.push_subs/.test(u)) corps = JSON.stringify([{ data: { subs: [{ endpoint: 'https://exemple/aaa' }, { endpoint: 'https://exemple/bbb' }] } }]);
    else if (/id=eq\.main/.test(u)) corps = JSON.stringify([{ data: {} }]);
    else if (/id=eq\.widget_stats/.test(u)) corps = JSON.stringify([{ data: { caMois: 143.1, ventesMois: 2, updatedAt: new Date().toISOString() } }]);
    return new Response(corps, { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

// ── Un faux couple req/res, comme Vercel les fabrique ───────────────────────
const faireRes = () => {
  const r = { code: null, corps: null };
  r.status = (n) => { r.code = n; return r; };
  r.json = (o) => { r.corps = o; return r; };
  r.setHeader = () => {};
  r.end = () => r;
  return r;
};

// Un email de VENTE Vinted, dans la forme que le service de réception envoie.
const EMAIL_VENTE = {
  from: 'no-reply@vinted.fr', to: 'recu@exemple.test',
  subject: 'Ton article est vendu !',
  // ⚠️ La FORME compte (§6) : `parseSaleEmail` cherche « X a acheté … 00,00 € ».
  //    Mon premier jet disait « a été vendu 42,00 € à X » — l'analyse échouait
  //    et je mesurais un refus de mon propre banc, pas le comportement réel.
  text: "acheteur-de-banc a acheté [Paire de banc] n°9001 42,00 €\nPrépare ton colis.",
  html: '<p>Ton article est vendu</p>', attachments: [],
};

(async () => {
  // ── 1. L'EMAIL ENTRANT ────────────────────────────────────────────────────
  const inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js'));
  for (const panne of [true, false]) {
    poserFetch(panne ? 'panne' : 'ok');
    const res = faireRes();
    await inbound.default({ method: 'POST', query: {}, body: JSON.parse(JSON.stringify(EMAIL_VENTE)) }, res);
    if (panne) {
      // LA RÈGLE : tant qu'on n'a pas RANGÉ l'email, on ne dit pas « reçu ».
      dit(res.code >= 500, "email entrant : base injoignable → le service de réception doit RÉESSAYER",
        res.code >= 500 ? `HTTP ${res.code}` : `HTTP ${res.code} = « je l'ai, tu peux l'oublier » → email perdu`);
    } else {
      dit(res.code === 200 && res.corps && res.corps.ok !== false,
        "email entrant : base debout → reçu et rangé", `HTTP ${res.code}`);
      dit(ecrites.length > 0, "email entrant : et il a bien écrit une ligne", ecrites.join(', ') || 'aucune écriture');
    }
  }

  // ── 2. LE WIDGET DE L'ÉCRAN D'ACCUEIL ─────────────────────────────────────
  const widget = await import('file://' + path.join(RACINE, 'api', 'widget.js'));
  for (const panne of [true, false]) {
    poserFetch(panne ? 'panne' : 'ok');
    const res = faireRes();
    await widget.default({ method: 'GET', query: {} }, res);
    const c = res.corps || {};
    if (panne) {
      // Un zéro inventé est pire qu'un chiffre absent : il se lit « rien à faire ».
      const zeros = ['ship', 'pickup', 'moneyMonth', 'salesMonth'].filter(k => c[k] != null &&
        (typeof c[k] === 'number' ? c[k] === 0 : (c[k] && c[k].total === 0)));
      dit(zeros.length === 0, 'widget : base injoignable → aucun zéro présenté comme un fait',
        zeros.length ? 'il annonce ' + zeros.map(k => k + ' = 0').join(', ') : '');
      dit(res.code >= 500, 'widget : et il le DIT au téléphone', `HTTP ${res.code}`);
    } else {
      dit(res.code === 200 && c.ship && typeof c.ship.total === 'number',
        'widget : base debout → il rend ses chiffres', `HTTP ${res.code}`);
      dit(c.moneyMonth === 143, 'widget : et le CA vient bien de la ligne publiée par l\'app', String(c.moneyMonth));
    }
  }

  // ── 3. L'ABONNEMENT AUX NOTIFICATIONS ─────────────────────────────────────
  const push = await import('file://' + path.join(RACINE, 'api', 'push.js'));
  const NOUVEAU = { endpoint: 'https://exemple/ccc', keys: { p256dh: 'x', auth: 'y' } };
  for (const panne of [true, false]) {
    poserFetch(panne ? 'panne' : 'ok');
    const res = faireRes();
    await push.default({ method: 'POST', query: {}, body: { action: 'subscribe', sub: NOUVEAU } }, res);
    if (panne) {
      dit(res.code >= 500, "abonnement push : base injoignable → l'app ne doit pas afficher « activé »",
        res.code >= 500 ? `HTTP ${res.code}` : `HTTP ${res.code} ${JSON.stringify(res.corps)}`);
      // ⚠️ LE PIRE : une liste lue VIDE par erreur, réécrite avec le seul
      //    appareil courant, efface les autres téléphones. On n'écrit pas.
      const ecrase = ecrites.includes('push_subs');
      dit(!ecrase, "abonnement push : et il n'ÉCRASE pas la liste des autres appareils",
        ecrase ? 'la ligne push_subs a été réécrite depuis une lecture ratée' : '');
    } else {
      dit(res.code === 200 && res.corps && res.corps.devices === 3,
        'abonnement push : base debout → le nouvel appareil s\'ajoute aux deux autres',
        `HTTP ${res.code} ${JSON.stringify(res.corps)}`);
    }
  }

  // ── 4. LE CAS QUI EFFACE : LECTURE RATÉE, ÉCRITURE POSSIBLE ───────────────
  // C'est la forme la plus dangereuse et la plus banale (un timeout de lecture,
  // la base debout par ailleurs) : `subscribe` lit `[]`, ajoute l'appareil
  // courant, réécrit `push_subs` — et les deux autres téléphones de Julien
  // n'existent plus. Une perte réelle, pas un affichage faux.
  poserFetch('lectureKO');
  {
    const res = faireRes();
    await push.default({ method: 'POST', query: {}, body: { action: 'subscribe', sub: NOUVEAU } }, res);
    const ecrase = ecrites.includes('push_subs');
    dit(!ecrase, "abonnement push : lecture ratée → il n'écrase pas la liste des autres appareils",
      ecrase ? 'push_subs réécrite depuis une liste lue vide par erreur' : '');
    dit(res.code >= 500, "abonnement push : et il ne répond pas « activé »", `HTTP ${res.code}`);
  }

  console.log(ko ? `\n${ko} controle(s) non conforme(s).`
                 : "\nAucune route ne dit « c'est fait » sans l'avoir fait.");
  process.exit(ko ? 1 : 0);
})();
