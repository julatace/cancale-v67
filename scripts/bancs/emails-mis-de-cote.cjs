// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES EMAILS MIS DE CÔTÉ SE LISENT PAR LA ROUTE (6 octobre)
//        node scripts/bancs/emails-mis-de-cote.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Base cloisonnée, un email non attribué vit sous un propriétaire NEUTRE que
// personne n'a : RLS ne le montre à AUCUN vendeur. L'app le lisait sous RLS —
// elle ne voyait donc plus rien, et le vendeur qui venait de déclarer son
// adresse ne retrouvait jamais l'email arrivé avant. Elle lit maintenant
// `/api/email-rattacher?mode=liste`, AVEC sa session.
//
// Le banc sert ce que voit vraiment un vendeur : la lecture RLS de la
// quarantaine rend `[]` (les lignes neutres lui sont invisibles), la route rend
// les emails qui sont À LUI. Trois états, jamais deux :
//   · lu        → les emails sont proposés, « C'est à moi » rejoue le BON ;
//   · pas su    → une phrase le dit (jamais « rien à réclamer ») ;
//   · lu, vide  → rien, aucune fausse alerte.
// Et Ma journée rattrape en fond ce que la route rend — rien quand elle ne
// répond pas.
//
// ⚠️⚠️ PARTIE 2 (relecture du 6 octobre) — JULIEN À 0 ADRESSE, UN AUTRE DÉCLARE.
// Le repli « installation » s'éteint, ses emails partent au neutre : sa liste
// était vide, son POST rendait 404, et Réglages affirmait encore « les emails
// reçus sont attribués au propriétaire de cette installation ». Rien ne le
// disait. Le banc exige, au rendu :
//   · le NOMBRE (que la route ne rend qu'à lui) écrit avec le geste, dans
//     Réglages ET une fois sur Ma journée ;
//   · une phrase qui suit le registre (jamais « tout te revient » quand ce
//     n'est plus vrai) ;
//   · ses adresses déjà vues suggérées, ajoutables d'un clic — et l'arriéré
//     récupéré une fois l'adresse déclarée ;
//   · et l'autre sens : un vendeur à qui la route ne donne pas le nombre n'en
//     voit aucun, et le propriétaire encore seul n'est pas alarmé.
// ⚠️ Données INVENTÉES : aucune fixture, le banc vit dans le dépôt.
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4801;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '22222222-2222-2222-2222-222222222222', email: 'vendeuse@exemple.test' } };
const EMAILS = [
  { id: 'email_quarantaine_banc0001', sujet: 'Ton article est vendu ! (banc)', raison: 'adresse de réception inconnue', quand: '2026-10-05T09:00:00.000Z' },
  { id: 'email_quarantaine_banc0002', sujet: 'Bordereau de banc', raison: 'adresse de réception inconnue', quand: '2026-10-04T09:00:00.000Z' },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// `liste` : ce que rend la route — un tableau, ou 'panne' (503).
// `reponse(etat)` : la réponse ENTIÈRE de la route, calculée sur l'état du banc
//   (le registre que l'app vient d'écrire) — prioritaire sur `liste`.
// `registre` : les adresses que la lecture RLS de `vrm_email_owners` rend.
// `vues` : les lignes `email_inconnu_*` (`to`, `quand`) que la session lit.
async function ouvrir(nav, { liste, reponse, registre, vues = [], tab = 'settings', viewport = { width: 1512, height: 950 } }) {
  const ctx = await nav.newContext({ viewport });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  const lecturesRls = [];
  const etat = { registre: registre === undefined ? { 'vendeuse@exemple.test': { owner: SESSION.user.id, label: '' } } : registre, ecritures: [] };
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    if (/email_quarantaine/.test(u)) lecturesRls.push(u.replace(/^.*\/rest\/v1\//, ''));
    // Le registre du vendeur : ce qu'il a déclaré (à état : une écriture le change).
    if (/id=eq\.vrm_email_owners/.test(u) && r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.keys(etat.registre).length ? [{ data: { adresses: etat.registre } }] : []) });
    }
    if (r.request().method() === 'POST' && /\/rest\/v1\/app_data/.test(u)) {
      let rows = []; try { rows = JSON.parse(r.request().postData() || '[]'); } catch (_) {}
      for (const x of (Array.isArray(rows) ? rows : [rows])) {
        etat.ecritures.push(x);
        if (x && x.id === 'vrm_email_owners' && x.data && x.data.adresses) etat.registre = x.data.adresses;
      }
      return r.fulfill({ status: 201, contentType: 'application/json', body: '' });
    }
    // SES emails déjà rangés : la projection `to`/`quand` (jamais l'email).
    if (/id=like\.email_inconnu_\*/.test(u) && r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vues) });
    }
    // Tout le reste — y compris la quarantaine lue sous RLS : `[]`, car les
    // lignes du propriétaire neutre sont invisibles à un vendeur.
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/\/api\/email-rattacher/.test(u)) {
      const m = r.request().method();
      let corps = null; try { corps = JSON.parse(r.request().postData() || 'null'); } catch (_) {}
      appels.push({ m, liste: /mode=liste/.test(u), auth: r.request().headers().authorization || '', corps });
      if (m === 'GET') {
        if (reponse) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reponse(etat)) });
        return liste === 'panne' ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"base-injoignable"}' })
          : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: liste }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, resultat: { ok: true, type: 'vente' } }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  return { ctx, pg, erreurs, appels, lecturesRls, etat };
}
// Le panneau « Mes adresses de réception », lu sur ce qui est RENDU.
const panneau = (pg) => pg.evaluate(() => {
  const t = [...document.querySelectorAll('div')].find((d) => d.firstElementChild && /^Mes adresses de réception$/.test((d.firstElementChild.innerText || '').trim()));
  if (!t) return null;
  const pers = t.querySelector('[data-personne]');
  const vide = t.querySelector('[data-adresses-vide]');
  return { texte: t.innerText, pasSu: !!t.querySelector('[data-mis-de-cote="pas-su"]'), boutons: [...t.querySelectorAll('button')].map((b) => b.innerText.trim()),
    personne: pers ? { n: pers.getAttribute('data-personne'), texte: pers.innerText } : null,
    vide: vide ? { genre: vide.getAttribute('data-adresses-vide'), texte: vide.innerText } : null,
    suggestions: [...t.querySelectorAll('[data-suggestion]')].map((x) => x.getAttribute('data-suggestion')) };
});
// ── La partie 2 : Julien (propriétaire) à 0 adresse, un autre compte a déclaré.
const JULIEN = 'julien.banc@exemple.test';
const EMAIL_JULIEN = { id: 'email_quarantaine_julien01', sujet: 'Ton article est vendu ! (Julien, banc)', raison: 'adresse de réception inconnue, et l’app compte plusieurs vendeurs', quand: '2026-10-05T09:00:00.000Z' };
// La route, telle qu'elle répond au SEUL propriétaire : tant que son adresse
// n'est pas déclarée, l'email est à personne (le nombre) ; déclarée, il lui
// est proposé (la liste).
const corpsProprio = ({ repli = false, n = 3 } = {}) => (etat) => {
  const declaree = Object.keys(etat.registre).some((a) => a.toLowerCase() === JULIEN);
  return { ok: true, cloisonnee: true, emails: declaree ? [EMAIL_JULIEN] : [],
    installation: { repli, personne: { n: declaree ? n - 1 : n, auMoins: false, causes: declaree ? (n - 1 ? { inconnue: n - 1 } : {}) : { inconnue: n } } } };
};
// SES emails déjà rangés : deux formes de la même adresse (« Nom <…> » et nue),
// une seconde adresse, et une déjà déclarée.
const VUES = [
  { to: 'Julien Banc <Julien.Banc@exemple.test>', quand: '2026-10-04T08:00:00.000Z' },
  { to: 'julien.banc@exemple.test', quand: '2026-10-05T08:00:00.000Z' },
  { to: 'Hide My Email <masque-banc@exemple.test>', quand: '2026-09-20T08:00:00.000Z' },
  { to: 'deja-declaree@exemple.test', quand: '2026-09-21T08:00:00.000Z' },
];
const jobPersonne = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-job="emails-personne"]')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()));

(async () => {
  await new Promise((res, rej) => { srv.once('error', (e) => rej(e)); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const viewport of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      console.log(`\n── Réglages, ${viewport.width} px : la liste vient de la route`);
      await essaie('lu', async () => {
        const { ctx, pg, erreurs, appels, lecturesRls } = await ouvrir(nav, { liste: EMAILS, viewport });
        const p = await panneau(pg);
        dit(!!p, 'le panneau « Mes adresses de réception » est rendu', p ? '' : 'introuvable');
        // Regarder la capture fait partie du test (§6.2) : CAPTURE_DIR=… pour l'écrire.
        if (process.env.CAPTURE_DIR) {
          const el = pg.locator('div', { hasText: /^Mes adresses de réception/ }).last();
          await el.scrollIntoViewIfNeeded().catch(() => {});
          await pg.screenshot({ path: path.join(process.env.CAPTURE_DIR, `mis-de-cote-${viewport.width}.png`) }).catch(() => {});
        }
        const g = appels.filter((a) => a.liste);
        dit(g.length >= 1 && g.every((a) => a.auth === 'Bearer jeton-de-banc'),
          'la liste est demandée à la ROUTE, avec la session', JSON.stringify(g.map((a) => a.auth)));
        dit(p && /2 emails en attente/.test(p.texte) && /vendu ! \(banc\)/.test(p.texte) && /Bordereau de banc/.test(p.texte),
          'les deux emails que la route dit À LUI sont proposés (la lecture RLS, elle, ne voit rien)', p && p.texte.replace(/\n/g, ' ').slice(0, 220));
        dit(p && !p.pasSu, 'lu : aucune phrase de panne');
        dit(lecturesRls.length === 0, 'la quarantaine n’est plus lue sous RLS (les lignes neutres y sont invisibles)', lecturesRls.join(' · '));
        // « C'est à moi » rejoue CE email, avec la session.
        const avant = appels.length;
        const b = pg.locator('button', { hasText: "C'est à moi" }).first();
        if (await b.count()) { await b.click(); await pg.waitForTimeout(1500); }
        const post = appels.slice(avant).find((a) => a.m === 'POST');
        dit(!!post && post.corps && post.corps.id === EMAILS[0].id && post.auth === 'Bearer jeton-de-banc',
          '« C’est à moi » rejoue CET email-là, avec la session', JSON.stringify(post || null));
        const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(erreurs.length === 0, 'aucune erreur d’app', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie('pas su', async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { liste: 'panne', viewport });
        const p = await panneau(pg);
        dit(p && p.pasSu && !/en attente d'un propriétaire/.test(p.texte),
          'route muette : la phrase « pas pu vérifier » — jamais un silence qui se lit « rien à réclamer »', p && p.texte.replace(/\n/g, ' ').slice(-200));
        dit(erreurs.length === 0, 'aucune erreur d’app', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie('lu, vide', async () => {
        const { ctx, pg } = await ouvrir(nav, { liste: [], viewport });
        const p = await panneau(pg);
        dit(p && !p.pasSu && !/en attente d'un propriétaire/.test(p.texte), 'l’autre sens : rien à réclamer → ni bloc, ni fausse alerte', p && p.texte.replace(/\n/g, ' ').slice(-160));
        await ctx.close();
      });
    }

    for (const viewport of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      console.log(`\n── Réglages, ${viewport.width} px : propriétaire à 0 adresse, un autre compte a déclaré`);
      await essaie('propriétaire, 0 adresse', async () => {
        const { ctx, pg, erreurs, appels, etat } = await ouvrir(nav, { reponse: corpsProprio(), registre: {}, vues: VUES, viewport });
        const p = await panneau(pg);
        dit(!!p && !!p.personne && p.personne.n === '3' && /3 emails mis de côté que personne ne peut récupérer/.test(p.personne.texte)
            && /adresse que tu n'as pas déclarée/.test(p.personne.texte) && /ajoute tes adresses de réception/.test(p.personne.texte),
          'le NOMBRE est écrit, avec le geste — ce n’est plus silencieux', p && (p.personne ? p.personne.texte.replace(/\n/g, ' ') : 'aucun bloc'));
        dit(!!p && !!p.vide && p.vide.genre === 'alerte' && !/attribués au propriétaire de cette installation/.test(p.texte) && /un autre compte a déclaré/.test(p.vide.texte),
          'la phrase suit le registre : plus « tout revient au propriétaire » quand ce n’est plus vrai', p && (p.vide ? p.vide.texte : p.texte.slice(0, 200)));
        dit(!!p && p.suggestions.includes(JULIEN) && p.suggestions.includes('masque-banc@exemple.test') && p.suggestions.filter((x) => x === JULIEN).length === 1,
          'ses adresses déjà vues sont suggérées — une fois chacune, sous la forme du serveur', p && p.suggestions.join(', '));
        if (process.env.CAPTURE_DIR) {
          await pg.locator('[data-reglage-adresses]').scrollIntoViewIfNeeded().catch(() => {});
          await pg.screenshot({ path: path.join(process.env.CAPTURE_DIR, `personne-${viewport.width}.png`) }).catch(() => {});
        }
        // e) Un clic sur SA suggestion la déclare ; l'arriéré lui est proposé, il le récupère.
        const b = pg.locator(`[data-suggestion="${JULIEN}"] button`).first();
        if (await b.count()) { await b.click(); await pg.waitForTimeout(1800); }
        const ecrite = etat.ecritures.find((x) => x && x.id === 'vrm_email_owners');
        dit(!!ecrite && Object.keys(ecrite.data.adresses).includes(JULIEN) && Object.keys(ecrite.data.adresses).length === 1,
          'un clic sur « + Ajouter » déclare CETTE adresse (et rien d’autre)', ecrite ? Object.keys(ecrite.data.adresses).join(', ') : 'aucune écriture');
        const p2 = await panneau(pg);
        dit(!!p2 && /1 email en attente/.test(p2.texte) && /Julien, banc/.test(p2.texte) && !p2.suggestions.includes(JULIEN),
          'l’adresse déclarée, son email mis de côté lui est proposé (la liste relue)', p2 && p2.texte.replace(/\n/g, ' ').slice(-260));
        const avant = appels.length;
        const moi = pg.locator('button', { hasText: "C'est à moi" }).first();
        if (await moi.count()) { await moi.click(); await pg.waitForTimeout(1500); }
        const post = appels.slice(avant).find((a) => a.m === 'POST');
        dit(!!post && post.corps && post.corps.id === EMAIL_JULIEN.id, 'et il le récupère : « C’est à moi » rejoue CET email', JSON.stringify(post || null));
        const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(erreurs.length === 0, 'aucune erreur d’app', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }

    console.log('\n── Ma journée : UNE ligne pour le propriétaire, avec le geste');
    await essaie('journée, propriétaire', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { reponse: corpsProprio(), registre: {}, vues: VUES, tab: 'journee' });
      const j = await jobPersonne(pg);
      dit(j.length === 1 && /3 emails mis de côté que personne ne peut récupérer/.test(j[0]) && /ajoute tes adresses de réception/.test(j[0]),
        'Ma journée le dit UNE fois, avec le geste', JSON.stringify(j));
      if (process.env.CAPTURE_DIR) await pg.screenshot({ path: path.join(process.env.CAPTURE_DIR, 'journee-personne.png') }).catch(() => {});
      const b = pg.locator('[data-job="emails-personne"]').first();
      if (await b.count()) { await b.click(); await pg.waitForTimeout(2500); }
      const vu = await pg.evaluate(() => { const el = document.querySelector('[data-reglage-adresses]'); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), h: innerHeight }; });
      dit(!!vu && vu.top < vu.h, 'et le geste mène au panneau des adresses de réception, à l’écran', JSON.stringify(vu));
      dit(erreurs.length === 0, 'aucune erreur d’app', erreurs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    console.log('\n── L’autre sens : ni nombre inventé, ni fausse alerte');
    await essaie('autre vendeur', async () => {
      // La route ne donne `installation` qu'au propriétaire : pour un autre
      // vendeur, l'app n'a rien à afficher — et n'invente rien.
      const reponse = () => ({ ok: true, cloisonnee: true, emails: [] });
      const r1 = await ouvrir(nav, { reponse, registre: {}, vues: [] });
      const p = await panneau(r1.pg);
      dit(!!p && !p.personne && !/personne ne peut récupérer/.test(p.texte), 'un autre vendeur : aucun nombre, aucune ligne « que personne ne peut récupérer »', p && p.texte.replace(/\n/g, ' ').slice(0, 200));
      dit(!!p && !!p.vide && /aucun email ne t'est attribué/.test(p.vide.texte) && !/propriétaire de cette installation/.test(p.vide.texte),
        'et sa phrase dit ce qui lui arrive à LUI (sans adresse, rien ne lui est attribué)', p && p.vide && p.vide.texte);
      await r1.ctx.close();
      const r2 = await ouvrir(nav, { reponse, registre: {}, vues: [], tab: 'journee' });
      const j = await jobPersonne(r2.pg);
      dit(j.length === 0, 'et Ma journée n’en dit rien', JSON.stringify(j));
      await r2.ctx.close();
    });
    await essaie('propriétaire encore seul', async () => {
      const reponse = () => ({ ok: true, cloisonnee: true, emails: [], installation: { repli: true, personne: { n: 0, auMoins: false, causes: {} } } });
      const r1 = await ouvrir(nav, { reponse, registre: {}, vues: VUES });
      const p = await panneau(r1.pg);
      dit(!!p && !p.personne && !!p.vide && p.vide.genre === 'info' && /te reviennent/.test(p.vide.texte),
        'seul à déclarer : la phrase dit que tout lui revient POUR L’INSTANT — pas d’alerte', p && (p.vide ? p.vide.texte : ''));
      await r1.ctx.close();
      const r2 = await ouvrir(nav, { reponse, registre: {}, vues: VUES, tab: 'journee' });
      dit((await jobPersonne(r2.pg)).length === 0, 'et Ma journée n’en dit rien (zéro n’est pas écrit)');
      await r2.ctx.close();
    });
    await essaie('compte pas su', async () => {
      const reponse = () => ({ ok: true, cloisonnee: true, emails: [], installation: { repli: false, personne: null } });
      const r1 = await ouvrir(nav, { reponse, registre: { [JULIEN]: { owner: SESSION.user.id } }, vues: VUES });
      const p = await panneau(r1.pg);
      dit(!!p && !!p.personne && p.personne.n === 'pas-su' && !/\d+ emails? mis de côté que personne/.test(p.texte),
        'le compte n’a pas pu se faire : « pas pu compter » — jamais un nombre, jamais un silence', p && p.texte.replace(/\n/g, ' ').slice(-200));
      dit(!!p && !p.suggestions.includes(JULIEN) && p.suggestions.includes('masque-banc@exemple.test'),
        'une adresse déjà déclarée n’est plus suggérée', p && p.suggestions.join(', '));
      await r1.ctx.close();
    });

    console.log('\n── Ma journée : le rattrapage en fond rejoue ce que la ROUTE rend');
    await essaie('rattrapage', async () => {
      const { ctx, appels, lecturesRls } = await ouvrir(nav, { liste: EMAILS, tab: 'journee' });
      const posts = appels.filter((a) => a.m === 'POST');
      const ids = posts.map((a) => a.corps && a.corps.id).sort();
      dit(appels.some((a) => a.liste) && ids.join(',') === EMAILS.map((e) => e.id).sort().join(','),
        'les deux emails à lui sont rejoués, un par un', ids.join(', ') || 'aucun');
      dit(posts.length > 0 && posts.every((a) => a.corps && a.corps.silencieux === true && a.auth === 'Bearer jeton-de-banc'),
        'en silence (aucune notification pour un rattrapage), avec la session', JSON.stringify(posts.map((a) => [a.corps && a.corps.silencieux, a.auth])));
      dit(lecturesRls.length === 0, 'et pas une lecture de la quarantaine sous RLS', lecturesRls.join(' · '));
      await ctx.close();
    });
    await essaie('rattrapage, route muette', async () => {
      const { ctx, appels } = await ouvrir(nav, { liste: 'panne', tab: 'journee' });
      dit(appels.some((a) => a.liste) && !appels.some((a) => a.m === 'POST'), 'route muette : rien n’est rejoué (rien lu ne vaut pas « tout rattraper »)',
        JSON.stringify(appels.map((a) => a.m)));
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ emails mis de côté : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ emails mis de côté : ${ok} contrôles — lus par la route, trois états`);
  process.exit(ko ? 1 : 0);
})();
