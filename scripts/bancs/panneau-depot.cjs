// ════════════════════════════════════════════════════════════════════════
//  BANC « DÉPOSER N SUR VINTED » ET « REPUBLIER MAINTENANT » DANS LE PANNEAU (21 nov., ext. 5.429)
//
//  Les VRAIS vrm-ui.js + vrm-depot.js + vrm-badge.js dans une page vinted.fr (faux `chrome` : il répond ce que dirait le
//  service worker — `depotFiches`, `depotLancer`, l'atelier ; la logique du fond est jugée par audit-ext-5429 sur le
//  VRAI background.js). 390 px Orion (iPhone) au doigt et 1512 px à la souris, clair et sombre. On juge :
//   D1 le lien de l'app (`action=deposer&ids=…`) ouvre « Brouillons préparés », les fiches pré-cochées, le mode choisi ;
//   D2 « Déposer N » ⇒ le récapitulatif ; RIEN ne part avant « Confirmer le dépôt » ; puis `depotLancer` (ids, mode, confirme) ;
//   D3 une fiche qui manque d'un champ n'est pas cochable en « Publier », le manque nommé ;
//   D4 la frise : une étape est « faite » SEULEMENT sur sa preuve datée ; la 1re sans preuve « en cours » / « arrêtée ici » ;
//      l'avant / après (ta fiche | relu chez Vinted) ;
//   R1 « Republier » sur une ligne (lien `republier-direct`, et « Republier » de la fiche ⋯) ⇒ la feuille Avant | Après de
//      CETTE paire, le contrôle avant départ demandé ; rien ne part avant « Republier maintenant » ; puis `atelierLancer`
//      avec CETTE paire (le chemin de l'atelier) ;
//   cibles ≥ 44 px, rien ne déborde, aucune erreur de page.
//  `--prouve` : vrm-depot.js réaffaibli (une étape cochée sans preuve ; lancer sans confirmer) ⇒ rouge.
//  Captures : BANC_CAPTURES/panneau-depot (sinon scripts/bancs/captures/panneau-depot). Tout est inventé.
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DEPOT = fs.readFileSync(arg('--depot') || path.join(EXT, 'vrm-depot.js'), 'utf8');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'panneau-depot') : path.join(__dirname, 'captures', 'panneau-depot');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; if (!process.env.SILENCE) console.log(`  ✅ ${quoi}`); } else { ko++; if (!process.env.SILENCE) console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };
const T0 = Date.now(), MIN = 60000, J = 864e5;
const img = (c) => `https://images1.vinted.net/banc/${c}.jpg`;
const MODELES = ['Nike Air Max 90 blanches', 'Adidas Samba OG noires', 'New Balance 550 crème', 'Puma Suede bleues'];
const TOUTES = MODELES.map((m, i) => ({ id: String(7000 + i), titre: `${m} ${40 + i}`, prix: 55 + i * 5, photo: img('a' + i), photos: [img('a' + i)], num: String(120 + i), jours: i * 4, favoris: i, depuis: T0 - (i * 4 + 2) * J, taille: String(40 + i), marque: m.split(' ')[0], etat: 'Très bon état', vues: 30 + i, statut: 'en_vente' }));
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' }, offres: [],
  annonces: { lu: T0 - 20 * MIN, aConfirmer: false, total: TOUTES.length, liste: TOUTES, toutes: TOUTES, nTous: TOUTES.length, statuts: { en_vente: 4, brouillon: 0, masque: 0, reserve: 0, vendu: 0, a_confirmer: 0 } },
  ventes: { lu: T0, total: 0, liste: [] }, messages: { lu: T0, liste: [] }, autres: null, automatisations: null, notifications: { vu: T0, liste: [] } };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.429.0', code: '5.429.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 12, maxH: 50, j: 40, maxJ: 200, complet: true }, favoris: { apercu: null, file: null } },
  secu: { niveau: 'ok', texte: 'Tout va bien sur ce compte' }, toutArrete: false, flux: { okAt: T0 - 3 * MIN }, liens: [], capteCoupe: false };
const FICHES = [
  { id: 'f41', numero: '41', titre: 'Nike Air Max 90 blanches 42', prix: 65, nPhotos: 3, prepare: true, prepareeAt: new Date(T0 - J).toISOString(), manquePublier: [], manqueBrouillon: [], aFinir: [], variables: [], depose: '', draftId: '' },
  { id: 'f42', numero: '42', titre: 'Adidas Samba OG noires 41', prix: 70, nPhotos: 4, prepare: true, prepareeAt: new Date(T0 - J).toISOString(), manquePublier: ['colis'], manqueBrouillon: [], aFinir: ['colis'], variables: [], depose: '' },
  { id: 'f43', numero: '43', titre: 'New Balance 550 crème 43', prix: 80, nPhotos: 2, prepare: true, prepareeAt: new Date(T0 - 2 * J).toISOString(), manquePublier: [], manqueBrouillon: [], aFinir: [], variables: [], depose: 'brouillon', draftId: '88009' },
];
const BILAN = [['photos', '3', '3', 'ok'], ['titre', 'Nike Air Max 90 blanches 42', 'Nike Air Max 90 blanches 42', 'ok'], ['description', 'Très bon état…', '', 'ok'], ['categorie', 'Hommes > Chaussures > Baskets', '', 'ok'], ['marque', 'Nike', '', 'ok'], ['taille', '42', '', 'ok'], ['etat', 'Très bon état', '', 'ok'], ['couleurs', 'Blanc', '', 'ok'], ['colis', 'petit', '', 'ok'], ['prix', '65', '65', 'ok']].map(([k, avant, apres, etat]) => ({ k, avant, apres, etat }));
const LOT = { v: 1, uid: '111', ids: ['f41', 'f42'], i: 1, mode: 'publier', etat: 'cours', prochain: T0 + 90000, lanceLe: T0 - 5 * MIN, fiches: {
  f41: { etape: 'brouillon-arret', numero: '41', titre: 'Nike Air Max 90 blanches 42', ordre: 'faux', preuves: { photos: T0 - 4 * MIN, formulaire: T0 - 3 * MIN, brouillon: T0 - 2 * MIN }, raison: 'brouillon rangé sur Vinted, PAS publié : l’ordre des photos (la photo 1 n’est pas à sa place).', draftId: '88001', bilan: BILAN.map((b) => b.k === 'photos' ? { ...b, etat: 'ecart' } : b) },
  f42: { etape: 'cours', numero: '42', titre: 'Adidas Samba OG noires 41', preuves: { photos: T0 - 40000 } } } };
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8sPfefwAHiQM0TP3mWgAAAABJRU5ErkJggg==', 'base64');

async function ouvrir(nav, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, orion = false, url, lot = null }) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0' } : {}));
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/vinted\.net\/banc\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">Une page Vinted</header><main style="padding:20px;height:2000px">Annonces…</main></body></html>' });
  });
  await pg.goto(url);
  await pg.evaluate(({ e, js, ui, dep, L, F, lot }) => {
    window.__envoyes = []; window.open = () => null;
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.__lot = lot;
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(copie(msg));
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(e);
          else if (msg.action === 'carteListes') rep = copie(L);
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          else if (msg.action === 'depotFiches') rep = { ok: true, uid: '111', fiches: copie(F), aPreparer: 2, lot: window.__lot };
          else if (msg.action === 'depotLancer') rep = msg.confirme === true ? { ok: true, lot: { v: 1, uid: '111', ids: msg.ids, i: 0, mode: msg.mode, etat: 'cours', prochain: Date.now(), fiches: Object.fromEntries(msg.ids.map((id) => [id, { etape: 'attente', numero: id.slice(1), titre: (F.find((f) => f.id === id) || {}).titre, preuves: {} }])) } } : { ok: false, raison: 'non' };
          else if (msg.action === 'atelierVerifier') rep = { ok: true, paires: Object.fromEntries((msg.tous || msg.ids).map((id) => [id, { id, etat: 'ok', corrections: [], manque: [], prixCoffre: 60, champs: [{ k: 'categorie', etat: 'ok' }, { k: 'marque', etat: 'ok' }] }])), resume: { verifiees: 1, corrige: 0, aCorriger: 0, absente: 0, pasVerifie: 0 }, lancer: { ok: true } };
          else if (msg.action === 'atelierLancer') rep = msg.confirme === true ? { ok: true } : { ok: false };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} }, session: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } } },
      i18n: { getUILanguage: () => 'fr', getMessage: () => '' },
    };
    for (const src of [ui, dep, js]) { const s = document.createElement('script'); s.textContent = src; document.documentElement.appendChild(s); }
  }, { e: ETAT, js: BADGE, ui: UI, dep: DEPOT, L: LISTES, F: FICHES, lot });
  await pg.waitForTimeout(1400);
  return { ctx, pg, erreurs };
}
const R = (pg, fn, a) => pg.evaluate(fn, a);
const lire = (pg) => R(pg, () => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const carte = q('.carte');
  const ctl = Array.from(r.querySelectorAll('[data-depot] button, [data-depot] .dp-case, [data-repub-direct] button')).filter(vis);
  return {
    depot: q('[data-depot]') ? q('[data-depot]').getAttribute('data-depot') : null,
    fiches: Array.from(r.querySelectorAll('[data-depot-fiche]')).map((x) => x.getAttribute('data-depot-fiche') + ':' + x.getAttribute('data-depot-pret') + (x.querySelector('input').checked ? '*' : '')),
    modes: Array.from(r.querySelectorAll('[data-depot-mode]')).map((b) => b.getAttribute('data-depot-mode') + ':' + b.getAttribute('aria-pressed')),
    lancer: q('[data-depot-lancer]') ? { off: q('[data-depot-lancer]').disabled, t: q('[data-depot-lancer]').innerText } : null,
    manques: Array.from(r.querySelectorAll('[data-depot-manque]')).map((x) => x.getAttribute('data-depot-manque')),
    frises: Object.fromEntries(Array.from(r.querySelectorAll('[data-depot-frise]')).map((f) => [f.getAttribute('data-depot-frise'), Array.from(f.querySelectorAll('[data-etape]')).map((l) => l.getAttribute('data-etape') + ':' + l.getAttribute('data-etat'))])),
    aa: Array.from(r.querySelectorAll('[data-depot-avant-apres] tr[data-champ]')).map((t) => t.getAttribute('data-champ') + ':' + t.querySelector('td[data-etat]').getAttribute('data-etat')),
    direct: q('[data-repub-direct]') ? { titre: q('[data-repub-direct] h3').innerText, lancer: q('[data-repub-direct] [data-atelier-lancer]') ? { off: q('[data-repub-direct] [data-atelier-lancer]').disabled, t: q('[data-repub-direct] [data-atelier-lancer]').innerText } : null, aa: !!q('[data-repub-direct] .vu-aa, [data-repub-direct] [data-aa-ligne], [data-repub-direct] details') } : null,
    petits: ctl.filter((b) => b.offsetHeight < 44).map((b) => (b.className || b.tagName) + ':' + b.offsetHeight + ':' + (b.innerText || '').slice(0, 20)),
    debord: document.documentElement.scrollWidth > window.innerWidth || (carte && carte.scrollWidth > carte.clientWidth + 1),
    envoyes: window.__envoyes.filter((m) => !['etat', 'capteLot', 'carteListes', 'panneauEtat'].includes(m.action)).map((m) => ({ action: m.action, ids: m.ids, mode: m.mode, confirme: m.confirme })),
  };
});
const clic = async (pg, sel) => { await R(pg, (s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); return !!b; }, sel); await pg.waitForTimeout(300); };
const cocher = async (pg, sel) => { await R(pg, (s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) { b.checked = !b.checked; b.dispatchEvent(new Event('change', { bubbles: true })); } }, sel); await pg.waitForTimeout(250); };
const capture = async (pg, nom) => { fs.mkdirSync(SORTIE, { recursive: true }); await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); };

(async () => {
  if (process.argv.includes('--prouve')) {
    const src = fs.readFileSync(path.join(EXT, 'vrm-depot.js'), 'utf8'); let bien = true;
    const MUT = [['etape-sans-preuve', "if (p[k] && !(k === 'ordre' && fi.ordre === 'faux')) return { k, etat: 'fait', at: Number(p[k]) };", "if (true) return { k, etat: 'fait', at: Number(p[k]) || 0 };"],
      ['lancer-sans-recap', "const l = q('[data-depot-lancer]'); if (l) l.addEventListener('click', () => { recap = true; refus = null; rendre(); });", "const l = q('[data-depot-lancer]'); if (l) l.addEventListener('click', () => { demander({ from: 'vrm-badge', action: 'depotLancer', ids: [...sel], mode, confirme: true }, () => {}); });"]];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdepot-'));
    for (const [nom, de, vers] of MUT) {
      if (!src.includes(de)) { console.log('❌ mutation ' + nom + ' : motif introuvable'); bien = false; continue; }
      const p = path.join(tmp, nom + '.js'); fs.writeFileSync(p, src.replace(de, vers));
      const r = cp.spawnSync(process.execPath, [__filename, '--depot', p], { env: { ...process.env, SILENCE: '1', BANC_CAPTURES: tmp }, encoding: 'utf8', timeout: 900000 });
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation ${nom} ⇒ ${r.status !== 0 ? 'rouge' : 'VERT'}`); if (r.status === 0) bien = false;
    }
    process.exit(bien ? 0 : 1);
  }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const [nomT, o] of [['390-orion-light', { largeur: 390, hauteur: 844, mobile: true, orion: true }], ['390-orion-dark', { largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'dark' }], ['1512-light', {}], ['1512-dark', { scheme: 'dark' }]]) {
      console.log(`— ${nomT}`);
      // D1–D3 : le lien de l'app « Déposer » (deux fiches), la liste, le récapitulatif, la confirmation.
      { const t = await ouvrir(nav, { ...o, url: 'https://www.vinted.fr/catalog?vrm=panneau&page=publier&action=deposer&ids=f41,f42' });
        let a = await lire(t.pg);
        dit(a.depot === 'liste' && JSON.stringify(a.fiches) === JSON.stringify(['f41:oui*', 'f42:oui*', 'f43:non']) && a.modes.join(' ') === 'brouillon:true publier:false', `${nomT} D1 le lien « Déposer » ouvre les brouillons préparés, ses fiches PRÉ-COCHÉES, la déposée grisée, « Brouillon Vinted » choisi`, JSON.stringify(a));
        if (!o.scheme) await capture(t.pg, nomT + '-liste');
        await clic(t.pg, '[data-depot-mode="publier"]'); a = await lire(t.pg);
        dit(JSON.stringify(a.fiches) === JSON.stringify(['f41:oui*', 'f42:non', 'f43:non']) && a.manques.includes('colis') && a.lancer && /Déposer 1 sur Vinted/.test(a.lancer.t), `${nomT} D3 « Publier » : la fiche sans colis n’est plus cochable, « Manque : le colis » ; « Déposer 1 »`, JSON.stringify(a));
        if (!o.scheme) await capture(t.pg, nomT + '-publier');
        await clic(t.pg, '[data-depot-lancer]'); a = await lire(t.pg);
        dit(a.depot === 'recap' && !a.envoyes.some((m) => m.action === 'depotLancer'), `${nomT} D2 « Déposer 1 » ⇒ le récapitulatif ; RIEN n’est parti`, JSON.stringify(a.envoyes));
        await capture(t.pg, nomT + '-recap');
        await clic(t.pg, '[data-depot-confirmer]'); a = await lire(t.pg);
        const dl = a.envoyes.filter((m) => m.action === 'depotLancer');
        dit(dl.length === 1 && JSON.stringify(dl[0].ids) === '["f41"]' && dl[0].mode === 'publier' && dl[0].confirme === true && a.depot === 'lot', `${nomT} D2b « Confirmer le dépôt » ⇒ UN depotLancer (f41, publier, confirmé), puis le suivi`, JSON.stringify(dl));
        dit(!a.petits.length && !a.debord && !t.erreurs.length, `${nomT} cibles ≥ 44 px, rien ne déborde, aucune erreur`, JSON.stringify({ p: a.petits, d: a.debord, e: t.erreurs }));
        await t.ctx.close(); }
      // D4 : un lot en cours — la frise sur ses preuves, l'arrêt en ambre, l'avant / après.
      { const t = await ouvrir(nav, { ...o, url: 'https://www.vinted.fr/catalog?vrm=panneau&page=publier&action=deposer&ids=f41', lot: LOT });
        const a = await lire(t.pg);
        const f1 = a.frises.f41 || [], f2 = a.frises.f42 || [];
        dit(JSON.stringify(f1) === JSON.stringify(['photos:fait', 'formulaire:fait', 'brouillon:fait', 'ordre:arret', 'numero:attente', 'enLigne:attente']) && JSON.stringify(f2) === JSON.stringify(['photos:fait', 'formulaire:cours', 'brouillon:attente', 'ordre:attente', 'numero:attente', 'enLigne:attente']), `${nomT} D4 la frise : « fait » seulement sur preuve ; l’ordre faux « arrêté ici » ; la fiche en cours sur la 1re étape sans preuve`, JSON.stringify(a.frises));
        dit(a.aa.length === 10 && a.aa[0] === 'photos:ecart' && a.aa.slice(1).every((x) => /:ok$/.test(x)), `${nomT} D4b l’avant / après : ta fiche | relu chez Vinted, l’écart (photos) marqué`, JSON.stringify(a.aa));
        await capture(t.pg, nomT + '-lot');
        await t.ctx.close(); }
      // R1 : « Republier » d'une annonce (lien de l'app, puis la fiche ⋯) ⇒ la feuille directe, puis « Republier maintenant ».
      { const t = await ouvrir(nav, { ...o, url: 'https://www.vinted.fr/catalog?vrm=panneau&page=republier&action=republier-direct&ids=7001' });
        await t.pg.waitForTimeout(400);
        let a = await lire(t.pg);
        const ver = a.envoyes.filter((m) => m.action === 'atelierVerifier');
        dit(a.direct && /Republier cette annonce/.test(a.direct.titre) && a.direct.lancer && /Republier maintenant/.test(a.direct.lancer.t) && !a.direct.lancer.off && ver.length >= 1 && !a.envoyes.some((m) => m.action === 'atelierLancer'), `${nomT} R1 « Republier » d’une annonce ⇒ la feuille Avant | Après de CETTE paire (contrôle demandé) ; rien ne part`, JSON.stringify(a));
        await capture(t.pg, nomT + '-republier-direct');
        await clic(t.pg, '[data-repub-direct] [data-atelier-lancer]'); a = await lire(t.pg);
        const al = a.envoyes.filter((m) => m.action === 'atelierLancer');
        dit(al.length === 1 && JSON.stringify(al[0].ids) === '["7001"]' && al[0].confirme === true, `${nomT} R1b « Republier maintenant » (2e toucher) ⇒ UN atelierLancer de CETTE paire (le chemin de l’atelier)`, JSON.stringify(al));
        await t.ctx.close(); }
      { const t = await ouvrir(nav, { ...o, url: 'https://www.vinted.fr/catalog?vrm=panneau&page=annonces' });
        await clic(t.pg, '[data-fiche-b="a:7002"]');
        await clic(t.pg, '[data-repub-direct-b="7002"]');
        const a = await lire(t.pg);
        dit(a.direct && a.direct.lancer && !a.envoyes.some((m) => m.action === 'atelierLancer'), `${nomT} R2 « Republier » dans la fiche ⋯ d’une ligne ⇒ la même feuille directe, rien ne part`, JSON.stringify(a.direct));
        await t.ctx.close(); }
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc panneau-depot : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
