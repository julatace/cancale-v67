// Banc : le CRM eBay (28 nov. 2026, lot ebay-crm — docs/passation/2026-11-28-ebay-crm.md).
// Rendu réel (dist/), FAUX eBay (/api/ebay rend la forme de la route, api/_lib/ebay-crm.js), données INVENTÉES
// (dépôt public). 390 tactile clair et sombre, 1512 clair et sombre. Captures : SHOT=prefixe (jamais commitées).
//   BANC_PORT=4891 SHOT=/tmp/crm node scripts/bancs/ebay-crm.cjs
// On exige :
//   C1  Ventes · eBay → Clients : l'annuaire (un acheteur par IDENTIFIANT : deux « Jean Martin » = deux rangées) ;
//       la fiche s'ouvre au toucher, avec SON total (80,00 €), la commande en GBP dite hors total, ses gestes
//       (écrire, exclure, bloquer sur eBay) ;
//   C3  Automatismes : tous ÉTEINTS au premier affichage ; allumer demande SA confirmation (Annuler ⇒ rien n'est
//       envoyé) ; confirmé ⇒ `crmregler` avec `actif` et `confirme` ; le journal se lit ;
//   C6  Exclus : la liste ; l'ajout refuse un nom (bouton indisponible) et accepte un lien de profil Vinted ;
//   C5/C7  Avis et litiges : « Répondre » sur l'avis négatif sans réponse ; litiges par échéance ;
//   C2  Messages · eBay : « Fiche de l'acheteur » dans la conversation, les modèles au-dessus des réponses rapides ;
//   Q   pas de défilement de côté, cibles ≥ 44 px dans le CRM, au plus un plein visible, aucune erreur de page.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4891;
const MAINTENANT = Date.parse('2026-11-28T09:00:00.000Z'), JOUR = 86400000, iso = (t) => new Date(t).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT) }];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ADzCOKgAAV7wDA8mm/lgAAAAASUVORK5CYII=', 'base64');

const ACHETEURS = [
  { acheteur: 'jean_martin_02', n: 3, dernier: iso(MAINTENANT - JOUR), comptes: ['principal'] },
  { acheteur: 'jean_martin_01', n: 1, dernier: iso(MAINTENANT - 3 * JOUR), comptes: ['principal'] },
  { acheteur: 'sneaker.lover-75', n: 2, dernier: iso(MAINTENANT - 9 * JOUR), comptes: ['principal'] },
];
const FICHE = { ok: true, acheteur: 'jean_martin_02', cle: 'jean_martin_02', comptes: ['principal'], commandesLues: 12,
  commandes: [
    { orderId: '27-00001-0002', date: iso(MAINTENANT - JOUR), titre: 'Nike Air Max 90 blanche, très bon état, pointure 42', itemId: '110000000001', n: 1, montant: '50.00', devise: 'EUR', etat: { label: 'À expédier', kind: 'pending' }, compte: 'principal' },
    { orderId: '27-00001-0003', date: iso(MAINTENANT - 20 * JOUR), titre: 'Adidas Samba noire', itemId: '110000000002', n: 1, montant: '30.00', devise: 'EUR', etat: { label: 'Expédiée', kind: 'shipped' }, compte: 'principal' },
    { orderId: '27-00001-0004', date: iso(MAINTENANT - 40 * JOUR), titre: 'New Balance 550', itemId: '110000000003', n: 1, montant: '20.00', devise: 'GBP', etat: { label: 'Expédiée', kind: 'shipped' }, compte: 'principal' },
  ],
  total: { eur: '80.00', nCompte: 2, illisibles: 0, autresDevises: [{ devise: 'GBP', n: 1 }] },
  messages: [{ id: 'm1', itemId: '110000000001', titre: 'Nike Air Max 90 blanche', sujet: 'Envoi rapide ?', date: iso(MAINTENANT - JOUR), repondu: false }],
  avis: [{ id: '8001', type: 'Positive', texte: 'Parfait, merci !', date: iso(MAINTENANT - 15 * JOUR), itemId: '110000000002', transactionId: '1', titre: 'Adidas Samba', role: 'Buyer', reponse: null }],
  avisSur: 200, litiges: [], litigesManque: [], exclu: false, lienBloquer: 'https://www.ebay.fr/bmgt/BuyerBlock' };
const REGLAGES = () => ({ version: 1, auto: Object.fromEntries(['apresVente', 'expedition', 'livraison', 'demandeEval', 'evalAuto'].map((k) => [k, { actif: false, depuis: null, textes: [], delaiJ: k === 'demandeEval' ? 3 : k === 'livraison' ? 1 : 0, ...(k === 'evalAuto' ? {} : { sujet: '' }) }])),
  modeles: [{ id: 'm-dispo', nom: 'Encore disponible', texte: 'Bonjour {acheteur}, oui « {article} » est encore disponible !' }, { id: 'm-suivi', nom: 'Suivi', texte: 'Votre suivi : {suivi}' }] });
const JOURNAL = [{ le: MAINTENANT - 3600000, quoi: 'apresVente', orderId: '27-00001-0002', acheteur: 'jean_martin_02', itemId: '110000000001', version: 2, etat: 'envoye' }];
const AVIS = [
  { id: '9002', type: 'Negative', texte: 'Pas la bonne taille, déçu', date: iso(MAINTENANT - 2 * JOUR), itemId: '110000000008', transactionId: '2', titre: 'Adidas Samba', de: 'client_mecontent', role: 'Buyer', reponse: null },
  { id: '9001', type: 'Positive', texte: 'Parfait, merci !', date: iso(MAINTENANT - 5 * JOUR), itemId: '110000000009', transactionId: '3', titre: 'Nike', de: 'jean_martin_02', role: 'Buyer', reponse: 'Merci à vous !' },
];
const LITIGES = { litiges: [
  { sorte: 'paiement', id: 'PD-1', orderId: '27-00001-0009', itemId: '', etat: 'ACTION_NEEDED', ouvert: true, date: iso(MAINTENANT - 2 * JOUR), limite: iso(MAINTENANT + JOUR), montant: { value: '98.00', currency: 'EUR' }, motif: 'ITEM_NOT_RECEIVED', titre: '' },
  { sorte: 'retour', id: '5001', orderId: '27-00001-0010', itemId: '110000000010', etat: 'RETURN_REQUESTED', ouvert: true, date: iso(MAINTENANT - JOUR), limite: iso(MAINTENANT + 4 * JOUR), montant: { value: '45.00', currency: 'EUR' }, rembourse: false, motif: 'DOES_NOT_FIT', titre: 'Puma Suede' },
], manque: [], scopePaiement: false };
const MESSAGES = [{ id: '7001', itemId: '110000000001', titre: 'Nike Air Max 90 blanche', sender: 'jean_martin_02', subject: 'Envoi rapide ?', body: 'Bonjour, vous envoyez quand ?', responses: [], status: 'Unanswered', date: iso(MAINTENANT - 3600000), type: 'AskSellerQuestion' }];

let envois = [], exclus = [];
let ko = 0, okc = 0;
const dit = (c, m, d) => { if (c) okc++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' && !c ? ' — ' + String(d).slice(0, 300) : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT'); process.exit(1); });

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
async function ouvrir(b, tel, sombre) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript(([sombre]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_ebay_guide_vu', '1');
    localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); sessionStorage.removeItem('vrm_crm_vue'); } catch (_) {} }, [!!sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (r.request().resourceType() === 'image' ? r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) : r.abort()));
  const rows = [{ id: 'main', data: {} }, { id: 'ebay_comptes', data: { comptes: [{ principal: true, cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_fr', type: 'particulier', site: 'FR' }] } }, { id: 'ebay_orders', data: { orders: [], capturedAt: MAINTENANT } }];
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(MAINTENANT), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/ebay**', async (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(body);
    const a = body.action;
    if (a === 'status') return j({ ok: true, connected: true, comptes: [{ cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_fr', principal: true, relie: true, type: 'particulier', site: 'FR', siteLu: true, marche: { nom: 'eBay.fr', devise: 'EUR', domaine: 'www.ebay.fr', pays: 'FR' }, jeton: null }] });
    if (a === 'crmacheteurs') return j({ ok: true, acheteurs: ACHETEURS, commandesLues: 12 });
    if (a === 'crmfiche') return body.acheteur === 'jean_martin_02' ? j(FICHE) : j({ ...FICHE, acheteur: body.acheteur, commandes: FICHE.commandes.slice(0, 1), total: { eur: '50.00', nCompte: 1, illisibles: 0, autresDevises: [] } });
    if (a === 'crmreglages') return j({ ok: true, reglages: REGLAGES(), journal: JOURNAL, dernierPassage: { le: MAINTENANT - 3600000, envoyes: 1 } });
    if (a === 'crmregler') { const r = REGLAGES(); if (body.quoi) r.auto[body.quoi] = { ...r.auto[body.quoi], actif: body.actif === true, depuis: body.actif ? MAINTENANT : null, textes: body.textes || [] }; return j({ ok: true, reglages: r }); }
    if (a === 'crmexclus') return j({ ok: true, exclus });
    if (a === 'crmexclure') { exclus = [{ site: body.site, id: body.site === 'vinted' ? '424242' : String(body.id).toLowerCase(), note: body.note || '', le: MAINTENANT }, ...exclus]; return j({ ok: true, exclus }); }
    if (a === 'crmavis') return j({ ok: true, avis: AVIS, sur: 50 });
    if (a === 'crmlitiges') return j({ ok: true, ...LITIGES });
    if (a === 'messages') return j({ ok: true, messages: MESSAGES, page: 1, totalPages: 1 });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const shot = async (pg, nom) => { if (process.env.SHOT) { await pg.waitForTimeout(400); await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png` }).catch(() => {}); } };
const toucher = async (pg, tel, sel) => { const el = pg.locator(sel).locator('visible=true').first(); await el.waitFor({ state: 'visible', timeout: 10000 }); await el.scrollIntoViewIfNeeded(); if (tel) await el.tap(); else await el.click(); await pg.waitForTimeout(300); };
const aller = async (pg, q) => { try { await pg.goto(`http://localhost:${PORT}/?${q}`, { waitUntil: 'domcontentloaded' }); } catch (_) { await pg.waitForTimeout(500); await pg.goto(`http://localhost:${PORT}/?${q}`, { waitUntil: 'domcontentloaded' }); } };
const regles = (pg, racine = '[data-crm-ebay]') => pg.evaluate((racine) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return e.getClientRects().length && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const zones = [...document.querySelectorAll(racine + ', [data-n-feuille-couche][data-n-etat="ouverte"]')];
  const petits = zones.flatMap((z) => [...z.querySelectorAll('button, a, [role="switch"], .n-rangee[data-n-touche="1"]')]).filter(vis).filter((b) => b.getBoundingClientRect().height < 43.5 && !b.closest('.n-segmente') && !(b.matches('[role="switch"]') && b.closest('label') && b.closest('label').getBoundingClientRect().height >= 43.5)).map((b) => (b.textContent || b.getAttribute('aria-label') || b.className || '').trim().slice(0, 24) + ':' + Math.round(b.getBoundingClientRect().height));
  const pleins = [...document.querySelectorAll('[data-n-variante="plein"]')].filter(vis).length;
  return { sw: document.documentElement.scrollWidth, iw: innerWidth, petits, pleins };
}, racine);
const verifQ = async (pg, t, quoi) => { const g = await regles(pg); dit(g.sw <= g.iw + 1 && !g.petits.length && g.pleins <= 1, `${t} Q — ${quoi} : pas de défilement de côté, cibles ≥ 44 px, un plein au plus`, JSON.stringify(g)); };

async function rendu(b, { tel, sombre, nom }) {
  const t = nom;
  envois = []; exclus = [{ site: 'ebay', id: 'acheteur_penible', note: 'Toujours en retard', le: MAINTENANT - 9 * JOUR }];
  const { ctx, pg, errs } = await ouvrir(b, tel, sombre);
  try {
    await aller(pg, 'tab=plat_ebay&section=clients');
    await pg.waitForSelector('[data-crm-acheteurs]', { timeout: 40000 }).catch(() => {});
    const l = await pg.$$eval('[data-crm-acheteur]', (x) => x.map((e) => e.getAttribute('data-crm-acheteur')));
    dit(l.join() === 'jean_martin_02,jean_martin_01,sneaker.lover-75', `${t} C1 — l'annuaire : un acheteur par identifiant (deux « jean_martin » = deux rangées), le plus récent d'abord`, l.join());
    await shot(pg, nom + '-acheteurs'); await verifQ(pg, t, 'l\'annuaire');
    await toucher(pg, tel, '[data-crm-acheteur="jean_martin_02"]');
    await pg.waitForSelector('[data-crm-fiche="jean_martin_02"] [data-crm-fiche-total]', { timeout: 10000 }).catch(() => {});
    const f = await pg.evaluate(() => { const g = document.querySelector('[data-crm-fiche-total]'); const z = document.querySelector('[data-crm-fiche]'); return { total: g && g.getAttribute('data-crm-fiche-total'), txt: z ? z.textContent : '', cmd: document.querySelectorAll('[data-crm-commande]').length, gestes: ['[data-crm-ecrire-ouvrir]', '[data-crm-exclu]', '[data-crm-bloquer]'].every((s) => document.querySelector(s)) }; });
    dit(f.total === '80.00' && /GBP/.test(f.txt) && /hors total/.test(f.txt) && f.cmd === 3 && f.gestes, `${t} C1 — la fiche : total 80,00 € sur 2, la commande en GBP dite hors total, 3 achats, écrire · exclure · bloquer`, JSON.stringify({ ...f, txt: f.txt.slice(0, 120) }));
    await shot(pg, nom + '-fiche'); await verifQ(pg, t, 'la fiche');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
    // C3 — automatismes
    await toucher(pg, tel, '[data-crm-ebay] .n-segmente [role="radio"] >> nth=1');
    await pg.waitForSelector('[data-crm-auto]', { timeout: 10000 }).catch(() => {});
    const actifs = await pg.$$eval('[data-crm-auto]', (x) => x.map((e) => e.getAttribute('data-crm-actif')));
    dit(actifs.length === 5 && actifs.every((v) => v === '0'), `${t} C3 — 5 automatismes, tous ÉTEINTS par défaut`, actifs.join());
    const n0 = envois.filter((e) => e.action === 'crmregler').length;
    await toucher(pg, tel, '[data-crm-auto="apresVente"]');
    await pg.waitForTimeout(400);
    const dialogue = await pg.$('[role="dialog"], [role="alertdialog"]');
    const annuler = await pg.$$('button');
    let clicAnnuler = false;
    for (const x of annuler) { const tx = (await x.textContent() || '').trim(); if (tx === 'Annuler' && await x.isVisible()) { await x.click(); clicAnnuler = true; break; } }
    await pg.waitForTimeout(400);
    dit(!!dialogue && clicAnnuler && envois.filter((e) => e.action === 'crmregler').length === n0, `${t} C3 — allumer demande SA confirmation ; « Annuler » ⇒ rien n'est envoyé`, JSON.stringify({ dialogue: !!dialogue, clicAnnuler }));
    await toucher(pg, tel, '[data-crm-auto="apresVente"]');
    await pg.waitForTimeout(400);
    for (const x of await pg.$$('button')) { const tx = (await x.textContent() || '').trim(); if (tx === 'Allumer' && await x.isVisible()) { await x.click(); break; } }
    await pg.waitForTimeout(800);
    const r = envois.filter((e) => e.action === 'crmregler').pop();
    const actif = await pg.getAttribute('[data-crm-auto="apresVente"]', 'data-crm-actif').catch(() => null);
    dit(r && r.quoi === 'apresVente' && r.actif === true && r.confirme === true && Array.isArray(r.textes) && r.textes.length === 2 && !/\{[a-z]+\}/i.test(r.textes.join('').replace(/\{(acheteur|article|suivi)\}/g, '')) && actif === '1', `${t} C3 — confirmé : \`crmregler\` actif + confirme, 2 versions par défaut dans SA langue ; l'interrupteur est allumé`, JSON.stringify(r));
    const jl = await pg.getAttribute('[data-crm-journal]', 'data-crm-journal').catch(() => null);
    dit(jl === '1', `${t} C3 — le journal « Ce que VRM a fait » se lit`, jl);
    await shot(pg, nom + '-auto'); await verifQ(pg, t, 'les automatismes');
    // C6 — exclus
    await toucher(pg, tel, '[data-crm-ebay] .n-segmente [role="radio"] >> nth=3');
    await pg.waitForSelector('[data-crm-exclus]', { timeout: 10000 }).catch(() => {});
    await toucher(pg, tel, '[data-crm-exclure-ouvrir]');
    await pg.fill('[data-n-feuille-couche][data-n-etat="ouverte"] .n-champ-saisie >> nth=0', 'Jean Martin').catch(() => {});
    await pg.waitForTimeout(200);
    const indispo = await pg.evaluate(() => { const b = document.querySelector('[data-crm-exclure]'); return b ? (b.getAttribute('aria-disabled') === 'true' || b.disabled || b.closest('[data-n-indisponible]') != null) : null; });
    dit(indispo === true, `${t} C6 — exclure par un NOM : le bouton reste indisponible`, String(indispo));
    await shot(pg, nom + '-exclus'); await verifQ(pg, t, 'l\'exclusion');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
    // C5 / C7
    await toucher(pg, tel, '[data-crm-ebay] .n-segmente [role="radio"] >> nth=4');
    await pg.waitForSelector('[data-crm-litiges]', { timeout: 10000 }).catch(() => {});
    const s = await pg.evaluate(() => ({ avis: [...document.querySelectorAll('[data-crm-avis-ligne]')].map((e) => e.getAttribute('data-crm-avis-ligne') + ':' + e.getAttribute('data-crm-repondu')), lit: [...document.querySelectorAll('[data-crm-litige]')].map((e) => e.getAttribute('data-crm-litige')) }));
    dit(s.avis.join() === '9002:0,9001:1' && s.lit.join() === 'paiement:PD-1,retour:5001', `${t} C5/C7 — l'avis négatif sans réponse à traiter, les litiges par échéance`, JSON.stringify(s));
    await shot(pg, nom + '-suivi'); await verifQ(pg, t, 'avis et litiges');
    await toucher(pg, tel, '[data-crm-litige="retour:5001"]');
    await pg.waitForSelector('[data-crm-geste]', { timeout: 6000 }).catch(() => {});
    const g = await pg.$$eval('[data-crm-geste]', (x) => x.map((e) => e.getAttribute('data-crm-geste')));
    dit(g.join() === 'accepter,rembourser,refuser' && !envois.some((e) => ['deciderretour', 'rembourserretour'].includes(e.action)), `${t} C7 — un retour : accepter, rembourser, refuser — rien ne part sans son toucher`, g.join());
    await shot(pg, nom + '-retour');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
    // C2 — Messages · eBay
    await aller(pg, 'tab=messages&site=ebay');
    // Messages · Tous (le fil unifié, FilsTous) : la conversation eBay, puis « Répondre sur eBay » ouvre son fil.
    await pg.waitForSelector('text=Bonjour, vous envoyez', { timeout: 30000 }).catch(() => {});
    await toucher(pg, tel, 'text=Bonjour, vous envoyez').catch(() => {});
    if (await pg.$('[data-fil-repondre="ebay"]')) await toucher(pg, tel, '[data-fil-repondre="ebay"]').catch(() => {});
    await pg.waitForSelector('[data-fil-ebay]', { timeout: 8000 }).catch(() => {});
    await pg.waitForSelector('[data-crm-fiche-message]', { timeout: 8000 }).catch(() => {});
    const m = await pg.evaluate(() => ({ fiche: !!document.querySelector('[data-crm-fiche-message]'), modeles: [...document.querySelectorAll('[data-crm-modele]')].map((e) => e.getAttribute('data-crm-modele') + ':' + (e.disabled ? 'gris' : 'ok')) }));
    dit(m.fiche && m.modeles.join() === 'm-dispo:ok,m-suivi:gris', `${t} C2 — la conversation : « Fiche de l'acheteur », les modèles (celui au {suivi} grisé : pas su ici)`, JSON.stringify(m));
    if (m.modeles.length) { await toucher(pg, tel, '[data-crm-modele="m-dispo"]'); }
    await pg.waitForTimeout(300);
    const saisie = await pg.evaluate(() => { const z = [...document.querySelectorAll('textarea')].find((e) => e.value); return z ? z.value : ''; });
    dit(saisie === 'Bonjour jean_martin_02, oui « Nike Air Max 90 blanche » est encore disponible !', `${t} C2 — un toucher remplit {acheteur} et {article}`, saisie);
    await shot(pg, nom + '-messages');
    dit(!errs.length, `${t} Q — aucune erreur de page`, errs.slice(0, 2).join(' | '));
  } finally { await ctx.close(); }
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  dist/ absent : npm run build'); process.exit(1); }
  await new Promise((ok) => srv.listen(PORT, ok));
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const [tel, sombre, nom] of [[true, false, '390-clair'], [true, true, '390-sombre'], [false, false, '1512-clair'], [false, true, '1512-sombre']]) await rendu(b, { tel, sombre, nom });
  } finally { await b.close(); srv.close(); }
  console.log(`\n${okc} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
