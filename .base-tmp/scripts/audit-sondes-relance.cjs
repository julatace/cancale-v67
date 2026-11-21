// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : /api/sante RELANCE LES SONDES QUAND GITHUB NE LES A PAS LANCÉES (14 nov.)
//         node scripts/audit-sondes-relance.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré : le planificateur de GitHub ne lance `sondes-statut.yml` (« toutes les
// 10 min ») que 3 à 4 fois par jour (17 passages du 9 au 14 nov.). Entre deux,
// vrm.center/statut disait « pas su — sondes arrêtées » sur les six morceaux
// (relevé le 14 nov. 08:13 : dernier passage 05:37). Cet audit EXÉCUTE la VRAIE
// route /api/sante (api/compte.js) sur une fausse base qui sert la forme réelle
// (`owner=eq.<neutre>&id=eq.statut_sondes&select=data&limit=1`) :
//   R1 un état de 2 h ⇒ UNE relance de la route du cron, avec son secret, vers
//      l'adresse FIXE du site ; l'état relu est rendu (frais, plus « périmé ») ;
//   R2 une relance qui échoue ⇒ l'état d'avant, « pas su » (jamais un faux « ok »),
//      et pas de seconde relance avant 10 min ;
//   R3 un état de 5 min ⇒ aucune relance ;
//   R4 sans CRON_SECRET ⇒ aucune relance ;
//   R5 un en-tête Host piégé ne détourne jamais le secret.
// `--prouve` : chaque mutation réaffaiblit la règle ; l'audit doit devenir rouge.
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const LIB = path.join(R, 'api', '_lib', 'statut-sondes.js');
const COMPTE = path.join(R, 'api', 'compte.js');

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['sante ne relance plus', COMPTE, '  const relance = await relancerSondesSiVieilles({ statut: statut0 }).catch(() => null);', '  const relance = null;'],
    ['l’état relancé n’est pas relu', COMPTE, '{ oublierStatutPublic(); statut = await statutPourSante().catch(() => statut0); }', '{ }'],
    ['relance à chaque appel (pas d’espacement)', LIB, "  if (_relanceAt && maintenant - _relanceAt < RELANCE_ESPACE_MS) return { relance: false, raison: 'deja' };", ''],
    ['relance un état frais', LIB, "  if (at && maintenant - at < RELANCE_APRES_MS) return { relance: false, raison: 'frais' };", ''],
    ['relance sans secret', LIB, "  if (!secret || !env.SUPABASE_SERVICE_KEY) return { relance: false, raison: 'non-configure' };", ''],
    ['secret absent de l’appel', LIB, "{ headers: { Authorization: `Bearer ${secret}` } }", '{ headers: {} }'],
    ['adresse prise dans la requête', LIB, "export const ORIGINE_SITE = 'https://vrm.center';", "export const ORIGINE_SITE = 'https://piege.exemple';"],
  ];
  let rouges = 0;
  const origines = new Map();
  const remettre = () => { for (const [f, t] of origines) fs.writeFileSync(f, t); };
  process.on('exit', remettre);
  for (const [nom, f, avant, apres] of MUTS) {
    const src = origines.get(f) || fs.readFileSync(f, 'utf8');
    origines.set(f, src);
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : le motif n'existe plus`); rouges = -999; continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 180000 });
      const rouge = r.status !== 0;
      if (rouge) rouges++;
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  remettre();
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ko = 0, fini = false;
process.on('exit', () => { if (!fini) { console.log('❌ l’audit s’est arrêté avant la fin'); process.exitCode = 1; } });
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); };
const NEUTRE = '00000000-0000-0000-0000-000000000000';

(async () => {
  process.env.CRON_SECRET = 'secret-cron-de-banc';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
  process.env.SUPABASE_URL = 'https://base-de-banc.supabase.co';
  const monde = { etat: null, relances: [], cronRepond: 200, journal: [] };
  const J = (status, x) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => x, text: async () => JSON.stringify(x) });
  const L0 = await import(require('url').pathToFileURL(LIB).href);
  const etatA = (ilYaMs) => L0.etatApres(null, Object.fromEntries(L0.COMPOSANTS.map((c) => [c, { etat: 'ok', raison: 'repond' }])), Date.now() - ilYaMs).etat;
  global.fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url));
    monde.journal.push(u);
    if (/\/api\/ship-reminders\?moment=sondes$/.test(u)) {
      const h = o.headers || {};
      monde.relances.push({ u, auth: h.Authorization || h.authorization || '' });
      if (monde.cronRepond === 200) monde.etat = etatA(0);   // le passage du cron range un état frais
      return J(monde.cronRepond, { ok: monde.cronRepond === 200, moment: 'sondes' });
    }
    if (new RegExp(`owner=eq\\.${NEUTRE}&id=eq\\.statut_sondes&select=data&limit=1$`).test(u)) return J(200, monde.etat ? [{ data: JSON.parse(JSON.stringify(monde.etat)) }] : []);
    if (/\/auth\/v1\/settings$/.test(u)) return J(200, { external: { email: true } });
    return J(200, []);
  };
  const compte = await import(require('url').pathToFileURL(COMPTE).href);
  const L = await import(require('url').pathToFileURL(LIB).href);
  const sante = async (headers = {}) => {
    const res = { code: 0, corps: null, h: {}, setHeader(k, v) { this.h[k] = v; }, getHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.corps = x; return this; }, end() {} };
    await compte.default({ method: 'GET', query: { mode: 'sante' }, headers, url: '/api/sante' }, res);
    return res;
  };
  const remise = () => { L.oublierStatutPublic(); if (L.oublierRelance) L.oublierRelance(); monde.relances = []; };

  // R1. Un état rangé il y a 2 h : une relance, l'état relu est frais.
  remise(); monde.etat = etatA(2 * 3600e3); monde.cronRepond = 200;
  const r1 = await sante();
  const st1 = r1.corps && r1.corps.statut;
  dit(monde.relances.length === 1 && monde.relances[0].u === 'https://vrm.center/api/ship-reminders?moment=sondes' && monde.relances[0].auth === 'Bearer secret-cron-de-banc', 'R1 état de 2 h ⇒ UNE relance de la route du cron, avec son secret, vers vrm.center', monde.relances);
  dit(r1.code === 200 && st1 && st1.perime === false && Object.values(st1.composants).every((x) => x.etat === 'ok'), 'R1 l’état relu après la relance est rendu (frais : « ok », plus « sondes arrêtées »)', st1 && { perime: st1.perime, base: st1.composants && st1.composants.base });

  // R2. Relance qui échoue : l'état d'avant (« pas su »), et pas de seconde relance dans les 10 min.
  remise(); monde.etat = etatA(2 * 3600e3); monde.cronRepond = 503;
  const r2 = await sante();
  const st2 = r2.corps && r2.corps.statut;
  dit(r2.code === 200 && monde.relances.length === 1 && st2 && st2.perime === true && Object.values(st2.composants).every((x) => x.etat === 'pas_su' && x.raison === 'sondes-arretees'), 'R2 relance ratée (503) ⇒ l’état d’avant, « pas su » partout (jamais un faux « ok »)', st2 && st2.composants);
  L.oublierStatutPublic();
  await sante();
  dit(monde.relances.length === 1, 'R2 pas de seconde relance avant 10 min (une par instance)', monde.relances.length);

  // R3. Un état de 5 min : aucune relance.
  remise(); monde.etat = etatA(5 * 60e3); monde.cronRepond = 200;
  await sante();
  dit(monde.relances.length === 0, 'R3 état de 5 min ⇒ aucune relance', monde.relances.length);

  // R4. Sans CRON_SECRET : aucune relance (et l'état reste ce qu'il est).
  remise(); monde.etat = etatA(2 * 3600e3);
  const sec = process.env.CRON_SECRET; delete process.env.CRON_SECRET;
  const r4 = await sante();
  process.env.CRON_SECRET = sec;
  dit(monde.relances.length === 0 && r4.corps && r4.corps.statut && r4.corps.statut.perime === true, 'R4 sans CRON_SECRET ⇒ aucune relance, l’état périmé reste « pas su »', monde.relances.length);

  // R5. Un en-tête Host piégé : le secret ne part que vers l'adresse fixe du site.
  remise(); monde.etat = etatA(2 * 3600e3); monde.cronRepond = 200;
  await sante({ host: 'piege.exemple', 'x-forwarded-host': 'piege.exemple' });
  dit(monde.relances.length === 1 && monde.relances.every((x) => x.u.indexOf('https://vrm.center/') === 0) && !monde.journal.some((u) => /piege/.test(u)), 'R5 un Host piégé ne détourne jamais le secret (adresse fixe)', monde.relances);

  fini = true;
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ /api/sante relance les sondes quand GitHub ne les a pas lancées');
  process.exit(ko ? 1 : 0);
})().catch((e) => { fini = true; console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
