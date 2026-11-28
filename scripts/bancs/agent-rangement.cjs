// Banc : « L'ASSISTANT DE RANGEMENT » (28 nov. 2026, lot agent-rangement). Récit : docs/passation/2026-11-28-agent-rangement.md.
// Julien : « je veux un vrai agent IA qui pose des questions, totalement intelligent, qui adapte les étages, les pièces ».
// Données INVENTÉES (dépôt public). La route /api/ai est SIMULÉE (aucun appel réel, aucune clé).
//   A  (sans IA, base de 2 meubles et 10 cartons) : l'entrée du Stock ouvre la feuille ; le moteur « sans IA » est DIT ;
//      une question à la fois, en boutons ; « modifier » → ajouter un meuble dans une nouvelle pièce « Cave » (tapée) → le
//      plan dessiné ; « Appliquer ce plan » écrit `vrm_meubles` (3 meubles, pièces notées) ; AUCUN N° changé, aucune case
//      bougée (`vrm_slots` identique, `vinted_annonce_numeros` identique) ; le Stock se range par pièce.
//   B  (avec IA simulée) : le moteur « IA » est dit ; la question du modèle s'affiche avec SES boutons ; la réponse suivante
//      (un plan valide) est dessinée ; « Recommencer » → une réponse INVALIDE est REFUSÉE et l'assistant passe SANS IA.
//   C  (base vide) : l'entrée du vide ouvre l'assistant ; 1 pièce / 1 meuble ⇒ un meuble créé, rien d'autre.
//   Q  sur chaque rendu : pas de défilement de côté, au plus UN plein dans la feuille, boutons de réponse ≥ 44 px, aucune
//      erreur de page.
// Rendus : 390 tactile clair, 390 tactile sombre, 1512 clair, 1512 sombre. `SHOT=prefixe` : les captures (jamais commitées).
//   BANC_PORT=4851 SHOT=/tmp/rgt node scripts/bancs/agent-rangement.cjs
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const AUJ = Date.now();

function base(volume) {
  if (!volume) return { main: { vinted_annonce_numeros: {}, vrm_meubles: [], vrm_slots: {}, vinted_nums_physiques: { nums: [], at: AUJ }, vrm_je_vends: { choix: 'sneakers' } }, listings: [] };
  const NUMEROS = {}; const NUMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  NUMS.forEach((n, k) => { NUMEROS[String(8000 + k)] = { numero: n, title: 'Paire de banc ' + n, photo: null, accountId: '111' }; });
  const meubles = [{ id: 'mA', name: 'Étagère entrée', cols: 4, rows: 2 }, { id: 'mB', name: 'Armoire', cols: 3, rows: 3, couleur: 'sable' }];
  const slots = {}; NUMS.slice(0, 6).forEach((n, i) => { slots[n] = { m: 'mA', i }; }); NUMS.slice(6, 10).forEach((n, i) => { slots[n] = { m: 'mB', i }; });
  const enLigne = Object.keys(NUMEROS).map((id) => ({ id: Number(id), title: NUMEROS[id].title, is_closed: false, is_hidden: false, is_draft: false, price: { amount: '60.0', currency_code: 'EUR' }, photo: null }));
  return { main: { vinted_annonce_numeros: NUMEROS, vrm_meubles: meubles, vrm_slots: slots, vinted_nums_physiques: { nums: NUMS, at: AUJ }, vrm_je_vends: { choix: 'sneakers' } },
    listings: [{ id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), nItems: enLigne.length, payload: { items: enLigne } } }] };
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const serveur = (dist) => http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(dist, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const PORT = Number(process.env.BANC_PORT) || 0;
const ecouter = (srv) => new Promise((ok) => srv.listen(PORT, () => ok(srv.address().port)));

// L'IA simulée : `moteur` (ce que dit la sonde) et la FILE des réponses du modèle (une par POST).
async function rendre(b, port, { tel, sombre, volume = true, moteur = null, reponses = [] }) {
  const B = base(volume);
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const posts = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(volume ? [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] : []);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: B.main }]);
    if (/id=like\.harvest_\*_listings/.test(u) || /id=eq\.harvest_111_listings/.test(u)) return j(B.listings);
    return j([]);
  });
  await pg.route('**/api/**', async (r) => {
    const u = r.request().url();
    if (/\/api\/ai\?usage=rangement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, moteur }) });
    if (/\/api\/ai$/.test(u.split('?')[0]) && r.request().method() === 'POST') {
      posts.push(JSON.parse(r.request().postData() || '{}'));
      const rep = reponses.shift();
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep ? { ok: true, reponse: rep } : { ok: false, reason: 'no-key' }) });
    }
    if (/mode=ia-cle/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, etat: moteur === 'vendeur' ? 'posee' : 'aucune', fin: moteur === 'vendeur' ? 'Ab12' : null, verif: 'ok' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.addInitScript(({ m, sombre }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.removeItem('vrm_stock_v2_vue'); localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); } catch (_) {} }, { m: B.main, sombre });
  await pg.goto(`http://localhost:${port}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, B, posts };
}
const shot = async (pg, nom) => { if (process.env.SHOT) await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png`, fullPage: false }).catch(() => {}); };
const toucher = async (pg, tel, sel) => { const el = pg.locator(sel).locator('visible=true').first(); await el.waitFor({ state: 'visible', timeout: 10000 }); await el.scrollIntoViewIfNeeded(); if (tel) await el.tap(); else await el.click(); await pg.waitForTimeout(250); };
const question = (pg) => pg.getAttribute('[data-rgt-question]', 'data-rgt-question', { timeout: 6000 }).catch(() => null);
const repondre = async (pg, tel, attendu, v) => {
  await pg.waitForSelector(`[data-rgt-question="${attendu}"]`, { timeout: 6000 }).catch(() => {});
  const q = await question(pg);
  if (q !== attendu) return `attendu ${attendu}, eu ${q}`;
  if (v && v.texte) { await pg.fill('[data-rgt-saisie]', v.texte); await toucher(pg, tel, '[data-rgt-envoyer]'); }
  else await toucher(pg, tel, `[data-rgt-choix="${v}"]`);
  await pg.waitForTimeout(150);
  return null;
};
const lireLs = (pg) => pg.evaluate(() => { const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }; return { meubles: j('vrm_meubles'), slots: j('vrm_slots'), numeros: localStorage.getItem('vinted_annonce_numeros') }; });
const regles = (pg) => pg.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return e.getClientRects().length && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const f = document.querySelector('[data-n-feuille-couche][data-n-etat="ouverte"] .n-feuille') || document;
  const pleins = [...f.querySelectorAll('[data-n-variante="plein"]')].filter(vis).length;
  const petits = [...f.querySelectorAll('.rgt-choix-b, [data-rgt-envoyer], [data-rgt-photo], .rgt-saisie-champ')].filter(vis).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5; }).map((b) => (b.textContent || b.getAttribute('aria-label') || '').slice(0, 20));
  const deborde = [...f.querySelectorAll('.rgt-bulle, .rgt-choix-b, .rgt-meuble')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).length;
  return { pleins, petits, deborde, sw: document.documentElement.scrollWidth, iw: innerWidth };
});
const verifQ = async (pg, t, quoi) => { const g = await regles(pg); dit(g.sw <= g.iw && g.pleins <= 1 && !g.petits.length && !g.deborde, `${t} : Q — ${quoi} : pas de défilement de côté, un plein au plus, réponses ≥ 44 px`, JSON.stringify(g)); };

async function scenarioA(b, port, { tel, sombre, nom }) {
  const t = nom + ' A';
  const r = await rendre(b, port, { tel, sombre, moteur: null });
  const { pg } = r;
  await pg.waitForSelector('[data-sm-tous]', { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const avant = await lireLs(pg);
  await toucher(pg, tel, '[data-rgt-ouvrir=""]');
  await pg.waitForSelector('[data-rgt="regles"]', { timeout: 8000 }).catch(() => {});
  const m = await pg.evaluate(() => { const e = document.querySelector('[data-rgt-moteur]'); return e ? { m: e.getAttribute('data-rgt-moteur'), t: e.textContent } : null; });
  dit(m && m.m === 'regles' && /sans IA/.test(m.t) && /clé IA/.test(m.t), `${t} : le moteur SANS IA est dit, et comment ajouter sa clé`, JSON.stringify(m));
  await pg.waitForSelector('[data-rgt-question="mode"]', { timeout: 6000 }).catch(() => {});
  await shot(pg, nom + '-A-debut');
  await verifQ(pg, t, 'la première question');
  const faux = [];
  const pas = [['mode', 'modifier'], ['changer', 'ajouterMeuble'], ['quellePiece', 'nouvelle'], ['nomPiece', { texte: 'Cave' }], ['type', 'casier'], ['etages', { texte: '2 étages' }], ['cases', '3'], ['changer', 'fini']];
  for (const [q, v] of pas) { const e = await repondre(pg, tel, q, v); if (e) { faux.push(e); break; } }
  dit(!faux.length, `${t} : une question à la fois, l'entretien suit les réponses (modifier → meuble dans une pièce tapée → fini)`, faux.join(' '));
  await pg.waitForSelector('[data-rgt-apercu]', { timeout: 6000 }).catch(() => {});
  const ap = await pg.evaluate(() => ({ n: Number((document.querySelector('[data-rgt-apercu]') || {}).getAttribute ? document.querySelector('[data-rgt-apercu]').getAttribute('data-rgt-apercu') : 0),
    pieces: [...document.querySelectorAll('[data-rgt-piece]')].map((e) => e.getAttribute('data-rgt-piece')), dep: (document.querySelector('[data-rgt-deplacements]') || { getAttribute: () => null }).getAttribute('data-rgt-deplacements'),
    dessins: document.querySelectorAll('[data-rgt-meuble] .sm-meuble').length }));
  dit(ap.n === 3 && ap.pieces.includes('Cave') && ap.dessins === 3 && ap.dep === '0', `${t} : le plan est DESSINÉ (3 meubles, pièce « Cave », aucun déplacement)`, JSON.stringify(ap));
  const pendant = await lireLs(pg);
  dit(JSON.stringify(pendant.meubles) === JSON.stringify(avant.meubles), `${t} : rien n'est écrit avant « Appliquer ce plan »`, '');
  await pg.evaluate(() => { const e = document.querySelector('[data-rgt-apercu]'); if (e) e.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(250);
  await shot(pg, nom + '-A-plan');
  await verifQ(pg, t, 'l\'aperçu du plan');
  await toucher(pg, tel, '[data-rgt-appliquer]');
  await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_meubles') || '[]').length === 3; } catch (_) { return false; } }, null, { timeout: 6000 }).catch(() => {});
  const apres = await lireLs(pg);
  dit(apres.meubles && apres.meubles.length === 3 && apres.meubles.some((x) => x.piece === 'Cave' && x.cols === 3 && x.rows === 2) && apres.meubles.filter((x) => x.id === 'mA' || x.id === 'mB').length === 2,
    `${t} : « Appliquer » écrit 3 meubles (les 2 d'hier gardés par id, le casier 3 × 2 dans « Cave »)`, JSON.stringify(apres.meubles && apres.meubles.map((x) => [x.id, x.piece, x.cols, x.rows])));
  dit(apres.numeros === avant.numeros && JSON.stringify(apres.slots) === JSON.stringify(avant.slots), `${t} : N1 — AUCUN N° changé, aucune case bougée`, '');
  await pg.waitForTimeout(600);
  const grp = await pg.evaluate(() => [...document.querySelectorAll('[data-sm-piece-titre]')].map((e) => e.textContent));
  dit(grp.length === 2 && grp.includes('Cave'), `${t} : le Stock se range par pièce`, grp.join(' | '));
  await shot(pg, nom + '-A-stock');
  dit(!r.errs.length, `${t} : Q — aucune erreur de page`, r.errs.slice(0, 2).join(' | '));
  await r.ctx.close();
}

async function scenarioB(b, port, { tel, sombre, nom }) {
  const t = nom + ' B';
  const plan = { version: 1, pieces: [{ nom: 'Garage', meubles: [{ ref: 'mA', nom: 'Étagère entrée', type: 'etagere', etages: 3, casesParEtage: 4, porte: true }, { ref: 'mB', nom: 'Armoire', type: 'armoire', etages: 3, casesParEtage: 3 }] },
    { nom: 'Chambre', meubles: [{ ref: null, nom: 'Pile A', type: 'pile', etages: 6, casesParEtage: 2 }] }], etiquetage: null };
  const reponses = [
    { type: 'question', texte: 'Ton étagère d’entrée a combien d’étages en vrai ? Sur ta photo j’en vois 3.', choix: ['2', '3', '4'], saisie: 'nombre', photo: true },
    { type: 'plan', plan, explication: 'J’ai ajouté un étage à l’étagère près de la porte et une pile de 12 boîtes dans la chambre.' },
    { type: 'plan', plan: { ...plan, numeros: { 1: 99 } }, explication: 'Je renumérote.' },   // INVALIDE (clé inconnue) : refusée
  ];
  const r = await rendre(b, port, { tel, sombre, moteur: 'vendeur', reponses });
  const { pg } = r;
  await pg.waitForSelector('[data-sm-tous]', { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const avant = await lireLs(pg);
  await toucher(pg, tel, '[data-rgt-ouvrir=""]');
  await pg.waitForSelector('[data-rgt-question="ia"]', { timeout: 8000 }).catch(() => {});
  const m = await pg.evaluate(() => { const e = document.querySelector('[data-rgt-moteur]'); return e ? { m: e.getAttribute('data-rgt-moteur'), t: e.textContent } : null; });
  dit(m && m.m === 'ia' && /IA, avec ta clé/.test(m.t), `${t} : le moteur IA (sa clé) est dit`, JSON.stringify(m));
  const boutons = await pg.evaluate(() => [...document.querySelectorAll('.rgt-choix-b')].map((e) => e.textContent));
  dit(boutons.join() === '2,3,4', `${t} : la question du modèle s'affiche avec SES boutons`, boutons.join(','));
  const corps = r.posts[0] || {};
  dit(corps.mode === 'rangement' && !('key' in corps) && corps.contexte && Array.isArray(corps.contexte.meubles) && !/Paire de banc/.test(JSON.stringify(corps)), `${t} : la requête : aucune clé envoyée par le navigateur, ni titre d'annonce`, JSON.stringify(corps).slice(0, 200));
  await shot(pg, nom + '-B-question');
  await verifQ(pg, t, 'la question de l\'IA');
  await toucher(pg, tel, '[data-rgt-choix="3"]');
  await pg.waitForSelector('[data-rgt-apercu]', { timeout: 8000 }).catch(() => {});
  const ap = await pg.evaluate(() => ({ n: document.querySelectorAll('[data-rgt-meuble]').length, porte: document.querySelectorAll('[data-rgt-porte]').length, pieces: [...document.querySelectorAll('[data-rgt-piece]')].map((e) => e.getAttribute('data-rgt-piece')) }));
  dit(ap.n === 3 && ap.porte === 1 && ap.pieces.join() === 'Garage,Chambre', `${t} : le plan VALIDE de l'IA est dessiné (2 pièces, 3 meubles, la porte marquée)`, JSON.stringify(ap));
  dit(r.posts[1] && r.posts[1].historique && r.posts[1].historique.slice(-1)[0].texte === '3', `${t} : SA réponse part au modèle avec l'historique`, JSON.stringify(r.posts[1] && r.posts[1].historique));
  await pg.evaluate(() => { const e = document.querySelector('[data-rgt-apercu]'); if (e) e.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(250);
  await shot(pg, nom + '-B-plan');
  await verifQ(pg, t, 'le plan de l\'IA');
  await toucher(pg, tel, '[data-rgt-recommencer]');
  await pg.waitForSelector('[data-rgt="regles"]', { timeout: 8000 }).catch(() => {});
  const apres = await pg.evaluate(() => ({ m: document.querySelector('[data-rgt-moteur]') && document.querySelector('[data-rgt-moteur]').getAttribute('data-rgt-moteur'), apercu: !!document.querySelector('[data-rgt-apercu]'), bulles: [...document.querySelectorAll('[data-rgt-bulle]')].map((e) => e.textContent).join(' | ') }));
  dit(apres.m === 'regles' && !apres.apercu && /n’était pas valable/.test(apres.bulles), `${t} : une réponse INVALIDE de l'IA est refusée (jamais dessinée) ; l'assistant passe SANS IA et le dit`, JSON.stringify(apres).slice(0, 300));
  await shot(pg, nom + '-B-refus');
  const ls = await lireLs(pg);
  dit(JSON.stringify(ls.meubles) === JSON.stringify(avant.meubles) && JSON.stringify(ls.slots) === JSON.stringify(avant.slots), `${t} : rien n'a été écrit (aucun « Appliquer »)`, '');
  dit(!r.errs.length, `${t} : Q — aucune erreur de page`, r.errs.slice(0, 2).join(' | '));
  await r.ctx.close();
}

async function scenarioC(b, port, { tel, sombre, nom }) {
  const t = nom + ' C';
  const r = await rendre(b, port, { tel, sombre, volume: false, moteur: null });
  const { pg } = r;
  await pg.waitForSelector('[data-rgt-ouvrir="vide"]', { timeout: 40000 }).catch(() => {});
  await toucher(pg, tel, '[data-rgt-ouvrir="vide"]');
  const faux = [];
  for (const [q, v] of [['nbPieces', '1'], ['nomPiece', 'rgt.piece.chambre'], ['nbMeubles', '1'], ['type', 'etagere'], ['etages', { texte: 'quatre' }], ['cases', '6'], ['numero', 'vrm']]) { const e = await repondre(pg, tel, q, v); if (e) { faux.push(e); break; } }
  dit(!faux.length, `${t} : base vide : 1 pièce / 1 meuble en 7 questions (« quatre » tapé compris)`, faux.join(' '));
  await pg.waitForSelector('[data-rgt-appliquer]', { timeout: 6000 }).catch(() => {});
  await shot(pg, nom + '-C-plan');
  await toucher(pg, tel, '[data-rgt-appliquer]');
  await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_meubles') || '[]').length === 1; } catch (_) { return false; } }, null, { timeout: 6000 }).catch(() => {});
  const ls = await lireLs(pg);
  dit(ls.meubles && ls.meubles.length === 1 && ls.meubles[0].rows === 4 && ls.meubles[0].cols === 6 && ls.meubles[0].piece === 'Chambre' && JSON.stringify(ls.slots) === '{}', `${t} : un meuble 6 × 4 dans « Chambre », aucune case écrite`, JSON.stringify(ls.meubles));
  const pre = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_numero_ecrit') || 'null'); } catch (_) { return null; } });
  dit(pre && pre.actif === false, `${t} : « VRM numérote » est posé par la méthode d'étiquetage (vrm_numero_ecrit, jamais un N°)`, JSON.stringify(pre));
  dit(!r.errs.length, `${t} : Q — aucune erreur de page`, r.errs.slice(0, 2).join(' | '));
  await r.ctx.close();
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('dist absent : npm run build'); process.exit(2); }
  const srv = serveur(DIST); const port = await ecouter(srv);
  const b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    const rendus = [{ tel: true, sombre: false, nom: '390-clair' }, { tel: true, sombre: true, nom: '390-sombre' }, { tel: false, sombre: false, nom: '1512-clair' }, { tel: false, sombre: true, nom: '1512-sombre' }];
    const seul = process.env.RENDU;
    for (const x of rendus.filter((y) => !seul || y.nom === seul)) {
      await scenarioA(b, port, x);
      await scenarioB(b, port, x);
      await scenarioC(b, port, x);
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\nagent-rangement : ${ko ? ko + ' rouge(s)' : 'tout vert'}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
