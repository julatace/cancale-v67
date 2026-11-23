// ════════════════════════════════════════════════════════════════════════
//  BANC « VESTIAIRE COMPLET » DANS LE GRAND PANNEAU (23 nov., ext. 5.444) — Julien : « le panneau de l'extension
//  n'affiche rien et ne marche pas du tout » (captures : Articles « 0 article · 3 lues sans compte », Commandes sans
//  photo ni prix et des statuts FAUX, Messagerie « aucune conversation », Favoris « personne », Notifications 0).
//  Le VRAI vrm-badge.js + vrm-ui.js dans une page vestiairecollective.com ; le faux `chrome` répond ce que rend le
//  VRAI fond (`carteListes`, `aimesVcCarte` — formes exécutées par scripts/audit-vc-complet.cjs). 1512 px à la souris
//  et 390 px au doigt, clair et sombre ; captures dans `captures/vestiaire-complet`. On juge :
//   · la barre : Articles · Ventes (plus « Commandes ») · Messagerie, et « Achats » ;
//   · Articles : l'annonce « En cours d'examen » a SON statut dans le filtre ;
//   · Ventes : photo, réf., prix et « pour vous », l'état de la règle (« En litige · Vestiaire examine » en ambre,
//     « Livrée · évaluation en cours », « Annulée ») ; la fiche montre la FRISE datée et le texte de Vestiaire ;
//   · Achats : Vestiaire « aucun achat » daté ; Leboncoin : « VRM ne lit pas encore » (jamais « aucun ») ;
//   · Messagerie : les conversations ; Favoris : « Faire une offre » seulement avec la recette apprise, prix tapé,
//     confirmation, puis la demande part avec `confirme: true` ; sans recette : une phrase, aucun bouton ;
//   · Notifications : « Quelqu'un a aimé · article », « Vente · article », la publicité comptée ;
//   · aucune erreur de page, rien ne déborde.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : la 5.443 (rouge attendu). Tout est inventé (dépôt public).
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
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'vestiaire-complet') : path.join(__dirname, 'captures', 'vestiaire-complet');
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4eechAAUoApeWrujeAAAAAElFTkSuQmCC', 'base64');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 220)}`); return null; } };
const H = 3600000, T0 = Date.now();
const ph = (id) => `https://images.vestiairecollective.com/produit/${id}-1_3.jpg`;

const VENTES = [
  { tx: '70000010', ref: '70000010', titre: 'Gucci Cabas en cuir Ophidia GG', prix: 209.52, pourVous: 203.23, photo: ph(70000010), date: T0 - 21 * 24 * H, etat: 'litige', etatVc: 'litige', vendue: true, num: '', bordereau: null, transporteur: 'Chronopost', suivi: 'XW000000001JF',
    frise: [{ k: 'sellerSale', statut: 'done', date: 'Le 2 novembre 2026', titre: 'Vente confirmée', texte: '', probleme: false }, { k: 'sellerShipment', statut: 'done', date: 'Le 7 novembre 2026', titre: 'Article expédié', texte: '', probleme: false }, { k: 'sellerDelivery', statut: 'done', date: 'Le 18 novembre 2026', titre: 'Article livré', texte: '', probleme: false }, { k: 'sellerConformity', statut: 'ongoing', date: 'Le 18 novembre 2026', titre: 'Évaluation de l’article', texte: 'Malheureusement, l’acheteur a signalé un problème avec cet article. Votre paiement a été mis en attente.', probleme: true }, { k: 'sellerPayment', statut: 'upcoming', date: '', titre: 'Paiement', texte: '', probleme: false }], lien: 'https://fr.vestiairecollective.com/my-account/orders-sales/?section=2' },
  { tx: '70000011', ref: '70000011', titre: 'Dior Bottes cavalières', prix: 120, pourVous: 96, photo: ph(70000011), date: T0 - 10 * 24 * H, etat: 'en_route', etatVc: 'livree_controle', vendue: true, num: '', frise: [], lien: '' },
  { tx: '70000012', ref: '70000012', titre: 'Gucci Cabas en cuir', prix: 238.1, pourVous: 190.48, photo: ph(70000012), date: T0 - 5 * 24 * H, etat: 'annulee', etatVc: 'annulee', vendue: false, num: '', frise: [{ k: 'sellerSale', statut: 'done', date: 'Le 18 novembre 2026', titre: 'Vente confirmée', texte: '', probleme: false }, { k: 'sellerShipment', statut: 'cancelled', date: 'Le 19 novembre 2026', titre: 'Annulé', texte: 'Vente annulée car : l’acheteur a demandé l’annulation de la commande', probleme: false }], lien: '' },
];
const ANNONCES = [
  { id: '70000001', titre: 'GUCCI Cabas en cuir Ophidia Shopping', prix: 306, photo: ph(70000001), photos: [ph(70000001)], statut: 'examen', depuis: null, favoris: null },
  { id: '70000002', titre: 'SÉZANE Santiags', prix: 77, photo: ph(70000002), photos: [ph(70000002)], statut: 'en_vente', depuis: T0 - 15 * 24 * H, favoris: 2 },
  { id: '70000003', titre: 'MIISTA Escarpins en cuir Taissa', prix: 59, photo: ph(70000003), photos: [ph(70000003)], statut: 'en_vente', depuis: T0 - 24 * 24 * H, favoris: 0 },
];
const LISTES_VC = { ok: true, plateforme: 'vestiaire', compte: { id: '42', nom: 'David' },
  annonces: { lu: T0 - 5 * 60000, aConfirmer: false, total: 3, liste: ANNONCES.filter((x) => x.statut === 'en_vente'), toutes: ANNONCES, nTous: 3, statuts: { en_vente: 2, brouillon: 0, masque: 0, reserve: 0, vendu: 0, a_confirmer: 0, examen: 1, a_corriger: 0, refusee: 0, retiree: 0 }, sansCompte: 0 },
  ventes: { lu: T0 - 5 * 60000, total: 3, liste: VENTES },
  achats: { lu: T0 - 10 * 60000, site: 'vestiaire', liste: [] },
  messages: { lu: T0 - 5 * 60000, site: 'vestiaire', sansCompte: 0, liste: [
    { conv: '33334444-70000001', qui: 'Gucci Cabas en cuir', texte: 'Merci encore', at: T0 - 3 * 24 * H, nonlu: true, photo: ph(70000001) },
    { conv: '44445555-70000001', qui: 'Gucci Cabas en cuir', texte: '↩ Bonjour, tout est exactement comme sur les photos', deMoi: true, at: T0 - 14 * 24 * H, nonlu: false, photo: ph(70000001) }] },
  automatisations: { site: 'vestiaire', cle: 'vc:42', baisse: { actif: false, pct: null, jours: null } },
  notifications: { vu: T0 - 2 * H, liste: [] },
  notifsSite: { lu: T0 - 10 * 60000, ignorees: 3, liste: [
    { id: 'n-1', at: T0 - 4 * H, lu: false, sorte: 'aime', produit: '70000001', titre: 'GUCCI Cabas en cuir Ophidia Shopping', photo: ph(70000001) },
    { id: 'n-4', at: T0 - 22 * H, lu: true, sorte: 'vente', produit: '70000010', titre: 'Gucci Cabas en cuir Ophidia GG', photo: ph(70000010) },
    { id: 'n-5', at: T0 - 23 * H, lu: true, sorte: 'aime', produit: '70000002', titre: 'SÉZANE Santiags', photo: ph(70000002) }] },
  autres: null };
const AIMES = (offre) => ({ ok: true, compte: '42', appris: true, offre, sansArticle: 0, articles: [
  { produit: '70000001', titre: 'GUCCI Cabas en cuir Ophidia Shopping', photo: ph(70000001), n: 2, ecrits: 0, offres: 0, prixC: 30600, dernier: T0 - 4 * H, gens: [{ url: 'https://fr.vestiairecollective.com/chat?id=33334444-70000001', conv: '33334444-70000001', at: T0 - 4 * H, ecrit: false, offre: false }, { url: 'https://fr.vestiairecollective.com/chat?id=55556666-70000001', conv: '55556666-70000001', at: T0 - 23 * H, ecrit: false, offre: false }] }] });
const LISTES_LBC = { ok: true, plateforme: 'leboncoin', compte: { id: 'moi', nom: 'Sophie' }, annonces: { lu: T0 - H, total: 0, liste: [], toutes: [], nTous: 0, statuts: {}, sansCompte: 0 }, ventes: { lu: null, total: 0, liste: [] }, achats: { site: 'leboncoin', pasLu: true, liste: [] }, messages: { lu: null, site: 'leboncoin', nonlusSite: 0, liste: [] }, notifications: { vu: 0, liste: [] }, autres: null };
const ETAT = (site) => ({ ok: true, plateforme: site, capte: true, version: '5.444.0', code: '5.444.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr' }, site: { id: '42', nom: 'David' }, flux: { okAt: T0 - 3 * 60000 }, liens: [], capteCoupe: false });

async function ouvrir(nav, { site = 'vestiaire', scheme, largeur, hauteur, mobile, offre = true }) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur }, locale: 'fr-FR' }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String((e && e.stack) || e).slice(0, 600)));
  await pg.route('**/*', (r) => { const u = r.request().url(); if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO }); if (/images\.vestiairecollective\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }); return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;font-family:sans-serif"><main style="padding:20px;height:2000px">Le site</main></body></html>' }); });
  await pg.goto(site === 'vestiaire' ? 'https://fr.vestiairecollective.com/' : 'https://www.leboncoin.fr/mes-annonces');
  await pg.evaluate(({ e, js, ui, L, A }) => {
    window.__envoyes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = { runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
      sendMessage: (msg, cb) => { window.__envoyes.push(copie(msg)); let rep = { ok: true };
        if (msg.action === 'etat') rep = copie(e); else if (msg.action === 'carteListes') rep = copie(L); else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
        else if (msg.action === 'aimesVcCarte') rep = copie(A);
        else if (msg.action === 'offreAimesCarte') rep = msg.confirme === true ? { ok: true, accepte: true, etape: 'encours', n: 2, reste: 0 } : { ok: false, code: 'confirmation' };
        setTimeout(() => cb && cb(rep), 0); } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } } };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT(site), js: BADGE, ui: UI, L: site === 'vestiaire' ? LISTES_VC : LISTES_LBC, A: AIMES(offre) });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const R = (pg, fn) => pg.evaluate(fn);
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(220); };
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(400);
};
const debord = (pg) => pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('.carte'); return document.documentElement.scrollWidth > window.innerWidth || !!(c && c.scrollWidth > c.clientWidth + 1); });

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  try {
    for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 844, true]]) for (const scheme of ['light', 'dark']) {
      const T = `vestiaire ${largeur} ${scheme}`; console.log('\n' + T);
      await essaie(T, async () => {
        const t = await ouvrir(nav, { scheme, largeur, hauteur, mobile });
        await montrer(t.pg, mobile);
        const cap = (n) => t.pg.screenshot({ path: path.join(SORTIE, `${n}-${largeur}-${scheme}.png`) });
        const barre = await R(t.pg, () => Array.from(document.getElementById('vrm-badge').shadowRoot.querySelectorAll('.side6 [data-onglet-b]')).map((x) => x.getAttribute('data-onglet-b') + ':' + x.innerText.trim()));
        dit(barre.some((x) => x === 'ventes:Ventes') && barre.some((x) => /^achats:Achats$/.test(x)) && !barre.some((x) => /Commandes/.test(x)), `${T} : la barre dit « Ventes » (plus « Commandes ») et a « Achats »`, JSON.stringify(barre));
        // Articles
        await clic(t.pg, '[data-onglet-b="annonces"]');
        await clic(t.pg, '[data-ann-statut-menu] summary');
        const st = await R(t.pg, () => Array.from(document.getElementById('vrm-badge').shadowRoot.querySelectorAll('[data-ann-statut]')).map((c) => c.getAttribute('data-ann-statut') + ':' + c.closest('label').innerText.replace(/\s+/g, ' ').trim()));
        await cap('articles');
        dit(st.some((x) => /^examen:En cours d’examen 1$/.test(x)) && !st.some((x) => /^refusee:/.test(x)), `${T} : Articles — « En cours d’examen » a SON statut (1) ; les statuts absents ne s’affichent pas`, JSON.stringify(st));
        // Ventes
        await clic(t.pg, '[data-onglet-b="ventes"]');
        const v = await R(t.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; return Array.from(r.querySelectorAll('[data-vc-etat]')).map((b) => ({ id: b.getAttribute('data-vente'), etat: b.getAttribute('data-vc-etat'), txt: b.innerText.replace(/\s+/g, ' '), img: !!b.querySelector('img.vig'), ton: (b.querySelector('.et6') || {}).getAttribute ? b.querySelector('.et6').getAttribute('data-ton') : null })); });
        await cap('ventes');
        const l = v.find((x) => x.id === '70000010') || {};
        dit(v.length === 3 && l.etat === 'litige' && /En litige · Vestiaire examine/.test(l.txt) && l.ton === 'ambre' && /Réf\. 70000010/.test(l.txt) && /209,52 €/.test(l.txt) && /pour vous 203,23 €/.test(l.txt) && l.img, `${T} : Ventes — photo, réf., prix et « pour vous », « En litige · Vestiaire examine » en ambre`, JSON.stringify(v));
        dit((v.find((x) => x.id === '70000011') || {}).etat === 'livree_controle' && /Livrée · évaluation en cours/.test((v.find((x) => x.id === '70000011') || {}).txt) && /Annulée/.test((v.find((x) => x.id === '70000012') || {}).txt) && !v.some((x) => /À expédier|En route/.test(x.txt)), `${T} : Ventes — plus aucun « À expédier » ni « En route » faux`, JSON.stringify(v.map((x) => x.txt)));
        await clic(t.pg, '[data-fiche-b="v:70000010"]');
        const fr = await R(t.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; return { n: r.querySelectorAll('[data-vc-frise] li').length, pb: r.querySelectorAll('[data-vc-frise] li[data-probleme]').length, txt: (r.querySelector('[data-vc-frise]') || {}).innerText || '', note: !!r.querySelector('[data-vc-litige]') }; });
        await cap('vente-frise');
        dit(fr.n === 5 && fr.pb === 1 && /Le 7 novembre 2026/.test(fr.txt) && /Suivi XW000000001JF/.test(fr.txt) && /signalé un problème/.test(fr.txt) && fr.note, `${T} : la fiche de la vente : la frise datée (5 étapes), le suivi, le texte de Vestiaire, la note « rien compté comme reçu »`, JSON.stringify(fr));
        // Achats
        await clic(t.pg, '[data-onglet-b="achats"]');
        const ach = await R(t.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; const x = r.querySelector('[data-achats]'); return x ? x.getAttribute('data-achats') + ':' + x.innerText : ''; });
        await cap('achats');
        dit(/^0:Aucun achat sur ce compte/.test(ach), `${T} : Achats — Vestiaire « aucun achat » DATÉ (lu)`, ach);
        // Messagerie
        await clic(t.pg, '[data-onglet-b="messages"]');
        const nm = await R(t.pg, () => document.getElementById('vrm-badge').shadowRoot.querySelectorAll('[data-conv-b]').length);
        await cap('messagerie');
        dit(nm === 2, `${T} : Messagerie — les conversations de CE compte`, nm);
        // Favoris
        await clic(t.pg, '[data-onglet-b="favoris"]');
        await t.pg.waitForTimeout(150);
        await clic(t.pg, '[data-vc-offre-ouvrir="70000001"]');
        await t.pg.evaluate(() => { const i = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-vc-offre-prix]'); i.value = '280'; i.dispatchEvent(new Event('input')); });
        await t.pg.waitForTimeout(100);
        await clic(t.pg, '[data-vc-offre-envoyer]');
        const avant = await R(t.pg, () => window.__envoyes.filter((m) => m.action === 'offreAimesCarte').length);
        const q = await R(t.pg, () => (document.getElementById('vrm-badge').shadowRoot.querySelector('[data-vc-offre-q]') || {}).innerText || '');
        await cap('favoris-offre');
        await clic(t.pg, '[data-vc-offre-oui]');
        const env = await R(t.pg, () => window.__envoyes.filter((m) => m.action === 'offreAimesCarte'));
        dit(avant === 0 && /280 €/.test(q) && env.length === 1 && env[0].confirme === true && env[0].produit === '70000001' && env[0].prixCents === 28000 && env[0].avantCents === 30600, `${T} : Favoris — « Faire une offre » : prix tapé, confirmation, puis la demande part (confirmée, prix lu de l’article)`, JSON.stringify({ avant, q, env }));
        // Notifications
        await clic(t.pg, '[data-onglet-b="notifications"]');
        const no = await R(t.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; return { l: Array.from(r.querySelectorAll('[data-vc-notif]')).map((x) => x.getAttribute('data-vc-notif') + ':' + x.querySelector('.ti').innerText), pub: (r.querySelector('[data-vc-notifs]') || {}).innerText || '' }; });
        await cap('notifications');
        dit(no.l.length === 3 && /^aime:.*Quelqu’un a aimé · GUCCI/.test(no.l[0]) && no.l.some((x) => /^vente:Vente · Gucci/.test(x)) && /3 publicité/.test(no.pub), `${T} : Notifications — « Quelqu’un a aimé · article », « Vente · article » ; 3 publicités comptées, pas montrées`, JSON.stringify(no));
        dit(!(await debord(t.pg)), `${T} : rien ne déborde`);
        dit(t.erreurs.length === 0, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs));
        await t.ctx.close();
      });
    }
    // Sans recette apprise : aucune offre possible, une phrase pour l'apprendre ; Leboncoin : achats « pas lus ».
    await essaie('sans recette / Leboncoin', async () => {
      const t = await ouvrir(nav, { scheme: 'light', largeur: 1512, hauteur: 900, mobile: false, offre: false });
      await montrer(t.pg, false);
      await clic(t.pg, '[data-onglet-b="favoris"]');
      const f = await R(t.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; return { b: !!r.querySelector('[data-vc-offre-ouvrir]'), p: (r.querySelector('[data-vc-offre-appris="non"]') || {}).innerText || '' }; });
      await t.pg.screenshot({ path: path.join(SORTIE, 'favoris-sans-recette-1512-light.png') });
      dit(!f.b && /fais UNE offre toi-même/.test(f.p), 'sans recette apprise : pas de bouton « Faire une offre », une phrase dit comment l’apprendre', JSON.stringify(f));
      await t.ctx.close();
      const t2 = await ouvrir(nav, { site: 'leboncoin', scheme: 'light', largeur: 1512, hauteur: 900, mobile: false });
      await montrer(t2.pg, false);
      await clic(t2.pg, '[data-onglet-b="achats"]');
      const a = await R(t2.pg, () => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-achats]'); return x ? x.getAttribute('data-achats') + ':' + x.innerText : ''; });
      await t2.pg.screenshot({ path: path.join(SORTIE, 'achats-leboncoin-1512-light.png') });
      dit(/^pas-lu:VRM ne lit pas encore tes achats sur Leboncoin/.test(a), 'Leboncoin · Achats : « VRM ne lit pas encore » (jamais « aucun achat »)', a);
      dit(t2.erreurs.length === 0, 'Leboncoin : aucune erreur de page', JSON.stringify(t2.erreurs));
      await t2.ctx.close();
    });
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ vestiaire-complet-panneau : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ vestiaire-complet-panneau : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
