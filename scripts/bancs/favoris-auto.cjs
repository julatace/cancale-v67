// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  BANC « MESSAGES AUX FAVORIS SANS GESTE » (ext. 5.440, 23 nov.)
//
//  Julien, 23 nov. au matin (5.438 installée) : la file reste à « 0 sur 5 », « Page pas prête : nouvel essai 1/2 »,
//  puis « Touche le bouton « Notifications » de la page — Vinted a changé ce bouton : montre-le une fois ». Mesuré le
//  même matin (relevé passif `harvest_*_seen_urls`, formes seulement) : la liste de la cloche vit sur `api.vinted.fr`
//  (www ⇒ 404) ; une conversation ouverte depuis la cloche passe par `POST …/messaging/main/inquiries` (201,
//  `conversation_id` texte) et se montre sur `/inbox/{uuid}`, relue par `GET …/messaging/main/conversations/{uuid}`
//  (`core_id_deprecated` = l'ancien n°) ; le message part en `POST …/messaging/main/conversations/{uuid}/replies`.
//
//  Une FAUSSE page vinted.fr (jamais le vrai Vinted), qui sert ces FORMES ; les VRAIS vrm-trouver.js, vrm-formulaire.js
//  et inject.js (la carte uuid → ancien n°) y jouent les étapes. On juge :
//   P1–P3  trois en-têtes dont la cloche change d'attributs (nom, aucun nom mais icône « bell » + compteur, rôle
//          bouton en allemand) : la cloche est TROUVÉE à chaque fois, la ligne du favori (article ET personne) cliquée,
//          la conversation uuid reconnue par son ancien n° (lu de Vinted), la transaction rendue ;
//   P4     la cloche est un LIEN vers la page des notifications : rendu au fond (`voirTout`), rien cliqué ;
//   P5     aucune cloche : arrêt nommé `cloche` avec le JOURNAL des stratégies essayées — aucun clic, jamais « touche » ;
//   P6     une ligne d'un AUTRE favori dans la liste : jamais prise pour la cloche ni cliquée ;
//   M1–M3  trois conversations (champ textarea à data-testid / champ éditable à indication / textarea sans repère, bouton
//          d'envoi sans nom à icône) : le message part par la page, réponse de la NOUVELLE messagerie lue comme
//          acceptée (code 0), le message VU dans le fil ;
//   M4     une conversation uuid dont la page dit un AUTRE ancien n° : « identite », rien tapé, rien envoyé ;
//   F1–F6  la fenêtre « VRM · Messages aux favoris » sur une page factice (1512 et 390, clair et sombre) : étape en mots
//          simples, « N envoyés · N sautés · N restants », chaque ligne et son état (raison courte), « Pause » plein,
//          « Tout arrêter » secondaire, « Réduire » discret, terminé / arrêté avec « Fermer », aucune phrase technique,
//          aucune demande de geste, cibles ≥ 44 px, un seul bouton plein. Captures dans $SHOTS (sinon le scratchpad).
//  `BANC_EXT=<dossier>` : une autre copie de l'extension (rouge attendu sur la 5.438). `--mutation nom` ; `--prouve`.
//  Données inventées.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { chromium } = require('playwright');
const EXT0 = process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const MUTATIONS = {
  // La couche de repérage ne regarde plus les icônes.
  'sans-icone': ['vrm-trouver.js', "        ['icone', 3, (el) => /\\b(bell|cloche|notification|notif)[a-z0-9-]*/.test(signes(el)) && !!el.querySelector('svg, img, use')],\n", ''],
  // Deux candidats au même score : le premier est pris (au lieu de « ambigu »).
  'premier-venu': ['vrm-trouver.js', '    if (meilleurs.length !== 1) return { el: null, nom, ambigu: true, essais, n: meilleurs.length };', '    if (!meilleurs.length) return { el: null, nom, essais };'],
  // Une ligne de la liste (lien d'une notification) peut être prise pour la cloche.
  'ligne-cloche': ['vrm-trouver.js', " || /\\/items\\/\\d|\\/member\\/\\d|\\/inbox\\/./.test(chemin(el)) || /[?&](item_id|receiver_id|offering_id)=/.test(String(el.href || ''))", ''],
  // L'uuid n'est plus relié à l'ancien n° lu de Vinted : toute conversation uuid passe.
  'uuid-sans-preuve': ['vrm-formulaire.js', '    if (c) return c === String(conv);\n    return RE_UUID.test(route) && route === u;', '    return true;'],
  // La réponse de la nouvelle messagerie n'est plus lue comme acceptée.
  'reponse-ancienne': ['vrm-formulaire.js', "    if (j.code == null && typeof j.conversation_id === 'string' && u && j.conversation_id === u && r.ok)", '    if (false)'],
  // La fenêtre ne montre plus les lignes de la file.
  'fenetre-ancienne': ['vrm-action.js', "  const favLignes = (a) => (a && a.sorte === 'favoris' && Array.isArray(a.lignes) && a.lignes.length ? a.lignes.slice(0, 15) : null);", '  const favLignes = () => null;'],
};
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation', m], { encoding: 'utf8', env: Object.assign({}, process.env, { SHOTS: '' }) });
    const rouge = r.status === 1 && /❌ [PMF]/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`);
    if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
let EXT = EXT0;
if (arg('--mutation')) {
  const M = MUTATIONS[arg('--mutation')]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'favoris-auto-mut-'));
  for (const f of ['vrm-trouver.js', 'vrm-formulaire.js', 'inject.js', 'vrm-ui.js', 'vrm-action.js']) if (fs.existsSync(path.join(EXT0, f))) fs.copyFileSync(path.join(EXT0, f), path.join(dir, f));
  const s = fs.readFileSync(path.join(dir, M[0]), 'utf8');
  if (!s.includes(M[1])) { console.log('mutation introuvable'); process.exit(2); }
  fs.writeFileSync(path.join(dir, M[0]), s.split(M[1]).join(M[2]));
  EXT = dir;
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} });
}
const lire = (f) => (fs.existsSync(path.join(EXT, f)) ? fs.readFileSync(path.join(EXT, f), 'utf8') : '');
const SHOTS = process.env.SHOTS === '' ? '' : (process.env.SHOTS || path.join(os.tmpdir(), 'favoris-auto-captures'));
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };

// ── La fausse page ───────────────────────────────────────────────────────────────────────────────────────────
const F = { item: '7001234', receiver: '880011', uuid: '01a1fdff-71a1-74b0-a538-46ff8d0881ac', core: '4455667', tx: '5001' };
const ROW = (item, receiver, txt) => `<a class="rang" href="/inbox/want_it/new?receiver_id=${receiver}&item_id=${item}"><span>${txt}</span></a>`;
// 5.441 : la ligne RÉELLE d'un favori dans la cloche (capture de Julien) : vignette, « {pseudo} a ajouté ton article {titre} à
//    ses favoris. Fais-lui une proposition. », « il y a N heures » ; son lien = celui que la notification captée porte.
const ROW_VRAIE = (href, txt) => `<a class="rang" href="${href}"><img alt="" width="40" height="40" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><span>${txt} a ajouté ton article Nike Dunk taille 42 à ses favoris. Fais-lui une proposition.</span><small>il y a 3 heures</small></a>`;
const ROW_TID = (item, receiver, txt) => `<a class="rang" href="/inbox/want_it/new?receiver_id=${receiver}&item_id=${item}"><span data-testid="notification-item-icon"><svg width="8" height="8"><path d="M0 0h8v8z"/></svg></span><span>${txt}</span></a>`;
const BAISSE = (i) => `<a class="rang" href="/items/${5550000 + i}-nike"><span>Le prix de l'article Nike ${i} a été réduit</span></a>`;
const BELL_SVG = '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2a5 5 0 0 0-5 5v4l-2 2v1h14v-1l-2-2V7a5 5 0 0 0-5-5z"/></svg>';
const CLOCHES = {
  nom: `<button type="button" id="cloche" aria-label="Notifications" aria-expanded="false" aria-haspopup="true">${BELL_SVG}</button>`,
  icone: `<button type="button" id="cloche" class="c-button--transparent"><span class="web_ui__Icon__icon" data-testid="icon-bell-outline-24">${BELL_SVG}</span><span class="web_ui__Badge">3</span></button>`,
  allemand: `<div role="button" tabindex="0" id="cloche" aria-label="Benachrichtigungen (3)">${BELL_SVG}</div>`,
  lien: `<a id="cloche" href="/member/notifications" class="header-icon"><svg width="20" height="20"><use href="#icon-notifications-24"></use></svg></a>`,
  aucune: '',
  // 5.441 : la forme RÉELLE (capture de Julien, 23 nov.) — un bouton à icône SANS nom ni repère, entre l'enveloppe et le cœur.
  vraie: `<button type="button" data-banc="c" class="c-button c-button--transparent">${BELL_SVG}</button>`,   // aucun repère : ni id, ni nom, ni data-testid
  double: `<button type="button" aria-label="Notifications">${BELL_SVG}</button><button type="button" aria-label="Notifications">${BELL_SVG}</button>`,
};
const COMPOSEURS = {
  testid: '<form id="f"><textarea data-testid="conversation-message-input" rows="2"></textarea><button type="submit" aria-label="Envoyer">➤</button></form>',
  editable: '<div class="composer"><div contenteditable="true" role="textbox" aria-placeholder="Écris un message" class="ce"></div><button type="button" class="btn-send" data-testid="send-24-button"><svg data-testid="icon-send-24" width="16" height="16"><path d="M0 0h16v16z"/></svg></button></div>',
  nu: '<div class="zone"><textarea placeholder="Écrire un message…"></textarea><button type="button" data-testid="messaging-send-button"><svg width="16" height="16"><path d="M0 0h16v16z"/></svg></button></div>',
};
const PAGE = (o) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vinted (banc)</title><style>
body{margin:0;font-family:sans-serif}header{display:flex;gap:12px;align-items:center;height:56px;padding:0 16px;border-bottom:1px solid #ddd}
header button,header [role=button],header a{width:44px;height:44px;display:inline-grid;place-items:center}.pan{position:absolute;top:56px;right:16px;width:400px;border:1px solid #ccc;background:#fff;display:none}.pan.on{display:block}
.rang{display:block;padding:10px;border-bottom:1px solid #eee;color:#111;text-decoration:none}main{padding:16px;min-height:600px}textarea,.ce{width:320px;min-height:40px;border:1px solid #999;display:block}
</style></head><body>
${o.cloche === 'vraie' ? `<header><b style="margin-right:auto">Vinted</b><a href="/inbox" class="ic">✉<span class="badge">8</span></a>${CLOCHES.vraie}<a href="/member/items/favourite_list" class="ic">♡</a><button type="button" class="avatar">◯</button><a href="/items/new">Vends tes articles</a></header>` : `<header><b style="margin-right:auto">Vinted</b><a href="/inbox" aria-label="Messages">✉</a><button type="button" aria-label="Favoris">♡</button>${CLOCHES[o.cloche] || ''}<a href="/member/${o.moi || 1}">Moi</a></header>`}
<div class="pan${o.ouvert ? ' on' : ''}" id="pan" style="${o.ouvert ? 'top:8px;left:200px;right:auto' : ''}"><div id="lignes">${o.lignes || ''}</div>${o.sansVoirTout ? '' : o.voirToutBouton ? '<button type="button" id="voirtout">Voir tout</button>' : '<a class="rang" href="/member/notifications">Voir tout</a>'}</div>
<main id="m">${o.composeur ? `<div id="fil"></div>${COMPOSEURS[o.composeur]}` : ''}</main>
<script>(() => {
  const O = ${JSON.stringify({ core: o.coreServi || F.core, composeur: o.composeurApres || '' })};
  window.__clics = []; window.__envois = [];
  const pan = document.getElementById('pan'), cl = document.getElementById('cloche') || document.querySelector('[data-banc="c"]');
  if (cl && cl.tagName !== 'A') cl.addEventListener('click', () => { window.__clics.push('cloche'); pan.classList.toggle('on'); if (cl.hasAttribute('aria-expanded')) cl.setAttribute('aria-expanded', pan.classList.contains('on') ? 'true' : 'false'); });
  const COMPO = ${JSON.stringify(COMPOSEURS)};
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a'); if (!a) return;
    e.preventDefault(); window.__clics.push('lien:' + a.getAttribute('href'));
    const u = new URL(a.href);
    if (/want_it/.test(u.pathname)) {
      fetch('/messaging/main/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: u.searchParams.get('item_id'), receiver_id: u.searchParams.get('receiver_id') }) })
        .then((r) => r.json()).then((j) => { history.pushState({}, '', '/inbox/' + j.conversation_id); return fetch('/messaging/main/conversations/' + j.conversation_id); })
        .then((r) => r.json()).then(() => { document.getElementById('m').innerHTML = '<div id="fil"></div>' + (COMPO[O.composeur] || ''); });
    }
  }, true);
  // L'envoi du message par la page (n'importe lequel des trois composeurs).
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button'); if (!b || b.closest('header')) return;
    const uuid = (location.pathname.match(/\\/inbox\\/([0-9a-f-]{36})/) || [])[1]; if (!uuid) return;
    e.preventDefault();
    const champ = document.querySelector('#m textarea, #m [contenteditable="true"]'); const t = champ ? (champ.value != null && champ.tagName === 'TEXTAREA' ? champ.value : champ.textContent) : '';
    window.__envois.push(t);
    fetch('/messaging/main/conversations/' + uuid + '/replies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: t }) })
      .then((r) => r.json()).then(() => { const p = document.createElement('p'); p.textContent = t; document.getElementById('fil').appendChild(p); });
  }, true);
  document.addEventListener('submit', (e) => e.preventDefault(), true);
  const vt = document.getElementById('voirtout'); if (vt) vt.addEventListener('click', () => { window.__clics.push('voirtout'); history.pushState({}, '', '/member/notifications'); });
})();</script></body></html>`;

async function ouvrir(b, chemin, o) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  const inj = lire('inject.js');
  if (inj) await pg.addInitScript({ content: inj });
  await ctx.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/messaging/main/inquiries') return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ inquiry_id: 'i-1', transaction_id: F.tx, conversation_id: F.uuid, read_after_write_token: 'x' }) });
    const mc = /^\/messaging\/main\/conversations\/([0-9a-f-]{36})(\/replies)?$/.exec(u.pathname);
    if (mc && mc[2]) { let c = {}; try { c = JSON.parse(r.request().postData() || '{}'); } catch (_) {} return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'm-1', data: { id: 'm-1', content: String(c.content || '') }, sender_id: '1', created_at: '2026-11-23T08:00:00Z', message_type: 'text', conversation_id: mc[1] }) }); }
    if (mc) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: mc[1], core_id_deprecated: Number(o.coreServi || F.core), opposite_users: [{ id: Number(F.receiver) }], data: { id: 'd', items: [{ id: Number(F.item) }] }, messages: [], allow_reply: true, conversation_type: 'inquiry' }) });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(o) });
  });
  await pg.goto('https://www.vinted.fr' + chemin);
  if (o.precharger) await pg.evaluate((u) => fetch('/messaging/main/conversations/' + u).then((r) => r.json()), F.uuid);
  await pg.waitForTimeout(150);
  return { ctx, pg, errs };
}
async function etape(pg, e, d) {
  const tr = lire('vrm-trouver.js');
  if (tr) await pg.addScriptTag({ content: tr });
  await pg.addScriptTag({ content: lire('vrm-formulaire.js') });
  return (await pg.evaluate(([e2, d2]) => globalThis.__vrmFormulaire(e2, d2), [e, d || {}])) || {};
}
const D = { itemId: F.item, receiverId: F.receiver, lien: '' };
const clics = (pg) => pg.evaluate(() => window.__clics.slice());

// ── La fenêtre ───────────────────────────────────────────────────────────────────────────────────────────────
const PH = 'https://images1.vinted.net/t/banc/f800/'; // jamais servi : la route rend une image inventée
const LIGNES = [
  { id: '9001', photo: PH + '1.webp', titre: 'New Balance 9060 gris taille 38,5', etat: 'envoye' },
  { id: '9002', photo: PH + '2.webp', titre: 'Adidas Handball Spezial rose/fuchsia taille 39,5', etat: 'saute', r: 'annonce_indisponible' },
  { id: '9003', photo: PH + '3.webp', titre: 'Nike P-6000 noir taille 39', etat: 'cours' },
  { id: '9004', photo: PH + '4.webp', titre: 'Nike Air Max 1 bleu taille 43', etat: 'attente' },
  { id: '9005', photo: PH + '5.webp', titre: 'Salomon XT-6 blanc taille 39,5', etat: 'attente' },
];
const ETAT = (x) => Object.assign({ v: 1, actif: true, sorte: 'favoris', uid: '424242', debut: 1, fait: 1, total: 5, pas: 1, enCours: true, prochain: null, quoi: '', attente: '', item: { id: '9003', photo: PH + '3.webp', titre: 'Nike P-6000 noir taille 39' }, suivants: [], lignes: LIGNES, etapeFav: 'conversation', maj: Date.now() }, x || {});
const INTERDITS = /page pas pr[eê]te|touche[- ]le|montre[- ]le|selecteur|sélecteur|element_|identite_|undefined|null|NaN|\{[a-z]+\}|vinted a chang[ée]/i;

async function fenetre(b, nom, larg, sombre, etat, juge) {
  const mobile = larg < 600;
  const ctx = await b.newContext({ viewport: { width: larg, height: mobile ? 844 : 900 }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/vinted\.net/.test(u)) { const n = Number((u.match(/(\d)\.webp/) || [])[1] || 1); const c = ['#c9c6bf', '#e0567a', '#2b2b2e', '#5b7fb5', '#ededeb'][n - 1]; return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${c}"/><path d="M15 80q30-30 90-10v15H15z" fill="#fff" opacity=".7"/></svg>` }); }
    return r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;font:15px system-ui;background:#f4f4f4"><header style="height:60px;background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:center;padding:0 24px"><b style="color:#09b1ba;font-size:24px">Vinted</b></header>${Array.from({ length: 30 }, (_, i) => `<p style="margin:0;padding:18px 24px;border-bottom:1px solid #e5e5e5">Annonce de la page ${i + 1}</p>`).join('')}</body></html>` });
  });
  await pg.addInitScript(({ ui, act, etat }) => {
    const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (x) { return o.call(this, Object.assign({}, x, { mode: 'open' })); };
    window.__store = { vrmActionEnCours: etat, vrmFile: { v: 1, pause: etat.__pause || '', entrees: [], faites: [] } };
    window.__msgs = [];
    const ecoutes = [];
    window.__poser = (a) => { window.__store.vrmActionEnCours = a; for (const f of ecoutes) try { f({ vrmActionEnCours: { newValue: a } }, 'local'); } catch (_) {} };
    window.chrome = { runtime: { id: 'ext', lastError: null, sendMessage: (msg, cb) => { window.__msgs.push(msg); setTimeout(() => { if (msg.action === 'etat') { const a = window.__store.vrmActionEnCours; cb && cb({ ok: true, action: a }); } else cb && cb({ ok: true }); }, 5); } },
      i18n: { getUILanguage: () => 'fr' },
      storage: { local: { get: (k, cb) => { setTimeout(() => cb && cb(window.__store), 0); return Promise.resolve(window.__store); }, set: (x, cb) => { Object.assign(window.__store, x); cb && setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener: (f) => ecoutes.push(f) } } };
    const charger = () => setTimeout(() => { for (const js of [ui, act]) { const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s); } }, 50);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', charger); else charger();
  }, { ui: lire('vrm-ui.js'), act: lire('vrm-action.js'), etat });
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.waitForTimeout(1300);
  try { await juge(pg, errs, mobile); } catch (x) { dit(false, `${nom} — a levé`, x && x.message); }
  if (SHOTS) { try { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `${nom}-${larg}${sombre ? '-sombre' : ''}.png`) }); } catch (_) {} }
  await ctx.close();
}
const lireFenetre = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-action'), r = h && h.shadowRoot; if (!r) return null;
  const v = r.querySelector('[data-action-fav], [data-action-fav-fin]'); if (!v) return { fav: false };
  const txt = String(v.innerText || '');
  const lignes = [...r.querySelectorAll('.fav-l')].map((l) => ({ e: l.getAttribute('data-e'), r: (l.querySelector('[data-fav-raison]') || {}).textContent || '', chip: (l.querySelector('.fav-e') || {}).textContent || '' }));
  const ch = r.querySelector('[data-fav-envoyes]');
  const boutons = [...r.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => { const x = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { t: b.textContent.trim(), h: Math.round(x.height), w: Math.round(x.width), plein: b.classList.contains('vu-plein'), attr: [...b.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).join(','), fond: cs.backgroundColor }; });
  const boite = r.querySelector('.boite').getBoundingClientRect();
  const chevauche = [...r.querySelectorAll('.fav-l')].filter((l) => { const t = l.querySelector('.lt'), e = l.querySelector('.fav-e'); if (!t || !e) return false; const a = t.getBoundingClientRect(), b = e.getBoundingClientRect(); return a.right > b.left + 0.5 && a.bottom > b.top && a.top < b.bottom; }).length;
  const deborde = [...r.querySelectorAll('.boite *')].filter((e) => { const x = e.getBoundingClientRect(); return x.width && (x.right > boite.right + 1 || x.left < boite.left - 1); }).length;
  return { fav: true, fin: !!r.querySelector('[data-action-fav-fin]'), txt, lignes, etape: (r.querySelector('[data-fav-etape]') || {}).getAttribute ? r.querySelector('[data-fav-etape]').getAttribute('data-fav-etape') : '', etapeTxt: (r.querySelector('.fav-etape') || {}).textContent || '',
    envoyes: ch ? ch.getAttribute('data-fav-envoyes') : null, sautes: ch ? ch.getAttribute('data-fav-sautes') : null, pas: ch ? ch.getAttribute('data-fav-pas') : null, annules: ch ? ch.getAttribute('data-fav-annules') : null, finRaison: (r.querySelector('[data-fav-fin-raison]') || {}).textContent || '', restants: ch ? ch.getAttribute('data-fav-restants') : null, chiffres: ch ? ch.textContent : '', boutons, deborde, chevauche, larg: Math.round(boite.width) };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const cas = async (nom, chemin, o, e, d, juge) => {
    const t = await ouvrir(b, chemin, o);
    try { const r = await etape(t.pg, e, d); await juge(r, await clics(t.pg), t); if (t.errs.length) dit(false, `${nom} : aucune erreur de page`, t.errs.join(' | ')); }
    catch (x) { dit(false, `${nom} — a levé`, x && x.message); }
    finally { await t.ctx.close(); }
  };
  try {
    console.log('P. La cloche, trouvée seule, et la conversation de la nouvelle messagerie');
    const FAV = BAISSE(0) + ROW(F.item, '990022', 'autre_personne a ajouté ton article à ses favoris') + ROW(F.item, F.receiver, 'acheteuse a ajouté ton article à ses favoris') + BAISSE(1);
    for (const [k, v] of [['P1', 'nom'], ['P2', 'icone'], ['P3', 'allemand']]) {
      await cas(k, '/inbox', { cloche: v, lignes: FAV }, 'favoriOuvrir', D, async (r, l) => {
        const fav = l.filter((x) => /want_it/.test(x));
        dit(r.ok === true && l[0] === 'cloche', `${k} cloche « ${v} » trouvée et ouverte, sans aucun geste`, JSON.stringify({ ok: r.ok, code: r.code, m: r.manque, l, t: r.trouves }).slice(0, 400));
        dit(fav.length === 1 && fav[0].includes(`receiver_id=${F.receiver}`) && fav[0].includes(`item_id=${F.item}`), `${k} UNE ligne cliquée : CET article et CETTE personne (jamais l'autre favori)`, JSON.stringify(l));
        dit(r.conv === F.core && r.route === F.uuid && r.tx === F.tx, `${k} conversation uuid reconnue par l'ancien n° lu de Vinted (${F.core}), transaction ${F.tx}`, JSON.stringify({ conv: r.conv, route: r.route, tx: r.tx }));
        dit(Array.isArray(r.trouves) && r.trouves.some((x) => x.nom === 'cloche' && x.s), `${k} la stratégie gagnante est rendue au fond (mémoire)`, JSON.stringify(r.trouves));
      });
    }
    await cas('P4', '/inbox', { cloche: 'lien', lignes: FAV }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.ok === false && r.absent === true && r.voirTout === '/member/notifications' && r.lienCloche === true && !l.length, 'P4 la cloche est un LIEN vers les notifications ⇒ rendu au fond (page complète), rien cliqué', JSON.stringify({ r, l }));
    });
    await cas('P5', '/inbox', { cloche: 'aucune', lignes: FAV }, 'favoriOuvrir', D, async (r, l) => {
      const j = (r.trouves || []).find((x) => x.nom === 'cloche');
      dit(r.ok === false && r.code === 'selecteur' && r.manque === 'cloche' && !l.length, 'P5 aucune cloche ⇒ arrêt nommé « cloche », rien cliqué', JSON.stringify(r).slice(0, 300));
      dit(j && !j.s && Array.isArray(j.essais) && j.essais.length >= 4 && j.essais.some((e) => e.s === 'icone'), 'P5 le journal dit chaque stratégie essayée (nom, testid, lien, icône…) et ce qu’elle a vu', JSON.stringify(j));
    });
    await cas('P6', '/inbox', { cloche: 'icone', lignes: ROW(F.item, '990022', 'autre') + ROW('7009999', F.receiver, 'même personne autre article') }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.ok === false && r.absent === true && !l.some((x) => /want_it/.test(x)), 'P6 seules des lignes d’AUTRES favoris : aucune cliquée, ni prise pour la cloche ⇒ absent', JSON.stringify({ r: { ok: r.ok, m: r.manque, a: r.absent }, l }));
    });

    await cas('P7', '/inbox', { cloche: 'double', lignes: FAV }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.ok === false && r.manque === 'cloche-ambigue' && !l.length, 'P7 deux cloches identiques ⇒ « ambigu », VRM ne choisit pas, rien cliqué', JSON.stringify({ r: { ok: r.ok, m: r.manque }, l }));
    });
    await cas('P8', '/inbox', { cloche: 'aucune', ouvert: true, sansVoirTout: true, lignes: ROW_TID(F.item, '990022', 'autre') + ROW_TID('7009999', '990033', 'autre encore') }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.ok === false && r.manque === 'cloche' && !l.some((x) => /want_it/.test(x)), 'P8 pas de cloche, des lignes de notification visibles en haut ⇒ aucune ligne prise pour la cloche, rien cliqué', JSON.stringify({ r: { ok: r.ok, m: r.manque }, l }));
    });

    // 5.440.1 : la notification porte `item_id` + `user_id` (lien d'application mesuré le 23 nov.) ; la ligne de la page aussi.
    const ROW_U = (item, user, txt, ch = '/inbox/want_it') => `<a class="rang" href="${ch}?item_id=${item}&user_id=${user}&portal=fr"><span>${txt}</span></a>`;
    await cas('P9', '/inbox', { cloche: 'nom', lignes: BAISSE(0) + ROW_U(F.item, '990022', 'autre_personne a ajouté ton article à ses favoris') + ROW_U(F.item, F.receiver, 'acheteuse a ajouté ton article à ses favoris') }, 'favoriOuvrir', D, async (r, l) => {
      const fav = l.filter((x) => /want_it/.test(x));
      dit(r.ok === true && fav.length === 1 && fav[0].includes(`user_id=${F.receiver}`) && fav[0].includes(`item_id=${F.item}`), 'P9 ligne `item_id` + `user_id` (nouveau lien) : CELLE du favori est cliquée, jamais l’autre personne', JSON.stringify({ ok: r.ok, m: r.manque, l }));
    });
    await cas('P10', '/inbox', { cloche: 'nom', lignes: BAISSE(0) + ROW_U(F.item, '990022', 'autre_personne') + `<a class="rang" href="/inbox/want_it?item_id=${F.item}&user_id=${F.receiver}&receiver_id=${F.receiver}"><span>deux personnes</span></a>` }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.ok !== true && !l.some((x) => /want_it/.test(x)), 'P10 une ligne aux clés en trop (user_id ET receiver_id) ou d’une autre personne ⇒ rien cliqué', JSON.stringify({ ok: r.ok, m: r.manque, l }));
    });
    // 5.441 — la forme RÉELLE de l'en-tête et de la liste (capture de Julien du 23 nov.).
    const LIEN = `/items/${F.item}/want_it/new?offering_id=555001`;
    await cas('P11', '/inbox', { cloche: 'vraie', voirToutBouton: true, lignes: ROW_VRAIE(`/items/${F.item}/want_it/new?offering_id=555999`, 'autre_personne') + ROW_VRAIE(LIEN, 'acheteuse') }, 'favoriOuvrir', Object.assign({}, D, { lien: LIEN }), async (r, l) => {
      const fav = l.filter((x) => /want_it/.test(x));
      dit(r.ok === true && l[0] === 'cloche' && fav.length === 1 && fav[0] === 'lien:' + LIEN, 'P11 forme réelle : cloche SANS nom trouvée par sa position (entre l’enveloppe et le cœur), la ligne de CE favori cliquée (son lien capté exact)', JSON.stringify({ ok: r.ok, m: r.manque, l, t: r.trouves }).slice(0, 400));
      dit(Array.isArray(r.trouves) && r.trouves.some((x) => x.nom === 'cloche' && x.s === 'position'), 'P11 la stratégie gagnante est « position »', JSON.stringify(r.trouves));
    });
    await cas('P12', '/inbox', { cloche: 'vraie', voirToutBouton: true, lignes: ROW_VRAIE(`/items/${F.item}/want_it/new?offering_id=555999`, 'autre_personne') }, 'favoriOuvrir', Object.assign({}, D, { lien: LIEN }), async (r, l) => {
      dit(r.ok === false && r.absent === true && r.voirTout === '/member/notifications' && l.includes('voirtout') && !l.some((x) => /want_it/.test(x)), 'P12 forme réelle, favori absent de la liste : le BOUTON « Voir tout » est touché, la page complète est rendue au fond, aucune ligne cliquée', JSON.stringify({ r: { ok: r.ok, m: r.manque, a: r.absent, v: r.voirTout }, l }));
    });

    console.log('M. Le message dans une conversation de la nouvelle messagerie');
    const TXT = 'Bonjour ! Je viens de te faire une offre sur cet article.';
    for (const [k, v] of [['M1', 'testid'], ['M2', 'editable'], ['M3', 'nu']]) {
      await cas(k, '/inbox/' + F.uuid, { cloche: 'nom', composeur: v, precharger: true }, 'message', { conv: F.core, route: F.uuid, texte: TXT }, async (r, l, t) => {
        const env = await t.pg.evaluate(() => window.__envois.slice());
        dit(r.ok === true && r.rep && r.rep.json && r.rep.json.code === 0 && r.rep.json.nouvelle === true, `${k} composeur « ${v} » : le message part par la page, réponse de la nouvelle messagerie lue comme acceptée`, JSON.stringify({ ok: r.ok, code: r.code, m: r.manque, j: r.rep && r.rep.json }).slice(0, 300));
        dit(r.vu === true && env.length === 1 && env[0] === TXT, `${k} UN envoi, le texte exact, VU dans le fil`, JSON.stringify({ vu: r.vu, env }));
      });
    }
    await cas('M4', '/inbox/' + F.uuid, { cloche: 'nom', composeur: 'testid', precharger: true, coreServi: '9999999' }, 'message', { conv: F.core, route: F.uuid, texte: TXT }, async (r, l, t) => {
      const env = await t.pg.evaluate(() => window.__envois.slice());
      dit(r.ok === false && r.code === 'identite' && !env.length, 'M4 la page dit un AUTRE ancien n° pour cet uuid ⇒ « identite », rien tapé, rien envoyé', JSON.stringify({ r, env }));
    });

    console.log('F. La fenêtre « Messages aux favoris » sur vinted.fr');
    for (const [larg, sombre] of [[1512, false], [1512, true], [390, false], [390, true]]) {
      await fenetre(b, 'F1-en-cours', larg, sombre, ETAT(), async (pg, errs, mobile) => {
        const m = await lireFenetre(pg);
        const tag = `${larg}${sombre ? ' sombre' : ''}`;
        dit(m && m.fav && !m.fin, `F1 ${tag} : la fenêtre des favoris est montée`, JSON.stringify(m).slice(0, 200));
        if (!m || !m.fav) return;
        dit(m.etape === 'conversation' && /Ouverture de la conversation/.test(m.etapeTxt), `F1 ${tag} : l’étape en mots simples (« Ouverture de la conversation… »)`, m.etapeTxt);
        dit(m.envoyes === '1' && m.sautes === '1' && m.restants === '3' && /1\s*envoyé/.test(m.chiffres) && /1\s*sauté/.test(m.chiffres) && /3\s*en attente/.test(m.chiffres), `F1 ${tag} : « 1 envoyé · 1 sauté · 3 en attente » (5.440.1 : un mot par état)`, m.chiffres);
        dit(m.lignes.length === 5 && m.lignes.map((x) => x.e).join() === 'envoye,saute,cours,attente,attente' && m.lignes[1].r === 'Plus en vente', `F1 ${tag} : chaque ligne avec son état, la raison courte du sauté`, JSON.stringify(m.lignes));
        const pleins = m.boutons.filter((x) => x.plein);
        dit(pleins.length === 1 && /^Pause$/.test(pleins[0].t) && m.boutons.some((x) => /Tout arrêter/.test(x.t) && !x.plein) && m.boutons.some((x) => /Réduire/.test(x.t) && /data-reduire/.test(x.attr)), `F1 ${tag} : « Pause » seul bouton plein, « Tout arrêter » secondaire, « Réduire » discret`, JSON.stringify(m.boutons));
        dit(m.boutons.every((x) => x.h >= 44), `F1 ${tag} : cibles ≥ 44 px`, JSON.stringify(m.boutons.map((x) => [x.t, x.h])));
        dit(!INTERDITS.test(m.txt), `F1 ${tag} : aucune phrase technique ni demande de geste`, (m.txt.match(INTERDITS) || [''])[0]);
        dit(!m.deborde && !m.chevauche && (mobile ? m.larg >= 388 && m.larg <= 392 : m.larg >= 520), `F1 ${tag} : rien ne déborde ni ne chevauche (titre long / étiquette), fenêtre large (${m.larg} px)`, JSON.stringify({ d: m.deborde, c: m.chevauche, l: m.larg }));
        dit(!errs.length, `F1 ${tag} : aucune erreur de page`, errs.join(' | '));
      });
    }
    await fenetre(b, 'F2-attente', 1512, false, ETAT({ enCours: false, etapeFav: '', prochain: Date.now() + 95000, item: { id: '9004', photo: PH + '4.webp', titre: 'Nike Air Max 1 bleu taille 43' }, lignes: LIGNES.map((x) => (x.etat === 'cours' ? Object.assign({}, x, { etat: 'envoye' }) : x)) }), async (pg) => {
      const m = await lireFenetre(pg);
      dit(m && m.etape === 'attente' && /Ensuite dans/.test(m.etapeTxt) && m.envoyes === '2', 'F2 entre deux favoris : « Ensuite dans 1 min … », 2 envoyés', JSON.stringify(m && [m.etape, m.etapeTxt, m.envoyes]));
    });
    await fenetre(b, 'F3-saute-pas', 1512, false, ETAT({ etapeFav: 'envoi', lignes: [Object.assign({}, LIGNES[0]), Object.assign({}, LIGNES[1], { etat: 'saute', r: 'favori_trop_ancien' }), Object.assign({}, LIGNES[2], { etat: 'pas', r: 'element_introuvable' }), Object.assign({}, LIGNES[3], { etat: 'cours' }), LIGNES[4]] }), async (pg) => {
      const m = await lireFenetre(pg);
      dit(m && m.lignes[1].r === 'Pas trouvé dans tes notifications (liste lue jusqu’au bout)' && /Page Vinted pas reconnue/.test(m.lignes[2].r) && m.lignes[2].chip === 'Pas envoyé' && /Envoi du message/.test(m.etapeTxt), 'F3 sauté « Pas trouvé dans tes notifications (liste lue jusqu’au bout) » (5.440.2 : plus jamais « trop ancien »), pas envoyé « Page Vinted pas reconnue — rien n’est parti », étape « Envoi du message… »', JSON.stringify(m && m.lignes));
      dit(m && !INTERDITS.test(m.txt), 'F3 aucune phrase technique', m && (m.txt.match(INTERDITS) || [''])[0]);
    });
    await fenetre(b, 'F4-pause', 1512, false, ETAT({ __pause: 'oui', enCours: false, etapeFav: '' }), async (pg) => {
      const m = await lireFenetre(pg);
      const pleins = m ? m.boutons.filter((x) => x.plein) : [];
      dit(pleins.length === 1 && /Reprendre/.test(pleins[0].t), 'F4 en pause : « Reprendre » à la place de « Pause »', JSON.stringify(m && m.boutons));
    });
    for (const [larg, sombre] of [[1512, false], [390, true]]) {
      await fenetre(b, 'F5-termine', larg, sombre, ETAT(), async (pg) => {
        await pg.evaluate((a) => window.__poser(a), ETAT({ actif: false, enCours: false, fin: { at: Date.now(), raison: 'fini' }, lignes: [LIGNES[0], LIGNES[1], Object.assign({}, LIGNES[2], { etat: 'envoye' }), Object.assign({}, LIGNES[3], { etat: 'envoye' }), Object.assign({}, LIGNES[4], { etat: 'verifier', r: 'reponse_inconnue' })] }));
        await pg.waitForTimeout(2500);   // le bilan reste (avant : un ✓ effacé après 1,6 s)
        const m = await lireFenetre(pg);
        dit(m && m.fin && /Envoi terminé/.test(m.txt) && m.envoyes === '3' && m.sautes === '1' && /1\s*à vérifier/.test(m.chiffres) && m.boutons.some((x) => /Fermer/.test(x.t) && x.w >= (larg < 600 ? 340 : 480)), `F5 ${larg} : terminé — « Envoi terminé », 3 envoyés, 1 sauté, 1 à vérifier, « Fermer » pleine largeur`, JSON.stringify(m && [m.fin, m.envoyes, m.sautes, m.boutons.map((x) => x.t)]));
        dit(m && /Regarde la conversation sur Vinted/.test(m.txt) && !INTERDITS.test(m.txt), `F5 ${larg} : la ligne à vérifier dit quoi regarder, en clair`, m && (m.txt.match(INTERDITS) || [''])[0]);
      });
    }
    await fenetre(b, 'F6-arrete', 1512, false, ETAT(), async (pg) => {
      await pg.evaluate((a) => window.__poser(a), ETAT({ actif: false, enCours: false, fin: { at: Date.now(), raison: 'arret' }, lignes: [LIGNES[0], LIGNES[1], Object.assign({}, LIGNES[2], { etat: 'annule' }), Object.assign({}, LIGNES[3], { etat: 'annule' }), Object.assign({}, LIGNES[4], { etat: 'annule' })] }));
      await pg.waitForTimeout(2500);
      const m = await lireFenetre(pg);
      dit(m && m.fin && /Envoi arrêté/.test(m.txt) && m.lignes.filter((x) => x.e === 'annule').length === 3 && m.annules === '3' && m.restants === '0' && /3\s*annulés/.test(m.chiffres) && !/en attente|non envoyés/.test(m.chiffres), 'F6 arrêté — « Envoi arrêté », « 3 annulés » (5.440.1 : un annulé n’est pas « en attente »), les 3 restants « Annulé »', JSON.stringify(m && [m.fin, m.chiffres, m.txt.slice(0, 80)]));
    });
    // 5.440.1 (Julien, 23 nov. 19:44 : « 0 envoyés · 1 sauté · 2 non envoyés », la ligne « Pas envoyé · Conversation pas vérifiée »).
    const L7 = [Object.assign({}, LIGNES[3], { etat: 'pas', r: 'identite_non_confirmee' }), Object.assign({}, LIGNES[4], { etat: 'attente' }), Object.assign({}, LIGNES[2], { etat: 'attente' })];
    for (const [larg, sombre] of [[1512, false], [390, false], [390, true]]) {
      await fenetre(b, 'F7-un-pas-envoye', larg, sombre, ETAT({ enCours: false, etapeFav: '', prochain: Date.now() + 60000, total: 3, fait: 0, lignes: L7 }), async (pg) => {
        const m = await lireFenetre(pg);
        dit(m && m.envoyes === '0' && m.pas === '1' && m.sautes === '0' && m.restants === '2' && /0\s*envoyé/.test(m.chiffres) && /1\s*pas envoyé/.test(m.chiffres) && /2\s*en attente/.test(m.chiffres) && !/sauté|non envoyé|restant/.test(m.chiffres), `F7 ${larg}${sombre ? ' sombre' : ''} : UN refus d’identité ⇒ « 0 envoyé · 1 pas envoyé · 2 en attente » — jamais « sauté », la file continue`, m && m.chiffres);
        dit(m && m.lignes[0].chip === 'Pas envoyé' && m.lignes[0].r === 'Article ou destinataire pas confirmé — rien n’est parti' && m.lignes.slice(1).every((x) => x.chip === 'En attente'), `F7 ${larg} : la ligne dit « Pas envoyé · Article ou destinataire pas confirmé — rien n’est parti » (le mot du bilan)`, JSON.stringify(m && m.lignes));
      });
      await fenetre(b, 'F8-pause-trois', larg, sombre, ETAT(), async (pg) => {
        await pg.evaluate((a) => window.__poser(a), ETAT({ actif: false, enCours: false, total: 5, fait: 0, fin: { at: Date.now(), raison: 'interrompu', code: 'locaux_suite', refus: 'identite_non_confirmee', n: 3 }, lignes: [Object.assign({}, LIGNES[0], { etat: 'pas', r: 'identite_non_confirmee' }), Object.assign({}, LIGNES[1], { etat: 'pas', r: 'identite_non_confirmee' }), Object.assign({}, LIGNES[2], { etat: 'pas', r: 'identite_non_confirmee' }), Object.assign({}, LIGNES[3], { etat: 'attente' }), Object.assign({}, LIGNES[4], { etat: 'attente' })] }));
        await pg.waitForTimeout(2500);
        const m = await lireFenetre(pg);
        dit(m && m.fin && m.pas === '3' && m.restants === '2' && /3\s*pas envoyés/.test(m.chiffres) && /2\s*en attente/.test(m.chiffres) && !/sauté|non envoyé/.test(m.chiffres), `F8 ${larg} : trois de suite ⇒ « 3 pas envoyés · 2 en attente »`, m && m.chiffres);
        dit(m && /^3 favoris de suite ne sont pas partis \(le dernier : article ou destinataire pas confirmé\)/.test(m.finRaison) && /« Reprendre »\.$/.test(m.finRaison.trim()), `F8 ${larg} : la fenêtre dit pourquoi, phrase ENTIÈRE finie par « Reprendre »`, m && m.finRaison);
        dit(m && !m.deborde, `F8 ${larg} : rien ne déborde`, m && m.deborde);
      });
    }
  } finally { await b.close(); }
  if (SHOTS) console.log(`\n  captures : ${SHOTS}`);
  console.log(`\n${ko ? '❌' : '✅'} favoris sans geste : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
