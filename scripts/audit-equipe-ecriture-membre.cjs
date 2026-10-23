#!/usr/bin/env node
'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  LE MEMBRE D'UNE ÉQUIPE (016) ÉCRIT-IL CHEZ LE VENDEUR ? — mesuré, pas supposé.
//
//  Relecture du 22-23 octobre : l'en-tête de la 016 disait « AUCUNE ÉCRITURE »
//  et CLAUDE.md « les écritures restent fermées ». C'est vrai PAR RLS. Mais la
//  route Organisation (`/api/compte?mode=operations`, api/_lib/operations.js)
//  lit et réécrit la ligne `vrm_operations_v1` DU VENDEUR avec la CLÉ DE
//  SERVICE dès que `vrm_equipe_lister` dit que l'appelant est membre de ce
//  vendeur (`membre_de`, `acces === true`). Sans la 016, cette fonction répond
//  404 et la route refuse : appliquer la 016 MET EN SERVICE cette écriture.
//
//  Ce banc exécute la VRAIE route (copiée dans un dossier temporaire, fetch
//  simulé, données INVENTÉES — aucune requête réelle) et juge :
//   1. ce que la route fait, sans la 016 (404) et avec (membre_de) ;
//   2. ses BORNES : le membre ne fait que `mission.etat` / `mission.etape`, sur
//      SES missions, sans valider ; rien sur un vendeur dont l'accès est fermé
//      ou dont il n'est pas membre ; il ne lit que SES missions ;
//   3. la DOCUMENTATION : dès qu'une écriture du membre est MESURÉE, l'en-tête
//      de la 016 et la section 016 de CLAUDE.md doivent nommer le chemin
//      (`mode=operations`) et ses bornes (`mission.etat`, `mission.etape`,
//      `membre_de`). On juge des NOMS d'objets du code, jamais une tournure.
//
//  Lancement : node scripts/audit-equipe-ecriture-membre.cjs
//              node scripts/audit-equipe-ecriture-membre.cjs --mutation=NOM
//              node scripts/audit-equipe-ecriture-membre.cjs --prouve
//  Mutations : texte · claude · creer · autre-mission · valider · acces ·
//              vendeur · projection
//  Les chemins se déduisent de l'emplacement DU BANC (§6.1 : lancé depuis une
//  copie, il juge la copie).
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3);
const MUT = arg('mutation');
const PROUVE = process.argv.includes('--prouve');

const FICHIERS = ['api/_lib/operations.js', 'api/_lib/session.js', 'api/_lib/cle.js', 'src/operations/metier.js',
  'supabase/migrations/016-equipe.sql', 'CLAUDE.md'];

// Chaque mutation réaffaiblit UNE garde ; elle doit faire tomber au moins un contrôle.
const MUTATIONS = {
  // L'en-tête d'avant (15dbcb3) : « AUCUNE ÉCRITURE » sans le chemin.
  texte: ['supabase/migrations/016-equipe.sql', (s) => s.replace(/--   • aucune écriture PAR RLS[\s\S]*?Preuve : scripts\/audit-equipe-ecriture-membre\.cjs\.\n/,
    "--   • AUCUNE ÉCRITURE. « Coché posté » n'est pas indispensable : Vinted fait\n--     sortir le colis d'« à expédier » dès qu'il est scanné au relais.\n")],
  // La section 016 de CLAUDE.md qui ne nomme plus le chemin.
  claude: ['CLAUDE.md', (s) => { const [d, f] = bornesSection(s); return d < 0 ? s : s.slice(0, d) + s.slice(d, f).split('mode=operations').join('mode=autre') + s.slice(f); }],
  // Le membre n'est plus borné aux deux types.
  creer: ['src/operations/metier.js', (s) => s.replace(" if(membre)exige(['mission.etat','mission.etape'].includes(type),'Action réservée au responsable.');\n", '\n')],
  // Le membre agit sur une mission qui n'est pas la sienne.
  'autre-mission': ['src/operations/metier.js', (s) => s.split("exige(!membre||x.attribution===membre,'Cette mission ne t’est pas attribuée.');").join('')],
  // Le membre valide.
  valider: ['src/operations/metier.js', (s) => s.replace("if(membre)exige(['en_cours','terminee','bloquee'].includes(p.etat)&&x.etat!=='validee','Validation réservée au responsable.');", '')],
  // Un vendeur dont l'accès est fermé ouvre quand même l'écriture.
  acces: ['api/_lib/operations.js', (s) => s.replace('x.vendeur===owner&&x.acces===true', 'x.vendeur===owner')],
  // L'appartenance n'est plus vérifiée vendeur par vendeur.
  vendeur: ['api/_lib/operations.js', (s) => s.replace('x.vendeur===owner&&x.acces===true', 'x.acces===true')],
  // Le membre lit toute la ligne du vendeur.
  projection: ['api/_lib/operations.js', (s) => s.replace('function projection(d,membre){return membre?', 'function projection(d,membre){return false?')],
};

function bornesSection(texte) {
  const d = texte.search(/^### Le mode équipe : migration 016/m);
  if (d < 0) return [-1, -1];
  const suite = texte.slice(d + 4).search(/^### /m);
  return [d, suite < 0 ? texte.length : d + 4 + suite];
}

let ko = 0, ok = 0;
const dit = (vrai, quoi, detail) => {
  if (vrai) { ok++; console.log('  ✅ ' + quoi); } else { ko++; console.log('  ❌ ' + quoi + (detail ? ' — ' + detail : '')); }
};

if (PROUVE) {
  let rouges = 0;
  for (const nom of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, `--mutation=${nom}`], { encoding: 'utf8' });
    const n = (r.stdout.match(/^  ❌/gm) || []).length;
    console.log(`${r.status !== 0 && n > 0 ? '🔴' : '⚪'} --mutation=${nom} : ${n} contrôle(s) au rouge`);
    if (r.status !== 0 && n > 0) rouges++;
  }
  const total = Object.keys(MUTATIONS).length;
  console.log(`\n${rouges}/${total} mutations au rouge`);
  process.exit(rouges === total ? 0 : 1);
}

// ── La copie jugée (dossier temporaire, ES modules) ─────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'equipe-ecriture-'));
for (const f of FICHIERS) {
  const src = path.join(RACINE, f);
  if (!fs.existsSync(src)) { console.log('❌ fichier absent : ' + f); process.exit(1); }
  fs.mkdirSync(path.dirname(path.join(TMP, f)), { recursive: true });
  fs.copyFileSync(src, path.join(TMP, f));
}
fs.writeFileSync(path.join(TMP, 'package.json'), '{"type":"module"}\n');
if (MUT) {
  const m = MUTATIONS[MUT];
  if (!m) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  const cible = path.join(TMP, m[0]);
  const avant = fs.readFileSync(cible, 'utf8');
  const apres = m[1](avant);
  if (apres === avant) { console.log(`❌ la mutation « ${MUT} » n'a rien changé (ancre périmée)`); process.exit(1); }
  fs.writeFileSync(cible, apres);
  console.log(`(mutation « ${MUT} » appliquée à ${m[0]})`);
}

// ── Données inventées ──────────────────────────────────────────────────────
const V = '11111111-1111-4111-8111-111111111111';     // le vendeur
const W = '55555555-5555-4555-8555-555555555555';     // un autre vendeur
const M = '22222222-2222-4222-8222-222222222222';     // le membre (son compte)
const INV = '66666666-6666-4666-8666-666666666666';   // SON invitation chez V
const INV2 = '77777777-7777-4777-8777-777777777777';  // l'invitation d'un autre aide
const MA = '33333333-3333-4333-8333-333333333331';    // sa mission, à faire
const MB = '33333333-3333-4333-8333-333333333332';    // sa mission, en cours
const MC = '33333333-3333-4333-8333-333333333333';    // sa mission, terminée
const MX = '33333333-3333-4333-8333-333333333334';    // la mission d'un AUTRE aide
const CLE_SERVICE = 'eyJ.cle-de-service.factice';
const uuid = (n) => `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;

function donneesVendeur() {
  const mission = (id, attribution, etat, fait) => ({ id, cree: '2026-10-20T08:00:00.000Z', auteur: V, titre: 'Emballer N°' + id.slice(-1),
    consigne: '', categorie: 'emballage', attribution, echeance: null, etat, evenements: [], etapes: [{ texte: 'Scotcher', fait }], compteRendu: '' });
  return { version: 1, revision: 3,
    missions: [mission(MA, INV, 'attribuee', false), mission(MB, INV, 'en_cours', false), mission(MC, INV, 'terminee', true), mission(MX, INV2, 'en_cours', false)],
    reservations: [{ id: uuid(900), reference: 'Samba 42', quantite: 1, stock: 1, acheteur: 'Inventé', expire: '2030-01-01T00:00:00.000Z', prix: 4242, acompte: 0, rembourse: 0, etat: 'active' }],
    lots: [], consommables: [], veilles: [], receptions: [], dossiers: [], journal: [], commandes: [] };
}

// Un monde : `lister` = ce que rend rpc/vrm_equipe_lister (404 = sans la 016).
async function scenario({ lister, methode = 'POST', vendeur = V, commande }) {
  const journal = [];
  let ligne = donneesVendeur();
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url), h = opt.headers || {}, m = opt.method || 'GET';
    journal.push({ m, u: u.replace(/^https:\/\/[^/]+/, ''), cle: String(h.apikey || ''), corps: opt.body ? String(opt.body) : '' });
    const rep = (s, j) => ({ ok: s < 400, status: s, json: async () => j });
    if (u.includes('/auth/v1/user')) return rep(200, { id: M, email: 'aide@exemple.invalid' });
    if (u.includes('rpc/vrm_equipe_lister')) return lister === '404' ? rep(404, { code: 'PGRST202' }) : rep(200, lister);
    if (u.includes('rpc/vrm_acces')) return rep(200, { acces: true });
    if (u.includes(`owner=eq.${V}`) && u.includes('vrm_operations_v1') && m === 'GET') return rep(200, [{ data: ligne }]);
    if (u.includes('vrm_operations_v1') && m === 'GET') return rep(200, []);
    if (m === 'PATCH') { ligne = JSON.parse(opt.body).data; return rep(200, [{ id: 'vrm_operations_v1' }]); }
    if (m === 'POST' && u.includes('app_data')) return rep(201, [{ id: 'vrm_operations_v1' }]);
    return rep(404, null);
  };
  process.env.SUPABASE_SERVICE_KEY = CLE_SERVICE;
  const { routeOperations } = await import(pathToFileURL(path.join(TMP, 'api/_lib/operations.js')).href);
  let statut, corps;
  const res = { setHeader() {}, status(s) { statut = s; return { json(j) { corps = j; } }; } };
  await routeOperations({ method: methode, query: { vendeur }, headers: { authorization: 'Bearer a.b.c' }, body: commande }, res);
  const ecritures = journal.filter((x) => x.m === 'PATCH' || x.m === 'DELETE' || (x.m === 'POST' && x.u.includes('/rest/v1/app_data')));
  return { statut, corps, ecritures, journal, ligne };
}

const MEMBRE = (acces = true, vendeur = V) => ({ equipe: [], invitations: [], membre_de: [{ id: INV, vendeur, acces }] });
const cmd = (n, type, donnees) => ({ id: uuid(n), type, revision: 3, donnees });

(async () => {
  console.log('\n═══ 1. La route Organisation, sans puis avec la 016 ═══');
  const sans = await scenario({ lister: '404', commande: cmd(1, 'mission.etat', { cible: MA, etat: 'en_cours' }) });
  dit(sans.statut === 403 && sans.ecritures.length === 0, 'sans la 016 (vrm_equipe_lister 404) : refusé, aucune écriture', `statut ${sans.statut}, ${sans.ecritures.length} écriture(s)`);
  const avec = await scenario({ lister: MEMBRE(), commande: cmd(2, 'mission.etat', { cible: MA, etat: 'en_cours' }) });
  const ecritMembre = avec.statut === 200 && avec.ecritures.length === 1;
  dit(ecritMembre, 'avec la 016 : le membre ÉCRIT chez le vendeur (mesuré)', `statut ${avec.statut}, ${avec.ecritures.length} écriture(s)`);
  const e = avec.ecritures[0];
  dit(!!e && e.u.includes(`owner=eq.${V}`) && e.u.includes('id=eq.vrm_operations_v1') && e.cle === CLE_SERVICE,
    'cette écriture vise la ligne vrm_operations_v1 DU VENDEUR, avec la clé de service (hors RLS)', e ? `${e.m} ${e.u}` : 'aucune');
  const mA = avec.ligne.missions.find((x) => x.id === MA);
  dit(!!mA && mA.etat === 'en_cours' && JSON.stringify(avec.ligne.reservations) === JSON.stringify(donneesVendeur().reservations)
    && avec.ligne.missions.filter((x) => x.id !== MA).every((x, i) => JSON.stringify(x) === JSON.stringify(donneesVendeur().missions.filter((y) => y.id !== MA)[i])),
    'elle ne change que SA mission (réservations et autres missions intactes)');

  console.log('\n═══ 2. Les bornes de cette écriture ═══');
  const etape = await scenario({ lister: MEMBRE(), commande: cmd(3, 'mission.etape', { cible: MB, index: 0, fait: true }) });
  dit(etape.statut === 200 && etape.ecritures.length === 1, 'mission.etape sur SA mission en cours : accepté', `statut ${etape.statut}`);
  const creer = await scenario({ lister: MEMBRE(), commande: cmd(4, 'mission.creer', { titre: 'Pirate', categorie: 'emballage', etapes: [] }) });
  dit(creer.statut >= 400 && creer.ecritures.length === 0, 'mission.creer par le membre : refusé, aucune écriture', `statut ${creer.statut}, ${creer.ecritures.length} écriture(s)`);
  const resa = await scenario({ lister: MEMBRE(), commande: cmd(5, 'reservation.creer', { reference: 'X', quantite: 1, stock: 5, acheteur: 'Y', expire: '2030-01-01T00:00:00.000Z', prix: 100, acompte: 0 }) });
  dit(resa.statut >= 400 && resa.ecritures.length === 0, 'reservation.creer par le membre : refusé, aucune écriture', `statut ${resa.statut}, ${resa.ecritures.length} écriture(s)`);
  const autre = await scenario({ lister: MEMBRE(), commande: cmd(6, 'mission.etat', { cible: MX, etat: 'bloquee', note: 'x' }) });
  dit(autre.statut >= 400 && autre.ecritures.length === 0, "la mission d'un AUTRE aide : refusé, aucune écriture", `statut ${autre.statut}, ${autre.ecritures.length} écriture(s)`);
  const autreEtape = await scenario({ lister: MEMBRE(), commande: cmd(7, 'mission.etape', { cible: MX, index: 0, fait: true }) });
  dit(autreEtape.statut >= 400 && autreEtape.ecritures.length === 0, "l'étape d'une mission d'un AUTRE aide : refusé", `statut ${autreEtape.statut}`);
  const valider = await scenario({ lister: MEMBRE(), commande: cmd(8, 'mission.etat', { cible: MC, etat: 'validee' }) });
  dit(valider.statut >= 400 && valider.ecritures.length === 0, 'valider SA mission terminée : refusé (réservé au vendeur)', `statut ${valider.statut}, ${valider.ecritures.length} écriture(s)`);
  const ferme = await scenario({ lister: MEMBRE(false), commande: cmd(9, 'mission.etat', { cible: MA, etat: 'en_cours' }) });
  dit(ferme.statut === 403 && ferme.ecritures.length === 0, "vendeur dont l'accès est fermé (acces: false) : refusé, aucune écriture", `statut ${ferme.statut}, ${ferme.ecritures.length} écriture(s)`);
  const ailleurs = await scenario({ lister: MEMBRE(true, V), vendeur: W, commande: cmd(10, 'mission.etat', { cible: MA, etat: 'en_cours' }) });
  dit(ailleurs.statut === 403 && ailleurs.ecritures.length === 0, "un vendeur dont il n'est PAS membre : refusé, aucune lecture ni écriture",
    `statut ${ailleurs.statut}, ${ailleurs.ecritures.length} écriture(s)`);
  const lit = await scenario({ lister: MEMBRE(), methode: 'GET' });
  const vu = lit.corps && lit.corps.donnees;
  dit(lit.statut === 200 && vu && vu.missions.length === 3 && vu.missions.every((x) => x.id !== MX) && vu.reservations === undefined
    && !JSON.stringify(lit.corps).includes('4242') && lit.ecritures.length === 0,
    "il ne LIT que SES missions (ni la mission d'un autre, ni les réservations, ni un montant)", vu ? `${vu.missions.length} mission(s)` : `statut ${lit.statut}`);

  console.log('\n═══ 3. La documentation dit ce qui est mesuré ═══');
  if (!ecritMembre) {
    console.log('  (aucune écriture du membre mesurée : rien à exiger de la documentation)');
  } else {
    const sql = fs.readFileSync(path.join(TMP, 'supabase/migrations/016-equipe.sql'), 'utf8');
    const entete = sql.slice(0, sql.search(/^begin;/m));
    const manque = ['mode=operations', 'mission.etat', 'mission.etape', 'membre_de'].filter((n) => !entete.includes(n));
    dit(manque.length === 0, "l'en-tête de la 016 nomme le chemin d'écriture du membre et ses bornes", manque.length ? 'absent : ' + manque.join(', ') : '');
    const claude = fs.readFileSync(path.join(TMP, 'CLAUDE.md'), 'utf8');
    const [d, f] = bornesSection(claude);
    const section = d < 0 ? '' : claude.slice(d, f);
    dit(d >= 0, 'CLAUDE.md porte la section de la migration 016');
    const manqueC = ['mode=operations', 'mission.etat', 'mission.etape'].filter((n) => !section.includes(n));
    dit(d >= 0 && manqueC.length === 0, 'la section 016 de CLAUDE.md nomme ce chemin et ses bornes', manqueC.length ? 'absent : ' + manqueC.join(', ') : '');
  }

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${ko ? '❌' : '✅'} ${ok} contrôle(s) au vert, ${ko} au rouge`);
  process.exit(ko ? 1 : 0);
})().catch((err) => { console.log('❌ le banc a levé : ' + (err && err.stack || err)); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} process.exit(1); });
