// Banc : LE COMPTE DE L'EXTENSION ET LA LISTE « COMPTE » (revue du 8 octobre).
//
// Julien, 6-7 octobre : « une liste déroulante, un compte ou tous ; quand une
// extension est connectée, le compte est sélectionné ; les autres floutés ».
// Quatre défauts, tous reproduits au rendu par deux relecteurs :
//   1. le compte de l'extension n'était JAMAIS choisi : l'app le cherchait dans
//      `authEtat`, qui ne le porte pas (seul `etat` le porte, comme la pastille
//      « Actions possibles · {compte} ») ;
//   2. Messages écrivait « Tout est lu » au-dessus de messages non lus d'un
//      autre compte (estompés, inertes) — et sur une boîte qui n'avait pas pu
//      être lue ;
//   3. « N offres à trancher » listait les offres d'un compte EXCLU ou RETIRÉ ;
//   4. la liste « Compte » proposait un compte exclu, et le choisir floutait
//      TOUT l'écran.
// Données INVENTÉES (il vit dans le dépôt, qui est public). Le pont rejoue la
// VRAIE forme des deux réponses : `authEtat` = la session VRM seule (aucun champ
// `vinted`, comme background.js de la 5.116 à la 5.163), `etat` = le cookie.
// Ce qui est jugé : des attributs `data-*`, la valeur du `<select>`, le style
// calculé des lignes — jamais une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 5700;

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
// compte_c (333) est EXCLU par son choix (`vinted_accounts_hidden`) mais garde sa
// ligne `vinted_accounts` — c'est le cas du bouton « Masquer » de Comptes liés.
// 444 n'a plus de ligne : un compte RETIRÉ de l'app (il reste des emails à son nom).
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 3, vinted_user_id: '333', login: 'compte_c', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const vente = (tx, h) => ({ transaction_id: tx, title: 'Vente ' + tx, price: { amount: '40.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(h) });
const LIGNES = [
  { id: 'main', data: { vinted_accounts_hidden: ['333'] } },
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(301, 'acheteur_lu', 'Merci !', false, 2)] } } },
  { id: 'harvest_222_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(401, 'acheteur_b1', 'Toujours dispo ?', true, 1), conv(402, 'acheteur_b2', 'Vous faites 40 ?', true, 3)] } } },
  { id: 'harvest_333_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(501, 'acheteur_c', 'Compte exclu', true, 1)] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: [vente(8101, 30)] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: [vente(8201, 20)] } } },
  { id: 'harvest_333_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: [vente(8301, 10)] } } },
  // Offres reçues par email, toutes récentes.
  { id: 'email_offer_a1', data: { type: 'offre', receivedAt: iso(2), article: 'Adidas Samba OG blanc 42', montant: '45,00', qui: 'acheteuse_a', uid: '111', account: 'compte_a' } },
  { id: 'email_offer_x1', data: { type: 'offre', receivedAt: iso(3), article: 'Nike Air Force 1 blanche 42', montant: '70,00', qui: 'acheteur_x', uid: '333', account: 'compte_c' } },
  { id: 'email_offer_r1', data: { type: 'offre', receivedAt: iso(4), article: 'Salomon XT-6 noir 43', montant: '60,00', qui: 'acheteur_r', uid: '444', account: 'compte_retire' } },
  { id: 'email_offer_n1', data: { type: 'offre', receivedAt: iso(5), article: 'Asics Gel 1130 argent 41', montant: '35,00', qui: 'acheteur_n' } },
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
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
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

// Le pont, dans la VRAIE forme de ses deux réponses.
//   `chrome` : uid du compte ouvert dans Chrome · null (aucun) · 'passu' · 'muette'.
const PONT = ({ chrome }) => {
  const version = '5.163.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (chrome === 'muette') return;
    // authEtat : la session VRM de l'extension — JAMAIS le compte Vinted.
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte: true, expiree: false, email: 'vendeur@exemple.test', user_id: 'u1', cloisonne: false } });
    if (d.__vmr === 'etat') {
      const passu = chrome === 'passu';
      const lo = { 111: 'compte_a', 222: 'compte_b', 333: 'compte_c', 999: 'compte_achat' };
      post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version, vrm: { ok: true, connecte: true, email: 'vendeur@exemple.test', user_id: 'u1' },
        vinted: !passu && chrome ? { uid: String(chrome), login: lo[chrome] || '' } : null, cmds: {} }, passu ? { vintedPasSu: true } : {}) });
    }
    if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, { chrome = null, tel = false, onglet = 'plat_vinted', inboxKO = [] } = {}) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_accounts_hidden', '["333"]'); } catch (_) {} });
  await pg.addInitScript(PONT, { chrome });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    // La panne d'UNE boîte (522 Cloudflare, en HTML), la base debout par ailleurs.
    for (const uid of inboxKO) if (u.includes(`harvest_${uid}_inbox`)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // Le relais Vinted : en panne (une boîte illisible ne se rattrape pas par lui).
  await pg.route('**/api/**', (r) => (/vinted-proxy/.test(r.request().url())
    ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"pas-su"}' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' })));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  return { ctx, pg, errs };
}
// Ce que dit la liste « Compte », et quelles lignes sont estompées.
const lireListe = (pg) => pg.evaluate(() => {
  const s = document.querySelector('#vrm-sel-compte');
  const note = document.querySelector('[data-sel-compte-note]');
  return s ? { val: s.value, options: [...s.options].map((o) => o.value + '=' + o.textContent.trim()), note: note ? note.getAttribute('data-sel-compte-note') : null } : null;
});
const lignesFloues = (pg, re) => pg.evaluate((src) => {
  const rx = new RegExp(src);
  const floues = [...document.querySelectorAll('*')].filter((x) => /blur/.test(getComputedStyle(x).filter));
  const texte = (x) => (x.innerText || '').replace(/\s+/g, ' ');
  return { floues: floues.map(texte).filter((t) => rx.test(t)).map((t) => (t.match(rx) || [''])[0]), n: floues.length };
}, re.source);
const messagerie = (pg) => pg.evaluate(() => {
  const t = document.querySelector('[data-messagerie-tete]');
  const a = document.querySelector('[data-nonlus-ailleurs]');
  const k = document.querySelector('[data-boites-ko]');
  const tete = document.querySelector('[data-messagerie]');
  return {
    etat: t ? t.getAttribute('data-messagerie-tete') : null, nonlus: t ? t.getAttribute('data-nonlus') : null,
    ailleurs: a ? a.getAttribute('data-nonlus-ailleurs') : null, ko: k ? k.getAttribute('data-boites-ko') : null, koTxt: k ? k.innerText : '',
    texte: tete ? tete.innerText.split('\n').slice(0, 3).join(' | ') : '',
    convs: [...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => x.getAttribute('data-conv')),
    toutLu: /Tout est lu/.test(tete ? tete.innerText : ''),
  };
});

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    console.log('── 1. Chrome ouvert sur compte_a (111), rien choisi — Ventes');
    await essaie('1', async () => {
      const r = await rendre(b, { chrome: '111' });
      const l = await lireListe(r.pg);
      dit(l && l.val === '111', 'le compte de l’extension est choisi D’OFFICE (la liste vaut compte_a)', JSON.stringify(l));
      dit(l && l.options.some((o) => /^111=📍/.test(o)), 'il porte le 📍', JSON.stringify(l && l.options));
      dit(l && l.note === 'extension', 'et la liste le dit, avec le geste pour tout voir (une fois)', JSON.stringify(l && l.note));
      dit(l && !l.options.some((o) => /^333=/.test(o)), 'un compte EXCLU n’est jamais proposé', JSON.stringify(l && l.options));
      const f = await lignesFloues(r.pg, /Vente 8\d01/);
      dit(f.floues.includes('Vente 8201') && !f.floues.includes('Vente 8101'), 'la vente de compte_b est estompée, celle de compte_a reste nette', JSON.stringify(f));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'filtre-compte-ventes-1512.png') });
      await r.ctx.close();
    });

    console.log('── 2. Messages, Chrome sur compte_a (rien choisi) : 2 non lus sur compte_b');
    await essaie('2', async () => {
      const r = await rendre(b, { chrome: '111', onglet: 'cat_msg' });
      const m = await messagerie(r.pg);
      dit(m.etat === 'nonlus' && m.nonlus === '2' && !m.toutLu, 'l’en-tête compte les non-lus de TOUTE la liste affichée — jamais « Tout est lu » au-dessus d’eux', JSON.stringify(m));
      dit(m.ailleurs === '2', 'ceux d’un compte estompé sont dits À CÔTÉ, avec le geste', JSON.stringify(m.ailleurs));
      dit(!m.convs.includes('501'), 'la conversation du compte EXCLU n’est ni listée ni comptée', JSON.stringify(m.convs));
      // Les offres : celle d'un compte exclu (333) et d'un compte retiré (444)
      // n'ont rien à faire là ; celle sans compte connu reste (pas su ≠ autre).
      await r.pg.waitForTimeout(600);
      const of = await r.pg.evaluate(() => { const b = document.querySelector('[data-offres-messages]'); return b ? { n: b.getAttribute('data-offres-messages'), ids: [...b.querySelectorAll('[data-offre-email]')].map((x) => x.getAttribute('data-offre-email')), txt: b.innerText } : null; });
      dit(of && !of.ids.includes('email_offer_x1') && !/compte_c/.test(of.txt), 'l’offre d’un compte EXCLU n’est ni listée ni nommée', JSON.stringify(of && of.ids));
      dit(of && !of.ids.includes('email_offer_r1') && !/compte_retire/.test(of.txt), 'l’offre d’un compte RETIRÉ de l’app non plus', JSON.stringify(of && of.ids));
      dit(of && of.ids.includes('email_offer_a1') && of.ids.includes('email_offer_n1') && of.n === '2', 'l’autre sens : la sienne et celle sans compte connu restent, et le nombre suit', JSON.stringify(of && { n: of.n, ids: of.ids }));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'filtre-compte-messages-1512.png') });
      // L'autre sens : « Tous les comptes » choisi exprès ⇒ plus de flou, plus de « dont ».
      await r.pg.selectOption('#vrm-sel-compte', '*');
      await r.pg.waitForTimeout(500);
      const m2 = await messagerie(r.pg);
      const f2 = await lignesFloues(r.pg, /acheteur_b\d/);
      dit(m2.nonlus === '2' && m2.ailleurs === null && f2.floues.length === 0, '« Tous les comptes » : les mêmes 2 non lus, rien d’estompé, aucun « dont »', JSON.stringify({ m2, f2 }));
      await r.ctx.close();
    });

    console.log('── 2b. Messages, SANS extension, compte_a choisi À LA MAIN');
    await essaie('2b', async () => {
      // Le chemin du défaut tel qu'il vit en production aujourd'hui : le compte
      // de l'extension n'étant jamais choisi, c'est en choisissant compte_a
      // dans la liste que « Tout est lu » apparaissait au-dessus des 2 non lus.
      const r = await rendre(b, { chrome: null, onglet: 'cat_msg' });
      await r.pg.selectOption('#vrm-sel-compte', '111');
      await r.pg.waitForTimeout(500);
      const m = await messagerie(r.pg);
      const f = await lignesFloues(r.pg, /acheteur_b\d/);
      dit(!m.toutLu && /^2 non lus/.test(m.texte), 'compte choisi : l’en-tête dit « 2 non lus », jamais « Tout est lu » au-dessus des lignes estompées', JSON.stringify({ texte: m.texte, f }));
      await r.ctx.close();
    });

    console.log('── 3. Messages, la boîte de compte_a ILLISIBLE (522), le relais en panne');
    await essaie('3', async () => {
      const r = await rendre(b, { chrome: '111', onglet: 'cat_msg', inboxKO: ['111'] });
      const m = await messagerie(r.pg);
      dit(!m.toutLu && m.etat === 'nonlus', 'jamais « Tout est lu » quand une boîte n’a pas été lue', JSON.stringify(m));
      dit(m.ko === '111' && /compte_a/.test(m.koTxt), 'la boîte illisible est NOMMÉE, une fois', JSON.stringify({ ko: m.ko, txt: m.koTxt }));
      await r.ctx.close();
    });
    await essaie('3b', async () => {
      // Le cas qui mentait le plus : AUCUN non lu lisible et une boîte illisible.
      const r = await rendre(b, { chrome: '111', onglet: 'cat_msg', inboxKO: ['222'] });
      const m = await messagerie(r.pg);
      dit(!m.toutLu && m.etat === 'passu' && m.ko === '222', 'aucun non lu dans les boîtes LUES ≠ « Tout est lu » : la boîte de compte_b est dite illisible', JSON.stringify(m));
      await r.ctx.close();
    });
    await essaie('3c', async () => {
      // L'autre sens : tout lu ET toutes les boîtes lues ⇒ « Tout est lu »
      // (une base où les conversations de compte_b sont lues).
      const r2 = await (async () => {
        const save = LIGNES[2];
        LIGNES[2] = { id: 'harvest_222_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(401, 'acheteur_b1', 'ok', false, 1)] } } };
        try { return await rendre(b, { chrome: '111', onglet: 'cat_msg' }); } finally { LIGNES[2] = save; }
      })();
      const m = await messagerie(r2.pg);
      dit(m.toutLu && m.etat === 'toutlu' && m.ko === null && m.ailleurs === null, 'autre sens : rien de non lu, toutes les boîtes lues ⇒ « Tout est lu »', JSON.stringify(m));
      await r2.ctx.close();
    });

    console.log('── 4. Chrome sur le compte EXCLU (333), sur un compte HORS de l’app (999), aucun, pas su, muette');
    for (const [chrome, nom] of [['333', 'compte exclu'], ['999', 'compte hors de l’app'], [null, 'aucun compte ouvert'], ['passu', 'cookie pas lu à temps'], ['muette', 'extension muette']]) {
      await essaie('4 ' + nom, async () => {
        const r = await rendre(b, { chrome });
        const l = await lireListe(r.pg);
        const f = await lignesFloues(r.pg, /Vente 8\d01/);
        dit(l && l.val === '*' && f.floues.length === 0 && l.note === null, `${nom} : « Tous les comptes », rien d’estompé`, JSON.stringify({ l, f }));
        await r.ctx.close();
      });
    }

    console.log('── 5. Choix explicite : compte_b');
    await essaie('5', async () => {
      const r = await rendre(b, { chrome: '111' });
      await r.pg.selectOption('#vrm-sel-compte', '222');
      await r.pg.waitForTimeout(500);
      const l = await lireListe(r.pg);
      const f = await lignesFloues(r.pg, /Vente 8\d01/);
      dit(l && l.val === '222' && l.note === 'choix' && f.floues.includes('Vente 8101') && !f.floues.includes('Vente 8201'), 'son choix gagne : compte_b net, compte_a estompé, la note dit pourquoi', JSON.stringify({ l, f }));
      await r.ctx.close();
    });

    console.log('── 6. iPhone (390 px), Chrome sur compte_a');
    await essaie('6', async () => {
      const r = await rendre(b, { chrome: '111', tel: true, onglet: 'cat_msg' });
      const sw = await r.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(sw.sw <= sw.cw + 1, 'la liste et sa note ne font pas déborder l’écran', `${sw.sw} > ${sw.cw}`);
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'filtre-compte-messages-390.png') });
      await r.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ filtre-compte : ${ko} rouge(s)` : '\n✅ filtre-compte : tout est vert');
  process.exit(ko ? 1 : 0);
})();
