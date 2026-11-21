// ════════════════════════════════════════════════════════════════════════════
//  BANC — Ma facture et Ma configuration (9 nov., soir, claude/config-facture)
//  Base INVENTÉE (aucune donnée réelle) servie par _minipgrest ; le registre des
//  entreprises est une réponse FABRIQUÉE de la forme documentée de l'API
//  recherche-entreprises (results[].siren, nature_juridique, siege, tva…), passée par
//  la VRAIE règle du serveur (api/_lib/entreprise.js, `lireReponseEntreprise`).
//  F1  Ma facture : un SIRET valide ⇒ « Recherche de l'entreprise… » PENDANT la
//      requête (tenue, jamais un délai), puis « Vérifie ces informations » ; RIEN
//      n'est écrit avant « C'est bon » ; le nom qu'il a déjà écrit n'est pas écrasé
//      (l'écart est montré, « Garder la mienne » le garde) ; « C'est bon » sur
//      l'adresse l'écrit, elle seule ;
//  F2  SIRET faux (clé de Luhn) ⇒ refusé, AUCUNE requête au registre ;
//  F3  registre KO (503) ⇒ dit, « Réessayer », rien écrit ;
//  C1  Ma configuration : « Qu'est-ce que tu vends ? » = 18 tuiles à choix multiple ;
//      Sneakers seules ⇒ « paire » ; + Livres ⇒ « article » ; écrit vrm_je_vends ;
//  C2  statut « micro » ⇒ le champ SIRET, la même recherche ; le registre dit SAS ⇒
//      « Société » PROPOSÉ (pas coché avant « C'est bon ») ; rien n'est écrit dans la
//      fiche avant « Tout est bon » ; après, la fiche porte SIRET, nom, forme… ;
//  C3  « Où est ton numéro ? » sans « carton » comme définition ; l'affichage : un
//      titre qui dit l'enjeu, des puces concrètes, le chemin Réglages → Affichage.
//  Chaque fois : aucune erreur JS, rien ne déborde, cibles ≥ 44 px au téléphone.
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2). `LARGEURS`, `THEMES`.
//  Lancer : npm run build && BANC_PORT=10129 node scripts/bancs/config-facture.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10129;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const COMBOS = liste('COMBOS', '390:sombre,1512:clair').map((c) => { const [w, t] = c.split(':'); return [Number(w), t]; });
const SCENARIOS = liste('SCENARIOS', 'F,C');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000cf';
const SESSION = { access_token: 'jeton-config-facture', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse.facture@exemple.test', totp: [] } };

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

// ── Le registre FABRIQUÉ ──
const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = ['812345670', '812345671', '812345672', '812345673', '812345674', '812345675', '812345676', '812345677', '812345678', '812345679'].find(luhn);
const SIRET = (() => { for (let k = 10; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
const FAUX = SIRET.slice(0, 13) + String((Number(SIRET[13]) + 1) % 10);
const TVA = `FR${String((12n + 3n * (BigInt(SIREN) % 97n)) % 97n).padStart(2, '0')}${SIREN}`;
const siege = { siret: SIRET, adresse: '12 RUE DE L’EXEMPLE 35000 RENNES', code_postal: '35000', libelle_commune: 'RENNES', etat_administratif: 'A', activite_principale_registre_metier: null, est_siege: true };
const REPONSE_API = { results: [{ siren: SIREN, nom_complet: 'ATELIER EXEMPLE', nom_raison_sociale: 'ATELIER EXEMPLE', nature_juridique: '5710', etat_administratif: 'A', siege, matching_etablissements: [siege], complements: { est_entrepreneur_individuel: false }, tva: [TVA] }], total_results: 1, page: 1, per_page: 5, total_pages: 1 };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { W, sombre, base, tab = 'journee', registre }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], ecritures: [], registre: [] };
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
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (m === 'POST' || m === 'PATCH') {
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) {
          if (!r || !r.id) continue;
          journal.ecritures.push({ id: r.id, data: r.data });
          const i = base.lignes.findIndex((x) => x.id === r.id); const l = { id: r.id, owner: UID, updated_at: iso(0), data: r.data };
          if (i >= 0) base.lignes[i] = l; else base.lignes.push(l);
        }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main' }] : [], m === 'POST' ? 201 : 200);
    }
    if (m === 'DELETE') return json([]);
    const lignes = base.lignes.map((l) => ({ owner: UID, updated_at: iso(0), ...l }));
    const r = servir(lignes, u, req.headers());
    return json(r.body, 200, r.range);
  });
  const S = await import(path.join(__dirname, '..', '..', 'api', '_lib', 'entreprise.js'));
  await pg.route('**/api/**', async (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: false, acces: true }) });
    if (/mode=entreprise/.test(u)) {
      const siret = new URL(u).searchParams.get('siret');
      journal.registre.push(siret);
      // La VRAIE route du serveur, sur la réponse fabriquée (ou une panne).
      if (registre && registre.tenir) await registre.tenir;
      const rep = await S.routeEntreprise(siret, async () => (registre && registre.panne ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => REPONSE_API }));
      return r.fulfill({ status: rep.status, contentType: 'application/json', body: JSON.stringify(rep.body) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom, plein = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.waitForTimeout(450);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein });
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const petites = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map((e) => `${Math.round(e.getBoundingClientRect().height)}px « ${(e.innerText || '').trim().slice(0, 20)} »`), sel);
const ligneMain = (base) => (base.lignes.find((l) => l.id === 'main') || {}).data || {};
const ligne = (base, id) => (base.lignes.find((l) => l.id === id) || {}).data;
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(150); } return false; };
const MAIN = (extra) => ({ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_plateformes_affichees: { sites: ['vinted'], at: iso(3) }, vrm_configuration: { etat: 'fait', at: iso(1), statut: null, version: 1 }, ...extra } });

// ── F : Ma facture ──
async function maFacture(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[F ${W}px ${theme}]`;
  const FICHE = { nom: 'Mon Atelier', forme: '', siret: '', adresse: '', codePostal: '', ville: '', prefixe: 'FA', envoiPar: 'vrm' };
  const base = { lignes: [MAIN({}), { id: 'vrm_pro_facture', owner: UID, data: { ...FICHE } }], comptes: [] };
  let lacher; const registre = { tenir: new Promise((ok) => { lacher = ok; }) };
  const o = await ouvrir(nav, { W, sombre, base, tab: 'invoices', registre });
  const btn = o.pg.getByRole('button', { name: 'Ma facture' }).first();
  await btn.waitFor({ timeout: 20000 }).catch(() => {});
  await o.pg.waitForTimeout(800);                                 // (11 nov.) l'écran finit de se poser avant le clic
  await btn.click();
  const champ = o.pg.locator('[data-fp-champ="siret"] input');
  await champ.waitFor({ timeout: 10000 });
  // F2 d'abord : un SIRET faux (Luhn) ⇒ refusé, aucune requête.
  await champ.fill(FAUX);
  await o.pg.waitForTimeout(400);
  const inv = await o.pg.$('[data-fp-registre][data-ent-recherche="invalide"]');
  dit(!!inv && o.journal.registre.length === 0, `${T} F2 SIRET faux (clé de Luhn) ⇒ « ne semble pas valide », AUCUNE requête au registre`, `${!!inv} · ${o.journal.registre.join(',')}`);
  await capture(o.pg, `cf-${W}-${theme}-F2-siret-faux`);
  // F1 : le bon SIRET ⇒ la recherche, TENUE — (11 nov., lot DJ1) à la VALIDATION (Entrée).
  await champ.fill(SIRET);
  await o.pg.waitForTimeout(300);
  dit(o.journal.registre.length === 0 && !!(await o.pg.$('[data-fp-registre][data-ent-recherche="pret"]')), `${T} F1 (11 nov.) taper le SIRET ne cherche rien : « Rechercher » attend sa validation`, o.journal.registre.join(','));
  await champ.press('Enter');
  const vuEncours = await attendre(o.pg, async () => !!(await o.pg.$('[data-fp-registre][data-ent-recherche="encours"]')), 5000);
  const texteEncours = vuEncours ? await o.pg.locator('[data-fp-registre]').innerText() : '';
  dit(vuEncours && /Recherche de ton entreprise…/.test(texteEncours) && o.journal.registre.includes(SIRET), `${T} F1 SIRET validé ⇒ « Recherche de ton entreprise… » pendant la requête`, texteEncours);
  await capture(o.pg, `cf-${W}-${theme}-F1a-recherche`);
  await o.pg.waitForTimeout(900);                                 // la frappe du SIRET s'enregistre (600 ms)
  lacher();
  const trouve = await attendre(o.pg, async () => !!(await o.pg.$('[data-fp-registre][data-ent-recherche="trouve"]')), 6000);
  dit(trouve, `${T} F1 puis la carte « C’est bien toi ? »`);
  await o.pg.waitForTimeout(900);
  let f = ligne(base, 'vrm_pro_facture') || {};
  dit(f.nom === 'Mon Atelier' && !f.adresse && !f.forme && !f.ville && !f.tva, `${T} F1 RIEN n’est écrit avant « Oui, c’est moi » (seul le SIRET tapé)`, JSON.stringify(f));
  const lignes = await o.pg.$$eval('[data-ent-ligne]', (els) => els.map((e) => ({ c: e.getAttribute('data-ent-ligne'), cas: e.getAttribute('data-ent-cas'), t: e.innerText.replace(/\s+/g, ' ') })));
  const L = (c) => lignes.find((x) => x.c === c) || {};
  dit(L('nom').cas === 'ecart' && /Tu as écrit : Mon Atelier/.test(L('nom').t) && L('adresse').cas === 'vide' && L('forme').cas === 'vide' && L('tva').cas === 'vide' && !L('rcs').c, `${T} F1 chaque champ proposé ; le nom qu’il a écrit montre l’ÉCART ; aucun RCS inventé`, JSON.stringify(lignes));
  const imm = await o.pg.locator('[data-fp-registre] [data-ent-ligne="imm"]').innerText().catch(() => '');
  dit(/Kbis/.test(imm) && /RCS/.test(imm), `${T} F1 l’immatriculation : RCS + la ville du greffe à recopier du Kbis (jamais inventée)`, imm);
  await o.pg.locator('[data-fp-registre]').scrollIntoViewIfNeeded();
  await capture(o.pg, `cf-${W}-${theme}-F1b-verifie`);
  if (o.tel) { const p = await petites(o.pg, '[data-fp-registre] button'); dit(!p.length, `${T} cibles de 44 px`, p.join(' | ')); }
  // (11 nov.) La ville du greffe, recopiée de SON Kbis ⇒ « RCS Rennes <SIREN> ».
  await o.pg.fill('[data-ent-ville]', 'rennes');
  const grp = SIREN.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  const imm2 = await o.pg.locator('[data-fp-registre] [data-ent-ligne="imm"] b').innerText().catch(() => '');
  dit(imm2 === `RCS Rennes ${grp}`, `${T} F1 la ville du greffe tapée ⇒ « RCS Rennes ${grp} »`, imm2);
  await capture(o.pg, `cf-${W}-${theme}-F1c-ville-greffe`);
  await o.pg.click('[data-ent-oui]');
  dit(await attendre(o.pg, async () => (ligne(base, 'vrm_pro_facture') || {}).adresse === '12 RUE DE L’EXEMPLE'), `${T} F1 « Oui, c’est moi » écrit l’adresse (sans le code postal)`, JSON.stringify(ligne(base, 'vrm_pro_facture')));
  f = ligne(base, 'vrm_pro_facture') || {};
  dit(f.nom === 'Mon Atelier' && f.ville === 'RENNES' && f.forme === 'SAS' && f.siret === SIRET && f.rcs === `RCS Rennes ${grp}` && f.tva === TVA, `${T} F1 son nom (écart) GARDÉ par défaut ; ville, forme, RCS, TVA écrits`, JSON.stringify(f));
  dit(!!(await o.pg.$('[data-fp-registre][data-ent-recherche="rempli"]')), `${T} F1 après « Oui » : « Rempli depuis le registre », tout reste modifiable`);
  await capture(o.pg, `cf-${W}-${theme}-F1d-rempli`);
  // F4 : choisir le statut ⇒ ses mentions, dans la même carte.
  await o.pg.selectOption('[data-fp-champ="forme"] select', 'SASU');
  const carteForme = await attendre(o.pg, async () => !!(await o.pg.$('[data-ent-forme="SASU"]')), 4000);
  const tForme = carteForme ? await o.pg.locator('[data-ent-forme="SASU"]').innerText() : '';
  const capitalARemplir = !!(await o.pg.$('[data-ent-forme="SASU"] [data-ent-mention="capital"][data-ent-ok="0"] [data-ent-remplir="capital"]'));
  dit(carteForme && /Pour une SASU/.test(tForme) && capitalARemplir && !!(await o.pg.$('[data-ent-forme="SASU"] [data-ent-mention="rcs"][data-ent-ok="1"]')), `${T} F4 statut SASU ⇒ « Pour une SASU, ta facture porte : » capital à remplir, RCS en place`, tForme);
  await o.pg.locator('[data-ent-forme]').scrollIntoViewIfNeeded().catch(() => {});
  await capture(o.pg, `cf-${W}-${theme}-F4-statut`);
  if (o.tel) { const p = await petites(o.pg, '[data-ent-forme] button'); dit(!p.length, `${T} F4 cibles de 44 px`, p.join(' | ')); }
  await o.pg.click('[data-ent-remplir="capital"]');
  const focusCapital = await o.pg.evaluate(() => !!(document.activeElement && document.activeElement.closest('[data-fp-champ="capital"]')));
  dit(focusCapital, `${T} F4 « Remplir » met le doigt sur le champ « capital »`);
  await o.pg.click('[data-ent-forme-ok]');
  const valNom = await o.pg.locator('[data-fp-champ="nom"] input').inputValue();
  dit(valNom === 'Mon Atelier', `${T} F1 le champ « nom » affiché est toujours le sien`, valNom);
  dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();

  // F5 : le registre ne répond pas en 8 s ⇒ « Pas trouvé à temps », saisie à la main.
  const base5 = { lignes: [MAIN({}), { id: 'vrm_pro_facture', owner: UID, data: { ...FICHE } }], comptes: [] };
  const o5 = await ouvrir(nav, { W, sombre, base: base5, tab: 'invoices', registre: { tenir: new Promise(() => {}) } });
  await o5.pg.getByRole('button', { name: 'Ma facture' }).first().click({ timeout: 20000 }).catch(() => {});
  await o5.pg.locator('[data-fp-champ="siret"] input').fill(SIRET).catch(() => {});
  await o5.pg.click('[data-ent-lancer]').catch(() => {});
  const t0 = Date.now();
  await attendre(o5.pg, async () => !!(await o5.pg.$('[data-fp-registre][data-ent-recherche="encours"]')), 3000);
  await o5.pg.locator('[data-fp-registre]').scrollIntoViewIfNeeded().catch(() => {});
  await capture(o5.pg, `cf-${W}-${theme}-F5a-squelette`);
  const lent = await attendre(o5.pg, async () => !!(await o5.pg.$('[data-fp-registre][data-ent-recherche="lent"]')), 12000);
  const dt = Date.now() - t0;
  const t5 = lent ? await o5.pg.locator('[data-fp-registre]').innerText() : '';
  dit(lent && dt >= 7000 && dt < 11000 && /Pas trouvé à temps/.test(t5) && /à la main/.test(t5) && !!(await o5.pg.$('[data-ent-reessayer]')), `${T} F5 registre muet ⇒ arrêt à 8 s : « Pas trouvé à temps. Remplis à la main » (+ Réessayer)`, `${dt} ms · ${t5}`);
  await o5.pg.locator('[data-fp-registre]').scrollIntoViewIfNeeded().catch(() => {});
  await capture(o5.pg, `cf-${W}-${theme}-F5b-lent`);
  dit(!o5.journal.erreurs.length, `${T} F5 aucune erreur JS`, o5.journal.erreurs.join(' ¦ '));
  await o5.ctx.close();

  // F3 : le registre en panne.
  const base3 = { lignes: [MAIN({}), { id: 'vrm_pro_facture', owner: UID, data: { ...FICHE } }], comptes: [] };
  const o3 = await ouvrir(nav, { W, sombre, base: base3, tab: 'invoices', registre: { panne: true } });
  await o3.pg.getByRole('button', { name: 'Ma facture' }).first().click({ timeout: 20000 }).catch(() => {});
  await o3.pg.locator('[data-fp-champ="siret"] input').fill(SIRET).catch(() => {});
  await o3.pg.locator('[data-fp-champ="siret"] input').press('Enter').catch(() => {});
  const passu = await attendre(o3.pg, async () => !!(await o3.pg.$('[data-fp-registre][data-ent-recherche="passu"]')), 8000);
  const t3 = passu ? await o3.pg.locator('[data-fp-registre]').innerText() : '';
  dit(passu && /ne répond pas/.test(t3) && /à la main/.test(t3) && !!(await o3.pg.$('[data-ent-reessayer]')), `${T} F3 registre KO ⇒ dit, « remplis à la main », « Réessayer »`, t3);
  await o3.pg.waitForTimeout(900);
  const f3 = ligne(base3, 'vrm_pro_facture') || {};
  dit(f3.nom === 'Mon Atelier' && !f3.adresse, `${T} F3 rien d’autre n’est écrit`, JSON.stringify(f3));
  await o3.pg.locator('[data-fp-registre]').scrollIntoViewIfNeeded().catch(() => {});
  await capture(o3.pg, `cf-${W}-${theme}-F3-panne`);
  dit(!o3.journal.erreurs.length, `${T} F3 aucune erreur JS`, o3.journal.erreurs.join(' ¦ '));
  await o3.ctx.close();
}

// ── C : Ma configuration ──
const etat = (pg) => pg.evaluate(() => {
  const c = document.querySelector('[data-configuration]');
  if (!c) return null;
  return {
    etape: c.getAttribute('data-configuration'),
    titre: (c.querySelector('.vrm-cfg-titre') || {}).textContent || '', sous: (c.querySelector('.vrm-cfg-sous') || {}).textContent || '',
    texte: c.innerText,
    cartes: [...c.querySelectorAll('[data-configuration-choix]')].map((e) => ({ cle: e.getAttribute('data-configuration-choix'), h: e.getBoundingClientRect().height, coche: e.getAttribute('data-choisi') === '1' })),
    mot: (c.querySelector('[data-configuration-mot]') || { getAttribute: () => null }).getAttribute('data-configuration-mot'),
  };
});
async function continuer(pg) {
  const avant = await etat(pg);
  await pg.click('[data-configuration-suivant]');
  await attendre(pg, async () => { const e = await etat(pg); return !e || e.etape !== avant.etape; }, 6000);
  return etat(pg);
}
async function configuration(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[C ${W}px ${theme}]`;
  const base = { lignes: [{ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) } } }, { id: 'push_prefs', owner: UID, data: {} }], comptes: [] };
  let lacher; const registre = { tenir: new Promise((ok) => { lacher = ok; }) };
  const o = await ouvrir(nav, { W, sombre, base, registre });
  await o.pg.waitForSelector('[data-configuration]', { timeout: 15000 }).catch(() => {});
  let e = await etat(o.pg);
  dit(!!e && e.etape === 'vends' && /Tu vends quoi/.test(e.titre), `${T} C1 la 1re question : « Tu vends quoi ? » (11 nov., lot DJ2)`, JSON.stringify(e && e.titre));
  if (!e) { dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ ')); await o.ctx.close(); return; }
  const tuiles = e.cartes.filter((c) => c.cle.startsWith('vends:'));
  dit(tuiles.length === 19 && tuiles.every((c) => !c.coche && c.h >= 44), `${T} C1 19 tuiles (Lunettes depuis le 11 nov.) (≥ 44 px), rien de coché d’avance`, JSON.stringify(tuiles.map((c) => c.cle)));
  const icones = await o.pg.$$eval('.vrm-cfg-tuile svg.vrm-cfg-tuile-icone path', (p) => p.filter((x) => (x.getAttribute('d') || '').length > 10).length);
  dit(icones === 19, `${T} C1 chaque tuile a son icône au trait (aucun emoji)`, String(icones));
  await o.pg.click('[data-configuration-choix="vends:sneakers"]');
  e = await etat(o.pg);
  dit(e.mot === 'paire', `${T} C1 Sneakers seules ⇒ « paire »`, e.mot);
  await o.pg.click('[data-configuration-choix="vends:livres"]');
  e = await etat(o.pg);
  dit(e.mot === 'article' && e.cartes.filter((c) => c.coche).length === 2, `${T} C1 + Livres & BD ⇒ « article », deux tuiles cochées (choix multiple)`, `${e.mot} · ${e.cartes.filter((c) => c.coche).map((c) => c.cle)}`);
  await capture(o.pg, `cf-${W}-${theme}-C1-vends`, true);
  if (o.tel) { const p = await petites(o.pg, '.vrm-cfg-tuile'); dit(!p.length, `${T} C1 tuiles de 44 px au moins`, p.join(' | ')); }
  e = await continuer(o.pg);
  dit(await attendre(o.pg, async () => { const v = ligneMain(base).vrm_je_vends || {}; return v.choix === 'autre' && (v.categories || []).join() === 'sneakers,livres'; }), `${T} C1 vrm_je_vends { choix: 'autre', categories: [sneakers, livres] } (les lecteurs d’avant lisent « autre »)`, JSON.stringify(ligneMain(base).vrm_je_vends));
  e = await continuer(o.pg);                                         // plateformes (Vinted par défaut)
  dit(e && e.etape === 'statut', `${T} C2 étape statut`, e && e.etape);
  await o.pg.click('[data-configuration-choix="statut:micro-vente"]');
  await o.pg.waitForSelector('[data-configuration-siret="lu"]', { timeout: 6000 }).catch(() => {});
  const champ = o.pg.locator('[data-configuration-siret-champ]');
  dit(await champ.count() === 1, `${T} C2 micro-entreprise ⇒ le champ SIRET apparaît`);
  await champ.fill(SIRET);
  await champ.press('Enter');
  const vu = await attendre(o.pg, async () => !!(await o.pg.$('[data-configuration-registre][data-ent-recherche="encours"]')), 5000);
  dit(vu, `${T} C2 la MÊME recherche (« Recherche de ton entreprise… »)`);
  await capture(o.pg, `cf-${W}-${theme}-C2a-recherche`, true);
  lacher();
  const trouve = await attendre(o.pg, async () => !!(await o.pg.$('[data-configuration-registre][data-ent-recherche="trouve"]')), 6000);
  dit(trouve, `${T} C2 la MÊME carte « C’est bien toi ? »`);
  e = await etat(o.pg);
  dit(!!(await o.pg.$('[data-configuration-statut-propose="societe"]')) && e.cartes.find((c) => c.cle === 'statut:micro-vente').coche && !e.cartes.find((c) => c.cle === 'statut:societe').coche, `${T} C2 le registre dit SAS ⇒ « Société » PROPOSÉ, rien coché sans son geste`, JSON.stringify(e.cartes.filter((c) => c.coche)));
  dit(!ligne(base, 'vrm_pro_facture'), `${T} C2 rien n’est écrit dans la fiche avant son geste`, JSON.stringify(ligne(base, 'vrm_pro_facture')));
  await o.pg.locator('[data-configuration-registre]').scrollIntoViewIfNeeded();
  await capture(o.pg, `cf-${W}-${theme}-C2b-verifie`, true);
  await o.pg.click('[data-ent-statut-ok]');
  e = await etat(o.pg);
  dit(e.cartes.find((c) => c.cle === 'statut:societe').coche, `${T} C2 « C’est bon » ⇒ Société cochée`);
  await o.pg.click('[data-ent-oui]');
  dit(await attendre(o.pg, async () => { const f = ligne(base, 'vrm_pro_facture') || {}; return f.siret === SIRET && f.nom === 'ATELIER EXEMPLE' && f.forme === 'SAS' && f.ville === 'RENNES' && f.tva === TVA; }), `${T} C2 « Oui, c’est moi » ⇒ la fiche de facture porte SIRET, nom, forme, ville, TVA`, JSON.stringify(ligne(base, 'vrm_pro_facture')));
  if (o.tel) { const p = await petites(o.pg, '[data-configuration-registre] button, .vrm-cfg-siret button'); dit(!p.length, `${T} C2 cibles de 44 px`, p.join(' | ')); }
  e = await continuer(o.pg);
  dit(e && e.etape === 'societe' && await attendre(o.pg, async () => ligneMain(base).vinted_regime === 'societe'), `${T} C2 statut Société écrit, l’étape TVA suit`, `${e && e.etape} · ${ligneMain(base).vinted_regime}`);
  e = await continuer(o.pg);
  dit(e && e.etape === 'numero' && /numéro de rangement/.test(e.sous) && /étagère/.test(e.sous) && !/dans quel carton/.test(e.texte), `${T} C3 « Où est ton numéro ? » : le numéro de rangement (carton, étagère, bac…)`, e && e.sous);
  await capture(o.pg, `cf-${W}-${theme}-C3a-numero`, true);
  e = await continuer(o.pg);
  dit(e && e.etape === 'affichage' && !/Simple ou complet/.test(e.titre) && /Prix à baisser/.test(e.texte) && /Stock/.test(e.texte) && /Paramètres → Affichage/.test(e.texte), `${T} C3 affichage : un titre qui dit l’enjeu, ce que chaque choix cache, le chemin pour changer`, e && `${e.titre} | ${e.texte.slice(0, 300)}`);
  const reco = await o.pg.$$eval('[data-configuration-recommande]', (b) => b.length);
  dit(reco <= 1, `${T} C3 au plus une carte « Recommandé pour toi »`, String(reco));
  await capture(o.pg, `cf-${W}-${theme}-C3b-affichage`, true);
  dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const [W, theme] of COMBOS) {
      if (SCENARIOS.includes('F')) await maFacture(nav, W, theme);
      if (SCENARIOS.includes('C')) await configuration(nav, W, theme);
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ config-facture : ${ko} défaut(s)` : '\n✅ config-facture : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
