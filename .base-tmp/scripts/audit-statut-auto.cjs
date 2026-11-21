// ════════════════════════════════════════════════════════════════════════════
//  LES SONDES AUTOMATIQUES DE vrm.center/statut (9 nov.) — EXÉCUTÉES.
//  api/_lib/statut-sondes.js, branché sur le VRAI cron (api/ship-reminders.js
//  ?moment=sondes) et sur la VRAIE route /api/sante (api/compte.js), avec une
//  fausse base qui sert la forme réelle (projections `select=`, `meta->>`,
//  comparer-et-échanger `data->>rev=eq.N`, `return=representation`).
//   S1. Une sonde ratée (la base répond 503) ⇒ « dégradé », RIEN d'autre :
//       aucun incident, aucune notification.
//   S2. Deux ratées DE SUITE ⇒ un incident ouvert (daté de la première) et UNE
//       notification au propriétaire ; une troisième n'en renvoie pas.
//   S3. Pas de réponse (réseau, délai) ⇒ « pas su », jamais « ok » ; ni compté,
//       ni effacé : deux « pas su » n'ouvrent rien, un « pas su » ne ferme rien.
//   S4. Retour ⇒ incident fermé, avec sa durée, gardé dans l'historique.
//   S5. Le drapeau « prévenu » est écrit AVANT d'envoyer : écriture refusée
//       (un autre passage a changé `rev`) ⇒ rien n'est envoyé ; état illisible
//       ⇒ 503, rien écrit.
//   S6. /api/sante rend la projection publique : mots fixes, dates, durées —
//       aucune donnée de la base (ni pseudo, ni adresse, ni identifiant) ; un
//       état rangé il y a plus de 45 min ⇒ tout « pas su ».
//   S7. Le silence anormal (e-mails, extension) jugé sur l'historique.
//   S8. La page (public/statut.js `statutSur`) et le bandeau de l'app
//       (src/statutBandeau.js) : « pas su » gris, jamais vert ; un incident
//       montré une fois.
//  Données inventées. `--prouve` : la branche de départ (origin/main) ET chaque
//  mutation doivent être ROUGES.
//  Lancer : node scripts/audit-statut-auto.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path'), fs = require('fs'), os = require('os'), vm = require('vm');
const { spawnSync, execFileSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const LIB = 'api/_lib/statut-sondes.js';
const CRON = 'api/ship-reminders.js';

const MUTATIONS = {
  'un seul échec ouvre l’incident': [[LIB, 'export const ECHECS_POUR_INCIDENT = 2;', 'export const ECHECS_POUR_INCIDENT = 1;']],
  'notification à chaque passage': [[LIB, 'if (incident && !incident.notifie) { incident.notifie = true; aNotifier.push(c); }', 'if (incident) { incident.notifie = true; aNotifier.push(c); }']],
  '« pas de réponse » vaut « ok »': [[LIB, "out.base = !service ? verdict('cle-absente') : !b.reponse ? verdict('sans-reponse')", "out.base = !service ? verdict('cle-absente') : !b.reponse ? verdict('repond')"]],
  '« pas su » efface les échecs': [[LIB, "      } else if (etat === 'ok') {", "      } else {"]],
  'envoyé même si l’état n’est pas écrit': [[LIB, "  if (!ecrit) return { fait: false, raison: 'état pas écrit (un autre passage, ou la base) : rien envoyé', etats: resume };", '']],
  'écriture sans comparer rev': [[LIB, "      const filtre = precedent.rev != null && Number.isFinite(Number(precedent.rev)) ? `data->>rev=eq.${Number(precedent.rev)}` : 'data->>rev=is.null';", "      const filtre = 'select=id';"]],
  'incident fermé sans durée': [[LIB, "if (incident) incidents.push({ composant: c, debut: incident.debut, fin: at, dureeMin: Math.max(1, Math.round((maintenant - ms(incident.debut)) / 60e3)) });", '']],
  'état périmé lu comme frais': [[LIB, 'const perime = maintenant - at > PERIME_MS;', 'const perime = false;']],
  'la projection recopie la base': [[LIB, '    const y = { etat, raison };', '    const y = { ...x, etat, raison };']],
  'le cron ne branche plus les sondes': [[CRON, "  if (moment === 'sondes') {", "  if (moment === 'sondes-retire') {"]],
  'la page montre « pas su » en vert': [['public/statut.js', "var etat = !perime && dans(ETATS, x.etat) ? x.etat : 'pas_su';", "var etat = !perime && dans(ETATS, x.etat) ? (x.etat === 'pas_su' ? 'ok' : x.etat) : 'ok';"]],
  'le bandeau revient à chaque visite': [['src/statutBandeau.js', '    .filter((x) => !deja.has(cleIncident(x)))', '']],
  'silence jamais jugé': [[LIB, "  if (silence > seuil) return { verdict: verdict('silence'", "  if (false) return { verdict: verdict('silence'"]],
};

const nodeModules = (() => {
  for (let d = R; d !== path.dirname(d); d = path.dirname(d)) { const p = path.join(d, 'node_modules'); if (fs.existsSync(path.join(p, 'web-push'))) return fs.realpathSync(p); }
  for (let d = __dirname; d !== path.dirname(d); d = path.dirname(d)) { const p = path.join(d, 'node_modules'); if (fs.existsSync(path.join(p, 'web-push'))) return fs.realpathSync(p); }
  return null;
})();
function arbre(depuis) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'statut-auto-'));
  for (const x of ['api', 'src', 'package.json', 'public/statut.js']) { const s = path.join(depuis, x); if (!fs.existsSync(s)) continue; fs.mkdirSync(path.dirname(path.join(t, x)), { recursive: true }); fs.cpSync(s, path.join(t, x), { recursive: true }); }
  if (nodeModules) fs.symlinkSync(nodeModules, path.join(t, 'node_modules'));
  return t;
}
const lancerDans = (t) => { const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 300000 }); return { rouges: ((r.stdout || '').match(/^❌/gm) || []).length, status: r.status, sortie: (r.stdout || '') + (r.stderr || '') }; };

if (process.argv.includes('--prouve')) {
  let ko = 0;
  // 1. La branche de départ : origin/main, sans ce chantier.
  const DEPART = process.env.STATUT_DEPART || 'origin/main';
  const t0 = fs.mkdtempSync(path.join(os.tmpdir(), 'statut-depart-'));
  const tar = execFileSync('git', ['-C', R, 'archive', DEPART, 'api', 'src', 'package.json', 'public/statut.js'], { maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', t0], { input: tar });
  if (nodeModules) fs.symlinkSync(nodeModules, path.join(t0, 'node_modules'));
  const d = lancerDans(t0);
  const depOk = d.status !== 0 && d.rouges > 0;
  console.log(`${depOk ? '✅' : '❌'} départ (${DEPART}) ⇒ ${depOk ? d.rouges + ' rouge(s)' : 'VERT (le contrôle ne voit pas l’absence du chantier)'}`);
  if (!depOk) ko++;
  fs.rmSync(t0, { recursive: true, force: true });
  // 2. Les mutations.
  for (const [nom, rempl] of Object.entries(MUTATIONS)) {
    const t = arbre(R);
    let ancre = true;
    for (const [f, de, vers] of rempl) {
      const p = path.join(t, f); const s = fs.readFileSync(p, 'utf8');
      if (!s.includes(de)) { ancre = false; console.log(`❌ mutation ${nom} : ancre introuvable dans ${f}`); break; }
      fs.writeFileSync(p, s.replace(de, vers));
    }
    if (ancre) {
      const r = lancerDans(t);
      const tombe = r.status !== 0 && r.rouges > 0;
      console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? r.rouges + ' rouge(s)' : 'VERTE'}`);
      if (!tombe) ko++;
    } else ko++;
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(ko ? `\n❌ ${ko} preuve(s) manquée(s)` : `\n✅ départ rouge et ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations attrapées`);
  process.exit(ko ? 1 : 0);
}

let ko = 0, ok = 0;
const vrai = (c, m, detail) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 400) : '')); } };
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const PROPRIO = '11111111-2222-4333-8444-555555555555';
const VENDEUR = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

(async () => {
  if (!fs.existsSync(path.join(R, LIB))) { vrai(false, 'S0 api/_lib/statut-sondes.js existe'); }
  // ── La fausse base ─────────────────────────────────────────────────────────
  process.env.CRON_SECRET = 'secret-cron';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-test';
  process.env.VRM_OWNER_UID = PROPRIO;
  process.env.EMAIL_INBOUND_SECRET = 'secret-reception';
  try { process.env.VAPID_PRIVATE_KEY = require(path.join(nodeModules || '', 'web-push')).generateVAPIDKeys().privateKey; } catch (_) {}
  for (const k of Object.keys(process.env)) if (/^RELANCES_/.test(k)) delete process.env[k];
  const lignes = new Map();   // `${owner}|${id}` → data
  const mode = { base: 'ok', ecriture: 'ok', lectureEtat: 'ok' };
  const journal = [];
  const J = (status, x) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => x, text: async () => JSON.stringify(x) });
  const maintenantIso = (decalMs = 0) => new Date(Date.now() - decalMs).toISOString();
  global.fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url));
    const m = (o.method || 'GET').toUpperCase();
    journal.push({ u, m });
    if (/\/auth\/v1\/settings$/.test(u)) return J(200, { external: { email: true, google: false }, disable_signup: false });
    if (/\/rpc\/vrm_acces_pour/.test(u)) return J(200, true);
    if (!/\/rest\/v1\//.test(u)) return J(200, []);
    // La sonde de la base : la ligne du collecteur (deux scalaires projetés).
    if (/id=in\.\(vrm_email_collecteur_passage,vrm_email_collecteur_succes\)&select=id,at:data->>at,etat:data->>etat/.test(u)) {
      if (mode.base === 'http') return J(503, { message: 'upstream' });
      if (mode.base === 'muet') throw new Error('fetch failed (délai)');
      return J(200, [{ id: 'vrm_email_collecteur_succes', at: maintenantIso(60e3), etat: 'ok' }]);
    }
    // Le dernier e-mail rangé / le dernier signe de vie : une date, projetée sur meta.
    if (/id=like\.email_reception_\*&meta->>etat=in\.\(integre,a-verifier\)&meta->>at=gte\.[^&]+&select=at:meta->>at&order=meta->>at\.desc&limit=1$/.test(u)) return J(200, [{ at: maintenantIso(12 * 60e3) }]);
    if (/id=like\.ext_appareil_\*&meta->>at=gte\.[^&]+&select=at:meta->>at&order=meta->>at\.desc&limit=1$/.test(u)) return J(200, [{ at: maintenantIso(5 * 60e3) }]);
    // La ligne d'état (propriétaire neutre).
    const cle = `${NEUTRE}|statut_sondes`;
    if (/owner=eq\.00000000-0000-0000-0000-000000000000&id=eq\.statut_sondes/.test(u)) {
      if (m === 'GET') {
        if (mode.lectureEtat === 'http') return J(500, { message: 'x' });
        if (!/select=data&limit=1$/.test(u)) return J(400, { message: 'forme inattendue' });
        return J(200, lignes.has(cle) ? [{ data: JSON.parse(JSON.stringify(lignes.get(cle))) }] : []);
      }
      if (m === 'PATCH') {
        const rev = (/data->>rev=eq\.(\d+)/.exec(u) || [])[1];
        const actuel = lignes.get(cle);
        if (mode.ecriture === 'conflit' || !actuel || rev == null || String(actuel.rev) !== rev) return J(200, []);
        if (!/Prefer/.test(JSON.stringify(o.headers || {})) || !/return=representation/.test(JSON.stringify(o.headers))) return J(200, []);
        lignes.set(cle, JSON.parse(o.body).data);
        return J(200, [{ id: 'statut_sondes' }]);
      }
    }
    if (m === 'POST' && /\/rest\/v1\/app_data$/.test(u)) {
      const r = JSON.parse(o.body)[0];
      if (r.owner === NEUTRE && r.id === 'statut_sondes') { if (lignes.has(cle) || mode.ecriture === 'conflit') return J(409, { code: '23505' }); lignes.set(cle, r.data); return J(201, null); }
      return J(201, null);
    }
    // Rien d'autre ne doit être lu par les sondes : on le note.
    return m === 'GET' ? J(200, []) : J(201, null);
  };

  let mod = null, L = null;
  try { mod = await import(path.join(R, CRON)); } catch (e) { vrai(false, 'S0 le cron s’importe', String(e && e.message)); }
  try { L = await import(path.join(R, LIB)); } catch (e) { vrai(false, 'S0 la règle s’importe', String(e && e.message)); }
  const cron = mod && mod.default;
  const notifs = [];
  if (mod && mod._bancSondes) mod._bancSondes.envoyer = async (n, owner) => { notifs.push({ n, owner }); return { sent: 1 }; };
  const appel = async () => {
    const res = { code: 0, corps: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.corps = x; return this; } };
    const n0 = journal.length;
    if (cron) await cron({ method: 'GET', query: { moment: 'sondes' }, headers: { authorization: 'Bearer secret-cron' } }, res);
    return { res, j: journal.slice(n0) };
  };
  const etat = () => lignes.get(`${NEUTRE}|statut_sondes`) || {};
  const base = () => (etat().composants || {}).base || {};

  // S3 d'abord, sur un état vide : pas de réponse.
  mode.base = 'muet';
  const a0 = await appel();
  vrai(a0.res.code === 200 && base().etat === 'pas_su' && base().raison === 'sans-reponse', 'S3 pas de réponse de la base ⇒ « pas su » (sans-reponse), jamais « ok »', base());
  await appel();
  vrai(base().etat === 'pas_su' && !base().incident && (base().echecs || 0) === 0 && notifs.length === 0, 'S3 deux « pas su » de suite ⇒ aucun incident, aucune notification', base());
  vrai(a0.j.every((x) => !/select=data(&|$)/.test(x.u) || /id=eq\.(statut_sondes|alertes_production)/.test(x.u)), 'S3 aucune lecture `select=data` hors des petites lignes d’état (sondes, journal des alertes du propriétaire)', a0.j.map((x) => x.u).filter((u) => /select=data(&|$)/.test(u)));
  const autres = etat().composants || {};
  vrai(autres.connexion && autres.connexion.etat === 'ok' && autres.emails && autres.emails.etat === 'pas_su' && autres.emails.raison === 'dependance' && autres.extension.raison === 'dependance' && autres.envoi.etat === 'pas_su' && autres.envoi.raison === 'non-configure',
    'S3 base muette ⇒ e-mails et extension « pas su » (dépendance) ; envoi pas configuré ⇒ « pas su », pas « ok »', Object.fromEntries(Object.entries(autres).map(([k, v]) => [k, v.etat + '/' + v.raison])));

  // S1 : un échec.
  mode.base = 'http';
  const a1 = await appel();
  vrai(a1.res.code === 200 && base().etat === 'degrade' && base().echecs === 1 && !base().incident && notifs.length === 0, 'S1 une sonde ratée (503) ⇒ « dégradé », aucun incident, aucune notification', base());
  // S2 : deux échecs de suite.
  const debutAttendu = base().premierEchec;
  const a2 = await appel();
  vrai(base().incident && base().incident.debut === debutAttendu && base().incident.notifie === true, 'S2 deux ratées de suite ⇒ incident ouvert, daté de la PREMIÈRE, « prévenu » rangé', base());
  vrai(notifs.length === 1 && notifs[0].owner === PROPRIO && /base de données/.test(notifs[0].n.title) && /statut/.test(notifs[0].n.url || '') && a2.res.corps && a2.res.corps.sondes && a2.res.corps.sondes.ouverts.join() === 'base', 'S2 UNE notification, au propriétaire de l’installation', notifs.map((x) => [x.owner, x.n.title]));
  await appel();
  vrai(notifs.length === 1 && base().echecs === 3 && base().incident, 'S2 une troisième ratée ⇒ pas de seconde notification', { n: notifs.length, echecs: base().echecs });
  // S3 bis : « pas su » pendant l'incident ne ferme rien.
  mode.base = 'muet';
  await appel();
  vrai(base().etat === 'pas_su' && base().incident && base().echecs === 3 && notifs.length === 1, 'S3 « pas su » pendant un incident ⇒ il reste ouvert, rien compté, rien envoyé', base());
  // S6 (pendant) : /api/sante.
  const compte = await import(path.join(R, 'api/compte.js')).catch((e) => ({ __e: e }));
  if (L && L.oublierStatutPublic) L.oublierStatutPublic();
  const sante = async () => {
    const res = { code: 0, corps: null, h: {}, setHeader(k, v) { this.h[k] = v; }, getHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.corps = x; return this; }, end() {} };
    if (compte.default) await compte.default({ method: 'GET', query: { mode: 'sante' }, headers: {}, url: '/api/sante' }, res);
    return res;
  };
  // Une donnée d'un vendeur glissée dans la ligne d'état : elle ne doit jamais sortir.
  const e0 = etat(); e0.composants.base.pseudo = 'vanessa5723'; e0.composants.emails.email = 'jean.dupont@gmail.com'; e0.owner = VENDEUR; e0.incidents = [...(e0.incidents || []), { composant: 'emails', debut: maintenantIso(3 * 3600e3), fin: maintenantIso(2 * 3600e3), dureeMin: 60, texte: 'colis de @vanessa5723' }];
  lignes.set(`${NEUTRE}|statut_sondes`, e0);
  const s1 = await sante();
  const st = s1.corps && s1.corps.statut;
  const brut = JSON.stringify(st || null);
  vrai(st && st.composants && st.composants.base.etat === 'pas_su' && st.incidents.some((x) => x.composant === 'base' && x.fin === null && x.dureeMin >= 1 && /base de données/.test(x.phrase)), 'S6 /api/sante rend l’état rangé : la base « pas su » maintenant, son incident EN COURS avec sa phrase', st);
  vrai(st && !/vanessa|dupont|3f2b8c1e|11111111-2222|pseudo|"email"|"owner"|"texte"/.test(brut) && Array.isArray(st.jours) && st.jours.length === 30, 'S6 la projection publique ne porte rien de la base (ni pseudo, ni adresse, ni identifiant) ; 30 jours', brut.slice(0, 300));
  vrai(st && st.jours[29] && st.jours[29].base === 'degrade' && Object.keys(st.jours[29]).sort().join() === 'base,connexion,emails,envoi,extension,jour,notifications', 'S6 aujourd’hui : la base « incident » dans la barre du jour, six morceaux', st && st.jours[29]);
  // S4 : retour.
  mode.base = 'ok';
  await appel();
  const fermes = (etat().incidents || []).filter((x) => x.composant === 'base');
  vrai(base().etat === 'ok' && !base().incident && base().echecs === 0 && fermes.length === 1 && fermes[0].debut === debutAttendu && fermes[0].dureeMin >= 1 && Date.parse(fermes[0].fin) >= Date.parse(fermes[0].debut), 'S4 retour ⇒ incident fermé, avec sa durée, gardé dans l’historique', fermes);
  vrai(notifs.length === 1, 'S4 la fermeture n’envoie pas de seconde alerte');
  const comps = etat().composants;
  vrai(comps.emails.etat === 'ok' && comps.extension.etat === 'ok' && comps.notifications.etat === 'ok' && comps.connexion.etat === 'ok', 'S4 base revenue ⇒ e-mails, extension, connexion, notifications « ok »', Object.fromEntries(Object.entries(comps).map(([k, v]) => [k, v.etat + '/' + v.raison])));
  // S5 : écrit avant d'envoyer.
  mode.base = 'http';
  await appel();
  mode.ecriture = 'conflit';
  const a5 = await appel();
  vrai(a5.res.code === 503 && notifs.length === 1 && !(etat().composants.base.incident), 'S5 écriture refusée (rev changé) ⇒ 503, rien envoyé, aucun incident rangé', { code: a5.res.code, n: notifs.length });
  mode.ecriture = 'ok'; mode.lectureEtat = 'http';
  const n5 = journal.length;
  const a6 = await appel();
  vrai(a6.res.code === 503 && !journal.slice(n5).some((x) => x.m !== 'GET'), 'S5 état illisible ⇒ 503, RIEN écrit', journal.slice(n5).map((x) => x.m));
  mode.lectureEtat = 'ok';

  if (L) {
    // S6 bis : périmé.
    const vieux = L.etatApres(null, Object.fromEntries(L.COMPOSANTS.map((c) => [c, { etat: 'ok', raison: 'repond' }])), Date.now() - 2 * 3600e3).etat;
    const p = L.statutPublic(vieux, Date.now());
    vrai(p && p.perime === true && Object.values(p.composants).every((x) => x.etat === 'pas_su' && x.raison === 'sondes-arretees'), 'S6 un état rangé il y a 2 h ⇒ tout « pas su » (sondes arrêtées), jamais un vieux « ok »', p && p.composants);
    // S7 : le silence.
    const H = 3600e3, now = Date.parse('2026-11-09T12:00:00Z');
    const hist = { depuis: now - 5 * 864e5, dernier: now - 10 * H, silences: [[now - 2 * 864e5, 8 * H], [now - 864e5, 3 * H]] };
    const s10 = L.jugerSilence({ dernier: now - 10 * H, hist, maintenant: now });
    const s13 = L.jugerSilence({ dernier: now - 13 * H, hist: { ...hist, dernier: now - 13 * H }, maintenant: now });
    const court = L.jugerSilence({ dernier: now - 8 * H, hist: { depuis: now - 864e5 }, maintenant: now });
    const pasSu = L.jugerSilence({ dernier: undefined, hist, maintenant: now });
    vrai(s10.verdict.etat === 'ok' && s13.verdict.etat === 'degrade' && s13.verdict.raison === 'silence' && s13.verdict.seuilH === 12, 'S7 silence jugé sur l’historique : plus long silence normal 8 h ⇒ seuil 12 h ; 10 h ok, 13 h « en retard »', [s10.verdict, s13.verdict]);
    vrai(court.verdict.etat === 'pas_su' && court.verdict.raison === 'historique-court' && pasSu.verdict.etat === 'pas_su' && pasSu.verdict.raison === 'dependance', 'S7 moins de 3 jours d’historique ⇒ « pas su » ; lecture ratée ⇒ « pas su »', [court.verdict, pasSu.verdict]);
    const appris = L.jugerSilence({ dernier: now, hist: { depuis: now - 5 * 864e5, dernier: now - 9 * H, silences: [] }, maintenant: now });
    vrai(appris.hist.silences.some((s) => s[1] === 9 * H) && appris.verdict.etat === 'ok', 'S7 un e-mail qui arrive après 9 h de silence ⇒ ce silence est appris');
  }

  // S8 : la page et le bandeau.
  const sjs = fs.existsSync(path.join(R, 'public/statut.js')) ? fs.readFileSync(path.join(R, 'public/statut.js'), 'utf8') : '';
  let statutSur = null;
  try { const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {} }, Date, Array, Object, JSON, isFinite, Math, String }; vm.createContext(ctx); vm.runInContext(sjs, ctx); statutSur = ctx.window.VRM_STATUT && ctx.window.VRM_STATUT.statutSur; } catch (_) {}
  if (typeof statutSur !== 'function') vrai(false, 'S8 public/statut.js `statutSur` exécutable');
  else {
    const T = Date.parse('2026-11-09T12:00:00Z');
    const s = statutSur({ at: new Date(T - 5 * 60e3).toISOString(), composants: { base: { etat: 'ok', raison: 'repond', pseudo: 'vanessa5723' }, emails: { etat: 'pas_su', raison: 'sans-reponse' }, envoi: { etat: 'vert', raison: 'inventee' } }, jours: [{ jour: '2026-11-09', base: 'ok', emails: 'pas_su', envoi: 'n/d' }], incidents: [{ composant: 'emails', debut: '2026-11-09T10:00:00Z', fin: null, dureeMin: 120, phrase: 'Écris à jean@x.fr' }] }, T);
    const sortie = JSON.stringify(s);
    vrai(s && s.composants.emails.etat === 'pas_su' && s.composants.envoi.etat === 'pas_su' && s.composants.connexion.etat === 'pas_su' && s.jours[0].envoi === 'pas_su' && s.jours[0].emails === 'pas_su', 'S8 la page : « pas su », un état inconnu ou absent ⇒ gris, jamais « ok »', s && s.composants);
    vrai(s && !/vanessa|jean@|phrase|pseudo/.test(sortie), 'S8 la page ne garde que des mots connus (aucun texte venu du serveur)', sortie.slice(0, 200));
    const p = statutSur({ at: new Date(T - 50 * 60e3).toISOString(), composants: { base: { etat: 'ok', raison: 'repond' } } }, T);
    vrai(p && p.composants.base.etat === 'pas_su' && p.perime === true, 'S8 la page revérifie l’heure : rangé il y a 50 min ⇒ « pas su »', p && p.composants.base);
  }
  let B = null;
  try { B = await import(path.join(R, 'src/statutBandeau.js')); } catch (_) {}
  if (!B || typeof B.bandeauStatut !== 'function') vrai(false, 'S8 src/statutBandeau.js exécutable');
  else {
    const st2 = { perime: false, composants: { emails: { etat: 'degrade' }, base: { etat: 'ok' } }, incidents: [{ composant: 'emails', debut: '2026-11-09T10:00:00Z', fin: null }, { composant: 'base', debut: '2026-11-08T10:00:00Z', fin: '2026-11-08T11:00:00Z' }] };
    const b1 = B.bandeauStatut(st2, []);
    const b2 = b1 ? B.bandeauStatut(st2, [b1.cle]) : 'x';
    vrai(b1 && b1.composant === 'emails' && /e-mails arrivent en retard — on s’en occupe/.test(b1.phrase) && b2 === null, 'S8 le bandeau : « Les e-mails arrivent en retard — on s’en occupe », une fois par incident', [b1, b2]);
    vrai(B.bandeauStatut({ ...st2, perime: true }, []) === null && B.bandeauStatut({ ...st2, composants: { emails: { etat: 'pas_su' } } }, []) === null && B.bandeauStatut(null, []) === null, 'S8 le bandeau se tait sur un état périmé, « pas su » ou absent');
  }

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
