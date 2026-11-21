// ════════════════════════════════════════════════════════════════════════════
//  SANS CLÉ DE SERVICE, LA ROUTE RÉPOND 503 ET NE LIT RIEN (7 nov., audit
//  « 1 000 vendeurs »). Ces routes retombaient en silence sur la clé PUBLIQUE :
//  sous RLS elle ne voit aucune ligne, et le cron répondait « 0 vendeur »
//  (200), le widget « clé invalide ». On EXÉCUTE chaque route (son vrai
//  `handler`) dans un processus neuf, SANS `SUPABASE_SERVICE_KEY`, contre un
//  faux réseau qui note chaque appel à la base :
//   K1. le cron du matin et du soir, le widget (et sa route SMS), les e-mails
//       entrants, le rattachement des e-mails, la connexion et le
//       rafraîchissement des comptes Vinted ⇒ 503 `cle-service-absente`, et
//       AUCUNE requête à `/rest/v1/` ;
//   K2. avec la clé, la même route passe ce garde (elle lit la base) — le
//       garde ne ferme pas une route configurée (elle lit la base, ou répond
//       autre chose qu'un 503 — la connexion Vinted parle d'abord à Vinted).
//  `--prouve` : chaque mutation rougit.
//  Lancer : node scripts/audit-cle-service.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const path = require('path');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'garde qui laisse passer': [['api/_lib/cle-service.js', 'if (cleServicePresente(env)) return false;', 'return false;']],
  'cron sans garde': [['api/ship-reminders.js', '  if (repondreSansCleService(res)) return;\n', '']],
  'widget sans garde': [['api/widget.js', '  if (repondreSansCleService(res)) return;\n', '']],
  'e-mails entrants sans garde': [['api/email-inbound.js', '  if (repondreSansCleService(res)) return;\n', '']],
  'rafraîchissement sans garde': [['api/vinted-refresh.js', '  if (repondreSansCleService(res)) return;\n', '']],
};

// Un cas = une route exécutée dans un processus NEUF (les clés sont lues à l'import).
const CAS = [
  { nom: 'cron du matin', fichier: 'api/ship-reminders.js', req: { method: 'GET', query: {}, headers: { authorization: 'Bearer secret-cron' } } },
  { nom: 'cron du soir', fichier: 'api/ship-reminders.js', req: { method: 'GET', query: { moment: 'soir' }, headers: { authorization: 'Bearer secret-cron' } } },
  { nom: 'widget', fichier: 'api/widget.js', req: { method: 'GET', query: { k: 'Cle0123456789abcdefghijklmno' }, headers: {} } },
  { nom: 'SMS', fichier: 'api/widget.js', req: { method: 'POST', query: { mode: 'sms', k: 'Sms0123456789abcdefghijKLMNOPQRS' }, headers: {}, body: { texte: 'x' } } },
  { nom: 'e-mails entrants', fichier: 'api/email-inbound.js', req: { method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'secret-email' }, body: { from: 'a@b.c', to: 'x@y.z', subject: 's', text: 't' } } },
  { nom: 'rattachement des e-mails', fichier: 'api/email-rattacher.js', req: { method: 'GET', query: { mode: 'reception' }, headers: { authorization: 'Bearer a.b.c' } } },
  { nom: 'connexion Vinted', fichier: 'api/vinted-connect.js', req: { method: 'POST', query: {}, headers: { authorization: 'Bearer a.b.c' }, body: { refreshToken: 'r' } } },
  { nom: 'rafraîchissement Vinted', fichier: 'api/vinted-refresh.js', req: { method: 'GET', query: {}, headers: { authorization: 'Bearer a.b.c' } } },
];

const ENFANT = `
const path = require('path');
const [fichier, reqJson, avecCle] = process.argv.slice(1);
process.env.CRON_SECRET = 'secret-cron';
process.env.EMAIL_INBOUND_SECRET = 'secret-email';
process.env.VRM_OWNER_UID = '11111111-2222-4333-8444-555555555555';
delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_KEY;
if (avecCle === '1') process.env.SUPABASE_SERVICE_KEY = 'cle-service-test';
const base = [];
global.fetch = async (url) => {
  const u = String(url);
  if (/\\/auth\\/v1\\/user/.test(u)) return { ok: true, status: 200, json: async () => ({ id: '11111111-2222-4333-8444-555555555555', email: 'a@b.c' }), headers: { get: () => null } };
  if (/\\/rest\\/v1\\//.test(u)) base.push(u);
  return { ok: false, status: 500, json: async () => ({}), text: async () => '', headers: { get: () => null } };
};
(async () => {
  const res = { code: 0, corps: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.corps = x; return this; }, send(x) { this.corps = x; return this; }, end() { return this; } };
  const h = (await import(path.resolve(fichier))).default;
  const req = JSON.parse(reqJson);
  try { await h(req, res); } catch (e) { res.code = 'levee:' + e.message; }
  process.stdout.write(JSON.stringify({ code: res.code, erreur: res.corps && (res.corps.erreur || res.corps.error), base: base.length }));
  process.exit(0);
})();`;

function jouer(cas, avecCle) {
  const r = spawnSync(process.execPath, ['-e', ENFANT, path.join(R, cas.fichier), JSON.stringify(cas.req), avecCle ? '1' : '0'], { cwd: R, encoding: 'utf8', timeout: 60000 });
  try { return JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (_) { return { code: 'illisible', sortie: (r.stdout || '') + (r.stderr || '').slice(0, 300) }; }
}

if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
  let ko = 0, ok = 0;
  const vrai = (c, m) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m); } };
  for (const cas of CAS) {
    const sans = jouer(cas, false);
    vrai(sans.code === 503 && sans.erreur === 'cle-service-absente' && sans.base === 0, `K1 ${cas.nom} sans clé de service ⇒ 503 « cle-service-absente », aucune lecture (${JSON.stringify(sans)})`);
    const avec = jouer(cas, true);
    vrai(avec.erreur !== 'cle-service-absente' && (avec.base > 0 || (typeof avec.code === 'number' && avec.code !== 503)), `K2 ${cas.nom} avec la clé ⇒ le garde laisse passer (${JSON.stringify(avec)})`);
  }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
}
