require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « UNE SEULE FILE, LA PAUSE, LE RÉESSAI, LES BOUTONS APPRIS » (21 nov., ext. 5.433)
//  (Julien, choix n° 97, 99, 101, 102 — `filevisible`, `pauseapres`, `reessai`, `apprisclic`)
//
//  A. APPRENDRE UN BOUTON (le VRAI vrm-formulaire.js, le VRAI vrm-appris.js, le VRAI vrm-ui.js, sur une FAUSSE page vinted.fr
//     dont le bouton « Envoyer » a changé de nom et de data-testid) :
//     A1 l'étape « message » s'arrête AVANT le geste (« message-envoyer » introuvable), rien n'est envoyé
//     A2 le bandeau « Touche le bouton « Envoyer » de la page » ; un clic FABRIQUÉ (isTrusted:false) n'apprend rien
//     A3 SON vrai clic désigne le bouton, la page n'en fait RIEN (aucun envoi), « C'est bien ce bouton ? » (irréversible)
//     A4 « Oui » ⇒ la signature (ni texte saisi, ni prix, ni identifiant) ; l'étape refaite avec elle : UN envoi, le bon texte
//     A5 appris mais pas confirmé ⇒ jamais cliqué (`appris-a-confirmer`), rien n'est envoyé
//     A6 un second bouton pareil apparaît ⇒ l'élément appris n'est plus unique ⇒ refusé, rien n'est cliqué
//     A7 une vérification visible pendant l'apprentissage ⇒ arrêt (`captcha`), rien n'est appris
//  B. LE PANNEAU (le VRAI vrm-badge.js, la file tenue par le VRAI background.js dans Node, branché par `exposeFunction`) :
//     B1 la page « File d'actions » : l'action en cours (étiquette, N° en plaque, site · compte · depuis), celles qui
//        attendent dans l'ordre, les paires de l'atelier pas commencées (« à 20:15 », « ensuite ») ; une commencée n'a ni
//        ↑ ni ↓ ni « Retirer »
//     B2 ↑ sur la 3e ⇒ elle passe 2e (le vrai fond a déplacé) ; « Retirer » ⇒ elle disparaît, rangée « Retirée »
//     B3 « Pause après celle-ci » ⇒ « Pause demandée… » ; l'action finit ⇒ « File en pause » + « Reprendre » (le seul plein)
//     B4 la frise avec le nouvel essai : « Page pas prête : nouvel essai 1/2 dans 4 s. » sous la frise de l'écran plein,
//        et « Pause après celle-ci » à côté de « Tout arrêter » ⇒ SON message au fond, puis « Pause demandée »
//     T  cibles ≥ 44 px, rien ne déborde, aucune erreur de page
//  390 px (Orion, au doigt) clair et sombre, puis 1512 px. `--prouve` : chaque mutation (vrm-appris / vrm-formulaire)
//  doit rendre la partie A rouge. Captures : BANC_CAPTURES ou scripts/bancs/captures/file-actions (jamais commitées).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const { faireFond } = require(path.join(RACINE, 'scripts', '_fond-vm.cjs'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'file-actions') : path.join(__dirname, 'captures', 'file-actions');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const PROUVE = process.argv.includes('--prouve');
const SEUL_A = process.argv.includes('--a');
const lit = (f) => fs.readFileSync(arg('--' + f) || path.join(EXT, f + '.js'), 'utf8');
const UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8'), MOTS = fs.readFileSync(path.join(EXT, 'vrm-mots.js'), 'utf8');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8'), ACTION = fs.readFileSync(path.join(EXT, 'vrm-action.js'), 'utf8');
const FORM = lit('vrm-formulaire'), APPRIS = lit('vrm-appris');
let ok = 0, ko = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; if (!process.env.SILENCE) console.log(`  ✅ ${quoi}`); } else { ko++; if (!process.env.SILENCE) console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.stack || e).slice(0, 400)}`); return null; } };
const nap = (ms) => new Promise((r) => setTimeout(r, ms));

// ── A. la fausse conversation : « Envoyer » est devenu « Expédier » (data-testid neuf, sans « send ») ──────────────────
const PAGE_CONV = (nuit) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vinted (banc)</title>
<style>body{margin:0;font:15px/1.4 system-ui,sans-serif;background:${nuit ? '#121417;color:#eee' : '#fff;color:#111'}}header{height:56px;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid #8884}
main{padding:16px;display:grid;gap:10px;max-width:720px}.bulle{padding:6px 10px;background:#8882;border-radius:8px}textarea{width:100%;min-height:70px;font:inherit}.barre{display:flex;gap:8px;justify-content:flex-end}
button{font:inherit;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid #8886;background:#0a7c6e;color:#fff}.rond{background:#8883;color:inherit}</style></head><body>
<header><b>Vinted banc</b></header>
<main><h1>Conversation 5000121</h1><div id="fil"><div class="bulle">Bonjour, elle est toujours dispo ?</div></div>
<form id="f"><textarea data-testid="conversation-message-input" placeholder="Écris ton message"></textarea><div class="barre" id="barre"><button type="button" class="rond" data-testid="chat-attach">Joindre</button><button type="button" data-testid="chat-cta-primary">Expédier</button></div></form></main>
<script>
(() => {
  const R = window.__requetes = [], J = window.__journal = [];
  document.addEventListener('click', (e) => J.push({ quoi: 'clic', cible: e.target && e.target.getAttribute && e.target.getAttribute('data-testid'), confiance: e.isTrusted }), true);
  const ta = document.querySelector('textarea'), fil = document.getElementById('fil');
  document.getElementById('barre').addEventListener('click', (e) => {
    const b = e.target.closest('[data-testid="chat-cta-primary"]'); if (!b) return;
    const body = ta.value; R.push({ m: 'POST', u: '/api/v2/conversations/5000121/replies', body });
    fetch('/api/v2/conversations/5000121/replies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reply: { body } }) }).then((r) => { if (r.status === 200) { const d = document.createElement('div'); d.className = 'bulle'; d.textContent = body; fil.appendChild(d); ta.value = ''; } });
  });
  window.__doubler = () => { const b = document.querySelector('[data-testid="chat-cta-primary"]'); document.getElementById('barre').appendChild(b.cloneNode(true)); };
  window.__captcha = () => { const f = document.createElement('iframe'); f.src = 'https://geo.captcha-delivery.com/captcha/'; f.style.cssText = 'position:fixed;left:20px;top:80px;width:300px;height:200px;border:0;background:#eee'; document.body.appendChild(f); };
})();
</script></body></html>`;

async function pageConv(nav, vp) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: vp.scheme, viewport: { width: vp.largeur, height: vp.hauteur } }, vp.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, vp.orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0' } : {}));
  const pg = await ctx.newPage(); const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => { const u = new URL(r.request().url()); if (/captcha-delivery/.test(u.hostname)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>vérification</p>' }); if (/\/replies$/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":0}' }); return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE_CONV(vp.scheme === 'dark') }); });
  await pg.addInitScript(() => { window.chrome = { runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, sendMessage: () => {} }, i18n: { getUILanguage: () => 'fr' }, storage: { local: { get: (k, cb) => { if (cb) cb({}); return Promise.resolve({}); } }, onChanged: { addListener() {} } } }; });
  await pg.goto('https://www.vinted.fr/inbox/5000121');
  for (const s of [UI, MOTS, APPRIS]) await pg.addScriptTag({ content: s });
  return { ctx, pg, erreurs };
}
const etape = async (pg, e, d) => { await pg.addScriptTag({ content: FORM }); return (await pg.evaluate(([e2, d2]) => globalThis.__vrmFormulaire(e2, d2), [e, d || {}])) || {}; };
const lire = (pg) => pg.evaluate(() => ({ R: window.__requetes.slice(), J: window.__journal.slice() }));
const bandeau = (pg) => pg.evaluate(() => { const h = document.getElementById('vrm-appris'); if (!h) return null; const o = h.shadowRoot; return { etat: h.getAttribute('data-appris-etat'), t: (o.querySelector('[data-t]') || {}).textContent || '', n: (o.querySelector('[data-n]') || {}).textContent || '', b: [...o.querySelectorAll('[data-appris-b]')].map((x) => x.getAttribute('data-appris-b')) }; });

async function partieA(nav, vp, T, N, cap) {
  const t = await pageConv(nav, vp); const { pg } = t;
  const TEXTE = 'Oui, toujours dispo ! Je peux l’envoyer demain.';
  // A1
  const r1 = await etape(pg, 'message', { conv: '5000121', texte: TEXTE, cle: 'a1' });
  let l = await lire(pg);
  dit(r1.ok === false && r1.code === 'selecteur' && r1.manque === 'message-envoyer' && !l.R.length, `A1 ${T} le bouton renommé : « message-envoyer » introuvable, AVANT le geste, rien n’est envoyé`, JSON.stringify({ r1, R: l.R }));
  await pg.evaluate(() => { document.querySelector('textarea').value = ''; });
  // A2 — le bandeau, puis un clic FABRIQUÉ
  await pg.evaluate(() => { window.__res = null; window.__vrmAppris.apprendre({ nom: 'message-envoyer', libelle: 'Envoyer', irreversible: true, ms: 60000 }).then((r) => { window.__res = r; }); });
  await pg.waitForTimeout(200);
  const b0 = await bandeau(pg);
  await pg.evaluate(() => document.querySelector('[data-testid="chat-cta-primary"]').click());
  await pg.waitForTimeout(150);
  const b1 = await bandeau(pg); l = await lire(pg);
  dit(b0 && b0.etat === 'choisir' && /Touche le bouton « Envoyer » de la page/.test(b0.t) && b1 && b1.etat === 'choisir' && !(await pg.evaluate(() => window.__res)), `A2 ${T} le bandeau « Touche le bouton « Envoyer » de la page » ; un clic FABRIQUÉ n’apprend rien`, JSON.stringify({ b0, b1 }));
  await cap(pg, N('apprendre-touche'));
  const env0 = l.R.length;
  // A3 — SON vrai clic : la page n'en fait rien, « C'est bien ce bouton ? »
  const bt = pg.locator('[data-testid="chat-cta-primary"]');
  if (vp.mobile) await bt.tap(); else await bt.click();
  await pg.waitForTimeout(250);
  const b2 = await bandeau(pg); l = await lire(pg);
  dit(b2 && b2.etat === 'confirmer' && /C’est bien ce bouton/.test(b2.t) && b2.b.join(',') === 'autre,oui' && l.R.length === env0, `A3 ${T} SON vrai clic désigne le bouton ; la page n’envoie RIEN ; « C’est bien ce bouton ? » (geste irréversible)`, JSON.stringify({ b2, R: l.R.length - env0 }));
  await cap(pg, N('apprendre-confirmer'));
  // A4 — « Oui » ⇒ la signature, puis l'étape avec elle
  await pg.locator('#vrm-appris [data-appris-b="oui"]').click();
  await pg.waitForTimeout(150);
  const res = await pg.evaluate(() => window.__res);
  const sigTxt = JSON.stringify(res && res.sig || {});
  const r4 = await etape(pg, 'message', { conv: '5000121', texte: TEXTE, cle: 'a4', appris: { 'message-envoyer': { sig: res && res.sig, confirme: res && res.confirme } } });
  l = await lire(pg);
  dit(res && res.ok && res.confirme === true && res.sig && res.sig.testid === 'chat-cta-primary' && !/\d{3,}|€|dispo|demain/.test(sigTxt) && r4.ok && r4.vu === true && l.R.length === 1 && l.R[0].body === TEXTE,
    `A4 ${T} « Oui » ⇒ la signature (élément seul : ${sigTxt}) ; l’étape refaite avec elle : UN envoi, le texte exact, vu`, JSON.stringify({ res, r4, R: l.R }));
  await cap(pg, N('apprendre-reussi'));
  // A5 — appris mais PAS confirmé : jamais cliqué
  const r5 = await etape(pg, 'message', { conv: '5000121', texte: 'Deuxième message', cle: 'a5', appris: { 'message-envoyer': { sig: res && res.sig, confirme: false } } });
  l = await lire(pg);
  dit(r5.ok === false && r5.code === 'appris-a-confirmer' && l.R.length === 1, `A5 ${T} un bouton appris d’un geste irréversible, pas confirmé ⇒ jamais cliqué, rien n’est envoyé`, JSON.stringify({ r5, R: l.R.length }));
  // A6 — un second bouton pareil ⇒ plus unique ⇒ refusé
  await pg.evaluate(() => window.__doubler());
  const r6 = await etape(pg, 'message', { conv: '5000121', texte: 'Troisième message', cle: 'a6', appris: { 'message-envoyer': { sig: res && res.sig, confirme: true } } });
  l = await lire(pg);
  dit(r6.ok === false && r6.code === 'selecteur' && /ambigu/.test(String(r6.manque || '')) && l.R.length === 1, `A6 ${T} deux boutons pareils : l’élément appris n’est plus unique ⇒ refusé, rien n’est cliqué`, JSON.stringify({ r6, R: l.R.length }));
  // A7 — une vérification visible pendant l'apprentissage
  await pg.evaluate(() => { window.__res = null; window.__vrmAppris.apprendre({ nom: 'message-envoyer', libelle: 'Envoyer', irreversible: true, ms: 60000 }).then((r) => { window.__res = r; }); });
  await pg.waitForTimeout(150);
  await pg.evaluate(() => window.__captcha());
  await pg.waitForTimeout(1200);
  const r7 = await pg.evaluate(() => window.__res);
  dit(r7 && r7.ok === false && r7.code === 'captcha' && !(await bandeau(pg)), `A7 ${T} une vérification visible ⇒ l’apprentissage s’arrête (rien n’est appris, aucun contournement)`, JSON.stringify(r7));
  dit(!t.erreurs.length, `T ${T} apprentissage : aucune erreur de page`, t.erreurs.join(' | '));
  await t.ctx.close();
}

// ── B. le panneau et l'écran plein, la file tenue par le VRAI fond (Node) ───────────────────────────────────────────
const PAGE_V = (nuit) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vinted (banc)</title><style>body{margin:0;font:15px/1.4 system-ui,sans-serif;background:${nuit ? '#121417;color:#eee' : '#fff;color:#111'}}main{padding:16px}</style></head><body><main><h1>Mon dressing</h1><p>Annonces…</p></main></body></html>`;
async function fondFile() {
  const f = faireFond({ src: path.join(EXT, 'background.js') });
  f.store.vrmAtelierRepub = { v: 1, uid: '111', ids: ['9101', '9102', '9103'], i: 1, espacement: { mode: 'fixe', min: 6, max: 6 }, photo: {}, lettre: false, reponses: {}, etat: 'cours', prochain: Date.now() + 25 * 60000, lanceLe: Date.now() - 600000, paires: { 9101: { etape: 'fait', at: Date.now() - 300000 } } };
  const fins = {};
  const action = (meta) => { const p = f.ctx.dansFile(meta, () => new Promise((ok2) => { fins[meta.num] = () => ok2({ accepte: true, etape: 'fait' }); })); return p; };
  const pA = action({ sorte: 'republier', site: 'vinted', uid: '111', num: '12' });
  await nap(120);
  const pB = action({ sorte: 'baisse', site: 'vinted', uid: '111', num: '13' });
  const pC = action({ sorte: 'favori', site: 'vinted', uid: '111', num: '14' });
  const pD = action({ sorte: 'pause', site: 'leboncoin', uid: 'lbc:abc', num: '15' });
  await nap(200);
  return { f, fins, p: [pA, pB, pC, pD] };
}
async function partieB(nav, vp, T, N, cap) {
  const F = await fondFile();
  const ctx = await nav.newContext(Object.assign({ colorScheme: vp.scheme, viewport: { width: vp.largeur, height: vp.hauteur } }, vp.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, vp.orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0' } : {}));
  const pg = await ctx.newPage(); const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGE_V(vp.scheme === 'dark') }));
  await pg.addInitScript(() => { const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (x) { return o.call(this, Object.assign({}, x, { mode: 'open' })); }; });
  // Le panneau parle au VRAI fond (Node) pour la file ; le reste est un état de banc.
  await pg.exposeFunction('__fond', async (msg) => {
    if (msg.action === 'fileLire') return { ok: true, file: await F.f.ctx.vueFile() };
    if (msg.action === 'fileGeste') return F.f.ctx.fileGeste(msg, null);
    if (msg.action === 'apprisLire') return F.f.ctx.vueAppris();
    return null;
  });
  await pg.exposeFunction('__store', async () => JSON.parse(JSON.stringify({ vrmFile: F.f.store.vrmFile || null })));
  await pg.goto('https://www.vinted.fr/member/111');
  const L = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' }, offres: [], annonces: { lu: Date.now(), total: 0, liste: [], toutes: [], nTous: 0, statuts: { en_vente: 0 } }, automatisations: { offres: { actif: false }, favoris: { regle: false, textes: [], auto: { actif: false } }, paliers: { actif: false, paliers: [] }, baisse: { actif: false } }, notifications: { vu: Date.now(), liste: [] }, ventes: { lu: Date.now(), total: 0, liste: [] }, messages: { lu: Date.now(), liste: [] }, autres: null };
  const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.433.0', code: '5.433.0', vrm: { ok: true, connecte: true, email: 'banc@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 3, maxH: 50, j: 10, maxJ: 200, complet: true }, favoris: { apercu: null, file: null } }, secu: { niveau: 'ok', texte: 'Tout va bien' }, toutArrete: false, flux: { okAt: Date.now() } };
  await pg.evaluate(({ L2, E2 }) => {
    const ecoutes = []; window.__envoyes = []; window.__etatAction = null;
    const copie = (v) => JSON.parse(JSON.stringify(v));
    window.__onChanged = (ch) => { for (const f of ecoutes) { try { f(ch, 'local'); } catch (_) {} } };
    window.chrome = { runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.433.0' }),
      sendMessage: (msg, cb) => { window.__envoyes.push(copie(msg));
        if (['fileLire', 'fileGeste', 'apprisLire'].includes(msg.action)) { window.__fond(msg).then((r) => { if (cb) cb(r); window.__store().then((s) => { window.__vrmFile = s.vrmFile; window.__onChanged({ vrmFile: { newValue: s.vrmFile } }); }); }); return; }
        const rep = msg.action === 'etat' && msg.from === 'vrm-action' ? { ok: true, action: window.__etatAction } : msg.action === 'etat' ? E2 : msg.action === 'carteListes' ? L2 : msg.action === 'numeros' ? { ok: true, items: {} } : { ok: true };
        if (cb) setTimeout(() => cb(copie(rep)), 0); } },
      i18n: { getUILanguage: () => 'fr', getMessage: () => '' },
      storage: { local: { get: (k, cb) => { const v = { vrmActionEnCours: window.__etatAction, vrmFile: window.__vrmFile || null }; if (cb) setTimeout(() => cb(copie(v)), 0); return Promise.resolve(copie(v)); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, session: { get: (k, cb) => { if (cb) cb({}); return Promise.resolve({}); }, set: () => Promise.resolve() }, onChanged: { addListener: (f) => ecoutes.push(f) } } };
  }, { L2: L, E2: ETAT });
  for (const s of [UI, MOTS, BADGE]) await pg.evaluate((js) => { const e = document.createElement('script'); e.textContent = js; document.documentElement.appendChild(e); }, s);
  await pg.waitForTimeout(400);
  const R = (fn, a) => pg.evaluate(fn, a);
  const ombre = () => document.getElementById('vrm-badge').shadowRoot;
  const clic = async (sel) => { await R((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(350); };
  const btn = await R(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (vp.mobile) await pg.touchscreen.tap(btn.x, btn.y); else await pg.mouse.click(btn.x, btn.y);
  await pg.waitForTimeout(500);
  if (vp.mobile) await clic('[data-vx-plus]');
  await clic('[data-onglet-b="file"]');
  await pg.waitForTimeout(400);
  const lireFile = () => R(() => { const o = document.getElementById('vrm-badge').shadowRoot; const p = o.querySelector('[data-q7-page]'); return { page: p && p.getAttribute('data-q7-page'), pause: p && p.getAttribute('data-q7-pause-etat'), lignes: [...o.querySelectorAll('[data-q7]')].map((li) => ({ id: li.getAttribute('data-q7'), etat: li.getAttribute('data-q7-etat'), sorte: li.getAttribute('data-q7-sorte'), titre: (li.querySelector('.q7-c b') || {}).textContent || '', sous: (li.querySelector('.q7-c small') || {}).textContent || '', num: (li.querySelector('[data-num]') || { getAttribute: () => '' }).getAttribute('data-num'), gestes: [...li.querySelectorAll('[data-q7-geste]')].map((b) => b.getAttribute('data-q7-geste') + (b.disabled ? '-' : '')) })), faites: [...o.querySelectorAll('[data-q7-faite]')].map((x) => x.getAttribute('data-q7-faite')), pauseB: [...o.querySelectorAll('.q7-pause [data-q7-geste]')].map((b) => b.getAttribute('data-q7-geste') + (b.classList.contains('vu-plein') ? '+' : '')), phrase: (o.querySelector('.q7-pause b') || {}).textContent || '' }; });
  let v = await lireFile();
  const cours = v.lignes[0] || {};
  const at = v.lignes.filter((x) => /^atelier:/.test(x.id));
  dit(v.page === 'lu' && v.lignes.length === 6 && cours.etat === 'cours' && cours.num === '12' && cours.gestes.length === 0 && /Vinted · shop_sophie · depuis \d\d:\d\d/.test(cours.sous)
    && v.lignes.slice(1, 4).map((x) => x.num).join(',') === '13,14,15' && /^En attente · Leboncoin/.test(v.lignes[3].sous) && at.length === 2 && /à \d\d:\d\d/.test(at[0].sous) && /ensuite/.test(at[1].sous) && v.lignes[1].gestes.join(',') === 'monter-,descendre,retirer',
    `B1 ${T} la file : en cours (N°12, Vinted · compte · depuis), 3 en attente dans l’ordre (dont Leboncoin), 2 paires de l’atelier (à HH:MM, ensuite) ; la commencée n’a aucun geste`, JSON.stringify(v));
  await cap(pg, N('file'));
  // B2 — ↑ sur la 3e, puis « Retirer »
  await clic(`[data-q7="${v.lignes[2].id}"] [data-q7-geste="monter"]`);
  await pg.waitForTimeout(300);
  const v2 = await lireFile();
  const idRet = v2.lignes[1].id;
  await clic(`[data-q7="${idRet}"] [data-q7-geste="retirer"]`);
  await pg.waitForTimeout(300);
  const v3 = await lireFile();
  dit(v2.lignes.slice(1, 4).map((x) => x.num).join(',') === '14,13,15' && v3.lignes.slice(1, 3).map((x) => x.num).join(',') === '13,15' && v3.faites.includes('retiree'),
    `B2 ${T} ↑ ⇒ la 3e passe 2e (le vrai fond l’a déplacée) ; « Retirer » ⇒ elle disparaît, rangée « Retirée »`, JSON.stringify({ v2: v2.lignes.map((x) => x.num), v3: v3.lignes.map((x) => x.num), f: v3.faites }));
  await cap(pg, N('file-reordonnee'));
  // B3 — « Pause après celle-ci », puis l'action finit
  await clic('.q7-pause [data-q7-geste="pause"]');
  await pg.waitForTimeout(300);
  const v4 = await lireFile();
  await cap(pg, N('file-pause-demandee'));
  F.fins['12']();
  await nap(600);
  await R(() => window.__store().then((s) => { window.__vrmFile = s.vrmFile; window.__onChanged({ vrmFile: { newValue: s.vrmFile } }); }));
  await pg.waitForTimeout(600);
  const v5 = await lireFile();
  dit(v4.pause === 'apres' && /Pause demandée/.test(v4.phrase) && v5.pause === 'oui' && /File en pause/.test(v5.phrase) && v5.pauseB.join(',') === 'reprendre+' && v5.lignes.length && v5.lignes.every((x) => x.etat !== 'cours') && v5.faites.includes('faite'),
    `B3 ${T} « Pause après celle-ci » ⇒ « Pause demandée » ; l’action finit ⇒ « File en pause » et « Reprendre » (le seul plein), rien d’autre ne part`, JSON.stringify({ v4: v4.pause, v5 }));
  await cap(pg, N('file-en-pause'));
  const m = await R(() => { const o = document.getElementById('vrm-badge').shadowRoot; const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; const petits = [...o.querySelectorAll('[data-q7-page] button')].filter(vis).map((b) => Math.round(b.getBoundingClientRect().height)).filter((x) => x < 44); const deb = [...o.querySelectorAll('[data-q7-page] .rg6')].filter(vis).some((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }); return { petits, deb }; });
  dit(!m.petits.length && !m.deb, `T ${T} file : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(m));
  await clic('.q7-pause [data-q7-geste="reprendre"]');
  await pg.waitForTimeout(300);
  for (const k of Object.keys(F.fins)) { try { F.fins[k](); } catch (_) {} }
  // B4 — l'écran plein : la frise avec le nouvel essai, « Pause après celle-ci » à côté de « Tout arrêter »
  await R(() => { document.getElementById('vrm-badge').remove(); });
  const a = { v: 1, actif: true, sorte: 'republier', uid: '111', debut: Date.now() - 60000, fait: 1, total: 3, enCours: true, prochain: null, quoi: '', formulaire: true, item: { id: '9102', num: '13', titre: 'Basket test 42 cuir blanc' }, serie: 'atelier:1', modif: { id: '9102', sorte: 'republier', debut: Date.now() - 40000, estimeMs: 180000, preuves: { coffre: Date.now() - 30000 }, essai: { quoi: 'reessai', n: 1, max: 2, s: 4, nom: 'brouillon', at: Date.now() } }, maj: Date.now() };
  await R((x) => { window.__etatAction = x; window.__vrmFile = { v: 1, pause: '', entrees: [], faites: [] }; }, a);
  for (const s of [ACTION]) await pg.evaluate((js) => { const e = document.createElement('script'); e.textContent = js; document.documentElement.appendChild(e); }, s);
  await pg.waitForTimeout(700);
  const e1 = await R(() => { const o = document.getElementById('vrm-action').shadowRoot; return { plein: !!o.querySelector('[data-action-plein]'), essai: (o.querySelector('[data-frise-essai]') || {}).textContent || '', arreter: !!o.querySelector('[data-arreter]'), pause: !!o.querySelector('[data-pause-apres]') }; });
  dit(e1.plein && /Page pas prête : nouvel essai 1\/2 dans 4 s\./.test(e1.essai) && e1.arreter && e1.pause, `B4 ${T} écran plein : « Page pas prête : nouvel essai 1/2 dans 4 s. » sous la frise ; « Pause après celle-ci » à côté de « Tout arrêter »`, JSON.stringify(e1));
  await cap(pg, N('ecran-reessai'));
  await R(() => document.getElementById('vrm-action').shadowRoot.querySelector('[data-pause-apres]').click());
  await pg.waitForTimeout(200);
  const envoi = await R(() => window.__envoyes.filter((x) => x.action === 'fileGeste' && x.from === 'vrm-action'));
  await R(() => { window.__vrmFile = { v: 1, pause: 'apres', entrees: [], faites: [] }; window.__onChanged({ vrmFile: { newValue: window.__vrmFile } }); });
  await pg.waitForTimeout(400);
  const e2 = await R(() => { const o = document.getElementById('vrm-action').shadowRoot; return { dit: (o.querySelector('[data-pause-dit]') || {}).textContent || '', bouton: !!o.querySelector('[data-pause-apres]') }; });
  dit(envoi.length === 1 && envoi[0].quoi === 'pause' && /Pause demandée/.test(e2.dit) && !e2.bouton, `B4b ${T} « Pause après celle-ci » ⇒ SON message au fond ; l’écran dit « Pause demandée… »`, JSON.stringify({ envoi, e2 }));
  await cap(pg, N('ecran-pause-demandee'));
  dit(!erreurs.length, `T ${T} panneau / écran : aucune erreur de page`, erreurs.join(' | '));
  await ctx.close();
}

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { if (PROUVE) return; try { await pg.waitForTimeout(150); await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const vp of [{ largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'light' }, { largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'dark' }, { largeur: 1512, hauteur: 900, mobile: false, orion: false, scheme: 'light' }]) {
      const T = `${vp.largeur}${vp.orion ? ' Orion' : ''} ${vp.scheme}`;
      const N = (k) => `${vp.largeur}-${vp.orion ? 'orion-' : ''}${vp.scheme}-${k}`;
      if (!process.env.SILENCE) console.log(`\n${T}`);
      await essaie(`${T} apprentissage`, () => partieA(nav, vp, T, N, cap));
      if (!SEUL_A) await essaie(`${T} panneau`, () => partieB(nav, vp, T, N, cap));
      if (SEUL_A) break;
    }
  } finally { await nav.close(); }
  if (PROUVE) {
    // Chaque mutation (vrm-appris.js, vrm-formulaire.js) doit rendre la partie A rouge.
    const MUT = [
      ['vrm-appris', 'unicite-oubliee', "    return l.length === 1 ? { el: l[0] } : { el: null, ambigu: l.length > 1 };\n  }\n  // La signature la plus courte", "    return l.length ? { el: l[0] } : { el: null, ambigu: false };\n  }\n  // La signature la plus courte"],
      ['vrm-appris', 'clic-fabrique', "        if (!ev.isTrusted) return;   // un clic fabriqué n'apprend rien", "        void 0;"],
      ['vrm-appris', 'page-agit', "        if (!ev.type.startsWith('touch')) ev.preventDefault();\n        ev.stopImmediatePropagation(); ev.stopPropagation();", "        void 0;"],
      ['vrm-appris', 'verif-ignoree', "      const iv = setInterval(() => { if (verifVisible()) sortir({ ok: false, code: 'captcha' }); }, 700);", "      const iv = 0;"],
      ['vrm-formulaire', 'irreversible-clique', "    if (nomA && IRREVERSIBLE_APPRIS.test(nomA) && !(APPRIS[nomA] && APPRIS[nomA].confirme === true)) { const e = new Error('appris-a-confirmer'); e.vrmAConfirmer = nomA; throw e; }", ""],
    ];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-actions-banc-'));
    let bien = true;
    for (const [fic, nom, de, vers] of MUT) {
      const src = fs.readFileSync(path.join(EXT, fic + '.js'), 'utf8');
      if (!src.includes(de)) { console.log(`❌ mutation ${nom} : motif introuvable`); bien = false; continue; }
      const p = path.join(tmp, nom + '.js'); fs.writeFileSync(p, src.replace(de, vers));
      const r = cp.spawnSync(process.execPath, [__filename, '--a', '--' + fic, p], { env: { ...process.env, SILENCE: '1' }, encoding: 'utf8', timeout: 300000 });
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation ${nom} ⇒ ${r.status !== 0 ? 'rouge' : 'VERT'}`); if (r.status === 0) bien = false;
    }
    process.exit(bien ? 0 : 1);
  }
  console.log(`\n${ko ? '❌' : '✅'} file-actions : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
