#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « ME LE RAPPELER » (11 nov., api/_lib/rappels-perso.js)
// ════════════════════════════════════════════════════════════════════════════
// Des rappels que le VENDEUR pose lui-même sur un article (N°), une vente ou un
// achat. Ce banc EXÉCUTE la règle partagée (app + serveur), l'agenda (.ics) et la
// VRAIE route d'envoi (`api/ship-reminders.js?moment=reveil|soir`, la porte
// `sendPushToAll` comprise) contre une fausse base à la vraie forme (app_data
// owner/id/data, projections `select=x:data->x`, mémos, curseurs du cron),
// téléphone intercepté (web-push remplacé), horloge fixée.
//   A  la règle : identité obligatoire (jamais un titre), jours, 9 h Paris, mémo,
//      report qui ré-arme, état de la cible (vendu / parti / annulé), adresse
//   G  l'agenda : l'événement « Rappel · N°… », alarme à l'heure ; fait ⇒ absent
//   B  la route : UNE notification à 9 h qui ouvre l'élément, mémo écrit AVANT
//      l'envoi, rien deux fois, heures calmes ⇒ attend, famille coupée ⇒ rien,
//      lecture ratée ⇒ rien, plusieurs ⇒ une seule, aucun texte dans la réponse,
//      `main` lu projeté ; le réveil repasse à chaque demi-heure (curseur)
//   X  §3 : rien n'est créé sans « Enregistrer » ; aucun rappel automatique
// `--sur <dossier>` : juge un autre arbre (le code d'avant). `--prouve` : 6
// mutations, chacune doit finir en rouge. Données inventées (dépôt public).
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const iSur = process.argv.indexOf('--sur');
const RACINE = path.join(__dirname, '..');
const R = iSur > 0 ? path.resolve(process.argv[iSur + 1]) : (process.env.VRM_RAPPELS_RACINE || RACINE);
const NM = path.join(RACINE, 'node_modules');

if (process.argv.includes('--prouve')) {
  const MUTATIONS = [
    ['le mémo des envois ignoré', 'api/_lib/rappels-perso.js', "&& !memo[cleEnvoi(r)]", ''],
    ['les heures calmes ignorées', 'api/ship-reminders.js', "if (dansHeuresCalmes(prefs || {}, 'rappel', instantCalme())) return { etat: 'heures-calmes', n: dus.length };", ''],
    ['le mémo pas confirmé avant l\'envoi', 'api/ship-reminders.js', "if (!(await ecrireDedup(MEMO_RAPPELS, { envoyes: memoApres(envoyes, dus, maintenant), at: new Date(maintenant).toISOString() }))) return { etat: 'memo-non-ecrit', n: dus.length };", "await ecrireDedup(MEMO_RAPPELS, { envoyes: memoApres(envoyes, dus, maintenant), at: new Date(maintenant).toISOString() });"],
    ['le curseur du réveil redevenu « un par jour »', 'api/ship-reminders.js', "reveil ? `reveil-h${dt.getUTCHours()}${dt.getUTCMinutes() < 30 ? 'a' : 'b'}` : horaire", "reveil ? 'reveil' : horaire"],
    ['un article sans identité accepté', 'api/_lib/rappels-perso.js', "if (sorte === 'article' && !num && !item) return null;", ''],
    ['l\'heure de 9 h ignorée', 'api/_lib/rappels-perso.js', "&& maintenant >= instantParis(r.jour, HEURE_RAPPEL)", ''],
  ];
  let rouges = 0;
  for (const [nom, fichier, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rappels-mut-'));
    fs.cpSync(path.join(RACINE, 'api'), path.join(d, 'api'), { recursive: true });
    fs.cpSync(path.join(RACINE, 'src'), path.join(d, 'src'), { recursive: true });
    fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(d, 'package.json'));
    const f = path.join(d, fichier); const t = fs.readFileSync(f, 'utf8');
    if (!t.includes(avant)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); rouges = -999; continue; }
    fs.writeFileSync(f, t.replace(avant, apres));
    let code = 0;
    try { execFileSync(process.execPath, [__filename, '--sur', d], { stdio: 'pipe' }); } catch (e) { code = e.status || 1; }
    console.log(`${code ? '✅' : '❌'} mutation « ${nom} » ⇒ ${code ? 'rouge (attendu)' : 'VERT : le banc ne la voit pas'}`);
    if (code) rouges++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(`\n${rouges}/${MUTATIONS.length} mutations rouges`);
  process.exit(rouges === MUTATIONS.length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 400)); } };
const J = '11111111-1111-4111-8111-111111111111';
const NEUTRE = '00000000-0000-0000-0000-000000000000';

// ── L'horloge : un instant de Paris (hh:mm le jour `jour`), en ms ───────────
const parisMs = (jour, hh, mm = 0) => {
  for (const dec of [1, 2]) {
    const t = Date.parse(`${jour}T${String(hh - dec).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
    if (p === `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`) return t;
  }
  throw new Error('heure introuvable');
};
const vraiNow = Date.now.bind(Date);
let HORLOGE = null;
Date.now = () => (HORLOGE == null ? vraiNow() : HORLOGE);
const aHeure = (ms) => { HORLOGE = ms; process.env.VRM_NOTIF_HORLOGE = new Date(ms).toISOString(); };

// ── La fausse base (forme app_data owner/id/data ; projections ; rev) ──────
let base = new Map(); let panne = new Set(); let journalReseau = [];
const k = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
const projeter = (sel, id, owner, d) => {
  if (!sel || sel === 'data') return { id, owner, data: d };
  const out = {};
  for (const part of sel.split(',')) {
    if (part === 'owner') { out.owner = owner; continue; }
    if (part === 'id') { out.id = id; continue; }
    if (part === 'data') { out.data = d; continue; }
    const m = /^([a-zA-Z0-9_]+):data(->>?)(.+)$/.exec(part);
    if (!m) continue;
    let v = d; for (const seg of m[3].split(/->>?/)) v = v == null ? undefined : v[seg];
    out[m[1]] = m[2] === '->>' && v != null && typeof v === 'object' ? JSON.stringify(v) : (v === undefined ? null : v);
  }
  return out;
};
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const q = u.searchParams; const m = (o.method || 'GET').toUpperCase();
  journalReseau.push(`${m} ${decodeURIComponent(u.pathname + u.search)}`);
  if (u.pathname.endsWith('/rpc/vrm_acces_pour')) return rep(true);
  if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
  const id = (q.get('id') || '').replace(/^eq\./, ''); const owner = (q.get('owner') || '').replace(/^eq\./, '');
  const sel = q.get('select') || '';
  if (m === 'GET') {
    if (sel === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
    if (id === 'main' && sel === 'owner') return rep([{ owner: J }]);
    if (panne.has(id)) return rep('<html>522</html>', 522);
    if (!id) return rep([]);
    const rows = [];
    for (const [kk, d] of base) { const [ow, i] = kk.split('|'); if (i === id && (!owner || ow === owner)) rows.push(projeter(sel, i, ow, d)); }
    return rep(rows);
  }
  if (m === 'POST') {
    const ls = JSON.parse(o.body || '[]'); const out = [];
    for (const l of ls) {
      if (panne.has('ecrire:' + l.id)) return rep('<html>503</html>', 503);
      if (l.id === 'rappels_perso_dedup') ordre.push('memo');
      base.set(k(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id });
    }
    return rep(out, 201);
  }
  if (m === 'PATCH') {
    const kk = k(owner, id); if (!owner || !base.has(kk)) return rep([]);
    const d = base.get(kk); const rev = q.get('data->>rev');
    if (rev === 'is.null' ? d.rev != null : rev && String(d.rev) !== rev.replace(/^eq\./, '')) return rep([]);
    base.set(kk, JSON.parse(o.body).data); return rep([{ id }]);
  }
  if (m === 'DELETE') { base.delete(k(owner, id)); return rep(null, 204); }
  return rep([]);
};
const pushes = []; let ordre = [];
const TEL = 'https://web.push.apple.com/iphone-banc';

(async () => {
  const charge = (f) => import('file://' + path.join(R, f));
  let P;
  try { P = await charge('api/_lib/rappels-perso.js'); }
  catch (e) { dit(false, 'A0 la règle api/_lib/rappels-perso.js existe', String(e.message).slice(0, 160)); console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const L = await charge('api/_lib/lien-notif.js');

  const JOUR = '2026-11-12';          // jeudi (heure d'hiver : Paris = UTC+1)
  const T_7h = parisMs(JOUR, 7, 10), T_9h30 = parisMs(JOUR, 9, 30);
  aHeure(parisMs('2026-11-11', 15, 0));
  const VEILLE = Date.now();

  await essaie('A — la règle', async () => {
    dit(P.nouveauRappel({ cible: { sorte: 'article', titre: 'Nike Air Max 90' }, choix: 'demain' }) === null, 'A1 un article désigné par son TITRE seul : aucun rappel (§5)');
    dit(P.nouveauRappel({ cible: { sorte: 'vente', num: '124' }, choix: 'demain' }) === null, 'A2 une vente sans n° de transaction : aucun rappel');
    const r = P.nouveauRappel({ cible: { sorte: 'article', num: '0124', item: '5551234567' }, choix: 'demain', note: '  Rebaisser   le prix ' }, VEILLE, 'rbanc0001');
    dit(r && r.num === '124' && r.item === '5551234567' && r.jour === JOUR && r.note === 'Rebaisser le prix' && r.etat === 'actif', 'A3 « demain matin » : le jour de Paris + 1, N° en clé (« 0124 » = « 124 »), note nettoyée', JSON.stringify(r));
    dit(P.jourDuChoix('3j', VEILLE) === '2026-11-14' && P.jourDuChoix('7j', VEILLE) === '2026-11-18' && P.jourDuChoix('2026-11-10', VEILLE) === '' && P.jourDuChoix('2026-11-20', VEILLE) === '2026-11-20', 'A4 3 jours, 7 jours, une date ; une date passée est refusée');
    dit(new Date(P.instantParis('2026-11-12', 9)).toISOString() === '2026-11-12T08:00:00.000Z' && new Date(P.instantParis('2026-07-01', 9)).toISOString() === '2026-07-01T07:00:00.000Z', 'A5 9 h à Paris, hiver comme été');
    const liste = [r];
    dit(P.rappelsDus(liste, {}, T_7h).length === 0, 'A6 le jour dit avant 9 h : rien ne sonne');
    dit(P.rappelsDus(liste, {}, T_9h30).length === 1, 'A7 le jour dit après 9 h : il est dû');
    dit(P.rappelsDus(liste, { [P.cleEnvoi(r)]: JOUR }, T_9h30).length === 0, 'A8 déjà envoyé pour ce jour (mémo) : rien');
    const carte = { [r.id]: r };
    const rep1 = P.reporterRappel(carte, r.id, '3j', T_9h30)[r.id];
    dit(rep1.jour === '2026-11-15' && rep1.reports === 1 && P.rappelsDus([rep1], { [P.cleEnvoi(r)]: JOUR }, parisMs('2026-11-15', 9, 5)).length === 1, 'A9 « Reporter » : un nouveau jour ré-arme le rappel (le mémo vaut par jour)');
    const fait = P.marquerFait(carte, r.id, T_9h30)[r.id], sup = P.supprimerRappel(carte, r.id, T_9h30)[r.id];
    dit(fait.etat === 'fait' && sup.etat === 'supprime' && P.rappelsDus([fait, sup], {}, T_9h30).length === 0, 'A10 fait ou supprimé : ne sonne plus (pierre tombale, jamais une clé retirée)');
    dit(P.rappelsDus(liste, {}, parisMs('2026-11-16', 9, 30)).length === 0 && P.rappelsDus(liste, {}, parisMs('2026-11-14', 9, 30)).length === 1, 'A11 plus de 2 jours de retard : il ne sonne plus (la carte le garde)');
    dit(P.rappelsDuJour(liste, parisMs('2026-11-20', 9, 0)).length === 1 && P.rappelsDuJour(liste, VEILLE).length === 0, 'A12 Ma journée : les rappels du jour et en retard, pas ceux à venir');
    const purge = P.purgerRappels({ a: { ...sup, id: 'rvieux0001', majAt: '2026-09-01T00:00:00Z' }, [r.id]: r }, VEILLE);
    dit(!('a' in purge) && purge[r.id], 'A13 une pierre tombale de plus de 30 jours est purgée, l\'actif reste');
    const vendus = new Set(['5551234567']);
    dit(P.etatCible(r, { vendus, presents: new Set(['124']) }).etat === 'vendu', 'A14 l\'annonce est vendue entre-temps : le rappel le DIT');
    dit(P.etatCible(r, { vendus: new Set(), presents: new Set(['7']) }).etat === 'parti' && /n’est plus en ligne/.test(P.etatCible(r, { vendus: new Set(), presents: new Set() }).phrase), 'A15 le N° n\'est plus présent : « n’est plus en ligne ni en stock »');
    dit(P.etatCible(r, { vendus: new Set(), presents: null }).etat === 'pas-su', 'A16 la liste des présents pas publiée : « pas su », rien d\'affirmé');
    const v = P.nouveauRappel({ cible: { sorte: 'vente', tx: '9001002003', num: '124' }, choix: 'demain' }, VEILLE, 'rbanc0002');
    dit(P.etatCible(v, { annulee: (tx) => tx === '9001002003' }).etat === 'annulee', 'A17 une vente annulée entre-temps : le rappel le dit');
    const lv = P.lienRappel(v, L.lienNotif), la = P.lienRappel({ ...v, sorte: 'achat' }, L.lienNotif), lr = P.lienRappel(r, L.lienNotif);
    dit(lv === '/?tab=ventes&site=vinted&cible=vente&tx=9001002003&rappel=rbanc0002' && /tab=cat_achats&vue=achats&cible=achat&tx=9001002003&rappel=/.test(la) && lr === '/?tab=journee&num=124&rappel=rbanc0001', 'A18 l\'adresse ouvre l\'élément par son IDENTITÉ (transaction, N°) + le rappel', [lv, la, lr].join(' | '));
    const t = P.texteRappel(r);
    dit(t.title === 'Rappel · N°124 · Rebaisser le prix', 'A19 « Rappel · N°124 · Rebaisser le prix »', t.title);
  });

  await essaie('G — l\'agenda', async () => {
    const A = await charge('api/_lib/agenda-ics.js');
    const r = P.nouveauRappel({ cible: { sorte: 'article', num: '124' }, choix: 'demain', note: 'Rebaisser le prix' }, VEILLE, 'rbanc0003');
    const f = P.marquerFait({ x: P.nouveauRappel({ cible: { sorte: 'article', num: '88' }, choix: 'demain' }, VEILLE, 'rbanc0004') }, 'rbanc0004', VEILLE);
    dit(/vrm_rappels/.test(A.SELECT_MAIN_AGENDA) && !/(^|,)data(,|$)/.test(A.SELECT_MAIN_AGENDA), 'G1 l\'agenda lit `vrm_rappels` PROJETÉ (jamais select=data)');
    const ev = A.echeancesAgenda({ rappels: { [r.id]: r, ...f } }, VEILLE);
    const ics = A.fichierIcs(ev, VEILLE);
    dit(ev.length === 1 && /SUMMARY:Rappel · N°124 · Rebaisser le prix/.test(ics) && /DTSTART:20261112T080000Z/.test(ics) && /TRIGGER:-PT30M/.test(ics), 'G2 « Rappel · N°124 · Rebaisser le prix » le 12 à 9 h, alarme à l\'heure ; un rappel fait n\'y est pas', ics.split('\r\n').filter((l) => /SUMMARY|DTSTART|TRIGGER/.test(l)).join(' '));
  });

  // ── B — la vraie route ────────────────────────────────────────────────────
  process.env.CRON_SECRET = 'secret-banc'; process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  const webpush = require(path.join(NM, 'web-push'));
  webpush.sendNotification = async (sub, body) => { ordre.push('push'); pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  let route;
  await essaie('B0 la route se charge', async () => { route = (await charge('api/ship-reminders.js')).default; });
  const PushL = await charge('api/_lib/push.js');
  const appel = async (moment = 'reveil') => {
    PushL.oublierPrefsVues();
    const r = { code: 0, corps: null, setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.corps = b; return r; }, send(b) { r.corps = b; return r; }, end() { return r; } };
    await route({ method: 'GET', headers: { authorization: 'Bearer secret-banc' }, query: { moment } }, r);
    return r;
  };
  const bilan = (r) => (r.corps && r.corps.bilans && r.corps.bilans.find((b) => b.owner === J)) || {};
  const R1 = P.nouveauRappel({ cible: { sorte: 'article', num: '124', item: '5551234567' }, choix: 'demain', note: 'Rebaisser le prix' }, VEILLE, 'rbanc0101');
  const R2 = P.nouveauRappel({ cible: { sorte: 'vente', tx: '9001002003', num: '88' }, choix: 'demain', note: 'Relancer l’acheteur' }, VEILLE, 'rbanc0102');
  const prepare = ({ rappels = { [R1.id]: R1 }, prefs = null } = {}) => {
    base = new Map(); panne = new Set(); pushes.length = 0; ordre = []; journalReseau = [];
    base.set(k(J, 'main'), { rev: 3, vinted_regime: 'micro', vrm_rappels: rappels, vinted_sales: { lourd: 'x'.repeat(50) } });
    base.set(k(J, 'push_subs'), { subs: [{ endpoint: TEL, keys: { p256dh: 'x', auth: 'y' } }] });
    base.set(k(J, 'push_journal_lu'), {});
    if (prefs) base.set(k(J, 'push_prefs'), prefs);
  };
  if (route) {
    await essaie('B — la route d\'envoi', async () => {
      prepare(); aHeure(T_7h);
      let r = await appel();
      dit(pushes.length === 0 && bilan(r).rappels && bilan(r).rappels.etat === 'rien-de-du', 'B1 le jour dit à 7 h : rien ne sonne', JSON.stringify(bilan(r).rappels));
      aHeure(T_9h30);
      r = await appel();
      const p = pushes[0] || {};
      dit(pushes.length === 1 && p.title === 'Rappel · N°124 · Rebaisser le prix', 'B2 à 9 h 30 : UNE notification « Rappel · N°124 · Rebaisser le prix »', JSON.stringify(pushes.map((x) => x.title)));
      dit(p.url === '/?tab=journee&num=124&rappel=rbanc0101' && p.tag === 'rappel-rbanc0101', 'B3 elle ouvre l\'élément (N°, rappel) — étiquette de CET objet', `${p.url} ${p.tag}`);
      dit(ordre.indexOf('memo') >= 0 && ordre.indexOf('memo') < ordre.indexOf('push'), 'B4 le mémo est écrit AVANT l\'envoi', ordre.join(','));
      const reqMain = journalReseau.filter((x) => /id=eq\.main/.test(x) && !/select=owner/.test(x));
      dit(reqMain.length > 0 && reqMain.every((x) => /select=vrm_rappels:data->vrm_rappels/.test(x) || !/select=data(&|$)/.test(x)) && !reqMain.some((x) => /select=data(&|$)/.test(x)), 'B5 `main` n\'est lu que PROJETÉ (jamais select=data, §4.4)', reqMain.join(' ; '));
      const txt = JSON.stringify(r.corps);
      dit(!/Rebaisser|N°124|"124"|5551234567/.test(txt), 'B6 la réponse du cron ne porte aucun texte ni N° du vendeur (des nombres)', txt.slice(0, 200));
      const cloche = (base.get(k(J, 'push_journal')) || { entrees: [] }).entrees;
      dit(cloche.some((e) => e.titre === p.title && e.etat === 'envoyee'), 'B7 rangée dans la cloche (famille « Rappels »)');
      // Une demi-heure plus tard, nouveau passage du réveil : déjà envoyé ⇒ rien.
      aHeure(parisMs(JOUR, 10, 5)); pushes.length = 0;
      r = await appel();
      dit(pushes.length === 0 && bilan(r).rappels && bilan(r).rappels.etat === 'rien-de-du', 'B8 le passage suivant (10 h 05) : rien deux fois', JSON.stringify(bilan(r).rappels));
      dit(r.corps && r.corps.bilans && r.corps.bilans.some((b) => b.owner === J), 'B9 le réveil REPASSE le vendeur à chaque demi-heure (curseur par demi-heure, plus « fait pour la journée » dès 4 h)', JSON.stringify(r.corps && r.corps.lot));
      // Le soir aussi.
      prepare(); aHeure(parisMs(JOUR, 19, 13));
      r = await appel('soir');
      dit(pushes.some((x) => x.title === 'Rappel · N°124 · Rebaisser le prix'), 'B10 le passage du soir rattrape un rappel du jour pas encore parti', JSON.stringify(bilan(r).rappels));
    });

    await essaie('B — les refus', async () => {
      prepare(); aHeure(T_9h30); panne.add('ecrire:rappels_perso_dedup');
      let r = await appel();
      dit(pushes.length === 0 && bilan(r).rappels.etat === 'memo-non-ecrit', 'B11 mémo pas écrit ⇒ rien ne part', JSON.stringify(bilan(r).rappels));
      prepare(); aHeure(T_9h30); panne.add('main');
      r = await appel();
      dit(pushes.length === 0 && bilan(r).rappels.etat === 'pas-su', 'B12 `main` illisible ⇒ rien (« rien lu » ne vaut pas « rien »)', JSON.stringify(bilan(r).rappels));
      prepare(); aHeure(T_9h30); panne.add('rappels_perso_dedup');
      r = await appel();
      dit(pushes.length === 0 && bilan(r).rappels.etat === 'memo-illisible', 'B13 mémo illisible ⇒ rien (sinon il repartirait)', JSON.stringify(bilan(r).rappels));
      prepare({ prefs: { familles: { rappels: false } } }); aHeure(T_9h30);
      r = await appel();
      dit(pushes.length === 0 && bilan(r).rappels.etat === 'coupe', 'B14 la famille « Rappels » coupée : rien', JSON.stringify(bilan(r).rappels));
      prepare({ prefs: { calme: { actif: true, debut: '22:00', fin: '10:00' } } }); aHeure(T_9h30);
      r = await appel();
      const memo = base.get(k(J, 'rappels_perso_dedup'));
      dit(pushes.length === 0 && bilan(r).rappels.etat === 'heures-calmes' && !memo, 'B15 heures calmes jusqu\'à 10 h : il ATTEND (ni envoyé, ni mémo)', JSON.stringify(bilan(r).rappels));
      aHeure(parisMs(JOUR, 10, 7));
      r = await appel();
      dit(pushes.filter((x) => /^Rappel · N°124/.test(x.title)).length === 1, 'B16 … et sonne au passage d\'après la fin des heures calmes, tel quel', JSON.stringify(pushes.map((x) => x.title)));
      prepare({ rappels: { [R1.id]: R1, [R2.id]: R2 } }); aHeure(T_9h30);
      r = await appel();
      const g = pushes[0] || {};
      dit(pushes.length === 1 && g.title === '2 rappels aujourd’hui' && /N°124 · Rebaisser le prix/.test(g.body) && /N°88 · Relancer/.test(g.body) && g.url === '/?tab=journee&section=rappels', 'B17 deux rappels dus ensemble : UNE notification « 2 rappels aujourd’hui » qui ouvre Ma journée', JSON.stringify(g));
      prepare({ rappels: { [R1.id]: { ...R1, etat: 'fait' } } }); aHeure(T_9h30);
      r = await appel();
      dit(pushes.length === 0, 'B18 un rappel « fait » ne sonne pas');
    });
  }

  await essaie('X — §3 : rien sans son clic', async () => {
    const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
    const appels = app.split('\n').filter((l) => /nouveauRappel\(/.test(l) && !/^\s*import|^\s*\/\//.test(l));
    dit(appels.length === 1 && /const r = nouveauRappel\(\{ cible: f\.cible, choix, note \}/.test(appels[0]), 'X1 un seul endroit crée un rappel : « Enregistrer » de la feuille (son clic)', appels.join(' | ').slice(0, 200));
    const regle = fs.readFileSync(path.join(R, 'api', '_lib', 'rappels-perso.js'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(!/sans r[ée]ponse|[ée]valuation|evaluation|feedback/i.test(regle), 'X2 aucun rappel « messages sans réponse » ni « évaluation à laisser » (refus du 11 oct.)');
    const srv = fs.readFileSync(path.join(R, 'api', 'ship-reminders.js'), 'utf8');
    dit(!/vrm_rappels[^\n]*(POST|ecrireDedup\(CLE_RAPPELS)/.test(srv) && !/ecrireDedup\(\s*CLE_RAPPELS/.test(srv), 'X3 le serveur n\'écrit jamais les rappels (il lit `main`, n\'écrit que son mémo)');
    const fns = fs.readdirSync(path.join(R, 'api')).filter((f) => f.endsWith('.js'));
    dit(fns.length <= 12, `X4 ${fns.length} fonctions api/ (12 au plus, aucune neuve)`);
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
