require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « AGENDA + NOUVEL APPAREIL » (10 nov., lot H) — l'app RENDUE, données
//  INVENTÉES (le jeu de `nouveau-vendeur.cjs`), 390 px tactile ET 1512 px, clair
//  ET sombre. Jugé sur des `data-*`, des requêtes et la base du banc.
//   P. Ma journée PUBLIE `vrm_agenda_envoi` : la date limite LUE du bordereau
//      (« 10 h 00 » dans l'e-mail) avec son heure, et rien d'autre (ni titre, ni compte).
//   F. Paramètres → « Échéances dans l'agenda » : lu « pas actif » ⇒ « Ajouter à
//      mon agenda » crée le lien (POST creer), puis le bouton EST le lien
//      webcal://… ; Google Agenda ; « Changer le lien » confirmé ⇒ regenerer ;
//      une lecture ratée ⇒ « Réessayer », aucun lien inventé.
//   G. À l'ouverture, l'app demande UNE fois `action:'verifier'` ; la notification
//      `?tab=settings&section=appareils&session=<id>` ouvre Appareils connectés
//      avec CETTE session en évidence (ambre) et son « Déconnecter ».
//  `SHOTS=dossier` : une capture par étape (à REGARDER). `PARTIES=P,F,G`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const NV = require('./nouveau-vendeur.cjs');
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = liste('PARTIES', 'P,F,G');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 300) : ''}`); };
const base = () => ({ lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 });
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const FEUILLE = (pg) => pg.locator('div[style*="z-index: 20000"]');
const JETON = 'Ab3_' + 'x'.repeat(39), JETON2 = 'Zz9-' + 'y'.repeat(39);
const S_ICI = 'a1b2c3d4-0000-4000-8000-000000000001', S_NEUF = 'c3d4e5f6-0000-4000-8000-000000000003';

(async () => {
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre', tag = `${W}-${theme}`;
      // ── P. La publication des dates LUES ────────────────────────────────
      if (PARTIES.includes('P')) {
        const b = base();
        // Les achats du 2e compte lus (vides) : la lecture est COMPLÈTE (la publication n'attend que ça).
        if (!b.lignes.some((l) => l.id === 'harvest_222_orders_purchased')) b.lignes.push({ id: 'harvest_222_orders_purchased', data: { capturedAt: new Date().toISOString(), payload: { my_orders: [] } } });
        const { ctx, pg } = await NV.ouvrir(nav, { W, sombre, base: b, tab: process.env.BANC_TAB || 'journee' });
        // La publication part vers la base avec les autres clés de `main` (quelle que soit la route : écriture ou rpc).
        const envois = [];
        pg.on('request', (q) => { const d = q.postData() || ''; if (/rest\/v1\//.test(q.url()) && d.includes('vrm_agenda_envoi')) envois.push(d); });
        let pub = null;
        for (let i = 0; i < 40 && !(pub && envois.length); i++) { await attendre(500); pub = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_agenda_envoi')); } catch (_) { return null; } }); }
        dit(envois.length > 0, `P ${tag} : la publication part vers la base`, envois.length);
        const c = pub && Array.isArray(pub.colis) ? pub.colis : [];
        dit(c.length === 1 && c[0][2] === '10:00' && /^\d{4}-\d{2}-\d{2}$/.test(c[0][1]) && Number(c[0][3]) > Date.now(), `P ${tag} : Ma journée publie la date limite LUE (10 h 00 du bordereau)`, JSON.stringify(pub));
        dit(pub && !/Nike|Adidas|New Balance|Asics|Salomon|vendeuse|62000/.test(JSON.stringify(pub)), `P ${tag} : rien d'autre que N°, jour, heure (ni titre, ni compte, ni transaction)`, JSON.stringify(pub));
        await ctx.close();
      }
      // ── F. L'agenda dans Paramètres ─────────────────────────────────────
      if (PARTIES.includes('F')) {
        for (const issue of ['ok', 'panne']) {
          const { ctx, pg, tel } = await NV.ouvrir(nav, { W, sombre, base: base(), tab: 'settings' });
          const posts = []; let actif = false, jeton = JETON;
          await pg.route('**/api/compte?mode=agenda', async (r) => {
            const q = r.request();
            if (issue === 'panne') return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erreur: 'base', message: 'Réessaie dans un instant.' }) });
            if (q.method() === 'POST') { const a = JSON.parse(q.postData() || '{}').action; posts.push(a); if (a === 'regenerer') jeton = JETON2; actif = a !== 'couper'; }
            return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, actif, url: actif ? `https://vrm.center/agenda/${jeton}.ics` : '' }) });
          });
          await pg.goto(`http://localhost:${NV.PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
          await pg.click('[data-onglets-reglages] [data-vue="reglages"]').catch(() => {}); await attendre(300);
          await pg.click('[data-sous-ouvrir="agenda"]', { timeout: 8000 }).catch((e) => dit(false, `F ${tag} : la ligne « Échéances dans l’agenda » se touche`, String(e.message).split('\n')[0]));
          await pg.waitForSelector('[data-agenda]:not([data-agenda="lecture"])', { timeout: 8000 }).catch(() => {});
          if (issue === 'panne') {
            const e = await pg.evaluate(() => ({ etat: (document.querySelector('[data-agenda]') || {}).getAttribute && document.querySelector('[data-agenda]').getAttribute('data-agenda'), lien: !!document.querySelector('a[href^="webcal:"]') }));
            dit(e.etat === 'pas-su' && !e.lien, `F ${tag} : lecture ratée ⇒ « Réessayer », aucun lien inventé`, JSON.stringify(e));
            await capture(pg, `F-${tag}-panne`);
            await ctx.close(); continue;
          }
          const avant = await pg.evaluate(() => ({ etat: document.querySelector('[data-agenda]').getAttribute('data-agenda'), types: [...document.querySelectorAll('[data-agenda-type]')].map((x) => x.getAttribute('data-agenda-type')), href: (document.querySelector('[data-agenda-ajouter]') || {}).getAttribute && document.querySelector('[data-agenda-ajouter]').getAttribute('href') }));
          dit(avant.etat === 'inactif' && avant.types.join() === 'urssaf,envoi,retrait' && !avant.href, `F ${tag} : pas encore de lien ; les trois sortes d’échéances sont dites`, JSON.stringify(avant));
          await capture(pg, `F-${tag}-avant`);
          // Le téléphone confie webcal:// à son app Calendrier ; ici, le banc note le lien ouvert (aucune app ne le prend).
          await pg.evaluate(() => { window.__webcal = []; document.addEventListener('click', (e) => { const l = e.target && e.target.closest && e.target.closest('a[href^="webcal:"]'); if (l) { e.preventDefault(); window.__webcal.push(l.getAttribute('href')); } }, true); });
          await pg.click('[data-agenda-ajouter]');
          await pg.waitForSelector('[data-agenda="actif"]', { timeout: 6000 }).catch(() => {});
          const ap = await pg.evaluate(() => { const a = document.querySelector('[data-agenda-ajouter]'); const g = document.querySelector('[data-agenda-google]'); const r = a ? a.getBoundingClientRect() : null; return { href: a && a.getAttribute('href'), google: g && g.getAttribute('href'), h: r && r.height, gestes: [...document.querySelectorAll('.vrm-agenda-gestes .vrm-lien-action')].map((x) => x.getBoundingClientRect().height) }; });
          const ouverts = await pg.evaluate(() => window.__webcal);
          dit(ouverts.length === 1 && ouverts[0] === `webcal://vrm.center/agenda/${JETON}.ics`, `F ${tag} : le premier toucher ouvre DÉJÀ le lien dans l’agenda`, JSON.stringify(ouverts));
          dit(posts[0] === 'creer' && ap.href === `webcal://vrm.center/agenda/${JETON}.ics`, `F ${tag} : « Ajouter à mon agenda » crée le lien, puis le bouton EST le lien webcal://`, JSON.stringify({ posts, ap }));
          dit(ap.google && ap.google.startsWith('https://calendar.google.com/calendar/render?cid=') && ap.google.includes(encodeURIComponent(`webcal://vrm.center/agenda/${JETON}.ics`)), `F ${tag} : Google Agenda reçoit le même lien`, ap.google);
          if (tel) dit(ap.h >= 43.5 && ap.gestes.every((h) => h >= 43.5), `F ${tag} : 44 px au doigt`, JSON.stringify(ap));
          await capture(pg, `F-${tag}-actif`);
          await pg.click('[data-agenda-changer]');
          await FEUILLE(pg).getByRole('button', { name: 'Changer le lien' }).waitFor({ timeout: 5000 }).catch(() => {});
          await capture(pg, `F-${tag}-changer`);
          await FEUILLE(pg).getByRole('button', { name: 'Changer le lien' }).click({ timeout: 5000 }).catch(() => {});
          await attendre(700);
          const ch = await pg.evaluate(() => (document.querySelector('[data-agenda-ajouter]') || {}).getAttribute && document.querySelector('[data-agenda-ajouter]').getAttribute('href'));
          dit(posts.join() === 'creer,regenerer' && ch === `webcal://vrm.center/agenda/${JETON2}.ics`, `F ${tag} : « Changer le lien » confirmé ⇒ un nouveau lien`, JSON.stringify({ posts, ch }));
          await ctx.close();
        }
      }
      // ── G. Nouvel appareil ──────────────────────────────────────────────
      if (PARTIES.includes('G')) {
        const { ctx, pg } = await NV.ouvrir(nav, { W, sombre, base: base(), tab: 'journee' });
        const verifs = [], fermes = [];
        await pg.route('**/api/compte?mode=appareils', async (r) => {
          const q = r.request();
          if (q.method() === 'POST') {
            const c = JSON.parse(q.postData() || '{}');
            if (c.action === 'verifier') { verifs.push(c); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, nouveaux: 0 }) }); }
            fermes.push(c); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ferme: c.session }) });
          }
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, appareils: [
            { id: S_ICI, appareil: 'iPhone · Safari', actifLe: new Date().toISOString(), ici: true },
            { id: 'b2c3d4e5-0000-4000-8000-000000000002', appareil: 'Mac · Chrome', actifLe: new Date(Date.now() - 3 * 86400e3).toISOString(), ici: false },
            { id: S_NEUF, appareil: 'Windows · Firefox', actifLe: new Date(Date.now() - 5 * 60e3).toISOString(), ici: false },
          ] }) });
        });
        await pg.goto(`http://localhost:${NV.PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 40 && !verifs.length; i++) await attendre(500);   // la demande part après la session (machine chargée : jusqu'à 20 s)
        await pg.goto(`http://localhost:${NV.PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' }); await attendre(1500);
        dit(verifs.length === 1, `G ${tag} : l’app demande la vérification UNE fois par session du navigateur`, verifs.length);
        await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&section=appareils&session=${S_NEUF}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-appareils="3"]', { timeout: 10000 }).catch(() => {});
        await attendre(500);
        const L = await pg.evaluate(() => [...document.querySelectorAll('[data-appareil]')].map((l) => ({ nouveau: l.getAttribute('data-appareil-nouveau'), bouton: (l.querySelector('[data-appareil-fermer]') || {}).getAttribute ? l.querySelector('[data-appareil-fermer]').getAttribute('data-appareil-fermer') : null, fond: getComputedStyle(l).backgroundColor, visible: l.getBoundingClientRect().top < innerHeight && l.getBoundingClientRect().bottom > 0 })));
        const n = L.filter((x) => x.nouveau === 'oui');
        dit(L.length === 3 && n.length === 1 && n[0].bouton === S_NEUF, `G ${tag} : la notification ouvre Appareils connectés, CETTE session seule en évidence`, JSON.stringify(L));
        dit(n[0] && n[0].fond !== L[1].fond, `G ${tag} : en évidence (ambre), les autres neutres`, JSON.stringify(L.map((x) => x.fond)));
        await capture(pg, `G-${tag}-nouvel-appareil`);
        await pg.click(`[data-appareil-fermer="${S_NEUF}"]`).catch(() => {});
        await FEUILLE(pg).getByRole('button', { name: 'Déconnecter', exact: true }).click({ timeout: 5000 }).catch(() => {});
        await attendre(700);
        dit(fermes.length === 1 && fermes[0].session === S_NEUF, `G ${tag} : « Déconnecter » ferme cette session-là`, JSON.stringify(fermes));
        await ctx.close();
      }
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
