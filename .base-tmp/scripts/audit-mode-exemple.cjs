// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE MODE EXEMPLE ET LE GUIDE DE DÉMARRAGE (6 nov.)
//  Exécute les vrais modules (src/modeExemple.js, src/exempleBase.js,
//  src/guideDemarrage.js) dans une fenêtre imitée — aucun navigateur, aucune base.
//  M1  sans la clé de l'onglet, rien n'est installé (fetch et stockage intacts) ;
//  M2  avec la clé : le stockage est en mémoire (le vrai n'est ni lu ni écrit,
//      sauf les réglages d'affichage, LUS) ;
//  M3  la base et /api sont répondus sur place : le vrai fetch n'est JAMAIS appelé
//      pour eux, ni pour une écriture vers un autre site ;
//  M4  une écriture de l'app (PATCH `main` comparer-et-échanger, upsert POST) reste
//      dans la base en mémoire et se relit ;
//  M5  les messages du pont de l'extension (`__vmr`) sont coupés ;
//  M6  sortir retire la clé du VRAI stockage de l'onglet ;
//  G1-G4 la règle du guide : « pas su » n'est jamais « fait » ni « à faire ».
//  Le banc de rendu (scripts/bancs/mode-exemple.cjs) juge l'app entière.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : ''}`); };
const src = (f) => pathToFileURL(path.join(__dirname, '..', 'src', f)).href;

class Stock { constructor(o) { this.m = new Map(Object.entries(o || {})); this.ecrits = []; this.lus = []; }
  get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { this.lus.push(k); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.ecrits.push(k); this.m.set(k, String(v)); } removeItem(k) { this.ecrits.push('-' + k); this.m.delete(k); } }

function fenetre(cle) {
  const appels = [];
  const ecouteurs = [];
  const win = {
    location: { href: 'https://vrm.center/?tab=journee', origin: 'https://vrm.center', assign(u) { this.allee = u; } },
    navigator: { sendBeacon: () => { appels.push({ beacon: true }); return true; } },
    chrome: { runtime: { sendMessage() {} } },
    postMessage(m) { appels.push({ postMessage: m }); },
    addEventListener(t, f, c) { ecouteurs.push({ t, f, c }); },
    fetch: async (u, o) => { appels.push({ u: String(u), m: (o && o.method) || 'GET' }); return new Response('[]', { status: 200 }); },
  };
  Object.defineProperty(win, 'localStorage', { configurable: true, value: new Stock({ vinted_dark: 'true', vrm_session: '{"vraie":1}', vinted_annonce_numeros: '{"1":{"numero":"42"}}' }) });
  Object.defineProperty(win, 'sessionStorage', { configurable: true, value: new Stock(cle ? { vrm_mode_exemple: '1' } : {}) });
  return { win, appels, ecouteurs };
}

(async () => {
  global.window = undefined;   // le module ne s'installe pas tout seul ici
  const M = await import(src('modeExemple.js'));
  const G = await import(src('guideDemarrage.js'));
  // M1
  { const f = fenetre(false); const fetch0 = f.win.fetch;
    const r = M.installerModeExemple(f.win);
    dit(r === false && f.win.fetch === fetch0 && f.win.localStorage instanceof Stock, 'M1 sans la clé de l’onglet : rien n’est installé', { r }); }
  // Un seul ETAT par module : on réimporte pour un second essai.
  const M2 = await import(src('modeExemple.js') + '?second');
  const f = fenetre(true);
  const lsReel = f.win.localStorage, ssReel = f.win.sessionStorage;
  const r = M2.installerModeExemple(f.win);
  dit(r === true && M2.exempleActif(), 'M2 avec la clé : le mode exemple est actif');
  dit(f.win.localStorage !== lsReel && f.win.localStorage.getItem('vinted_dark') === 'true', 'M2 le stockage est en mémoire, l’affichage repris (thème)');
  f.win.localStorage.setItem('vinted_annonce_numeros', '{"51000":{"numero":"1"}}');
  dit(!lsReel.ecrits.length && lsReel.m.get('vinted_annonce_numeros') === '{"1":{"numero":"42"}}', 'M2 le vrai stockage n’est jamais écrit', lsReel.ecrits);
  dit(!lsReel.lus.includes('vrm_session') && JSON.parse(f.win.localStorage.getItem('vrm_session')).user.id === M2.UID_EXEMPLE, 'M2 la vraie session n’est pas lue ; celle de l’exemple est en mémoire');
  // M3
  const B = 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
  const lire = async (u, o) => { const x = await f.win.fetch(u, o); let j = null; try { j = await x.json(); } catch (_) {} return { st: x.status, j }; };
  const a = await lire(`${B}/rest/v1/app_data?id=like.harvest_*_listings&select=id,n:data->payload->items`);
  dit(a.st === 200 && Array.isArray(a.j) && a.j.length === 2 && Array.isArray(a.j[0].n), 'M3 une lecture de la base est servie sur place (annonces inventées)', a);
  const c = await lire(`${B}/rest/v1/vinted_accounts?select=vinted_user_id,login`);
  dit(c.j && c.j.length === 2 && c.j[0].login === 'vendeuse_a', 'M3 les comptes Vinted inventés', c.j);
  const conf = await lire('/api/compte?mode=confidentialite');
  dit(conf.j && conf.j.ok === true && conf.j.uid === M2.UID_EXEMPLE, 'M3 la porte de confidentialité reçoit SON uid (sur place)', conf.j);
  const api = await lire('/api/compte?mode=checkout', { method: 'POST', body: '{}' });
  dit(api.st === 409 && api.j.erreur === 'exemple', 'M3 une écriture vers /api est refusée sur place', api);
  const ailleurs = await lire('https://exemple.test/x', { method: 'POST', body: 'a' });
  dit(ailleurs.st === 409, 'M3 une écriture vers un autre site est refusée sur place');
  await lire('https://tiles.exemple.test/1.png');
  dit(f.appels.filter((x) => x.u).every((x) => x.m === 'GET' && !x.u.includes('supabase') && !x.u.includes('/api/')) && f.appels.filter((x) => x.u).length === 1, 'M3 le vrai fetch n’est appelé que pour une LECTURE d’un autre site', f.appels);
  // M4
  const p1 = await lire(`${B}/rest/v1/app_data?id=eq.main&select=data`);
  // La forme de l'app (`modifierDonnee`) : `is.null` tant que la ligne n'a pas de rev.
  const rev = (p1.j[0].data.rev || 0);
  const cond = p1.j[0].data.rev == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev}`;
  const w = await lire(`${B}/rest/v1/app_data?id=eq.main&owner=eq.${M2.UID_EXEMPLE}&${cond}&select=id`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ data: { ...p1.j[0].data, rev: rev + 1, vrm_prenom: 'Essai' } }) });
  const relu = await lire(`${B}/rest/v1/app_data?id=eq.main&select=p:data->>vrm_prenom,rev:data->>rev`);
  dit(w.st === 200 && w.j.length === 1 && relu.j[0].p === 'Essai' && relu.j[0].rev === String(rev + 1), 'M4 PATCH comparer-et-échanger : écrit en mémoire, relu', { w, relu: relu.j });
  const w2 = await lire(`${B}/rest/v1/app_data?id=eq.main&data->>rev=eq.${rev}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: '{"data":{}}' });
  dit(w2.j.length === 0, 'M4 un rev périmé n’écrit rien (comme la vraie base)', w2.j);
  await lire(`${B}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'vrm_essai', data: { x: 1 } }]) });
  const r2 = await lire(`${B}/rest/v1/app_data?id=eq.vrm_essai&select=x:data->>x`);
  dit(r2.j[0] && r2.j[0].x === '1' && M2.bilanExemple().ecrituresGardees >= 3, 'M4 un upsert reste en mémoire et se relit', { r2: r2.j, b: M2.bilanExemple() });
  dit(f.appels.filter((x) => x.u).length === 1, 'M4 toujours aucun appel réseau vers la base');
  // M5
  f.win.postMessage({ __vmr: 'session', session: { a: 1 } });
  const cap = f.ecouteurs.find((e) => e.t === 'message' && e.c === true);
  let stoppe = false; if (cap) cap.f({ data: { __vmr: 'ready' }, stopImmediatePropagation() { stoppe = true; } });
  dit(!f.appels.some((x) => x.postMessage) && stoppe && !f.win.chrome.runtime, 'M5 le pont de l’extension est coupé dans les deux sens', f.appels);
  // M6
  M2.sortirModeExemple(f.win, '/?tab=journee');
  dit(ssReel.m.get('vrm_mode_exemple') === undefined && f.win.location.allee === '/?tab=journee', 'M6 sortir retire la clé du VRAI stockage de l’onglet et recharge');

  // G
  const e = (p) => G.etatGuide(p);
  const g1 = e({ compte: G.preuveCompte('uid'), extension: G.preuveExtension('absente', []), vinted: G.preuveListe([]), emails: G.preuveListe([]), vente: G.preuveNombre(0) });
  dit(g1.faites === 1 && g1.courante === 'extension' && !g1.fini, 'G1 seul le compte est prouvé : 1, on continue par l’extension', g1);
  const g2 = e({ compte: 'fait', extension: G.preuveExtension('absente', [{}]), vinted: G.preuveListe([{}]), emails: G.preuveListe(null), vente: G.preuveNombre(undefined) });
  dit(g2.etapes[3].etat === 'passu' && g2.etapes[4].etat === 'encours' && g2.courante === 'emails' && g2.faites === 3, 'G2 une preuve incertaine garde son étape courante sans cocher ni avancer', g2);
  dit(G.preuveExtension('demande', []) === 'encours' && G.preuveExtension('connectee', []) === 'fait' && G.preuveExtension('muette', []) === 'fait', 'G3 l’extension qui répond est installée ; la question en cours ne coche rien');
  dit(G.compterNumeros({ a: { numero: '1' }, b: { numero: '' } }, { c: { numero: 'B12' } }) === 2 && G.compterNumeros(undefined) === undefined && G.compterNumeros(null) === null, 'G4 compter les N° : trois états', [G.compterNumeros(undefined), G.compterNumeros(null)]);
  dit(e({}).etapes.every((x) => x.etat === 'passu'), 'G4 une preuve absente vaut « pas su », jamais « fait »');

  console.log(ko ? `\n❌ audit mode exemple : ${ko} défaut(s)` : '\n✅ audit mode exemple : rien à signaler');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
