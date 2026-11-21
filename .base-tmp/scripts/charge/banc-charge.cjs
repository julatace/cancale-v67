// ════════════════════════════════════════════════════════════════════════════
//  BANC DE CHARGE LOCAL (9 nov., chantier « charge-sauvegarde »)
//
//  N vendeurs INVENTÉS (le poids mesuré de la base de Julien, sans une donnée
//  copiée : scripts/bancs/_base-volume.cjs) servis par un faux PostgREST local
//  (scripts/charge/_faux-postgrest.cjs). On exécute les VRAIES routes `api/*` :
//    · le cron du matin et celui du soir (api/ship-reminders.js), sur les N ;
//    · le widget iPhone (api/widget.js), un appel par vendeur, C en parallèle ;
//    · la réception des e-mails (api/email-inbound.js) : par l'ancien registre
//      d'adresses (Gmail transféré) — la lecture qui grandit avec N ;
//    · (APP=k) le démarrage de l'app (dist/, Chromium headless, k vendeurs
//      différents en même temps), lectures servies par la même base.
//  Mesuré : latence (p50/p95/max), erreurs, requêtes à la base, octets envoyés
//  par la base (l'égress de Supabase), par famille de lignes.
//
//  ⚠️ JAMAIS UN APPEL À LA PRODUCTION : `fetch` du processus ne sert que la
//  base locale (l'adresse Supabase de production est servie par elle) ; toute
//  autre URL est refusée et COMPTÉE (`externes`) ; dans Chromium, toute URL
//  qui n'est pas locale est coupée. Aucune notification, aucun e-mail ne part
//  (pas de clés VAPID ni SMTP dans l'environnement du banc).
//
//  Lancer :  node scripts/charge/banc-charge.cjs [--vendeurs 50] [--conc 8]
//              [--emails 40] [--app 0] [--json sortie.json] [--seulement cron,widget,email,app]
//  `--app k` demande `dist/` (npm run build) et Chromium (/opt/pw-browsers).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..', '..');
const { creerBase } = require('./_faux-postgrest.cjs');
const { preparer, appeler, semer } = require('./_routes.cjs');

const arg = (nom, def) => { const i = process.argv.indexOf('--' + nom); return i > 0 ? process.argv[i + 1] : def; };
const N = +arg('vendeurs', process.env.VENDEURS || 50);
const CONC = +arg('conc', 8);
const NB_EMAILS = +arg('emails', 40);
const APP = +arg('app', 0);
const SEUL = String(arg('seulement', 'cron,widget,email,app')).split(',');
const SORTIE = arg('json', null);

const pct = (l, p) => { if (!l.length) return null; const s = [...l].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const Ko = (o) => Math.round(o / 1024);
async function enParallele(taches, c) {
  const out = new Array(taches.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(c, taches.length) }, async () => { while (i < taches.length) { const k = i++; out[k] = await taches[k](); } }));
  return out;
}
function resume(nom, res, B) {
  const ms = res.map((r) => r.ms);
  const o = {
    scenario: nom, appels: res.length, erreurs: res.filter((r) => r.code >= 500 || r.erreur).length,
    codes: res.reduce((a, r) => { a[r.code] = (a[r.code] || 0) + 1; return a; }, {}),
    p50_ms: pct(ms, 50), p95_ms: pct(ms, 95), max_ms: Math.max(0, ...ms),
    requetes_par_appel: +(res.reduce((a, r) => a + r.requetes, 0) / Math.max(1, res.length)).toFixed(1),
    Ko_sortis_par_appel: Ko(res.reduce((a, r) => a + r.octetsSortis, 0) / Math.max(1, res.length)),
    Ko_entres_par_appel: Ko(res.reduce((a, r) => a + r.octetsEntres, 0) / Math.max(1, res.length)),
    familles: Object.entries(B.compteurs.parFamille).sort((a, b) => b[1].sortis - a[1].sortis).slice(0, 6).map(([k, v]) => `${k} ${v.n}× ${Ko(v.sortis)} Ko`),
  };
  return o;
}

(async () => {
  const t0 = Date.now();
  const B = creerBase({ vendeurs: N });
  const fetchB = preparer(B);
  const graines = await semer(B);
  const rapport = { vendeurs: N, conc: CONC, scenarios: [] };
  const dire = (o) => { rapport.scenarios.push(o); console.log(JSON.stringify(o)); };

  if (SEUL.includes('cron')) {
    for (const [et, q] of [['cron-matin', {}], ['cron-soir', { moment: 'soir' }]]) {
      B.remettre();
      const r = await appeler(B, 'ship-reminders', { query: q, headers: { authorization: 'Bearer secret-cron-banc' } }, et);
      const lot = (r.corps && r.corps.lot) || {};
      const o = resume(et, [r], B);
      o.vendeurs_traites = lot.traites; o.restants = lot.restants; o.budgetAtteint = lot.budgetAtteint;
      o.par_vendeur = { requetes: +(r.requetes / Math.max(1, lot.traites || N)).toFixed(1), Ko_sortis: Ko(r.octetsSortis / Math.max(1, lot.traites || N)), ms: Math.round(r.ms / Math.max(1, lot.traites || N)) };
      o.echecs = r.corps && r.corps.echecs;
      dire(o);
    }
  }
  if (SEUL.includes('widget')) {
    B.remettre();
    const res = await enParallele(B.owners.map((_, i) => () => appeler(B, 'widget', { query: { k: graines.jetonWidget(i) } }, 'widget')), CONC);
    dire(resume('widget', res, B));
  }
  if (SEUL.includes('email')) {
    B.remettre();
    const res = await enParallele(Array.from({ length: NB_EMAILS }, (_, k) => () => {
      const i = k % N;
      const body = { messageId: `<banc-charge-${k}-${Date.now()}@exemple.invalid>`, to: graines.adresse(i), from: 'Vinted <no-reply@vinted.fr>',
        subject: `Nouveau message de acheteur${k}`, text: `Bonjour, la paire est-elle toujours disponible ? (banc ${k})`, html: '', attachments: [] };
      return appeler(B, 'email-inbound', { method: 'POST', headers: { 'x-vrm-email-key': 'secret-reception-banc' }, body }, 'email-inbound');
    }), CONC);
    const o = resume('email-inbound (registre)', res, B);
    const reg = B.compteurs.parFamille['vrm_email_owners'] || { n: 0, sortis: 0 };
    const pre = B.compteurs.parFamille['vrm_email_preuve_H'] || Object.entries(B.compteurs.parFamille).filter(([k]) => /preuve/.test(k)).reduce((a, [, v]) => ({ n: a.n + v.n, sortis: a.sortis + v.sortis }), { n: 0, sortis: 0 });
    o.registre_Ko_par_email = Ko((reg.sortis + pre.sortis) / Math.max(1, res.length));
    dire(o);
  }
  if (SEUL.includes('app') && APP > 0) {
    const { demarrages } = require('./_app.cjs');
    B.remettre();
    const res = await demarrages(B, APP);
    dire(res);
  }
  rapport.externes_refuses = fetchB.sorties.length;
  rapport.externes = [...new Set(fetchB.sorties.map((u) => u.replace(/^(https?:\/\/[^/]+).*$/, '$1')))];
  rapport.duree_s = Math.round((Date.now() - t0) / 1000);
  console.log(JSON.stringify({ externes_refuses: rapport.externes_refuses, externes: rapport.externes, duree_s: rapport.duree_s }));
  if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(rapport, null, 1));
  process.exit(0);
})().catch((e) => { console.error('banc planté : ' + (e && e.stack || e)); process.exit(1); });
