// Banc : Ma journée ENTIÈRE se lit en 5 secondes (1er novembre, Julien : « pour
// Ma journée tu peux faire mieux encore », puis « tu ne trouves pas que ça fait
// bordel ? »). Téléphone 390 tactile (clair, sombre) et ordinateur 1512/1440/1280.
//
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles : trois
// ventes à poster (dont une dont la date ESTIMÉE est dépassée ⇒ alerte de tête),
// deux bordereaux, deux colis à retirer (Kusmi Tea, Tabac du Port), un colis dont
// le délai de retrait est passé (« à vérifier »), des ventes finalisées pour les
// chiffres. Il juge ce qui est RENDU (§6.4) :
//   A. l'écran s'affiche sans erreur ni débordement ; l'en-tête (bonjour, date)
//      est VISIBLE, ordinateur compris ;
//   B. « À faire » : chaque ligne = un titre d'UNE ligne + au plus UNE ligne de
//      détail (téléphone compris, depuis le 1er nov.) ; toutes les lignes de la liste ont la même hauteur ; un détail
//      raccourci l'est à la fin d'un MOT (jamais « transporteur pa… ») et le
//      texte entier reste dans l'infobulle ;
//   C. la Tournée (ordinateur) : aucun titre ni sous-titre coupé (ni « … », ni
//      texte qui dépasse sa boîte) ;
//   D. le même nombre jamais deux fois (§7) : quand la Tournée est là, les cases
//      « À envoyer » / « À retirer » ne se VOIENT pas (leur nombre est celui des
//      étapes Emballer / Retirer) et la carte « Emballer les colis prêts » n'est
//      pas redite dans « À faire » ;
//   E. les chiffres (ordinateur ≥ 1280) : leurs rangées occupent ≥ 90 % de la
//      largeur de la grille, et les cartes d'une même rangée ont la même hauteur ;
//   F. Tendances : aucune case « — » sans base posée comme un chiffre ;
//   G. la colonne de gauche : aucune entrée n'a l'air désactivée (opacité, fondu) ;
//   H. contraste du texte discret ≥ 4,5 ;
//   I. (1er nov., « je trouve cet endroit très répétitif ») à 320, 375, 390 et
//      430 px : aucun libellé ni sous-ligne de case coupé (ni « … », ni texte qui
//      dépasse sa boîte, ni ellipse CSS qui le rogne) ;
//   J. aucun nombre de comptage (≥ 2) écrit deux fois dans Ma journée — montants,
//      %, dates, heures, N°, tailles, barres de la semaine et dernières ventes mis
//      à part ; le jeu pose des quantités toutes DIFFÉRENTES, si bien qu'un même
//      nombre deux fois ne peut être qu'une redite (« 3 À envoyer » et « 3
//      bordereaux prêts », « 0 sur 6 · 6 à compléter ») ;
//   K. à côté de la case « À envoyer », « À faire » ne redit ni « Emballer les colis
//      prêts » ni « N colis pressés » (la case porte « dont N aujourd'hui » et le
//      bouton « Emballer ») ; la famille « à retirer / à vérifier » tient en UNE
//      ligne au plus, et le geste « Emballer » reste joignable en un toucher.
// Captures : CAPTURES=<dossier> ; lancer :
//   npm run build && NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=96xx node scripts/bancs/journee-mieux.cjs
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData, metaDe } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || Number(process.env.PORT) || 4871;
const CAPT = process.env.CAPTURES || '';

// Un lundi après-midi, le 2 novembre : la déclaration URSSAF d'octobre est à faire
// (rythme mensuel), comme sur la capture de Julien du 1er novembre.
const maintenant = new Date(2026, 10, 2, 15, 30, 0);
const MS = maintenant.getTime();
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const ilYa = (j) => new Date(MS - j * 86400000).toISOString();
const dans = (j) => new Date(MS + j * 86400000).toISOString().slice(0, 10);
const UID = '111';
const AEXP = 'Le paiement a été validé';
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, conversation_id: id + 1000, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: (d instanceof Date ? d : new Date(d)).toISOString(), ...extra });
const VENTES = [
  vente(9101, 'Autry Reelwind rose taille 40', 80, AEXP, ilYa(8), { transaction_user_status: 'needs_action' }),
  vente(9102, 'Adidas Samba OG noir taille 41', 72, AEXP, ilYa(3), { transaction_user_status: 'needs_action' }),
  vente(9103, 'Nike Dunk Low panda taille 44', 65, AEXP, il(0, 11), { transaction_user_status: 'needs_action' }),
  vente(9104, 'Puma Speedcat rouge taille 39', 58, AEXP, il(1, 9), { transaction_user_status: 'needs_action' }),
  // Cochée « postée » il y a 3 jours, Vinted ne l'a pas vue partir : une ligne d'« À faire ».
  vente(9105, 'Vans Old Skool noir taille 41', 49, AEXP, il(5), { transaction_user_status: 'needs_action' }),
  vente(7003, 'Salomon XT-6 gris taille 43', 110, 'Colis en cours d\'acheminement', il(3), { transaction_user_status: 'waiting' }),
  vente(7005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(3), { transaction_user_status: 'completed' }),
  vente(7006, 'Nike Dunk Low gris taille 38', 61, 'Commande finalisée', il(8), { transaction_user_status: 'completed' }),
  vente(7007, 'Adidas Spezial bleu taille 39', 54, 'Commande finalisée', il(10), { transaction_user_status: 'completed' }),
  vente(7008, 'Converse Chuck 70 noir taille 42', 38, 'Commande finalisée', il(12), { transaction_user_status: 'completed' }),
];
const ACHATS = [
  { transaction_id: 9401, conversation_id: 7101, title: 'Adidas Gazelle taille 40', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) },
  // Au point relais selon Vinted, mais ni code ni n° de suivi : « pas encore relié ».
  { transaction_id: 9402, conversation_id: 7102, title: 'New Balance 550 taille 42', price: { amount: '45', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(2) },
];
const VERSE = { 7005: il(0, 10), 7006: il(5), 7007: il(7) };
const ANNONCES = Array.from({ length: 9 }, (_, k) => ({ id: 6000 + k, title: 'Annonce ' + k, price: { amount: String(40 + k * 7), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: il(30 + k).toISOString(), favourite_count: 0, view_count: 3 }));
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'arthuror2', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const jjmmaaaa = (j) => { const d = new Date(MS + j * 86400000); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const bord = (tx, suivi, limite) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi, receivedAt: ilYa(0.2), uid: UID, account: 'arthuror2', pdfB64: 'JVBERi0xLjQK', ...(limite ? { dateLimite: limite } : {}) } });
const LIGNES = [
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
  { id: `harvest_${UID}_listings`, data: { capturedAt: cap, payload: { items: ANNONCES, pagination: { total_entries: ANNONCES.length } } } },
  ...Object.entries(VERSE).map(([tx, d]) => ({ id: `harvest_${UID}_txn_${tx}`, data: { capturedAt: cap, payload: { transaction: { id: Number(tx), status: 450, status_title: 'Commande finalisée', status_updated_at: d.toISOString() } } } })),
  { id: `harvest_${UID}_txn_7008`, data: { capturedAt: cap, payload: { transaction: { id: 7008, status: 450, status_title: 'Commande finalisée' } } } },
  // Quatre colis à envoyer, quatre bordereaux prêts (« 4 À envoyer » et « 4
  // bordereaux prêts » : la redite de la capture) ; un doit partir AUJOURD'HUI à
  // 18 h, un demain à 10 h (« 2 colis pressés »), les deux autres plus tard.
  bord(9101, '12345678', `${jjmmaaaa(1)} 10 h 00`), bord(9102, 'VGS12345678', `${jjmmaaaa(0)} 18 h 00`), bord(9103, 'VGS12345679', `${jjmmaaaa(3)} 12 h 00`), bord(9104, 'VGS12345680', `${jjmmaaaa(4)} 12 h 00`),
  { id: 'panel_colis_relais', data: { '9401': { code: 'B11111', lieu: 'Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France', at: cap, url: 'https://www.vinted.fr/inbox/7101' } } },
  { id: 'email_track_vinted_1790000000000001', data: { type: 'suivi', carrier: 'vinted', suivi: '1790000000000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(1), code: 'A22222', lieu: '*Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue Saint-Vincent', limite: dans(4), consigne: true } },
  { id: 'email_track_mondialrelay_87654321', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '87654321', status: 'available', statusLabel: 'Disponible en Point Relais', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: '554433', lieu: 'Tabac du Port, 12 Quai Gambetta, 35260 Cancale', limite: dans(2) } },
  // Délai de retrait passé : « à vérifier », jamais « à retirer ».
  { id: 'email_track_mondialrelay_99887766', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '99887766', status: 'available', statusLabel: 'Disponible en Point Relais', subject: 'Votre colis est disponible', receivedAt: ilYa(12), code: '112233', lieu: 'Le Narval, 2 Place du Marché, 56000 Vannes', limite: dans(-3) } },
  // Cinq colis au délai de retrait dépassé (« à vérifier ») : des quantités toutes
  // Avec les deux colis à retirer ci-dessous, des quantités toutes différentes : 3 choses
  // à faire, 4 à envoyer, 5 à retirer, 7 délais dépassés (+ 1 pas encore relié = 8 à
  // vérifier), 2 ventes ce mois, 6 ventes en cours, 9 annonces.
  ...[['Bar des Halles, 3 Rue Hoche, 35000 Rennes', '77001122'], ['Presse du Marché, 8 Place Sainte-Anne, 35000 Rennes', '77001133']].map(([lieu, suivi], i) => ({ id: `email_track_mondialrelay_${suivi}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Disponible en Point Relais', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: `66${i}55${i}`, lieu, limite: dans(5) } })),
  ...[55, 44, 33, 22, 11, 66].map((k, i) => ({ id: `email_track_mondialrelay_998877${k}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: `998877${k}`, status: 'available', statusLabel: 'Disponible en Point Relais', subject: 'Votre colis est disponible', receivedAt: ilYa(13 + i), code: `9988${k}`, lieu: 'Le Narval, 2 Place du Marché, 56000 Vannes', limite: dans(-4 - i) } })),
];
const MAIN = {
  vinted_sale_overrides: { '9101': { numero: '60' }, '9102': { numero: '102' }, '9103': { numero: '73' }, '7005': { buyPrice: '40' }, '7006': { buyPrice: '25' } },
  vinted_ship_done: { '9105': MS - 3 * 86400000 },
  vinted_bords_printed: { '9101': new Date(new Date(maintenant).setHours(9, 0, 0, 0)).toISOString() },
  vinted_urssaf_regime: 'micro_achat_revente',
  vinted_urssaf_freq: 'mensuel', vinted_regime: 'micro',
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);


const SANS_ATTENTE = { v: 1, w: ['barre', 'afaire', 'vendu', 'semaine', 'recentes', 'stock', 'tendances'].map((id) => ({ id, t: { barre: 'pleine', afaire: 'pleine', recentes: 'grand', tendances: 'pleine' }[id] || 'moyen' })), connus: ['barre', 'afaire', 'vendu', 'semaine', 'attente', 'recentes', 'stock', 'jours14', 'performance', 'urssaf', 'envoyer', 'retirer', 'messages', 'prix', 'tendances'] };
const ouvrir = async (b, vp, sombre, sansAttente) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', deviceScaleFactor: tel ? 2 : 1, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([s, w]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_urssaf_freq', JSON.stringify('mensuel')); localStorage.setItem('vinted_regime', JSON.stringify('micro')); if (s) localStorage.setItem('vinted_dark', 'true'); if (w) localStorage.setItem('vrm_journee_widgets', JSON.stringify(w)); } catch (_) {} }, [!!sombre, sansAttente ? SANS_ATTENTE : null]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : /api-adresse|openfreemap/.test(r.request().url()) ? r.abort() : r.continue()));
  const main = { ...MAIN, ...(sombre ? { vinted_dark: true } : {}), ...(sansAttente ? { vrm_journee_widgets: SANS_ATTENTE } : {}) };
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    // (14 nov., bancs au vert) La base servie comme PostgREST (`_minipgrest`) : `id=in.(…)`, `or=(…)`,
    // filtres `data->>k`, projections mixtes, la colonne `meta` entière. L'ancien faux ne servait que
    // `id=eq.` et `id=like.` : depuis que l'app lit les e-mails de suivi, les achats et les panneaux par
    // `id=in.(…)`, la scène (5 à retirer, 8 à vérifier) n'arrivait plus à l'écran — J et K mesuraient
    // une Ma journée sans ses colis. Toutes les lignes sont celles de la session (`owner=eq.` ignoré).
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const url = u.replace(/[?&]owner=eq\.[^&]*/, (m) => (m[0] === '?' ? '?' : '')).replace('?&', '?');
    const s = servir([{ id: 'main', data: main }, ...LIGNES].map((r) => ({ ...r, meta: metaDe(r.data), updated_at: cap })), url.replace(/\+/g, ' ').replace(/#/g, '%23'), route.request().headers());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': s.range }, body: JSON.stringify(s.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // Le bénéfice se publie en lisant les ventes (écran Ventes) ; Colis publie ses prêts.
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_benefice_jours') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('[data-vendu-mois]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
  await pg.waitForFunction(() => { const r = document.querySelector('[data-tournee-etape="retirer"]'); const i = document.querySelector('[data-tournee-etape="imprimer"]'); return r && i && r.getAttribute('data-etat') !== 'passu' && i.getAttribute('data-etat') !== 'passu'; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForFunction(() => document.querySelector('[data-job="retrait-a-verifier"]'), null, { timeout: 10000 }).catch(() => {});
  await pg.evaluate(() => document.fonts && document.fonts.ready);
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs };
};

const lire = (pg) => pg.evaluate(() => {
  const vu = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && !e.closest('[aria-hidden="true"]'); };
  const lignesDe = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const ys = [...rg.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round((q.top + q.bottom) / 2)).sort((a, b) => a - b); let k = 0, der = -1e9; for (const y of ys) { if (y - der > 6) { k++; der = y; } } return k; };
  const coupe = (e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2;
  // Contraste : couleur du texte contre le premier fond opaque au-dessus.
  const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const fond = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a > 0.9) return c; } return { r: 255, g: 255, b: 255 }; };
  const contraste = (e) => { const t = rgb(getComputedStyle(e).color), f = fond(e); if (!t) return 21; const a = lum(t), b = lum(f); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };

  const tete = document.querySelector('.vrm-day-hello');
  // B. « À faire » (et les alertes de tête, même forme).
  const rangs = [...document.querySelectorAll('.vrm-day-task-list [data-job]')].filter(vu).map((e) => {
    const t = e.querySelector('.vrm-day-task-title'), n = e.querySelector('.vrm-day-task-note');
    const plein = e.getAttribute('title') || (e.querySelector('[title]') || {}).title || '';
    return { job: e.getAttribute('data-job'), h: Math.round(e.getBoundingClientRect().height), lt: t ? lignesDe(t) : 0, ln: n && vu(n) ? lignesDe(n) : 0, coupeT: t ? coupe(t) : false, coupeN: n ? coupe(n) : false, note: n ? n.textContent : '', titre: t ? t.textContent : '', plein, groupe: e.getAttribute('role') === 'group', cN: n && vu(n) ? contraste(n) : 21 };
  });
  // C. La Tournée.
  const tr = [...document.querySelectorAll('[data-tournee] .vrm-tr-t, [data-tournee] .vrm-tr-s')].filter(vu).map((e) => ({ txt: e.textContent, coupe: coupe(e), points: /…$/.test(e.textContent.trim()), c: contraste(e) }));
  // D. Redites.
  const tourneeVue = vu(document.querySelector('[data-tournee]'));
  const caseVue = (id) => [...document.querySelectorAll(`[data-tuile="${id}"], [data-widget-tuile="${id}"]`)].some(vu);
  const emballerJob = [...document.querySelectorAll('[data-job="emballer"]')].some(vu);
  // E. Les chiffres.
  const grille = document.querySelector('.vrm-widgets');
  const gR = grille ? grille.getBoundingClientRect() : null;
  const chiffres = ['vendu', 'semaine', 'attente', 'tendances'].map((id) => document.querySelector(`.vrm-widget[data-widget="${id}"]`)).filter((e) => e && vu(e)).map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-widget'), top: Math.round(r.top + scrollY), l: r.left, r: r.right, h: Math.round(r.height) }; });
  const parRang = {}; for (const c of chiffres) (parRang[c.top] = parRang[c.top] || []).push(c);
  const rangsChiffres = Object.values(parRang).map((l) => ({ ids: l.map((c) => c.id).join('+'), part: gR ? (Math.max(...l.map((c) => c.r)) - Math.min(...l.map((c) => c.l))) / gR.width : 0, hs: l.map((c) => c.h) }));
  // F. Tendances.
  const tendVides = [...document.querySelectorAll('[data-tendance]')].filter(vu).filter((e) => e.getAttribute('data-v') === '').map((e) => e.getAttribute('data-tendance'));
  // G. La colonne.
  const rail = [...document.querySelectorAll('.vrm-atelier-rail .vrm-rail-button, .vrm-atelier-rail a, .vrm-atelier-rail button')].filter(vu);
  let railMasque = false; for (const e of document.querySelectorAll('.vrm-rail-scroll')) { const cs = getComputedStyle(e); if ((cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none')) railMasque = true; }
  const railPales = rail.filter((e) => { let o = 1; for (let n = e; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || '1'); return o < 0.95 && !e.disabled && e.getAttribute('aria-disabled') !== 'true'; }).map((e) => e.textContent.trim().slice(0, 20));
  // I. Les cases : libellé et sous-ligne jamais coupés.
  const cases = [...document.querySelectorAll('[data-barre-jour] [data-tuile], [data-widget-tuile]')].filter(vu).map((bt) => {
    const id = bt.getAttribute('data-tuile') || bt.getAttribute('data-widget-tuile');
    const r = bt.getBoundingClientRect();
    const textes = [...bt.querySelectorAll('.vrm-day-bar-l, .vrm-w-tuile-l, .vrm-day-bar-sous')].filter(vu).map((e) => {
      const cs = getComputedStyle(e), q = e.getBoundingClientRect();
      const rogne = cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible' && cs.whiteSpace === 'nowrap';
      return { t: e.textContent, coupe: e.scrollWidth > e.clientWidth + 1 || /…\s*$/.test(e.textContent) || q.right > r.right + 1 || rogne, sw: e.scrollWidth, cw: e.clientWidth, rogne };
    });
    return { id, textes };
  });
  // J. Les nombres de comptage écrits dans Ma journée.
  const zone = document.querySelector('.vrm-day-layout');
  const morceaux = [];
  if (zone) {
    const tw = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const p = n.parentElement; if (!p || !n.textContent.trim()) continue;
      // Hors jeu : les dernières ventes (prix, N°, tailles) et la carte de la semaine (axe des jours, barres).
      // (14 nov.) Depuis Ma journée v2 (9 nov.), l'axe des jours est la frise des sept jours (`[data-fu-semaine]`) :
      // « 27 28 29 30 31 1 2 » sont des DATES (le 2 = aujourd'hui), pas des quantités.
      if (p.closest('.vrm-day-recent, [data-carte-jours], [data-fu-semaine], svg, [aria-hidden="true"], .vrm-screen-head, [hidden], .vrm-sr-only')) continue;
      if (!vu(p)) continue;
      morceaux.push(n.textContent);
    }
  }
  const brut = morceaux.join(' ').replace(/\s+/g, ' ');
  const net = brut
    .replace(/[+−-]?\d[\d\s\u202f\u00a0]*(?:,\d+)?\s*(?:€|%|c\/j)/g, ' ')
    .replace(/N°\s*[A-Z]?\d+/gi, ' ').replace(/taille \d+/gi, ' ')
    .replace(/\b20\d\d\b/g, ' ')
    .replace(/\d+\s*h(?:\s*\d+)?\b/g, ' ').replace(/\b\d+\s*j\b/g, ' ').replace(/\b\d+ derniers jours\b/g, ' ')
    .replace(/\b\d{1,2}(?:er)?\s+(?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\w*\.?/gi, ' ');
  const nombres = (net.match(/\b\d+\b/g) || []).map(Number).filter((x) => x >= 2);
  const vus = {}; for (const x of nombres) vus[x] = (vus[x] || 0) + 1;
  const redits = Object.keys(vus).filter((k) => vus[k] > 1);
  // K. Ce que « À faire » redit à côté des cases.
  const afaireRangs = [...document.querySelectorAll('.vrm-day-task-list [data-job]')].filter(vu);
  const k = {
    emballerLigne: afaireRangs.filter((e) => e.getAttribute('data-job') === 'emballer' || /Emballer les colis/i.test(e.textContent)).length,
    pressesLigne: afaireRangs.filter((e) => (e.getAttribute('data-job') === 'colis-limite' && !e.closest('[data-alertes-argent]')) || /colis pressés/i.test(e.textContent)).length,
    verifLignes: afaireRangs.filter((e) => /^retrait-(a-verifier|en-verification)$/.test(e.getAttribute('data-job'))).length,
    emballerGeste: [...document.querySelectorAll('[data-job="emballer"]')].filter(vu).map((e) => ({ dansCase: !!e.closest('[data-case="envoyer"]'), h: Math.round(e.getBoundingClientRect().height) })),
    sousEnvoyer: (document.querySelector('[data-case="envoyer"] [data-sous-ligne]') || {}).textContent || '',
    sousRetirer: (document.querySelector('[data-case="retirer"] [data-sous-ligne]') || {}).textContent || '',
    ambreEnvoyer: (() => { const e = document.querySelector('[data-case="envoyer"] [data-sous-ligne]'); return e ? getComputedStyle(e).color : ''; })(),
    warn: getComputedStyle(document.documentElement).getPropertyValue('--vrm-warn').trim(),
  };
  return {
    cases, nombres, redits, k, texteNombres: net.slice(0, 600),
    tete: vu(tete), tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    deb: document.documentElement.scrollWidth - window.innerWidth,
    rangs, tr, tourneeVue, envoyerVue: caseVue('envoyer'), retirerVue: caseVue('retirer'), emballerJob,
    tourneeEmballer: !!document.querySelector('[data-tournee-etape="emballer"]'),
    rangsChiffres, tendVides, railMasque, railPales, railN: rail.length,
  };
});

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    if (CAPT) fs.mkdirSync(CAPT, { recursive: true });
    // Mise au point : SONDE='<expression>' SONDE_L=1512 évalue une expression dans la page et s'arrête.
    if (process.env.SONDE) {
      const { ctx, pg } = await ouvrir(b, { width: Number(process.env.SONDE_L) || 1512, height: 950 }, !!process.env.SONDE_SOMBRE, false);
      console.log(JSON.stringify(await pg.evaluate(process.env.SONDE), null, 1));
      await ctx.close(); await b.close(); srv.close(); process.exit(0);
    }
    const cas = [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 320, height: 640 }, false], [{ width: 375, height: 812 }, false], [{ width: 430, height: 932 }, false], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true], [{ width: 1440, height: 600 }, false], [{ width: 1280, height: 800 }, false], [{ width: 1512, height: 950 }, false, 'sans-attente']];
    for (const [vp, sombre, variante] of cas) {
      const nom = `${vp.width}${sombre ? '-sombre' : ''}${variante ? '-' + variante : ''}`;
      // Mise au point : SEUL=390 ne joue que ce cas.
      if (process.env.SEUL && process.env.SEUL !== nom) continue;
      const tel = vp.width < 600;
      console.log(`\n── Ma journée, ${nom}`);
      await essaie(nom, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre, variante === 'sans-attente');
        if (CAPT) {
          // L'écran défile dans un conteneur : la capture ENTIÈRE agrandit la fenêtre à sa hauteur.
          const haut = await pg.evaluate(() => { let m = document.documentElement.scrollHeight; for (const e of document.querySelectorAll('*')) { const o = getComputedStyle(e).overflowY; if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 4) m = Math.max(m, e.scrollHeight + e.getBoundingClientRect().top); } return Math.ceil(m); });
          await pg.setViewportSize({ width: vp.width, height: Math.min(5200, Math.max(vp.height, haut)) });
          await pg.waitForTimeout(600);
          await pg.screenshot({ path: path.join(CAPT, `journee-${nom}.png`) });
          await pg.setViewportSize(vp); await pg.waitForTimeout(400);
        }
        const lu = await lire(pg);
        dit(!lu.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit(lu.deb <= 1, 'aucun débordement horizontal', `${lu.deb} px`);
        if (!tel) dit(lu.tete, 'A. l’en-tête (bonjour, date) se voit sur ordinateur');
        // B.
        const simples = lu.rangs.filter((r) => !r.groupe && r.lt === 1);
        const maxN = tel ? 2 : 1;
        dit(lu.rangs.length >= 2, 'B. « À faire » porte ses lignes (alertes comprises)', JSON.stringify(lu.rangs.map((r) => r.job)));
        // Le titre : UNE ligne sur ordinateur ; au téléphone, une si possible, deux au plus
        // (une alerte de tête ne perd pas son sens : « 2 articles vendus sur Leboncoin, … »).
        dit(lu.rangs.every((r) => r.lt >= 1 && r.lt <= maxN && !r.coupeT), `B. chaque titre tient sur ${tel ? 'une ou deux lignes' : 'UNE ligne'}, sans être coupé`, JSON.stringify(lu.rangs.filter((r) => r.lt < 1 || r.lt > maxN || r.coupeT).map((r) => [r.job, r.lt, r.titre])));
        if (tel) dit(lu.rangs.filter((r) => r.lt === 1).length >= 2, 'B. au téléphone, les titres de ce jeu tiennent sur UNE ligne', JSON.stringify(lu.rangs.map((r) => [r.job, r.lt])));
        // (1er nov., « très répétitif ») UNE ligne de détail, téléphone compris (deux au
        // téléphone avant) : la phrase entière reste dans l'infobulle et le nom du bouton.
        dit(lu.rangs.every((r) => r.ln <= 1 && !r.coupeN), 'B. au plus UNE ligne de détail, qui tient dans sa boîte', JSON.stringify(lu.rangs.filter((r) => r.ln > 1 || r.coupeN).map((r) => [r.job, r.ln, r.note])));
        const hs = simples.map((r) => r.h);
        // (320 px : un titre passe à deux lignes, il ne reste parfois qu'une ligne « simple » à comparer.)
        const largeurAjoutee = [320, 375, 430].includes(vp.width);
        if (!(largeurAjoutee && hs.length < 2)) dit(hs.length > 1 && Math.max(...hs) - Math.min(...hs) <= 2, 'B. toutes les lignes ont la même hauteur', JSON.stringify(simples.map((r) => [r.job, r.h])));
        const malCoupe = lu.rangs.filter((r) => /…$/.test(r.note.trim())).filter((r) => { const pre = r.note.trim().replace(/…$/, '').trim(); const i = r.plein.indexOf(pre); return i < 0 || /[\p{L}\p{N}]/u.test(r.plein.charAt(i + pre.length)); });
        dit(malCoupe.length === 0, 'B. un détail raccourci l’est à la fin d’un mot, le texte entier dans l’infobulle', JSON.stringify(malCoupe.map((r) => [r.note, r.plein.slice(0, 80)])));
        dit(lu.rangs.every((r) => r.cN >= 4.5), 'H. le détail se lit (contraste ≥ 4,5)', JSON.stringify(lu.rangs.map((r) => Math.round(r.cN * 10) / 10)));
        // C.
        // (1er nov., Julien : « enlève Tournée » sur Ma journée) La carte n'est plus là :
        // C ne s'applique que si elle revient.
        if (!tel && lu.tourneeVue) {
          dit(lu.tr.length >= 4 && lu.tr.every((t) => !t.coupe && !t.points), 'C. Tournée : aucun titre ni sous-titre coupé', JSON.stringify(lu.tr.filter((t) => t.coupe || t.points).map((t) => t.txt)));
        }
        dit(lu.tr.every((t) => t.c >= 4.5), 'H. Tournée : contraste ≥ 4,5', JSON.stringify(lu.tr.map((t) => Math.round(t.c * 10) / 10)));
        // D.
        dit(!lu.tourneeVue, 'D. la Tournée n’est plus sur Ma journée (sa décision du 1er nov.)');
        dit(lu.envoyerVue && lu.retirerVue, 'D. sans Tournée, les cases « à envoyer » et « à retirer » se voient', JSON.stringify({ envoyer: lu.envoyerVue, retirer: lu.retirerVue }));
        dit(!(lu.tourneeVue && (lu.envoyerVue || lu.retirerVue)), 'D. le nombre « à envoyer / à retirer » ne se voit pas deux fois (case + Tournée)', JSON.stringify({ envoyer: lu.envoyerVue, retirer: lu.retirerVue }));
        dit(!(lu.tourneeVue && lu.emballerJob), 'D. « Emballer les colis prêts » n’est pas redit dans « À faire » (l’étape Emballer y mène)');
        // I.
        const coupes = lu.cases.flatMap((c) => c.textes.filter((t) => t.coupe).map((t) => `${c.id}: « ${t.t} » (${t.sw}/${t.cw}${t.rogne ? ', ellipse' : ''})`));
        // (Les cases à zéro ne prennent plus de place : une carte « À faire » par geste — retiré à la demande de Julien, 2 nov. 22 h (maquette FusionJournee).)
        dit(lu.cases.length >= 1 && coupes.length === 0, 'I. aucun libellé ni sous-ligne de case coupé', coupes.join(' · ') || `${lu.cases.length} cases`);
        // J.
        dit(lu.nombres.length >= 4 && lu.redits.length === 0, 'J. aucun nombre de comptage écrit deux fois dans Ma journée', lu.redits.length ? `redits : ${lu.redits.join(', ')} — ${lu.texteNombres.slice(0, 900)}` : lu.nombres.join(','));
        // K.
        dit(lu.k.emballerLigne === 0 && lu.k.pressesLigne === 0, 'K. « À faire » ne redit ni « Emballer les colis prêts » ni « N colis pressés » à côté de la case', JSON.stringify({ emballer: lu.k.emballerLigne, presses: lu.k.pressesLigne }));
        dit(lu.k.verifLignes <= 1, 'K. « à vérifier » tient en UNE ligne d’« À faire » au plus', String(lu.k.verifLignes));
        // (« Emballer » n'est plus un bouton de Ma journée : la carte « Colis à poster » mène à Colis, où
        //  « … » le donne — retiré à la demande de Julien, 2 nov. 22 h (maquette FusionJournee).)
        dit(lu.k.emballerGeste.length === 0, 'K. pas de second bouton « Emballer » sur Ma journée (la carte « Colis à poster » mène à Colis)', JSON.stringify(lu.k.emballerGeste));
        dit(/^dont \d+ aujourd'hui$/.test(lu.k.sousEnvoyer.trim()) && /^\+ \d+ à vérifier$/.test(lu.k.sousRetirer.trim()), 'K. les cases portent l’urgence (« dont N aujourd’hui ») et le « à vérifier » (« + N à vérifier »)', JSON.stringify([lu.k.sousEnvoyer, lu.k.sousRetirer]));
        // E.
        // (E) La rangée des chiffres (widgets) n'est plus rendue sur Ma journée — retiré à la demande de
        //     Julien, 2 nov. 22 h (maquette FusionJournee) : jugée seulement si le drapeau la remet.
        if (vp.width >= 1280 && /const JOURNEE_AVEC_WIDGETS = true;/.test(require('fs').readFileSync(require('path').join(__dirname, '../../src/App.jsx'), 'utf8'))) {
          dit(lu.rangsChiffres.length >= 1 && lu.rangsChiffres.every((r) => r.part >= 0.9), 'E. les chiffres occupent ≥ 90 % de la largeur, rangée par rangée', JSON.stringify(lu.rangsChiffres));
          dit(lu.rangsChiffres.every((r) => Math.max(...r.hs) - Math.min(...r.hs) <= 2), 'E. les cartes d’une même rangée ont la même hauteur', JSON.stringify(lu.rangsChiffres));
        }
        // F.
        dit(lu.tendVides.length === 0, 'F. Tendances : aucune case « — » sans base posée comme un chiffre', JSON.stringify(lu.tendVides));
        // G.
        if (!tel) dit(lu.railN > 4 && !lu.railMasque && lu.railPales.length === 0, 'G. la colonne : aucune entrée fondue ni pâlie', JSON.stringify({ masque: lu.railMasque, pales: lu.railPales }));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
