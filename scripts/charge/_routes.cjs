// ════════════════════════════════════════════════════════════════════════════
//  Exécuter les VRAIES routes `api/*` contre le faux PostgREST (scripts/charge).
//  · `preparer(B)` pose l'environnement AVANT d'importer une route (les routes
//    lisent `process.env` au chargement) : SUPABASE_URL = la base locale, une
//    clé de service de banc, CRON_SECRET de banc ; et `brancherFetch` : toute
//    URL qui n'est pas la base locale est refusée (aucun appel ne sort, jamais).
//  · `appeler(route, req)` : un faux couple req/res de Vercel, la durée et le
//    statut, et la route notée sur chaque requête faite à la base.
//  · `semer(B)` : ce qui fait d'un vendeur inventé un vendeur « installé » —
//    une clé de widget indexée, un registre d'adresses de réception PROUVÉES.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const crypto = require('crypto');
const { brancherFetch, NEUTRE, appelCourant } = require('./_faux-postgrest.cjs');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..', '..');

let fetchBranche = null;
function preparer(B) {
  // Sans serveur HTTP (appel dans le même processus), une adresse locale fictive :
  // `brancherFetch` la sert sans réseau.
  if (!B.url) B.url = 'http://127.0.0.1:9';
  process.env.SUPABASE_URL = B.url;
  process.env.SUPABASE_SERVICE_KEY = B.cleService;
  process.env.SUPABASE_KEY = 'cle-publique-banc';
  process.env.CRON_SECRET = 'secret-cron-banc';
  process.env.EMAIL_INBOUND_SECRET = 'secret-reception-banc';
  process.env.VRM_OWNER_UID = B.owners[0];
  process.env.VRM_CRON_BUDGET_MS = process.env.VRM_CRON_BUDGET_MS || '240000';
  // Aucun e-mail, aucune notification réelle : pas de SMTP, pas de clés VAPID.
  for (const k of Object.keys(process.env)) if (/^RELANCES_SMTP|^VAPID|^STRIPE|^EBAY_|^ANTHROPIC|^PHOTOROOM|^DISCORD|^DOMAINE_RECEPTION/.test(k)) delete process.env[k];
  if (!fetchBranche) fetchBranche = brancherFetch(B);
  return fetchBranche;
}
const modules = {};
async function route(nom) {
  if (!modules[nom]) modules[nom] = (await import(path.join(RACINE, 'api', nom + '.js'))).default;
  return modules[nom];
}
function fauxRes() {
  const res = { code: 200, corps: null, entetes: {}, fini: false,
    setHeader(k, v) { this.entetes[String(k).toLowerCase()] = v; return this; },
    getHeader(k) { return this.entetes[String(k).toLowerCase()]; },
    status(c) { this.code = c; return this; },
    json(x) { this.corps = x; this.fini = true; return this; },
    send(x) { this.corps = x; this.fini = true; return this; },
    end(x) { if (x !== undefined) this.corps = x; this.fini = true; return this; },
    write() { return true; }, writeHead(c) { this.code = c; return this; } };
  return res;
}
async function appeler(B, nom, req, etiquette) {
  const h = await route(nom);
  B.route(etiquette || nom);
  const res = fauxRes();
  const a = { requetes: 0, octetsSortis: 0, octetsEntres: 0 };
  const t0 = Date.now();
  let erreur = null;
  try { await appelCourant.run(a, () => h({ method: 'GET', query: {}, headers: {}, ...req }, res)); } catch (e) { erreur = String((e && e.stack) || e).slice(0, 400); }
  return { route: etiquette || nom, ms: Date.now() - t0, code: erreur ? 500 : res.code, corps: res.corps, erreur,
    requetes: a.requetes, octetsSortis: a.octetsSortis, octetsEntres: a.octetsEntres };
}

const sha = (x) => crypto.createHash('sha256').update(String(x), 'utf8').digest('hex');
// Le vendeur i : sa clé de widget (indexée, comme après le premier passage), son
// adresse de réception déclarée ET prouvée (registre + preuve chez le neutre).
async function semer(B, { adresses = true } = {}) {
  const main = B.gabarit.find((r) => r.id === 'main');
  const { idPreuve } = await import(path.join(RACINE, 'api', '_lib', 'preuve-adresse.js'));
  B.owners.forEach((o, i) => {
    const jeton = `widget-banc-${i}-${sha(o).slice(0, 16)}`;
    B.poser(o, 'main', { ...main.data, vrm_widget_token: jeton });
    B.poser(NEUTRE, `jeton_widget_${sha(jeton)}`, { owner: o, genre: 'widget', at: new Date().toISOString() });
    if (adresses) {
      const adr = `vendeur${i}@exemple.invalid`;
      B.poser(o, 'vrm_email_owners', { adresses: { [adr]: { owner: o, label: 'boîte' } }, updatedAt: new Date().toISOString() });
      B.poser(NEUTRE, idPreuve(o, adr), { owner: o, adresse: adr, etat: 'prouvee', prouveeLe: new Date().toISOString() });
    }
  });
  return { jetonWidget: (i) => `widget-banc-${i}-${sha(B.owners[i]).slice(0, 16)}`, adresse: (i) => `vendeur${i}@exemple.invalid` };
}

module.exports = { preparer, appeler, semer, route, NEUTRE };
