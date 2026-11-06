// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « TEMPS RÉELS DES VENDEURS » (6 nov., v36)
//
//  La collecte des temps réels (src/mesuresTerrain.js · src/mesuresCollecte.js ·
//  api/_lib/mesures-terrain.js · la veille des lenteurs) EXÉCUTÉE, pas lue :
//   R. la règle : un jeu RICHE (e-mails, pseudos, n° de transaction, IBAN,
//      prix, adresses, jetons, uuid — dans les clés, les valeurs, des champs en
//      trop) passe par `normaliserLot` : rien n'en sort hormis des comptes
//      entiers sous des clés fermées ; idempotent ; plafond par lot ;
//      quantiles justes (comparés aux vrais quantiles de 5 000 valeurs tirées) ;
//      somme case à case ;
//   C. la collecte, dans un faux navigateur (aucun réseau) : ce qui part par
//      `sendBeacon` est {v, h, jeton} — h passe le filtre tel quel, aucune
//      valeur personnelle de la page ni du stockage ne s'y trouve ; au plus UN
//      envoi par minute ; rien hors réseau, rien sans session ; un navigateur
//      qui ne sait pas mesurer n'envoie rien pour cette mesure (jamais un 0) ;
//   S. le serveur (base à état injectée) : jeton refusé ⇒ 401 et rien d'écrit ;
//      lecture ratée ⇒ rien d'écrit ; aucun identifiant de vendeur, jeton ou
//      e-mail rangé ; un lot par minute et par vendeur (429) ; deux vendeurs
//      la même minute ⇒ les deux comptés ; devancé ⇒ relit et rejoue ; la
//      somme rangée = la somme envoyée ; le propriétaire seul lit (403) et ne
//      reçoit aucune empreinte ;
//   V. la veille : +31 % au p75 ⇒ UNE notification, mémo écrit AVANT ; +29 %,
//      peu de mesures, mémo du jour déjà là, lecture ratée ⇒ rien.
//  `--prouve` : chaque mutation (règle affaiblie) ⇒ ROUGE.
//  Lancer : node scripts/audit-mesures-terrain.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const FICHIERS = ['src/mesuresTerrain.js', 'src/mesuresCollecte.js', 'src/plantages.js', 'src/demarrage.js', 'api/_lib/mesures-terrain.js', 'api/_lib/signalement.js', 'api/_lib/cle.js', 'api/_lib/veille-plantages.js'];

// Ce qui ne doit JAMAIS sortir de l'appareil ni être rangé.
const PERSO = ['jean.dupont@gmail.com', 'julatace3535', '7200000001', 'FR7630006000011234567890189', '120,00', 'https://www.vinted.fr/items/7200000001', '0612345678',
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig', '9b2f6c1e-4d4a-4c55-9a0e-1f2b3c4d5e6f', 'Rue des Bains Cancale'];
const UID = '9b2f6c1e-4d4a-4c55-9a0e-1f2b3c4d5e6f';
const UID2 = '5a5a5a5a-1111-2222-3333-444444444444';
const PROPRIO = '11111111-2222-3333-4444-555555555555';

async function verifier(racine, tag) {
  let ko = 0; const out = [];
  const dit = (c, m, d) => { if (!c) ko++; out.push((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const imp = (f) => import(pathToFileURL(path.join(racine, f)).href + '?t=' + tag + Math.random());
  let T, Srv, Veille;
  try { T = await imp('src/mesuresTerrain.js'); Srv = await imp('api/_lib/mesures-terrain.js'); Veille = await imp('api/_lib/veille-plantages.js'); }
  catch (e) { dit(false, 'les modules se chargent', String(e && e.message).slice(0, 200)); return { ko, out }; }

  // ── R. la règle ───────────────────────────────────────────────────────────
  const n = (m) => T.nbCases(m);
  const riche = {
    v: 1, email: PERSO[0], uid: UID, login: PERSO[1], jeton: PERSO[7],
    h: {
      'cat_bord|telephone|peu': [3, 2, 0, ...new Array(n('peu') - 3).fill(0)],
      'journee|ordinateur|inp': new Array(n('inp')).fill(1),
      [`${PERSO[0]}|telephone|peu`]: new Array(n('peu')).fill(1),
      [`${PERSO[1]}|telephone|peu`]: new Array(n('peu')).fill(1),
      'cat_bord|telephone|peu|x': new Array(n('peu')).fill(1),
      'cat_bord|iphone-de-julien|peu': new Array(n('peu')).fill(1),
      'cat_bord|telephone|titre': new Array(n('peu')).fill(1),
      'ventes|telephone|cls': [PERSO[2], 1.5, -1, 2, ...new Array(n('cls') - 4).fill(PERSO[4])],
      'annonces|tablette|peu': [1, 2],
      'messages|telephone|peu': { 0: 1 },
      [PERSO[5]]: [1],
    },
    extra: PERSO,
  };
  const lot = T.normaliserLot(riche);
  const json = JSON.stringify(lot);
  dit(!!lot && Object.keys(lot).sort().join(',') === 'h,v', 'R1 seul un lot {v, h} sort du filtre (champs en trop jetés)', lot ? Object.keys(lot).join(',') : 'null');
  dit(!!lot && PERSO.every((p) => !json.includes(p)) && !/@|https?:|eyJ|[0-9a-f]{8}-[0-9a-f]{4}/i.test(json), 'R2 aucune valeur personnelle du jeu riche ne passe', json.slice(0, 160));
  const cles = lot ? Object.keys(lot.h) : [];
  dit(cles.length && cles.every((k) => { const c = T.lireCle(k); return c && T.ECRANS.includes(c.ecran) && T.APPAREILS.includes(c.appareil) && T.METRIQUES.includes(c.metrique); }), 'R3 chaque clé est (écran de l\'app, appareil, mesure) fermés', cles.join(' '));
  dit(cles.sort().join(' ') === 'cat_bord|telephone|peu journee|ordinateur|inp ventes|telephone|cls', 'R4 exactement les trois clés valides', cles.join(' '));
  dit(!!lot && Object.values(lot.h).every((l) => l.every((x) => Number.isInteger(x) && x >= 0 && x <= T.COMPTE_MAX_PAR_CASE)), 'R5 que des entiers bornés (une valeur non entière vaut 0)', lot ? JSON.stringify(lot.h['ventes|telephone|cls']) : '');
  dit(JSON.stringify(T.normaliserLot(lot)) === json, 'R6 le filtre est idempotent (l\'aperçu de l\'app = ce que le serveur range)');
  dit(T.normaliserLot({ h: { 'cat_bord|telephone|peu': new Array(n('peu')).fill(0) } }) === null && T.normaliserLot('x') === null && T.normaliserLot(null) === null, 'R7 rien de mesuré ⇒ null (rien ne part)');
  const plein = T.lotVide(); for (let i = 0; i < 1000; i++) T.ajouterMesure(plein, 'cat_bord', 'telephone', 'peu', 300 + i);
  dit(T.totalLot(plein) === T.MESURES_MAX_PAR_LOT, 'R8 un lot est plafonné', String(T.totalLot(plein)));
  const lourd = { h: {} }; for (const e of T.ECRANS.slice(0, 6)) lourd.h[`${e}|telephone|peu`] = new Array(n('peu')).fill(T.COMPTE_MAX_PAR_CASE);
  dit(T.totalLot(T.normaliserLot(lourd)) <= T.MESURES_MAX_PAR_LOT, 'R9 le serveur borne aussi un lot trop gros (le filtre s\'arrête au plafond)', String(T.totalLot(T.normaliserLot(lourd))));
  const v0 = T.lotVide(); T.ajouterMesure(v0, 'julatace3535', 'telephone', 'peu', 100); T.ajouterMesure(v0, 'cat_bord', 'telephone', 'peu', -5); T.ajouterMesure(v0, 'cat_bord', 'telephone', 'peu', 'abc'); T.ajouterMesure(v0, 'cat_bord', 'telephone', 'peu', 11 * 60000);
  dit(T.totalLot(v0) === 0, 'R10 un écran inconnu ou une valeur absurde ne compte pas', JSON.stringify(v0.h));
  // Quantiles justes : 5 000 valeurs tirées (log-normales), comparées aux vrais.
  let graine = 7; const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
  const vals = []; for (let i = 0; i < 5000; i++) { const z = Math.sqrt(-2 * Math.log(alea() || 1e-9)) * Math.cos(2 * Math.PI * alea()); vals.push(Math.exp(6.6 + 0.7 * z)); }
  const histo = new Array(n('peu')).fill(0); for (const x of vals) histo[T.caseDe('peu', x)]++;
  const tri = [...vals].sort((a, b) => a - b); const vrai = (q) => tri[Math.min(tri.length - 1, Math.floor(q * tri.length))];
  const largeur = (x) => { const b = T.BORNES_MS; const i = T.caseDe('peu', x); return (i >= b.length ? b[b.length - 1] : b[i]) - (i === 0 ? 0 : b[i - 1]); };
  const ecarts = [0.5, 0.75, 0.95].map((q) => { const est = T.percentile(histo, T.BORNES_MS, q); return { q, est: Math.round(est), vrai: Math.round(vrai(q)), ok: Math.abs(est - vrai(q)) <= Math.max(largeur(vrai(q)) * 0.6, 15) }; });
  dit(ecarts.every((e) => e.ok), 'R11 p50/p75/p95 de l\'histogramme ≈ les vrais quantiles (dans la case)', JSON.stringify(ecarts));
  dit(T.percentile(new Array(n('peu')).fill(0), T.BORNES_MS, 0.75) === null, 'R12 aucun mesure ⇒ quantile null (jamais 0)');
  const f = T.fusionnerHisto({ 'cat_bord|telephone|peu': [1, 2, ...new Array(n('peu') - 2).fill(0)] }, { h: { 'cat_bord|telephone|peu': [4, 0, ...new Array(n('peu') - 2).fill(0)], 'journee|telephone|morceau': [1, 0] } });
  dit(f['cat_bord|telephone|peu'][0] === 5 && f['cat_bord|telephone|peu'][1] === 2 && f['journee|telephone|morceau'][0] === 1, 'R13 la fusion additionne case à case', JSON.stringify(f).slice(0, 120));

  // ── C. la collecte, dans un faux navigateur ────────────────────────────────
  const C = await collecte(racine, tag, dit);
  void C;

  // ── S. le serveur ─────────────────────────────────────────────────────────
  await serveur(Srv, T, dit);

  // ── V. la veille des lenteurs ─────────────────────────────────────────────
  await veille(Veille, T, dit);
  return { ko, out };
}

// Un faux navigateur : stockage, page (avec des données personnelles), observateurs, beacon.
async function collecte(racine, tag, dit) {
  const imp = (f, q) => import(pathToFileURL(path.join(racine, f)).href + '?c=' + tag + q + Math.random());
  const fabriquer = ({ saitInp = true, saitCls = true, enLigne = true } = {}) => {
    const stock = new Map();
    const envois = [];
    const ecouteurs = {}; const obs = {};
    let maintenant = Date.parse('2026-11-06T09:00:00Z'); let perf = 1200;
    const main = { innerText: 'julatace3535 a acheté Nike Air Max pour 120,00 € — jean.dupont@gmail.com — FR7630006000011234567890189 — tx 7200000001 — 0612345678 — Rue des Bains Cancale', querySelector: () => null };
    const g = {
      window: { innerWidth: 390, matchMedia: () => ({ matches: true }), addEventListener: (t, f) => { (ecouteurs[t] = ecouteurs[t] || []).push(f); }, __vrmEcranMesure: 'cat_bord' },
      document: { visibilityState: 'visible', addEventListener: (t, f) => { (ecouteurs['doc:' + t] = ecouteurs['doc:' + t] || []).push(f); }, querySelector: (s) => (/main/.test(s) ? main : null) },
      navigator: { onLine: enLigne, maxTouchPoints: 5, sendBeacon: (url, blob) => { envois.push({ url, blob, at: maintenant }); return true; } },
      localStorage: { getItem: (k) => (stock.has(k) ? stock.get(k) : null), setItem: (k, v) => stock.set(k, String(v)), removeItem: (k) => stock.delete(k) },
      performance: { now: () => perf },
      PerformanceObserver: class { constructor(cb) { this.cb = cb; } observe(o) { obs[o.type] = this.cb; } },
    };
    g.PerformanceObserver.supportedEntryTypes = [saitInp ? 'event' : null, saitCls ? 'layout-shift' : null].filter(Boolean);
    return { g, stock, envois, ecouteurs, obs, avance: (ms) => { maintenant += ms; perf += ms; }, get maintenant() { return maintenant; } };
  };
  const installer = (env) => {
    const garde = {};
    for (const k of Object.keys(env.g)) { garde[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: env.g[k], configurable: true, writable: true }); }
    const dn = Date.now; Date.now = () => env.maintenant;
    return () => { Date.now = dn; for (const [k, d] of Object.entries(garde)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } };
  };
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  // 1. Le jeu riche dans la page et le stockage ; une session ; un navigateur qui sait tout mesurer.
  {
    const env = fabriquer();
    env.stock.set('vrm_mesures_lot', JSON.stringify({ v: 1, email: PERSO[0], h: { [`${PERSO[1]}|telephone|peu`]: [1], 'cat_bord|telephone|peu': [0, 1, ...new Array(23).fill(0)] } }));
    const remettre = installer(env);
    try {
      const M = await imp('src/mesuresCollecte.js', 'a');
      M.demarrerMesures({ jeton: () => 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig', ouverture: true });
      await dormir(120);   // le premier écran utile est vu
      env.obs.event && env.obs.event({ getEntries: () => [{ interactionId: 3, startTime: 1500, duration: 240, name: 'pointerdown' }, { interactionId: 0, startTime: 1500, duration: 900 }] });
      env.obs['layout-shift'] && env.obs['layout-shift']({ getEntries: () => [{ value: 0.04, startTime: 1300, hadRecentInput: false }, { value: 0.5, startTime: 1400, hadRecentInput: true }] });
      env.avance(2000);
      M.mesuresEcran('julatace3535');   // pas un écran : ignoré
      M.mesuresEcran('journee');         // changement d'écran : la visite de Colis se termine
      await dormir(80);
      env.avance(61000);
      M.envoyerMesures();
      const corps = env.envois.length ? JSON.parse(await env.envois[0].blob.text()) : null;
      const T = await imp('src/mesuresTerrain.js', 'b');
      dit(env.envois.length === 1 && env.envois[0].url === '/api/compte?mode=mesures', 'C1 un lot part par sendBeacon vers la route existante', `${env.envois.length} envoi(s) ${env.envois[0] ? env.envois[0].url : ''}`);
      dit(!!corps && Object.keys(corps).sort().join(',') === 'h,jeton,v', 'C2 le corps est {v, h, jeton} — rien d\'autre', corps ? Object.keys(corps).join(',') : 'aucun');
      dit(!!corps && JSON.stringify(T.normaliserLot(corps)) === JSON.stringify({ v: corps.v, h: corps.h }), 'C3 h est déjà filtré (le filtre du serveur ne change rien)');
      const sansJeton = corps ? JSON.stringify({ ...corps, jeton: undefined }) : '';
      dit(!!corps && PERSO.every((p) => !sansJeton.includes(p)), 'C4 aucune valeur personnelle de la page ni du stockage ne part (hors le jeton de session, vérifié et jamais rangé)', sansJeton.slice(0, 200));
      const h = (corps && corps.h) || {};
      dit(!!h['cat_bord|telephone|peu'] && !!h['cat_bord|telephone|inp'] && !!h['cat_bord|telephone|cls'], 'C5 la visite de Colis a son premier écran, son interaction et son décalage', Object.keys(h).join(' '));
      const iInp = (h['cat_bord|telephone|inp'] || []).findIndex((x) => x > 0), iCls = (h['cat_bord|telephone|cls'] || []).findIndex((x) => x > 0);
      dit(T.BORNES_MS[iInp] === 250 && T.BORNES_CLS[iCls] === 0.05, 'C6 l\'interaction la plus lente (240 ms, une vraie interaction) et le décalage hors saisie (0,04) sont dans la bonne case', `inp case ${iInp} · cls case ${iCls}`);
      // Plafond : un second lot dans la minute ne part pas.
      M.mesuresEcran('ventes'); await dormir(60); env.avance(30000); M.mesuresEcran('annonces'); await dormir(60);
      M.envoyerMesures(); env.avance(20000); M.envoyerMesures();
      dit(env.envois.length === 1, 'C7 au plus un envoi par minute (59 s plus tard : rien)', `${env.envois.length} envoi(s)`);
      env.avance(11000); M.envoyerMesures();
      dit(env.envois.length === 2, 'C8 après une minute, le lot suivant part', `${env.envois.length} envoi(s)`);
      for (const f of env.ecouteurs.pagehide || []) f(); for (const f of env.ecouteurs['doc:visibilitychange'] || []) { env.g.document.visibilityState = 'hidden'; f(); }
      dit(env.envois.length === 2, 'C9 fermer l\'app ne contourne pas la minute (le lot attend, gardé sur l\'appareil)', `${env.envois.length} envoi(s) · lot ${env.stock.has('vrm_mesures_lot') ? 'gardé' : 'absent'}`);
    } finally { remettre(); }
  }
  // 2. Hors réseau, sans session, navigateur qui ne sait pas mesurer.
  {
    const env = fabriquer({ saitInp: false, saitCls: false, enLigne: false });
    const remettre = installer(env);
    try {
      const M = await imp('src/mesuresCollecte.js', 'c');
      let jeton = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig';
      M.demarrerMesures({ jeton: () => jeton, ouverture: true });
      await dormir(100);
      env.avance(3000); M.mesuresEcran('journee'); await dormir(60);
      env.avance(70000); M.envoyerMesures();
      dit(env.envois.length === 0 && env.stock.has('vrm_mesures_lot'), 'C10 hors réseau : rien ne part, le lot attend sur l\'appareil', `${env.envois.length} envoi(s)`);
      const lot = JSON.parse(env.stock.get('vrm_mesures_lot') || '{}');
      dit(!Object.keys(lot.h || {}).some((k) => /\|(inp|cls)$/.test(k)) && Object.keys(lot.h || {}).some((k) => /\|peu$/.test(k)), 'C11 un navigateur qui ne sait pas mesurer l\'interaction ni le décalage n\'envoie rien pour elles (jamais un 0)', Object.keys(lot.h || {}).join(' '));
      env.g.navigator.onLine = true; jeton = '';
      M.envoyerMesures();
      dit(env.envois.length === 0, 'C12 sans session : rien ne part', `${env.envois.length} envoi(s)`);
      jeton = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig'; M.envoyerMesures();
      dit(env.envois.length === 1, 'C13 le réseau et la session revenus, le lot gardé part', `${env.envois.length} envoi(s)`);
    } finally { remettre(); }
  }
  // 3. L'ouverture sans session au chargement (connexion tapée) : pas de premier écran mesuré.
  {
    const env = fabriquer();
    const remettre = installer(env);
    try {
      const M = await imp('src/mesuresCollecte.js', 'd');
      M.demarrerMesures({ jeton: () => 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig', ouverture: false });
      await dormir(100); env.avance(70000); M.envoyerMesures();
      const lot = env.envois[0] ? JSON.parse(await env.envois[0].blob.text()) : JSON.parse(env.stock.get('vrm_mesures_lot') || '{}');
      dit(!Object.keys(lot.h || {}).some((k) => /\|peu$/.test(k)), 'C14 une ouverture où il a fallu se connecter ne compte pas la saisie du mot de passe comme « premier écran »', Object.keys(lot.h || {}).join(' ') || 'aucune mesure');
    } finally { remettre(); }
  }
}

// Une base à état (la ligne du jour), et un vérificateur de jeton.
function base({ lectureKO = false, devancer = 0 } = {}) {
  const lignes = new Map(); const ecrites = []; let aDevancer = devancer;
  const rep = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const fetcher = async (url, o = {}) => {
    const u = decodeURIComponent(url); const m = (o.method || 'GET').toUpperCase();
    if (/vrm_reglages/.test(u)) return rep(200, [{ valeur: PROPRIO }]);
    const id = (/id=eq\.([^&]+)/.exec(u) || [])[1];
    if (m === 'GET') {
      if (lectureKO) return rep(500, { message: 'panne' });
      if (/id=like\.mesures_jour_/.test(u)) return rep(200, [...lignes.values()].map((l) => ({ id: l.id, data: l.data })));
      const l = lignes.get(id); return rep(200, l ? [{ data: l.data }] : []);
    }
    const corps = JSON.parse(o.body || 'null'); ecrites.push({ m, u, corps });
    if (m === 'POST') { const x = corps[0]; if (lignes.has(x.id)) return rep(201, []); lignes.set(x.id, { id: x.id, owner: x.owner, data: x.data }); return rep(201, [x]); }
    if (m === 'PATCH') {
      const l = lignes.get(id); const rev = (/data->>rev=eq\.(\d+)/.exec(u) || [])[1];
      if (aDevancer > 0 && l) { aDevancer--; l.data = { ...l.data, rev: (l.data.rev || 0) + 1 }; return rep(200, []); }   // un autre lot vient d'écrire
      if (!l || String(l.data.rev) !== rev) return rep(200, []);
      l.data = corps.data; return rep(200, [l]);
    }
    return rep(405, {});
  };
  return { lignes, ecrites, fetcher };
}

async function serveur(Srv, T, dit) {
  const env = { SUPABASE_SERVICE_KEY: 'cle-de-service-banc', VRM_OWNER_UID: PROPRIO, SUPABASE_URL: 'https://banc.supabase.co' };
  const J = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig';
  const verif = (uid) => async (j) => (j === J ? { id: uid, email: 'jean.dupont@gmail.com' } : null);
  const lot = (k, i, c = 1) => { const l = T.lotVide(); for (let x = 0; x < c; x++) T.ajouterMesure(l, k.split('|')[0], k.split('|')[1], k.split('|')[2], i); return l; };
  const t0 = Date.parse('2026-11-06T10:00:30Z');
  // Jeton refusé, pas su, absent.
  {
    const B = base();
    const r1 = await Srv.recevoirMesures({ corps: JSON.stringify({ ...lot('cat_bord|telephone|peu', 300), jeton: 'a.b.c' }), verifierJeton: verif(UID), env, fetcher: B.fetcher, maintenant: t0 });
    const r2 = await Srv.recevoirMesures({ corps: { ...lot('cat_bord|telephone|peu', 300), jeton: J }, verifierJeton: async () => undefined, env, fetcher: B.fetcher, maintenant: t0 });
    const r3 = await Srv.recevoirMesures({ corps: { ...lot('cat_bord|telephone|peu', 300) }, verifierJeton: verif(UID), env, fetcher: B.fetcher, maintenant: t0 });
    dit(r1.code === 401 && r2.code === 503 && r3.code === 401 && B.ecrites.length === 0, 'S1 jeton refusé ⇒ 401, pas su ⇒ 503, absent ⇒ 401 ; rien d\'écrit', `${r1.code} ${r2.code} ${r3.code} · ${B.ecrites.length} écriture(s)`);
  }
  // Lecture ratée ⇒ rien d'écrit.
  {
    const B = base({ lectureKO: true });
    const r = await Srv.recevoirMesures({ corps: { ...lot('cat_bord|telephone|peu', 300), jeton: J }, verifierJeton: verif(UID), env, fetcher: B.fetcher, maintenant: t0 });
    dit(r.code === 503 && B.ecrites.length === 0, 'S2 lecture de la ligne du jour ratée ⇒ 503, RIEN n\'est écrit', `${r.code} · ${B.ecrites.length} écriture(s)`);
  }
  // Rangé sans identifiant ; une fois par minute ; deux vendeurs ; devancé ; sommes.
  {
    const B = base({ devancer: 1 });
    const corps = { ...lot('cat_bord|telephone|peu', 300, 3), jeton: J, email: 'jean.dupont@gmail.com', uid: UID };
    const a = await Srv.recevoirMesures({ corps: JSON.stringify(corps), verifierJeton: verif(UID), env, fetcher: B.fetcher, maintenant: t0 });
    const b = await Srv.recevoirMesures({ corps: { ...lot('journee|telephone|peu', 800, 2), jeton: J }, verifierJeton: verif(UID), env, fetcher: B.fetcher, maintenant: t0 + 10000 });
    const c = await Srv.recevoirMesures({ corps: { ...lot('cat_bord|telephone|peu', 1200, 4), jeton: J }, verifierJeton: verif(UID2), env, fetcher: B.fetcher, maintenant: t0 + 12000 });
    const d = await Srv.recevoirMesures({ corps: { ...lot('cat_bord|telephone|peu', 450, 5), jeton: J }, verifierJeton: verif(UID), env, fetcher: B.fetcher, maintenant: t0 + 61000 });
    const l = B.lignes.get('mesures_jour_2026-11-06');
    const txt = JSON.stringify(l || {});
    dit(a.code === 200 && !!l && l.owner === PROPRIO, 'S3 le lot est rangé dans l\'agrégat du JOUR, chez le propriétaire de l\'installation', `${a.code} · ${l ? l.id + ' ' + l.owner : 'aucune ligne'}`);
    dit(!!l && ![UID, UID2, J, 'jean.dupont@gmail.com', UID.replace(/-/g, '').slice(0, 12)].some((p) => txt.includes(p)), 'S4 ni identifiant de vendeur, ni jeton, ni e-mail rangés', txt.slice(0, 160));
    dit(!!l && Object.keys(l.data.contrib || {}).length === 2 && Object.keys(l.data.contrib).every((k) => /^[0-9a-f]{12}$/.test(k)), 'S5 seuls deux EMPREINTES du jour (12 hex) tiennent l\'anti-abus', JSON.stringify(Object.keys((l && l.data.contrib) || {})));
    dit(b.code === 429 && c.code === 200 && d.code === 200, 'S6 un lot par minute et par vendeur (429) ; un autre vendeur la même minute passe ; la minute suivante repasse', `${b.code} ${c.code} ${d.code}`);
    const peu = (l && l.data.h['cat_bord|telephone|peu']) || [];
    dit(peu.reduce((s, x) => s + x, 0) === 12 && l.data.mesures === 12 && l.data.lots === 3 && !l.data.h['journee|telephone|peu'], 'S7 la somme rangée = la somme des lots acceptés (3 + 4 + 5), le refusé n\'y est pas', JSON.stringify({ peu: peu.reduce((s, x) => s + x, 0), mesures: l && l.data.mesures, lots: l && l.data.lots }));
    dit(B.ecrites.filter((e) => e.m === 'PATCH').every((e) => /data->>rev=eq\.\d+/.test(decodeURIComponent(e.u))), 'S8 chaque mise à jour est conditionnelle (data.rev) : devancé ⇒ relu et rejoué', B.ecrites.map((e) => e.m).join(','));
    // Lecture : propriétaire seul, aucune empreinte.
    const L1 = await Srv.listerMesures({ utilisateur: { id: UID }, env, fetcher: B.fetcher });
    const L2 = await Srv.listerMesures({ utilisateur: { id: PROPRIO }, env, fetcher: B.fetcher });
    const j2 = JSON.stringify(L2.corps);
    dit(L1.code === 403 && L2.code === 200 && L2.corps.jours.length === 1 && L2.corps.jours[0].appareils === 2, 'S9 un vendeur ⇒ 403 ; le propriétaire lit le jour (2 appareils)', `${L1.code} ${L2.code}`);
    dit(Object.keys(l.data.contrib).every((k) => !j2.includes(k)) && !/"contrib"|"h":/.test(j2), 'S10 il ne reçoit ni empreinte ni histogramme brut, seulement des agrégats', j2.slice(0, 160));
    const ligneP = (L2.corps.jours[0].lignes || []).find((x) => x.ecran === 'cat_bord' && x.metrique === 'peu');
    dit(!!ligneP && ligneP.n === 12 && ligneP.p50 > 250 && ligneP.p50 <= 500 && ligneP.p95 > 1000 && ligneP.p95 <= 1250, 'S11 p50/p95 lus sur l\'agrégat (300×3, 1200×4, 450×5)', JSON.stringify(ligneP));
  }
  // Plafond du jour.
  {
    const B = base(); let ok = 0, refus = 0;
    for (let i = 0; i < T.LOTS_MAX_JOUR + 3; i++) { const r = await Srv.recevoirMesures({ corps: { ...lot('cat_bord|telephone|peu', 300), jeton: J }, verifierJeton: verif(UID), env, fetcher: B.fetcher, maintenant: Date.parse('2026-11-06T00:00:30Z') + i * 60000 }); if (r.code === 200) ok++; else if (r.code === 429) refus++; }
    dit(ok === T.LOTS_MAX_JOUR && refus === 3, 'S12 au plus LOTS_MAX_JOUR lots par jour et par vendeur', `${ok} acceptés · ${refus} refusés`);
  }
}

async function veille(V, T, dit) {
  const t = Date.parse('2026-11-07T07:30:00Z');
  const histo = (val, nb, m = 'peu') => { const l = T.lotVide(); for (let i = 0; i < nb; i++) T.ajouterMesure(l, 'cat_bord', 'telephone', m, val); return l.h; };
  const jouer = async ({ avant, hier, memo = null, lireKO = false, memoKO = false }) => {
    const journal = [];
    const r = await V.passageVeilleLenteurs({
      proprietaire: PROPRIO, maintenant: t,
      lireMemo: async () => memo,
      lireJours: async (jours) => (lireKO ? null : { [jours[0]]: avant, [jours[1]]: hier }),
      ecrireMemo: async (m) => { journal.push('memo:' + m.jour); return !memoKO; },
      envoyer: async (n) => { journal.push('push:' + n.body); return { sent: 1 }; },
    });
    return { r, journal };
  };
  const a = await jouer({ avant: histo(900, 40), hier: histo(1300, 40) });
  const pushes = a.journal.filter((x) => x.startsWith('push:'));
  dit(pushes.length === 1 && a.journal[0] === 'memo:2026-11-06' && /Colis sur téléphone/.test(pushes[0]), 'V1 un p75 qui monte de plus de 30 % ⇒ UNE notification, mémo écrit AVANT', a.journal.join(' | '));
  const b = await jouer({ avant: histo(1000, 40), hier: histo(1150, 40) });
  dit(!b.journal.some((x) => x.startsWith('push:')), 'V2 une hausse sous 30 % ⇒ rien', b.journal.join(' | '));
  const c = await jouer({ avant: histo(900, 5), hier: histo(1300, 5) });
  dit(!c.journal.some((x) => x.startsWith('push:')), 'V3 trop peu de mesures ⇒ rien', c.journal.join(' | '));
  const d = await jouer({ avant: histo(900, 40), hier: histo(1300, 40), memo: { jour: '2026-11-06' } });
  const e = await jouer({ avant: histo(900, 40), hier: histo(1300, 40), lireKO: true });
  const f = await jouer({ avant: histo(900, 40), hier: histo(1300, 40), memoKO: true });
  dit(!d.journal.some((x) => x.startsWith('push:')) && !e.journal.length && !f.journal.some((x) => x.startsWith('push:')), 'V4 déjà prévenu pour ce jour, lecture ratée, mémo pas écrit ⇒ rien', [d.journal, e.journal, f.journal].map((j) => j.join('+') || '∅').join(' | '));
  const g = await jouer({ avant: histo(0.05, 40, 'cls'), hier: histo(0.5, 40, 'cls') });
  dit(!g.journal.some((x) => x.startsWith('push:')), 'V5 le décalage (sans unité de temps) n\'alerte pas ici', g.journal.join(' | '));
}

const MUTATIONS = {
  'filtre-laisse-passer': ['src/mesuresTerrain.js', "    if (!c || !Array.isArray(l) || l.length !== nbCases(c.metrique)) continue;\n    const propre", "    if (!Array.isArray(l)) continue;\n    const propre", 'out[cleCase(c.ecran, c.appareil, c.metrique)] = propre;', 'out[k] = propre;'],
  'plafond-minute-retire': ['src/mesuresCollecte.js', 'if (Date.now() - dernier < ENVOI_MIN_MS) return false;', ''],
  'quantile-faux': ['src/mesuresTerrain.js', 'const rang = q * n;', 'const rang = q * n * 0.8;'],
  'serveur-sans-minute': ['api/_lib/mesures-terrain.js', "if (c.m === minute) return { refus: 'minute' };", ''],
  'serveur-range-uid': ['api/_lib/mesures-terrain.js', 'const emp = empreinteJour(u.id, jour, cfg(env).service);', 'const emp = u.id;'],
  // « lecture KO, écriture OK » : une lecture ratée prise pour « pas encore de ligne ».
  'lecture-ratee-ecrit': ['api/_lib/mesures-terrain.js', "    if (!r.ok) return undefined;\n    const j = await r.json().catch(() => null);\n    if (!Array.isArray(j)) return undefined;", "    if (!r.ok) return null;\n    const j = await r.json().catch(() => null);\n    if (!Array.isArray(j)) return undefined;"],
  'veille-seuil-zero': ['src/mesuresTerrain.js', 'if (hausse > seuil) out.push', 'if (hausse > 0) out.push'],
  'zero-invente': ['src/mesuresCollecte.js', 'if (E.saitInp && v.inp > 0) noter', 'if (v.inp >= 0) noter'],
  'jeton-pas-verifie': ['api/_lib/mesures-terrain.js', "if (!u || !u.id) return { code: 401, corps: { ok: false, raison: 'session' } };", "if (!u || !u.id) return recevoirMesures({ corps, jetonEntete, verifierJeton: async () => ({ id: 'x' }), env, fetcher, maintenant });"],
};

(async () => {
  const r = await verifier(R, 'vrai');
  r.out.forEach((l) => console.log(l));
  let rouges = 0;
  if (process.argv.includes('--prouve')) {
    for (const [nom, [fichier, ...paires]] of Object.entries(MUTATIONS)) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mesures-'));
      for (const f of FICHIERS) { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(R, f), path.join(tmp, f)); }
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
      let code = fs.readFileSync(path.join(tmp, fichier), 'utf8'); let manque = false;
      for (let i = 0; i < paires.length; i += 2) { if (!code.includes(paires[i])) manque = true; code = code.replace(paires[i], paires[i + 1]); }
      if (manque) { console.log(`KO  mutation ${nom} : ancre introuvable`); rouges++; continue; }
      fs.writeFileSync(path.join(tmp, fichier), code);
      let m;
      try { m = await verifier(tmp, nom); } catch (e) { m = { ko: 1, out: ['KO  plante : ' + String(e && e.message).slice(0, 80)] }; }
      console.log(m.ko ? `OK  mutation ${nom} : ${m.ko} rouge(s) — ${m.out.filter((l) => l.startsWith('KO')).map((l) => l.slice(4, 8).trim()).join(' ')}` : `KO  mutation ${nom} : reste verte`);
      if (!m.ko) rouges++;
    }
  }
  const total = r.ko + rouges;
  console.log(total ? `\n❌ mesures terrain : ${total} rouge(s)` : '\n✅ mesures terrain : tout est vert');
  process.exit(total ? 1 : 0);
})();
