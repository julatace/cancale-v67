require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LES PLANTAGES REMONTENT » (16 nov., lot anti-bug) — la vraie app BÂTIE,
//  un vrai Chromium à 390 px tactile, et la VRAIE route du serveur.
//
//  Julien : le journal des plantages (`plantages_terrain_*`) n'a rien reçu depuis le
//  12 nov. alors qu'il voit des bugs. Mesuré en lecture seule sur sa base : un seul
//  vendeur actif (lui, le propriétaire de l'installation), dont les plantages étaient
//  JETÉS par le serveur depuis le 15 nov. ; les morceaux qui ne se chargent pas
//  n'étaient comptés que dans les temps réels ; une promesse rejetée attendait trois
//  répétitions (et une sans `Error` était perdue).
//
//  Ici, le compte est le PROPRIÉTAIRE (le cas de Julien) :
//   P1  un écran tombe sur son garde-fou (Ventes, crochet de banc) ;
//   P2  une promesse rejetée (une `Error`) et une autre rejetée avec une simple chaîne ;
//   P3  un morceau de l'app introuvable (un fichier /assets/ absent, comme après une mise en ligne) ;
//   puis la page part (`pagehide`) : le lot part par `sendBeacon` vers
//   `/api/compte?mode=mesures`, et le banc le donne à la VRAIE fonction du serveur
//   (`recevoirMesures`, api/_lib/mesures-terrain.js) contre une fausse base en mémoire.
//  Contrôles : la ligne du jour `plantages_terrain_<jour>` est écrite chez le
//  propriétaire ; l'écran tombé, la promesse (les deux) et le morceau y sont, rangés
//  « chez toi » (`proprio`), JAMAIS comme une personne touchée, jamais à notifier ;
//  rien du vendeur (identifiant, e-mail, chiffres) dans le corps envoyé ni dans la base.
//  Tout est inventé. Lancer : BANC_DIST=<dist> BANC_PORT=<port> node scripts/bancs/plantages-remontee.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
process.env.BANC_PORT = process.env.BANC_PORT || String(20000 + Math.floor(Math.random() * 20000));
const NV = require('./nouveau-vendeur.cjs');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(RACINE, 'dist');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'vrm-bancs', 'plantages-remontee');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000aa';   // le vendeur des bancs nouveau-vendeur, PROPRIÉTAIRE ici

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det != null ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const MT = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'mesures-terrain.js')).href);
  process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  delete process.env.VRM_OWNER_UID;
  // La fausse base du serveur (forme PostgREST, ce que la route lit et écrit).
  const lignes = new Map();
  const rep = (c, st = 200) => new Response(JSON.stringify(c), { status: st, headers: { 'content-type': 'application/json' } });
  const fetcher = async (url, o = {}) => {
    const u = decodeURIComponent(String(url)); const m = (o.method || 'GET').toUpperCase();
    if (/vrm_reglages/.test(u)) return rep([{ valeur: UID }]);
    if (/\/rpc\//.test(u)) return rep(true);
    if (!/\/rest\/v1\/app_data/.test(u)) return rep([]);
    const id = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
    if (m === 'GET') return rep(id && lignes.has(id) ? [{ data: lignes.get(id).data }] : []);
    if (m === 'POST') { const faites = []; for (const l of JSON.parse(o.body || '[]')) { if (lignes.has(l.id)) continue; lignes.set(l.id, { owner: l.owner, data: l.data }); faites.push({ id: l.id }); } return rep(faites, 201); }
    if (m === 'PATCH' && id && lignes.has(id)) { const b = JSON.parse(o.body || '{}'); lignes.set(id, { ...lignes.get(id), data: b.data }); return rep([{ id }]); }
    return rep([]);
  };
  const recus = [];

  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    const base = { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 };
    const o = await NV.ouvrir(nav, { W: 390, sombre: false, base, tab: 'journee' });
    const { pg } = o;
    // La route des mesures (posée APRÈS celles de `ouvrir` : Playwright prend la dernière en premier).
    await pg.route(/\/api\/compte\?mode=mesures/, async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"jours":[]}' });
      const brut = req.postData() || '';
      let c = null; try { c = JSON.parse(brut); } catch (_) {}
      // Le jeton du banc n'a pas la forme d'un vrai jeton (trois parties) : on le remplace, et la session est
      // celle du propriétaire (verifierJeton). Tout le reste du corps part tel quel dans la vraie fonction.
      const jetonApp = c && c.jeton;
      const corps = c ? JSON.stringify({ ...c, jeton: 'banc.jeton.sig' }) : brut;
      const r = await MT.recevoirMesures({ corps, verifierJeton: async () => ({ id: UID }), fetcher, maintenant: Date.now() });
      recus.push({ brut, jetonApp, reponse: r });
      return route.fulfill({ status: r.code, contentType: 'application/json', body: JSON.stringify(r.corps) });
    });
    await attendre(2500);

    // P1 — Ventes tombe sur son garde-fou.
    await pg.evaluate(() => { window.__VRM_BANC_PLANTE = 'ventes'; });
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=ventes' })));
    await attendre(2500);
    const garde = await pg.evaluate(() => [...document.querySelectorAll('[data-garde-ecran]')].map((e) => e.getAttribute('data-garde-ecran')));
    dit(garde.includes('ventes'), 'P1 (scène) Ventes est tombé sur son garde-fou', garde);
    await pg.screenshot({ path: path.join(SHOTS, 'P1-ventes-tombe-390.png') }).catch(() => {});
    await pg.evaluate(() => { window.__VRM_BANC_PLANTE = null; });
    // P2 — deux promesses rejetées que rien ne rattrape.
    await pg.evaluate(() => { setTimeout(() => { Promise.reject(new Error('rejet de banc (Error)')); Promise.reject('rejet de banc en chaîne'); }, 0); });
    await attendre(800);
    // P3 — un morceau de l'app introuvable (après une mise en ligne, l'ancienne page demande un fichier que le
    // serveur n'a plus) : un import à la demande d'un fichier /assets/ absent, que rien ne rattrape.
    await pg.evaluate(() => { setTimeout(() => { import('/assets/Ecran-disparu-banc0.js'); }, 0); });
    await attendre(1500);

    // L'envoi : la page part (le lot attend d'habitude une minute entre deux envois).
    const n0 = recus.length;
    await pg.evaluate(() => { try { localStorage.setItem('vrm_mesures_envoi_at', '0'); } catch (_) {} window.dispatchEvent(new Event('pagehide')); });
    for (let i = 0; i < 40 && recus.length === n0; i++) await attendre(250);
    // Le serveur prend UN lot de mesures par minute et par appareil (un second rend 429) ; les ALERTES de chaque lot
    // sont rangées quand même. On juge donc l'ensemble des lots reçus.
    const lots = recus.map((r) => { let c = null; try { c = JSON.parse(r.brut); } catch (_) {} return { ...r, c }; });
    const avecP = lots.filter((l) => l.c && Array.isArray(l.c.p) && l.c.p.length);
    const ps = avecP.flatMap((l) => l.c.p);
    dit(recus.length > n0, 'la page envoie un lot vers /api/compte?mode=mesures au départ de la page', recus.length);
    dit(ps.length >= 4, 'les lots portent les plantages (`p`) : écran tombé, deux promesses, le morceau', ps.map((x) => [x.origine, x.message]));
    dit(lots.every((l) => l.jetonApp && l.jetonApp.length > 4), '(banc) chaque lot porte le jeton de la session');
    const perso = [UID, 'nouvelle.vendeuse@exemple.test', 'jeton-nouveau-vendeur'];
    const sansJeton = JSON.stringify(lots.map((l) => (l.c ? { ...l.c, jeton: '' } : null)));
    dit(lots.length > 0 && perso.every((p) => !sansJeton.includes(p)) && !/\d{5,}/.test(JSON.stringify(ps)), 'rien du vendeur dans les corps (identifiant, e-mail, longues suites de chiffres)', sansJeton.slice(0, 300));
    dit(avecP.length > 0 && avecP.every((l) => l.reponse.corps && l.reponse.corps.alertes && l.reponse.corps.alertes.fait === true), 'la VRAIE route range les plantages de chaque lot (alertes rangées)', avecP.map((l) => l.reponse));

    // La ligne du jour, chez le propriétaire.
    const ligne = [...lignes.entries()].find(([id]) => /^plantages_terrain_\d{4}-\d{2}-\d{2}$/.test(id));
    const types = ligne ? Object.values(ligne[1].data.types || {}) : [];
    const de = (re) => types.find((t) => re.test(t.message));
    dit(!!ligne && ligne[1].owner === UID, 'la ligne du jour plantages_terrain_<jour> est écrite chez le propriétaire', ligne ? ligne[0] : [...lignes.keys()]);
    const tVentes = de(/plantage de banc/), tErr = de(/rejet de banc \(Error\)/), tChaine = de(/rejet de banc en cha/), tMorceau = types.find((t) => t.origines && t.origines.morceau);
    dit(!!tVentes && tVentes.garde >= 1 && tVentes.ecrans && tVentes.ecrans.ventes >= 1, 'P1 l’écran tombé (Ventes) est dans le journal', types.map((t) => t.message));
    dit(!!tErr && tErr.origines && tErr.origines.promesse >= 1, 'P2 la promesse rejetée (Error) est dans le journal dès la 1re fois', types.map((t) => [t.message, t.origines]));
    dit(!!tChaine, 'P2 la promesse rejetée avec une simple chaîne aussi', types.map((t) => t.message));
    dit(!!tMorceau, 'P3 le morceau qui ne se charge pas est dans le journal (origine « morceau »)', types.map((t) => [t.message, t.origines]));
    dit(types.length >= 4 && types.every((t) => Number(t.proprio) === Number(t.n) && Array.isArray(t.appareils) && t.appareils.length === 0 && !(Number(t.bloque) > 0)), 'chez le propriétaire : rangés « chez toi », JAMAIS une personne touchée ni une ouverture bloquée', types.map((t) => ({ n: t.n, p: t.proprio, ap: (t.appareils || []).length, b: t.bloque })));
    dit(!JSON.stringify(types).includes(UID) && !JSON.stringify(types).includes('nouvelle.vendeuse'), 'aucun identifiant ni e-mail dans les types rangés');
    dit(!o.journal.erreurs.filter((e) => !/rejet de banc|plantage de banc|Ecran-disparu-banc0|dynamically imported module/.test(e)).length, 'aucune autre erreur JS', o.journal.erreurs);
    await o.ctx.close();
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.stack || e).slice(0, 300)); }
  finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n❌ plantages-remontee : ${ko} rouge(s)` : '\n✅ plantages-remontee : tout est vert');
  process.exit(ko ? 1 : 0);
})();
