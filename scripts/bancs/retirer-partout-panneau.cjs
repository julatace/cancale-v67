// ════════════════════════════════════════════════════════════════════════
//  BANC « VENDUE → RETIRÉE SUR » DANS LE PANNEAU (21 nov., ext. 5.426, choix 49 de Julien — « une paire vendue est
//  retirée partout »). Le VRAI vrm-badge.js + vrm-ui.js dans une page (faux `chrome` : il répond ce que dirait le fond ;
//  `retraitsPourPanneau` et le moteur sont jugés sur le vrai background.js par scripts/audit-retirer-partout.cjs).
//  390 px au doigt puis 1512 px à la souris, clair et sombre, sur vinted.fr et leboncoin.fr. On juge :
//   · Accueil : « Vendue → retirée sur », une rangée par paire, une étiquette par site (ambre = encore à retirer),
//     « 2 retrait(s) en attente : ouvre Leboncoin » et le retard de plus de 30 min DITS ;
//   · Automatisations → « Retirer partout » : Vinted « Activé » (toujours), Leboncoin et Vestiaire avec leur bouton ;
//     allumer ⇒ « Oui, allumer » d'abord (rien ne part avant), puis la demande `reglageAuto` confirmée ; éteindre ⇒
//     part sans confirmation ; Vestiaire dit qu'il ne sait pas mettre UNE annonce en pause ; eBay se règle dans VRM ;
//   · cibles ≥ 44 px, rien ne déborde, aucune erreur de page.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : la 5.419 (rouge attendu). Tout est inventé (dépôt public).
//  Captures : BANC_CAPTURES/retirer-partout-panneau (sinon scripts/bancs/captures/…).
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.existsSync(path.join(EXT, 'vrm-ui.js')) ? fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8') : '';
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'retirer-partout-panneau') : path.join(__dirname, 'captures', 'retirer-partout-panneau');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };
const MIN = 60000, H = 3600000, T0 = Date.now();

const RETRAITS = { lu: true, n: 3, enRetard: 1, attente: { leboncoin: 2 }, reglage: { leboncoin: false, vestiaire: true, vinted: true, ebay: true },
  lignes: [
    { num: '17', venduSur: 'Vinted', sites: [{ site: 'leboncoin', id: '2600000017', etat: 'attente', depuis: T0 - 40 * MIN, retard: true }, { site: 'vestiaire', id: '71000017', etat: 'a-faire', depuis: T0 - 10 * MIN, retard: false }, { site: 'ebay', id: '3990017', etat: 'ebay', depuis: null, retard: false }] },
    { num: '23', venduSur: 'Leboncoin', sites: [{ site: 'vinted', id: '9105000023', etat: 'retiree', depuis: null, retard: false }] },
    { num: 'B125', venduSur: 'eBay', sites: [{ site: 'leboncoin', id: '2600000125', etat: 'attente', depuis: T0 - 5 * MIN, retard: false }, { site: 'vinted', id: '9105000125', etat: 'hors-ligne', depuis: null, retard: false }] },
  ] };
const SITES = {
  vinted: { url: 'https://www.vinted.fr/catalog', etat: { ok: true, plateforme: 'vinted', capte: true, version: '5.426.0', code: '5.426.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'shop_sophie', choix: 'oui' }, secu: { niveau: 'ok', texte: 'Tout va bien' }, toutArrete: false, flux: { okAt: T0 - 3 * MIN }, liens: [], capteCoupe: false },
    listes: { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' }, annonces: { lu: T0 - 20 * MIN, total: 0, liste: [], toutes: [], nTous: 0, statuts: { en_vente: 0 } }, ventes: { lu: T0, total: 0, liste: [] }, messages: { lu: T0, liste: [] },
      automatisations: { offres: { actif: false, minis: 0 }, favoris: { regle: true, versions: 1, rythme: 'normal', auto: { actif: false } }, baisse: null }, notifications: { vu: T0, liste: [] }, retraits: RETRAITS, autres: null } },
  leboncoin: { url: 'https://www.leboncoin.fr/mes-annonces', etat: { ok: true, plateforme: 'leboncoin', capte: true, version: '5.426.0', code: '5.426.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr' }, site: { id: 'lbc-account:moi', nom: 'Sophie' }, lbc: { compte: { ok: true, texte: 'Sophie' }, annonces: { ok: true, texte: '2 annonces' }, ventes: { ok: true, texte: '1 vente' } }, flux: { okAt: T0 - 3 * MIN }, liens: [], capteCoupe: false },
    listes: { ok: true, plateforme: 'leboncoin', compte: { id: 'moi', nom: 'Sophie' }, annonces: { lu: T0 - H, total: 0, liste: [], toutes: [], nTous: 0, statuts: { en_vente: 0 }, sansCompte: 0 }, ventes: { lu: null, total: 0, liste: [] }, messages: { lu: null, site: 'leboncoin', nonlusSite: 0, liste: [] },
      automatisations: { site: 'leboncoin', cle: 'lbc:moi', baisse: { actif: false, pct: null, jours: null } }, notifications: { vu: T0, liste: [] }, retraits: RETRAITS, autres: null } },
};
async function ouvrir(nav, site, { scheme, largeur, hauteur, mobile }) {
  const S = SITES[site];
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => (/logo-vrm-96\.png/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', body: LOGO }) : r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;font-family:sans-serif"><main style="padding:20px;height:2000px">Le site</main></body></html>' })));
  await pg.goto(S.url);
  await pg.evaluate(({ e, js, ui, L }) => {
    window.__envoyes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = { runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
      sendMessage: (msg, cb) => { window.__envoyes.push(copie(msg)); let rep = { ok: true };
        if (msg.action === 'etat') rep = copie(e); else if (msg.action === 'carteListes') rep = copie(L); else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
        else if (msg.action === 'reglageAuto') rep = msg.confirme === true || !(msg.valeur && msg.valeur.actif) ? { ok: true, relu: true } : { ok: false, code: 'confirmation' };
        setTimeout(() => cb && cb(rep), 0); } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } } };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: S.etat, js: BADGE, ui: UI, L: S.listes });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(220); };
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(400);
};
const lire = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const carte = q('.carte');
  return {
    accueil: !!q('[data-accueil-retraits]'),
    attente: Array.from(r.querySelectorAll('[data-rp-attente]')).map((x) => x.getAttribute('data-rp-attente') + ':' + x.getAttribute('data-n') + ':' + x.textContent.trim()),
    retard: q('[data-rp-retard]') ? q('[data-rp-retard]').textContent.trim() : '',
    rangs: Array.from(r.querySelectorAll('[data-rp-num]')).filter(vis).map((x) => x.getAttribute('data-rp-num') + '=' + Array.from(x.querySelectorAll('[data-rp-site]')).map((s) => s.getAttribute('data-rp-site') + ':' + s.getAttribute('data-rp-etat') + (s.getAttribute('data-ton') === 'ambre' ? '!' : '')).join(',')),
    detail: !!q('[data-rp-detail]') && vis(q('[data-rp-detail]')),
    reglages: Array.from(r.querySelectorAll('[data-rp-reglage]')).map((x) => x.getAttribute('data-rp-reglage') + ':' + ((x.querySelector('[data-rp-bascule]') && x.querySelector('[data-rp-bascule]').getAttribute('aria-pressed')) || (x.querySelector('[data-etat]') && x.querySelector('[data-etat]').getAttribute('data-etat')) || '')),
    confirme: q('[data-rp-confirme]') ? q('[data-rp-confirme]').getAttribute('data-rp-confirme') + ':' + q('[data-rp-confirme]').textContent.trim().slice(0, 120) : '',
    vcNote: q('[data-rp-reglage="vestiaire"] small') ? q('[data-rp-reglage="vestiaire"] small').textContent : '',
    petits: Array.from(r.querySelectorAll('[data-rp-bascule], [data-rp-oui], [data-rp-non], [data-auto-choix="retirer"]')).filter(vis).filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.outerHTML.slice(0, 60) + ':' + Math.round(b.getBoundingClientRect().height)),
    debord: document.documentElement.scrollWidth > window.innerWidth || (carte && carte.scrollWidth > carte.clientWidth + 1),
    envoyes: window.__envoyes.filter((m) => m.action === 'reglageAuto'),
  };
});

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  try {
    for (const [largeur, hauteur, mobile] of [[390, 844, true], [1512, 900, false]]) for (const site of ['vinted', 'leboncoin']) for (const scheme of ['light', 'dark']) {
      const T = `${site} ${largeur} ${scheme}`; console.log('\n' + T);
      try {
        const t = await ouvrir(nav, site, { scheme, largeur, hauteur, mobile });
        await montrer(t.pg, mobile);
        await clic(t.pg, '[data-onglet-b="accueil"]');
        await t.pg.waitForTimeout(250);
        let a = await lire(t.pg);
        await t.pg.screenshot({ path: path.join(SORTIE, `${largeur}-${site}-${scheme}-accueil.png`) });
        dit(a.accueil && a.rangs.join(' | ') === '17=leboncoin:attente!,vestiaire:a-faire!,ebay:ebay | 23=vinted:retiree | B125=leboncoin:attente!,vinted:hors-ligne', `${T} : Accueil — une rangée par paire, une étiquette par site, ambre = encore à retirer`, JSON.stringify(a.rangs));
        dit(a.attente.length === 1 && /^leboncoin:2:2 retrait\(s\) en attente : ouvre Leboncoin$/.test(a.attente[0]) && /30 min/.test(a.retard), `${T} : « 2 retrait(s) en attente : ouvre Leboncoin » et le retard de plus de 30 min, dits`, JSON.stringify({ at: a.attente, r: a.retard }));
        await clic(t.pg, '[data-onglet-b="automatisations"]');
        await clic(t.pg, '[data-auto-choix="retirer"]');
        a = await lire(t.pg);
        await t.pg.screenshot({ path: path.join(SORTIE, `${largeur}-${site}-${scheme}-automatisations.png`) });
        dit(a.detail && a.reglages.join(',') === 'vinted:on,leboncoin:false,vestiaire:true,ebay:on', `${T} : « Retirer partout » — Vinted activé, Leboncoin éteint, Vestiaire allumé, eBay lu`, JSON.stringify(a.reglages));
        dit(/ne permet pas de mettre UNE annonce en pause/.test(a.vcNote), `${T} : Vestiaire dit qu’il ne sait pas mettre UNE annonce en pause (rien n’est cliqué)`, a.vcNote);
        await clic(t.pg, '[data-rp-bascule="leboncoin"]');
        a = await lire(t.pg);
        await t.pg.screenshot({ path: path.join(SORTIE, `${largeur}-${site}-${scheme}-confirmer.png`) });
        dit(a.envoyes.length === 0 && /^leboncoin:Allumer le retrait automatique sur Leboncoin/.test(a.confirme), `${T} : allumer Leboncoin ⇒ « Oui, allumer » d’abord, rien ne part`, JSON.stringify({ c: a.confirme, e: a.envoyes }));
        await clic(t.pg, '[data-rp-oui]');
        a = await lire(t.pg);
        dit(a.envoyes.length === 1 && a.envoyes[0].cle === 'vrm_retirer_partout_reglage' && a.envoyes[0].valeur.site === 'leboncoin' && a.envoyes[0].valeur.actif === true && a.envoyes[0].confirme === true, `${T} : « Oui » ⇒ la demande part, confirmée, pour Leboncoin seulement`, JSON.stringify(a.envoyes));
        await clic(t.pg, '[data-rp-bascule="vestiaire"]');
        a = await lire(t.pg);
        dit(a.envoyes.length === 2 && a.envoyes[1].valeur.site === 'vestiaire' && a.envoyes[1].valeur.actif === false && a.envoyes[1].confirme !== true && !a.confirme, `${T} : éteindre Vestiaire part sans confirmation`, JSON.stringify(a.envoyes));
        dit(!a.petits.length, `${T} : cibles ≥ 44 px`, JSON.stringify(a.petits));
        dit(!a.debord, `${T} : rien ne déborde`);
        dit(t.erreurs.length === 0, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs));
        await t.ctx.close();
      } catch (e) { ko++; console.log(`  ❌ ${T} — a levé : ${String(e && e.message).slice(0, 220)}`); }
    }
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ retirer-partout-panneau : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ retirer-partout-panneau : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
