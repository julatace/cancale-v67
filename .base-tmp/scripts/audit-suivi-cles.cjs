#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT (16 nov., décision de Julien : « on laisse tomber, enlève, on garde le suivi de Vinted »)
//  AUCUN SUIVI COLISSIMO / LA POSTE NI UPS PAR CLÉ.
//  Le lot 89 (13 nov.) lisait La Poste « Suivi v2 » et UPS « Tracking » avec les variables Vercel de
//  l'installation, puis le lot transporteurs-suivi avec la clé du vendeur : les deux sont RETIRÉS.
//  Ce contrôle rougit si l'un revient :
//   S1 aucun module de clé (api/_lib/cles-transporteurs.js), aucun écran (src/parametres/ClesSuivi.jsx),
//      aucune route `mode=cles-suivi`, aucune rangée `cles-suivi` dans Paramètres ;
//   S2 aucun appel, en-tête ou variable de clé dans le CODE (commentaires retirés) : api.laposte.fr,
//      onlinetools.ups.com, X-Okapi-Key, LAPOSTE_OKAPI_KEY, UPS_CLIENT_ID / _SECRET ;
//   S3 aucun texte affiché qui propose une clé (dictionnaires, retraitSuivi) ;
//   R/E EXÉCUTÉ : variables Vercel d'avant posées, colis Colissimo et UPS en base ⇒ la règle partagée ne
//      les rend jamais lisibles, et le VRAI passage (api/_lib/transporteurs-lecture.js) n'envoie AUCUNE
//      requête à La Poste ni à UPS, ne crée aucune ligne `transp_` / `depart_` Colissimo ou UPS ; la ligne
//      du colis dit « suivi lu par Vinted et les e-mails » (jamais une clé).
//  `--prouve` : chaque mutation (une clé qui revient) doit rendre ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const MUTATIONS = {
  'colissimo-lisible': [['api/_lib/transporteurs.js', "  else if (/vinted/.test(c)) k = 'vinted';\n", "  else if (/vinted/.test(c)) k = 'vinted';\n  else if (/coliss|la\\s*poste/.test(c)) return 'colissimo';\n"]],
  'appel-la-poste': [['api/_lib/transporteurs-lecture.js', "  if (carrier === 'vinted') return `https://carrier.vintedgo.com/public/v3/tracking_events/${n}`;\n", "  if (carrier === 'vinted') return `https://carrier.vintedgo.com/public/v3/tracking_events/${n}`;\n  if (carrier === 'colissimo') return `https://api.laposte.fr/suivi/v2/idships/${n}`;\n"]],
  'variable-vercel': [['api/_lib/transporteurs.js', 'export const lectureServeurActive = (carrier) => !!LECTURE_SERVEUR_TRANSP[carrier];', "export const lectureServeurActive = (carrier) => !!LECTURE_SERVEUR_TRANSP[carrier] || (carrier === 'colissimo' && !!(globalThis.process && process.env.LAPOSTE_OKAPI_KEY));\nexport const CARRIERS_CLE_REVENU = ['colissimo'];"], ['api/_lib/transporteurs.js', 'export const CARRIERS_SERVEUR = Object.freeze([...CARRIERS_LUS]);', "export const CARRIERS_SERVEUR = Object.freeze([...CARRIERS_LUS, ...(globalThis.process && process.env.LAPOSTE_OKAPI_KEY ? ['colissimo'] : [])]);"]],
  'texte-qui-propose-une-cle': [['src/retraitSuivi.js', "geste: `Regarde ses e-mails ou le site de ${nl}.` };", "geste: `Colle ta clé ${nl} gratuite dans Paramètres.` };"]],
  'rangee-parametres': [['src/parametres/categories.js', "items: ['sms-colis', 'carte-merci']", "items: ['sms-colis', 'cles-suivi', 'carte-merci']"]],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 260)); } };
const importer = (p) => import('file://' + path.join(R, p));
const J = (x) => JSON.stringify(x);
const lire = (p) => { try { return fs.readFileSync(path.join(R, p), 'utf8'); } catch (_) { return ''; } };
const fichiers = (dir, re) => { const out = []; const pas = (d) => { for (const e of fs.readdirSync(path.join(R, d), { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules/.test(p)) pas(p); } else if (re.test(e.name)) out.push(p); } }; pas(dir); return out; };

// ── S1–S3 : ce qui ne doit plus exister ─────────────────────────────────────
{
  dit(!fs.existsSync(path.join(R, 'api/_lib/cles-transporteurs.js')) && !fs.existsSync(path.join(R, 'src/parametres/ClesSuivi.jsx')), 'S1 ni module de clé de suivi (cles-transporteurs.js) ni écran (ClesSuivi.jsx)');
  const compte = sansCommentaires(lire('api/compte.js'));
  const cats = lire('src/parametres/categories.js'), regl = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
  dit(!/cles-suivi/.test(compte) && !/cles-suivi/.test(cats) && !/cles-suivi/.test(regl), 'S1 aucune route `mode=cles-suivi`, aucune rangée « Suivi Colissimo et UPS » dans Paramètres');
  const motifs = [/api\.laposte\.fr/, /onlinetools\.ups\.com/, /X-Okapi-Key/i, /LAPOSTE_OKAPI_KEY/, /UPS_CLIENT_(?:ID|SECRET)/];
  const touches = [];
  for (const f of [...fichiers('api', /\.js$/), ...fichiers('src', /\.(js|jsx)$/)]) {
    const t = sansCommentaires(lire(f));
    for (const re of motifs) if (re.test(t)) touches.push(`${f} ${re.source}`);
  }
  dit(touches.length === 0, 'S2 aucun appel, en-tête ni variable de clé La Poste / UPS dans le code (api/, src/)', touches.slice(0, 6).join(' · '));
  const cles = fichiers('src/i18n/langues', /\.js$/).filter((f) => /"(?:clesSuivi\.|reglages\.cles-suivi|suiviVente\.sansCle)/.test(lire(f)));
  dit(cles.length === 0, 'S3 aucun texte « colle ta clé » de suivi dans les dictionnaires', cles.join(' · '));
}

(async () => {
  let T = null, L = null, O = null, RS = null, D = null;
  await essaie('les modules', async () => {
    T = await importer('api/_lib/transporteurs.js');
    L = await importer('api/_lib/transporteurs-lecture.js');
    O = await importer('api/_lib/owner.js');
    RS = await importer('src/retraitSuivi.js');
    D = await importer('api/_lib/depart-colis.js');
  });
  if (!T || !L || !O || !RS || !D) { console.log(`\n❌ audit-suivi-cles : ${ko} rouge(s)`); process.exit(1); }
  const N_LP = '6A12345678901', N_UPS = '1Z999AA10123456784';
  process.env.LAPOSTE_OKAPI_KEY = 'cle-okapi-de-banc-0000'; process.env.UPS_CLIENT_ID = 'ups-id-de-banc-0000'; process.env.UPS_CLIENT_SECRET = 'ups-secret-de-banc-0000';

  // ── R : la règle partagée ─────────────────────────────────────────────────
  dit(T.carrierLisible('colissimo', N_LP) === null && T.carrierLisible('la poste', N_LP) === null && T.carrierLisible('ups', N_UPS) === null && T.carrierLuDeLigne('', N_LP) === null, 'R1 variables Vercel posées : Colissimo et UPS ne sont JAMAIS lisibles chez le transporteur');
  dit(T.carrierNonLu('colissimo') === 'Colissimo' && T.carrierNonLu('ups') === 'UPS' && !T.CARRIERS_SERVEUR.includes('colissimo') && !T.CARRIERS_SERVEUR.includes('ups'), 'R2 Colissimo et UPS restent « non lus » ; le serveur ne lit que Mondial Relay, Chronopost, Vinted Go', J(T.CARRIERS_SERVEUR));
  dit(D.carrierDepart('Colissimo', N_LP) === null && D.carrierDepart('UPS', N_UPS) === null, 'R3 un colis VENDU Colissimo / UPS n’est jamais lu comme départ');
  const pl = RS.pourquoiPasLu({ suivi: N_LP, carrier: 'colissimo', t: null });
  dit(pl && pl.code === 'non-lu' && /Vinted et les e-mails/.test(pl.texte) && !/clé|Paramètres/i.test(pl.texte + ' ' + pl.geste), 'R4 la ligne du colis : « Colissimo : suivi lu par Vinted et les e-mails », jamais une clé', J(pl));

  // ── E : le VRAI passage, variables Vercel posées, colis Colissimo et UPS en base ──
  await essaie('le passage', async () => {
    const A = '11111111-2222-3333-4444-555555555555';
    process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
    process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
    const base = new Map();
    const appels = [];
    const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
    const scal = (d) => { const m = {}; for (const [k, v] of Object.entries(d || {})) if (v != null && typeof v !== 'object') m[k] = String(v); return m; };
    global.fetch = async (url, opts = {}) => {
      const u = new URL(String(url)); const m = (opts.method || 'GET').toUpperCase();
      if (!/supabase\.co$/.test(u.hostname)) { appels.push(u.hostname); throw new TypeError('fetch failed'); }
      if (u.pathname !== '/rest/v1/app_data') return rep([]);
      if (m === 'POST' || m === 'PATCH') { try { for (const r of [].concat(JSON.parse(opts.body || '[]'))) if (r && r.id) base.set(r.id, r.data); } catch (_) {} return rep([], 201); }
      const id = u.searchParams.get('id') || '';
      const like = /^like\.(.*)$/.exec(id), eq = /^eq\.(.*)$/.exec(id);
      const re = like ? new RegExp('^' + like[1].replace(/[*%]/g, '.*') + '$') : null;
      const sel = (u.searchParams.get('select') || '').split(',');
      const rows = [...base.entries()].filter(([k]) => (re ? re.test(k) : eq ? k === eq[1] : false)).map(([k, d]) => { const o = { id: k }; const s = scal(d); for (const p of sel) { const [al, ch] = p.includes(':') ? p.split(/:(.+)/) : [p, p]; if (ch.startsWith('meta->>')) o[al] = s[ch.slice(7)] ?? null; else if (ch === 'data') o[al] = d; } return o; });
      return rep(rows);
    };
    const iso = new Date(Date.now() - 3 * 3600000).toISOString();
    base.set('main', { vrm_colis_collected: [] });
    base.set(`email_track_colissimo_${N_LP}`, { type: 'suivi', carrier: 'colissimo', suivi: N_LP, status: 'available', subject: `Votre colis ${N_LP} est disponible`, receivedAt: iso, sens: 'entrant' });
    base.set(`email_track_ups_${N_UPS}`, { type: 'suivi', carrier: 'ups', suivi: N_UPS, status: 'transit', subject: `UPS : votre colis ${N_UPS}`, receivedAt: iso, sens: 'entrant' });
    base.set('email_bord_9100000001', { type: 'bordereau', transaction: '9100000001', suivi: '6A12345678909', transporteur: 'colissimo', receivedAt: iso });
    const r = await O.contexteVendeur.run({ owner: A }, () => L.passageTransporteurs({ max: 12, budgetMs: 15000, maxDeparts: 6 }));
    const hotes = appels.filter((h) => /laposte|ups/.test(h));
    const lignes = [...base.keys()].filter((k) => /^(transp|depart)_(colissimo|ups)_/.test(k));
    dit(r && r.ok && hotes.length === 0 && lignes.length === 0, 'E1 variables Vercel posées : le passage n’envoie AUCUNE requête à La Poste ni à UPS et ne crée aucune ligne Colissimo / UPS', J({ ok: r && r.ok, hotes, lignes }));
    dit(r && !('lecture' in r), 'E2 la réponse du passage ne dit plus rien de « clés » à l’app', J(r && Object.keys(r)));
  });
  for (const k of ['LAPOSTE_OKAPI_KEY', 'UPS_CLIENT_ID', 'UPS_CLIENT_SECRET']) delete process.env[k];

  console.log(ko ? `\n❌ audit-suivi-cles : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-suivi-cles : ${ok} verts — aucun suivi Colissimo / UPS par clé (décision du 16 nov.) ; Vinted et les e-mails font foi`);
  process.exit(ko ? 1 : 0);
})();
