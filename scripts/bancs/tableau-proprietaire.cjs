// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE TABLEAU DU PROPRIÉTAIRE ET LA NOTE DE SATISFACTION (9 nov.)
//  Base INVENTÉE (aucune fixture, aucune donnée réelle), servie par _minipgrest ;
//  la route `/api/compte?mode=pilotage` est servie avec la FORME que rend
//  api/_lib/pilotage.js (scripts/tests/pilotage.test.mjs exécute la vraie).
//  P1  propriétaire, Stripe pas branché : Réglages porte « Ton entreprise » ; le
//      tableau rend les tuiles (inscrits, actifs, essais, abonnés…), « — » et
//      « Stripe pas branché » pour les revenus, aucune adresse e-mail à l'écran,
//      la courbe des inscrits (90 points) suit le doigt / la souris, une courbe
//      à un seul point dit depuis quand, rien ne déborde ;
//  P2  propriétaire, Stripe branché : les revenus s'écrivent en euros, les plans ;
//  P3  propriétaire : AUCUNE question de satisfaction sur Ma journée ;
//  V1  vendeur (pas propriétaire) : l'entrée n'existe pas dans Réglages ;
//  V2  vendeur, compte de 30 jours, sans abonnement payé : la question est en bas
//      de Ma journée, cinq notes de 44 px ; 4 + un mot ⇒ `vrm_satisfaction` écrit
//      (note 4, le mot) et « Merci » ; « Plus tard » ⇒ `plusTard` écrit et la
//      question part ;
//  V3  vendeur, compte de 5 jours : pas de question ;
//  V4  vendeur abonné payé vu il y a 1 jour : pas de question.
//  Chaque fois : aucune erreur JS. `SHOTS=dossier` range les captures (à REGARDER,
//  §6.2). `LARGEURS=390,1512` / `THEMES=clair,sombre` restreignent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10131;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000dd';
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();
const jour = (j) => iso(j).slice(0, 10);

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// La forme de `mode=pilotage` (api/_lib/pilotage.js).
const courbe = (n0) => Array.from({ length: 90 }, (_, k) => ({ jour: jour(89 - k), n: n0 + Math.floor(k / 9) }));
const PILOTAGE = (stripe) => ({
  ok: true, at: iso(0),
  inscrits: { total: 42, nouveaux30: 7, courbe: courbe(32) },
  actifs: { j7: 18, j30: 29 },
  essais: { enCours: 3, finis: 11, convertis: 6 },
  abonnes: { total: 9, impayes: 1, resiliationsProgrammees: 2, parPlan: stripe ? [{ plan: 'Mensuel', n: 8 }, { plan: 'Pro annuel avec un nom de plan vraiment très long', n: 1 }] : null },
  revenus: stripe ? { etat: 'ok', mensuelCentimes: 14592, devise: 'eur', abonnements: 9, ecartes: 0, avecRemise: 1, modeTest: false } : { etat: 'stripe-absent' },
  desabonnements: { n: 1, source: stripe ? 'stripe' : 'base' },
  incidents: { ouverts: [], fermes30: 2, dernier: { composant: 'emails', debut: iso(3), fin: iso(2.9), dureeMin: 40 }, sondesA: iso(0), sondesArretees: false },
  plantages: { types: 2, n: 5, tombes: 0 },
  satisfaction: { n: 6, moyenne: 4.2, repartition: [0, 1, 0, 2, 3], commentaires: [{ note: 5, mot: 'Les numéros de rangement m’ont sauvé la mise, je ne me trompe plus de carton.', jour: jour(1) }, { note: 2, mot: 'Écris-moi à …', jour: jour(4) }] },
  historique: { depuis: jour(0), actifs7: [{ jour: jour(0), n: 18 }], abonnes: [{ jour: jour(0), n: 9 }], mensuelCentimes: stripe ? [{ jour: jour(0), n: 14592 }] : [] },
  raisons: {},
});

async function ouvrir(nav, { W, sombre, base, tab, proprio, stripe = false, creeIlYa = 30, statut = null }) {
  const tel = W < 600;
  const user = { id: UID, email: 'vendeur.banc@exemple.test', created_at: iso(creeIlYa), totp: [] };
  const SESSION = { access_token: 'jeton-banc', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user };
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], ecrits: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript(([s, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (m === 'POST' || m === 'PATCH') {
      let rendu = [];
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) { if (!r || !r.id) continue; journal.ecrits.push(r); const i = base.lignes.findIndex((x) => x.id === r.id); const l = { id: r.id, owner: UID, updated_at: iso(0), data: r.data }; if (i >= 0) base.lignes[i] = l; else base.lignes.push(l); rendu.push(l); }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main' }] : rendu, m === 'POST' ? 201 : 200);
    }
    if (m === 'DELETE') return json([]);
    const lignes = base.lignes.map((l) => ({ owner: UID, updated_at: iso(0), ...l }));
    const r = servir(lignes, u, req.headers());
    return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: proprio, actif: proprio || statut === 'active', acces: true, configure: stripe, statut, finPeriode: null }) });
    if (/mode=pilotage/.test(u)) return proprio ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PILOTAGE(stripe)) }) : r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, raison: 'proprietaire' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom, plein = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein });
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(250); } return false; };
const MAIN = { id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_guide_masque: { at: iso(0) } } };
const COMPTE = [{ id: 1, vinted_user_id: '9001', login: 'compte_banc', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(30) }];
const visible = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].some((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }), sel);
const cliquerVisible = (pg, sel) => pg.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; }); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; }, sel);

async function proprietaire(nav, W, theme, stripe) {
  const sombre = theme === 'sombre', T = `[propriétaire${stripe ? ' + Stripe' : ''} ${W}px ${theme}]`;
  const base = { lignes: [MAIN], comptes: COMPTE };
  const o = await ouvrir(nav, { W, sombre, base, tab: 'settings', proprio: true, stripe });
  await attendre(o.pg, () => visible(o.pg, '[data-reglage-pilotage]'), 15000);
  dit(await visible(o.pg, '[data-reglage-pilotage]'), `${T} P1 Réglages porte « Ton entreprise »`);
  await cliquerVisible(o.pg, '[data-reglage-pilotage]');
  await attendre(o.pg, () => visible(o.pg, '[data-pilotage="lu"]'), 10000);
  const t = await o.pg.evaluate(() => {
    const p = [...document.querySelectorAll('[data-pilotage="lu"]')].find((e) => e.getBoundingClientRect().height > 0);
    if (!p) return null;
    const tuile = (k) => { const e = p.querySelector(`[data-pilotage-tuile="${k}"]`); return e ? { v: e.getAttribute('data-valeur'), txt: e.textContent } : null; };
    const c = p.querySelector('[data-pilotage-courbe="inscrits"]');
    return { inscrits: tuile('inscrits'), actifs7: tuile('actifs7'), essais: tuile('essais'), abonnes: tuile('abonnes'), revenus: tuile('revenus'), desab: tuile('desabonnements'), incidents: tuile('incidents'), plantages: tuile('plantages'),
      courbe: c ? { points: c.getAttribute('data-points'), choisi: c.getAttribute('data-choisi') } : null,
      actifsCourbe: (p.querySelector('[data-pilotage-courbe="actifs7"]') || { textContent: '' }).textContent,
      plans: p.querySelector('[data-pilotage-plans]') ? p.querySelector('[data-pilotage-plans]').getAttribute('data-pilotage-plans') : null,
      sat: p.querySelector('[data-pilotage-satisfaction]') ? p.querySelector('[data-pilotage-satisfaction]').getAttribute('data-moyenne') : null,
      coms: p.querySelectorAll('[data-pilotage-commentaires] li').length,
      arobase: /@/.test(p.textContent), texte: p.textContent.length };
  });
  dit(!!t, `${T} P1 le tableau est rendu`);
  if (t) {
    dit(t.inscrits && t.inscrits.v === '42' && /\+7 en 30 jours/.test(t.inscrits.txt), `${T} P1 inscrits : 42, +7 en 30 jours`, JSON.stringify(t.inscrits));
    dit(t.actifs7 && t.actifs7.v === '18', `${T} P1 actifs sur 7 jours : 18`, JSON.stringify(t.actifs7));
    dit(t.essais && t.essais.v === '3' && /6 devenus abonnés/.test(t.essais.txt), `${T} P1 essais en cours et convertis`, JSON.stringify(t.essais));
    dit(t.abonnes && t.abonnes.v === '9' && /1 impayé/.test(t.abonnes.txt), `${T} P1 abonnés : 9, l'impayé dit`, JSON.stringify(t.abonnes));
    if (stripe) dit(t.revenus && /145,92/.test(t.revenus.v.replace(/\s/g, ' ')) && /€/.test(t.revenus.v), `${T} P2 revenus mensuels récurrents en euros (Stripe)`, JSON.stringify(t.revenus));
    else dit(t.revenus && t.revenus.v === '' && /—/.test(t.revenus.txt) && /Stripe pas branché/.test(t.revenus.txt), `${T} P1 revenus : « — Stripe pas branché », aucun montant`, JSON.stringify(t.revenus));
    if (stripe) dit(t.plans === '2', `${T} P2 les plans sont listés`, t.plans);
    dit(t.desab && t.desab.v === '1', `${T} P1 désabonnements du mois`, JSON.stringify(t.desab));
    dit(t.incidents && t.incidents.v === '0' && /2 fermés en 30 jours/.test(t.incidents.txt), `${T} P1 incidents (statut_sondes)`, JSON.stringify(t.incidents));
    dit(t.plantages && t.plantages.v === '5', `${T} P1 plantages sur 7 jours`, JSON.stringify(t.plantages));
    dit(t.sat === '4.2' && t.coms === 2, `${T} P1 satisfaction : moyenne et mots sans identité`, JSON.stringify({ sat: t.sat, coms: t.coms }));
    dit(!t.arobase, `${T} P1 aucune adresse e-mail à l'écran`);
    dit(t.courbe && t.courbe.points === '90' && t.courbe.choisi === '89', `${T} P1 la courbe des inscrits : 90 jours, le dernier choisi`, JSON.stringify(t.courbe));
    dit(/Un point par jour depuis/.test(t.actifsCourbe), `${T} P1 une courbe à un point dit depuis quand`, t.actifsCourbe.slice(0, 160));
  }
  // Le survol / le doigt choisit un autre jour.
  const zone = await o.pg.evaluate(() => { const c = [...document.querySelectorAll('[data-pilotage-courbe="inscrits"] [role="img"]')].find((e) => e.getBoundingClientRect().height > 0); if (!c) return null; c.scrollIntoView({ block: 'center' }); const b = c.getBoundingClientRect(); return { x: b.left + b.width * 0.1, y: b.top + b.height / 2 }; });
  if (zone) {
    if (o.tel) await o.pg.touchscreen.tap(zone.x, zone.y); else await o.pg.mouse.move(zone.x, zone.y);
    await o.pg.waitForTimeout(200);
    const ch = await o.pg.evaluate(() => { const c = [...document.querySelectorAll('[data-pilotage-courbe="inscrits"]')].find((e) => e.getBoundingClientRect().height > 0); return c ? Number(c.getAttribute('data-choisi')) : null; });
    dit(ch != null && ch < 20, `${T} P1 ${o.tel ? 'le doigt' : 'la souris'} choisit un jour sur la courbe`, ch);
  } else dit(false, `${T} P1 la courbe des inscrits est là`);
  dit(!(await deborde(o.pg)), `${T} P1 rien ne déborde`);
  await o.pg.evaluate(() => { const e = [...document.querySelectorAll('[data-pilotage="lu"]')].find((x) => x.getBoundingClientRect().height > 0); if (e) e.scrollIntoView({ block: 'start' }); });
  await capture(o.pg, `tp-${W}-${theme}-${stripe ? 'stripe' : 'sans-stripe'}`, true);
  // P3 : Ma journée, pas de question au propriétaire.
  if (!stripe) {
    await o.pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForTimeout(5000);
    dit(!(await o.pg.$('[data-note-satisfaction]')), `${T} P3 aucune question de satisfaction au propriétaire`);
  }
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function vendeur(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[vendeur ${W}px ${theme}]`;
  // V1 : pas d'entrée dans Réglages.
  {
    const base = { lignes: [MAIN], comptes: COMPTE };
    const o = await ouvrir(nav, { W, sombre, base, tab: 'settings', proprio: false });
    await attendre(o.pg, () => visible(o.pg, '[data-reglage-signaler]'), 15000);
    await o.pg.waitForTimeout(1200);
    dit(await visible(o.pg, '[data-reglage-signaler]') && !(await o.pg.$('[data-reglage-pilotage]')), `${T} V1 un vendeur ne voit pas « Ton entreprise »`);
    dit(!o.journal.erreurs.length, `${T} V1 aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
  // V2 : la question, puis une réponse.
  {
    const base = { lignes: [MAIN], comptes: COMPTE };
    const o = await ouvrir(nav, { W, sombre, base, tab: 'journee', proprio: false, creeIlYa: 30 });
    await attendre(o.pg, () => visible(o.pg, '[data-note-satisfaction="question"]'), 15000);
    const q = await o.pg.evaluate(() => { const s = document.querySelector('[data-note-satisfaction="question"]'); if (!s) return null; s.scrollIntoView({ block: 'center' }); return { notes: [...s.querySelectorAll('[data-note-choix]')].map((b) => Math.round(b.getBoundingClientRect().height)), plusTard: Math.round(s.querySelector('[data-note-plus-tard]').getBoundingClientRect().height) }; });
    dit(q && q.notes.length === 5 && q.notes.every((h) => h >= 44) && q.plusTard >= 44, `${T} V2 la question est en bas de Ma journée, cinq notes de 44 px`, JSON.stringify(q));
    await capture(o.pg, `tp-${W}-${theme}-note-question`);
    if (q) {
      await o.pg.click('[data-note-choix="4"]');
      await o.pg.fill('[data-note-mot]', 'Ça me fait gagner une heure par jour');
      await capture(o.pg, `tp-${W}-${theme}-note-mot`);
      await o.pg.click('[data-note-envoyer]');
      const ok = await attendre(o.pg, async () => !!(await o.pg.$('[data-note-satisfaction="merci"]')), 6000);
      const l = (base.lignes.find((x) => x.id === 'vrm_satisfaction') || {}).data;
      dit(ok && l && l.reponse && l.reponse.note === 4 && l.reponse.mot === 'Ça me fait gagner une heure par jour', `${T} V2 4 + un mot ⇒ vrm_satisfaction écrit, « Merci »`, JSON.stringify(l));
      // Le signe de vie part 4 s après le montage : on attend l'écriture elle-même.
      await attendre(o.pg, async () => base.lignes.some((x) => x.id === 'vrm_vu'), 10000);
      const vu = (base.lignes.find((x) => x.id === 'vrm_vu') || {}).data;
      dit(vu && /^\d{4}-\d{2}-\d{2}$/.test(vu.jour) && Object.keys(vu).sort().join(',') === 'jour,v', `${T} V2 le signe de vie du jour ne porte que le jour`, JSON.stringify(vu));
    }
    dit(!(await deborde(o.pg)), `${T} V2 rien ne déborde`);
    dit(!o.journal.erreurs.length, `${T} V2 aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
  // V2 bis : « Plus tard ».
  {
    const base = { lignes: [MAIN], comptes: COMPTE };
    const o = await ouvrir(nav, { W, sombre, base, tab: 'journee', proprio: false, creeIlYa: 30 });
    await attendre(o.pg, () => visible(o.pg, '[data-note-plus-tard]'), 15000);
    await cliquerVisible(o.pg, '[data-note-plus-tard]');
    const parti = await attendre(o.pg, async () => !(await o.pg.$('[data-note-satisfaction]')), 6000);
    const l = (base.lignes.find((x) => x.id === 'vrm_satisfaction') || {}).data;
    dit(parti && l && l.plusTard && !l.reponse, `${T} V2 « Plus tard » ⇒ plusTard écrit, la question part`, JSON.stringify(l));
    await o.ctx.close();
  }
  // V3 : compte de 5 jours ; V4 : abonnement payé vu hier.
  for (const [nom, opts, lignes] of [['V3 compte de 5 jours', { creeIlYa: 5 }, []], ['V4 abonnement payé vu il y a 1 jour', { creeIlYa: 60, statut: 'active' }, [{ id: 'vrm_satisfaction', owner: UID, data: { v: 1, payeVu: iso(1) } }]]]) {
    const base = { lignes: [MAIN, ...lignes], comptes: COMPTE };
    const o = await ouvrir(nav, { W, sombre, base, tab: 'journee', proprio: false, ...opts });
    await o.pg.waitForTimeout(5000);
    dit(!(await o.pg.$('[data-note-satisfaction]')), `${T} ${nom} : pas de question`);
    dit(!o.journal.erreurs.length, `${T} ${nom} : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      await proprietaire(nav, W, theme, false);
      await proprietaire(nav, W, theme, true);
      await vendeur(nav, W, theme);
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ tableau du propriétaire : ${ko} défaut(s)` : '\n✅ tableau du propriétaire : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
