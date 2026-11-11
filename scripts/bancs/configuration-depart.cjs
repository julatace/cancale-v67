// ════════════════════════════════════════════════════════════════════════════
//  BANC — MA CONFIGURATION (9 nov.) : plein écran au premier lancement, rejouable,
//  et Comptabilité adaptée au statut. Base INVENTÉE (aucune fixture, aucune donnée
//  réelle), servie par _minipgrest ; /api/compte?mode=abonnement dit « pas le
//  propriétaire » (vendeur neuf) ou « propriétaire » (installé).
//  C1  vendeur NEUF : la configuration s'ouvre seule, en PLEIN ÉCRAN (elle couvre la
//      fenêtre), titre centré, barre de progression, cartes ≥ 44 px, pas de « Retour »
//      à la 1re étape ; chaque étape écrit SA clé dans `main` (je vends, plateformes,
//      statut micro achat-revente, rythme + versement libératoire + ACRE ⇒ taux 13,4 %,
//      « je numérote », fin de description + titre ⇒ `vrm_numero_ecrit` { actif, ou },
//      affichage, notifications ⇒ la ligne `push_prefs` fusionnée), le récap,
//      « C'est parti » ⇒ `vrm_configuration` fait, la feuille se ferme ;
//  C2  « Plus tard » à la 3e étape : ce qui est choisi est GARDÉ, la configuration se
//      ferme, Ma journée propose « Reprendre », qui la rouvre avec le choix coché ;
//  C3  vendeur INSTALLÉ (propriétaire) : rien ne s'ouvre seul ; Réglages → « Ma
//      configuration » la rouvre, ses choix pré-sélectionnés ; passer toutes les
//      étapes sans rien changer N'ÉCRIT RIEN d'autre que `vrm_configuration` (statut,
//      taux posé à la main 13,5 %, numéros, réglage du N° : intacts) ;
//  C4  statut ⇒ Comptabilité : particulier (aucune URSSAF), société TVA franchise
//      (livre et export DEVANT, TVA dite), « je ne sais pas » (aide neutre + sources),
//      micro prestations (taux 21,3 %, activité dite).
//  Chaque fois : aucune erreur JS, rien ne déborde. `SHOTS=dossier` range les captures
//  (à REGARDER, §6.2). `LARGEURS=390,1512` / `THEMES=clair,sombre` restreignent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10127;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SCENARIOS = liste('SCENARIOS', 'C1,C2,C3,C4');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000cf';
const SESSION = { access_token: 'jeton-configuration', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse.config@exemple.test', totp: [] } };

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { W, sombre, base, tab = 'journee', proprio = false }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], ecritures: [] };
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
          journal.ecritures.push(r.id);
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
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: proprio, acces: true }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom, plein = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.waitForTimeout(450);   // le fondu d'entrée de l'étape (0,32 s) est fini
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein });
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const ligneMain = (base) => (base.lignes.find((l) => l.id === 'main') || {}).data || {};
const ligne = (base, id) => (base.lignes.find((l) => l.id === id) || {}).data;
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(200); } return false; };
const etat = (pg) => pg.evaluate(() => {
  const c = document.querySelector('[data-configuration]');
  if (!c) return null;
  const b = c.getBoundingClientRect();
  const t = c.querySelector('.vrm-cfg-titre'); const tb = t ? t.getBoundingClientRect() : null;
  const cartes = [...c.querySelectorAll('[data-configuration-choix]')].map((e) => ({ cle: e.getAttribute('data-configuration-choix'), h: e.getBoundingClientRect().height, coche: e.getAttribute('data-choisi') === '1' }));
  const retour = c.querySelector('[data-configuration-retour]');
  return {
    etape: c.getAttribute('data-configuration'), n: c.getAttribute('data-configuration-etape'), sur: c.getAttribute('data-configuration-sur'),
    plein: Math.abs(b.width - innerWidth) < 2 && Math.abs(b.height - innerHeight) < 2 && b.top === 0,
    centre: tb ? Math.abs((tb.left + tb.width / 2) - innerWidth / 2) < 40 && getComputedStyle(t).textAlign === 'center' : false,
    segments: c.querySelectorAll('.vrm-cfg-barre > span').length,
    cartes, retourVisible: !!retour && getComputedStyle(retour).visibility !== 'hidden',
    suivant: (c.querySelector('[data-configuration-suivant]') || {}).textContent || '',
    taux: (c.querySelector('[data-configuration-taux]') || { getAttribute: () => null }).getAttribute('data-configuration-taux'),
    recap: Object.fromEntries([...c.querySelectorAll('[data-configuration-recap]')].map((e) => [e.getAttribute('data-configuration-recap'), (e.querySelector('.vrm-cfg-recap-v') || {}).textContent])),
    notifs: (c.querySelector('[data-configuration-notifs]') || { getAttribute: () => null }).getAttribute('data-configuration-notifs'),
  };
});
async function choisir(pg, cle) { await pg.click(`[data-configuration-choix="${cle}"]`); }
async function continuer(pg) {
  const avant = await etat(pg);
  await pg.click('[data-configuration-suivant]');
  await attendre(pg, async () => { const e = await etat(pg); return !e || e.etape !== avant.etape; }, 6000);
  return etat(pg);
}

const MAIN = (extra) => ({ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, ...extra } });

// ── C1 : vendeur neuf, de bout en bout ───────────────────────────────────────
async function neuf(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[C1 neuf ${W}px ${theme}]`;
  const base = { lignes: [MAIN({}), { id: 'push_prefs', owner: UID, data: { calme: { actif: true, debut: '22:00', fin: '08:00', sauf: [] } } }], comptes: [] };
  const o = await ouvrir(nav, { W, sombre, base, proprio: false });
  await o.pg.waitForSelector('[data-configuration]', { timeout: 15000 }).catch(() => {});
  let e = await etat(o.pg);
  dit(!!e && e.etape === 'vends', `${T} la configuration s'ouvre seule au premier lancement`, JSON.stringify(e));
  if (!e) { dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ ')); await o.ctx.close(); return; }
  dit(e.plein, `${T} plein écran : elle couvre toute la fenêtre`);
  dit(e.centre, `${T} le titre est au milieu`);
  dit(e.segments === 7 && e.n === '1' && e.sur === '7', `${T} barre de progression (7 étapes sans statut), 1 sur 7`, JSON.stringify(e));
  dit(!e.retourVisible, `${T} pas de « Retour » à la 1re étape`);
  dit(e.cartes.length === 19 && e.cartes.every((c) => c.h >= 44 && !c.coche), `${T} des tuiles à toucher (≥ 44 px, 19 propositions : Lunettes depuis le 11 nov.), rien de coché d'avance`, JSON.stringify(e.cartes));
  dit(/Passer/.test(e.suivant), `${T} sans réponse, le bouton dit « Passer cette étape »`, e.suivant);
  await capture(o.pg, `cfg-${W}-${theme}-1-vends`);
  await choisir(o.pg, 'vends:autre');
  e = await continuer(o.pg);
  dit(e && e.etape === 'plateformes' && e.retourVisible, `${T} étape 2 : les plateformes, « Retour » apparaît`, JSON.stringify(e));
  dit(await attendre(o.pg, async () => (ligneMain(base).vrm_je_vends || {}).choix === 'autre'), `${T} « Autre chose » écrit vrm_je_vends`, JSON.stringify(ligneMain(base).vrm_je_vends));
  dit(e && e.cartes.find((c) => c.cle === 'plateforme:vinted').coche && !e.cartes.find((c) => c.cle === 'plateforme:leboncoin').coche, `${T} plateformes : Vinted (défaut) coché, rien d'autre`, JSON.stringify(e && e.cartes));
  await capture(o.pg, `cfg-${W}-${theme}-2-plateformes`);
  await choisir(o.pg, 'plateforme:leboncoin');
  e = await continuer(o.pg);
  dit(await attendre(o.pg, async () => ((ligneMain(base).vrm_plateformes_affichees || {}).sites || []).join() === 'vinted,leboncoin'), `${T} plateformes écrites (Vinted, Leboncoin)`, JSON.stringify(ligneMain(base).vrm_plateformes_affichees));
  dit(e && e.etape === 'statut' && e.cartes.length === 5 && e.cartes.every((c) => !c.coche), `${T} étape 3 : le statut, 5 cartes, aucune cochée (jamais deviné)`, JSON.stringify(e));
  await choisir(o.pg, 'statut:inconnu');
  const aide = await o.pg.$('[data-configuration-aide] a[href^="https://"]');
  dit(!!aide, `${T} « Je ne sais pas encore » montre l'aide neutre et les pages officielles`);
  await capture(o.pg, `cfg-${W}-${theme}-3-statut-inconnu`, true);
  await choisir(o.pg, 'statut:micro-vente');
  e = await etat(o.pg);
  dit(e && e.segments === 8, `${T} micro ⇒ une étape de plus (8)`, JSON.stringify(e && e.segments));
  e = await continuer(o.pg);
  dit(await attendre(o.pg, async () => ligneMain(base).vinted_regime === 'micro'), `${T} statut micro-entreprise écrit (vinted_regime)`, JSON.stringify(ligneMain(base).vinted_regime));
  dit(e && e.etape === 'micro', `${T} étape micro : rythme, versement libératoire, ACRE`, JSON.stringify(e));
  await choisir(o.pg, 'rythme:mensuel'); await choisir(o.pg, 'liberatoire:oui'); await choisir(o.pg, 'acre:non');
  e = await etat(o.pg);
  dit(e && e.taux === '13.4', `${T} le taux se compose sous ses yeux : 13,4 %`, JSON.stringify(e && e.taux));
  await capture(o.pg, `cfg-${W}-${theme}-4-micro`, true);
  e = await continuer(o.pg);
  dit(await attendre(o.pg, async () => { const d = ligneMain(base); return d.vinted_urssaf_freq === 'mensuel' && Number(d.vinted_urssaf_taux) === 13.4 && d.vrm_micro_options && d.vrm_micro_options.liberatoire === 'oui' && d.vrm_micro_options.activite === 'vente'; }), `${T} rythme, taux 13,4 % et options rangés dans les clés de Comptabilité`, JSON.stringify(ligneMain(base)));
  dit(e && e.etape === 'numero' && e.cartes.length === 2 && e.cartes.every((c) => !c.coche), `${T} étape « Où est ton numéro ? » : VRM numérote / je numérote, rien de coché`, JSON.stringify(e));
  await choisir(o.pg, 'numero:moi');
  e = await etat(o.pg);
  dit(e && e.cartes.filter((c) => c.cle.startsWith('ou:')).length === 3 && e.cartes.filter((c) => c.cle.startsWith('ou:')).every((c) => c.coche), `${T} « je numérote » ⇒ où : fin de description, titre, référence — tous cochés (le défaut de numeroEcrit)`, JSON.stringify(e && e.cartes));
  await choisir(o.pg, 'ou:ref');
  await capture(o.pg, `cfg-${W}-${theme}-4b-numero`, true);
  e = await continuer(o.pg);
  dit(await attendre(o.pg, async () => { const d = ligneMain(base).vrm_numero_ecrit; return d && d.actif === true && (d.ou || []).join() === 'description,titre'; }), `${T} « fin de description + titre » ⇒ vrm_numero_ecrit { actif, ou } (le réglage de numeroEcrit)`, JSON.stringify(ligneMain(base).vrm_numero_ecrit));
  dit(!('vrm_methode_numero' in ligneMain(base)), `${T} aucune clé à part pour la méthode`);
  dit(e && e.etape === 'affichage', `${T} étape affichage`, JSON.stringify(e));
  // (11 nov., lot DJ2) Un toucher sur la carte choisit ET passe à la suite (plus de « Continuer »).
  await choisir(o.pg, 'affichage:simple');
  await attendre(o.pg, async () => { const x = await etat(o.pg); return x && x.etape !== 'affichage'; }, 6000);
  e = await etat(o.pg);
  dit(e && e.etape === 'notifs', `${T} un toucher sur « Simple » passe seul à l’étape suivante`, JSON.stringify(e && e.etape));
  dit(await attendre(o.pg, async () => (ligneMain(base).vrm_affichage || {}).choix === 'simple'), `${T} affichage Simple écrit`);
  await attendre(o.pg, async () => { const x = await etat(o.pg); return x && x.cartes.some((c) => c.cle.startsWith('notif:')); }, 5000);
  e = await etat(o.pg);
  dit(e && e.etape === 'notifs' && e.cartes.filter((c) => c.cle.startsWith('notif:')).length === 9 && e.cartes.every((c) => c.coche), `${T} notifications : les 9 familles lues, toutes allumées`, JSON.stringify(e));
  await choisir(o.pg, 'notif:offres');
  await capture(o.pg, `cfg-${W}-${theme}-5-notifs`, true);
  e = await continuer(o.pg);
  dit(await attendre(o.pg, async () => { const p = ligne(base, 'push_prefs'); return p && p.familles && p.familles.offres === false && p.calme && p.calme.actif === true; }), `${T} « Offres » coupées dans la ligne push_prefs, heures calmes gardées`, JSON.stringify(ligne(base, 'push_prefs')));
  dit(e && e.etape === 'recap' && /Autre chose/.test(e.recap.vends || '') && /Leboncoin/.test(e.recap.plateformes || '') && /13,4/.test(e.recap.micro || '') && /description, titre/.test(e.recap.numero || '') && /8 sur 9/.test(e.recap.notifs || ''), `${T} le récap redit chaque choix`, JSON.stringify(e && e.recap));
  await capture(o.pg, `cfg-${W}-${theme}-6-recap`, true);
  dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
  await o.pg.click('[data-configuration-fin]');
  dit(await attendre(o.pg, async () => !(await o.pg.$('[data-configuration]'))), `${T} « C'est parti » ferme la configuration`);
  dit(await attendre(o.pg, async () => (ligneMain(base).vrm_configuration || {}).etat === 'fait'), `${T} vrm_configuration = fait`, JSON.stringify(ligneMain(base).vrm_configuration));
  await o.pg.waitForTimeout(600);
  dit(!(await o.pg.$('[data-reprendre-configuration]')), `${T} faite : Ma journée ne la redemande pas`);
  await capture(o.pg, `cfg-${W}-${theme}-7-apres`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

// ── C2 : « Plus tard » garde ce qui est choisi, « Reprendre » ───────────────
async function plusTard(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[C2 plus tard ${W}px ${theme}]`;
  const base = { lignes: [MAIN({})], comptes: [] };
  const o = await ouvrir(nav, { W, sombre, base, proprio: false });
  await o.pg.waitForSelector('[data-configuration]', { timeout: 15000 }).catch(() => {});
  if (!(await etat(o.pg))) { dit(false, `${T} la configuration s'ouvre`); await o.ctx.close(); return; }
  await choisir(o.pg, 'vends:sneakers');
  await continuer(o.pg);
  await continuer(o.pg);
  await choisir(o.pg, 'statut:particulier');
  await o.pg.click('[data-configuration-plus-tard]');
  dit(await attendre(o.pg, async () => !(await o.pg.$('[data-configuration]'))), `${T} « Plus tard » ferme la configuration`);
  dit(await attendre(o.pg, async () => { const d = ligneMain(base); return (d.vrm_je_vends || {}).choix === 'sneakers' && d.vinted_regime === 'particulier' && (d.vrm_configuration || {}).etat === 'plusTard'; }), `${T} ce qui était choisi est gardé (sneakers, particulier), « plus tard » retenu`, JSON.stringify(ligneMain(base)));
  await o.pg.waitForSelector('[data-reprendre-configuration="plustard"]', { timeout: 8000 }).catch(() => {});
  const rep = await o.pg.$('[data-reprendre-configuration="plustard"] [data-configuration-ouvrir]');
  dit(!!rep, `${T} Ma journée propose « Reprendre »`);
  await capture(o.pg, `cfg-${W}-${theme}-8-reprendre`);
  if (rep) {
    await rep.click();
    await o.pg.waitForSelector('[data-configuration]', { timeout: 6000 }).catch(() => {});
    const e = await etat(o.pg);
    dit(e && e.cartes.find((c) => c.cle === 'vends:sneakers').coche, `${T} rouverte : « Des sneakers » est coché`, JSON.stringify(e && e.cartes));
  }
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

// ── C3 : vendeur installé, rejouer sans rien écraser ─────────────────────────
async function installe(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[C3 installé ${W}px ${theme}]`;
  const NUMS = { 51000: { numero: '1' }, 51001: { numero: '2' } };
  const avant = { vinted_regime: 'micro', vinted_urssaf_taux: 13.5, vinted_urssaf_freq: 'trimestriel', vrm_micro_options: { liberatoire: 'non', acre: false, at: 1 },
    vrm_plateformes_affichees: { sites: ['vinted', 'ebay'], at: iso(3) }, vrm_numero_ecrit: { actif: true, depuis: '2026-11-07T08:00:00.000Z' }, vrm_affichage: { choix: 'complet', at: iso(2) }, vinted_annonce_numeros: NUMS };
  const base = { lignes: [MAIN(JSON.parse(JSON.stringify(avant))), { id: 'push_prefs', owner: UID, data: { familles: { offres: false } } }], comptes: [{ id: 1, vinted_user_id: '9001', login: 'compte_banc', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(3) }] };
  const o = await ouvrir(nav, { W, sombre, base, proprio: true, tab: 'settings' });
  await o.pg.waitForTimeout(3500);
  dit(!(await o.pg.$('[data-configuration]')), `${T} rien ne s'ouvre seul chez un vendeur installé`);
  await o.pg.waitForSelector('[data-reglage-configuration]', { timeout: 10000 }).catch(() => {});
  const b = await o.pg.$('[data-reglage-configuration]');
  dit(!!b, `${T} Réglages → « Ma configuration »`);
  if (b) { await b.scrollIntoViewIfNeeded().catch(() => {}); await b.click(); }
  else await o.pg.evaluate(() => window.dispatchEvent(new Event('vrm:configuration')));
  await o.pg.waitForSelector('[data-configuration]', { timeout: 6000 }).catch(() => {});
  let e = await etat(o.pg);
  const ecrituresAvant = o.journal.ecritures.length;
  const etapes = [];
  for (let i = 0; i < 12 && e && e.etape !== 'recap'; i++) {
    etapes.push(e);
    if (e.etape === 'notifs') await attendre(o.pg, async () => { const x = await etat(o.pg); return x && (x.cartes.some((c) => c.cle.startsWith('notif:')) || x.notifs === 'passu'); }, 5000);
    e = await continuer(o.pg);
  }
  const de = (k) => etapes.find((x) => x.etape === k) || { cartes: [] };
  const coche = (k, c) => !!(de(k).cartes.find((x) => x.cle === c) || {}).coche;
  dit(coche('plateformes', 'plateforme:ebay') && coche('plateformes', 'plateforme:vinted') && !coche('plateformes', 'plateforme:leboncoin'), `${T} pré-sélection : ses plateformes`, JSON.stringify(de('plateformes').cartes));
  dit(coche('statut', 'statut:micro-vente') && coche('micro', 'rythme:trimestriel') && coche('micro', 'liberatoire:non') && coche('micro', 'acre:non'), `${T} pré-sélection : son statut et ses options URSSAF`, JSON.stringify([de('statut').cartes, de('micro').cartes]));
  dit(coche('affichage', 'affichage:complet') && coche('numero', 'numero:moi') && ['description', 'titre', 'ref'].every((k) => coche('numero', 'ou:' + k)), `${T} pré-sélection : affichage ; « je numérote », à tous ses endroits (le défaut du réglage)`, JSON.stringify(de('numero').cartes));
  dit(de('vends').cartes.every((c) => !c.coche), `${T} « Je vends » jamais choisi ⇒ rien de coché`);
  await capture(o.pg, `cfg-${W}-${theme}-9-installe-recap`, true);
  if (e && e.etape === 'recap') await o.pg.click('[data-configuration-fin]');
  await attendre(o.pg, async () => (ligneMain(base).vrm_configuration || {}).etat === 'fait');
  await o.pg.waitForTimeout(1500);
  const d = ligneMain(base);
  const memes = ['vinted_regime', 'vinted_urssaf_taux', 'vinted_urssaf_freq', 'vrm_micro_options', 'vrm_plateformes_affichees', 'vrm_numero_ecrit', 'vrm_affichage', 'vinted_annonce_numeros'].filter((k) => JSON.stringify(d[k]) !== JSON.stringify(avant[k]));
  dit(!memes.length && (d.vrm_configuration || {}).etat === 'fait', `${T} tout passé sans rien changer : rien n'est écrasé (taux manuel 13,5 %, numéros, réglages intacts)`, JSON.stringify(memes.map((k) => [k, d[k]])));
  dit(!o.journal.ecritures.slice(ecrituresAvant).includes('push_prefs'), `${T} notifications inchangées : la ligne push_prefs n'est pas réécrite`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

// ── C4 : le statut adapte Comptabilité ───────────────────────────────────────
async function compta(nav, W, theme) {
  const sombre = theme === 'sombre';
  const cas = [
    ['particulier', { vinted_regime: 'particulier' }],
    ['societe', { vinted_regime: 'societe', vrm_societe_tva: { choix: 'franchise', at: iso(1) } }],
    ['inconnu', { vinted_regime: null, vrm_configuration: { etat: 'plusTard', at: iso(1), statut: 'inconnu', version: 1 } }],
    ['micro-services', { vinted_regime: 'micro', vrm_micro_options: { liberatoire: 'non', acre: false, activite: 'services', at: 1 }, vinted_urssaf_taux: 21.3, vinted_urssaf_freq: 'mensuel' }],
  ];
  for (const [nom, extra] of cas) {
    const T = `[C4 ${nom} ${W}px ${theme}]`;
    const base = { lignes: [MAIN({ vrm_plateformes_affichees: { sites: ['vinted'], at: iso(3) }, vrm_configuration: { etat: 'fait', at: iso(1), statut: null, version: 1 }, ...extra })], comptes: [] };
    const o = await ouvrir(nav, { W, sombre, base, proprio: false, tab: 'compta' });
    await o.pg.waitForSelector('[data-compta-q="declarer"]', { timeout: 15000 }).catch(() => {});
    await o.pg.waitForTimeout(2500);
    const v = await o.pg.evaluate(() => ({
      carte: (document.querySelector('[data-statut-carte]') || { getAttribute: () => null }).getAttribute('data-statut-carte'),
      micro: !!document.querySelector('[data-micro-profil]'),
      exportDevant: !!document.querySelector('[data-compta-export-devant] [data-export-comptable]'),
      exportsTotal: document.querySelectorAll('[data-export-comptable]').length,
      tva: (document.querySelector('[data-profil-tva]') || { getAttribute: () => null }).getAttribute('data-profil-tva'),
      aide: !!document.querySelector('[data-statut-aide] a[href^="https://"]'),
      activite: (document.querySelector('[data-micro-activite]') || { getAttribute: () => null }).getAttribute('data-micro-activite'),
      taux: (document.querySelector('[data-statut-taux]') || { getAttribute: () => null }).getAttribute('data-statut-taux'),
    }));
    if (nom === 'particulier') dit(v.carte === 'particulier' && !v.micro && !v.exportDevant, `${T} particulier : aucune URSSAF, la phrase DAC7`, JSON.stringify(v));
    if (nom === 'societe') dit(v.carte === 'societe' && !v.micro && v.exportDevant && v.exportsTotal === 1 && v.tva === 'franchise', `${T} société : export et livre DEVANT (une seule fois), TVA dite, aucune URSSAF`, JSON.stringify(v));
    if (nom === 'inconnu') dit(v.carte === 'question' && v.aide && !v.micro, `${T} « je ne sais pas » : la question, l'aide neutre et les sources, rien calculé`, JSON.stringify(v));
    if (nom === 'micro-services') dit(v.micro && v.activite === 'services' && v.taux === '21.3', `${T} micro prestations : SON taux (21,3 %) et SON activité`, JSON.stringify(v));
    await o.pg.evaluate(() => { const e = document.querySelector('[data-compta-q="declarer"]'); if (e) e.scrollIntoView({ block: 'start' }); });
    await capture(o.pg, `cfg-${W}-${theme}-compta-${nom}`);
    dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      if (SCENARIOS.includes('C1')) await neuf(nav, W, theme);
      if (SCENARIOS.includes('C2')) await plusTard(nav, W, theme);
      if (SCENARIOS.includes('C3')) await installe(nav, W, theme);
      if (SCENARIOS.includes('C4')) await compta(nav, W, theme);
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ configuration de départ : ${ko} défaut(s)` : '\n✅ configuration de départ : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
