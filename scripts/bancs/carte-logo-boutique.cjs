// ════════════════════════════════════════════════════════════════════════════
//  BANC « CARTE DU LOGO 5.371 » (12 nov., lot agent2-ext-boutique)
//  Le VRAI vrm-badge.js dans Chromium, un faux `chrome` à stockage réel, des états
//  inventés (aucune requête vers un site, aucune base). Il juge (data-* et
//  géométrie, jamais un libellé seul) :
//   A. la carte en 4 lignes au plus : compte · lu · jauge (« 23/50 cette heure ·
//      112/200 aujourd’hui », « au moins » si pas complète) · état ; ambre seulement
//      pour un geste ; dans l'écran à 390 (doigt) et 1512 (souris), clair et sombre ;
//   B. l'état : normal ✓ · prudence jusqu’à … · pause · Tout arrêté · arrêt (geste) ·
//      gestes en attente de réseau ;
//   C. « Nouvelle version disponible » : installée à la main ⇒ « Télécharger » (le
//      paquet servi, une adresse connue seulement) + 3 étapes ; boutique ⇒ rien ;
//   D. « Réparer » seulement sur un état cassé mesuré ; le clic demande au service
//      worker de réparer et dit l'issue (republication ⇒ rien touché) ; « Envoyer un
//      rapport » ;
//   E. (Julien, capture Orion sur Vestiaire) le logo ne recouvre JAMAIS une barre
//      fixe du site : barre du bas (390, posée au chargement ou plus tard), barre du
//      haut (logo glissé en haut) ; intersection = 0, marge ≥ 12 px ; la place
//      choisie reste rangée ; logo plus petit au téléphone.
//  Captures : BANC_CAPTURES (ou ./captures/carte-logo-boutique).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(process.env.BADGE_SRC ? path.resolve(process.env.BADGE_SRC) : path.join(EXT, 'vrm-badge.js'), 'utf8');   // BADGE_SRC : juger une autre copie (branche de départ, mutation)
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES || path.join(__dirname, 'captures', 'carte-logo-boutique');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 260) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 200)}`); return null; } };

const MIN = 60000;
const JAUGE = { h: 23, maxH: 50, j: 112, maxJ: 200, complet: true, prudence: 0 };
const base = (x) => Object.assign({ ok: true, plateforme: 'vinted', capte: true, version: '5.371.0', code: '5.371.0',
  vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_x', choix: 'oui', jauge: JAUGE }, flux: { okAt: Date.now() - 3 * MIN }, bascule: null,
  maj: { installee: '5.371.0', servie: '5.371.0', nouvelle: false, origine: 'main', lien: 'https://vrm.center/VRM-extension.zip', moteur: 'chromium' },
  aReparer: [], enAttenteReseau: 0, toutArrete: false }, x || {});
const site = (x) => Object.assign({ id: '111', nom: 'shop_x', choix: 'oui', jauge: JAUGE }, x || {});
const ETATS = {
  get ok() { return base(); },
  get incomplet() { return base({ site: site({ jauge: Object.assign({}, JAUGE, { complet: false }) }) }); },
  get prudence() { return base({ site: site({ jauge: Object.assign({}, JAUGE, { prudence: Date.now() + 90 * MIN }) }) }); },
  get pause() { return base({ site: site({ pause: { jusqua: Date.now() + 25 * MIN } }) }); },
  get arrete() { return base({ toutArrete: true }); },
  get captcha() { return base({ site: site({ arret: { depuis: Date.now() - MIN, quoi: 'captcha' } }) }); },
  get reseau() { return base({ enAttenteReseau: 2 }); },
  get maj() { return base({ maj: { installee: '5.371.0', servie: '5.372.0', nouvelle: true, origine: 'main', lien: 'https://vrm.center/VRM-extension.zip', moteur: 'chromium' } }); },
  get majBoutique() { return base({ maj: { installee: '5.371.0', servie: '5.372.0', nouvelle: true, origine: 'boutique', lien: 'https://vrm.center/VRM-extension.zip', moteur: 'chromium' } }); },
  get majLienInconnu() { return base({ maj: { installee: '5.371.0', servie: '5.372.0', nouvelle: true, origine: 'main', lien: 'https://ailleurs.example/x.zip', moteur: 'chromium' } }); },
  get casse() { return base({ aReparer: ['file'] }); },
};

const PAGE = ({ barreBas = false, barreHaut = false, barreTard = false } = {}) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head>
<body style="margin:0;background:#fff;font-family:sans-serif">
${barreHaut ? '<header data-barre="haut" style="position:fixed;top:0;left:0;right:0;height:56px;background:#222;color:#fff;z-index:10">Haut</header>' : ''}
<main style="padding:80px 20px;height:2400px">Catalogue « Sale Season »…</main>
${barreBas ? '<nav data-barre="bas" style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#f6f6f6;border-top:1px solid #ddd;display:flex;justify-content:space-around;align-items:center;z-index:10"><span>Accueil</span><span>Favoris</span><span>Vendre</span><span>Notifications</span><span>Moi</span></nav>' : ''}
${barreTard ? '<script>setTimeout(()=>{const n=document.createElement("nav");n.setAttribute("data-barre","bas");n.style.cssText="position:fixed;bottom:0;left:0;right:0;height:64px;background:#f6f6f6;z-index:10";n.textContent="Barre posée plus tard";document.body.appendChild(n);},900);</script>' : ''}
</body></html>`;

async function ouvrir(nav, etat, { scheme = 'light', largeur = 1512, hauteur = 900, store = {}, mobile = false, page = {}, url = 'https://fr.vestiairecollective.com/sale-season/', repondre = null } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(page) });
  });
  await pg.goto(url);
  await pg.evaluate(({ e, js, store, repondre }) => {
    window.__envoyes = []; window.__store = store;
    const ecoutes = [];
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    const get = (k) => { const ks = k == null ? Object.keys(window.__store) : Array.isArray(k) ? k : [k]; const o = {}; for (const x of ks) if (x in window.__store) o[x] = JSON.parse(JSON.stringify(window.__store[x])); return o; };
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.371.0' }), lastError: null,
        sendMessage: (msg, cb) => { window.__envoyes.push(msg); setTimeout(() => cb && cb(msg.action === 'etat' ? e : (repondre && repondre[msg.action]) || { ok: true }), 0); } },
      storage: { local: {
        get: (k, cb) => { const o = get(k); if (cb) setTimeout(() => cb(o), 0); return Promise.resolve(o); },
        set: (o, cb) => { const ch = {}; for (const x of Object.keys(o)) { ch[x] = { oldValue: window.__store[x], newValue: o[x] }; window.__store[x] = JSON.parse(JSON.stringify(o[x])); } setTimeout(() => { ecoutes.forEach((f) => f(ch, 'local')); cb && cb(); }, 0); return Promise.resolve(); },
      }, onChanged: { addListener: (f) => ecoutes.push(f) } },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: etat, js: BADGE, store, repondre });
  await pg.waitForTimeout(700);
  return { ctx, pg, erreurs };
}
const lire = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge'); if (!h || !h.shadowRoot) return null;
  const r = h.shadowRoot, q = (s) => r.querySelector(s);
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const q4 = q('[data-q4-bloc]');
  const vals = q4 ? Array.from(q4.querySelectorAll('[data-q4]')) : [];
  const etat = q('[data-q4="etat"]');
  return {
    q4: !!q4, lignes: vals.length, cles: vals.map((v) => v.getAttribute('data-q4')),
    textes: Object.fromEntries(vals.map((v) => [v.getAttribute('data-q4'), v.innerText.trim()])),
    etat: etat ? etat.getAttribute('data-q4-etat') : null,
    etatCouleur: etat ? getComputedStyle(etat).color : '', compteCouleur: q('[data-q4="compte"]') ? getComputedStyle(q('[data-q4="compte"]')).color : '',
    lignesRendues: q4 ? vals.filter((v) => { const lh = parseFloat(getComputedStyle(v).lineHeight) || 18; return v.getBoundingClientRect().height <= lh * 1.5 && v.scrollWidth <= v.clientWidth + 1; }).length : 0,
    maj: q('[data-maj]') ? q('[data-maj]').getAttribute('data-maj') : null,
    majLien: q('[data-maj-telecharger]') ? q('[data-maj-telecharger]').getAttribute('href') : null,
    majEtapes: r.querySelectorAll('[data-maj] li').length,
    reparer: !!q('[data-reparer]'), rep: q('[data-rep]') ? { e: q('[data-rep]').getAttribute('data-rep'), t: q('[data-rep]').innerText } : null,
    rapport: !!q('[data-rapport]'), rapportEtat: q('[data-rapport-etat]') ? q('[data-rapport-etat]').innerText : '',
    carteVisible: !!(q('.carte') && getComputedStyle(q('.carte')).display !== 'none'),
    carte: rect(q('.carte')), btn: rect(q('.btn')),
    evite: h.getAttribute('data-evite-barre'),
    envoyes: window.__envoyes.filter((m) => m.action !== 'etat'), store: window.__store,
  };
});
const barres = (pg) => pg.evaluate(() => Array.from(document.querySelectorAll('[data-barre]')).map((b) => { const r = b.getBoundingClientRect(); return { k: b.getAttribute('data-barre'), x: r.left, y: r.top, r: r.right, b: r.bottom }; }));
const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));
const dedans = (c, W, H) => !!c && c.x >= 0 && c.y >= 0 && c.r <= W + 0.5 && c.b <= H + 0.5;
const ouvrirCarte = async (pg, mobile) => { const l = await lire(pg); if (mobile) await pg.touchscreen.tap(l.btn.x + l.btn.w / 2, l.btn.y + l.btn.h / 2); else await pg.mouse.move(l.btn.x + l.btn.w / 2, l.btn.y + l.btn.h / 2); await pg.waitForTimeout(350); return lire(pg); };
const lum = (rgb) => { const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(rgb || ''); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : null; };
const estAmbre = (rgb) => { const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(rgb || ''); return !!m && Number(m[1]) > 150 && Number(m[3]) < 60; };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  const VUES = [{ nom: '1512', largeur: 1512, hauteur: 900, mobile: false }, { nom: '390', largeur: 390, hauteur: 844, mobile: true }];

  console.log('A. La carte en 4 lignes');
  for (const v of VUES) for (const scheme of ['light', 'dark']) {
    await essaie(`A ${v.nom} ${scheme}`, async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, ETATS.ok, { scheme, largeur: v.largeur, hauteur: v.hauteur, mobile: v.mobile, url: 'https://www.vinted.fr/member/1' });
      const l = await ouvrirCarte(pg, v.mobile);
      await cap(pg, `carte-${v.nom}-${scheme}`);
      dit(l.q4 && l.lignes <= 4 && l.cles.join(',') === 'compte,lu,jauge,etat', `${v.nom} ${scheme} : 4 lignes au plus — compte · lu · jauge · état`, JSON.stringify(l.cles));
      dit(l.textes.compte === 'shop_x' && /il y a 3 min/.test(l.textes.lu), `${v.nom} ${scheme} : le pseudo et « il y a 3 min »`, JSON.stringify(l.textes));
      dit(/^23\/50 cette heure · 112\/200 aujourd’hui$/.test(l.textes.jauge || ''), `${v.nom} ${scheme} : « 23/50 cette heure · 112/200 aujourd’hui »`, l.textes.jauge);
      dit(l.etat === 'normal' && /Normal/.test(l.textes.etat) && !estAmbre(l.etatCouleur), `${v.nom} ${scheme} : état normal, sans couleur`, `${l.etat} ${l.etatCouleur}`);
      dit(l.lignesRendues === l.lignes, `${v.nom} ${scheme} : chaque ligne tient sur UNE ligne affichée`, `${l.lignesRendues}/${l.lignes}`);
      dit(l.carteVisible && dedans(l.carte, v.largeur, v.hauteur), `${v.nom} ${scheme} : la carte reste dans l’écran`, JSON.stringify(l.carte));
      const lt = lum(l.compteCouleur);
      dit(scheme === 'dark' ? lt > 0.7 : lt < 0.3, `${v.nom} ${scheme} : texte lisible dans la teinte`, l.compteCouleur);
      dit(!erreurs.length, `${v.nom} ${scheme} : aucune erreur de page`, erreurs.join(' | '));
      await ctx.close();
    });
  }
  await essaie('A incomplet', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.incomplet, { url: 'https://www.vinted.fr/' });
    const l = await ouvrirCarte(pg, false);
    dit(/^au moins 23\/50/.test(l.textes.jauge || ''), 'jauge pas complète (autres Chrome pas lus) ⇒ « au moins »', l.textes.jauge);
    await ctx.close();
  });

  console.log('B. L’état');
  const ETATS_B = [['prudence', 'prudence', /^Prudence jusqu’à \d\d:\d\d$/, false], ['pause', 'pause', /Pause/, false], ['arrete', 'arrete', /^Tout arrêté$/, false], ['captcha', 'geste', /vérification/, true], ['reseau', 'reseau', /^2 gestes en attente de réseau$/, false]];
  for (const [nom, k, re, ambre] of ETATS_B) {
    await essaie(`B ${nom}`, async () => {
      const { ctx, pg } = await ouvrir(nav, ETATS[nom], { url: 'https://www.vinted.fr/' });
      const l = await ouvrirCarte(pg, false);
      await cap(pg, `etat-${nom}-1512-light`);
      dit(l.etat === k && re.test(l.textes.etat || '') && estAmbre(l.etatCouleur) === ambre, `état ${nom} : « ${l.textes.etat} »${ambre ? ' en ambre (un geste)' : ', sans ambre'}`, `${l.etat} ${l.etatCouleur}`);
      await ctx.close();
    });
  }

  console.log('C. Nouvelle version disponible');
  for (const scheme of ['light', 'dark']) {
    await essaie(`C ${scheme}`, async () => {
      const { ctx, pg } = await ouvrir(nav, ETATS.maj, { scheme, largeur: 390, hauteur: 844, mobile: true, url: 'https://www.vinted.fr/' });
      const l = await ouvrirCarte(pg, true);
      await cap(pg, `maj-390-${scheme}`);
      dit(l.maj === '5.372.0' && l.majLien === 'https://vrm.center/VRM-extension.zip' && l.majEtapes === 3, `${scheme} : à la main ⇒ « Nouvelle version disponible · 5.372.0 », Télécharger (le zip servi), 3 étapes`, JSON.stringify([l.maj, l.majLien, l.majEtapes]));
      dit(dedans(l.carte, 390, 844), `${scheme} : la carte reste dans l’écran (390)`, JSON.stringify(l.carte));
      await ctx.close();
    });
  }
  await essaie('C boutique', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.majBoutique, { url: 'https://www.vinted.fr/' });
    const l = await ouvrirCarte(pg, false);
    dit(l.maj === null, 'venue d’une boutique ⇒ rien à faire, rien d’affiché', l.maj);
    await ctx.close();
  });
  await essaie('C lien', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.majLienInconnu, { url: 'https://www.vinted.fr/' });
    const l = await ouvrirCarte(pg, false);
    dit(l.maj === null, 'une adresse de paquet inconnue n’est jamais proposée', l.majLien);
    await ctx.close();
  });

  console.log('D. Réparer et rapport');
  await essaie('D aucun', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.ok, { url: 'https://www.vinted.fr/' });
    const l = await ouvrirCarte(pg, false);
    dit(!l.reparer, 'rien de cassé ⇒ pas de bouton « Réparer »', '');
    await ctx.close();
  });
  await essaie('D casse', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.casse, { url: 'https://www.vinted.fr/', repondre: { reparer: { ok: false, code: 'republication', raison: 'Une republication est en cours : rien n’est touché. Réessaie après.' } } });
    let l = await ouvrirCarte(pg, false);
    dit(l.reparer, 'commande bloquée mesurée ⇒ « Réparer »', '');
    await pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-reparer]').click());
    await pg.waitForTimeout(300);
    l = await lire(pg);
    await cap(pg, 'reparer-republication-1512-light');
    dit(l.envoyes.some((m) => m.action === 'reparer') && l.rep && l.rep.e === 'refus' && /republication/.test(l.rep.t), 'le clic demande la réparation ; republication en cours ⇒ « rien n’est touché » dit', JSON.stringify(l.rep));
    await ctx.close();
  });
  await essaie('D rapport', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.ok, { url: 'https://www.vinted.fr/' });
    await ouvrirCarte(pg, false);
    await pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const d = r.querySelector('details[data-detail]'); d.open = true; r.querySelector('[data-rapport]').click(); });
    await pg.waitForTimeout(300);
    const l = await lire(pg);
    await cap(pg, 'rapport-1512-light');
    dit(l.envoyes.some((m) => m.action === 'rapport') && /Rapport envoyé/.test(l.rapportEtat), '« Envoyer un rapport » ⇒ le service worker l’envoie, la carte dit « Rapport envoyé ✓ »', JSON.stringify(l.rapportEtat));
    await ctx.close();
  });

  console.log('E. Jamais sur une barre fixe du site');
  for (const scheme of ['light', 'dark']) {
    await essaie(`E bas ${scheme}`, async () => {
      const { ctx, pg } = await ouvrir(nav, ETATS.ok, { scheme, largeur: 390, hauteur: 844, mobile: true, page: { barreBas: true } });
      const l = await lire(pg); const [b] = await barres(pg);
      await cap(pg, `barre-bas-390-${scheme}`);
      dit(l.btn && inter(l.btn, b) === 0 && b.y - l.btn.b >= 12 - 0.5, `${scheme} 390 : le logo est au-dessus de la barre du bas (intersection 0, marge ≥ 12 px)`, JSON.stringify({ btn: l.btn, barre: b }));
      dit(l.btn && l.btn.w <= 38.5, `${scheme} 390 : logo réduit au téléphone (≤ 38 px)`, l.btn && l.btn.w);
      const pos = l.store.vrmBadgePos;
      dit(!pos || !pos.vestiaire, `${scheme} : l’écart n’est pas rangé comme une place choisie`, JSON.stringify(pos));
      await ctx.close();
    });
  }
  await essaie('E tard', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.ok, { largeur: 390, hauteur: 844, mobile: true, page: { barreTard: true } });
    await pg.waitForTimeout(1200);
    const l = await lire(pg); const [b] = await barres(pg);
    dit(l.btn && b && inter(l.btn, b) === 0, 'une barre posée APRÈS le chargement ⇒ le logo se replace au-dessus', JSON.stringify({ btn: l.btn, barre: b }));
    await ctx.close();
  });
  await essaie('E haut', async () => {
    const H = 844, W = 390;
    const { ctx, pg } = await ouvrir(nav, ETATS.ok, { largeur: W, hauteur: H, mobile: true, page: { barreHaut: true, barreBas: true }, store: { vrmBadgePos: { vestiaire: { r: 16, b: H - 44 - 10 } } } });
    const l = await lire(pg); const bs = await barres(pg);
    const haut = bs.find((x) => x.k === 'haut'), bas = bs.find((x) => x.k === 'bas');
    await cap(pg, 'barre-haut-390-light');
    dit(l.btn && inter(l.btn, haut) === 0 && inter(l.btn, bas) === 0 && l.btn.y - haut.b >= 12 - 0.5, 'logo glissé en haut ⇒ sous la barre du haut (marge ≥ 12 px)', JSON.stringify({ btn: l.btn, haut }));
    dit(l.store.vrmBadgePos.vestiaire.b === H - 44 - 10, 'sa place choisie reste rangée telle quelle', JSON.stringify(l.store.vrmBadgePos));
    await ctx.close();
  });
  await essaie('E 1512', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.ok, { largeur: 1512, hauteur: 900, page: { barreBas: true } });
    const l = await lire(pg); const [b] = await barres(pg);
    dit(l.btn && inter(l.btn, b) === 0 && l.btn.w === 44, '1512 : au-dessus de la barre, logo 44 px', JSON.stringify({ btn: l.btn, barre: b }));
    await ctx.close();
  });
  await essaie('E sans barre', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.ok, { largeur: 390, hauteur: 844, mobile: true });
    const l = await lire(pg);
    dit(l.btn && Math.round(844 - l.btn.b) === 16 && !l.evite, 'sans barre : à sa place habituelle (16 px du bas)', JSON.stringify(l.btn));
    await ctx.close();
  });

  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
