require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « TOUT PAR L'INTERFACE DE VINTED » (21 nov., ext. 5.414 — `toutinterface`)
//
//  Julien, 21 nov. : « elle ne doit pas se tromper, elle a le contrôle du clavier et de la souris.
//  Comme on a dit, on ne fait plus les requêtes. » Une FAUSSE page vinted.fr (jamais le vrai Vinted)
//  qui sait être la messagerie (cloche des favoris, conversation, « Faire une offre », offre reçue
//  « Accepter / Refuser »), la page d'une annonce (« Masquer », « Supprimer » + confirmation) et la
//  page « Modifier » (prix, « Enregistrer »). C'est ELLE qui envoie ses requêtes, comme Vinted ; le
//  VRAI vinted-sync-extension/vrm-formulaire.js y est injecté et mené étape par étape.
//    I1  50 favoris IDENTIQUES (même titre, même texte, même pseudo affiché) : la ligne cliquée est
//        celle de CET article et de CETTE personne (identifiants du lien), × 12 tirages — jamais une autre
//    I2  deux lignes aux mêmes identités ⇒ « ambigu », AUCUN clic, aucune requête
//    I3  le message : tapé lettre à lettre (un `input` par lettre), UN seul « Envoyer », le corps
//        envoyé par la page = le texte exact, puis VU dans le fil
//    I4  message envoyé mais pas apparu dans le fil ⇒ `vu:false` (le fond le dit « incertain », jamais renvoyé)
//    I5  la page montre une AUTRE conversation que celle voulue ⇒ `identite`, rien n'est tapé
//    I6  le champ du message absent (Vinted a changé sa page) ⇒ `selecteur` nommé, rien d'envoyé
//    I7  l'offre : « Faire une offre », le prix tapé, « Proposer » ; le prix envoyé par la page est
//        le bon ; l'offre VUE ; offre refusée par Vinted (400) ⇒ rep.ok faux, `vu:false`
//    I8  vérification VISIBLE ⇒ `captcha`, rien n'est tapé ni envoyé ; un cadre invisible n'arrête rien
//    I9  répondre à une offre reçue : « Accepter » (jamais « Refuser »), la BONNE offre (identifiant)
//    I10 « Masquer » sur la page de CETTE annonce ; « Supprimer » + confirmation (jamais « Annuler ») ;
//        une autre annonce montrée ⇒ `identite`, rien d'envoyé
//    I11 le prix : tapé dans « Modifier », « Enregistrer », la page envoie le nouveau prix
//    I12 aucun geste ne part deux fois : chaque étape = UNE requête de la page (jamais de double clic)
//    I13 les clics de VRM sont des clics fabriqués (`isTrusted: false`), rien n'est maquillé
//  `--form chemin` : une autre copie du script ; `--prouve` : chaque mutation doit rendre le banc rouge.
//  SHOTS=dossier : captures.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const EXT = process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const SHOTS = process.env.SHOTS || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const FORM_SRC = arg('--form') || path.join(EXT, 'vrm-formulaire.js');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!process.env.SILENCE) console.log('✅ ' + m); } else { ko++; if (!process.env.SILENCE) console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };

// 50 favoris identiques : même titre, même texte ; seuls les identifiants (article, personne) diffèrent.
const FAVORIS = Array.from({ length: 50 }, (_, k) => ({ item: String(7000100 + k), receiver: String(9000100 + (k % 7 === 0 ? 0 : k)), conv: String(5000100 + k) }));
// Le MÊME article aimé par plusieurs personnes (le cas courant) : seule la personne distingue la ligne.
const MEME_ARTICLE = ['9100001', '9100002', '9100003'].map((r, i) => ({ item: FAVORIS[5].item, receiver: r, conv: String(5000300 + i) }));
const TOUS = FAVORIS.concat(MEME_ARTICLE);

const PAGE = (o) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vinted (banc)</title>
<style>body{margin:0;font:15px/1.4 system-ui,sans-serif}header{height:56px;display:flex;align-items:center;gap:16px;padding:0 16px;border-bottom:1px solid #ddd}
main{padding:16px;display:grid;gap:10px;max-width:720px}.cloche{position:absolute;top:56px;right:16px;width:420px;max-height:70vh;overflow:auto;border:1px solid #ccc;background:#fff;display:none}.cloche.on{display:block}
.cloche a{display:block;padding:8px;border-bottom:1px solid #eee;color:#111;text-decoration:none}.bulle{padding:6px 10px;background:#eef;border-radius:8px;margin:4px 0}
[role=dialog]{position:fixed;inset:25% 25%;background:#fff;border:1px solid #888;padding:16px}</style></head><body>
<header><b>Vinted banc</b><button type="button" aria-label="Notifications" id="cloche">🔔</button></header>
<div class="cloche" id="liste"></div>
<main id="m"></main>
<script>
(() => {
  const O = ${JSON.stringify(o || {})};
  const FAV = ${JSON.stringify(TOUS)};
  const J = window.__journal = [], R = window.__requetes = [];
  const note = (quoi, x) => J.push(Object.assign({ quoi, t: performance.now() }, x || {}));
  const envoi = (m, u, corps) => { R.push({ m, u, corps: corps == null ? null : JSON.stringify(corps) }); return fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: corps == null ? null : JSON.stringify(corps) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) })); };
  document.addEventListener('click', (e) => note('clic', { cible: e.target && (e.target.getAttribute('data-testid') || e.target.id || e.target.tagName), confiance: e.isTrusted }), true);
  const m = document.getElementById('m'), liste = document.getElementById('liste');
  // La cloche : 50 lignes au MÊME texte (même titre d'article, même pseudo affiché).
  liste.innerHTML = FAV.map((f) => '<a href="/inbox/new?item_id=' + f.item + '&receiver_id=' + f.receiver + '">marie_x a ajouté « Nike Air Max 90 blanches 42 » à ses favoris</a>').join('')
    + (O.doublon ? '<a href="/inbox/new?receiver_id=' + FAV[3].receiver + '&item_id=' + FAV[3].item + '">marie_x a ajouté « Nike Air Max 90 blanches 42 » à ses favoris</a>' : '');
  document.getElementById('cloche').addEventListener('click', () => { liste.classList.toggle('on'); document.getElementById('cloche').setAttribute('aria-expanded', liste.classList.contains('on') ? 'true' : 'false'); });
  liste.addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    const u = new URL(a.href); const item = u.searchParams.get('item_id'), rec = u.searchParams.get('receiver_id');
    note('favori', { item, rec });
    envoi('POST', '/api/v2/conversations', { initiator: 'seller_enters_notification', item_id: item, opposite_user_id: rec }).then((r) => {
      const conv = r.json && r.json.conversation && r.json.conversation.id; liste.classList.remove('on');
      if (conv) window.__aller('/inbox/' + conv);
    });
  });
  function conversation(conv) {
    const sansChamp = O.sansChamp;
    m.innerHTML = '<h1>Conversation ' + conv + '</h1><div id="fil"></div>'
      + (O.offreRecue ? '<div class="bulle" id="offre-recue">Offre de 40 € <button type="button">Accepter</button><button type="button">Refuser</button></div>' : '')
      + '<button type="button" data-testid="make-offer-button">Faire une offre</button>'
      + (sansChamp ? '' : '<form id="f"><textarea data-testid="conversation-message-input" placeholder="Écris ton message"></textarea><button type="submit">Envoyer</button></form>');
    const fil = m.querySelector('#fil');
    const ta = m.querySelector('textarea');
    if (ta) ta.addEventListener('input', (e) => note('saisie', { n: e.target.value.length, confiance: e.isTrusted }));
    const f = m.querySelector('#f');
    if (f) f.addEventListener('submit', (e) => { e.preventDefault(); const body = ta.value; note('envoyer'); envoi('POST', '/api/v2/conversations/' + conv + '/replies', { reply: { body, photo_temp_uuids: null } }).then((r) => { if (r.status === 200 && !O.messageInvisible) { const d = document.createElement('div'); d.className = 'bulle'; d.textContent = body; fil.appendChild(d); ta.value = ''; } }); });
    m.querySelector('[data-testid=make-offer-button]').addEventListener('click', () => {
      const d = document.createElement('div'); d.setAttribute('role', 'dialog');
      d.innerHTML = '<p>Ton offre</p><input name="price" inputmode="decimal"><button type="button" data-testid="offer-cancel">Annuler</button><button type="button" data-testid="offer-submit-button">Proposer</button>';
      document.body.appendChild(d);
      d.querySelector('[data-testid=offer-cancel]').addEventListener('click', () => { note('annule'); d.remove(); });
      d.querySelector('[data-testid=offer-submit-button]').addEventListener('click', () => { const p = d.querySelector('input').value.replace(',', '.'); note('proposer', { p }); envoi('POST', '/api/v2/transactions/' + (O.tx || '61000') + '/offers', { offer: { price: p, currency: 'EUR' } }).then((r) => { d.remove(); if (r.status === 200) { const b = document.createElement('div'); b.className = 'bulle'; b.textContent = 'Offre : ' + p.replace('.', ',') + ' €'; fil.appendChild(b); } }); });
    });
    const or = m.querySelector('#offre-recue');
    if (or) { const [acc, ref] = or.querySelectorAll('button');
      acc.addEventListener('click', () => { note('accepter'); envoi('PUT', '/api/v2/transactions/' + (O.tx || '61000') + '/offer_requests/' + (O.oid || '71000') + '/accept', null).then((r) => { if (r.status === 200) or.remove(); }); });
      ref.addEventListener('click', () => { note('refuser'); envoi('PUT', '/api/v2/transactions/' + (O.tx || '61000') + '/offer_requests/' + (O.oid || '71000') + '/reject', null).then((r) => { if (r.status === 200) or.remove(); }); }); }
  }
  function annonce(id) {
    m.innerHTML = '<h1>Nike Air Max 90 blanches 42</h1><button type="button" data-testid="item-hide-button">Masquer</button><button type="button" data-testid="item-delete-button">Supprimer</button>';
    m.querySelector('[data-testid=item-hide-button]').addEventListener('click', (e) => { note('masquer'); envoi('PUT', '/api/v2/items/' + id + '/is_hidden', { is_hidden: true }).then((r) => { if (r.status === 200) { e.target.textContent = 'Afficher'; e.target.setAttribute('data-testid', 'item-show-button'); } }); });
    m.querySelector('[data-testid=item-delete-button]').addEventListener('click', () => {
      const d = document.createElement('div'); d.setAttribute('role', 'dialog');
      d.innerHTML = '<p>Supprimer cet article ?</p><button data-testid="item-delete-modal-cancel">Annuler</button><button data-testid="item-delete-modal-confirm-button">Confirmer et supprimer</button>';
      document.body.appendChild(d);
      d.querySelector('[data-testid=item-delete-modal-cancel]').addEventListener('click', () => { note('annule'); d.remove(); });
      d.querySelector('[data-testid=item-delete-modal-confirm-button]').addEventListener('click', () => { d.remove(); envoi('POST', '/api/v2/items/' + id + '/delete', null); });
    });
  }
  function modifier(id) {
    m.innerHTML = '<input id="title" value="Nike Air Max 90 blanches 42"><input id="price" value="60,00"><button data-testid="upload-form-save-button">Enregistrer</button>';
    m.querySelector('#price').addEventListener('input', (e) => note('saisie-prix', { v: e.target.value }));
    m.querySelector('[data-testid=upload-form-save-button]').addEventListener('click', () => envoi('PUT', '/api/v2/item_upload/items/' + id, { item: { id: Number(id), price: m.querySelector('#price').value.replace(',', '.') } }));
  }
  window.__aller = (p) => { history.pushState({}, '', p); let x;
    if ((x = /^\\/inbox\\/(\\d+)$/.exec(p))) conversation(x[1]);
    else if ((x = /^\\/items\\/(\\d+)\\/edit$/.exec(p))) modifier(x[1]);
    else if ((x = /^\\/items\\/(\\d+)$/.exec(p))) annonce(x[1]);
    else m.innerHTML = '<p>Messagerie</p>'; };
  window.__aller(location.pathname);
})();
</script></body></html>`;

async function ouvrir(b, chemin, o = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.route('**/*', (r) => {
    const u = new URL(r.request().url());
    const json = (s, b2) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b2) });
    if (/captcha-delivery|recaptcha/.test(u.hostname + u.pathname)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>vérification</p>' });
    if (u.pathname === '/api/v2/conversations') { let c = {}; try { c = JSON.parse(r.request().postData() || '{}'); } catch (_) {} const f = TOUS.find((x) => x.item === c.item_id && x.receiver === c.opposite_user_id); return json(200, { conversation: { id: Number(f ? f.conv : 1) } }); }
    if (/\/replies$/.test(u.pathname)) return json(200, { code: 0 });
    if (/\/offers$/.test(u.pathname)) return json(o.offreRefusee ? 400 : 200, o.offreRefusee ? { code: 99, message: 'prix trop bas' } : { code: 0 });
    if (/\/offer_requests\//.test(u.pathname)) return json(200, { code: 0 });
    if (/\/is_hidden$/.test(u.pathname)) return json(200, { item: { is_hidden: true } });
    if (/\/delete$/.test(u.pathname)) return json(200, { code: 0 });
    if (/^\/api\/v2\/item_upload\/items\//.test(u.pathname)) return json(200, { item: { id: 1 } });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(o) });
  });
  await pg.goto('https://www.vinted.fr' + chemin);
  return { ctx, pg, errs };
}
async function etape(pg, e, d) {
  await pg.addScriptTag({ content: fs.readFileSync(FORM_SRC, 'utf8') });
  return (await pg.evaluate(([e2, d2]) => globalThis.__vrmFormulaire(e2, d2), [e, d || {}])) || {};
}
const lire = (pg) => pg.evaluate(() => ({ J: window.__journal, R: window.__requetes, chemin: location.pathname }));

async function banc() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const clicsVrm = [];
  try {
    // ── I1 : 50 favoris identiques, 12 tirages
    { const tirages = [0, 3, 7, 14, 21, 22, 28, 35, 41, 42, 48, 49]; const faux = [];
      for (const k of tirages.concat(['m0', 'm2'])) {
        const { ctx, pg } = await ouvrir(b, '/inbox');
        const f = typeof k === 'string' ? MEME_ARTICLE[Number(k.slice(1))] : FAVORIS[k];
        const r = await etape(pg, 'favoriOuvrir', { itemId: f.item, receiverId: f.receiver, lien: '', cle: 'f' + k });
        const { R, J, chemin } = await lire(pg);
        const corps = R.length === 1 ? JSON.parse(R[0].corps) : null;
        if (!(r.ok && r.conv === f.conv && chemin === '/inbox/' + f.conv && corps && corps.item_id === f.item && corps.opposite_user_id === f.receiver && J.filter((x) => x.quoi === 'favori').length === 1)) faux.push({ k, r, R, chemin });
        clicsVrm.push(...J.filter((x) => x.quoi === 'clic'));
        if (SHOTS && k === 21) await pg.screenshot({ path: path.join(SHOTS, 'interface-favori-conversation.png') });
        await ctx.close();
      }
      dit(!faux.length, `I1 — 50 favoris identiques (même titre, même pseudo) + le même article aimé par 3 personnes : ${tirages.length + 2} tirages, la ligne cliquée est TOUJOURS celle de cet article et de cette personne (identifiants), une seule`, JSON.stringify(faux.slice(0, 2)));
    }
    // ── I2 : doublon d'identités ⇒ ambigu, rien
    { const { ctx, pg } = await ouvrir(b, '/inbox', { doublon: true });
      const f = FAVORIS[3];
      const r = await etape(pg, 'favoriOuvrir', { itemId: f.item, receiverId: f.receiver, lien: '' });
      const { R, J } = await lire(pg);
      dit(r.code === 'selecteur' && /ambigu/.test(r.manque || '') && !R.length && !J.some((x) => x.quoi === 'favori'), 'I2 — deux lignes aux mêmes identités ⇒ « ambigu », aucun clic sur une ligne, aucune requête', JSON.stringify({ r, R }));
      // Un favori qui n'est pas dans la cloche ⇒ introuvable, rien.
      const r2 = await etape(pg, 'favoriOuvrir', { itemId: '7999999', receiverId: f.receiver, lien: '' });
      const l2 = await lire(pg);
      dit(r2.code === 'selecteur' && r2.manque === 'favori-notification' && !l2.R.length, 'I2b — un favori absent de la cloche ⇒ « favori-notification » introuvable, rien n’est cliqué', JSON.stringify(r2));
      await ctx.close(); }
    // ── I3, I12 : le message tapé, envoyé une fois, vu
    const TEXTE = 'Bonjour ! Elle est encore dispo, je peux te faire un prix 🙂';
    { const { ctx, pg, errs } = await ouvrir(b, '/inbox/5000121');
      const r = await etape(pg, 'message', { conv: '5000121', texte: TEXTE, cle: 'm1' });
      const { R, J } = await lire(pg);
      const n = J.filter((x) => x.quoi === 'saisie').map((x) => x.n);
      const attendu = Array.from({ length: Array.from(TEXTE).length + 1 }, (_, k) => Array.from(TEXTE).slice(0, k).join('').length);
      dit(r.ok && r.vu === true && R.length === 1 && JSON.parse(R[0].corps).reply.body === TEXTE && R[0].u === '/api/v2/conversations/5000121/replies', 'I3 — le message : UNE requête de la page vers CETTE conversation, son corps = le texte exact, puis VU dans le fil', JSON.stringify({ r, R }));
      dit(JSON.stringify(n) === JSON.stringify(attendu), 'I3b — tapé lettre à lettre (vidé, puis un `input` par caractère)', JSON.stringify(n.slice(0, 8)));
      dit(J.filter((x) => x.quoi === 'envoyer').length === 1, 'I12 — « Envoyer » touché UNE fois (aucun double envoi)', JSON.stringify(J.filter((x) => x.quoi === 'envoyer')));
      clicsVrm.push(...J.filter((x) => x.quoi === 'clic'));
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'interface-message-vu.png') });
      dit(!errs.length, 'I3c — aucune erreur de page', errs.join(' | '));
      await ctx.close(); }
    // ── I4 : envoyé mais pas apparu ⇒ vu:false
    { const { ctx, pg } = await ouvrir(b, '/inbox/5000122', { messageInvisible: true });
      const r = await etape(pg, 'message', { conv: '5000122', texte: 'Coucou', cle: 'm2' });
      const { R } = await lire(pg);
      dit(r.ok && r.vu === false && R.length === 1, 'I4 — parti mais pas apparu dans le fil ⇒ `vu:false` (le fond : « incertain », jamais renvoyé)', JSON.stringify(r));
      await ctx.close(); }
    // ── I5 : autre conversation montrée ⇒ identite
    { const { ctx, pg } = await ouvrir(b, '/inbox/5000123');
      const r = await etape(pg, 'message', { conv: '5000124', texte: 'Coucou', cle: 'm3' });
      const { R, J } = await lire(pg);
      dit(r.code === 'identite' && !R.length && !J.some((x) => x.quoi === 'saisie'), 'I5 — la page montre une AUTRE conversation ⇒ `identite`, rien n’est tapé ni envoyé', JSON.stringify(r));
      const ro = await etape(pg, 'offre', { conv: '5000124', tx: '61000', prix: 48 });
      dit(ro.code === 'identite' && !(await lire(pg)).R.length, 'I5b — pareil pour l’offre', JSON.stringify(ro));
      await ctx.close(); }
    // ── I6 : champ absent ⇒ selecteur
    { const { ctx, pg } = await ouvrir(b, '/inbox/5000125', { sansChamp: true });
      const t0 = Date.now();
      const r = await etape(pg, 'message', { conv: '5000125', texte: 'Coucou' });
      dit(r.code === 'selecteur' && r.manque === 'message-champ' && !(await lire(pg)).R.length, `I6 — le champ du message absent ⇒ « selecteur » (message-champ) nommé, rien d’envoyé (${Math.round((Date.now() - t0) / 1000)} s)`, JSON.stringify(r));
      await ctx.close(); }
    // ── I7 : offre
    { const { ctx, pg } = await ouvrir(b, '/inbox/5000126', { tx: '61126' });
      const r = await etape(pg, 'offre', { conv: '5000126', tx: '61126', prix: 48, cle: 'o1' });
      const { R, J } = await lire(pg);
      dit(r.ok && r.vu === true && R.length === 1 && R[0].u === '/api/v2/transactions/61126/offers' && JSON.parse(R[0].corps).offer.price === '48' && !J.some((x) => x.quoi === 'annule'), 'I7 — l’offre : « Faire une offre », 48 tapé, « Proposer » (jamais « Annuler ») ; UNE requête de la page au bon prix ; offre VUE', JSON.stringify({ r, R }));
      clicsVrm.push(...J.filter((x) => x.quoi === 'clic'));
      await ctx.close(); }
    { const { ctx, pg } = await ouvrir(b, '/inbox/5000127', { tx: '61127' });
      const r = await etape(pg, 'offre', { conv: '5000127', tx: '61127', prix: 47.5, cle: 'o2' });
      const { R } = await lire(pg);
      dit(r.ok && r.vu === true && JSON.parse(R[0].corps).offer.price === '47.50', 'I7b — les centimes : « 47,50 » tapé', JSON.stringify(R));
      await ctx.close(); }
    { const { ctx, pg } = await ouvrir(b, '/inbox/5000128', { tx: '61128', offreRefusee: true });
      const r = await etape(pg, 'offre', { conv: '5000128', tx: '61128', prix: 12, cle: 'o3' });
      dit(r.ok && r.rep && r.rep.ok === false && r.rep.status === 400 && r.vu === false, 'I7c — offre refusée par Vinted (400) ⇒ la réponse refusée est rendue, `vu:false` (le fond ne part pas sur le message)', JSON.stringify(r));
      await ctx.close(); }
    // ── I8 : captcha visible / invisible
    { const { ctx, pg } = await ouvrir(b, '/inbox/5000129');
      await pg.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://www.google.com/recaptcha/api2/anchor?banc=1'; f.style.cssText = 'width:1px;height:1px;position:absolute;left:-10px'; document.body.appendChild(f); });
      const r0 = await etape(pg, 'message', { conv: '5000129', texte: 'Un', cle: 'c0' });
      dit(r0.ok && r0.vu === true, 'I8a — un cadre de vérification INVISIBLE n’arrête rien (le message part)', JSON.stringify(r0));
      await pg.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://geo.captcha-delivery.com/captcha/?banc=1'; f.style.cssText = 'width:400px;height:300px'; document.body.appendChild(f); });
      const l0 = await lire(pg), n0 = l0.R.length, s0 = l0.J.filter((x) => x.quoi === 'saisie').length;
      const r = await etape(pg, 'message', { conv: '5000129', texte: 'Deux', cle: 'c1' });
      const ro = await etape(pg, 'offre', { conv: '5000129', tx: '61000', prix: 30 });
      const { R, J } = await lire(pg);
      dit(r.code === 'captcha' && ro.code === 'captcha' && R.length === n0 && J.filter((x) => x.quoi === 'saisie').length === s0, 'I8 — une vérification VISIBLE ⇒ `captcha`, rien n’est tapé ni envoyé (message comme offre)', JSON.stringify({ r, ro, n: R.length - n0 }));
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'interface-captcha.png') });
      await ctx.close(); }
    // ── I9 : accepter une offre reçue
    { const { ctx, pg } = await ouvrir(b, '/inbox/5000130', { offreRecue: true, tx: '61130', oid: '71130' });
      const r = await etape(pg, 'repondreOffre', { conv: '5000130', tx: '61130', oid: '71130', accepter: true, cle: 'a1' });
      const { R, J } = await lire(pg);
      dit(r.ok && r.autre === false && R.length === 1 && R[0].m === 'PUT' && R[0].u === '/api/v2/transactions/61130/offer_requests/71130/accept' && !J.some((x) => x.quoi === 'refuser'), 'I9 — « Accepter » de CETTE offre (identifiant), jamais « Refuser », une requête', JSON.stringify({ r, R }));
      await ctx.close(); }
    { const { ctx, pg } = await ouvrir(b, '/inbox/5000131', { offreRecue: true, tx: '61131', oid: '71131' });
      const r = await etape(pg, 'repondreOffre', { conv: '5000131', tx: '61131', oid: '71131', accepter: false, cle: 'a2' });
      const { R, J } = await lire(pg);
      dit(r.ok && R.length === 1 && /\/reject$/.test(R[0].u) && !J.some((x) => x.quoi === 'accepter'), 'I9b — « Refuser » : jamais « Accepter »', JSON.stringify({ r, R }));
      await ctx.close(); }
    // ── I10 : masquer, supprimer, autre annonce
    { const { ctx, pg } = await ouvrir(b, '/items/4400101');
      const r = await etape(pg, 'masquer', { id: '4400101', voulu: true, cle: 'h1' });
      const l = await lire(pg);
      dit(r.ok && r.vu === true && l.R.length === 1 && l.R[0].u === '/api/v2/items/4400101/is_hidden', 'I10 — « Masquer » sur la page de CETTE annonce, une requête, « Afficher » vu ensuite', JSON.stringify({ r, R: l.R }));
      const rs = await etape(pg, 'supprimer', { id: '4400101', cle: 's1' });
      const l2 = await lire(pg);
      dit(rs.ok && l2.R.length === 2 && l2.R[1].u === '/api/v2/items/4400101/delete' && !l2.J.some((x) => x.quoi === 'annule'), 'I10b — « Supprimer » + « Confirmer et supprimer » (jamais « Annuler »)', JSON.stringify({ rs, R: l2.R }));
      const rx = await etape(pg, 'supprimer', { id: '4400999', cle: 's2' });
      const rh = await etape(pg, 'masquer', { id: '4400999', voulu: true });
      dit(rx.code === 'identite' && rh.code === 'identite' && (await lire(pg)).R.length === 2, 'I10c — la page montre une AUTRE annonce ⇒ `identite`, rien d’envoyé (suppression comme masquage)', JSON.stringify({ rx, rh }));
      await ctx.close(); }
    // ── I11 : le prix
    { const { ctx, pg } = await ouvrir(b, '/items/4400102/edit');
      const r = await etape(pg, 'prix', { id: '4400102', prix: 54, cle: 'p1' });
      const { R } = await lire(pg);
      dit(r.ok && R.length === 1 && R[0].m === 'PUT' && JSON.parse(R[0].corps).item.price === '54', 'I11 — le prix tapé dans « Modifier », « Enregistrer » : la page envoie 54', JSON.stringify({ r, R }));
      const rx = await etape(pg, 'prix', { id: '4400103', prix: 54 });
      dit(rx.code === 'identite' && (await lire(pg)).R.length === 1, 'I11b — la page « Modifier » d’une AUTRE annonce ⇒ `identite`, rien d’envoyé', JSON.stringify(rx));
      await ctx.close(); }
    dit(clicsVrm.length >= 20 && clicsVrm.every((x) => x.confiance === false), `I13 — les ${clicsVrm.length} clics de VRM sont des clics fabriqués (isTrusted: false), rien n’est maquillé`, JSON.stringify(clicsVrm.filter((x) => x.confiance !== false).slice(0, 2)));
  } finally { await b.close(); }
}
// Chaque mutation réaffaiblit une garde du script de page : le banc DOIT devenir rouge.
const MUTATIONS = [
  ['favori-sans-personne', "u.searchParams.get('item_id') === itemId && u.searchParams.get('receiver_id') === receiverId", "u.searchParams.get('item_id') === itemId"],
  ['favori-premier', "return l.length === 1 ? { el: l[0] } : { el: null, ambigu: l.length > 1 };\n  }\n  async function attendreChemin", "return l.length ? { el: l[0] } : { el: null };\n  }\n  async function attendreChemin"],
  ['message-sans-identite', "if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };\n      const z = await", "const z = await"],
  ['message-toujours-vu', "return { ok: true, rep: r, vu: v.el === true };\n    },\n    async offre", "return { ok: true, rep: r, vu: true };\n    },\n    async offre"],
  ['captcha-aveugle', "if (r.width < 120 || r.height < 60) continue;", "continue;"],
  ['tout-dun-coup', "for (const ch of Array.from(String(texte))) {\n      v += ch; poser(v);", "for (const ch of [String(texte)]) {\n      v += ch; poser(v);"],
  ['accepter-refuser', "const re = accepter ? RE_ACCEPTER : RE_REFUSER, nom", "const re = RE_REFUSER, nom"],
  ['offre-annuler', "const s = parNom(RE_VALIDER_OFFRE, dl.el, /submit|confirm|send|offer/i, /cancel|close|annul/i, true);", "const s = { el: dl.el.querySelector('button') };"],
  ['supprimer-autre', "if (!new RegExp(`^/items/${String(d && d.id)}(?:-[^/]*)?/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };", ""],
];
(async () => {
  if (process.argv.includes('--prouve')) {
    const src = fs.readFileSync(FORM_SRC, 'utf8'); let bien = true;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'interface-banc-'));
    for (const [nom, de, vers] of MUTATIONS) {
      if (!src.includes(de)) { console.log('❌ mutation ' + nom + ' : motif introuvable'); bien = false; continue; }
      const p = path.join(tmp, nom + '.js'); fs.writeFileSync(p, src.replace(de, vers));
      const r = cp.spawnSync(process.execPath, [__filename, '--form', p], { env: { ...process.env, SILENCE: '1', SHOTS: '' }, encoding: 'utf8', timeout: 900000 });
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation ${nom} ⇒ ${r.status !== 0 ? 'rouge' : 'VERT'}`); if (r.status === 0) bien = false;
    }
    process.exit(bien ? 0 : 1);
  }
  await banc();
  console.log(`\n${ko ? '❌' : '✅'} banc interface-vinted : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
