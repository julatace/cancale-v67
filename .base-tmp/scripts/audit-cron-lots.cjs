// ════════════════════════════════════════════════════════════════════════════
//  LE CRON PAR LOTS (7 nov., audit « 1 000 vendeurs ») — EXÉCUTÉ.
//  api/_lib/cron-lots.js, branché sur le vrai cron (api/ship-reminders.js).
//   L1. La règle seule (`passerVendeurs`, 50 vendeurs LENTS, un faux temps) :
//       budget atteint ⇒ plus aucun vendeur ne commence, curseur rangé avec
//       les faits ; relancé le même jour ⇒ seulement les autres (aucun
//       doublon) et « complet » ; le lendemain d'un passage coupé ⇒ les
//       oubliés de la veille EN PREMIER ; curseur du jour illisible ⇒ tout le
//       monde passe et RIEN n'est écrit ; écriture ratée ⇒ dite.
//   L2. Rotation : l'ordre change d'un jour à l'autre (les derniers d'un jour ne
//       sont pas les derniers du lendemain), reste le même dans la journée.
//   L3. Le vrai cron du matin, 50 vendeurs dont chaque lecture est lente, un
//       budget court (`VRM_CRON_BUDGET_MS`) : les tâches globales (e-mails de
//       l'essai, veille des plantages, purge du HTML, lenteurs, purge des
//       mesures) sont faites AVANT le premier vendeur ; le passage s'arrête au
//       budget ; le curseur `cron_curseur_matin_{jour}` (propriétaire neutre)
//       est posé ; la relance du même jour reprend sans refaire personne ;
//       ensemble les deux passages couvrent les 50.
//  Données inventées. `--prouve` : chaque mutation rougit.
//  Lancer : node scripts/audit-cron-lots.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');
const LIB = 'api/_lib/cron-lots.js';
const CRON = 'api/ship-reminders.js';

const MUTATIONS = {
  'pas de budget': [[LIB, 'if (maintenant() - debut >= budgetMs) { budgetAtteint = true; return; }', '']],
  'curseur jamais écrit': [[LIB, 'chaine = chaine.then(() => ecrireCurseur(id, data))', 'chaine = chaine.then(() => true)']],
  'faits du jour ignorés': [[LIB, 'const deja = new Set(liste(curseurJour).filter((o) => tous.has(o)));', 'const deja = new Set();']],
  'oubliés de la veille pas en premier': [[LIB, 'const prioritaires = veilleIncomplete ?', 'const prioritaires = false ?']],
  'ordre fixe': [[LIB, 'createHash(\'sha256\').update(`${jour}|${o}`)', 'createHash(\'sha256\').update(`${o}`)']],
  'écrit sur une lecture ratée': [[LIB, 'const peutEcrire = curseurJour !== undefined;', 'const peutEcrire = true;']],
  'tâches globales après les vendeurs': [[CRON, '    let relances = null;\n    if (!soir && !reveil) { try { relances = await passageRelances(', '    let relances = null;\n    await new Promise((ok) => setTimeout(ok, 0));\n    if (!soir && !reveil) await lotFini; if (!soir && !reveil) { try { relances = await passageRelances('], [CRON, '    const lot = await passerVendeurs({', '    let finir; const lotFini = new Promise((ok) => { finir = ok; });\n    const lot = await passerVendeurs({'], [CRON, '    const { bilans, echecs } = lot;', '    const { bilans, echecs } = lot; finir();']],
  'échec noté fait': [[LIB, 'if (reussi) faits.push(o); else enEchec.push(o);', 'faits.push(o);']],
  'cron sans bail': [[CRON, "if (bail.pris === false) { res.status(200)", "if (false) { res.status(200)"]],
  'bail jamais échu': [[LIB, "d.jeton !== jeton && Number(d.jusqua) > maintenant", "d.jeton !== jeton"]],
  'bail jamais rendu': [[CRON, "finally { if (bail.pris === true) await rendreBail(", "finally { if (false) await rendreBail("]],
  'cron sans curseur': [[CRON, 'lireCurseur: lireNeutre, ecrireCurseur: ecrireNeutre,', 'lireCurseur: async () => null, ecrireCurseur: async () => true,']],
};

if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const vrai = (c, m) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m); } };
const uuid = (n) => `${String(n).padStart(8, '0')}-aaaa-4bbb-8ccc-dddddddddddd`;
const OWNERS = Array.from({ length: 50 }, (_, i) => uuid(i + 1));
const NEUTRE = '00000000-0000-0000-0000-000000000000';

(async () => {
  // ── L1 + L2 : la règle seule, un faux temps ──────────────────────────────
  const L = await import(path.join(R, LIB));
  const curseurs = new Map();
  let t = 0;
  const lent = (journal) => async (o) => { journal.push(o); t += 100; await new Promise((r) => setImmediate(r)); return { vu: 1 }; };
  const passer = async ({ jour, budget = 2000, journal = [], lire, ecrire, owners = OWNERS }) => {
    t = 0;
    const r = await L.passerVendeurs({ owners, moment: 'matin', jour, debut: 0, budgetMs: budget, parallele: 4, maintenant: () => t,
      traiter: lent(journal),
      lireCurseur: lire || (async (id) => (curseurs.has(id) ? JSON.parse(JSON.stringify(curseurs.get(id))) : null)),
      ecrireCurseur: ecrire || (async (id, d) => { curseurs.set(id, d); return true; }),
      retirerCurseur: async (id) => { curseurs.delete(id); return true; } });
    return { r, journal };
  };
  const J1 = '2026-11-07', J2 = '2026-11-08';
  const a = await passer({ jour: J1 });
  const cA = curseurs.get('cron_curseur_matin_' + J1);
  vrai(a.r.budgetAtteint && a.r.traites > 0 && a.r.traites < 50 && a.r.restants === 50 - a.r.traites, `L1 budget atteint ⇒ ${a.r.traites} faits, ${a.r.restants} restants, plus aucun ne commence`);
  vrai(!!cA && cA.complet === false && cA.faits.length === a.r.traites && new Set(cA.faits).size === cA.faits.length && a.journal.every((o) => cA.faits.includes(o)), 'L1 le curseur du jour porte exactement les vendeurs faits, « pas complet »');
  const b = await passer({ jour: J1, budget: 1e9 });
  const tousB = new Set([...a.journal, ...b.journal]);
  vrai(b.journal.every((o) => !a.journal.includes(o)) && tousB.size === 50 && a.journal.length + b.journal.length === 50, `L1 relancé le même jour ⇒ seulement les ${b.journal.length} autres, aucun doublon, les 50 couverts`);
  vrai(curseurs.get('cron_curseur_matin_' + J1).complet === true && b.r.dejaFaits === a.r.traites, 'L1 le curseur du jour devient « complet »');
  // Le lendemain d'un jour coupé : les oubliés d'abord.
  curseurs.clear();
  const c = await passer({ jour: J1 });
  const oublies = OWNERS.filter((o) => !c.journal.includes(o));
  curseurs.set('cron_curseur_matin_' + L.jourAvant(J2, L.GARDER_JOURS), { faits: [], complet: true });
  const d = await passer({ jour: J2, budget: 1e9 });
  vrai(d.r.prioritaires === oublies.length && new Set(d.journal.slice(0, oublies.length)).size === oublies.length && d.journal.slice(0, oublies.length).every((o) => oublies.includes(o)), `L1 le lendemain, les ${oublies.length} oubliés de la veille passent EN PREMIER`);
  vrai(!curseurs.has('cron_curseur_matin_' + L.jourAvant(J2, L.GARDER_JOURS)) && curseurs.has('cron_curseur_matin_' + J2), 'L1 le curseur du jour est rangé, un vieux curseur est retiré');
  // Pas su / écriture ratée.
  const ecrits = [];
  const e = await passer({ jour: J1, budget: 1e9, lire: async () => undefined, ecrire: async (id, x) => { ecrits.push(id); return true; } });
  vrai(e.journal.length === 50 && ecrits.length === 0 && e.r.curseur === 'pas-su', 'L1 curseur du jour illisible ⇒ tout le monde passe, RIEN n’est écrit');
  const f = await passer({ jour: J1, budget: 1e9, lire: async () => null, ecrire: async () => false });
  vrai(f.r.curseur === 'non-ecrit' && f.journal.length === 50, 'L1 écriture du curseur ratée ⇒ dite (« non-ecrit »), les rappels passent quand même');
  // Un vendeur qui plante n'arrête pas les autres.
  t = 0;
  const g = await L.passerVendeurs({ owners: OWNERS.slice(0, 10), moment: 'soir', jour: J1, debut: 0, budgetMs: 1e9, parallele: 3, maintenant: () => 0,
    traiter: async (o) => { if (o === OWNERS[3]) throw new Error('panne'); return {}; }, lireCurseur: async () => null, ecrireCurseur: async () => true });
  vrai(g.echecs === 1 && g.bilans.length === 10 && g.restants === 1, 'L1 un vendeur qui plante est compté, les autres passent');
  // (11 nov., robustesse) Le vendeur en échec n'entre PAS dans le curseur : il est retenté.
  { const cur = new Map(); let plante = true;
    const tr = async (o) => { if (o === OWNERS[3] && plante) throw new Error('panne'); return {}; };
    const lire = async (id) => (cur.has(id) ? JSON.parse(JSON.stringify(cur.get(id))) : null), ecrire = async (id, d) => { cur.set(id, d); return true; };
    const h1 = await L.passerVendeurs({ owners: OWNERS.slice(0, 10), moment: 'soir', jour: J1, debut: 0, budgetMs: 1e9, parallele: 3, maintenant: () => 0, traiter: tr, lireCurseur: lire, ecrireCurseur: ecrire });
    const c1 = cur.get(L.idCurseur('soir', J1));
    plante = false; const vus = [];
    const h2 = await L.passerVendeurs({ owners: OWNERS.slice(0, 10), moment: 'soir', jour: J1, debut: 0, budgetMs: 1e9, parallele: 3, maintenant: () => 0, traiter: async (o) => { vus.push(o); return {}; }, lireCurseur: lire, ecrireCurseur: ecrire });
    vrai(c1 && !c1.faits.includes(OWNERS[3]) && c1.complet === false && vus.length === 1 && vus[0] === OWNERS[3] && h2.restants === 0 && cur.get(L.idCurseur('soir', J1)).complet === true,
      'L1 (11 nov.) un vendeur en échec n’est PAS noté fait : la relance du jour le retente, lui seul', JSON.stringify({ faits1: c1 && c1.faits.length, complet1: c1 && c1.complet, vus })); }
  // L2. Rotation.
  const o1 = L.ordreDuJour(OWNERS, J1), o2 = L.ordreDuJour(OWNERS, J2);
  const derniers1 = o1.slice(-10);
  vrai(JSON.stringify(o1) === JSON.stringify(L.ordreDuJour([...OWNERS].reverse(), J1)), 'L2 le même ordre toute la journée (quel que soit l’ordre de lecture)');
  vrai(JSON.stringify(o1) !== JSON.stringify(o2) && derniers1.filter((x) => o2.slice(-10).includes(x)).length <= 5, `L2 l’ordre tourne d’un jour à l’autre (${derniers1.filter((x) => o2.slice(-10).includes(x)).length}/10 des derniers restent derniers)`);

  // ── L3 : le vrai cron du matin ────────────────────────────────────────────
  process.env.CRON_SECRET = 'secret-cron';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-test';
  process.env.VRM_OWNER_UID = '11111111-2222-4333-8444-555555555555';
  process.env.VRM_CRON_BUDGET_MS = '1500';
  const lignes = new Map();   // `${owner}|${id}` → data (lignes du propriétaire neutre)
  const journal = [];         // { t, owner|null, quoi }
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const J = (status, x) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => x, text: async () => JSON.stringify(x) });
  global.fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url));
    const m = (o.method || 'GET').toUpperCase();
    const own = (/[?&]owner=eq\.([0-9a-f-]{36})/.exec(u) || [])[1] || null;
    journal.push({ owner: own, u, m });
    if (/\/rpc\/vrm_acces_pour/.test(u)) return J(200, true);
    if (!/\/rest\/v1\//.test(u)) return J(200, []);
    if (/app_data\?select=owner&limit=1$/.test(u)) return J(200, [{ owner: OWNERS[0] }]);
    if (/id=eq\.main&select=owner(&|$)/.test(u) && !own) return J(206, OWNERS.map((x) => ({ owner: x })));
    // (11 nov., H14) Le bail du passage : une ligne neutre écrite par comparer-et-échanger (modifierNeutre).
    if ((own === NEUTRE && /id=eq\.cron_bail_/.test(u)) || (m === 'POST' && /"id":"cron_bail_/.test(String(o.body || '')))) {
      if (m === 'POST') { const [r] = JSON.parse(o.body); if (lignes.has(`${NEUTRE}|${r.id}`)) return J(409, { code: '23505' }); lignes.set(`${NEUTRE}|${r.id}`, r.data); return J(201, null); }
      const id = /id=eq\.([^&]+)/.exec(u)[1], k = `${NEUTRE}|${id}`;
      if (m === 'GET') { await dormir(5); return J(200, lignes.has(k) ? [{ data: lignes.get(k) }] : []); }
      const rev = (/data->>rev=([^&]+)/.exec(u) || [])[1], d = lignes.get(k);
      if (!d || (rev === 'is.null' ? d.rev != null : `eq.${d.rev}` !== rev)) return J(200, []);
      lignes.set(k, JSON.parse(o.body).data); return J(200, [{ id }]);
    }
    if (own === NEUTRE && /id=eq\.cron_curseur_/.test(u)) {
      const id = /id=eq\.([^&]+)/.exec(u)[1];
      if (m === 'DELETE') { lignes.delete(`${NEUTRE}|${id}`); return J(204, null); }
      return J(200, lignes.has(`${NEUTRE}|${id}`) ? [{ data: lignes.get(`${NEUTRE}|${id}`) }] : []);
    }
    if (m === 'POST' && /on_conflict=owner,id/.test(u)) {
      for (const r of JSON.parse(o.body)) if (r.owner === NEUTRE) lignes.set(`${r.owner}|${r.id}`, r.data);
      return J(201, null);
    }
    if (own && own !== NEUTRE && OWNERS.includes(own)) await dormir(25);   // chaque lecture d'un vendeur est LENTE
    return m === 'GET' ? J(200, []) : J(201, null);
  };
  const cron = (await import(path.join(R, CRON))).default;
  const appel = async () => {
    const res = { code: 0, corps: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.corps = x; return this; } };
    const n0 = journal.length;
    await cron({ method: 'GET', query: {}, headers: { authorization: 'Bearer secret-cron' } }, res);
    const j = journal.slice(n0);
    const vendeurs = [...new Set(j.filter((x) => x.owner && OWNERS.includes(x.owner)).map((x) => x.owner))];
    return { res, j, vendeurs };
  };
  const p1 = await appel();
  const c1 = p1.res.corps || {};
  const jour = Object.keys(Object.fromEntries([...lignes].map(([k, v]) => [k, v]))).map((k) => (/cron_curseur_matin_(\d{4}-\d{2}-\d{2})$/.exec(k) || [])[1]).find(Boolean);
  const cur1 = jour ? lignes.get(`${NEUTRE}|cron_curseur_matin_${jour}`) : null;
  const premierVendeur = p1.j.findIndex((x) => x.owner && OWNERS.includes(x.owner) && !/id=eq\.main&select=owner/.test(x.u));
  const idx = (re) => p1.j.findIndex((x) => re.test(x.u));
  const globales = { veille: idx(/id=like\.plantage_/), mesures: idx(/id=like\.mesures_jour_/), html: idx(/email_html_/) };
  vrai(c1.relances != null && c1.veille != null && c1.purgeHtml != null && c1.lenteurs != null && c1.purgeMesures != null, 'L3 les cinq tâches globales sont faites et dites dans la réponse');
  vrai(premierVendeur > 0 && Object.values(globales).every((i) => i >= 0 && i < premierVendeur), `L3 elles passent AVANT le premier vendeur (${JSON.stringify(globales)} < ${premierVendeur})`);
  vrai(c1.lot && c1.lot.budgetAtteint === true && c1.lot.restants > 0 && c1.lot.traites > 0 && p1.vendeurs.length < 50, `L3 le budget arrête le passage (${c1.lot && c1.lot.traites} faits, ${c1.lot && c1.lot.restants} restants)`);
  vrai(!!cur1 && cur1.complet === false && cur1.faits.length === c1.lot.traites && c1.lot.curseur === 'ecrit', `L3 le curseur cron_curseur_matin_${jour} est posé chez le propriétaire neutre`);
  process.env.VRM_CRON_BUDGET_MS = '600000';
  const p2 = await appel();
  const c2 = p2.res.corps || {};
  const cur2 = lignes.get(`${NEUTRE}|cron_curseur_matin_${jour}`);
  const doublons = p2.vendeurs.filter((o) => cur1 && cur1.faits.includes(o));
  vrai(doublons.length === 0, `L3 la relance du même jour ne refait aucun vendeur déjà fait (${doublons.length} doublon)`);
  vrai(c2.lot && c2.lot.dejaFaits === cur1.faits.length && c2.lot.restants === 0 && new Set([...cur1.faits, ...p2.vendeurs]).size === 50, `L3 elle reprend les ${c2.lot && c2.lot.traites} autres : les 50 couverts`);
  vrai(!!cur2 && cur2.complet === true && cur2.faits.length === 50, 'L3 le curseur du jour devient « complet »');

  // ── L4 (11 nov., H14) : deux passages SIMULTANÉS du même moment ─────────────
  //    (cron Vercel + workflow du dépôt) : un seul travaille, l'autre le dit et ne
  //    touche à aucun vendeur ; fini, le bail est rendu (un passage suivant travaille).
  for (const k of [...lignes.keys()]) if (/cron_curseur_|cron_bail_/.test(k)) lignes.delete(k);
  process.env.VRM_CRON_BUDGET_MS = '600000';
  const [q1, q2] = await Promise.all([appel(), appel()]);
  const travail = [q1, q2].filter((q) => q.res.corps && q.res.corps.lot), sautes = [q1, q2].filter((q) => q.res.corps && q.res.corps.saute === 'passage-en-cours');
  vrai(travail.length === 1 && sautes.length === 1 && sautes[0].res.code === 200 && travail[0].res.corps.lot.traites === 50,
    `L4 deux passages simultanés : un seul travaille, l’autre dit « passage en cours » sans toucher un vendeur (${travail.length} au travail, ${sautes.length} sauté)`);
  const bail = lignes.get(`${NEUTRE}|cron_bail_matin`);
  vrai(!!bail && bail.jeton === null && bail.jusqua === 0, 'L4 fini, le bail est RENDU (jeton effacé) ' + JSON.stringify(bail));
  const q3 = await appel();
  vrai(q3.res.corps && q3.res.corps.lot && !q3.res.corps.saute, 'L4 le passage suivant travaille (bail rendu)');
  lignes.set(`${NEUTRE}|cron_bail_matin`, { jeton: 'un-autre', jusqua: Date.now() - 1000, rev: 9 });
  const q4 = await appel();
  vrai(q4.res.corps && q4.res.corps.lot, 'L4 un bail ÉCHU (passage coupé net) ne bloque pas : repris');

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
}
