// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA CARTE VRM SUR LEBONCOIN.FR, CLAIRE » (5.335.0, 9 nov.)
//
//  Julien (9 nov.) : « Le "à confirmer" je ne comprends pas, ça doit être
//  beaucoup plus clair ». La carte disait « Identifiant détecté · identité à
//  confirmer », « nouvelle intégration non confirmée dans cet onglet », « VRM
//  n'a pas confirmé l'enregistrement du compte ».
//
//  Le VRAI vrm-badge.js est chargé dans une page leboncoin.fr ; l'état qu'il
//  reçoit est fabriqué par la VRAIE `resumeCarteLbc` du VRAI background.js
//  (scripts/_fond-vm.cjs) — la carte n'invente rien. 390 px au doigt et
//  1512 px, clair et sombre ; captures dans BANC_CAPTURES (ou bancs/captures).
//  Exige : trois lignes humaines (Compte · Annonces · Ventes), « ✓ » quand
//  c'est prouvé, UN seul geste, aucun mot du jargon d'avant, des cibles ≥ 44 px,
//  « à retirer » seulement prouvé. Données INVENTÉES (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { faireFond } = require('../_fond-vm.cjs');

const EXT = path.join(__dirname, '..', '..', 'vinted-sync-extension');
const JS = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
fs.mkdirSync(SORTIE, { recursive: true });

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const MIN = 60000;
const JARGON = /intégration|identité à confirmer|enregistrement du compte|Identifiant détecté|capteur|relais/i;

const fond = faireFond({});
const resume = (o) => fond.ctx.resumeCarteLbc(Object.assign({ code: '5.335.0', maintenant: Date.now() }, o));
const VRM = { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true };
const CPT = 'lbc-account:8442aaaa-0000-4000-8000-000000000001';
const base = { ok: true, plateforme: 'leboncoin', capte: true, version: '5.335.0', code: '5.335.0', vrm: VRM, site: { id: CPT, nom: 'Sophie B.' }, flux: { okAt: Date.now() - 2 * MIN }, bascule: null };
const T = { capteur: true, capteurVersion: '5.335.0', compte: CPT };
const ETATS = {
  // Tout est prouvé : le compte, 37 annonces lues en entier, 4 ventes.
  prouve: Object.assign({}, base, { lbc: resume({ vrm: VRM, transport: Object.assign({}, T, { lecture: { compte: CPT.slice(12), total: 37, at: Date.now() - 2 * MIN }, receptions: { transactions: { etat: 'enregistre', nombre: 4, at: Date.now() - 1 * MIN } } }), connu: { v: 2, id: CPT, name: 'Totomondu' }, lecture: null }),
    aRetirer: { at: new Date().toISOString(), liste: [{ numero: '18', lbcId: '3300000105', titre: 'Paire inventée taille 40', url: 'https://www.leboncoin.fr/ad/chaussures/3300000105', lu: Date.now() - 2 * MIN }] } }),
  // Le cas de Julien après la 5.335 : la page a lu le compte avant la connexion,
  // la session arrive : « reconnu, enregistrement en cours… », aucun jargon.
  enCours: Object.assign({}, base, { lbc: resume({ vrm: VRM, transport: Object.assign({}, T, { erreurCapture: 'session' }), connu: null, lecture: null }) }),
  // Deux comptes Leboncoin dans le même onglet : rien n'est envoyé, UN geste.
  ambigu: Object.assign({}, base, { lbc: resume({ vrm: VRM, transport: { capteur: true, capteurVersion: '5.335.0', compte: '', ambigue: true }, connu: null, lecture: null }) }),
  // Lecture complète vieille de 30 h : le geste qui la refait.
  vieille: Object.assign({}, base, { lbc: resume({ vrm: VRM, transport: Object.assign({}, T, { lecture: { compte: CPT.slice(12), total: 37, at: Date.now() - 30 * 3600e3 } }), connu: { v: 2, id: CPT, name: 'Totomondu' }, lecture: null }) }),
};

async function rendre(nav, etat, { scheme = 'light', mobile = false } = {}) {
  const ctx = await nav.newContext(mobile ? { colorScheme: scheme, viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { colorScheme: scheme, viewport: { width: 1512, height: 900 } });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f4f4f4;font-family:sans-serif"><h1 style="padding:20px;font-size:18px">Mes annonces (page d’essai)</h1></body></html>' });
  });
  await pg.goto('https://www.leboncoin.fr/compte/part/mes-annonces');
  await pg.evaluate(({ e, js }) => {
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = { runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.335.0' }), lastError: null,
      sendMessage: (msg, cb) => setTimeout(() => cb && cb(msg.action === 'etat' ? e : { ok: true }), 0) }, storage: { onChanged: { addListener() {} } } };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: etat, js: JS });
  await pg.waitForTimeout(250);
  if (mobile) await pg.tap('#vrm-badge').catch(() => {}); else await pg.mouse.move(1512 - 16 - 22, 900 - 16 - 22);
  await pg.waitForTimeout(300);
  return { ctx, pg, erreurs };
}
const lire = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot;
  const c = r.querySelector('.carte');
  const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  return { texte: c ? c.innerText : '', visible: vis(c), etats: [...r.querySelectorAll('[data-lbc-etat]')].map((x) => x.getAttribute('data-lbc-etat')),
    gestes: r.querySelectorAll('[data-lbc-geste]').length, recharger: r.querySelector('[data-lbc-recharger]') ? Math.round(r.querySelector('[data-lbc-recharger]').getBoundingClientRect().height) : 0,
    boutons: [...r.querySelectorAll('.carte button')].filter((b) => vis(b)).map((b) => Math.round(b.getBoundingClientRect().height)),
    largeur: c ? Math.round(c.getBoundingClientRect().width) : 0, deborde: c ? c.scrollWidth > c.clientWidth + 1 : false,
    aRetirer: [...r.querySelectorAll('[data-a-retirer]')].map((x) => x.getAttribute('data-a-retirer')) };
});

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const [nom, etat] of Object.entries(ETATS)) {
    for (const mobile of [true, false]) for (const scheme of ['light', 'dark']) {
      const tag = `${nom}-${mobile ? 390 : 1512}-${scheme === 'light' ? 'clair' : 'sombre'}`;
      console.log(`\n── ${tag}`);
      const { ctx, pg, erreurs } = await rendre(nav, etat, { scheme, mobile });
      const l = await lire(pg);
      await pg.screenshot({ path: path.join(SORTIE, `lbc-clair-${tag}.png`) });
      dit(l.visible, 'la carte s’ouvre');
      dit(!JARGON.test(l.texte), 'aucun mot du jargon d’avant', l.texte.replace(/\n/g, ' · ').slice(0, 300));
      dit(/Compte Leboncoin/.test(l.texte) && /Annonces/.test(l.texte) && /Ventes/.test(l.texte), 'trois lignes : Compte Leboncoin · Annonces · Ventes', l.texte.replace(/\n/g, ' · ').slice(0, 300));
      dit(l.gestes <= 1, 'un seul geste au plus', String(l.gestes));
      dit(l.boutons.every((h) => h >= 44), 'chaque bouton visible fait au moins 44 px', JSON.stringify(l.boutons));
      dit(!l.deborde, 'rien ne déborde de la carte', String(l.largeur));
      dit(!erreurs.length, 'aucune erreur de page', erreurs.join(' | '));
      if (nom === 'prouve') {
        dit(JSON.stringify(l.etats) === '["ok","ok","ok"]' && /Totomondu/.test(l.texte) && /37 lues en entier il y a 2 min/.test(l.texte) && /4 lues il y a 1 min/.test(l.texte), '« Totomondu ✓ », « 37 lues en entier il y a 2 min ✓ », « 4 lues il y a 1 min ✓ »', l.texte.replace(/\n/g, ' · ').slice(0, 300));
        dit(l.gestes === 0, 'tout est prouvé : aucun geste');
        dit(JSON.stringify(l.aRetirer) === '["3300000105"]' && /vendue sur Vinted, encore en ligne ici \(vu il y a 2 min\)/.test(l.texte), 'à retirer : la paire prouvée en ligne, avec quand', l.texte.replace(/\n/g, ' · ').slice(0, 400));
      }
      if (nom === 'enCours') dit(/reconnu, enregistrement en cours/.test(l.texte) && l.etats[0] === 'attente', 'compte vu par la page, session arrivée : « reconnu, enregistrement en cours… » (gris, pas une alerte)', l.texte.replace(/\n/g, ' · ').slice(0, 300));
      if (nom === 'ambigu') dit(/deux comptes Leboncoin/.test(l.texte) && l.gestes === 1 && l.recharger >= 44, 'deux comptes : la phrase, UN geste et « Recharger la page » (≥ 44 px)', `${l.recharger} px · ` + l.texte.replace(/\n/g, ' · ').slice(0, 300));
      if (nom === 'vieille') dit(/trop ancien/.test(l.texte) && /Ouvre « Mes annonces »/.test(l.texte) && l.gestes === 1, 'lecture de 30 h : « trop ancien », le geste « Ouvre Mes annonces »', l.texte.replace(/\n/g, ' · ').slice(0, 300));
      await ctx.close();
    }
  }
  await nav.close();
  console.log(ko ? `\n❌ lbc-clair-carte : ${ok} verts, ${ko} rouges` : `\n✅ lbc-clair-carte : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
