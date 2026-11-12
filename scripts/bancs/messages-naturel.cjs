// Banc : MESSAGES PLUS NATUREL ET FIABLE (11 nov., demande de Julien, captures à 1512 px :
// « tu ne fais pas du plus récent au plus vieux, c'est assez bizarre ; je veux que tu
// améliores la fiabilité, je veux que le visuel soit plus beau, plus naturel et simple »).
//
// Il rend le VRAI écran Messages · Vinted sur des conversations INVENTÉES (le dépôt est
// public) et exige, à 1512 px souris et 390 px tactile, en clair et en sombre :
//   1. ORDRE — le plus récent en haut, par horodatage : une « Vente annulée » du 14 oct.
//      non lue et une conversation avec une offre en attente ne passent plus devant les
//      messages du jour ; la conversation SANS date va en bas et c'est DIT ; le compte de
//      l'onglet reste en tête (raison dite par son en-tête), le reste suit la même règle ;
//      le filtre « Non lues » suit la même règle ;
//   2. DOUBLON — la même conversation captée deux fois dans la même boîte (mesuré sur la
//      base : 30 sur 3 200) n'est listée qu'UNE fois ;
//   3. HEURE — « 19:52 » aujourd'hui, « 14 oct. » plus loin (plus « hier 15:02 ») ;
//   4. ENVOI — sur une requête TENUE : la bulle « Envoi… » ; relâchée et acceptée :
//      « Envoyé ✓ » ; refusée par Vinted : « Pas envoyé · Réessayer », et Réessayer renvoie
//      sur SON clic (un seul envoi par clic) ;
//   5. LECTURE RATÉE ≠ VIDE — une boîte illisible est nommée (jamais « aucune
//      conversation ») ; un fil sans message alors que la boîte en annonce un dit
//      « pas encore lu en entier », jamais « Aucun message » ;
//   6. RÉPONSES RAPIDES — UNE seule entrée : la rangée du fil (plus de barre « Réponses
//      rapides » sous la liste) ; son crayon ouvre la feuille de réglage ;
//   7. PAS DE GRAND VIDE (ordinateur) — sans conversation ouverte, aucun volet de fiche ;
//      la fiche arrive avec le fil ; « Proposer un prix » est REPLIÉ.
// Ce qui est jugé : des data-*, l'ordre des lignes, le texte d'heure, des nombres — pas des
// formulations (sauf « Envoi… », « Envoyé ✓ », « Réessayer », qui sont la demande).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4781;
const OUT = process.env.BANC_CAPTURES || os.tmpdir();

const MAINTENANT = Date.now();
const il = (min) => new Date(MAINTENANT - min * 60e3).toISOString();
const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
// Les messages « du jour » restent dans la journée même si le banc tourne juste après minuit.
const duJour = (min) => new Date(Math.max(debutJour.getTime() + 60e3 * (60 - min), MAINTENANT - min * 60e3)).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: il(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: il(0) },
];
const conv = (id, login, desc, unread, quand) => ({ id, unread, updated_at: quand, description: desc, opposite_user: { id: 5000 + id, login } });
let nMsg = 0;
const msg = (uid, body) => ({ id: 90000 + (++nMsg), created_at_ts: new Date(MAINTENANT - 3600e3).toISOString(), entity_type: 'message', entity: { user_id: uid, body } });
// compte_a (l'onglet) : 701 = « vente annulée » du 14 oct., NON LUE (avant : en tête) ;
// 702 = aujourd'hui, la plus récente, captée DEUX fois (une copie plus ancienne) ;
// 703 = aujourd'hui, un peu avant, avec une OFFRE en attente (avant : devant 702) ;
// 704 = sans date lue ; 705 = la boîte annonce un message, le fil n'en a aucun.
const C701 = conv(701, 'geme_test', 'Vente annulée', true, '2026-10-14T17:28:00+02:00');
const C702 = conv(702, 'acheteuse_jour', 'Elle est toujours dispo ?', true, duJour(5));
const C702_VIEILLE = { ...C702, updated_at: il(60 * 24 * 3), description: 'Bonjour' };
const C703 = conv(703, 'offreur_jour', 'Vous feriez 55 € ?', false, duJour(40));
const C704 = conv(704, 'sans_date', 'Merci', false, '');
const C705 = conv(705, 'fil_vide', 'Je prends !', false, il(60 * 30));
// 706 : non lue il y a 3 jours (dans les 7 jours de « Non lues »).
const C706 = conv(706, 'non_lue_3j', 'Toujours là ?', true, il(60 * 24 * 3));
const FILS = {
  702: { id: 702, opposite_user: { id: 5702, login: 'acheteuse_jour' }, transaction: { id: 9702, item_id: 4702 }, description: 'Paire 702', allow_reply: true, messages: [msg(5702, 'Elle est toujours dispo ?')] },
  703: { id: 703, opposite_user: { id: 5703, login: 'offreur_jour' }, transaction: { id: 9703, item_id: 4703 }, description: 'Paire 703', allow_reply: true,
    messages: [msg(5703, 'Vous feriez 55 € ?'), { id: 99703, created_at_ts: new Date(MAINTENANT - 3000e3).toISOString(), entity_type: 'offer_request_message', entity: { user_id: 5703, current: true, status: 10, status_title: '', price: { amount: '55.0' }, transaction_id: 9703, offer_request_id: 77 } }] },
  705: { id: 705, opposite_user: { id: 5705, login: 'fil_vide' }, transaction: { id: 9705, item_id: 4705 }, description: 'Paire 705', allow_reply: true, messages: [] },
};
const lignes = ({ dark, boiteBKO }) => [
  { id: 'main', data: { vinted_dark: !!dark } },
  { id: 'harvest_111_inbox', data: { capturedAt: il(0), payload: { conversations: [C701, C702_VIEILLE, C703, C704, C706, C702, C705] } } },
  ...(boiteBKO ? [] : [{ id: 'harvest_222_inbox', data: { capturedAt: il(0), payload: { conversations: [conv(801, 'autre_b', 'Dispo ?', false, duJour(2))] } } }]),
  ...Object.entries(FILS).map(([id, f]) => ({ id: `harvest_111_conv_${id}`, data: { capturedAt: il(0), payload: { conversation: f } } })),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// Le pont de l'extension. Un envoi (POST …/replies) suit `window.__issue` :
// 'ok' (accepté), 'refus' (400 de Vinted) ou 'tenu' (gardé jusqu'à `window.__relacher()`).
const PONT = ({ fils }) => {
  const version = '5.163.0';
  const post = (m) => window.postMessage(m, '*');
  window.__issue = 'ok'; window.__envois = 0;
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte: true, expiree: false, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', cloisonne: false } });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }, vinted: { uid: '111', login: 'compte_a' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      if (d.method === 'POST' && /\/replies$/.test(d.endpoint || '')) {
        window.__envois++;
        const rep = (ok) => post(ok ? { __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: { code: 0 } } : { __vmr: 'result', reqId: d.reqId, ok: false, status: 400, data: { code: 99, message: 'Refusé par Vinted (banc).' } });
        if (window.__issue === 'tenu') window.__relacher = () => rep(true);
        else setTimeout(() => rep(window.__issue === 'ok'), 60);
        return;
      }
      const m = /conversations\/(\d+)$/.exec(d.endpoint || '');
      const data = d.method === 'GET' ? { conversation: (m && fils[m[1]]) || null } : {};
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data }), 50);
    }
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, { tel = false, dark = false, boiteBKO = false } = {}) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, colorScheme: dark ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((dk) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!dk)); } catch (_) {} }, dark);
  // Un téléphone tactile AVEC extension (Firefox Android, 5.188) : il agit ici.
  await pg.addInitScript(PONT, { fils: FILS });
  const LIGNES = lignes({ dark, boiteBKO });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    // La boîte de compte_b ILLISIBLE (panne de lecture), pas vide.
    if (boiteBKO && /harvest_222_inbox/.test(u)) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne"}' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: il(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_msg`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);
  return { ctx, pg, errs };
}
const lireListe = (pg) => pg.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-messagerie] [data-conv]')];
  return {
    ids: rows.map((x) => x.getAttribute('data-conv')),
    comptes: rows.map((x) => x.getAttribute('data-conv-compte')),
    heures: Object.fromEntries(rows.map((x) => [x.getAttribute('data-conv'), (x.querySelector('.vrm-msg-time') || {}).textContent || ''])),
    sansDate: (document.querySelector('[data-conv-sans-date]') || { getAttribute: () => null }).getAttribute('data-conv-sans-date'),
    qrBas: document.querySelectorAll('.vrm-quick-settings').length,
    fiche: document.querySelectorAll('.vrm-msg-fiche').length,
    boitesKO: (document.querySelector('[data-boites-ko]') || { getAttribute: () => null }).getAttribute('data-boites-ko'),
    vide: !!document.querySelector('[data-msg-vide]'),
    panne: !!document.querySelector('[data-msg-panne]'),
    texte: ((document.querySelector('[data-messagerie]') || document.querySelector('.vrm-inbox-column') || {}).innerText || '').slice(0, 300),
  };
});
const ouvrir = async (pg, id) => { await pg.locator(`[data-messagerie] [data-conv="${id}"]`).first().click(); await pg.waitForTimeout(1600); };
const fermer = async (pg) => { await pg.evaluate(() => { const b = document.querySelector('button[aria-label="Fermer la conversation"]'); if (b) b.click(); }); await pg.waitForTimeout(500); };
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 220)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of (process.env.SEUL5 ? [] : [false, true])) for (const dark of [false, true]) {
      const T = `${tel ? '390 tactile' : '1512'} ${dark ? 'sombre' : 'clair'}`;
      const suf = `${tel ? 390 : 1512}-${dark ? 'sombre' : 'clair'}`;
      console.log(`── ${T}`);
      await essaie(T, async () => {
        const r = await rendre(b, { tel, dark });
        const l = await lireListe(r.pg);
        const a = l.ids.filter((id, i) => l.comptes[i] === '111');
        dit(a.join(',') === '702,703,705,706,701,704', `${T} · 1 compte de l'onglet : le plus récent en haut, « vente annulée » ancienne et offre ne passent pas devant, sans date en bas`, a.join(','));
        dit(l.ids.indexOf('801') > l.ids.indexOf('704'), `${T} · 1 les autres comptes après le groupe de l'onglet (en-tête qui le dit)`, l.ids.join(','));
        dit(l.sansDate === '1', `${T} · 1 la conversation sans date est DITE sous la liste`, String(l.sansDate));
        dit(l.ids.filter((x) => x === '702').length === 1, `${T} · 2 la conversation captée deux fois n'est listée qu'une fois`, l.ids.join(','));
        dit(/^\d{2}:\d{2}$/.test(l.heures['702']) && /^14 oct\.?$/.test(l.heures['701']) && l.heures['704'] === '', `${T} · 3 heures « 19:52 » / « 14 oct. » / rien sans date`, JSON.stringify(l.heures));
        dit(l.qrBas === 0, `${T} · 6 plus de barre « Réponses rapides » sous la liste`, String(l.qrBas));
        if (!tel) dit(l.fiche === 0, `${T} · 7 aucune conversation ouverte : aucun volet de fiche (pas de grand vide)`, String(l.fiche));
        // Le filtre « Non lues » suit la même règle.
        await r.pg.locator('[data-messagerie] .vrm-inbox-filters button', { hasText: 'Non lues' }).first().click(); await r.pg.waitForTimeout(400);
        const nl = await lireListe(r.pg);
        dit(nl.ids.filter((id, i) => nl.comptes[i] === '111').join(',') === '702,706', `${T} · 1 « Non lues » : la même règle (702 aujourd'hui avant 706 d'il y a 3 jours)`, nl.ids.join(','));
        await r.pg.locator('[data-messagerie] .vrm-inbox-filters button', { hasText: 'Toutes' }).first().click(); await r.pg.waitForTimeout(400);
        await r.pg.screenshot({ path: path.join(OUT, `messages-naturel-liste-${suf}.png`) });

        // 7. le fil 703 : l'offre et ses gestes ; « Proposer un prix » replié ; la fiche est là.
        await ouvrir(r.pg, '703');
        const f3 = await r.pg.evaluate(() => ({ gestes: document.querySelectorAll('.vrm-chat-panel [data-offre-geste]').length, nego: [...document.querySelectorAll('.vrm-chat-panel details.vrm-chat-negociation')].map((d) => d.open), fiche: document.querySelectorAll('.vrm-msg-fiche').length, rapides: document.querySelectorAll('.vrm-chat-panel .vrm-chat-rapides').length }));
        dit(f3.gestes === 3, `${T} · 7 l'offre en attente porte ses trois gestes (Refuser · Contre-offre · Accepter)`, JSON.stringify(f3));
        dit(f3.nego.length === 1 && f3.nego[0] === false, `${T} · 7 « Proposer un autre prix » est REPLIÉ`, JSON.stringify(f3.nego));
        if (!tel) dit(f3.fiche === 1, `${T} · 7 la fiche arrive avec le fil`, String(f3.fiche));
        dit(f3.rapides === 1, `${T} · 6 une seule rangée de réponses rapides dans le fil`, String(f3.rapides));
        await r.pg.screenshot({ path: path.join(OUT, `messages-naturel-offre-${suf}.png`) });
        // 6. le crayon ouvre la feuille de réglage.
        await r.pg.locator('.vrm-chat-panel [data-rapides-modifier]').first().click(); await r.pg.waitForTimeout(500);
        const feuille = await r.pg.evaluate(() => ({ f: !!document.querySelector('[data-feuille-rapides]'), n: Number((document.querySelector('[data-feuille-rapides] [data-reponses-rapides]') || { getAttribute: () => -1 }).getAttribute('data-reponses-rapides')) }));
        dit(feuille.f && feuille.n > 0, `${T} · 6 le crayon ouvre la feuille « Réponses rapides » (réglage)`, JSON.stringify(feuille));
        await r.pg.keyboard.press('Escape'); await r.pg.waitForTimeout(300);
        await r.pg.evaluate(() => { const x = document.querySelector('[data-feuille-rapides] button[aria-label="Fermer"]'); if (x) x.click(); }); await r.pg.waitForTimeout(300);
        await fermer(r.pg);

        // 5. le fil 705 : la boîte annonce un message, le fil n'en a aucun.
        await ouvrir(r.pg, '705');
        const f5 = await r.pg.evaluate(() => ({ pasLu: !!document.querySelector('.vrm-chat-panel [data-fil-pas-lu]'), vide: !!document.querySelector('.vrm-chat-panel [data-fil-vide]'), aucun: /Aucun message/.test((document.querySelector('.vrm-chat-panel') || {}).innerText || '') }));
        dit(f5.pasLu && !f5.vide && !f5.aucun, `${T} · 5 un fil vide dont la boîte annonce un message : « pas encore lu », jamais « Aucun message »`, JSON.stringify(f5));
        await fermer(r.pg);

        // 4. l'envoi : tenu ⇒ « Envoi… » ; relâché ⇒ « Envoyé ✓ ».
        await ouvrir(r.pg, '702');
        const champ = r.pg.locator('.vrm-chat-panel textarea[aria-label="Réponse à la conversation"]');
        await champ.fill('Oui, toujours disponible.');
        await r.pg.evaluate(() => { window.__issue = 'tenu'; });
        await r.pg.locator('.vrm-chat-panel .vrm-chat-send').click(); await r.pg.waitForTimeout(500);
        const pendant = await r.pg.evaluate(() => ({ bulle: (document.querySelector('[data-envoi-bulle="envoi"]') || {}).innerText || '', etat: (document.querySelector('[data-envoi="envoi"]') || {}).innerText || '' }));
        dit(/Oui, toujours disponible/.test(pendant.bulle) && /Envoi…/.test(pendant.etat), `${T} · 4 pendant l'envoi : la bulle et « Envoi… »`, JSON.stringify(pendant));
        await r.pg.screenshot({ path: path.join(OUT, `messages-naturel-envoi-${suf}.png`) });
        await r.pg.evaluate(() => window.__relacher && window.__relacher()); await r.pg.waitForTimeout(700);
        const apres = await r.pg.evaluate(() => ({ ok: (document.querySelector('[data-envoi="ok"]') || {}).innerText || '', enCours: !!document.querySelector('[data-envoi-bulle]'), bulles: [...document.querySelectorAll('.vrm-chat-panel [data-bulle="moi"]')].map((x) => x.innerText).filter((t) => /toujours disponible/.test(t)).length }));
        dit(/Envoyé ✓/.test(apres.ok) && !apres.enCours && apres.bulles === 1, `${T} · 4 accepté : « Envoyé ✓ », le message une fois dans le fil`, JSON.stringify(apres));
        // refusé ⇒ « Pas envoyé · Réessayer » ; Réessayer renvoie UNE fois, sur son clic.
        await champ.fill('Je peux l’envoyer demain.');
        await r.pg.evaluate(() => { window.__issue = 'refus'; });
        const n0 = await r.pg.evaluate(() => window.__envois);
        await r.pg.locator('.vrm-chat-panel .vrm-chat-send').click(); await r.pg.waitForTimeout(700);
        const refus = await r.pg.evaluate(() => ({ etat: (document.querySelector('[data-envoi="refuse"]') || {}).innerText || '', btn: !!document.querySelector('[data-envoi-reessayer]'), champ: (document.querySelector('.vrm-chat-panel textarea') || {}).value || '' }));
        dit(/Pas envoyé/.test(refus.etat) && refus.btn && /demain/.test(refus.champ), `${T} · 4 refusé : « Pas envoyé · Réessayer », le texte reste`, JSON.stringify(refus));
        await r.pg.screenshot({ path: path.join(OUT, `messages-naturel-refus-${suf}.png`) });
        await r.pg.evaluate(() => { window.__issue = 'ok'; });
        await r.pg.locator('[data-envoi-reessayer]').click(); await r.pg.waitForTimeout(700);
        const re = await r.pg.evaluate(() => ({ ok: !!document.querySelector('[data-envoi="ok"]'), n: window.__envois }));
        dit(re.ok && re.n - n0 === 2, `${T} · 4 Réessayer renvoie une fois (2 envois en tout : le refusé, le renvoyé)`, JSON.stringify({ ...re, n0 }));
        dit(!(await deborde(r.pg)), `${T} · aucun débordement horizontal`);
        dit(r.errs.length === 0, `${T} · aucune erreur d'app`, r.errs.join(' | ').slice(0, 200));
        await r.ctx.close();
      });
    }
    console.log('── 5. une boîte ILLISIBLE n’est pas une boîte vide');
    await essaie('5', async () => {
      const r = await rendre(b, { boiteBKO: true });
      const l = await lireListe(r.pg);
      // La lecture des boîtes est groupée : une panne la fait échouer EN ENTIER ⇒ la panne dite (EtatPanne),
      // ou, si une boîte seule manque, elle est nommée — jamais l'état « aucune conversation ».
      dit(!l.vide && (l.panne || (l.boitesKO === '222' && l.ids.includes('702'))), 'une lecture ratée est dite (panne ou boîte nommée), jamais « aucune conversation »', JSON.stringify({ ko: l.boitesKO, vide: l.vide, panne: l.panne, ids: l.ids, texte: l.texte }));
      await r.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ messages-naturel : ${ko} rouge(s)` : '\n✅ messages-naturel : tout est vert');
  process.exit(ko ? 1 : 0);
})();
