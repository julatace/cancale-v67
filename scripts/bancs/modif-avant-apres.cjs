require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « AVANT / APRÈS ET PROCESSUS VISUEL » DES MODIFICATIONS D'ANNONCES (21 nov., ext. 5.423 — `modifavantapres`)
//
//  Julien (21 nov.) : « pour la modification qui est en place dans l'extension, tu peux faire l'avant / après et un
//  meilleur processus visuel ». Les ÉTATS viennent du VRAI background.js (scripts/_modif-scenarios.cjs : une
//  republication par le formulaire, « Tout arrêter » au milieu, un lot de trois prix — fausse page vinted.fr, faux
//  Vinted) ; ils sont dessinés par les VRAIS vrm-ui.js / vrm-mots.js / vrm-action.js (écran plein) et vrm-badge.js
//  (panneau) sur une fausse page vinted.fr. On juge, à 390 px (Orion, au doigt) puis 1512 px, clair et sombre :
//   E1  pendant une republication : la frise montre EXACTEMENT les étapes prouvées (chaque « ✓ » a SA preuve, datée,
//       et le fait qui la prouve est déjà là), l'étape suivante en cours, le temps écoulé et l'estimation, « Tout arrêter »
//   E2  pendant le lot de prix : « Prix lu ✓ Nouveau prix tapé ✓ Enregistré ✓ Vérifié … », « 1 sur 3 »
//   E3  après : le bilan Avant | Après (60 € · il y a 12 j → maintenant), « Voir sur Vinted » vers le NOUVEL identifiant
//   E4  « Tout arrêter » après le brouillon : « Supprimée » en AMBRE (arrêtée ici), la phrase, « Reprendre » ⇒ SON message
//   E5  le bilan du lot : 2 faites (prix relu), 1 refusée en ambre avec « Ouvrir sur Vinted »
//   P1  panneau, AVANT de lancer : la feuille Avant | Après du lot de prix — valeurs du dressing rangé et SON prix tapé
//   P2  panneau : la feuille de l'atelier (champs recopiés lus dans le formulaire de l'annonce), rien n'est parti
//   P3  panneau : masquer — « En ligne → Masquée » ; P4 le suivi en cours et le bilan dans le panneau
//   T   cibles ≥ 44 px, rien ne déborde, aucune erreur de page
//  `--prouve` : une règle de dessin réaffaiblie (une étape cochée sans preuve) ⇒ rouge. Captures : BANC_CAPTURES ou
//  scripts/bancs/captures/modif-avant-apres (jamais commitées).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const S = require(path.join(RACINE, 'scripts', '_modif-scenarios.cjs'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'modif-avant-apres') : path.join(__dirname, 'captures', 'modif-avant-apres');
const PROUVE = process.argv.includes('--prouve');
let UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8');
const MOTS = fs.readFileSync(path.join(EXT, 'vrm-mots.js'), 'utf8'), ACTION = fs.readFileSync(path.join(EXT, 'vrm-action.js'), 'utf8'), BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
if (PROUVE) {
  const de = "const etat = premier ? (err ? 'erreur' : fini ? 'attente' : 'encours') : 'attente';";
  if (!UI.includes(de)) { console.log('❌ --prouve : motif absent'); process.exit(1); }
  UI = UI.replace(de, "const etat = premier ? 'faite' : 'attente';");
}
let ok = 0, ko = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; if (!PROUVE) console.log(`  ✅ ${quoi}`); } else { ko++; if (!PROUVE) console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 300)}`); return null; } };
const IMG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#d9cdb8"/><rect x="12" y="34" width="56" height="20" rx="8" fill="#5a4a3a"/><rect x="18" y="28" width="26" height="10" rx="4" fill="#7a6a5a"/></svg>');
const PAGE = (nuit) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vinted (banc)</title><style>body{margin:0;font:15px/1.4 system-ui,sans-serif;background:${nuit ? '#121416' : '#fff'};color:${nuit ? '#e8e8e8' : '#171717'}}header{height:60px;display:flex;align-items:center;padding:0 20px;border-bottom:1px solid #8883}header b{font-size:24px;color:#007782}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;padding:20px}main div{height:220px;border-radius:8px;background:#8882}</style></head><body><header><b>Vinted</b></header><main>${'<div></div>'.repeat(12)}</main></body></html>`;
const euro = (n) => (Math.round(n * 100) % 100 ? (Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(Math.round(n))) + ' €';

async function page(nav, { largeur, hauteur, mobile, orion, scheme }) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0' } : {}));
  const pg = await ctx.newPage(); const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => (/vinted\.net|\.svg|\.png/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: IMG }) : r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(scheme === 'dark') })));
  await pg.addInitScript(() => { const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (x) { return o.call(this, Object.assign({}, x, { mode: 'open' })); }; });
  await pg.goto('https://www.vinted.fr/catalog');
  return { ctx, pg, erreurs };
}
// Le faux `chrome` : l'état de l'écran = celui du VRAI fond (`window.__etat`) ; `__poser(x)` le change (onChanged).
async function fauxChrome(pg, etat, extra) {
  await pg.evaluate(({ a, x }) => {
    const ecoutes = []; window.__etat = a; window.__envoyes = [];
    const copie = (v) => JSON.parse(JSON.stringify(v));
    window.chrome = { runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.423.0' }),
      sendMessage: (msg, cb) => { window.__envoyes.push(copie(msg)); const rep = (window.__rep && window.__rep(msg)) || (msg.action === 'etat' && msg.from === 'vrm-action' ? { ok: true, action: window.__etat } : msg.action === 'numeros' ? { ok: true, items: {} } : { ok: true }); setTimeout(() => cb && cb(copie(rep)), 0); } },
      i18n: { getUILanguage: () => 'fr', getMessage: () => '' },
      storage: { local: { get: (k, cb) => { const v = { vrmActionEnCours: window.__etat }; if (cb) setTimeout(() => cb(copie(v)), 0); return Promise.resolve(copie(v)); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener: (f) => ecoutes.push(f) } } };
    window.__poser = (v) => { window.__etat = v; for (const f of ecoutes) { try { f({ vrmActionEnCours: { newValue: v } }, 'local'); } catch (_) {} } };
    if (x) Object.assign(window, x);
  }, { a: etat, x: extra || null });
}
const injecter = async (pg, srcs) => { for (const s of srcs) await pg.evaluate((js) => { const e = document.createElement('script'); e.textContent = js; document.documentElement.appendChild(e); }, s); };
const frais = (a) => (a ? Object.assign(S.copie(a), { maj: Date.now() }) : a);
// La frise dessinée dans une racine : chaque étape, son état et la date de SA preuve.
const LIRE_FRISE = (sel) => { const o = document.getElementById(sel === 'badge' ? 'vrm-badge' : 'vrm-action').shadowRoot; const f = o.querySelector(sel === 'badge' ? '[data-modif6] .vu-frise' : '.modif .vu-frise'); return f ? [...f.querySelectorAll('li')].map((li) => ({ k: li.getAttribute('data-etape'), etat: li.getAttribute('data-etat'), preuve: Number(li.getAttribute('data-preuve')) || 0, texte: li.innerText.replace(/\s+/g, ' ').trim() })) : null; };
// Chaque « ✓ » à l'écran a SA preuve (même date) ET le fait qui la prouve (le journal du vrai fond, au même instantané).
function cochesJustes(frise, snap) {
  const m = snap.a.modif || {};
  const fautes = [];
  for (const e of frise || []) {
    if (e.etat !== 'faite') continue;
    if (!(Number(m.preuves && m.preuves[e.k]) > 0) || Number(m.preuves[e.k]) !== e.preuve) fautes.push(e.k + ':sans-preuve');
    else if (!S.faitPour(m.sorte, e.k, snap, String(m.id))) fautes.push(e.k + ':sans-fait');
  }
  return fautes;
}
const mesurer = (pg, hote) => pg.evaluate((h) => {
  const o = document.getElementById(h).shadowRoot; const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const petits = [...o.querySelectorAll('button, a.vu-btn, summary')].filter(vis).filter((b) => b.closest('[data-avant-apres], [data-bilan], [data-action-bilan], [data-action-plein], [data-modif6], [data-aa-vue]')).map((b) => Math.round(b.getBoundingClientRect().height)).filter((x) => x < 44);
  const deb = [...o.querySelectorAll('.vu-frise, .vu-aa, .vu-bl')].filter(vis).some((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; });
  return { petits, deb };
}, hote);

async function ecranPlein(nav, vp, T, N, cap, sc) {
  const t = await page(nav, vp);
  const { pg } = t;
  // E1 — pendant la republication : l'instantané du vrai fond où le brouillon est prouvé, la suppression pas encore.
  const sP = sc.repub.snaps.find((s) => s.a && s.a.actif && s.a.enCours && s.a.modif && s.a.modif.preuves.brouillon > 0 && !(s.a.modif.preuves.supprimee > 0));
  await fauxChrome(pg, frais(sP.a));
  await injecter(pg, [UI, MOTS, ACTION]);
  await pg.waitForTimeout(500);
  let fr = await pg.evaluate(LIRE_FRISE, 'action');
  const plein = await pg.evaluate(() => { const o = document.getElementById('vrm-action').shadowRoot; return { plein: !!o.querySelector('[data-action-plein]'), temps: (o.querySelector('[data-modif-temps]') || {}).textContent || '', arreter: !!o.querySelector('[data-arreter]'), titre: (o.querySelector('[data-action-ti]') || {}).textContent || '' }; });
  const f1 = cochesJustes(fr, sP);
  dit(plein.plein && fr && fr.map((e) => e.k + ':' + e.etat).join(' ') === 'coffre:faite brouillon:faite supprimee:encours enligne:attente' && !f1.length && /Écoulé .+ · environ .+ restant/.test(plein.temps) && plein.arreter && plein.titre === 'Basket test 42 cuir blanc',
    `E1 ${T} pendant la republication : Coffre ✓ Brouillon relu ✓ Supprimée (en cours) — chaque ✓ a sa preuve et son fait ; temps écoulé et estimé ; « Tout arrêter »`, JSON.stringify({ fr, f1, plein }));
  await cap(pg, N('ecran-repub-pendant'));
  // E3 — après : le bilan de CETTE série (l'état final du vrai fond).
  await pg.evaluate((a) => window.__poser(a), frais(sc.repub.final));
  await pg.waitForTimeout(450);
  const b1 = await pg.evaluate(() => { const o = document.getElementById('vrm-action').shadowRoot; const l = o.querySelector('[data-bilan-ligne="9101"]'); const cell = (k, c) => { const x = l && l.querySelector(`[data-aa="${k}"][data-cote="${c}"]`); return x ? x.textContent.trim() + '|' + x.getAttribute('data-v') : ''; };
    return { vue: !!o.querySelector('[data-action-bilan]'), ok: l && l.getAttribute('data-ok'), voir: (l && l.querySelector('[data-modif-voir]') || {}).href || '', prixA: cell('prix', 'avant'), prixP: cell('prix', 'apres'), dA: cell('depuis', 'avant'), dP: cell('depuis', 'apres'), fermer: !!o.querySelector('[data-modif-fermer]') }; });
  const jours = Math.floor((Date.now() - sc.repub.final.bilan[0].avant.depuis) / 864e5);
  dit(b1.vue && b1.ok === '1' && /\/items\/88001$/.test(b1.voir) && b1.prixA === '60 €|meme' && b1.prixP === '60 €|meme' && b1.dA === `il y a ${jours} j|meme` && /^aujourd’hui · \d\d:\d\d\|chg$/.test(b1.dP) && b1.fermer,
    `E3 ${T} après : bilan Avant | Après (60 € gardé, il y a ${jours} j → aujourd’hui en vert), « Voir sur Vinted » vers l’annonce 88001, « Fermer »`, JSON.stringify(b1));
  const m1 = await mesurer(pg, 'vrm-action');
  dit(!m1.petits.length && !m1.deb, `T ${T} bilan : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(m1));
  await cap(pg, N('ecran-repub-bilan'));
  await pg.evaluate(() => document.getElementById('vrm-action').shadowRoot.querySelector('[data-modif-fermer]').click());
  await pg.waitForTimeout(250);
  const ferme = await pg.evaluate(() => document.getElementById('vrm-action').style.display);
  dit(ferme === 'none', `E3b ${T} « Fermer » rend la page`, ferme);
  // E4 — « Tout arrêter » après le brouillon : l'instantané en cours de CE lot, puis l'état final (arrêté).
  const sA = sc.arret.snaps.find((s) => s.a && s.a.actif && s.a.enCours && s.a.modif && s.a.modif.preuves.coffre > 0);
  await pg.evaluate((a) => window.__poser(a), frais(sA.a));
  await pg.waitForTimeout(400);
  await pg.evaluate((a) => window.__poser(a), frais(sc.arret.final));
  await pg.waitForTimeout(450);
  const b2 = await pg.evaluate(() => { const o = document.getElementById('vrm-action').shadowRoot; const l = o.querySelector('[data-bilan-ligne="9101"]'); return { fin: (o.querySelector('[data-action-bilan]') || { getAttribute: () => '' }).getAttribute('data-fin'), ok: l && l.getAttribute('data-ok'), frise: l ? [...l.querySelectorAll('.vu-frise li')].map((li) => li.getAttribute('data-etape') + ':' + li.getAttribute('data-etat')).join(' ') : '', raison: (l && l.querySelector('[data-bilan-raison]') || {}).textContent || '', reprendre: !!(l && l.querySelector('[data-modif-reprendre="9101"]')), ambre: (() => { const i = l && l.querySelector('li[data-etat="erreur"] .vu-fr-i'); return i ? getComputedStyle(i).color : ''; })() }; });
  dit(b2.fin === 'arret' && b2.ok === '0' && b2.frise === 'coffre:faite brouillon:faite supprimee:erreur enligne:attente' && /Reprendre/.test(b2.raison) && b2.reprendre && b2.ambre,
    `E4 ${T} « Tout arrêter » au milieu : « Supprimée » en ambre (arrêtée ici), la phrase, « Reprendre »`, JSON.stringify(b2));
  await cap(pg, N('ecran-arret'));
  await pg.evaluate(() => document.getElementById('vrm-action').shadowRoot.querySelector('[data-modif-reprendre="9101"]').click());
  await pg.waitForTimeout(200);
  const env = await pg.evaluate(() => window.__envoyes.filter((m) => m.action === 'reprendreModif'));
  dit(env.length === 1 && env[0].id === '9101' && env[0].confirme === true && env[0].from === 'vrm-action', `E4b ${T} « Reprendre » ⇒ SA demande (cette annonce, confirmée), rien d’autre`, JSON.stringify(env));
  await t.ctx.close();
  // E2 / E5 — le lot de prix (un nouvel onglet : un autre lot).
  const t2 = await page(nav, vp); const pg2 = t2.pg;
  const sQ = sc.prix.snaps.find((s) => s.a && s.a.actif && s.a.enCours && s.a.modif && s.a.modif.id === '91010002' && s.a.modif.preuves.enregistre > 0 && !(s.a.modif.preuves.verifie > 0));
  await fauxChrome(pg2, frais(sQ.a));
  await injecter(pg2, [UI, MOTS, ACTION]);
  await pg2.waitForTimeout(500);
  fr = await pg2.evaluate(LIRE_FRISE, 'action');
  const cpt = await pg2.evaluate(() => (document.getElementById('vrm-action').shadowRoot.querySelector('[data-action-fait]') || {}).textContent || '');
  const f2 = cochesJustes(fr, sQ);
  dit(fr && fr.map((e) => e.k + ':' + e.etat).join(' ') === 'lu:faite tape:faite enregistre:faite verifie:encours' && !f2.length && /1 sur 3/.test(cpt) && /Prix lu/.test(fr[0].texte) && /Nouveau prix tapé/.test(fr[1].texte),
    `E2 ${T} pendant le lot de prix : Prix lu ✓ Nouveau prix tapé ✓ Enregistré ✓ Vérifié (en cours), « 1 sur 3 » — chaque ✓ a sa preuve`, JSON.stringify({ fr, f2, cpt }));
  await cap(pg2, N('ecran-prix-pendant'));
  await pg2.evaluate((a) => window.__poser(a), frais(sc.prix.final));
  await pg2.waitForTimeout(450);
  const b3 = await pg2.evaluate(() => { const o = document.getElementById('vrm-action').shadowRoot; return [...o.querySelectorAll('[data-bilan-ligne]')].map((l) => { const c = (k, s) => { const x = l.querySelector(`[data-aa="${k}"][data-cote="${s}"]`); return x ? x.textContent.trim() + '|' + x.getAttribute('data-v') : ''; }; return { id: l.getAttribute('data-bilan-ligne'), ok: l.getAttribute('data-ok'), av: c('prix', 'avant'), ap: c('prix', 'apres'), voir: (l.querySelector('[data-modif-voir]') || {}).textContent || '', frise: [...l.querySelectorAll('.vu-frise li')].map((li) => li.getAttribute('data-etat')).join(','), rep: !!l.querySelector('[data-modif-reprendre]') }; }); });
  const lu = (id) => sc.prix.faits.find((x) => x.id === id && x.quoi === 'lu').prix, relu = (id) => sc.prix.faits.filter((x) => x.id === id && x.quoi === 'relu').pop().prix;
  const x1 = b3.find((x) => x.id === '91010001'), x2 = b3.find((x) => x.id === '91010002'), x3 = b3.find((x) => x.id === '91010003');
  dit(x1 && x2 && x3 && x1.av === `${euro(lu('91010001'))}|meme` && x1.ap === `${euro(relu('91010001'))}|chg` && x2.av === `${euro(lu('91010002'))}|meme` && x2.ap === `${euro(relu('91010002'))}|chg` && x3.ok === '0' && x3.frise === 'faite,faite,erreur,attente' && x3.voir === 'Ouvrir sur Vinted' && !x3.rep,
    `E5 ${T} bilan du lot : 60 € → 54 €, 75 € → 67,50 € (prix RELUS, en vert) ; la 3ᵉ refusée : « Enregistré » en ambre, « Ouvrir sur Vinted »`, JSON.stringify(b3));
  await cap(pg2, N('ecran-prix-bilan'));
  // E6 — une baisse AUTOMATIQUE (règle, cycle de vie) : pas de bilan à fermer sur Vinted (le clavier de Vinted libre).
  await pg2.evaluate(() => document.getElementById('vrm-action').shadowRoot.querySelector('[data-modif-fermer]').click());
  await pg2.waitForTimeout(200);
  const auto = (() => { const x = frais(sc.prix.final); x.modif = Object.assign({}, x.modif, { auto: true, debut: Date.now() }); return x; })();
  await pg2.evaluate((a) => window.__poser(a), auto);
  await pg2.waitForTimeout(450);
  const e6 = await pg2.evaluate(() => { const o = document.getElementById('vrm-action').shadowRoot; return { bilan: !!o.querySelector('[data-action-bilan]') }; });
  dit(!e6.bilan, `E6 ${T} une baisse automatique ne pose pas de bilan à fermer sur Vinted`, JSON.stringify(e6));
  dit(!t.erreurs.length && !t2.erreurs.length, `T ${T} écran plein : aucune erreur de page`, t.erreurs.concat(t2.erreurs).join(' | '));
  await t2.ctx.close();
}

async function panneau(nav, vp, T, N, cap, sc) {
  const t = await page(nav, vp); const { pg } = t;
  const ids = ['9101', '91010001', '91010002', '91010003', '91020001'];
  const toutes = S.DRESSING.map((x) => ({ id: String(x.id), titre: x.title, prix: Number(x.price.amount), photo: x.photo.url, photos: [x.photo.url], num: S.NUMS[String(x.id)].numero, depuis: x.created_at_ts * 1000, jours: Math.floor((Date.now() - x.created_at_ts * 1000) / 864e5), statut: 'en_vente', favoris: 2, vues: 40, mini: null, achat: null }));
  const L = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' }, offres: [], annonces: { lu: Date.now() - 600000, aConfirmer: false, total: toutes.length, liste: toutes, toutes, nTous: toutes.length, statuts: { en_vente: toutes.length, brouillon: 0, masque: 0, reserve: 0, vendu: 0, a_confirmer: 0 } },
    automatisations: { offres: { actif: false, minis: 0, refus: false }, favoris: { regle: false, versions: 0, rythme: 'normal', textes: [], auto: { actif: false } }, paliers: { actif: false, paliers: [], remiseMax: null, messages: 0 }, baisse: { actif: false, pct: null, jours: null } },
    notifications: { vu: Date.now(), liste: [] }, ventes: { lu: Date.now(), total: 0, liste: [] }, messages: { lu: Date.now(), liste: [] }, autres: null };
  const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.423.0', code: '5.423.0', vrm: { ok: true, connecte: true, email: 'banc@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 3, maxH: 50, j: 10, maxJ: 200, complet: true }, favoris: { apercu: null, file: null } }, secu: { niveau: 'ok', texte: 'Tout va bien' }, toutArrete: false, flux: { okAt: Date.now() }, liens: [], capteCoupe: false };
  // Le contrôle avant départ : les champs recopiés calculés par la VRAIE règle du fond (`champsRecopies`) sur le formulaire de l'annonce.
  const itemR = JSON.parse(S.MODELE_R).item;
  const champs = sc.repub.f.ctx.champsRecopies(itemR, itemR.description, [], []);
  const champsSurs = sc.repub.f.ctx.champsRecopiesSurs(champs);
  await fauxChrome(pg, null, { __L: L, __E: ETAT, __champs: champsSurs });
  await pg.evaluate(() => { window.__rep = (m) => (m.action === 'etat' && m.from !== 'vrm-action' ? window.__E : m.action === 'carteListes' ? window.__L : m.action === 'atelierVerifier' ? { ok: true, paires: Object.fromEntries((m.tous || m.ids).map((id) => [id, { id, etat: 'ok', corrections: [], manque: [], question: null, champs: window.__champs, prixCoffre: 60 }])), resume: { total: (m.tous || m.ids).length, verifiees: (m.tous || m.ids).length, ok: (m.tous || m.ids).length, corrige: 0, aCorriger: 0, absente: 0, pasVerifie: 0 }, lancer: { ok: true } } : null); });
  await injecter(pg, [UI, MOTS, BADGE]);
  await pg.waitForTimeout(400);
  const R = (fn, a) => pg.evaluate(fn, a);
  const clic = async (sel) => { await R((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(260); };
  const b = await R(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (vp.mobile) await pg.touchscreen.tap(b.x, b.y); else await pg.mouse.click(b.x, b.y);
  await pg.waitForTimeout(500);
  await clic('[data-onglet-b="annonces"]');
  const coche = (l) => R((l) => { const r = document.getElementById('vrm-badge').shadowRoot; for (const c of r.querySelectorAll('[data-ann-sel]')) { const v = l.includes(c.getAttribute('data-ann-sel')); if (c.checked !== v) { c.checked = v; c.dispatchEvent(new Event('change')); } } }, l);
  const action = async (k) => { await R((k) => { const s = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ann-action]'); s.value = k; s.dispatchEvent(new Event('change')); }, k); await pg.waitForTimeout(260); };
  const env = (k) => R((k) => window.__envoyes.filter((m) => m.action === k), k);
  // P1 — le lot de prix : −10 %, la feuille AVANT de lancer.
  await coche(['91010001', '91010002', '91010003']); await pg.waitForTimeout(150);
  await action('baisser');
  await clic('[data-prix-pct="10"]');
  await clic('[data-prix-confirmer]');
  const aa = await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; return { total: (r.querySelector('[data-aa-total]') || {}).textContent || '', lignes: [...r.querySelectorAll('[data-aa-ligne]')].map((l) => { const c = (k, s) => { const x = l.querySelector(`[data-aa="${k}"][data-cote="${s}"]`); return x ? x.textContent.trim() + '|' + x.getAttribute('data-v') : ''; }; return { id: l.getAttribute('data-aa-ligne'), resume: (l.querySelector('[data-aa-resume]') || {}).textContent || '', av: c('prix', 'avant'), ap: c('prix', 'apres'), num: c('num', 'apres'), dA: c('depuis', 'avant'), img: (l.querySelector('summary img') || {}).src || '', ouvert: l.open }; }), lancer: !!r.querySelector('[data-aa-vue] [data-prix-confirmer]') }; });
  const attendu = ['91010001', '91010002', '91010003'].map((id) => { const x = toutes.find((y) => y.id === id); const p = Math.round(x.prix * 90) / 100; return { id, resume: `${euro(x.prix)} → ${euro(p)}`, av: `${euro(x.prix)}|meme`, ap: `${euro(p)}|chg`, num: `${x.num} (gardé)|meme`, dA: `il y a ${x.jours} j|meme`, img: x.photo }; });
  const juste = attendu.every((e) => { const l = aa.lignes.find((y) => y.id === e.id); return l && l.resume === e.resume && l.av === e.av && l.ap === e.ap && l.num === e.num && l.dA === e.dA && l.img === e.img; });
  dit(juste && /^3 annonces · 3 prix baissés$/.test(aa.total) && aa.lignes[0].ouvert && !aa.lignes[1].ouvert && aa.lancer && !(await env('prixCarte')).length,
    `P1 ${T} la feuille Avant | Après du lot de prix (valeurs du dressing rangé, SON prix −10 %) ; la 1re rangée ouverte, les autres repliées ; rien n’est parti`, JSON.stringify({ aa, attendu }));
  const m1 = await mesurer(pg, 'vrm-badge');
  dit(!m1.petits.length && !m1.deb, `T ${T} feuille : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(m1));
  await cap(pg, N('panneau-prix-avant-apres'));
  await clic('[data-aa-retour]');
  await clic('[data-geste-fermer]');
  // P2 — l'atelier : deux annonces, le contrôle avant départ, puis la feuille.
  await coche(['9101', '91010001']); await pg.waitForTimeout(150);
  await action('republier');
  await pg.waitForTimeout(300);
  await clic('[data-atelier-lancer]');
  const ar = await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const l = r.querySelector('[data-aa-ligne="9101"]'); return { total: (r.querySelector('[data-aa-total]') || {}).textContent || '', champs: l ? [...l.querySelectorAll('[data-champ]')].map((c) => c.getAttribute('data-champ') + ':' + c.getAttribute('data-c')).join(' ') : '', resume: l && (l.querySelector('[data-aa-resume]') || {}).textContent, prixP: l && (l.querySelector('[data-aa="prix"][data-cote="apres"]') || {}).textContent, depuisP: l && (l.querySelector('[data-aa="depuis"][data-cote="apres"]') || {}).getAttribute('data-v') }; });
  const champsAtt = champsSurs.map((c) => c.k + ':' + c.etat).join(' ');
  dit(/^2 annonces · 2 republiées$/.test(ar.total) && ar.champs === champsAtt && /^il y a 12 j → maintenant$/.test(ar.resume || '') && ar.prixP === '60 €' && ar.depuisP === 'chg' && !(await env('atelierLancer')).length,
    `P2 ${T} atelier : la feuille (il y a 12 j → maintenant, prix du coffre 60 €, champs recopiés LUS : ${champsAtt}), rien n’est parti`, JSON.stringify({ ar, champsAtt }));
  await cap(pg, N('panneau-atelier-avant-apres'));
  await clic('[data-aa-retour]');
  await clic('[data-geste-fermer]');
  // P3 — masquer : « En ligne → Masquée ».
  await coche(['91020001']); await pg.waitForTimeout(150);
  await action('masquer');
  const mq = await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const l = r.querySelector('[data-ann-aa] [data-aa-ligne="91020001"]'); return { resume: l ? (l.querySelector('[data-aa-resume]') || {}).textContent : '', ap: l ? (l.querySelector('[data-aa="etat"][data-cote="apres"]') || {}).getAttribute('data-v') : '' }; });
  dit(mq.resume === 'En ligne → Masquée' && mq.ap === 'chg' && !(await env('masquerCarte')).length, `P3 ${T} masquer : « En ligne → Masquée » dans la confirmation, rien n’est parti`, JSON.stringify(mq));
  await cap(pg, N('panneau-masquer-avant-apres'));
  await clic('[data-ann-confirme-non]');
  // P4 — le suivi dans le panneau : l'instantané du vrai fond pendant le lot de prix, puis le bilan.
  const sQ = sc.prix.snaps.find((s) => s.a && s.a.actif && s.a.enCours && s.a.modif && s.a.modif.id === '91010002' && s.a.modif.preuves.enregistre > 0 && !(s.a.modif.preuves.verifie > 0));
  await R((a) => window.__poser(a), frais(sQ.a));
  await pg.waitForTimeout(450);
  const fr = await R(LIRE_FRISE, 'badge');
  const tete = await R(() => (document.getElementById('vrm-badge').shadowRoot.querySelector('[data-modif6] h3') || {}).textContent || '');
  dit(fr && fr.map((e) => e.k + ':' + e.etat).join(' ') === 'lu:faite tape:faite enregistre:faite verifie:encours' && !cochesJustes(fr, sQ).length && /2 sur 3/.test(tete),
    `P4 ${T} panneau : « Modifications en cours · 2 sur 3 », la même frise (chaque ✓ a sa preuve)`, JSON.stringify({ fr, tete }));
  await cap(pg, N('panneau-suivi'));
  await R((a) => window.__poser(a), frais(sc.prix.final));
  await pg.waitForTimeout(450);
  const bl = await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const s = r.querySelector('[data-modif6]'); return s ? { etat: s.getAttribute('data-modif6-etat'), n: s.querySelectorAll('[data-bilan-ligne]').length, ok: s.querySelector('[data-bilan]').getAttribute('data-bilan-ok') } : null; });
  dit(bl && bl.etat === 'fin' && bl.n === 3 && bl.ok === '2', `P4b ${T} panneau : le bilan du lot (3 annonces, 2 faites)`, JSON.stringify(bl));
  await cap(pg, N('panneau-bilan'));
  dit(!t.erreurs.length, `T ${T} panneau : aucune erreur de page`, t.erreurs.join(' | '));
  await t.ctx.close();
}

(async () => {
  const BG = path.join(EXT, 'background.js');
  const sc = { repub: await S.jouerRepub(BG), arret: await S.jouerRepub(BG, { arreterApres: 'brouillon' }), prix: await S.jouerPrix(BG) };
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { if (PROUVE) return; try { await pg.waitForTimeout(150); await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const vp of [{ largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'light' }, { largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'dark' }, { largeur: 1512, hauteur: 900, mobile: false, orion: false, scheme: 'light' }, { largeur: 1512, hauteur: 900, mobile: false, orion: false, scheme: 'dark' }]) {
      const T = `${vp.largeur}${vp.orion ? ' Orion' : ''} ${vp.scheme}`;
      const N = (k) => `${vp.largeur}-${vp.orion ? 'orion-' : ''}${vp.scheme}-${k}`;
      if (!PROUVE) console.log(`\n${T}`);
      await essaie(`${T} écran plein`, () => ecranPlein(nav, vp, T, N, cap, sc));
      await essaie(`${T} panneau`, () => panneau(nav, vp, T, N, cap, sc));
      if (PROUVE) break;
    }
  } finally { await nav.close(); }
  if (PROUVE) { console.log(ko ? `✅ --prouve : une étape cochée sans preuve ⇒ ${ko} rouge(s)` : '❌ --prouve : la mutation passe'); process.exit(ko ? 0 : 1); }
  console.log(`\n${ko ? '❌' : '✅'} modif-avant-apres : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
