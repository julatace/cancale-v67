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
  <main>${depot === 'etape2'
    ? '<label for="s2">Titre de l’annonce</label><input id="s2" name="subject" type="text">'
      + '<label for="d2">Description</label><textarea id="d2" name="body"></textarea>'
      + '<label for="p2">Prix</label><input id="p2" name="price_cents" type="text">'  // ⚠️ la VRAIE forme mesurée : le champ est en CENTIMES (lbc_recon.etapes, 19 sept.)
      + '<label for="c2">Catégorie</label><select id="c2" name="category"><option value=""></option><option value="1">Vêtements</option><option value="2">Chaussures</option><option value="3">Sacs à main</option></select>'
      + '<label for="e2">État</label><select id="e2" name="condition"><option value=""></option><option value="1">Neuf</option><option value="2">Très bon état</option><option value="3">Satisfaisant</option></select>'
      + '<label for="f2">Photos</label><input id="f2" name="images" type="file" multiple accept="image/*">'
    : depot
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
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(PAGE(/etape2/.test(q.url) ? 'etape2' : /depot/.test(q.url))); });
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

  // ── « JAMAIS LU » N'EST PAS « ZÉRO », ET LA NOUVELLE SOURCE DOIT MARCHER ──
  // Mesuré le 12 septembre : `lbc_listings` et `lbc_accounts` sont ABSENTES de sa
  // base alors que `lbc_recon` existe depuis le 2 août. Or le compte Leboncoin se
  // lit sur n'importe quelle page dès que `__NEXT_DATA__` est là : s'il n'a jamais
  // été écrit, c'est que cet élément n'existe plus. La capture était donc morte,
  // et le panneau annonçait « 📊 0 annonce sur Leboncoin » — un zéro inventé qui
  // cachait que « vendue sur Vinted → à retirer » ne pouvait pas fonctionner.
  {
    const p4 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const e4 = []; p4.on('pageerror', (e) => e4.push(e.message));
    let capture = null;
    await p4.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    let recu = null;
    await p4.exposeFunction('__banc_capture', (o) => { capture = o; });
    // ⚠️ ET ON VÉRIFIE QUE LA VRAIE CAPTURE PASSE TOUJOURS : mon diagnostic
    //    réutilisait d'abord le nom `lbcCapture`, et il aurait avalé les annonces.
    await p4.exposeFunction('__banc_listings', (o) => { recu = o; });
    await p4.addInitScript((d) => {
      // Une page SANS `__NEXT_DATA__` : le format actuel de Leboncoin, où les
      // données arrivent en morceaux dans `self.__next_f`.
      self.__next_f = [
        [1, '{"buildId":"x"}'],
        [1, 'a:["$","div",null,{"children":{"list_id":"2837465","subject":"Salomon XT-6 blanc T40","price":[99],"body":"Réf. VRM-401 — très bon état","url":"https://www.leboncoin.fr/ad/2837465","status":"active","owner":{"user_id":"77","name":"Cancale"}}}]'],
      ];
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'lbcDiag') { try { window.__banc_capture(m); } catch (_) {} return rep({ ok: true }); }
        if (m && m.action === 'lbcCapture') { try { window.__banc_listings(m); } catch (_) {} return rep({ ok: true }); }
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: { onlineCount: 3, numberedCount: 3, postedCount: 0, lbcCount: 0, lbcJamaisLu: true } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { queue: QUEUE });
    await p4.goto('http://localhost:4491/', { waitUntil: 'domcontentloaded' });
    await p4.addScriptTag({ content: SRC });
    await p4.waitForTimeout(1100);
    const f4 = await p4.$('[data-a="open"]'); if (f4) { await f4.click(); await p4.waitForTimeout(500); }
    const t4 = await p4.evaluate(() => [...document.querySelectorAll('*')].map(e => e.shadowRoot).filter(Boolean).map(r => r.textContent || '').join(' '));
    dit(!e4.length, 'aucune erreur sur une page au nouveau format', e4[0] || '');
    // 1. La nouvelle source est lue.
    dit(!!capture, 'la capture REMONTE ce qu\'elle a vu', capture ? '' : 'sans ça, « 0 annonce » et « rien pu lire » sont le même silence');
    if (capture) {
      dit(capture.source === 'next_f', 'elle lit le format actuel (données en morceaux)', 'source : ' + capture.source);
      dit(capture.vues >= 1, 'et elle y retrouve bien une annonce', capture.vues + ' vue(s)');
      dit(capture.a_next_data === false && capture.a_next_f === true,
        'elle dit quel format porte la page', `__NEXT_DATA__:${capture.a_next_data} · __next_f:${capture.a_next_f}`);
    }
    // 2. Et tant que rien n'a été capté, aucun zéro inventé.
    dit(!/0\s*annonces?\s*sur Leboncoin/i.test(t4), 'aucun « 0 annonce sur Leboncoin » quand rien n\'a été lu',
      'un zéro inventé cache que « vendue → à retirer » ne peut pas fonctionner');
    dit(/pas encore vu tes annonces/i.test(t4), 'il dit qu\'il n\'a pas encore vu ses annonces');
    dit(/lesquelles retirer/i.test(t4), 'et ce que ça empêche', 'une alerte qui ne dit pas ce qu\'on perd ne sert à rien');
    dit(!!recu && Array.isArray(recu.listings) && recu.listings.length >= 1,
      'et la VRAIE capture des annonces part toujours vers le fond',
      recu ? (recu.listings || []).length + ' annonce(s) transmise(s)' : 'aucun message `lbcCapture` : le diagnostic a pris sa place');
    await p4.close();
  }

  // ── « 🚀 TOUT PRÉPARER » : LE BOUTON PRINCIPAL, JAMAIS EXÉCUTÉ ─────────────
  // C'est le geste que l'app lui dit de faire (« bouton 🚀 Tout préparer »), et
  // il n'avait jamais tourné. Il doit faire QUATRE choses, et chacune compte :
  // télécharger les photos, copier le texte complet, MÉMORISER la paire choisie
  // (sinon le nouvel onglet ne sait pas laquelle remplir) et ouvrir la page de
  // dépôt.
  {
    const p5 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const e5 = []; p5.on('pageerror', (e) => e5.push(e.message));
    const vus = { photos: null, pending: null, ouvert: null, copie: null };
    await p5.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await p5.exposeFunction('__banc_msg', (m) => {
      if (m.action === 'downloadPhotos') vus.photos = m;
      if (m.action === 'setPending') vus.pending = m;
    });
    await p5.exposeFunction('__banc_open', (u) => { vus.ouvert = u; });
    await p5.exposeFunction('__banc_copy', (t) => { vus.copie = t; });
    await p5.addInitScript((d) => {
      window.open = (u) => { try { window.__banc_open(String(u)); } catch (_) {} return null; };
      // ⚠️ ON SERT LE CAS QUI ÉCHOUE : `navigator.clipboard.writeText` rend une
      //    promesse REJETÉE (document pas au premier plan, permission refusée).
      //    C'est exactement le cas où l'ancien code ne copiait rien tout en
      //    annonçant « copié » — un `try/catch` n'attrape pas un rejet.
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: () => Promise.reject(new Error('NotAllowed')),
      } });
      document.execCommand = function () { try { const ta = document.querySelector('textarea'); window.__banc_copy(ta ? ta.value : ''); } catch (_) {} return true; };
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        try { window.__banc_msg(m); } catch (_) {}
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: { onlineCount: 3, numberedCount: 3, postedCount: 2, lbcCount: 2 } });
        if (m && m.action === 'downloadPhotos') return rep({ ok: true, count: (m.urls || []).length });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { queue: QUEUE });
    await p5.goto('http://localhost:4491/', { waitUntil: 'domcontentloaded' });
    await p5.addScriptTag({ content: SRC });
    await p5.waitForTimeout(1000);
    const f5 = await p5.$('[data-a="open"]'); if (f5) { await f5.click(); await p5.waitForTimeout(500); }
    // On prépare la paire qui a TROIS photos (celle des « prêtes »).
    const idPrepare = await p5.evaluate(() => {
      const rs = [...document.querySelectorAll('*')].map(e => e.shadowRoot).filter(Boolean);
      for (const r of rs) {
        for (const c of r.querySelectorAll('.card')) {
          if (c.getAttribute('data-id') === '1001') { const b2 = c.querySelector('[data-a="prepare"]'); if (b2) { b2.click(); return '1001'; } }
        }
      }
      return null;
    });
    dit(idPrepare === '1001', 'le bouton « Tout préparer » existe sur la carte voulue');
    await p5.waitForTimeout(900);
    dit(!e5.length, 'aucune erreur pendant « Tout préparer »', e5[0] || '');
    // ⚠️ CES DEUX CONTRÔLES EXIGEAIENT LE TÉLÉCHARGEMENT — le comportement que
    //    Julien a signalé (« ça me fait télécharger des photos dans mon ordi »)
    //    et que j'ai retiré. Un contrôle qui garde l'ancienne règle rend le
    //    correctif rouge : c'est la règle NOUVELLE qu'il doit mesurer.
    dit(!vus.photos, '« Tout préparer » ne télécharge RIEN sur son ordinateur',
      vus.photos ? 'il a demandé ' + (vus.photos.urls || []).length + ' téléchargement(s)' : 'les photos partiront par le formulaire');
    // ⚠️ CELUI-CI EST LE PLUS IMPORTANT : sans la paire mémorisée, le nouvel
    //    onglet ne sait pas laquelle remplir — c'est le défaut qui obligeait à
    //    tout recoller à la main.
    dit(!!vus.pending && vus.pending.ad && vus.pending.ad.numero === '401',
      'il MÉMORISE la paire choisie pour le nouvel onglet',
      vus.pending ? '' : 'sans ça, la page de dépôt s\'ouvre sans savoir quoi remplir');
    dit(/leboncoin\.fr\/deposer-une-annonce/.test(String(vus.ouvert || '')), 'et il ouvre la page de dépôt',
      'ouvert : ' + String(vus.ouvert || 'rien'));
    // Le texte copié doit porter la RÉFÉRENCE : c'est le seul filet quand le
    // formulaire n'a pas de champ pour elle (mesuré : il n'en a pas).
    dit(/VRM-401/.test(String(vus.copie || '')), 'le presse-papier refusé retombe sur l\'ancienne méthode, et le texte porte VRM-401',
      'c\'est elle qui relie l\'annonce à la paire — sans elle, plus de retrait automatique');
    dit(/TITRE|DESCRIPTION|PRIX/.test(String(vus.copie || '')), 'et il est complet (titre, description, prix)');
    await p5.close();
  }

  // ── LES PHOTOS S'ATTACHENT, ET LA CATÉGORIE SE CHOISIT ────────────────────
  // ⚠️⚠️ LE DOSSIER AFFIRMAIT QUE C'ÉTAIT IMPOSSIBLE, ET C'ÉTAIT FAUX (je
  // l'avais écrit). Ce qui est interdit c'est `input.value = '/chemin/…'` ;
  // `input.files = dataTransfer.files` marche. Mesuré dans Chromium, puis ici
  // sur le VRAI `lbc.js`. Julien : « ça me fait télécharger des photos dans mon
  // ordi ça ne met pas la catégorie ni le reste » — les deux sont traités.
  {
    const p6 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const e6 = []; p6.on('pageerror', (e) => e6.push(e.message));
    let telechargements = 0;
    await p6.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await p6.addInitScript((d) => {
      const JPEG = 'ffd8ffe000104a46494600010100000100010000ffd9';
      const b64 = (() => { const bin = JPEG.match(/../g).map(h => String.fromCharCode(parseInt(h, 16))).join(''); return btoa(bin); })();
      window.__dl = 0;
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
        if (m && m.action === 'photoBytes') return rep({ ok: true, photos: (m.urls || []).map((u) => ({ url: u, b64, type: 'image/jpeg', taille: 22 })) });
        if (m && m.action === 'downloadPhotos') { window.__dl++; return rep({ ok: true, count: 0 }); }
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: [d.ad], removals: [], unlinked: [], postedList: [], stats: { onlineCount: 1, numberedCount: 1 } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { ad: QUEUE[0] });
    await p6.goto('http://localhost:4491/depot/etape2', { waitUntil: 'domcontentloaded' });
    await p6.addScriptTag({ content: SRC });
    await p6.waitForTimeout(2600);           // la surveillance tourne à la seconde
    const etat = await p6.evaluate(() => ({
      photos: (document.querySelector('input[name="images"]') || {}).files ? document.querySelector('input[name="images"]').files.length : -1,
      noms: document.querySelector('input[name="images"]') ? [...document.querySelector('input[name="images"]').files].map(f => f.name + ':' + f.type) : [],
      categorie: (document.querySelector('select[name="category"]') || {}).value || '',
      catTexte: (() => { const s2 = document.querySelector('select[name="category"]'); return s2 && s2.selectedIndex >= 0 ? s2.options[s2.selectedIndex].textContent : ''; })(),
      etatSel: (() => { const s2 = document.querySelector('select[name="condition"]'); return s2 && s2.selectedIndex >= 0 ? s2.options[s2.selectedIndex].textContent : ''; })(),
      titre: (document.querySelector('input[name="subject"]') || {}).value || '',
      prix: (document.querySelector('input[name="price_cents"]') || {}).value || '',
      desc: (document.querySelector('textarea[name="body"]') || {}).value || '',
      dl: window.__dl,
      bandeau: (document.getElementById('vrm-lbc-banner') || {}).innerText || '',
    }));
    dit(!e6.length, 'aucune erreur sur la page de dépôt', e6[0] || '');
    dit(etat.photos === 3, 'les 3 photos sont ATTACHÉES au champ fichier',
      etat.photos + ' fichier(s) — ' + (etat.noms[0] || 'aucun'));
    dit(/^VRM-401-1\.jpg:image\/jpeg$/.test(etat.noms[0] || ''), 'et elles portent le nom de la paire et le bon type',
      etat.noms[0] || 'aucun');
    dit(etat.dl === 0, 'RIEN n\'est téléchargé sur son ordinateur',
      etat.dl ? 'il y a eu ' + etat.dl + ' téléchargement(s) : c\'est ce dont il se plaint' : '');
    dit(/Chaussures/.test(etat.catTexte || ''), 'la CATÉGORIE est choisie', 'choisi : « ' + etat.catTexte + ' »');
    dit(/état/i.test(etat.etatSel || ''), 'et l\'état aussi', 'choisi : « ' + etat.etatSel + ' »');
    dit(etat.titre === QUEUE[0].title && !!etat.prix && !!etat.desc, 'titre, prix et description sont remplis',
      'titre « ' + etat.titre.slice(0, 24) + ' » · prix ' + etat.prix);
    // ⚠️⚠️ LE CHAMP `price_cents` ATTEND DES CENTIMES. Mesuré le 19 septembre :
    //    l'ancien code posait 99 → Leboncoin affichait 0,99 €. Le prix (99,00 €)
    //    doit devenir 9900, en ENTIER. C'est le nom du champ qui porte l'unité.
    const attenduCents = String(Math.round(Number(QUEUE[0].price) * 100));
    dit(etat.prix === attenduCents, 'le prix est posé en CENTIMES (99,00 € → 9900), pas en euros dans un champ _cents',
      'champ price_cents = « ' + etat.prix +' » (attendu ' + attenduCents + ')');
    // Le bandeau écrit le CHIFFRE, jamais « c'est prêt ».
    dit(/3 photos attachées/.test(etat.bandeau), 'le bandeau écrit combien de photos ont été attachées',
      (etat.bandeau || '').replace(/\n/g, ' ').slice(0, 90));
    await p6.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LEBONCOIN ÉCRIT PARFOIS LA DESCRIPTION LUI-MÊME (Julien, 19 sept.)
  // ══════════════════════════════════════════════════════════════════════════
  // On ne l'écrase JAMAIS — mais la référence VRM-{n°} doit y être (§5). Le banc
  // pré-remplit la description AVANT que l'extension tourne (comme le ferait
  // l'auto-remplissage de Leboncoin), sans la référence, et exige les deux :
  // le texte de Leboncoin est GARDÉ, et la référence a été AJOUTÉE.
  {
    const pd = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const ed = []; pd.on('pageerror', (e) => ed.push(e.message));
    await pd.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await pd.addInitScript((d) => {
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
        if (m && m.action === 'photoBytes') return rep({ ok: true, photos: [] });
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: [d.ad], removals: [], unlinked: [], postedList: [], stats: { onlineCount: 1, numberedCount: 1 } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { ad: QUEUE[0] });
    await pd.goto('http://localhost:4491/depot/etape2', { waitUntil: 'domcontentloaded' });
    const AUTO = 'Superbe paire, taille 40, portée deux fois. Envoi rapide et soigné.';
    await pd.evaluate((txt) => {
      const el = document.querySelector('textarea[name="body"]');
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      set.call(el, txt); el.dispatchEvent(new Event('input', { bubbles: true }));
    }, AUTO);
    await pd.addScriptTag({ content: SRC });
    await pd.waitForTimeout(2600);
    const desc = await pd.evaluate(() => (document.querySelector('textarea[name="body"]') || {}).value || '');
    dit(desc.includes(AUTO), 'la description écrite par Leboncoin n\'est PAS écrasée',
      '« ' + desc.replace(/\n/g, ' ').slice(0, 70) + ' »');
    dit(/VRM-401/.test(desc), 'et la référence VRM-401 y est quand même AJOUTÉE (le lien vers la paire, §5)',
      /VRM-401/.test(desc) ? '' : 'la réf a disparu : « vendue → retire-la » ne reconnaîtra plus l\'annonce');
    dit(!ed.length, 'aucune erreur sur ce cas', ed[0] || '');
    await pd.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LES ÉTAPES DU DÉPÔT — le seul code qui puisse me donner la carte
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ CE CODE N'A JAMAIS TOURNÉ, ET C'EST UNE CHANCE UNIQUE. `lbc_recon.etapes`
  //    est absente de sa base : le jour où il fait UN dépôt à la main avec une
  //    extension à jour, soit l'enregistreur marche et j'ai la carte complète du
  //    formulaire (où vivent la catégorie, l'état, le champ photo), soit il ne
  //    marche pas et on ne le saura qu'après. §4.10.
  // ⚠️⚠️ ET IL NE POUVAIT PAS MARCHER : `captureDepositForm()` ne tournait que
  //    dans `load()` — au démarrage, au retour sur l'onglet, et quand l'ADRESSE
  //    change. Or un assistant remplace l'étape SUR PLACE. Les étapes 2, 3, 4…
  //    étaient donc invisibles : exactement ce pour quoi ce code existe.
  {
    const p7 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const e7 = []; p7.on('pageerror', (e) => e7.push(e.message));
    await p7.addInitScript((d) => {
      window.__formes = [];                      // tout ce qui part vers le fond
      // §6.3 dans mon propre banc : sans `getManifest`, l'extension ne peut pas
      // estampiller sa version et le contrôle sortait rouge sur un code intact.
      window.chrome = { runtime: { id: 'banc', lastError: null, getManifest: () => ({ version: '9.9.9' }), sendMessage: (m, cb) => {
        if (m && m.action === 'lbcForm') window.__formes.push(m);
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: {} });
        return rep({ ok: true });
      }, onMessage: { addListener() {} } } };
    }, { queue: QUEUE });
    await p7.goto('http://localhost:4491/depot', { waitUntil: 'domcontentloaded' });
    await p7.addScriptTag({ content: SRC });
    await p7.waitForTimeout(1400);
    const apres1 = await p7.evaluate(() => window.__formes.length);
    dit(apres1 >= 1, 'la première étape du dépôt est enregistrée', apres1 + ' étape(s)');

    // L'ÉTAPE SUIVANTE, comme le fait Leboncoin : on remplace le contenu du
    // formulaire SANS toucher à l'adresse.
    // ⚠️⚠️ ET CETTE ÉTAPE-CI N'A **AUCUN `<select>` NATIF** — c'est le point que
    //    Julien a soulevé (« c'est différent pour chaque annonce ») poussé au
    //    bout : Leboncoin est une application React, ses listes sont des
    //    COMPOSANTS (`role="combobox"` + `role="listbox"`). Servir un vrai
    //    `<select>` rendait le banc VERT sur le défaut — on rapportait « 0
    //    liste », donc ni catégorie, ni état, ni pointure : exactement ce qu'on
    //    vient chercher. §6.3, sur la forme de la PAGE cette fois.
    await p7.evaluate(() => {
      document.querySelector('main').innerHTML =
        '<nav aria-label="Fil d\u2019ariane">Accueil › Mode › Chaussures</nav>'
        + '<label for="p2">Prix</label><input id="p2" name="price" type="text">'
        + '<span id="lblcat">Catégorie</span>'
        + '<div role="combobox" aria-labelledby="lblcat" aria-haspopup="listbox" aria-controls="listecat" data-qa-id="category_picker">Chaussures</div>'
        + '<div id="listecat" role="listbox"><div role="option">Vêtements</div><div role="option">Chaussures</div><div role="option">Sacs</div></div>'
        + '<label for="f2">Photos</label><input id="f2" name="images" type="file" multiple>';
    });
    await p7.waitForTimeout(1800);
    const etapes = await p7.evaluate(() => window.__formes.map((m) => ({
      etape: m.etape, champs: (m.fields || []).map((f) => f.name), selects: (m.selects || []).length, fichiers: m.fichiers,
      // Ce qui ne doit JAMAIS partir : une valeur saisie.
      valeurs: JSON.stringify(m).match(/"value"/g) || [],
    })));
    dit(etapes.length >= 2, 'une étape qui arrive SANS changer d’adresse est enregistrée aussi',
      etapes.length + ' étape(s) : ' + etapes.map((e) => e.champs.join('+')).join(' | '));
    dit(new Set(etapes.map((e) => e.etape)).size === etapes.length,
      'et chaque étape a sa propre signature — la suivante n’écrase pas la précédente',
      etapes.map((e) => String(e.etape).slice(0, 30)).join(' | '));
    const derniere = etapes[etapes.length - 1] || {};
    dit(derniere.selects >= 1 && derniere.fichiers >= 1,
      'l’étape rapporte les listes déroulantes ET le champ photo — c’est là que vivent la catégorie et les images',
      `${derniere.selects} liste(s), ${derniere.fichiers} champ(s) fichier`);
    // ⚠️ « C'EST DIFFÉRENT POUR CHAQUE ANNONCE » : sans la CATÉGORIE, un champ
    //    « Pointure » ne dit pas sur quel chemin il vit — et on le remplirait
    //    sur le formulaire d'un livre. Et sans le rang ni le dépôt, deux
    //    annonces se mélangent.
    const brut = await p7.evaluate(() => window.__formes[window.__formes.length - 1] || {});
    dit(/chaussure/i.test(String(brut.categorie || '')),
      'et elle DIT dans quelle catégorie elle a été vue', `catégorie : « ${String(brut.categorie || '').slice(0, 60) || '(vide)'} »`);
    dit(!!brut.depot && Number(brut.ordre) >= 2,
      'chaque étape porte son dépôt et son RANG — deux annonces ne se mélangent pas',
      `dépôt ${brut.depot || '—'} · étape n°${brut.ordre || '—'}`);
    const choisi = (brut.selects || []).map((x) => x.choisi).filter(Boolean).join(', ');
    dit(/chaussure/i.test(choisi), 'et la valeur CHOISIE dans la liste est rapportée', `choisi : « ${choisi || '(rien)'} »`);
    const formes = (brut.selects || []).map((x) => x.forme);
    dit(formes.includes('composant'), 'y compris quand la liste n’est PAS un `<select>` natif', `formes vues : ${formes.join(', ') || 'aucune'}`);
    const opts = (brut.selects || []).flatMap((x) => x.options || []);
    dit(opts.some((o) => /vêtements|sacs/i.test(o)), 'avec les options proposées', `${opts.length} option(s)`);

    // ⚠️⚠️ « LÀ C'EST SÛR ? » — il ne doit pas avoir à me croire. Le TÉMOIN écrit
    //    sur la page ce qui vient d'être enregistré : s'il lit « 0 liste », il
    //    arrête tout de suite au lieu de faire le dépôt entier pour rien.
    const temoin = await p7.evaluate(() => { const t = document.getElementById('vrm-temoin-etape'); return t ? t.innerText : ''; });
    dit(/étape\s*2/i.test(temoin), 'un témoin dit à l’écran QUELLE étape vient d’être enregistrée', `« ${temoin.replace(/\n/g, ' · ').slice(0, 90) }»`);
    dit(/2\s*listes?/i.test(temoin) && /champ photo/i.test(temoin), 'et il écrit les CHIFFRES — pas « c’est bon »');
    dit(/chaussure/i.test(temoin), 'et la catégorie qu’il a reconnue');

    // ⚠️⚠️ ET LE SHADOW DOM : une application moderne peut y enfermer son
    //    formulaire. `querySelectorAll` ne le traverse pas — on chercherait dans
    //    une page vide sans le savoir. Même « 0 liste » que les composants, mais
    //    SILENCIEUX.
    // ══════════════════════════════════════════════════════════════════════
    // ⚠️⚠️ LE BRUIT QU'IL A VRAIMENT RENCONTRÉ — SANS LUI, LE BANC EST VERT
    // ══════════════════════════════════════════════════════════════════════
    // Mesuré sur son VRAI dépôt du 17 septembre : sur trois étapes
    // enregistrées, deux ne portaient que `high-contrast-toggle`,
    // `search-header-mobile-input`, `search-header-extendable-input` et une
    // volée de champs cachés `id, ev, dl, rl, if, ts, iw, sw, sh, v, r`. Les
    // quatre « listes » étaient la barre de recherche (« Valider votre
    // recherche »). Le vrai formulaire n'a jamais été enregistré : le bruit
    // changeait la signature et consommait les places.
    // Le banc sert donc cet en-tête-là, avec le vrai formulaire dessous.
    await p7.evaluate(() => {
      document.body.insertAdjacentHTML('afterbegin',
        '<header role="banner"><input id="high-contrast-toggle" type="checkbox">'
        + '<form action="/recherche" role="search"><input name="search-header-mobile-input"><input name="search-header-extendable-input">'
        + '<div role="combobox" aria-label="rech">Valider votre recherche</div></form></header>'
        + '<input type="hidden" name="id"><input type="hidden" name="ev"><input type="hidden" name="dl"><input type="hidden" name="ts">');
      document.querySelector('main').innerHTML =
        '<label for="pr">Prix</label><input id="pr" name="price" type="text">'
        + '<span id="lbe">État</span><div role="combobox" aria-labelledby="lbe" aria-controls="le">Très bon état</div>'
        + '<div id="le" role="listbox"><div role="option" data-value="5">Neuf</div><div role="option" data-value="3">Très bon état</div></div>'
        + '<input name="photos" type="file">';
    });
    await p7.waitForTimeout(1800);
    const propre = await p7.evaluate(() => window.__formes[window.__formes.length - 1] || {});
    const noms = (propre.fields || []).map((f) => f.name || f.id);
    dit(!noms.some((n) => /high-contrast|search-header/.test(String(n))),
      'l’en-tête du site n’est PAS pris pour une étape du dépôt',
      `champs retenus : ${noms.join(', ') || 'aucun'}`);
    dit(!noms.some((n) => ['id', 'ev', 'dl', 'ts'].includes(String(n))),
      'ni les champs cachés de pistage');
    dit(noms.includes('price') && noms.includes('photos'),
      'et le VRAI formulaire est bien là', `champs : ${noms.join(', ')}`);
    const lbl = (propre.selects || []).map((x) => x.choisi).join(' ');
    dit(!/valider votre recherche/i.test(lbl) && /très bon état/i.test(lbl),
      'la barre de recherche n’est pas comptée comme une liste du dépôt', `listes : « ${lbl} »`);
    dit(!!propre.ver, 'et l’étape porte la VERSION de l’extension qui l’a écrite', `ver ${propre.ver || '—'}`);
    // ⚠️ Le CODE de chaque option (jamais capté avant) : Leboncoin soumet un
    //    code, pas le libellé. Sans lui la passe qui remplira Pointure/État ne
    //    peut que deviner. On relève le code réel de SA page.
    const codes = (propre.selects || []).flatMap((x) => x.optcodes || []);
    dit(codes.some((o) => o.t === 'Très bon état' && o.v === '3'),
      'et le CODE de chaque option est relevé (pas seulement son libellé)',
      `optcodes : ${codes.map((o) => o.t + '=' + (o.v || '∅')).join(', ') || 'aucun'}`);

    // La page de FIN n'est pas une étape : elle a fourni deux des trois étapes
    // enregistrées chez lui, et rien d'utilisable.
    const avantFin = await p7.evaluate(() => window.__formes.length);
    await p7.evaluate(() => { history.pushState({}, '', '/deposer-une-annonce/confirmation'); document.querySelector('main').innerHTML = '<input name="autre">'; });
    await p7.waitForTimeout(1800);
    const apresFin = await p7.evaluate(() => window.__formes.length);
    dit(apresFin === avantFin, 'la page de confirmation n’est pas enregistrée comme une étape',
      `${avantFin} → ${apresFin}`);
    await p7.evaluate(() => history.pushState({}, '', '/depot'));

    await p7.evaluate(() => {
      document.querySelector('main').innerHTML = '<div id="hote"></div>';
      const h = document.getElementById('hote').attachShadow({ mode: 'open' });
      h.innerHTML = '<span id="lbp">Pointure</span>'
        + '<div role="combobox" aria-labelledby="lbp" aria-controls="lp">42</div>'
        + '<div id="lp" role="listbox"><div role="option">41</div><div role="option">42</div></div>'
        + '<input name="shoe_size" type="text"><input name="photos" type="file">';
    });
    await p7.waitForTimeout(1800);
    const dansOmbre = await p7.evaluate(() => window.__formes[window.__formes.length - 1] || {});
    dit((dansOmbre.fields || []).some((f) => f.name === 'shoe_size'),
      'un formulaire enfermé dans le SHADOW DOM est vu quand même',
      `${(dansOmbre.fields || []).length} champ(s) : ${(dansOmbre.fields || []).map((f) => f.name).join(', ') || 'aucun'}`);
    dit((dansOmbre.selects || []).length >= 1 && (dansOmbre.fichiers || 0) >= 1,
      'et ses listes et son champ photo aussi',
      `${(dansOmbre.selects || []).length} liste(s), ${dansOmbre.fichiers} champ(s) fichier`);
    // ⚠️ La promesse écrite dans le code : « noms de champs et libellés
    //    d'options uniquement : AUCUN contenu saisi ». Elle n'avait jamais été
    //    vérifiée — et c'est une promesse de confidentialité.
    await p7.evaluate(() => { const i = document.querySelector('input[name="price"]'); if (i) { i.value = 'SECRET-42'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    await p7.waitForTimeout(1600);
    const fuite = await p7.evaluate(() => JSON.stringify(window.__formes).includes('SECRET-42'));
    dit(!fuite, 'et aucune valeur saisie ne part avec la structure');
    dit(!e7.length, 'aucune erreur pendant l’enregistrement des étapes', e7[0] || '');
    await p7.close();
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nLe panneau Leboncoin dit ce qu\'il sait, et seulement ce qu\'il sait.');
  process.exit(ko ? 1 : 0);
})();
