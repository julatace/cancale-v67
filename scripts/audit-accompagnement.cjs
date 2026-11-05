#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — GROUPES D'ACCOMPAGNEMENT, CÔTÉ APP ET ROUTE (5 novembre, migration 025)
//  node scripts/audit-accompagnement.cjs
//  node scripts/audit-accompagnement.cjs --prouve   (chaque règle réaffaiblie ⇒ ROUGE)
//
//  EXÉCUTE (§4.10) :
//   · src/communaute/accompagnement.js — ce que l'app publie : chiffres par
//     semaine ISO et par mois depuis `vrm_benefice_jours` / `vrm_achats_jours`,
//     une moitié jamais publiée dite inconnue (jamais 0), le détail seulement au
//     niveau « détail », rien du tout sous « chiffres » ; la vue (« pas encore
//     publié » ≠ 0) ;
//   · api/_lib/communaute.js + api/_lib/accompagnement.js — la VRAIE route
//     `?mode=communaute`, base simulée par un faux PostgREST : 025 absente ⇒
//     503 `non-installe` (jamais une liste vide) ; panne ⇒ 503 `pas-su` ; le
//     jeton de l'APPELANT part, jamais la clé de service ; un partage absent
//     part « rien » ; un partage inconnu est refusé AVANT la base ; « Fermer mon
//     compte » appelle aussi `vrm_accomp_effacer` et ne se dit pas fait si elle
//     n'a pas répondu.
//  Aucune donnée réelle : tout est inventé ici.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MOD = path.join(RACINE, 'src/communaute/accompagnement.js');
const ROUTE = path.join(RACINE, 'api/_lib/accompagnement.js');
const MUTATION = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const remplace = (s, a, b, nom) => { if (s.split(a).length !== 2) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(a).join(b); };
const MUTATIONS = {
  'detail-au-niveau-chiffres': { f: MOD, m: (s) => remplace(s, "  const detail = niveau >= 2 ? detailPartage(", "  const detail = niveau >= 1 ? detailPartage(", 'd') },
  'publie-sans-partage': { f: MOD, m: (s) => remplace(s, '  if (!(niveau >= 1)) return null;', '  if (false) return null;', 'p') },
  'moitie-inconnue-zero': { f: MOD, m: (s) => remplace(s, '      achats: chiffres.achats ? a[2] : null,', '      achats: a[2],', 'm') },
  'semaine-fausse': { f: MOD, m: (s) => remplace(s, '  d.setUTCDate(d.getUTCDate() + 4 - j);', '', 's') },
  'partage-par-defaut-chiffres': { f: ROUTE, m: (s) => remplace(s, "const p = c.partage == null ? 'rien' : String(c.partage);", "const p = c.partage == null ? 'chiffres' : String(c.partage);", 'pd') },
  'non-installe-vide': { f: ROUTE, m: (s) => remplace(s, "    if (r.etat === 'absent') return nonInstalle();\n    if (r.etat !== 'ok') return pasSu();\n    const d = objet(r.data);", "    if (r.etat === 'absent') return dire(200, { ok: true, accomp: { crees: [], rejoints: [], niveau: 0, publie: null } });\n    if (r.etat !== 'ok') return pasSu();\n    const d = objet(r.data);", 'ni') },
  // (5 nov., relecture) La signature locale crue sur parole : ce que la base a effacé ne repart jamais.
  'signature-crue': { f: MOD, m: (s) => remplace(s, "  if (!force && !manque && lire(CLE_SIGNATURE) === sig) return 'inchange';", "  if (!force && lire(CLE_SIGNATURE) === sig) return 'inchange';", 'sc') },
  // (5 nov., relecture) Les ventes Vestiaire hors des totaux tues.
  'hors-vc-tu': { f: MOD, m: (s) => remplace(s, "...(hv ? { horsVc: hv } : {}), ", '', 'hv') },
  'effacer-oublie': { f: path.join(RACINE, 'api/_lib/communaute.js'), m: (s) => remplace(s, '  const a = await effacerAccompagnement(owner, SERVICE);', '  const a = 0;', 'eo') },
};

if (process.argv.includes('--prouve')) {
  let n = 0; const noms = Object.keys(MUTATIONS);
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌ /gm) || []).length, saute = /ancre introuvable|NON exécuté/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && rouges > 0 && !saute; if (bon) n++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? rouges + ' rouge(s)' : saute ? 'non exécutée' : 'RESTE VERTE'}`);
  }
  console.log(`\n${n}/${noms.length} mutations attrapées.`); process.exit(n === noms.length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && !c ? ' — ' + String(d).slice(0, 240) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + (e && e.stack || e)); } };

// Les fichiers (mutés au besoin) copiés dans un dossier jetable, avec leurs voisins.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-accomp-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} });
fs.writeFileSync(path.join(TMP, 'package.json'), '{"type":"module"}');
fs.cpSync(path.join(RACINE, 'api'), path.join(TMP, 'api'), { recursive: true });
fs.cpSync(path.join(RACINE, 'src'), path.join(TMP, 'src'), { recursive: true });
try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(TMP, 'node_modules'), 'dir'); } catch (_) {}
if (MUTATION) {
  const mu = MUTATIONS[MUTATION]; if (!mu) { console.log('❌ mutation inconnue — NON exécuté'); process.exit(1); }
  const cible = path.join(TMP, path.relative(RACINE, mu.f));
  try { fs.writeFileSync(cible, mu.m(fs.readFileSync(cible, 'utf8'))); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  console.log(`(mutation « ${MUTATION} »)`);
}

// ── Le faux PostgREST (seulement les fonctions de la 025) ────────────────────
const SERVICE = 'cle-de-service-inventee';
let BASE = { installe: true, panne: false, appels: [], effacer: 3 };
global.fetch = async (url, o = {}) => {
  const u = String(url), h = o.headers || {};
  const m = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(u);
  if (!m) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  const fn = m[1], args = o.body ? JSON.parse(o.body) : {};
  BASE.appels.push({ fn, args, auth: h.Authorization || h.authorization || '' });
  if (fn === 'vrm_communaute_effacer') return new Response('2', { status: 200 });
  if (!/^vrm_accomp_/.test(fn)) return new Response('{"code":"PGRST202"}', { status: 404 });
  if (!BASE.installe) return new Response(JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }), { status: 404 });
  if (BASE.panne) return new Response('<html>522</html>', { status: 522 });
  const rep = {
    vrm_accomp_lire: { acces: true, crees: [], rejoints: [], niveau: 1, publie: null },
    vrm_accomp_demander: { ok: true, id: 'x', statut: 'attente', nom: 'G' },
    vrm_accomp_publier: { ok: true, niveau: 1, chiffres: true, detail: false },
    vrm_accomp_effacer: BASE.effacer,
  }[fn];
  return new Response(JSON.stringify(rep === undefined ? { ok: true } : rep), { status: 200 });
};

const JETON = 'jeton-du-vendeur-invente';
const appeler = async (route, corps) => {
  const res = { code: 200, corps: null, status(n) { this.code = n; return this; }, json(x) { this.corps = x; return this; }, setHeader() {} };
  await route({ method: 'POST', headers: { authorization: 'Bearer ' + JETON } }, res, { utilisateur: { id: '11111111-1111-1111-1111-111111111111' }, corps });
  return res;
};

(async () => {
  const A = await import(path.join(TMP, 'src/communaute/accompagnement.js'));
  const { routeCommunaute, effacerCommunaute } = await import(path.join(TMP, 'api/_lib/communaute.js'));
  const MAINTENANT = Date.parse('2026-11-05T12:00:00');

  await essaie('semaines', () => {
    dit(A.semaineIso('2026-11-05') === '2026-W45', 'le 5 novembre 2026 est en semaine 45', A.semaineIso('2026-11-05'));
    dit(A.semaineIso('2026-01-01') === '2026-W01' && A.semaineIso('2027-01-01') === '2026-W53', 'les semaines ISO de fin et de début d’année', A.semaineIso('2027-01-01'));
    dit(A.semaineIso('2026-11-09') === '2026-W46' && A.semaineIso('2026-11-08') === '2026-W45', 'la semaine va du lundi au dimanche');
    dit(A.libelleSemaine('2026-W45') === 'sem. du 2 nov.', 'une semaine se dit par son lundi', A.libelleSemaine('2026-W45'));
  });

  const VENTES = { v: 2, jours: { '2026-11-02': [2, 9000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], '2026-11-04': [1, 4550], '2026-10-15': [3, 12000], '2020-01-01': [9, 99900] } };
  const ACHATS = { v: 1, jours: { '2026-11-03': [2, 5000], '2026-10-20': [1, 2500] } };
  await essaie('chiffres', () => {
    const c = A.chiffresPartage({ ventes: VENTES, achats: ACHATS, maintenant: MAINTENANT });
    dit(c && c.v === 1 && c.ventes === true && c.achats === true, 'les deux moitiés publiées sont dites connues');
    dit(JSON.stringify(c.semaines['2026-W45']) === '[3,13550,2,5000]', 'semaine 45 : 3 ventes, 135,50 €, 2 achats, 50 €', JSON.stringify(c.semaines));
    dit(JSON.stringify(c.mois['2026-11']) === '[3,13550,2,5000]' && JSON.stringify(c.mois['2026-10']) === '[3,12000,1,2500]', 'les mois', JSON.stringify(c.mois));
    dit(!c.mois['2020-01'], 'au-delà de 24 mois : rien ne part');
    const sv = A.chiffresPartage({ ventes: VENTES, achats: null, maintenant: MAINTENANT });
    dit(sv.achats === false && sv.mois['2026-11'][2] === 0, 'achats jamais publiés sur cet appareil ⇒ `achats:false` (dit inconnu)');
    const serie = A.serieVue(sv, 'mois', 2, MAINTENANT);
    dit(serie[1].ventes === 3 && serie[1].achats === null && serie[1].depense === null, 'la vue dit « — » pour une moitié inconnue, jamais 0', JSON.stringify(serie[1]));
    dit(A.chiffresPartage({ ventes: null, achats: null }) === null, 'rien de publié ⇒ rien (null), pas des zéros');
    const hv = A.chiffresPartage({ ventes: { ...VENTES, horsVestiaire: 2 }, achats: ACHATS, maintenant: MAINTENANT });
    dit(hv.horsVc === 2, 'les ventes Vestiaire au montant pas sûr (hors des jours) partent en NOMBRE : la vue dira que le total est partiel', JSON.stringify(hv).slice(0, 120));
    dit(!('horsVc' in c) && !('horsVc' in A.chiffresPartage({ ventes: { ...VENTES, horsVestiaire: null }, maintenant: MAINTENANT })), 'aucune vente Vestiaire hors des totaux (ou pas su) ⇒ rien d’ajouté');
  });

  await essaie('détail', () => {
    const rel = { l: [['Vinted', 'compte_a', 't1', Date.parse('2026-11-02'), 45.5, 20, 1, 'Paire <inventée>', '12', ''], ['eBay', 'compte_b', 'o1', Date.parse('2026-11-03'), null, null, null, 'Autre', '', '']] };
    const d = A.detailPartage({ releve: rel, achats: { l: [[Date.parse('2026-11-01'), 'compte_a', 'Achat', 20]] }, maintenant: MAINTENANT });
    dit(d.ventes.length === 2 && d.ventes[0][1] === 'eBay' && d.ventes[1][4] === 4550 && d.ventes[0][4] === null, 'le détail : plus récent d’abord, prix en centimes, prix illisible ⇒ null (jamais 0)', JSON.stringify(d.ventes));
    dit(!JSON.stringify(d).includes('<'), 'aucun « < » ne part (la base le refuserait)');
    dit(d.ventes[0].length === 5 && d.achats[0].length === 4, 'la forme attendue par la base : 5 et 4 colonnes');
  });

  await essaie('publication', async () => {
    const local = (vals) => (k) => (k in vals ? vals[k] : null);
    const envoyes = [];
    const envoyer = async (u, o) => { envoyes.push(JSON.parse(o.body)); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
    const H = () => ({ Authorization: 'Bearer x' });
    const sources = { vrm_benefice_jours: VENTES, vrm_achats_jours: ACHATS, vrm_stats_ventes: { l: [['Vinted', 'c', 't', 1793000000000, 10, null, null, 'x', '', '']] }, vrm_achats_releve: { l: [] } };
    dit(await A.publierPartage(H, { lire: local({ ...sources, vrm_accomp_niveau: 0 }), envoyer }) === 'rien' && envoyes.length === 0, 'ne partage rien ⇒ RIEN ne part');
    await A.publierPartage(H, { lire: local({ ...sources, vrm_accomp_niveau: 1 }), envoyer });
    dit(envoyes.length === 1 && envoyes[0].chiffres && envoyes[0].detail === null, 'niveau « chiffres » ⇒ les chiffres partent, le détail NON', JSON.stringify(envoyes[0]).slice(0, 120));
    await A.publierPartage(H, { lire: local({ ...sources, vrm_accomp_niveau: 2 }), envoyer });
    dit(envoyes.length === 2 && envoyes[1].detail && envoyes[1].detail.ventes.length === 1, 'niveau « détail » ⇒ le détail part aussi');
    const avecSig = { ...sources, vrm_accomp_niveau: 1 };
    const lire = (k) => (k === 'vrm_accomp_signature' ? avecSig.sig : local(avecSig)(k));
    global.localStorage = { setItem: (k, v) => { if (k === 'vrm_accomp_signature') avecSig.sig = JSON.parse(v); }, getItem: () => null, removeItem: () => {} };
    await A.publierPartage(H, { lire, envoyer }); const n = envoyes.length;
    dit(await A.publierPartage(H, { lire, envoyer }) === 'inchange' && envoyes.length === n, 'rien de changé ⇒ rien ne repart');
    // (5 nov., relecture) La base a EFFACÉ ce que cet appareil avait envoyé (le
    // créateur l'a retiré, puis il partage ailleurs) : la signature locale ne suffit pas.
    avecSig.vrm_accomp_niveau = 2; avecSig.sig = undefined;
    await A.publierPartage(H, { lire, envoyer, publie: { chiffres_le: 'x', detail_le: 'y' } }); const n2 = envoyes.length;
    dit(await A.publierPartage(H, { lire, envoyer, publie: { chiffres_le: 'x', detail_le: 'y' } }) === 'inchange' && envoyes.length === n2, 'la base a tout ⇒ rien ne repart');
    dit(await A.publierPartage(H, { lire, envoyer, publie: { chiffres_le: 'x', detail_le: null } }) === 'publie' && envoyes.length === n2 + 1 && envoyes[n2].detail, 'la base n’a plus le détail (effacé) ⇒ il REPART, même signature', envoyes.length - n2);
    dit(await A.publierPartage(H, { lire, envoyer, publie: null }) === 'publie' && envoyes.length === n2 + 2, 'la base n’a plus rien ⇒ tout repart');
  });

  await essaie('vue', () => {
    dit(A.etatVue({ statut: 'accepte', partage: 'rien' }) === 'rien', 'pas de clé « chiffres » ⇒ « ne partage rien »');
    dit(A.etatVue({ statut: 'accepte', partage: 'chiffres', chiffres: null }) === 'pas-publie', 'clé présente et null ⇒ « pas encore publié » (jamais 0)');
    dit(A.etatVue({ statut: 'attente', partage: 'detail' }) === 'pas-membre', 'en attente ⇒ aucun chiffre');
    dit(A.codeDuLien('?tab=communaute&groupe=abcd-2345') === 'ABCD2345' && A.codeDuLien('?groupe=IIII0000') === '', 'le code d’un lien d’invitation est lu, un code impossible ignoré');
    dit(/\/\?tab=communaute&groupe=ABCD2345$/.test(A.lienInvitation('ABCD2345', 'https://vrm.center')), 'le lien d’invitation ouvre Communauté avec le code');
  });

  await essaie('route', async () => {
    BASE = { installe: false, panne: false, appels: [], effacer: 3 };
    let r = await appeler(routeCommunaute, { action: 'accomp-lire' });
    dit(r.code === 503 && r.corps.erreur === 'non-installe' && /pas encore activés/.test(r.corps.message), '025 absente ⇒ 503 « pas encore activés », jamais une liste vide', JSON.stringify(r.corps));
    BASE.installe = true; BASE.panne = true;
    r = await appeler(routeCommunaute, { action: 'accomp-lire' });
    dit(r.code === 503 && r.corps.erreur === 'pas-su', 'base en panne ⇒ 503 « pas su »', JSON.stringify(r.corps));
    BASE.panne = false;
    r = await appeler(routeCommunaute, { action: 'accomp-lire' });
    dit(r.code === 200 && r.corps.accomp && r.corps.accomp.niveau === 1, 'lu ⇒ 200 et le niveau rendu par la base', JSON.stringify(r.corps));
    dit(BASE.appels.every((a) => a.auth === 'Bearer ' + JETON), 'le JETON DE L’APPELANT part, jamais la clé de service', JSON.stringify(BASE.appels.map((a) => a.auth)));
    BASE.appels = [];
    r = await appeler(routeCommunaute, { action: 'accomp-demander', code: 'abcd-2345', nom: 'Bea' });
    dit(r.code === 200 && BASE.appels[0] && BASE.appels[0].args.p_partage === 'rien' && BASE.appels[0].args.p_code === 'ABCD2345', 'partage absent ⇒ « rien » part à la base ; le code tapé est normalisé', JSON.stringify(BASE.appels[0]));
    BASE.appels = [];
    r = await appeler(routeCommunaute, { action: 'accomp-demander', code: 'ABCD2345', nom: 'Bea', partage: 'tout' });
    dit(r.code === 400 && BASE.appels.length === 0, 'un partage inconnu est refusé AVANT la base', JSON.stringify(r.corps));
    r = await appeler(routeCommunaute, { action: 'accomp-decider', membre: 'pas-un-uuid', oui: true });
    dit(r.code === 404, 'un identifiant de membre impossible ⇒ refusé');
    r = await appeler(routeCommunaute, { action: 'accomp-publier', chiffres: 'texte' });
    dit(r.code === 400 && r.corps.erreur === 'forme', 'des chiffres qui ne sont pas un objet ⇒ refusés (forme)');
    r = await appeler(routeCommunaute, { action: 'accomp-publier', chiffres: { v: 1 }, detail: null });
    dit(r.code === 200 && BASE.appels.some((a) => a.fn === 'vrm_accomp_publier'), 'publier relaie à la base (qui juge la forme)');
  });

  await essaie('fermer mon compte', async () => {
    BASE = { installe: true, panne: false, appels: [], effacer: 3 };
    const n = await effacerCommunaute('11111111-1111-1111-1111-111111111111', SERVICE);
    dit(n === 5 && BASE.appels.some((a) => a.fn === 'vrm_accomp_effacer'), '« Fermer mon compte » efface aussi les groupes d’accompagnement (2 + 3)', n);
    BASE.installe = false;
    dit(await effacerCommunaute('11111111-1111-1111-1111-111111111111', SERVICE) === 2, 'sans la 025 : 0 de ce côté, la fermeture continue');
    BASE.installe = true; BASE.panne = true;
    dit(await effacerCommunaute('11111111-1111-1111-1111-111111111111', SERVICE) === null, 'la 025 n’a pas répondu ⇒ `null` (la fermeture n’est pas dite faite)');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
