// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE MINI-RÉSUMÉ DU MOIS DANS LA CARTE DU LOGO » (5.354, lot extension-resume)
//
//  Le VRAI vrm-badge.js dans une page (faux `chrome` : il répond ce que dirait le
//  service worker — la règle du service worker, elle, est exécutée par
//  `scripts/audit-resume-carte.cjs` sur le VRAI background.js). 390 px au doigt et
//  1512 px à la souris, clair et sombre, captures dans `captures/carte-resume-mois`.
//  Ce que le banc juge (data-* et nombres rendus, §6.4) :
//   · replié sous UNE ligne discrète (« Ce mois dans VRM »), ouvert : les trois
//     chiffres de VRM, « Voir dans VRM » (écran journee), « Masquer ce résumé » ;
//   · « pas su » ⇒ « — », jamais « 0 € » ; « au moins » quand VRM le dit, jamais
//     « au moins 0 € » ;
//   · aucune couleur sur les chiffres (§7 : rien à rattraper ici) ;
//   · absent du service worker (compte de l'onglet pas prouvé) ou pas connecté ⇒
//     aucune ligne ; masqué ⇒ « Afficher le résumé du mois » dans le détail ;
//   · cibles au doigt ≥ 44 px, la carte dans l'écran, aucune erreur de page.
//  Tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'carte-resume-mois') : path.join(__dirname, 'captures', 'carte-resume-mois');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 200)}`); return null; } };

const MIN = 60000;
const MOIS = (x) => Object.assign({ ca: 1340, caAuMoins: false, ventes: 42, aExpedier: 3, aExpedierAuMoins: false, maj: Date.now() - 2 * 60 * MIN, raison: null, lu: Date.now() - MIN }, x || {});
const base = (x) => Object.assign({ ok: true, plateforme: 'vinted', capte: true, version: VERSION, code: VERSION,
  vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'shop_x', choix: 'oui' }, flux: { okAt: Date.now() - 3 * MIN }, bascule: null, mois: MOIS() }, x || {});

async function ouvrir(nav, etat, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    if (/logo-vrm-96\.png/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">Une page du site</header><main style="padding:20px;height:2000px">Annonces…</main></body></html>' });
  });
  await pg.goto('https://www.vinted.fr/member/1');
  await pg.evaluate(({ e, js }) => {
    window.__envoyes = [];
    // Un vrai `sendMessage` COPIE la réponse : la carte ne peut jamais modifier l'état du service worker.
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const moisInitial = copie(e.mois === undefined ? null : e.mois);
    window.__etat = copie(e);
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    const store = {};
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(msg);
          // Le service worker range le réglage ; l'état suivant le porte (comme moisPourCarte).
          if (msg.action === 'resumeMasque') window.__etat = Object.assign({}, window.__etat, { mois: msg.masque ? { masque: true } : copie(moisInitial) });
          setTimeout(() => cb && cb(msg.action === 'etat' ? copie(window.__etat) : { ok: true, masque: !!msg.masque }), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { Object.assign(store, o); if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: etat, js: BADGE });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}

const lire = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge');
  if (!h || !h.shadowRoot) return null;
  const r = h.shadowRoot, q = (s) => r.querySelector(s);
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const m = q('[data-mois]'), l = q('[data-mois-ca]'), carte = q('.carte');
  return {
    carteVisible: !!(carte && getComputedStyle(carte).display !== 'none'), carte: rect(carte), btn: rect(q('.btn')),
    mois: !!m, ouvert: !!(m && m.open), resume: m ? m.querySelector('summary').innerText.trim() : '',
    ligneVisible: !!(l && l.getClientRects().length && !l.closest('details:not([open])')),
    texte: l ? l.innerText.replace(/[\u202f\u00a0]/g, ' ').trim() : '', note: q('[data-mois-note]') ? q('[data-mois-note]').innerText.trim() : '',
    ca: l ? l.getAttribute('data-mois-ca') : null, ventes: l ? l.getAttribute('data-mois-ventes') : null, expedier: l ? l.getAttribute('data-mois-expedier') : null,
    couleurs: l ? Array.from(l.querySelectorAll('b')).map((b) => getComputedStyle(b).color) : [], couleurTexte: carte ? getComputedStyle(carte).color : '',
    hauteurs: m && m.open ? Array.from(m.querySelectorAll('summary, button')).map((b) => Math.round(b.getBoundingClientRect().height)) : [],
    voir: !!q('[data-mois-voir]'), masquer: !!q('[data-mois-masquer]'), afficher: !!q('[data-mois-afficher]'),
    ordre: (() => { const g = q('[data-ouvrir-vrm]'), d = q('details[data-detail]'); if (!m || !g || !d) return null; return !!(g.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(m.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING); })(),
    envoyes: window.__envoyes.filter((x) => x.action !== 'etat'),
    debord: document.documentElement.scrollWidth > window.innerWidth,
  };
});
const dedans = (c, W, H) => !!c && c.x >= 0 && c.y >= 0 && c.r <= W && c.b <= H;
const montrer = async (pg, mobile) => {
  const a = await lire(pg);
  if (mobile) await pg.tap('#vrm-badge', { position: { x: a.btn.w / 2, y: a.btn.h / 2 } }).catch(() => {});
  else { await pg.mouse.move(5, 5); await pg.waitForTimeout(80); await pg.mouse.move(a.btn.x + a.btn.w / 2, a.btn.y + a.btn.h / 2); }
  await pg.waitForTimeout(320);
};
const deplier = async (pg) => { await pg.evaluate(() => { const m = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-mois] > summary'); if (m) m.click(); }); await pg.waitForTimeout(150); };
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(150); };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };

  console.log('A. Replié sous une ligne discrète, ouvert : les trois chiffres de VRM');
  for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 760, true]]) for (const scheme of ['light', 'dark']) {
    await essaie(`A ${largeur} ${scheme}`, async () => {
      const t = await ouvrir(nav, base(), { scheme, largeur, hauteur, mobile });
      await montrer(t.pg, mobile);
      const a = await lire(t.pg);
      await cap(t.pg, `replie-${largeur}-${scheme}`);
      dit(a.mois && !a.ouvert && a.resume === 'Ce mois dans VRM' && !a.ligneVisible, `${largeur} ${scheme} : replié sous « Ce mois dans VRM »`, JSON.stringify({ m: a.mois, o: a.ouvert, r: a.resume }));
      dit(a.ordre === true, `${largeur} ${scheme} : sous « Ouvrir VRM », au-dessus de « Détails »`, String(a.ordre));
      await deplier(t.pg);
      const b = await lire(t.pg);
      await cap(t.pg, `ouvert-${largeur}-${scheme}`);
      dit(b.ligneVisible && b.texte === 'Ce mois : 1 340 € vendus · 42 ventes · 3 à expédier', `${largeur} ${scheme} : « Ce mois : 1 340 € vendus · 42 ventes · 3 à expédier »`, b.texte);
      dit(b.ca === '1340' && b.ventes === '42' && b.expedier === '3', `${largeur} ${scheme} : les nombres rendus sont ceux du service worker`, `${b.ca}/${b.ventes}/${b.expedier}`);
      dit(/^Chiffres de VRM, publiés il y a 2 h\.$/.test(b.note), `${largeur} ${scheme} : l'âge des chiffres est dit`, b.note);
      dit(b.couleurs.length === 3 && b.couleurs.every((c) => c === b.couleurTexte), `${largeur} ${scheme} : aucune couleur sur les chiffres`, JSON.stringify([b.couleurs, b.couleurTexte]));
      dit(b.voir && b.masquer, `${largeur} ${scheme} : « Voir dans VRM » et « Masquer ce résumé »`, '');
      if (mobile) dit(b.hauteurs.length >= 3 && b.hauteurs.every((x) => x >= 44), '390 au doigt : chaque cible ≥ 44 px', JSON.stringify(b.hauteurs));
      dit(dedans(b.carte, largeur, hauteur) && !b.debord, `${largeur} ${scheme} : la carte reste dans l'écran, rien ne déborde`, JSON.stringify(b.carte));
      dit(!t.erreurs.length, `${largeur} ${scheme} : aucune erreur de page`, t.erreurs.join(' | '));
      await t.ctx.close();
    });
  }

  console.log('B. Voir dans VRM, masquer, afficher');
  await essaie('B', async () => {
    const t = await ouvrir(nav, base());
    await montrer(t.pg, false); await deplier(t.pg);
    await clic(t.pg, '[data-mois-voir]');
    let a = await lire(t.pg);
    dit(a.envoyes.some((m) => m.action === 'ouvrirVRM' && m.ecran === 'journee'), '« Voir dans VRM » ouvre VRM sur Ma journée (écran de la liste blanche)', JSON.stringify(a.envoyes));
    await montrer(t.pg, false); await deplier(t.pg);
    await clic(t.pg, '[data-mois-masquer]');
    await t.pg.waitForTimeout(200);
    a = await lire(t.pg);
    dit(a.envoyes.some((m) => m.action === 'resumeMasque' && m.masque === true), '« Masquer ce résumé » : le réglage part au service worker', JSON.stringify(a.envoyes));
    dit(!a.mois && a.afficher, 'masqué : plus de ligne, « Afficher le résumé du mois » dans le détail', JSON.stringify({ m: a.mois, af: a.afficher }));
    await montrer(t.pg, false);
    await clic(t.pg, 'details[data-detail] > summary');
    await cap(t.pg, 'masque-1512-light');
    await clic(t.pg, '[data-mois-afficher]');
    await t.pg.waitForTimeout(400);
    a = await lire(t.pg);
    dit(a.envoyes.some((m) => m.action === 'resumeMasque' && m.masque === false) && a.mois, '« Afficher » : le résumé revient', JSON.stringify(a.envoyes.map((m) => m.action + ':' + m.masque)));
    await t.ctx.close();
  });

  console.log('C. Pas su ⇒ « — », jamais 0 ; « au moins » quand VRM le dit');
  const cas = [
    ['passu', MOIS({ ca: null, ventes: null, aExpedier: null, raison: 'mois' }), 'Ce mois : — vendus · — ventes · — à expédier', /^VRM n’a pas encore publié les chiffres de ce mois/],
    ['colis', MOIS({ aExpedier: null }), 'Ce mois : 1 340 € vendus · 42 ventes · — à expédier', /colis : ouvre VRM pour les recompter/],
    ['aumoins', MOIS({ caAuMoins: true, aExpedier: 4, aExpedierAuMoins: true }), 'Ce mois : au moins 1 340 € vendus · 42 ventes · au moins 4 à expédier', /^Chiffres de VRM/],
    ['aumoins0', MOIS({ ca: 0, caAuMoins: true, ventes: 2 }), 'Ce mois : — vendus · 2 ventes · 3 à expédier', /^Chiffres de VRM/],
    ['zero', MOIS({ ca: 0, ventes: 0, aExpedier: 0 }), 'Ce mois : 0 € vendus · 0 vente · 0 à expédier', /^Chiffres de VRM/],
    ['une', MOIS({ ca: 35, ventes: 1, aExpedier: 1 }), 'Ce mois : 35 € vendus · 1 vente · 1 à expédier', /^Chiffres de VRM/],
  ];
  for (const [nom, m, attendu, note] of cas) {
    await essaie(`C ${nom}`, async () => {
      const t = await ouvrir(nav, base({ mois: m }));
      await montrer(t.pg, false); await deplier(t.pg);
      const a = await lire(t.pg);
      if (nom === 'passu' || nom === 'aumoins') await cap(t.pg, `${nom}-1512-light`);
      dit(a.texte === attendu, `${nom} : « ${attendu} »`, a.texte);
      dit(note.test(a.note), `${nom} : la phrase dit ce qui manque`, a.note);
      dit(!/au moins 0/.test(a.texte), `${nom} : jamais « au moins 0 »`, a.texte);
      await t.ctx.close();
    });
  }

  console.log('D. Rien à un compte pas prouvé, rien sans connexion');
  for (const [nom, etat] of [['absent', base({ mois: null })], ['deconnecte', base({ vrm: { ok: true, connecte: false, cloisonne: true } })], ['passu-vrm', base({ vrm: null })]]) {
    await essaie(`D ${nom}`, async () => {
      const t = await ouvrir(nav, etat);
      await montrer(t.pg, false);
      const a = await lire(t.pg);
      dit(!a.mois && !a.afficher, `${nom} : aucune ligne du mois`, JSON.stringify({ m: a.mois, af: a.afficher }));
      await t.ctx.close();
    });
  }

  await nav.close();
  console.log(`\n  captures : ${SORTIE}`);
  console.log(ko ? `\n❌ carte-resume-mois : ${ok} verts, ${ko} rouges` : `\n✅ carte-resume-mois : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
