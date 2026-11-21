// Banc : MESSAGES · LEBONCOIN, VESTIAIRE, eBay — LA MÊME REFONTE QUE VINTED (12 nov.,
// Julien : « fais les messages Vestiaire, etc. » ; la refonte Vinted du 11 nov. :
// scripts/bancs/messages-naturel.cjs).
//
// Il rend le VRAI écran de chaque site sur des conversations INVENTÉES (le dépôt est
// public), à 1512 px souris et 390 px tactile, en clair et en sombre, et exige :
//   1. ORDRE — le plus récent en haut, par horodatage (les dates servies dans le
//      désordre) ; eBay : un échange rendu DEUX fois par la route n'est listé qu'une fois ;
//   2. ENVOI VU DANS LE FIL — sur une commande TENUE : la bulle « Envoi… » ; relâchée et
//      acceptée : « Envoyé ✓ » ; refusée : « Pas envoyé · Réessayer », et Réessayer renvoie
//      UNE fois sur SON clic ; réponse incertaine : « Pas confirmé », aucun « Réessayer » ;
//      les règles d'envoi ne changent pas (Leboncoin `lbcRepondre`, Vestiaire `vcRepondre`
//      avec recette apprise, eBay route `repondre` confirmée) ;
//   3. LECTURE RATÉE ≠ VIDE — un fil que la base ne rend pas (500) dit « Réessayer » ;
//      un fil vide que la liste annonce dit « pas encore lu · Relire », jamais « aucun » ;
//      eBay : une liste que la route ne rend pas n'est pas « Aucune question » ;
//   4. RÉPONSES RAPIDES — UNE seule entrée (la rangée du fil) ;
//   5. BULLES — les siennes à droite ;
//   6. MISE EN PAGE — 1512 : la fiche à côté du fil ; 390 : la liste, puis le fil plein écran ;
//   7. VESTIAIRE — l'offre de l'article (même productId) en carte DANS sa conversation, avec
//      ses gestes (c'est à lui), et pas une seconde fois au-dessus.
// Ce qui est jugé : data-*, ordre des lignes, positions, nombres de commandes — et les mots
// demandés (« Envoi… », « Envoyé ✓ », « Réessayer », « Pas confirmé »).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4793;
const OUT = process.env.BANC_CAPTURES || os.tmpdir();

const MAINTENANT = Date.now();
const il = (min) => new Date(MAINTENANT - min * 60e3).toISOString();
const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
const duJour = (min) => new Date(Math.max(debutJour.getTime() + 60e3 * (60 - min), MAINTENANT - min * 60e3)).toISOString();
const HIER = il(60 * 26), AVANT_HIER = il(60 * 24 * 4);

// ── Leboncoin : L_PANNE (il y a 4 j), L_JOUR (aujourd'hui), L_VIDE (hier), servis dans ce désordre.
const LBC_META = [
  { id: 'lbc_fil_L_PANNE', n: '2', da: AVANT_HIER, ap: 'C’est négociable ?', dm: 'false', compte: 'u1' },
  { id: 'lbc_fil_L_JOUR', n: '2', da: duJour(5), ap: 'Toujours dispo ?', dm: 'false', compte: 'u1' },
  { id: 'lbc_fil_L_VIDE', n: '1', da: HIER, ap: 'Je prends', dm: 'false', compte: 'u1' },
];
const LBC_FIL_JOUR = [{ id: 'a', t: 'Bonjour', deMoi: false, at: duJour(30) }, { id: 'b', t: 'Oui, bonjour !', deMoi: true, at: duJour(20) }, { id: 'c', t: 'Toujours dispo ?', deMoi: false, at: duJour(5) }];
// ── Vestiaire : V_PANNE (4 j), V_JOUR (aujourd'hui, une OFFRE sur son article), V_VIDE (hier).
const VC_CONVS = {
  V_PANNE: { productId: '900003', ref: '', nonLu: false, date: AVANT_HIER, apercu: 'Merci', apercuDeMoi: false, titre: 'Mocassins cuir' },
  V_JOUR: { productId: '900001', ref: '', nonLu: true, date: duJour(5), apercu: 'Vous faites 110 € ?', apercuDeMoi: false, titre: 'Bottines daim' },
  V_VIDE: { productId: '900002', ref: '', nonLu: false, date: HIER, apercu: 'La boîte est incluse ?', apercuDeMoi: false, titre: 'Sac bandoulière' },
};
const VC_META = Object.entries(VC_CONVS).map(([id, v]) => ({ id: 'vc_fil_' + id, n: '2', da: v.date, ap: v.apercu, dm: 'false', pid: v.productId, ref: '' }));
const VC_FIL_JOUR = [{ id: 'x', t: 'Bonjour, toujours dispo ?', deMoi: false, at: duJour(40) }, { id: 'y', t: 'Oui !', deMoi: true, at: duJour(30) }, { id: 'z', t: 'Vous faites 110 € ?', deMoi: false, at: duJour(5) }];
const OFFRE = (id, produit, titre) => ({ id, produit, compte: '', titre, photo: '', lien: '', offre: 11000, net: 9500, initial: 13000, expire: new Date(MAINTENANT + 30 * 3600e3).toISOString(), aToi: true, ouverte: true, dernier: { action: 'offer', par: 'acheteur', at: il(5), cents: 11000 } });
const VC_OFFRES = { '1001': OFFRE('1001', '900001', 'Bottines daim'), '1002': OFFRE('1002', '900009', 'Escarpins vernis') };
const RECETTE = { appris: true };
// ── eBay : e_vieux (4 j), e_jour (aujourd'hui, rendu DEUX fois), e_vide (hier, texte pas arrivé).
const EBAY = [
  { id: 'e_vieux', itemId: '3001', titre: 'Derbies', sender: 'acheteur_a', subject: 'Question', body: 'Quelle pointure ?', responses: [], status: 'Unanswered', date: AVANT_HIER, type: 'AskSellerQuestion' },
  { id: 'e_jour', itemId: '3002', titre: 'Baskets', sender: 'acheteur_b', subject: 'Question', body: 'Envoi rapide ?', responses: ['Oui, sous 24 h.'], status: 'Unanswered', date: duJour(5), type: 'AskSellerQuestion' },
  { id: 'e_vide', itemId: '3003', titre: 'Sandales', sender: 'acheteur_c', subject: 'Question', body: '', responses: [], status: 'Unanswered', date: HIER, type: 'AskSellerQuestion' },
  { id: 'e_jour', itemId: '3002', titre: 'Baskets', sender: 'acheteur_b', subject: 'Question', body: 'Envoi rapide ?', responses: [], status: 'Unanswered', date: il(60 * 24 * 6), type: 'AskSellerQuestion' },
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

// Le pont de l'extension (5.344) : chaque commande d'envoi suit `window.__issue` :
// 'ok' (fait), 'refus' (le site a dit non), 'incertain', ou 'tenu' (gardée jusqu'à `__relacher()`).
const PONT = () => {
  const version = '5.344.0';
  window.__cmds = []; window.__issue = 'ok';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {} } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(String(d.cmd || ''));
      const envoi = d.cmd === 'lbcRepondre' || d.cmd === 'vcRepondre';
      const resp = !envoi ? { accepte: false, code: 'banc', raison: 'banc' }
        : window.__issue === 'refus' ? { accepte: true, etape: 'refuse', statut: 400, raison: 'le site a répondu 400 — le message n’est pas parti' }
          : window.__issue === 'incertain' ? { accepte: true, etape: 'incertain', raison: 'l’onglet n’a pas répondu — regarde avant de renvoyer' }
            : { accepte: true, etape: 'fait', statut: 200 };
      const rep = () => post({ __vmr: 'cmd:result', reqId: d.reqId, resp });
      if (envoi && window.__issue === 'tenu') window.__relacher = rep; else setTimeout(rep, 60);
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, { tel, dark, site, listeKO = false }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, colorScheme: dark ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((dk) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!dk)); } catch (_) {} }, dark);
  await pg.addInitScript(PONT);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const L = {
    lbc_messages: [{ compteurs: { u1: { unread: 2, at: il(1) } }, comptes: { u1: { name: 'Compte particulier', pro: false, at: il(1) } } }],
    lbc_envoi: [{ appris: true, raison: '', at: il(600) }],
    lbc_fil_L_JOUR: [{ messages: LBC_FIL_JOUR, page: '/messages/id/L_JOUR' }],
    lbc_fil_L_VIDE: [{ messages: [], page: '' }],
    vc_messages: [{ compteur: { messages: 1, at: il(1) }, conversations: VC_CONVS, lecture: { at: il(1), total: 3, complet: true, page: '/messages/' } }],
    vc_listings: [{ liens: {}, items: {} }],
    vc_envoi: [{ appris: true, raison: '', at: il(600) }],
    vc_fil_V_JOUR: [{ messages: VC_FIL_JOUR, page: '/messages/', at: il(1) }],
    vc_fil_V_VIDE: [{ messages: [], page: '/messages/', at: il(1) }],
    vc_offres: [{ offres: VC_OFFRES, lecture: { at: il(1) }, capturedAt: il(1) }],
    vc_offres_recette: [{ accepter: RECETTE, refuser: RECETTE, contre: RECETTE }],
  };
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/id=in\.\(lbc_listings/.test(u) && /select=id(&|$)/.test(u)) return j([{ id: 'lbc_accounts' }, { id: 'vc_listings' }, { id: 'ebay_listings' }]);
    if (/id=like\.lbc_fil_/.test(u)) return j(LBC_META);
    if (/id=like\.vc_fil_/.test(u)) return j(VC_META);
    // Les fils « en panne » : la base ne répond pas (lecture ratée, pas vide).
    if (/id=eq\.(lbc_fil_L_PANNE|vc_fil_V_PANNE)/.test(u)) return j({ message: 'panne' }, 500);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && L[eq[1]]) return j(L[eq[1]]);
    return j([]);
  });
  const ebay = { issue: 'ok', repondre: 0, relacher: null };
  await pg.route('**/api/ebay', async (r) => {
    const body = r.request().method() === 'POST' ? (r.request().postDataJSON() || {}) : {};
    const a = body.action;
    const rep = (j, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(j) });
    if (a === 'status') return rep({ ok: true, connected: true, comptes: [{ cle: '', ref: 'principal', principal: true, pseudo: 'Compte de banc', relie: true }] });
    if (a === 'messages') return listeKO ? rep({ ok: false, error: 'eBay indisponible (banc)' }, 502) : rep({ ok: true, messages: EBAY, page: 1, totalPages: 1 });
    if (a === 'message') return rep({ ok: true, message: EBAY.find((m) => m.id === body.messageId) });
    if (a === 'repondre') {
      ebay.repondre++;
      const fin = () => (ebay.issue === 'refus' ? rep({ ok: false, error: 'eBay a refusé la réponse (banc).' }, 400)
        : ebay.issue === 'incertain' ? rep({ ok: false, reason: 'incertain', error: 'délai' }, 504) : rep({ ok: true }));
      if (ebay.issue === 'tenu') return new Promise((res) => { ebay.relacher = () => { ebay.issue = 'ok'; res(fin()); }; });
      return fin();
    }
    return rep({ ok: true, connected: true, ready: true });
  });
  await pg.route('**/api/**', (r) => (/\/api\/ebay/.test(r.request().url()) ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' })));
  await pg.goto(`http://localhost:${PORT}/?tab=messages&site=${site}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector(`[data-messagerie-site="${site}"] .vrm-inbox-row`, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(900);
  if (site === 'ebay') { await pg.click('[data-ebay-vue="tout"]').catch(() => {}); await pg.waitForTimeout(300); }
  return { ctx, pg, errs, ebay };
}

const ordre = (pg, sel, attr) => pg.evaluate(([s, a]) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null).map((e) => e.getAttribute(a)), [sel, attr]);
const envoiEtat = (pg) => pg.evaluate(() => { const e = document.querySelector('.vrm-chat-panel [data-envoi]'); const b = document.querySelector('.vrm-chat-panel [data-envoi-bulle]'); return e ? { etat: e.getAttribute('data-envoi'), t: e.textContent.trim(), bulle: b ? b.getAttribute('data-envoi-bulle') : '', reessayer: !!e.querySelector('[data-envoi-reessayer]') } : null; });
const attendreEnvoi = (pg, etat) => pg.waitForFunction((x) => document.querySelector(`.vrm-chat-panel [data-envoi="${x}"]`), etat, { timeout: 6000 }).catch(() => {});
const nCmds = (pg, c) => pg.evaluate((x) => window.__cmds.filter((y) => y === x).length, c);
const rapides = (pg) => pg.evaluate(() => ({ rangees: document.querySelectorAll('[data-rapides-rangee]').length, autres: [...document.querySelectorAll('button, summary, h2, h3')].filter((e) => e.offsetParent !== null && /^Réponses rapides/.test(e.textContent.trim()) && !e.closest('[data-rapides-rangee]')).length }));
const cotes = (pg) => pg.evaluate(() => { const m = [...document.querySelectorAll('.vrm-chat-panel .vrm-bulle[data-bulle="moi"]')].pop(), a = [...document.querySelectorAll('.vrm-chat-panel .vrm-bulle[data-bulle="acheteur"]')].pop(); const p = document.querySelector('.vrm-chat-panel .vrm-chat-history'); if (!m || !a || !p) return null; const bm = m.getBoundingClientRect(), ba = a.getBoundingClientRect(), bp = p.getBoundingClientRect(); return { moiDroite: bp.right - bm.right < 40, autreGauche: ba.left - bp.left < 40 }; });
const miseEnPage = (pg) => pg.evaluate(() => { const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? { l: b.left, r: b.right, t: b.top, w: b.width, h: b.height } : null; }; return { panel: box('.vrm-chat-panel'), fiche: box('.vrm-msg-fiche'), retour: box('.vrm-chat-panel .vrm-chat-back'), vw: innerWidth, vh: innerHeight, deb: document.documentElement.scrollWidth > innerWidth + 1 }; });
const texteFil = (pg) => pg.evaluate(() => { const h = document.querySelector('.vrm-chat-panel .vrm-chat-history'); return h ? h.innerText : ''; });

async function envois(T, pg, site, { remplir, envoyer, issue, cmd, nEnvois }) {
  // Tenu : « Envoi… » visible tant que le site n'a pas répondu.
  await issue('tenu'); await remplir('Je peux l’envoyer demain.'); await envoyer();
  await attendreEnvoi(pg, 'envoi');
  const e1 = await envoiEtat(pg);
  dit(e1 && e1.etat === 'envoi' && /^Envoi…$/.test(e1.t) && e1.bulle === 'envoi', `${T} ${site} : commande tenue ⇒ la bulle « Envoi… » dans le fil`, JSON.stringify(e1));
  await pg.screenshot({ path: path.join(OUT, `messages-sites-naturel-${site}-envoi-${T.replace(/\s+/g, '-')}.png`) });
  await pg.evaluate(() => window.__relacher && window.__relacher()).catch(() => {});
  await issue('relacher');
  await attendreEnvoi(pg, 'ok');
  const e2 = await envoiEtat(pg);
  dit(e2 && e2.etat === 'ok' && /Envoyé ✓/.test(e2.t) && !e2.reessayer, `${T} ${site} : relâchée et acceptée ⇒ « Envoyé ✓ »`, JSON.stringify(e2));
  dit((await nEnvois()) === 1, `${T} ${site} : un clic, un envoi`, String(await nEnvois()));
  // Refus net : « Pas envoyé · Réessayer » ; Réessayer renvoie UNE fois sur son clic.
  await issue('refus'); await remplir('Et le prix ?'); await envoyer();
  await attendreEnvoi(pg, 'refuse');
  const e3 = await envoiEtat(pg);
  dit(e3 && e3.etat === 'refuse' && /Pas envoyé/.test(e3.t) && e3.reessayer, `${T} ${site} : refus ⇒ « Pas envoyé · Réessayer »`, JSON.stringify(e3));
  await pg.screenshot({ path: path.join(OUT, `messages-sites-naturel-${site}-refus-${T.replace(/\s+/g, '-')}.png`) });
  const avant = await nEnvois();
  await pg.click('.vrm-chat-panel [data-envoi-reessayer]').catch(() => {});
  if (site === 'ebay') await pg.click('.vrm-confirmation button:has-text("Envoyer la réponse")').catch(() => {});
  await pg.waitForTimeout(500);
  dit((await nEnvois()) === avant + 1, `${T} ${site} : « Réessayer » renvoie une fois, sur son clic`, `${avant} → ${await nEnvois()}`);
  // Incertain : « Pas confirmé », rien ne propose de renvoyer.
  await issue('incertain'); await remplir('Je vérifie.'); await envoyer();
  await attendreEnvoi(pg, 'incertain');
  const e4 = await envoiEtat(pg);
  dit(e4 && e4.etat === 'incertain' && /Pas confirmé/.test(e4.t) && !e4.reessayer, `${T} ${site} : réponse incertaine ⇒ « Pas confirmé », aucun « Réessayer »`, JSON.stringify(e4));
  void cmd;
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) for (const dark of [false, true]) {
      const T = `${tel ? '390' : '1512'}-${dark ? 'sombre' : 'clair'}`;
      const ouvrirConv = async (pg, sel) => { await pg.click(sel); await pg.waitForTimeout(700); };
      const fermer = async (pg) => { await pg.click('.vrm-chat-panel .vrm-chat-back').catch(() => {}); await pg.waitForTimeout(300); };

      // ── Leboncoin ──────────────────────────────────────────────────
      let r = await ouvrir(b, { tel, dark, site: 'leboncoin' });
      try {
        const o = await ordre(r.pg, '[data-lbc-conv]', 'data-lbc-conv');
        dit(o.join() === 'L_JOUR,L_VIDE,L_PANNE', `${T} leboncoin : le plus récent en haut`, o.join());
        await r.pg.screenshot({ path: path.join(OUT, `messages-sites-naturel-leboncoin-liste-${T}.png`) });
        await ouvrirConv(r.pg, '[data-lbc-conv="L_VIDE"] button');
        const tv = await texteFil(r.pg);
        dit(await r.pg.$('.vrm-chat-panel [data-fil-pas-lu]') && !/aucun message/i.test(tv) && !/^\s*—\s*$/.test(tv), `${T} leboncoin : fil vide annoncé par la liste ⇒ « pas encore lu · Relire »`, tv.slice(0, 80));
        await fermer(r.pg);
        await ouvrirConv(r.pg, '[data-lbc-conv="L_PANNE"] button');
        await r.pg.waitForSelector('.vrm-chat-panel [data-fil-illisible]', { timeout: 8000 }).catch(() => {});   // la base est relue une fois avant de dire la panne
        dit(!!(await r.pg.$('.vrm-chat-panel [data-fil-illisible] [data-pied-lien="relire-fil"]')), `${T} leboncoin : lecture ratée ⇒ « Réessayer », jamais vide`, (await texteFil(r.pg)).slice(0, 80));
        await fermer(r.pg);
        await ouvrirConv(r.pg, '[data-lbc-conv="L_JOUR"] button');
        await r.pg.waitForSelector('[data-lbc-envoyer]', { timeout: 6000 }).catch(() => {});
        const rq = await rapides(r.pg);
        dit(rq.rangees === 1 && rq.autres === 0, `${T} leboncoin : une seule entrée de réponses rapides`, JSON.stringify(rq));
        const c = await cotes(r.pg);
        dit(c && c.moiDroite && c.autreGauche, `${T} leboncoin : ses bulles à droite, l’autre à gauche`, JSON.stringify(c));
        const m = await miseEnPage(r.pg);
        dit(tel ? (m.panel && m.panel.w >= m.vw - 1 && m.panel.h >= m.vh * 0.8 && !!m.retour) : (m.panel && m.fiche && m.fiche.l >= m.panel.r - 1), `${T} leboncoin : ${tel ? 'le fil plein écran, avec un retour' : 'la fiche à côté du fil'}`, JSON.stringify(m));
        await r.pg.screenshot({ path: path.join(OUT, `messages-sites-naturel-leboncoin-fil-${T}.png`) });
        await envois(T, r.pg, 'leboncoin', {
          remplir: (t) => r.pg.fill('.vrm-chat-panel .vrm-chat-compose textarea', t), envoyer: () => r.pg.click('[data-lbc-envoyer]'),
          issue: (x) => (x === 'relacher' ? null : r.pg.evaluate((y) => { window.__issue = y; }, x)), nEnvois: () => nCmds(r.pg, 'lbcRepondre'),
        });
        dit(r.errs.length === 0, `${T} leboncoin : aucune erreur`, r.errs.join(' | ').slice(0, 160));
      } catch (e) { dit(false, `${T} leboncoin : la section a tourné jusqu’au bout`, String(e.message).slice(0, 140)); } finally { await r.ctx.close(); }

      // ── Vestiaire ──────────────────────────────────────────────────
      r = await ouvrir(b, { tel, dark, site: 'vestiaire' });
      try {
        const o = await ordre(r.pg, '[data-vc-conv]', 'data-vc-conv');
        dit(o.join() === 'V_JOUR,V_VIDE,V_PANNE', `${T} vestiaire : le plus récent en haut`, o.join());
        await r.pg.screenshot({ path: path.join(OUT, `messages-sites-naturel-vestiaire-liste-${T}.png`) });
        await ouvrirConv(r.pg, '[data-vc-conv="V_VIDE"] button');
        const tv = await texteFil(r.pg);
        dit(await r.pg.$('.vrm-chat-panel [data-fil-pas-lu]') && !/aucun message/i.test(tv), `${T} vestiaire : fil vide annoncé par la liste ⇒ « pas encore lu · Relire »`, tv.slice(0, 80));
        await fermer(r.pg);
        await ouvrirConv(r.pg, '[data-vc-conv="V_PANNE"] button');
        await r.pg.waitForSelector('.vrm-chat-panel [data-fil-illisible]', { timeout: 8000 }).catch(() => {});   // la base est relue une fois avant de dire la panne
        dit(!!(await r.pg.$('.vrm-chat-panel [data-fil-illisible] [data-pied-lien="relire-fil"]')), `${T} vestiaire : lecture ratée ⇒ « Réessayer »`, (await texteFil(r.pg)).slice(0, 80));
        await fermer(r.pg);
        await ouvrirConv(r.pg, '[data-vc-conv="V_JOUR"] button');
        await r.pg.waitForSelector('[data-vc-envoyer]', { timeout: 6000 }).catch(() => {});
        await r.pg.waitForTimeout(500);
        const of = await r.pg.evaluate(() => ({ dansFil: document.querySelectorAll('.vrm-chat-panel [data-vc-offre="1001"]').length, partout: document.querySelectorAll('[data-vc-offre="1001"]').length,
          gestes: document.querySelectorAll('.vrm-chat-panel [data-vc-offre="1001"] [data-vc-offre-geste]').length, autre: document.querySelectorAll('[data-vc-offre="1002"]').length }));
        dit(of.dansFil === 1 && of.partout === 1 && of.gestes >= 2, `${T} vestiaire : l’offre de l’article, en carte DANS sa conversation, avec ses gestes, une seule fois`, JSON.stringify(of));
        dit(tel || of.autre === 1, `${T} vestiaire : l’offre d’un autre article reste au-dessus de la liste`, JSON.stringify(of));
        const rq = await rapides(r.pg);
        dit(rq.rangees === 1 && rq.autres === 0, `${T} vestiaire : une seule entrée de réponses rapides`, JSON.stringify(rq));
        const c = await cotes(r.pg);
        dit(c && c.moiDroite && c.autreGauche, `${T} vestiaire : ses bulles à droite, l’autre à gauche`, JSON.stringify(c));
        const m = await miseEnPage(r.pg);
        dit(tel ? (m.panel && m.panel.w >= m.vw - 1 && m.panel.h >= m.vh * 0.8 && !!m.retour) : (m.panel && m.fiche && m.fiche.l >= m.panel.r - 1), `${T} vestiaire : ${tel ? 'le fil plein écran, avec un retour' : 'la fiche à côté du fil'}`, JSON.stringify(m));
        await r.pg.screenshot({ path: path.join(OUT, `messages-sites-naturel-vestiaire-fil-${T}.png`) });
        await envois(T, r.pg, 'vestiaire', {
          remplir: (t) => r.pg.fill('.vrm-chat-panel .vrm-chat-compose textarea', t), envoyer: () => r.pg.click('[data-vc-envoyer]'),
          issue: (x) => (x === 'relacher' ? null : r.pg.evaluate((y) => { window.__issue = y; }, x)), nEnvois: () => nCmds(r.pg, 'vcRepondre'),
        });
        dit(r.errs.length === 0, `${T} vestiaire : aucune erreur`, r.errs.join(' | ').slice(0, 160));
      } catch (e) { dit(false, `${T} vestiaire : la section a tourné jusqu’au bout`, String(e.message).slice(0, 140)); } finally { await r.ctx.close(); }

      // ── eBay ───────────────────────────────────────────────────────
      r = await ouvrir(b, { tel, dark, site: 'ebay' });
      try {
        const o = await ordre(r.pg, '[data-ebay-message]', 'data-ebay-message');
        dit(o.join() === 'e_jour,e_vide,e_vieux', `${T} ebay : le plus récent en haut, l’échange rendu deux fois listé une fois`, o.join());
        await r.pg.screenshot({ path: path.join(OUT, `messages-sites-naturel-ebay-liste-${T}.png`) });
        await ouvrirConv(r.pg, '[data-ebay-message="e_vide"]');
        dit(!!(await r.pg.$('.vrm-chat-panel [data-fil-pas-lu]')), `${T} ebay : texte pas arrivé ⇒ « pas encore lu · Relire », jamais un fil vide`, (await texteFil(r.pg)).slice(0, 80));
        await fermer(r.pg);
        await ouvrirConv(r.pg, '[data-ebay-message="e_jour"]');
        const rq = await rapides(r.pg);
        dit(rq.rangees === 1 && rq.autres === 0, `${T} ebay : une seule entrée de réponses rapides`, JSON.stringify(rq));
        const c = await cotes(r.pg);
        dit(c && c.moiDroite && c.autreGauche, `${T} ebay : ses bulles à droite, l’autre à gauche`, JSON.stringify(c));
        const m = await miseEnPage(r.pg);
        dit(tel ? (m.panel && m.panel.w >= m.vw - 1 && m.panel.h >= m.vh * 0.8 && !!m.retour) : (m.panel && m.fiche && m.fiche.l >= m.panel.r - 1), `${T} ebay : ${tel ? 'le fil plein écran, avec un retour' : 'la fiche à côté du fil'}`, JSON.stringify(m));
        await r.pg.screenshot({ path: path.join(OUT, `messages-sites-naturel-ebay-fil-${T}.png`) });
        const envoyer = async () => { await r.pg.click('.vrm-chat-panel .vrm-chat-send'); await r.pg.click('.vrm-confirmation button:has-text("Envoyer la réponse")').catch(() => {}); };
        await envois(T, r.pg, 'ebay', {
          remplir: (t) => r.pg.fill('.vrm-chat-panel .vrm-chat-compose textarea', t), envoyer,
          issue: async (x) => { if (x === 'relacher') { await r.pg.waitForTimeout(200); if (r.ebay.relacher) r.ebay.relacher(); } else r.ebay.issue = x; }, nEnvois: async () => r.ebay.repondre,
        });
        dit(r.errs.length === 0, `${T} ebay : aucune erreur`, r.errs.join(' | ').slice(0, 160));
      } catch (e) { dit(false, `${T} ebay : la section a tourné jusqu’au bout`, String(e.message).slice(0, 140)); } finally { await r.ctx.close(); }

      if (!tel) {
        r = await ouvrir(b, { tel, dark, site: 'ebay', listeKO: true });
        try {
          await r.pg.waitForTimeout(600);
          const x = await r.pg.evaluate(() => ({ panne: !!document.querySelector('[data-ebay-lecture="pas-su"] [data-pied-lien="relire-fil"]'), vide: !!document.querySelector('[data-ebay-vide]') }));
          dit(x.panne && !x.vide, `${T} ebay : liste illisible ⇒ « Réessayer », jamais « Aucune question »`, JSON.stringify(x));
          await r.pg.screenshot({ path: path.join(OUT, `messages-sites-naturel-ebay-panne-${T}.png`) });
        } catch (e) { dit(false, `${T} ebay panne : la section a tourné jusqu’au bout`, String(e.message).slice(0, 140)); } finally { await r.ctx.close(); }
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ messages-sites-naturel : ${ko} rouge(s)` : '\n✅ messages-sites-naturel : tout est vert');
  process.exit(ko ? 1 : 0);
})();
