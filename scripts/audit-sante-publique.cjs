#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// /api/sante NE DIT AUCUNE CONFIGURATION À N'IMPORTE QUI — node scripts/audit-sante-publique.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (12 nov., agent2-fiabilite-prod) La VRAIE route (api/compte.js?mode=sante),
// exécutée sur une fausse base :
//   P1 sans session : ok, serviceKey, owner (oui/non), etat, statut — et RIEN
//      d'autre : ni ia, ni détourage, ni Stripe, ni webhook, ni relances ;
//      gardée 30 s au cache partagé (la surveillance toutes les 5 min suffit) ;
//   P2 aucune valeur de variable d'environnement n'apparaît (secrets plantés) ;
//   P3 ce dont la surveillance a besoin est là : `ok: true`, `etat.base` ;
//   P4 la session d'un AUTRE compte, ou un jeton faux : comme sans session ;
//   P5 la session du PROPRIÉTAIRE : `config` (5 oui/non) et JAMAIS le cache
//      partagé (`private, no-store`).
// `--prouve` : chaque mutation doit rendre l'audit ROUGE.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const F = 'api/compte.js';
  const MUTS = [
    ['configuration remise en public', "    owner: !!process.env.VRM_OWNER_UID,\n    etat,", "    owner: !!process.env.VRM_OWNER_UID,\n    stripe: stripePret(),\n    etat,"],
    ['config donnée à toute session', "  if (!proprio || String(u.id).toLowerCase() !== proprio) return undefined;", '  if (!u) return undefined;'],
    ['config au cache partagé', "res.setHeader('Cache-Control', config ? 'private, no-store' : 'public, max-age=0, s-maxage=30');", "res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');"],
    ['la surveillance perd etat', '    etat,\n    statut,\n    config,', '    statut,\n    config,'],
  ];
  let rouges = 0;
  for (const [nom, avant, apres] of MUTS) {
    const f = path.join(R, F); const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 120000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  console.log(`\n${rouges === MUTS.length ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(rouges === MUTS.length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== '' ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } };
const JULIEN = '11111111-1111-4111-8111-111111111111';
const AUTRE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const SECRETS = {
  SUPABASE_SERVICE_KEY: 'sb_secret_invente_service_0123456789', AI_API_KEY: 'sk-invente-ia-987654', PHOTOROOM_API_KEY: 'photoroom-invente-555',
  STRIPE_SECRET_KEY: 'sk_test_invente_stripe_444', STRIPE_WEBHOOK_SECRET: 'whsec_invente_333', CRON_SECRET: 'cron-invente-222', EMAIL_INBOUND_SECRET: 'inbound-invente-111',
};
const JETONS = { 'a.jeton-julien.b': { id: JULIEN, email: 'julien@exemple.test' }, 'a.jeton-autre.b': { id: AUTRE, email: 'autre@exemple.test' } };
const rep = (c, st = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: st, headers: { 'content-type': 'application/json' } });
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const p = u.pathname;
  const h = Object.fromEntries(Object.entries(o.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (p.endsWith('/auth/v1/user')) { const x = JETONS[String(h.authorization || '').replace(/^Bearer /, '')]; return x ? rep(x) : rep({ msg: 'jwt' }, 401); }
  if (p.endsWith('/rest/v1/vrm_reglages')) return rep([{ valeur: JULIEN }]);
  if (p.endsWith('/rest/v1/app_data')) {
    const id = (u.searchParams.get('id') || '');
    if (/vrm_email_collecteur/.test(decodeURIComponent(u.search))) return rep([{ id: 'vrm_email_collecteur_succes', at: new Date(Date.now() - 60e3).toISOString(), etat: 'succes' }]);
    if (id === 'eq.statut_sondes') return rep([]);
    return rep([]);
  }
  return rep([]);
};
const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = JSON.parse(JSON.stringify(b)); return x; }; x.setHeader = (a, b) => { x.entetes[a] = b; }; x.end = () => x; return x; };

(async () => {
  Object.assign(process.env, SECRETS);
  process.env.VRM_OWNER_UID = JULIEN;
  delete process.env.VAPID_PRIVATE_KEY;
  const compte = await import('file://' + path.join(R, 'api', 'compte.js'));
  const sante = async (jeton) => { const res = faireRes(); await compte.default({ method: 'GET', query: { mode: 'sante' }, headers: jeton ? { authorization: 'Bearer ' + jeton } : {} }, res); return res; };
  const PUBLIQUES = ['etat', 'ok', 'owner', 'serviceKey', 'statut'];
  const CONFIG = ['detourage', 'ia', 'relancesEssai', 'stripe', 'stripeWebhook'];

  const p = await sante(null);
  const cles = Object.keys(p.corps || {}).sort();
  dit(p.code === 200 && JSON.stringify(cles) === JSON.stringify(PUBLIQUES), 'P1 sans session : ok, serviceKey, owner, etat, statut — rien d’autre', cles);
  dit(['ok', 'serviceKey', 'owner'].every((k) => typeof p.corps[k] === 'boolean'), 'P1 des oui/non');
  dit(/s-maxage=30/.test(p.entetes['Cache-Control'] || '') && /public/.test(p.entetes['Cache-Control'] || ''), 'P1 gardée 30 s au cache partagé', p.entetes);
  const texte = JSON.stringify(p.corps);
  const fuites = Object.entries(SECRETS).filter(([, v]) => texte.includes(v)).map(([k]) => k);
  dit(!fuites.length && !texte.includes(JULIEN), 'P2 aucune valeur de variable, aucun identifiant', fuites);
  dit(p.corps.ok === true && p.corps.etat && ['ok', 'panne', 'inconnu'].includes(p.corps.etat.base), 'P3 la surveillance a ce qu’il lui faut : ok et etat.base', p.corps.etat);
  for (const j of ['a.jeton-autre.b', 'a.jeton-faux.b', 'pas-un-jwt']) {
    const a = await sante(j);
    dit(JSON.stringify(Object.keys(a.corps).sort()) === JSON.stringify(PUBLIQUES), `P4 ${j} : comme sans session (aucune configuration)`, Object.keys(a.corps));
  }
  const q = await sante('a.jeton-julien.b');
  dit(q.corps.config && JSON.stringify(Object.keys(q.corps.config).sort()) === JSON.stringify(CONFIG) && CONFIG.every((k) => typeof q.corps.config[k] === 'boolean'), 'P5 le propriétaire connecté reçoit ses 5 oui/non de configuration', q.corps.config);
  dit(q.corps.config && q.corps.config.ia === true && q.corps.config.stripeWebhook === true, 'P5 qui disent vrai (variables posées ⇒ oui)', q.corps.config);
  dit(/private/.test(q.entetes['Cache-Control'] || '') && /no-store/.test(q.entetes['Cache-Control'] || ''), 'P5 jamais au cache partagé', q.entetes);
  const fq = Object.entries(SECRETS).filter(([, v]) => JSON.stringify(q.corps).includes(v)).map(([k]) => k);
  dit(!fq.length, 'P5 même au propriétaire : des oui/non, jamais une valeur', fq);
  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
