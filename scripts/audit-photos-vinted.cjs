// Audit : les photos du CDN de Vinted passent TOUTES par la règle
// (src/photosVinted.js + `PhotoVinted`), et la règle fait ce qu'elle dit.
// node scripts/audit-photos-vinted.cjs   [--mutation <nom>]   [--src <chemin d'un arbre>]
//
// Julien, 11 octobre : « je n'ai plus les photos de mes annonces, ni dans les
// bordereaux, ni dans les ventes ». Le CDN de Vinted (ou une protection locale)
// refuse l'affichage hors de son site ; la règle coupe le référent, demande les
// octets à l'extension, mesure la cause et la dit une fois.
//
// 1. LE GARDE-FOU DANS LE TEMPS (revue du 11 octobre, D7). Aucun audit ne
//    regardait les <img> : un `<img src={orderPhoto(o)}>` remis sur Achats ou Ma
//    journée n'aurait été vu par personne, et la photo serait repartie avec le
//    référent, sans secours, en image cassée. Ici : tout <img> JSX de src/ doit
//    être dans `PhotoVinted` (la règle) ou avoir une source qui ne PEUT PAS être
//    une photo Vinted — une liste FERMÉE, chaque entrée avec sa raison. Une
//    source inconnue est ROUGE par défaut.
// 2. LA RÈGLE EXÉCUTÉE (src/photosVinted.js chargé dans un `vm`, horloge,
//    réseau et extension simulés). Elle juge ce que la règle REND, jamais son
//    orthographe :
//    · un nom qui imite vinted.net ne passe pas, un SVG n'entre jamais en URL
//      objet (il s'exécuterait dans l'origine de l'app) ;
//    · UNE erreur réseau ne vaut pas « bloquée » : il en faut deux, espacées, sur
//      deux photos — une coupure passagère donne la même erreur que CORP ;
//    · un échec n'est pas figé : un témoin réessaie (20 s, puis ×2), l'événement
//      `online` relance tout, une photo remontée après une minute réessaie ;
//    · un DÉLAI de l'extension n'est pas un REFUS : la photo retourne en attente,
//      jamais « définitive », et la place reste prise jusqu'à la vraie réponse ;
//    · la phrase se juge sur ce qui est MONTÉ : une photo vue ailleurs dans la
//      session ne la fait pas taire ; une photo récupérée par l'extension à
//      l'écran, si (les autres sont des liens morts) ; « refusées dans VRM »
//      seulement si l'extension a récupéré des photos.
// Un audit ne meurt pas, il rapporte (`essaie`) : sur le code d'avant
// (c02ffcf), les fonctions absentes sont des contrôles ROUGES, pas une pile.
const fs = require('fs'), path = require('path'), vm = require('vm');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const R = opt('--src') ? path.resolve(opt('--src')) : path.join(__dirname, '..');
const MUTATION = opt('--mutation') || '';
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? '\n   ' + d : '')); };
const dit = (c, m, d) => (c ? ok(m) : nok(m, d));
const essaie = async (nom, f) => { try { await f(); } catch (e) { nok(nom + ' — le contrôle a pu s’exécuter', String(e && e.stack || e).split('\n').slice(0, 2).join(' | ').slice(0, 220)); } };

// ── Mutations : la règle RÉAFFAIBLIE doit faire passer des contrôles au rouge ──
// (« la fonction n'existait pas avant » n'est pas une preuve — §6.1).
const MUTER_MODULE = {
  // une seule erreur réseau suffit à dire « bloquée »
  'sonde-une': (s) => s.replace("if (r === 'erreur') {", "if (r === 'erreur') { r = 'bloquee'; } if (false) {"),
  // plus de témoin : un échec reste figé
  'sans-temoin': (s) => s.replace('function planifierTemoin() {', 'function planifierTemoin() { return;'),
  // un délai traité comme un refus
  'delai-refus': (s) => s.replace("if (r.issue === 'delai' || r.issue === 'absente') return { dataUrl: null, issue: 'delai' };", ''),
  // la phrase jugée sur la SESSION (une photo vue ailleurs la fait taire)
  'session': (s) => s.replace("if (okNatif > 0 && sonde !== 'bloquee')", "if (vus.okNatif.size > 0)"),
  // une photo récupérée par l'extension ne fait plus taire la phrase
  'secours-ignore': (s) => s.replace("if (okSecours > 0) return { parle: false, pourquoi: 'extension', ...compte };", ''),
  // « refusées dans VRM » sans que l'extension n'ait rien récupéré
  'cause-navigateur': (s) => s.replace("(vus.secoursOk.size > 0 ? 'navigateur' : 'injoignable')", "'navigateur'"),
  // l'ancienne règle d'adresse (un nom qui imite vinted.net passe)
  'regex': (s) => s.replace('/^https:\\/\\/(?:[a-z0-9-]+\\.)*vinted\\.net\\//i', '/^https:\\/\\/[\\w.-]*vinted\\.net\\//i'),
  // un SVG accepté en URL objet
  'svg': (s) => s.replace("if (/^image\\//.test(type) && !TYPES_IMAGE.test(type)) return null;", ''),
  // `online` ne relance rien
  'sans-online': (s) => s.replace("window.addEventListener('online',", "window.addEventListener('__jamais__',"),
  // une photo remontée après une minute ne réessaie pas
  'sans-remontage': (s) => s.replace("relancer(e, 'montage');", ''),
  // la cause n'est jamais remesurée sur l'écran qui échoue
  'sonde-figee': (s) => s.replace("  else if (sondeUrls.length && sondeUrls.every(", "  else if (false && sondeUrls.every("),
  // la remesure en changeant d'écran efface la phrase pendant 8 s (même cause)
  'scintille': (s) => s.replace("    if (r === 'erreur' && avant === 'bloquee') r = 'bloquee';\n    else if (r === 'erreur') {", "    if (r === 'erreur') {")
    .replace("  if (!avant) sonde = 'encours';", "  sonde = 'encours';"),
  // pendant la remesure, la cause d'avant reste même quand le premier essai la contredit
  'cause-perimee': (s) => s.replace("    else if (r === 'erreur') {\n      sonde = 'encours';", "    else if (r === 'erreur') {"),
  // le bilan part pendant la mesure
  'bilan-tot': (s) => s.replace("if (sondeEnCours || sonde === 'encours') { bilanTimer = setTimeout(envoyerBilan, 2000); return; }", ''),
};
const MUTER_APP = {
  // un <img> brut remis sur une photo de vente
  'img-brut': (s) => s.replace('function PhotosBloquees() {', 'function __Regression({ o }) { return <img src={orderPhoto(o)} alt=""/>; }\nfunction PhotosBloquees() {'),
};
if (MUTATION && !MUTER_MODULE[MUTATION] && !MUTER_APP[MUTATION]) { console.log('mutation inconnue : ' + MUTATION + ' — ' + [...Object.keys(MUTER_MODULE), ...Object.keys(MUTER_APP)].join(', ')); process.exit(2); }

(async () => {
  // ══ 1. Tout <img> de src/ passe par la règle ══════════════════════════════
  await essaie('<img> de src/', async () => {
    let parser, traverse;
    try {
      parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser'));
      traverse = require(path.join(__dirname, '..', 'node_modules', '@babel', 'traverse')).default;
    } catch (e) { nok('l’analyseur Babel est disponible', e.message); return; }
    // La liste FERMÉE des <img> qui ne peuvent PAS montrer une photo Vinted.
    // Clé : « fonction englobante :: source » ; une source inconnue est rouge.
    const PERMIS = {
      'PhotoVinted :: *': 'la règle elle-même (no-referrer, secours, pictogramme)',
      'OsmMap :: tileUrl(t.x, t.y)': 'tuiles de carte OpenStreetMap',
      'VrmLogo :: "/logo-vrm-192.png"': 'logo de l’app (fichier du site)',
      'QrColis :: url': 'QR de retrait (adresse du transporteur, extraite de l’email)',
      'LocalPhoto :: cur.img': 'photo de SA pièce, prise sur l’appareil (data:)',
      'Comptabilite :: qrVivant(t)': 'QR de retrait (transporteur)',
      'Comptabilite :: qi': 'QR de retrait (transporteur)',
      'Comptabilite :: qrView.img': 'QR de retrait (transporteur)',
      'SettingsScreen :: customLogo': 'logo choisi sur l’appareil (data:)',
      'AbonnementRequis :: "/logo-vrm-96.png"': 'logo de l’app',
      'ProFactureSetting :: cfg.logo': 'logo de facture choisi sur l’appareil (data:)',
      'AppCoeur :: logoSrc': 'logo de l’app ou logo choisi (data:)',
      'Fenetre :: "/logo-vrm-96.png"': 'logo de l’app (page d’accueil)',
      'Film :: "/logo-vrm-192.png"': 'logo de l’app (film de la page d’accueil)',
      'Accueil :: "/logo-vrm-96.png"': 'logo de l’app (page d’accueil)',
    };
    const fichiers = fs.readdirSync(path.join(R, 'src')).filter((f) => /\.jsx?$/.test(f));
    const trouves = [], inconnus = [];
    let nPhotoVinted = 0;
    for (const f of fichiers) {
      let src = fs.readFileSync(path.join(R, 'src', f), 'utf8');
      if (f === 'App.jsx' && MUTER_APP[MUTATION]) src = MUTER_APP[MUTATION](src);
      let ast;
      try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); }
      catch (e) { nok(`src/${f} se lit`, e.message); continue; }
      traverse(ast, {
        JSXOpeningElement(p) {
          const n = p.node.name;
          if (n.type !== 'JSXIdentifier') return;
          if (n.name === 'PhotoVinted') { nPhotoVinted++; return; }
          if (n.name !== 'img') return;
          // La fonction de PLUS HAUT niveau qui l'englobe (le composant).
          let fn = null;
          for (let q = p; q; q = q.parentPath) {
            if (q.isFunctionDeclaration() && q.node.id) fn = q.node.id.name;
            else if ((q.isArrowFunctionExpression() || q.isFunctionExpression()) && q.parentPath && q.parentPath.isVariableDeclarator() && q.parentPath.node.id.type === 'Identifier') fn = q.parentPath.node.id.name;
          }
          const attr = p.node.attributes.find((a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'src');
          let source = '(sans src)';
          if (attr && attr.value) {
            if (attr.value.type === 'StringLiteral') source = JSON.stringify(attr.value.value);
            else if (attr.value.type === 'JSXExpressionContainer') source = src.slice(attr.value.expression.start, attr.value.expression.end);
          }
          const ligne = p.node.loc.start.line;
          const cle = `${fn || '?'} :: ${source}`;
          trouves.push(cle);
          if (PERMIS[`${fn} :: *`] || PERMIS[cle]) return;
          inconnus.push(`src/${f}:${ligne} <img src={${source}}> dans ${fn || '?'}`);
        },
      });
    }
    if (process.env.VOIR) console.log('   ' + [...new Set(trouves)].join('\n   '));
    dit(nPhotoVinted >= 40, `la règle est utilisée : ${nPhotoVinted} <PhotoVinted> dans src/`, `${nPhotoVinted} seulement`);
    dit(inconnus.length === 0,
      `tout <img> de src/ passe par PhotoVinted, ou a une source qui ne peut pas être une photo Vinted (${trouves.length} vus, liste fermée)`,
      `${inconnus.length} <img> à une source inconnue — une photo Vinted y partirait avec le référent, sans secours, en image cassée. Passe-la par <PhotoVinted>, ou ajoute la source à PERMIS AVEC SA RAISON :\n   ` + inconnus.join('\n   '));
  });

  // ══ 2. La règle exécutée ════════════════════════════════════════════════
  const cheminModule = path.join(R, 'src', 'photosVinted.js');
  let sourceModule = '';
  try { sourceModule = fs.readFileSync(cheminModule, 'utf8'); } catch (e) { nok('src/photosVinted.js existe', e.message); }
  if (MUTER_MODULE[MUTATION]) {
    const avant = sourceModule; sourceModule = MUTER_MODULE[MUTATION](sourceModule);
    if (avant === sourceModule) { console.log('⚠️ la mutation « ' + MUTATION + ' » ne s’applique pas (le code a changé ?) — rien n’est prouvé'); process.exit(2); }
  }
  // Un monde neuf par cas : horloge pilotée, fetch / extension / image simulés.
  const monde = (cfg = {}) => {
    let t = 1_000_000_000_000;
    const minuteries = [];
    let idSuivant = 1;
    const setTimeout_ = (f, ms) => { const id = idSuivant++; minuteries.push({ id, at: t + Math.max(0, ms | 0), f }); return id; };
    const clearTimeout_ = (id) => { const i = minuteries.findIndex((m) => m.id === id); if (i >= 0) minuteries.splice(i, 1); };
    const ecouteursFenetre = {}, ecouteursDoc = {};
    const sondes = [];
    const ctx = {
      console, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(t); } static now() { return t; } },
      Math, JSON, Promise, Map, Set, WeakMap, Uint8Array, Object, Array, String, Number, Boolean, RegExp, Error, TypeError,
      setTimeout: setTimeout_, clearTimeout: clearTimeout_,
      atob: (b) => Buffer.from(b, 'base64').toString('binary'),
      Blob: class { constructor(parts, o) { this.size = parts.reduce((n, p) => n + (p.length || 0), 0); this.type = (o && o.type) || ''; } },
      URL: Object.assign(function (u) { return new URL(u); }, { createObjectURL: () => 'blob:x' + (idSuivant++), revokeObjectURL: () => {} }),
      AbortController: class { constructor() { this.signal = {}; } abort() {} },
      navigator: { onLine: cfg.horsLigne ? false : true },
      fetch: async (u, o) => { sondes.push(u); const r = cfg.sonde ? cfg.sonde(u, sondes.length) : 'erreur'; if (r === 'reponse') return { ok: false, status: 0, type: 'opaque' }; const e = new TypeError('Failed to fetch'); throw e; },
      window: { addEventListener: (n, f) => { (ecouteursFenetre[n] = ecouteursFenetre[n] || []).push(f); } },
      document: { hidden: false, addEventListener: (n, f) => { (ecouteursDoc[n] = ecouteursDoc[n] || []).push(f); } },
    };
    ctx.globalThis = ctx;
    // Le module en script : `export` retiré, ses noms exposés.
    const noms = [];
    const code = sourceModule
      .replace(/^export (const|function|async function|let) ([A-Za-z_$][\w$]*)/gm, (m, k, n) => { noms.push(n); return `${k} ${n}`; })
      + `\n;globalThis.__m = { ${noms.join(', ')} };`;
    vm.createContext(ctx);
    vm.runInContext(code, ctx, { filename: 'photosVinted.js' });
    const m = ctx.__m;
    const vider = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
    // Avance l'horloge en déclenchant les minuteries échues, dans l'ordre.
    const avancer = async (ms) => {
      const fin = t + ms;
      for (;;) {
        await vider();
        minuteries.sort((a, b) => a.at - b.at);
        const p = minuteries[0];
        if (!p || p.at > fin) break;
        minuteries.shift(); t = p.at; p.f();
      }
      t = fin; await vider();
    };
    const emettre = (n) => (ecouteursFenetre[n] || []).forEach((f) => f());
    return { m, ctx, avancer, vider, sondes, emettre };
  };
  const U = (k) => `https://images1.vinted.net/t/${String(k).padStart(8, '0')}abc/f800/176000${k}.jpeg?s=sig${k}`;
  // Monte n photos (à l'écran, visibles), et les fait échouer dans le navigateur.
  const monterEchouer = (m, urls) => urls.forEach((u) => { m.monter(u, () => {}); m.voir(u, {}, true); m.echecNatif(u); });

  await essaie('règle d’adresse', async () => {
    const { m } = monde();
    const oui = ['https://images1.vinted.net/t/a/f800/1.jpeg?s=1', 'https://vinted.net/x.jpg', 'https://a-b.c.vinted.net/x'];
    const non = ['https://evilvinted.net/x.svg', 'https://images1.vinted.net.evil.com/x', 'http://images1.vinted.net/x', 'https://images1.vinted.net@evil.com/x', 'javascript:alert(1)'];
    const malPasses = non.filter((u) => m.estPhotoVinted(u)), malRefuses = oui.filter((u) => !m.estPhotoVinted(u));
    dit(!malPasses.length && !malRefuses.length, 'seul le CDN de Vinted passe la règle (un nom qui IMITE vinted.net, non)', `passent à tort : ${malPasses.join(' ')} · refusées à tort : ${malRefuses.join(' ')}`);
  });

  await essaie('octets de l’extension', async () => {
    const { m } = monde();
    const b64 = Buffer.from('\x89PNG....').toString('base64');
    const typeDe = (d) => { const b = m.blobDeDataUrl(d); return b ? b.type : null; };
    const attendus = [
      ['data:image/jpeg;base64,' + b64, 'image/jpeg'], ['data:image/png;base64,' + b64, 'image/png'], ['data:image/webp;base64,' + b64, 'image/webp'],
      ['data:image/gif;base64,' + b64, 'image/gif'], ['data:image/avif;base64,' + b64, 'image/avif'],
      ['data:application/octet-stream;base64,' + b64, 'image/jpeg'], ['data:;base64,' + b64, 'image/jpeg'],
      ['data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64'), null],
      ['data:image/svg+xml,%3Csvg%2F%3E', null], ['data:text/html;base64,', null], ['pas une data url', null],
    ];
    const faux = attendus.filter(([d, t]) => typeDe(d) !== t).map(([d, t]) => `${d.slice(0, 32)}… → ${typeDe(d)} (attendu ${t})`);
    dit(!faux.length, 'les octets rendus par l’extension : une image connue, jamais un SVG (il s’exécuterait dans l’origine de l’app)', faux.join(' · '));
  });

  await essaie('sonde', async () => {
    // Deux erreurs réseau espacées sur deux photos ⇒ « bloquee ».
    let w = monde({ sonde: () => 'erreur' });
    w.m.configurer({ secours: () => 'non' });
    monterEchouer(w.m, [U(1), U(2), U(3)]);
    await w.avancer(10);
    const apres1 = w.m._etatInterne().sonde, n1 = w.sondes.length;
    await w.avancer(w.m.SONDE_ECART_MS + 50);
    const fin = w.m._etatInterne().sonde;
    dit(apres1 === 'encours' && n1 === 1, 'UNE erreur réseau ne conclut rien (la sonde attend la seconde)', `après la 1re : ${apres1} (${n1} sonde)`);
    dit(fin === 'bloquee' && w.sondes.length === 2 && w.sondes[0] !== w.sondes[1], 'deux erreurs réseau, espacées, sur DEUX photos ⇒ « bloquee »', `${fin} · ${w.sondes.length} sonde(s) · ${w.sondes[0] === w.sondes[1] ? 'même photo' : 'deux photos'}`);
    // Une erreur, puis une photo qui avait échoué PASSE avant la seconde ⇒ jamais « bloquee ».
    w = monde({ sonde: () => 'erreur' });
    w.m.configurer({ secours: () => 'non' });
    monterEchouer(w.m, [U(1), U(2), U(3)]);
    await w.avancer(10);
    w.m.chargeNatif(U(2));
    await w.avancer(w.m.SONDE_ECART_MS + 50);
    dit(w.m._etatInterne().sonde !== 'bloquee', 'une erreur réseau puis une photo qui passe : un hoquet, jamais « bloquee »', String(w.m._etatInterne().sonde));
    // S5 : la cause mesurée sur des photos qui ne sont PLUS à l'écran est remesurée.
    w = monde({ sonde: (u) => (/0000001|0000002|0000003/.test(u) ? 'reponse' : 'erreur') });
    w.m.configurer({ secours: () => 'non' });
    const offs = [U(1), U(2), U(3)].map((u) => { const off = w.m.monter(u, () => {}); w.m.echecNatif(u); return off; });
    await w.avancer(10);
    const avantChangement = w.m._etatInterne().sonde;
    offs.forEach((f) => f());                       // on quitte l'écran (Ventes)
    monterEchouer(w.m, [U(4), U(5), U(6)]);          // l'écran suivant (Annonces) échoue autrement
    await w.avancer(w.m.SONDE_ECART_MS + 100);
    dit(avantChangement === 'reponse' && w.m._etatInterne().sonde === 'bloquee', 'la cause mesurée sur un écran quitté est remesurée sur celui qui échoue (un lien mort sur Ventes ne dit pas la cause d’Annonces)', `${avantChangement} → ${w.m._etatInterne().sonde}`);
    // Changer d'écran : la cause se REMESURE, mais la phrase ne scintille pas.
    // Vu au banc (scénario U) : avec « en cours » posé d'office, elle disparaissait
    // 8 s à chaque écran, puis revenait identique.
    w = monde({ sonde: () => 'erreur' });
    w.m.configurer({ secours: () => 'non' });
    const offV = [U(1), U(2), U(3)].map((u) => { const off = w.m.monter(u, () => {}); w.m.voir(u, {}, true); w.m.echecNatif(u); return off; });
    await w.avancer(w.m.SONDE_ECART_MS + 100);
    const dVentes = w.m.decision();
    offV.forEach((f) => f());
    monterEchouer(w.m, [U(4), U(5), U(6)]);
    await w.avancer(10);
    const dJuste = w.m.decision();
    await w.avancer(w.m.SONDE_ECART_MS + 100);
    const dApres = w.m.decision();
    dit(dVentes.parle && dJuste.parle && dApres.parle && dJuste.cause === dVentes.cause && w.sondes.length === 3,
      'changer d’écran : la cause est remesurée (une 3e sonde), et une erreur de plus après « deux échecs réseau » la confirme sans faire disparaître la phrase',
      `Ventes ${dVentes.parle ? dVentes.cause : dVentes.pourquoi} · juste après ${dJuste.parle ? dJuste.cause : dJuste.pourquoi} · 8 s après ${dApres.parle ? dApres.cause : dApres.pourquoi} · ${w.sondes.length} sonde(s)`);
    // L'autre sens : la cause d'avant CONTREDITE (le serveur répondait, il ne
    // répond plus) n'est pas affichée pendant qu'on remesure.
    w = monde({ sonde: (u) => (/0000001|0000002|0000003/.test(u) ? 'reponse' : 'erreur') });
    w.m.configurer({ secours: () => 'non' });
    const offR = [U(1), U(2), U(3)].map((u) => { const off = w.m.monter(u, () => {}); w.m.voir(u, {}, true); w.m.echecNatif(u); return off; });
    await w.avancer(10);
    const dR = w.m.decision();
    offR.forEach((f) => f());
    monterEchouer(w.m, [U(4), U(5), U(6)]);
    await w.avancer(10);
    const dPendant = w.m.decision();
    dit(dR.parle && dR.cause === 'reponse' && !dPendant.parle && dPendant.pourquoi === 'mesure',
      'la cause d’avant CONTREDITE par la nouvelle mesure (« le serveur répond » → erreur réseau) ne reste pas affichée pendant qu’on remesure',
      `avant ${dR.parle ? dR.cause : dR.pourquoi} · pendant ${dPendant.parle ? dPendant.cause : dPendant.pourquoi}`);
    // La seconde reçoit une réponse ⇒ « reponse ».
    w = monde({ sonde: (u, n) => (n === 1 ? 'erreur' : 'reponse') });
    w.m.configurer({ secours: () => 'non' });
    monterEchouer(w.m, [U(1), U(2), U(3)]);
    await w.avancer(w.m.SONDE_ECART_MS + 50);
    dit(w.m._etatInterne().sonde === 'reponse', 'la seconde sonde reçoit une réponse ⇒ « le serveur répond », pas « bloquée »', String(w.m._etatInterne().sonde));
  });

  await essaie('bilan', async () => {
    // Le premier bilan attend que la cause soit mesurée (sinon « pas su » pour dix minutes).
    const w = monde({ sonde: () => 'erreur' });
    const ecrits = [];
    w.m.configurer({ secours: () => 'non', ecrire: async (b) => { ecrits.push(b); return true; } });
    monterEchouer(w.m, [U(1), U(2), U(3)]);
    await w.avancer(w.m.SONDE_ECART_MS + w.m.BILAN_PREMIER_MS + 3000);
    const b = ecrits[0];
    dit(ecrits.length === 1 && b && b.sonde === 'bloquee', 'le premier bilan part une fois la cause mesurée (deux sondes), pas avant', JSON.stringify(ecrits.map((x) => x.sonde)));
    const fuites = ecrits.map((x) => JSON.stringify(x)).filter((j) => /vinted\.net\/t\/|\?s=|f800|\.jpeg/.test(j));
    dit(!fuites.length, 'le bilan ne porte ni adresse, ni signature', fuites.join(' ').slice(0, 160));
  });

  await essaie('pas figé', async () => {
    // Le témoin : une seule photo réessayée à 20 s ; si elle passe, toutes réessaient.
    let w = monde({ sonde: () => 'erreur' });
    const essais = [];
    w.m.configurer({ secours: () => 'non', chargerImage: async (u) => { essais.push(u); return essais.length >= 2; } });
    monterEchouer(w.m, [U(1), U(2), U(3), U(4)]);
    await w.avancer(w.m.TEMOIN_PREMIER_MS - 100);
    const avant20 = essais.length;
    await w.avancer(200);
    const a20 = essais.length, etat20 = U(4) && w.m.etat(U(4));
    await w.avancer(2 * w.m.TEMOIN_PREMIER_MS + 100);
    const toutes = [U(1), U(2), U(3), U(4)].map((u) => w.m.etat(u));
    dit(avant20 === 0 && a20 === 1, 'le témoin : UNE photo réessayée au bout de 20 s (pas avant, pas toutes)', `${avant20} avant 20 s, ${a20} à 20 s`);
    dit(etat20 !== 'natif' && toutes.every((e) => e === 'natif'), 'le témoin échoue, puis passe (40 s plus tard) ⇒ TOUTES les photos réessaient dans le navigateur', `à 20 s : ${etat20} · ensuite : ${toutes.join(',')}`);
    dit(w.m._etatInterne().sonde === null, 'une photo revenue ⇒ la cause sera REMESURÉE au prochain échec (la sonde d’avant ne vaut plus)', String(w.m._etatInterne().sonde));
    // `online` : tout réessaie, refus de l'extension compris.
    w = monde({ sonde: () => 'erreur' });
    let reponses = 0;
    w.m.configurer({ secours: () => 'oui', demander: async () => { reponses++; return { dataUrl: null, issue: 'refus' }; } });
    monterEchouer(w.m, [U(1), U(2)]);
    await w.avancer(100);
    const refusees = [U(1), U(2)].map((u) => w.m.etat(u));
    w.emettre('online');
    await w.avancer(10);
    const apresOnline = [U(1), U(2)].map((u) => w.m.etat(u));
    dit(refusees.every((e) => e === 'ko') && apresOnline.every((e) => e === 'natif'), 'le réseau revient (`online`) ⇒ tout réessaie, même ce que l’extension avait refusé', `${refusees.join(',')} → ${apresOnline.join(',')}`);
    // Une photo perdue remontée après une minute réessaie ; avant, non.
    w = monde({ sonde: () => 'erreur' });
    w.m.configurer({ secours: () => 'non', chargerImage: async () => false });
    const off = []; [U(1), U(2), U(3)].forEach((u) => { off.push(w.m.monter(u, () => {})); w.m.echecNatif(u); });
    off.forEach((f) => f());
    await w.avancer(30_000);
    w.m.monter(U(1), () => {});
    const a30 = w.m.etat(U(1));
    off.length = 0;
    await w.avancer(31_000);
    w.m.monter(U(2), () => {});
    const a61 = w.m.etat(U(2));
    dit(a30 === 'attente' && a61 === 'natif', 'une photo perdue remontée : rien avant une minute, un nouvel essai après', `à 30 s : ${a30} · à 61 s : ${a61}`);
  });

  await essaie('délai ≠ refus', async () => {
    const w = monde({ sonde: () => 'erreur' });
    let n = 0, enVol = 0, max = 0;
    const attente = [];
    w.m.configurer({ secours: () => 'oui', demander: (u) => { n++; enVol++; max = Math.max(max, enVol); return new Promise((ok) => attente.push(() => { enVol--; ok({ dataUrl: null, issue: 'delai' }); })); } });
    monterEchouer(w.m, [U(1), U(2), U(3), U(4), U(5), U(6)]);
    await w.avancer(10);
    const nAvant = n;
    await w.avancer(60_000);
    dit(nAvant === 3 && n === 3 && max === 3, 'au plus 3 demandes, et la place reste prise jusqu’à la réponse (aucune nouvelle demande en attendant)', `${nAvant} au départ, ${n} après 60 s sans réponse, max ${max}`);
    attente.splice(0).forEach((f) => f());
    await w.avancer(10);
    const e1 = w.m.etat(U(1));
    dit(e1 !== 'ko' && !w.m.estDefinitive(U(1)) && !w.m.estMorte(U(1)), 'un DÉLAI de l’extension : la photo retourne en attente, jamais définitive ni perdue', `${e1} · définitive ${w.m.estDefinitive(U(1))} · perdue ${w.m.estMorte(U(1))}`);
    dit(n > 3, 'après un délai, un nouvel essai est demandé', `${n} demande(s)`);
    attente.splice(0).forEach((f) => f());
    await w.avancer(10);
    attente.splice(0).forEach((f) => f());
    await w.avancer(10);
    const lente = w.m.estLente(U(1));
    dit(lente && !w.m.estDefinitive(U(1)), 'deux délais : « pas su » (lente), on n’insiste plus sans signal — et toujours pas définitive', `lente ${lente} · définitive ${w.m.estDefinitive(U(1))}`);
    // Un REFUS, lui, est définitif.
    const w2 = monde({ sonde: () => 'erreur' });
    w2.m.configurer({ secours: () => 'oui', demander: async () => ({ dataUrl: null, issue: 'refus' }) });
    monterEchouer(w2.m, [U(7)]);
    await w2.avancer(10);
    dit(w2.m.estDefinitive(U(7)), 'un REFUS de l’extension (réponse sans octets) : définitif (c’est le seul état qui retire une photo d’une liste)', w2.m.etat(U(7)));
  });

  await essaie('quand parler', async () => {
    const parle = async (cfg) => {
      const w = monde({ sonde: cfg.sonde || (() => 'erreur') });
      w.m.configurer({ secours: () => cfg.secours || 'non', ext: () => cfg.ext || 'absente',
        demander: cfg.demander || (async () => ({ dataUrl: null, issue: 'refus' })) });
      // Une photo vue AILLEURS dans la session, plus montée.
      if (cfg.vueAilleurs) { const off = w.m.monter(U(90), () => {}); w.m.chargeNatif(U(90)); off(); }
      monterEchouer(w.m, Array.from({ length: cfg.morts }, (_, i) => U(10 + i)));
      for (let i = 0; i < (cfg.okNatif || 0); i++) { w.m.monter(U(60 + i), () => {}); w.m.chargeNatif(U(60 + i)); }
      if (cfg.okSecours) {
        // Une photo récupérée par l'extension, à l'écran.
        const w2 = w; const u = U(70);
        w2.m.configurer({ secours: () => 'oui', demander: async () => ({ dataUrl: 'data:image/png;base64,iVBORw0KGgo=', issue: 'ok' }) });
        w2.m.monter(u, () => {}); w2.m.voir(u, {}, true); w2.m.echecNatif(u);
        await w2.avancer(10);
        w2.m.configurer({ secours: () => cfg.secours || 'non', demander: cfg.demander || (async () => ({ dataUrl: null, issue: 'refus' })) });
      }
      await w.avancer(w.m.SONDE_ECART_MS + 100);
      return w.m.decision();
    };
    let d = await parle({ morts: 5 });
    dit(d && d.parle && d.cause === 'injoignable', 'sans extension, 5 photos perdues, deux échecs réseau ⇒ la phrase, cause « injoignable » (rien ne dit que c’est la page)', JSON.stringify(d));
    d = await parle({ morts: 5, vueAilleurs: true });
    dit(d && d.parle, 'une photo affichée AILLEURS dans la session ne fait pas taire la phrase (jugée sur ce qui est monté)', JSON.stringify(d));
    d = await parle({ morts: 5, vueAilleurs: true, sonde: () => 'reponse' });
    dit(d && d.parle && d.cause === 'reponse', '… quelle que soit la cause mesurée (ici : le serveur répond)', JSON.stringify(d));
    d = await parle({ morts: 2 });
    dit(d && !d.parle, 'deux photos perdues : des liens morts isolés, pas de phrase', JSON.stringify(d));
    d = await parle({ morts: 4, secours: 'oui', ext: 'presente', okSecours: true });
    dit(d && !d.parle, 'l’extension a récupéré une photo à l’écran ⇒ les autres sont des liens morts, pas de phrase', JSON.stringify(d));
    d = await parle({ morts: 4, okNatif: 1, sonde: () => 'reponse' });
    dit(d && !d.parle, 'une photo affichée par le navigateur et le serveur répond ⇒ liens morts, pas de phrase', JSON.stringify(d));
    d = await parle({ morts: 4, okNatif: 1 });
    dit(d && d.parle, 'une photo affichée (du cache) mais deux échecs réseau ⇒ la phrase reste', JSON.stringify(d));
    d = await parle({ morts: 4, secours: 'oui', ext: 'presente' });
    dit(d && d.parle && d.ext === 'presente' && d.cause !== 'navigateur', 'l’extension refuse tout : la phrase, sans prétendre que « l’extension les récupère »', JSON.stringify(d));
    // Pendant la mesure, pas de phrase.
    const w = monde({ sonde: () => 'erreur' });
    w.m.configurer({ secours: () => 'non' });
    monterEchouer(w.m, [U(1), U(2), U(3), U(4)]);
    await w.avancer(10);
    const pendant = w.m.decision();
    dit(pendant && !pendant.parle, 'pendant qu’on mesure encore la cause : pas de phrase', JSON.stringify(pendant));
  });

  console.log(ko ? `\n❌ audit-photos-vinted : ${ko} contrôle(s) en échec${MUTATION ? ' (mutation « ' + MUTATION + ' »)' : ''}.` : `\n✅ audit-photos-vinted : tout est vert${MUTATION ? ' — la mutation « ' + MUTATION + ' » n’est PAS attrapée' : ''}.`);
  process.exit(ko ? 1 : 0);
})();
