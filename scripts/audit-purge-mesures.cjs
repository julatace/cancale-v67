// ════════════════════════════════════════════════════════════════════════════
//  LA PURGE À 90 JOURS DES TEMPS RÉELS (7 nov., décision du 6 nov.) — EXÉCUTÉE.
//  `purgerMesuresAnciennes` (api/_lib/mesures-terrain.js), branchée sur le cron
//  du matin (api/ship-reminders.js), contre un FAUX fetch qui sert la vraie forme
//  de PostgREST : `select=id` ⇒ [{ id }], pagination par l'en-tête `Range`
//  (1 000 lignes au plus par réponse), filtres `owner=eq.` et `id=like.`.
//
//  P1. Nominal : seuls les jours STRICTEMENT avant « aujourd'hui − 90 j » (jour de
//      Paris) partent ; le jour du seuil, hier, aujourd'hui restent ; un id dont le
//      jour n'est pas une vraie date (30 février, texte) est gardé ; une autre
//      ligne (`mesures_resume`, autre préfixe) n'est jamais visée.
//  P2. Lecture PROJETÉE : aucune requête ne demande `data` ; chaque requête porte
//      le propriétaire ; la suppression ne nomme QUE des ids `mesures_jour_*`.
//  P3. Lecture KO (500, exception réseau, JSON illisible, page 2 en panne après
//      une page 1 pleine) ⇒ AUCUNE suppression.
//  P4. Pagination : 2 500 lignes ⇒ les trois pages lues, toutes les vieilles
//      supprimées (Supabase plafonne à 1 000 sans le dire).
//  P5. Propriétaire inconnu ⇒ aucune requête. Suppression ratée ⇒ dite, pas levée.
//  P6. Le cron du matin l'appelle (ni le soir ni au réveil), avec le propriétaire
//      de l'installation, et la dit dans sa réponse.
//  Données inventées (dépôt public). `--prouve` : chaque mutation rougit.
//  Lancer : node scripts/audit-purge-mesures.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const path = require('path'), fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const LIB = 'api/_lib/mesures-terrain.js';
const MUTATIONS = {
  'lecture ratée qui supprime quand même': [[LIB, "if (!r || !r.ok) return { fait: false, raison: 'lecture', statut: r ? r.status : null, seuil };", "if (!r || !r.ok) break;"]],
  'exception de lecture avalée': [[LIB, "} catch (e) { return { fait: false, raison: 'lecture', erreur:", "} catch (e) { if (0) return { fait: false, raison: 'lecture', erreur:"]],
  'JSON illisible pris pour une liste vide': [[LIB, "if (!Array.isArray(j)) return { fait: false, raison: 'lecture', seuil };", "if (!Array.isArray(j)) j = [];"]],
  'lecture select=data': [[LIB, "*&select=id&order=id.asc`", "*&select=id,data&order=id.asc`"]],
  'pas de pagination': [[LIB, "if (j.length < page) break;", "break;"]],
  'le jour du seuil supprimé': [[LIB, "if (j && j < seuil) out.push(String(id));", "if (j && j <= seuil) out.push(String(id));"]],
  'éclats jamais purgés': [[LIB, "const RE_ID_JOUR = RE_ID_MESURES;", "const RE_ID_JOUR = /^mesures_jour_(\\d{4}-\\d{2}-\\d{2})$/;"]],
  'éclat ramené à l’ancienne forme': [[LIB, "if (j && j < seuil) out.push(String(id));", "if (j && j < seuil) out.push(idJour(j));"]],
  '30 jours au lieu de 90': [[LIB, "export const JOURS_GARDES = 90;", "export const JOURS_GARDES = 30;"]],
  'date pas vérifiée': [[LIB, "if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== m[1]) return null;", ""]],
  'suppression chez tous les vendeurs': [[LIB, "await fetcher(`${url}/rest/v1/app_data?owner=eq.${p}&id=in.(", "await fetcher(`${url}/rest/v1/app_data?id=in.("]],
  'propriétaire pas exigé': [[LIB, "if (!RE_UUID.test(p)) return { fait: false, raison: 'proprietaire', seuil };", ""]],
  'cron qui ne purge pas': [['api/ship-reminders.js', "purgeMesures = await purgerMesuresAnciennes({", "purgeMesures = await (async () => null)({"]],
  'cron qui purge aussi le soir': [['api/ship-reminders.js', "if (!soir && !reveil) { try { purgeMesures =", "if (true) { try { purgeMesures ="]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const vrai = (c, m) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m); } };

const PROPRIO = '11111111-2222-4333-8444-555555555555';
const URL_BASE = 'https://base.invalid';
const JOUR = 864e5;
// Midi UTC : le jour de Paris ne bascule pas pendant le test (leçon du 6 nov.).
const MAINTENANT = Date.parse('2026-11-07T12:00:00Z');
const jourIl = (n) => new Date(MAINTENANT - n * JOUR).toISOString().slice(0, 10);

// Le faux PostgREST : lignes { owner, id, data } ; sert la forme réelle.
function fauxFetch(lignes, opts = {}) {
  const appels = [];
  const f = async (url, init = {}) => {
    const methode = (init.method || 'GET').toUpperCase();
    const u = new URL(url);
    const q = u.searchParams;
    appels.push({ methode, url: decodeURIComponent(url), headers: init.headers || {} });
    if (opts.panne && opts.panne(methode, appels.filter((a) => a.methode === methode).length, init)) {
      const p = opts.panne(methode, appels.filter((a) => a.methode === methode).length, init);
      if (p === 'jette') throw new Error('réseau coupé');
      if (p === 'illisible') return { ok: true, status: 200, json: async () => { throw new Error('json'); } };
      if (p === 'objet') return { ok: true, status: 200, json: async () => ({ message: 'pas une liste' }) };
      return { ok: false, status: p, json: async () => ({}) };
    }
    let sel = lignes.filter((l) => !q.get('owner') || q.get('owner') === 'eq.' + l.owner);
    const id = q.get('id');
    if (id && id.startsWith('like.')) { const pre = id.slice(5).replace(/\*$/, ''); sel = sel.filter((l) => l.id.startsWith(pre)); }
    if (id && id.startsWith('in.(')) { const set = new Set(id.slice(4, -1).split(',')); sel = sel.filter((l) => set.has(l.id)); }
    if (id && id.startsWith('eq.')) sel = sel.filter((l) => l.id === id.slice(3));
    if (methode === 'DELETE') {
      for (const l of sel) lignes.splice(lignes.indexOf(l), 1);
      return { ok: true, status: 204, json: async () => null };
    }
    sel = [...sel].sort((a, b) => (a.id < b.id ? -1 : 1));
    const range = (init.headers || {}).Range;
    let de = 0, a = sel.length - 1;
    if (range) { const m = /^(\d+)-(\d+)$/.exec(range); de = +m[1]; a = +m[2]; }
    a = Math.min(a, de + 999);   // le plafond silencieux de Supabase
    const champs = String(q.get('select') || '').split(',');
    const page = sel.slice(de, a + 1).map((l) => { const o = {}; for (const c of champs) if (c in l) o[c] = l[c]; return o; });
    return { ok: true, status: 206, json: async () => page };
  };
  f.appels = appels;
  return f;
}
const ligne = (id, owner = PROPRIO) => ({ owner, id, data: { v: 1, h: { lourd: 'x'.repeat(50) } } });

(async () => {
  const { purgerMesuresAnciennes, idsMesuresAPurger, seuilPurgeMesures, jourDeId } = await import(path.join(R, LIB));
  const lancer = (f, extra = {}) => purgerMesuresAnciennes({ url: URL_BASE, headers: { apikey: 'faux' }, proprietaire: PROPRIO, fetcher: f, maintenant: MAINTENANT, ...extra });

  // ── P1 + P2. Nominal ─────────────────────────────────────────────────────
  const seuil = seuilPurgeMesures(MAINTENANT);
  vrai(seuil === jourIl(90), `P1 seuil = aujourd'hui − 90 j (${seuil})`);
  const AUTRE = '99999999-2222-4333-8444-555555555555';
  const base = [
    ligne('mesures_jour_' + jourIl(0)), ligne('mesures_jour_' + jourIl(1)), ligne('mesures_jour_' + jourIl(89)),
    ligne('mesures_jour_' + jourIl(90)), ligne('mesures_jour_' + jourIl(91)), ligne('mesures_jour_' + jourIl(400)),
    ligne('mesures_jour_2025-02-30'), ligne('mesures_jour_ancien'), ligne('mesures_resume'), ligne('main'),
    ligne('mesures_jour_' + jourIl(200), AUTRE),
  ];
  const f1 = fauxFetch(base);
  const r1 = await lancer(f1);
  const restants = base.map((l) => l.owner + ':' + l.id);
  vrai(r1.fait === true && r1.retirees === 2, `P1 deux vieilles lignes retirées (rendu ${JSON.stringify(r1)})`);
  vrai(!restants.includes(PROPRIO + ':mesures_jour_' + jourIl(91)) && !restants.includes(PROPRIO + ':mesures_jour_' + jourIl(400)), 'P1 91 j et 400 j supprimés');
  for (const n of [0, 1, 89, 90]) vrai(restants.includes(PROPRIO + ':mesures_jour_' + jourIl(n)), `P1 ${n} j gardé`);
  vrai(restants.includes(PROPRIO + ':mesures_jour_2025-02-30'), 'P1 un faux jour (30 février) est gardé');
  vrai(restants.includes(PROPRIO + ':mesures_jour_ancien') && restants.includes(PROPRIO + ':mesures_resume') && restants.includes(PROPRIO + ':main'), 'P1 les autres lignes sont gardées');
  vrai(restants.includes(AUTRE + ':mesures_jour_' + jourIl(200)), "P1 la ligne d'un AUTRE vendeur n'est pas touchée");
  vrai(f1.appels.every((a) => !/select=[^&]*\bdata\b/.test(a.url)), 'P2 aucune requête ne demande `data`');
  vrai(f1.appels.filter((a) => a.methode === 'GET').every((a) => /select=id(&|$)/.test(a.url)), 'P2 la lecture est projetée sur `id`');
  vrai(f1.appels.every((a) => a.url.includes('owner=eq.' + PROPRIO)), 'P2 chaque requête porte le propriétaire');
  const dels = f1.appels.filter((a) => a.methode === 'DELETE');
  vrai(dels.length === 1 && dels.every((a) => { const m = /id=in\.\(([^)]*)\)/.exec(a.url); return m && m[1].split(',').every((x) => jourDeId(x)); }), 'P2 la suppression ne nomme que des ids `mesures_jour_` datés');
  vrai(JSON.stringify(idsMesuresAPurger(['mesures_jour_' + jourIl(91), 'mesures_jour_' + jourIl(91), 'x'], MAINTENANT)) === JSON.stringify(['mesures_jour_' + jourIl(91)]), 'P1 règle pure : dédoublonnée, rien d’autre');

  // ── P3. Lecture KO ⇒ aucune suppression ──────────────────────────────────
  const vieilles = () => [ligne('mesures_jour_' + jourIl(100)), ligne('mesures_jour_' + jourIl(120))];
  for (const [nom, panne] of [
    ['statut 500', (m) => (m === 'GET' ? 500 : 0)],
    ['exception réseau', (m) => (m === 'GET' ? 'jette' : 0)],
    ['JSON illisible', (m) => (m === 'GET' ? 'illisible' : 0)],
    ['réponse qui n’est pas une liste', (m) => (m === 'GET' ? 'objet' : 0)],
  ]) {
    const b = vieilles(); const f = fauxFetch(b, { panne });
    let r; try { r = await lancer(f); } catch (e) { r = { leve: String(e) }; }
    vrai(f.appels.filter((a) => a.methode === 'DELETE').length === 0 && b.length === 2 && r.fait === false && !r.leve, `P3 lecture KO (${nom}) ⇒ aucune suppression, rien de levé`);
  }
  {
    const b = []; for (let i = 0; i < 1500; i++) b.push(ligne('mesures_jour_' + jourIl(100 + i)));
    const f = fauxFetch(b, { panne: (m, n) => (m === 'GET' && n === 2 ? 503 : 0) });
    const r = await lancer(f);
    vrai(f.appels.filter((a) => a.methode === 'DELETE').length === 0 && b.length === 1500 && r.fait === false, 'P3 page 1 lue, page 2 en panne ⇒ aucune suppression');
  }

  // ── P4. Pagination ───────────────────────────────────────────────────────
  {
    const b = []; for (let i = 0; i < 2500; i++) b.push(ligne('mesures_jour_' + jourIl(i)));
    const f = fauxFetch(b);
    const r = await lancer(f);
    const gets = f.appels.filter((a) => a.methode === 'GET');
    vrai(gets.length === 3 && r.lues === 2500, `P4 2 500 lignes ⇒ 3 pages lues (${gets.length}, ${r.lues})`);
    vrai(r.fait === true && r.retirees === 2500 - 91 && b.length === 91, `P4 toutes les vieilles supprimées, 91 jours gardés (reste ${b.length})`);
    vrai(f.appels.filter((a) => a.methode === 'DELETE').every((a) => (/id=in\.\(([^)]*)\)/.exec(a.url) || [, ''])[1].split(',').length <= 100), 'P4 suppression par lots de 100 au plus');
  }

  // ── P5. Propriétaire inconnu, suppression ratée ──────────────────────────
  {
    const b = vieilles(); const f = fauxFetch(b);
    const r = await lancer(f, { proprietaire: null });
    vrai(f.appels.length === 0 && r.fait === false && b.length === 2, 'P5 propriétaire inconnu ⇒ aucune requête');
    const f2 = fauxFetch(b, { panne: (m) => (m === 'DELETE' ? 500 : 0) });
    let r2; try { r2 = await lancer(f2); } catch (e) { r2 = { leve: String(e) }; }
    vrai(!r2.leve && r2.fait === false && r2.raison === 'suppression', 'P5 suppression ratée ⇒ dite, pas levée');
  }

  // ── P7. Les éclats (7 nov.) : `mesures_jour_{jour}_{éclat}` ───────────────
  {
    const b = [
      ligne('mesures_jour_' + jourIl(91) + '_a'), ligne('mesures_jour_' + jourIl(91) + '_0'), ligne('mesures_jour_' + jourIl(91)),
      ligne('mesures_jour_' + jourIl(90) + '_3'), ligne('mesures_jour_' + jourIl(5) + '_f'),
      ligne('mesures_jour_' + jourIl(200) + '_z'), ligne('mesures_jour_' + jourIl(200) + '_10'),
    ];
    const f = fauxFetch(b);
    const r = await lancer(f);
    const reste = b.map((l) => l.id);
    vrai(r.fait === true && r.retirees === 3 && !reste.some((x) => x.startsWith('mesures_jour_' + jourIl(91))), `P7 les éclats d’un vieux jour ET son ancienne ligne sont supprimés (${r.retirees})`);
    vrai(reste.includes('mesures_jour_' + jourIl(90) + '_3') && reste.includes('mesures_jour_' + jourIl(5) + '_f'), 'P7 les éclats du jour du seuil et des jours récents sont gardés');
    vrai(reste.includes('mesures_jour_' + jourIl(200) + '_z') && reste.includes('mesures_jour_' + jourIl(200) + '_10'), 'P7 un suffixe qui n’est pas un éclat est gardé');
  }

  // ── P6. Le cron du matin ─────────────────────────────────────────────────
  const cron = sansCommentaires(fs.readFileSync(path.join(R, 'api/ship-reminders.js'), 'utf8'));
  vrai(/import\s*\{[^}]*\bpurgerMesuresAnciennes\b[^}]*\}\s*from\s*'\.\/_lib\/mesures-terrain\.js'/.test(cron), 'P6 le cron importe la purge');
  vrai(/if \(!soir && !reveil\) \{ try \{ purgeMesures = await purgerMesuresAnciennes\(\{[^}]*proprietaire: await proprietaireInstallation\(\)/.test(cron), 'P6 le cron la lance le MATIN, avec le propriétaire de l’installation');
  vrai(/\.\.\.\(purgeMesures \? \{ purgeMesures \} : \{\}\)/.test(cron), 'P6 la réponse du cron la dit');

  console.log(`\n${ko ? '❌' : '✅'} purge des mesures : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
}
