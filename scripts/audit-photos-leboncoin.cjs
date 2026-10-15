// Audit : les photos Leboncoin dans VRM (15 octobre).
// node scripts/audit-photos-leboncoin.cjs   [--mutation <nom>]   [--src <chemin d'un arbre>]
//
// Julien, 15 octobre : « Leboncoin : j'ai beau actualiser la page, les photos
// des annonces n'apparaissent pas ». Mesuré sur sa base : les photos sont des
// chaînes `https://img.leboncoin.fr/…?rule=ad-image` (1 071 sur 1 071, sans
// signature), rendues par un `<img>` ordinaire — référent compris, AUCUN
// secours ; et 15 transactions sur 16 sans `image`, alors que la liste des
// transactions porte `[].item.thumbnail_url` et que l'annonce de chaque vente
// est captée avec ses photos.
//
// Il EXÉCUTE (il ne relit pas l'orthographe) :
//   1. le VRAI `background.js` (vm, `_fond-vm.cjs`) : son pont « photo » lit
//      `img.leboncoin.fr` — et RIEN d'autre (ni `www.`/`api.leboncoin.fr`, ni
//      un nom qui l'imite, ni `http:`) : une adresse refusée ne déclenche aucun
//      téléchargement ; Vinted reste lu ;
//   2. le VRAI `extraireVentesLbc` : la liste v3 garde la photo
//      (`item.thumbnail_url`), le détail v2 aussi (`item.thumb_url`) ;
//   3. la VRAIE règle `src/photosLeboncoin.js` (vm, horloge pilotée) : l'hôte
//      exact ; la photo d'une transaction = la sienne, sinon celle de SON
//      annonce par l'IDENTIFIANT — jamais une autre annonce au même titre (§5) ;
//      le secours n'est demandé qu'une fois par photo, au plus 3 à la fois ;
//      un SVG n'est jamais accepté ; rien n'est figé (recul, `reprendre`) ;
//   4. l'ordre des attributs (Babel) : tout `<img>` qui coupe le référent le
//      pose AVANT `src` — mesuré au banc : une photo déjà en cache mémoire se
//      recharge dès que `src` est posé, avec le référent par défaut.
// Un audit ne meurt pas, il rapporte (`essaie`).
const fs = require('fs'), path = require('path'), vm = require('vm');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const R = opt('--src') ? path.resolve(opt('--src')) : path.join(__dirname, '..');
const MUTATION = opt('--mutation') || '';
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? '\n   ' + d : '')); };
const dit = (c, m, d) => (c ? ok(m) : nok(m, d));
const essaie = async (nom, f) => { try { await f(); } catch (e) { nok(nom + ' — le contrôle a pu s’exécuter', String(e && e.stack || e).split('\n').slice(0, 2).join(' | ').slice(0, 240)); } };

// ── Mutations : la règle RÉAFFAIBLIE doit faire passer des contrôles au rouge ──
const MUTER_FOND = {
  // tout leboncoin.fr passe le pont (www, api…)
  'hote-large': (s) => s.replace('/^https:\\/\\/img\\.leboncoin\\.fr\\//i.test(u)', '/^https:\\/\\/[\\w.-]*leboncoin\\.fr\\//i.test(u)'),
  // la liste v3 jette de nouveau la photo
  'liste-sans-image': (s) => s.replace('      image: imageDeVente(t),\n    }).filter((x) => x && x.txId);', '    }).filter((x) => x && x.txId);'),
};
const MUTER_MODULE = {
  // la photo d'une transaction prise à une annonce au MÊME TITRE (§5)
  'titre': (s) => s.replace("  if (!ad || typeof ad !== 'object' || String(ad.id) !== id) return null;\n",
    "  const parTitre = Object.values(items).find((a) => a && a.subject && o.title && a.subject === o.title);\n  if (parTitre && !ad) return premiere(parTitre.images);\n  if (!ad || typeof ad !== 'object' || String(ad.id) !== id) return null;\n"),
  // un SVG accepté en secours
  'svg': (s) => s.replace('/^data:image\\/(?:jpeg|jpg|png|webp|gif|avif);base64,/i', '/^data:image\\/[\\w.+-]+;base64,/i'),
  // une photo perdue reste perdue (plus de recul)
  'fige': (s) => s.replace("  if (e.etat === 'perdue' && deps.maintenant() - e.koAt >= recul(e.n)) { e.etat = 'natif'; notifier(e); }\n", ''),
  // plus de borne : tout part en même temps
  'sans-borne': (s) => s.replace('  while (enVol < MAX_EN_VOL && file.length) {', '  while (file.length) {'),
};
const MUTER_APP = {
  // le référent repart : `src` posé avant l'interdiction
  'ordre': (s) => s.replace('<img referrerPolicy="no-referrer" loading={loading || \'lazy\'} src={src} style={style} {...reste} data-photo-lbc="natif"',
    '<img src={src} referrerPolicy="no-referrer" loading={loading || \'lazy\'} style={style} {...reste} data-photo-lbc="natif"'),
};
if (MUTATION && !MUTER_FOND[MUTATION] && !MUTER_MODULE[MUTATION] && !MUTER_APP[MUTATION]) {
  console.log('mutation inconnue : ' + MUTATION + ' — ' + [...Object.keys(MUTER_FOND), ...Object.keys(MUTER_MODULE), ...Object.keys(MUTER_APP)].join(', ')); process.exit(2);
}
const muter = (table, src) => {
  if (!table[MUTATION]) return src;
  const apres = table[MUTATION](src);
  if (apres === src) { console.log('⚠️ la mutation « ' + MUTATION + ' » ne s’applique pas (le code a changé ?) — rien n’est prouvé'); process.exit(2); }
  return apres;
};

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const IMG = (k, rule = 'ad-image') => `https://img.leboncoin.fr/api/v1/lbcpb1/images/0${k}/a${k}/b${k}/${String(k).repeat(40).slice(0, 40)}.jpg?rule=${rule}`;

(async () => {
  // ══ 1 et 2. Le VRAI fond de l'extension ══════════════════════════════════
  await essaie('fond', async () => {
    const { faireFond } = require(path.join(R, 'scripts', '_fond-vm.cjs'));
    const chemin = path.join(R, 'vinted-sync-extension', 'background.js');
    let src = fs.readFileSync(chemin, 'utf8');
    src = muter(MUTER_FOND, src);
    const tmp = path.join(require('os').tmpdir(), `audit-photos-lbc-${process.pid}.js`);
    fs.writeFileSync(tmp, src);
    const fond = faireFond({ src: tmp });
    fs.rmSync(tmp, { force: true });
    const lues = [];
    const orig = fond.ctx.fetch;
    fond.ctx.fetch = async (u, o) => {
      const s = String(u);
      if (/^https?:\/\/[^/]*(leboncoin|vinted)/.test(s) && !/\/rest\/v1\//.test(s)) {
        lues.push(s);
        return { ok: true, status: 200, headers: { get: () => 'image/png' }, arrayBuffer: async () => PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.byteLength) };
      }
      return orig(u, o);
    };
    const demande = (url) => fond.envoyer({ from: 'vmr-bridge', action: 'photo', url });
    // L'hôte mesuré : lu, une fois, rendu en image.
    lues.length = 0;
    const r1 = await demande(IMG(1));
    dit(!!(r1 && r1.ok && /^data:image\/png;base64,/.test(r1.dataUrl || '')) && lues.length === 1,
      '1. le pont « photo » lit une photo de `img.leboncoin.fr` (une lecture, rendue en image)', JSON.stringify({ r1: r1 && { ok: r1.ok, error: r1.error }, lues }));
    // Vinted, toujours.
    lues.length = 0;
    const rv = await demande('https://images1.vinted.net/t/abc/f800/1760000001.jpeg?s=sig');
    dit(!!(rv && rv.ok) && lues.length === 1, '1. le CDN de Vinted reste lu');
    // Tout le reste : refusé, AUCUN téléchargement.
    const refusees = ['https://www.leboncoin.fr/ad/chaussures/1.jpg', 'https://api.leboncoin.fr/api/shippingproxy/v1/parcels/1/label',
      'https://img.leboncoin.fr.evil.test/x.jpg', 'http://img.leboncoin.fr/x.jpg', 'https://evil.test/https://img.leboncoin.fr/x.jpg',
      'https://eimg.leboncoin.fr/x.jpg', 'https://imgleboncoin.fr/x.jpg'];
    const passees = [];
    for (const u of refusees) { lues.length = 0; const r = await demande(u); if ((r && r.ok) || lues.length) passees.push(u); }
    dit(passees.length === 0, `1. aucun autre hôte ne passe le pont « photo » (${refusees.length} essayés : www, api, imitations, http)`, passees.join(' · '));

    // 2. La liste v3 et le détail v2 gardent la photo.
    const liste = [{ id: { purchase_id: 71001 }, item: { title: 'Paire banc', price: 2928, thumbnail_url: IMG(2, 'ad-thumb') }, created_at: '2026-10-01T10:00:00Z', step: { status: 'validation' } }];
    const sortie = fond.ctx.extraireVentesLbc('https://api.leboncoin.fr/api/consumergoods/proxy/v3/pages/transactions', JSON.stringify(liste));
    dit(Array.isArray(sortie) && sortie[0] && sortie[0].image === IMG(2, 'ad-thumb'),
      '2. la LISTE des transactions garde la photo (`item.thumbnail_url`, mesuré dans `lbc_recon.schemas`)', JSON.stringify(sortie));
    const detail = { item: { id: 9100000003, title: 'Paire banc', thumb_url: IMG(3, 'ad-thumb'), prices: { final: 2500 } }, is_seller: true, step: { status: 'action', label: 'Colis à envoyer' } };
    const sd = fond.ctx.extraireVentesLbc('https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/71001', JSON.stringify(detail));
    dit(Array.isArray(sd) && sd[0] && sd[0].image === IMG(3, 'ad-thumb'), '2. le DÉTAIL d’une transaction garde la photo (`item.thumb_url`)', JSON.stringify(sd));
    const sansPhoto = fond.ctx.extraireVentesLbc('https://api.leboncoin.fr/api/consumergoods/proxy/v3/pages/transactions', JSON.stringify([{ id: { purchase_id: 71002 }, item: { title: 'Sans photo' }, step: 'validation' }]));
    dit(Array.isArray(sansPhoto) && sansPhoto[0] && !sansPhoto[0].image, '2. une transaction sans photo n’en reçoit pas d’inventée', JSON.stringify(sansPhoto));
  });

  // ══ 3. La règle `src/photosLeboncoin.js` ══════════════════════════════════
  await essaie('règle', async () => {
    let code = fs.readFileSync(path.join(R, 'src', 'photosLeboncoin.js'), 'utf8');
    code = muter(MUTER_MODULE, code);
    let t = 1_000_000_000_000;
    const ecouteurs = {};
    const ctx = { console, Math, JSON, Promise, Map, Set, Object, Array, String, Number, RegExp, Error,
      window: { addEventListener: (n, f) => { (ecouteurs[n] = ecouteurs[n] || []).push(f); } } };
    ctx.globalThis = ctx;
    const noms = [];
    const src = code.replace(/^export (const|function|async function|let) ([A-Za-z_$][\w$]*)/gm, (m, k, n) => { noms.push(n); return `${k} ${n}`; })
      + `\n;globalThis.__m = { ${noms.join(', ')} };`;
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: 'photosLeboncoin.js' });
    const m = ctx.__m;
    const vider = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

    // L'hôte exact.
    const oui = [IMG(1), 'https://IMG.leboncoin.fr/api/v1/x.jpg'];
    const non = ['https://www.leboncoin.fr/x.jpg', 'https://img.leboncoin.fr.evil.test/x.jpg', 'http://img.leboncoin.fr/x.jpg', 'https://eimg.leboncoin.fr/x.jpg', 'https://images1.vinted.net/t/a/f800/1.jpeg', '', null];
    dit(oui.every((u) => m.estPhotoLbc(u)) && non.every((u) => !m.estPhotoLbc(u)), '3. la règle ne reconnaît que `img.leboncoin.fr` (https)');

    // La photo d'une transaction : la sienne, sinon celle de SON annonce.
    const items = {
      '9100000003': { id: '9100000003', subject: 'Paire vendue', images: [IMG(5), IMG(6)] },
      '9100000009': { id: '9100000009', subject: 'Achat sans photo', images: [IMG(9)] },
      '9100000777': { id: '9100000666', subject: 'Clé et id différents', images: [IMG(7)] },
    };
    dit(m.photoTransactionLbc({ itemId: '9100000003', image: IMG(4) }, items) === IMG(4), '3. une transaction qui a sa photo garde la sienne');
    dit(m.photoTransactionLbc({ itemId: '9100000003', title: 'Paire vendue' }, items) === IMG(5), '3. sans photo : celle de SON annonce (même identifiant)');
    dit(m.photoTransactionLbc({ itemId: 9100000003 }, items) === IMG(5), '3. l’identifiant numérique désigne la même annonce');
    dit(m.photoTransactionLbc({ itemId: '9200000002', title: 'Achat sans photo' }, items) === null, '3. JAMAIS la photo d’une autre annonce au même titre (§5)');
    dit(m.photoTransactionLbc({ title: 'Achat sans photo' }, items) === null, '3. sans identifiant : rien (pas de rapprochement par le titre)');
    dit(m.photoTransactionLbc({ itemId: '9100000777' }, items) === null, '3. une annonce rangée sous une clé qui n’est pas SON identifiant ne compte pas');
    dit(m.photoTransactionLbc({ itemId: '9100000003' }, null) === null, '3. annonces pas lues : rien d’inventé');

    // Le secours : une demande par photo, au plus 3 à la fois, rien de figé.
    const demandes = []; const enAttente = [];
    let max = 0, vol = 0;
    m.configurer({
      maintenant: () => t,
      demander: (u) => { demandes.push(u); vol++; max = Math.max(max, vol); return new Promise((res) => enAttente.push((d) => { vol--; res(d); })); },
    });
    const urls = [1, 2, 3, 4, 5].map((k) => IMG(100 + k));
    const subs = urls.map((u) => m.monter(u, () => {}));
    urls.forEach((u) => { m.echecNatif(u); m.echecNatif(u); });
    await vider();
    dit(demandes.length === 3 && max <= 3, `3. au plus ${m.MAX_EN_VOL} demandes de secours à la fois, une par photo (${demandes.length} en vol)`, JSON.stringify({ demandes: demandes.length, max }));
    const PNGDATA = 'data:image/png;base64,' + PNG.toString('base64');
    enAttente.shift()(PNGDATA); enAttente.shift()('data:image/svg+xml;base64,PHN2Zy8+'); enAttente.shift()(null);
    await vider();
    dit(m.etat(urls[0]) === 'ok' && m.donnees(urls[0]) === PNGDATA, '3. des octets d’image rendus ⇒ la photo s’affiche par le secours');
    dit(m.etat(urls[1]) === 'perdue', '3. un SVG n’est jamais accepté (il s’exécuterait dans l’origine de l’app)');
    dit(m.etat(urls[2]) === 'perdue', '3. aucun octet ⇒ « perdue » (le pictogramme), jamais une case cassée');
    dit(demandes.length === 5, '3. la file continue : les deux suivantes sont demandées', String(demandes.length));
    while (enAttente.length) enAttente.shift()(null);
    await vider();
    dit(demandes.filter((u) => u === urls[0]).length === 1, '3. une photo déjà demandée ne l’est pas deux fois');
    // Rien de figé : remontée après son recul, elle retente sa chance.
    const sub2 = m.monter(urls[2], () => {});
    dit(m.etat(urls[2]) === 'perdue', '3. remontée AVANT son recul : elle attend (pas de rafale)');
    t += m.RECUL_MS + 1;
    m.monter(urls[2], () => {});
    dit(m.etat(urls[2]) === 'natif', '3. remontée APRÈS son recul : elle retente (le navigateur d’abord)');
    m.reprendre();
    dit(m.etat(urls[3]) === 'natif' && m.etat(urls[4]) === 'natif', '3. un signal neuf (réseau, extension) : toutes les perdues retentent');
    dit(Array.isArray(ecouteurs.online) && ecouteurs.online.length > 0, '3. le retour du réseau (`online`) les relance');
    subs.forEach((f) => f()); sub2();
  });

  // ══ 4. L'ordre des attributs : l'interdiction du référent AVANT `src` ═════
  await essaie('ordre', async () => {
    let parser, traverse;
    try {
      parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
      traverse = require(path.join(R, 'node_modules', '@babel', 'traverse')).default;
    } catch (e) { nok('l’analyseur Babel est disponible', e.message); return; }
    const fautifs = []; let vus = 0, lbc = 0;
    for (const f of fs.readdirSync(path.join(R, 'src')).filter((x) => /\.jsx?$/.test(x))) {
      let s = fs.readFileSync(path.join(R, 'src', f), 'utf8');
      if (f === 'App.jsx') {
        s = muter(MUTER_APP, s);
        lbc = (s.match(/data-photo-lbc="natif"/g) || []).length;
      }
      let ast; try { ast = parser.parse(s, { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { nok(`src/${f} se lit`, e.message); continue; }
      traverse(ast, {
        JSXOpeningElement(p) {
          if (p.node.name.type !== 'JSXIdentifier' || p.node.name.name !== 'img') return;
          const noms = p.node.attributes.map((a) => (a.type === 'JSXAttribute' && a.name ? a.name.name : '…'));
          const iR = noms.indexOf('referrerPolicy'), iS = noms.indexOf('src');
          if (iR < 0) return;
          vus++;
          if (iS >= 0 && iS < iR) fautifs.push(`src/${f}:${p.node.loc.start.line}`);
        },
      });
    }
    dit(lbc === 1, '4. les photos Leboncoin ont leur propre `<img>` sans référent (`PhotoLeboncoin`)', `${lbc} trouvé(s)`);
    dit(vus >= 2 && fautifs.length === 0, `4. tout <img> qui coupe le référent le pose AVANT \`src\` (${vus} vus)`, fautifs.join(' · '));
  });

  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
