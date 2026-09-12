// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE PANNEAU LEBONCOIN, EXÉCUTÉ POUR DE VRAI
//        node scripts/bancs/leboncoin.cjs
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ `lbc.js` N'AVAIT JAMAIS TOURNÉ. 480 lignes, et c'est LE panneau qui sert
// à publier — celui que Julien a sous les yeux sur leboncoin.fr. `node --check`
// ne lit que la syntaxe : un sélecteur qui ne trouve rien, un `null`
// déréférencé, un panneau qui ne s'ouvre pas, une liste qui ne se groupe pas —
// rien de tout ça ne se voit sans l'exécuter dans une page. C'est §4.10
// appliqué au script de contenu le plus important du projet (la même leçon que
// `ebay.js`, sur le script qu'on utilise tous les jours).
//
// Ce qu'il vérifie, et pourquoi :
//   · la liste se groupe sur CE QU'IL PEUT FAIRE (loi de l'écran Colis) ;
//   · une annonce à 1 photo le DIT et donne la porte — mesuré le 12 septembre,
//     54 de ses 59 annonces partiraient avec une seule photo ;
//   · une annonce à 0 photo est en HAUT : Leboncoin la refuse ;
//   · ⚠️⚠️ « vendue » n'est écrit QUE sur une vente prouvée. Mesuré : sur ses
//     400 annonces fermées, 151 seulement portent une vente prouvée par
//     identité. Dire « vendue, supprime-la » sur les 249 autres lui ferait
//     perdre une vente sur une paire qu'il a encore.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'lbc.js'), 'utf8');

// ⚠️ LA VRAIE STRUCTURE, pas une invention : la page de dépôt de Leboncoin ne
// porte qu'UN champ (`name="subject"`, « Que proposez-vous aujourd'hui ? ») —
// c'est ce que SON navigateur a rapporté dans `lbc_recon` le 2 août, et c'est un
// formulaire en ÉTAPES. L'en-tête, lui, porte une barre de recherche sur TOUTES
// les pages : c'est le piège que la garde `DANS_ENTETE` écarte.
const PAGE = (depot) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Leboncoin</title></head>
<body>
  <header role="banner"><form action="/recherche"><input name="text" type="text" placeholder="Rechercher sur leboncoin"></form></header>
  <main>${depot
    ? '<label for="s1">Que proposez-vous aujourd’hui ?</label><input id="s1" name="subject" type="text">'
    : '<h1>Annonces</h1><aside><label for="pmin">Prix min</label><input id="pmin" name="price_min" type="text">'
      + '<label for="pmax">Prix max</label><input id="pmax" name="price_max" type="text"></aside>'}</main>
</body></html>`;

// La file servie au panneau : les trois cas de photo, et les trois preuves.
const QUEUE = [
  { id: '1001', numero: '401', account: 'julatace3535', title: 'Salomon XT-6 blanc T40', description: 'Réf. VRM-401\n\nTrès bon état.', price: '99.00', category: 'Chaussures', photos: ['https://ex/a1.jpg', 'https://ex/a2.jpg', 'https://ex/a3.jpg'], ref: 'VRM-401', vintedUrl: 'https://www.vinted.fr/items/1001' },
  { id: '1002', numero: '402', account: 'julatace3535', title: 'Nike air max 1 clear jade T44', description: 'Réf. VRM-402\n\nBon état.', price: '44.00', category: 'Chaussures', photos: ['https://ex/b1.jpg'], ref: 'VRM-402', vintedUrl: 'https://www.vinted.fr/items/1002' },
  { id: '1003', numero: '403', account: 'llloollllaa', title: 'Autry medalist blanc T36', description: 'Réf. VRM-403', price: '24.00', category: 'Chaussures', photos: [], ref: 'VRM-403', vintedUrl: 'https://www.vinted.fr/items/1003' },
];
const REMOVALS = [
  { id: '2001', numero: '501', ref: 'VRM-501', title: 'Nike p-6000 noir', etat: 'vendue' },
  { id: '2002', numero: '502', ref: 'VRM-502', title: 'Adidas Spezial noir', etat: 'fermee', url: 'https://www.leboncoin.fr/ad/502' },
  { id: '2003', numero: '503', ref: 'VRM-503', title: 'Dr. Martens 1461 mono', etat: 'pause', url: 'https://www.leboncoin.fr/ad/503' },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

(async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(PAGE(/depot/.test(q.url))); });
  await new Promise((res) => srv.listen(4491, res));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // Aucune image ne part sur le réseau : un banc ne dépend pas d'un CDN.
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const t = r.request().resourceType();
    return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
  });
  // Le faux pont : exactement ce que `lbc.js` demande au fond.
  await pg.addInitScript((d) => {
    window.chrome = {
      runtime: {
        id: 'banc', lastError: null,
        sendMessage: (msg, cb) => {
          const rep = (o) => { try { cb && cb(o); } catch (_) {} };
          if (!msg || msg.action === undefined) return rep({ ok: true });
          if (msg.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: d.removals, unlinked: [], postedList: [], stats: { onlineCount: 3, numberedCount: 3, postedCount: 0, lbcCount: 0 } });
          return rep({ ok: true });
        },
        onMessage: { addListener() {} },
      },
    };
  }, { queue: QUEUE, removals: REMOVALS });

  await pg.goto('http://localhost:4491/', { waitUntil: 'domcontentloaded' });
  await pg.addScriptTag({ content: SRC });
  await pg.waitForTimeout(1200);

  // Le panneau s'ouvre (il démarre replié sur une pastille).
  const fab = await pg.$('[data-a="open"]');
  dit(!!fab, 'la pastille VRM apparaît sur la page Leboncoin', fab ? '' : 'aucun panneau : le script n\'a pas démarré');
  if (fab) { await fab.click(); await pg.waitForTimeout(700); }
  const txt = await pg.evaluate(() => {
    const h = document.querySelector('div');
    const racines = [...document.querySelectorAll('*')].map(e => e.shadowRoot).filter(Boolean);
    const t = racines.map(r => r.textContent || '').join('\n');
    return t || (document.body.innerText || '');
  });
  dit(!errs.length, 'aucune erreur de page', errs[0] || '');
  dit(/Salomon XT-6 blanc T40/.test(txt), 'la liste montre le titre LEBONCOIN, pas le titre Vinted brut');
  dit(/99[.,]00 €|99 €/.test(txt), 'et le prix');

  // ── LE GROUPEMENT : ce qu'il peut faire, pas le numéro ────────────────────
  const iNue = txt.indexOf('Autry medalist');        // 0 photo
  const iPrete = txt.indexOf('Salomon XT-6');        // 3 photos
  const iUne = txt.indexOf('Nike air max 1');        // 1 photo
  dit(iNue > -1 && iPrete > -1 && iUne > -1, 'les trois annonces sont listées');
  dit(iNue < iPrete && iNue < iUne, 'l\'annonce SANS photo est en haut',
    'Leboncoin la refuse : la mettre après les autres, c\'est la laisser bloquée');
  dit(iPrete < iUne, 'les annonces prêtes passent avant celles à une seule photo',
    'trier par numéro mettait devant ce qui partirait bâclé');
  dit(/Aucune photo/.test(txt) && /Une seule photo/.test(txt), 'les groupes sont nommés');

  // ── LE CHIFFRE, PAS LA PROMESSE ───────────────────────────────────────────
  dit(/Leboncoin refuse une annonce sans photo/i.test(txt), 'une annonce sans photo dit pourquoi c\'est bloquant');
  dit(/1 seule photo/.test(txt), 'une annonce à une seule photo le DIT',
    '54 de ses 59 annonces sont dans ce cas, et rien ne le disait');
  const liens = await pg.evaluate(() => {
    const rs = [...document.querySelectorAll('*')].map(e => e.shadowRoot).filter(Boolean);
    return rs.flatMap(r => [...r.querySelectorAll('a[href]')].map(a => a.getAttribute('href')));
  });
  dit(liens.some(h => /vinted\.fr\/items\/1002/.test(h || '')), 'et elle donne la porte : le lien vers l\'annonce Vinted',
    'les autres photos ne s\'obtiennent QUE sur cette page — sans le lien, la consigne est creuse');

  // ── « VENDUE » SE PROUVE ──────────────────────────────────────────────────
  dit(/vendue.{0,30}sur Vinted/i.test(txt), 'la vente PROUVÉE est annoncée comme telle');
  dit(/à vérifier/i.test(txt), 'la vente NON prouvée se dit « à vérifier »',
    'sinon il supprime une annonce Leboncoin sur une supposition — 249 fois sur 400');
  dit(/en pause sur Vinted/i.test(txt), 'une annonce en pause est dite en pause');
  dit(/rien à faire/i.test(txt), 'et elle ne demande AUCUN geste');
  // Le point qui coûte : aucune paire non prouvée ne doit être appelée vendue.
  const bloc = (s2, e2) => { const i = txt.indexOf(s2); const j = e2 ? txt.indexOf(e2, i) : txt.length; return i < 0 ? '' : txt.slice(i, j < 0 ? txt.length : j); };
  const zoneDoute = bloc('à vérifier', 'en pause');
  // ⚠️⚠️ DEUX FOIS DE SUITE MON CONTRÔLE A CRIÉ AU LOUP, ET LE SECOND EST LE PLUS
  //    INSTRUCTIF. Jet 1 : « le mot "vendue" est interdit ici » → il attrapait
  //    « je n'ai pas la preuve qu'elles sont vendues ». Jet 2 : « le mot
  //    "supprime" est interdit ici » → il attrapait « je ne te dis pas de les
  //    supprimer », c'est-à-dire la NÉGATION de ce qu'il traque. Neuvième et
  //    dixième fois dans ce projet (§6.5).
  //    ⇒ Ce qui est interdit n'est pas un mot, c'est l'INSTRUCTION de supprimer,
  //    et elle se compte : la consigne « supprime-la » ne doit être rendue
  //    QU'AUTANT DE FOIS qu'il y a de ventes PROUVÉES. C'est la donnée qui
  //    déclenche, pas la formulation — si quelqu'un l'ajoute au groupe du doute,
  //    le compte monte et ce banc passe au rouge.
  const nVendues = REMOVALS.filter((r) => r.etat === 'vendue').length;
  const nConsignes = (txt.match(/supprime-la/gi) || []).length;
  dit(nConsignes === nVendues, `la consigne « supprime-la » est rendue ${nVendues} fois — une par vente PROUVÉE`,
    nConsignes !== nVendues ? `rendue ${nConsignes} fois pour ${nVendues} vente(s) prouvée(s) : une bonne annonce se fait retirer` : '');
  dit(/pas la preuve/i.test(zoneDoute), 'et le doute est écrit en toutes lettres',
    'un groupe « à vérifier » sans raison se lit comme une alerte de plus');
  const zonePause = bloc('en pause sur Vinted', null);
  dit(!/supprime-la/i.test(zonePause), 'et aucune consigne de suppression sur une annonce en pause');

  // ── LE PRÉ-REMPLISSAGE SUR LA VRAIE PAGE DE DÉPÔT ─────────────────────────
  // ⚠️⚠️ Le panneau annonçait « pré-rempli (dont la réf VRM-401) » À CHAQUE FOIS,
  // même quand aucun champ de référence n'existait. Or la vraie page de dépôt
  // n'en a pas : la référence n'était donc JAMAIS mise, et c'est elle qui relie
  // l'annonce Leboncoin à la paire sans rapprochement par titre (§5). Sans elle,
  // « vendue sur Vinted → à retirer » ne reconnaît pas l'annonce — il vend la
  // même paire deux fois.
  {
    const p2 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
    const toasts = [];
    p2.on('console', () => {});
    await p2.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await p2.addInitScript((d) => {
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => { const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: { onlineCount: 3, numberedCount: 3 } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { queue: QUEUE });
    await p2.goto('http://localhost:4491/depot', { waitUntil: 'domcontentloaded' });
    await p2.addScriptTag({ content: SRC });
    await p2.waitForTimeout(900);
    const f2 = await p2.$('[data-a="open"]'); if (f2) { await f2.click(); await p2.waitForTimeout(500); }
    // Cliquer « Pré-remplir » sur la première annonce.
    // ⚠️ MON PREMIER JET ATTENDAIT « Salomon », la première annonce de la FILE.
    //    Or la liste est maintenant groupée : la première carte est celle SANS
    //    photo. Le code avait raison, c'est l'attente du banc qui était périmée
    //    — et c'est au passage une preuve de plus que le groupement s'applique.
    //    On lit donc quelle carte on clique, au lieu de le supposer.
    const clic = await p2.evaluate(() => {
      const rs = [...document.querySelectorAll('*')].map(e => e.shadowRoot).filter(Boolean);
      for (const r of rs) {
        const b2 = r.querySelector('[data-a="prefill"]');
        if (b2) { const c = b2.closest('.card'); b2.click(); return c ? c.getAttribute('data-id') : 'sans-id'; }
      }
      return null;
    });
    dit(!!clic, 'le bouton « Pré-remplir » existe et se clique', clic ? 'carte ' + clic : '');
    const attendu = (QUEUE.find((q) => q.id === clic) || {}).title || '';
    await p2.waitForTimeout(500);
    const etat = await p2.evaluate(() => ({
      sujet: (document.querySelector('input[name="subject"]') || {}).value || '',
      recherche: (document.querySelector('header input[name="text"]') || {}).value || '',
      toast: [...document.querySelectorAll('*')].map(e => e.shadowRoot).filter(Boolean)
        .map(r => r.textContent || '').join(' '),
    }));
    dit(!e2.length, 'aucune erreur de page pendant le pré-remplissage', e2[0] || '');
    dit(!!attendu && etat.sujet === attendu, 'le champ de la page de dépôt reçoit le titre Leboncoin DE CETTE CARTE',
      'attendu « ' + attendu +' », reçu « ' + etat.sujet.slice(0, 40) + ' »');
    // ⚠️ LE PIÈGE : la barre de recherche de l'en-tête, présente sur TOUTES les
    //    pages. La garde `DANS_ENTETE` doit l'écarter.
    dit(etat.recherche === '', 'la barre de recherche de l\'en-tête n\'est JAMAIS remplie',
      etat.recherche ? 'elle a reçu « ' + etat.recherche.slice(0, 30) + ' » : le panneau annoncerait « rempli » sur une page où il n\'a rien fait d\'utile' : '');
    // Le message doit dire CE QUI a été rempli, et ne pas prétendre la référence.
    const dit_ref = /dont la réf/i.test(etat.toast);
    dit(!dit_ref, 'le message ne prétend PAS que la référence a été mise',
      dit_ref ? 'la page de dépôt n\'a aucun champ de référence — l\'annonce partirait sans, et ne serait plus reconnaissable' : '');
    dit(/n.a PAS pu être mise|est dans la description/i.test(etat.toast),
      'il dit où se trouve la référence quand elle n\'a pas pu être mise',
      'sans la réf, « vendue sur Vinted → à retirer » ne reconnaît plus l\'annonce');
    await p2.close();
  }

  // ── UN CHAMP DE FILTRE N'EST PAS UN CHAMP DE DÉPÔT ────────────────────────
  // Le panneau est sur TOUTES les pages de Leboncoin. Une page de résultats
  // porte « Prix min » / « Prix max », qui collent au motif `/prix|price/`.
  // Sans garde, cliquer « Pré-remplir » depuis une recherche écrit son prix dans
  // un filtre et annonce « 1 champ rempli » — rien d'utile n'a été fait.
  {
    const p3 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p3.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await p3.addInitScript((d) => {
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => { const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: { onlineCount: 3, numberedCount: 3 } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { queue: QUEUE });
    await p3.goto('http://localhost:4491/recherche', { waitUntil: 'domcontentloaded' });
    await p3.addScriptTag({ content: SRC });
    await p3.waitForTimeout(900);
    const f3 = await p3.$('[data-a="open"]'); if (f3) { await f3.click(); await p3.waitForTimeout(500); }
    await p3.evaluate(() => {
      const rs = [...document.querySelectorAll('*')].map(e => e.shadowRoot).filter(Boolean);
      for (const r of rs) { const b2 = r.querySelector('[data-a="prefill"]'); if (b2) { b2.click(); return; } }
    });
    await p3.waitForTimeout(400);
    const filtres = await p3.evaluate(() => ({
      min: (document.querySelector('input[name="price_min"]') || {}).value || '',
      max: (document.querySelector('input[name="price_max"]') || {}).value || '',
      toast: [...document.querySelectorAll('*')].map(e => e.shadowRoot).filter(Boolean).map(r => r.textContent || '').join(' '),
    }));
    dit(filtres.min === '' && filtres.max === '', 'un filtre « Prix min / max » n\'est jamais pris pour le champ prix',
      'min=« ' + filtres.min + ' » max=« ' + filtres.max + ' » : le prix de sa paire écrit dans un filtre de recherche');
    dit(/Aucun champ reconnu/i.test(filtres.toast), 'et sur une page sans formulaire, il le DIT et copie le texte',
      'annoncer « rempli » sur une page où rien n\'a été fait est le défaut du bandeau eBay');
    await p3.close();
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nLe panneau Leboncoin dit ce qu\'il sait, et seulement ce qu\'il sait.');
  process.exit(ko ? 1 : 0);
})();
