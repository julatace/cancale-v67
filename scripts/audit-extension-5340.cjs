// ════════════════════════════════════════════════════════════════════════════
//  EXTENSION 5.340 (11 nov.) — TROIS FINITIONS, EXÉCUTÉES
//
//  Le VRAI background.js tourne dans un vm (scripts/_fond-vm.cjs : faux Vinted,
//  fausse base à état, `chrome.storage.local` à état). Tout est inventé (dépôt public).
//    V  MODE VACANCES AU JOURNAL : la commande `vacancesVinted` de l'app, acceptée ET
//       relue par Vinted (« fait ») ⇒ UNE entrée `vacances_on` / `vacances_off` dans
//       `vrmJournal` et la ligne `journal_vrm_{uid}_{nav}`, sans rien d'autre qu'une
//       heure et une sorte ; « déjà », « écart », « incertain », refus ⇒ RIEN ;
//       serveur : la sorte devient `vacances_pose` / `vacances_retire` ; écran :
//       « Mode vacances · posé » / « · retiré ».
//    P  PRIX DE VENTE VESTIAIRE : vc-inject.js lit `sellerPrice` SEULEMENT écrit en
//       euros au centime ; `rangerVcVentes` le range rebâti (`prixVenteVc`), le garde
//       à la lecture suivante, refuse une forme forgée ; la règle de la facture Pro
//       (src/facturePro/sources.js) facture à CE prix, sinon le refus d'avant mot pour
//       mot ; jamais au montant versé.
//    A  AVIS DATÉS : `capterAvis` ajoute un point { at, total, n, c[5] } à
//       `payload.historique` (des nombres seulement : ni texte ni pseudo), 90 jours,
//       un point par jour ; une lecture ratée de l'historique n'écrit RIEN ;
//       l'app (`evolutionHistorique`) : moins de deux jours ⇒ null (« pas su »).
//  `--prouve` : chaque mutation doit faire rougir au moins un contrôle ; et le
//  background.js / vc-inject.js / règles d'origin/main (git archive) sont rouges.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), vm = require('vm');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const F = {
  bg: 'vinted-sync-extension/background.js', vc: 'vinted-sync-extension/vc-inject.js',
  sources: 'src/facturePro/sources.js', notes: 'src/notesRecues.js', serveur: 'api/_lib/securite-compte.js', ecran: 'src/securiteCompte.js',
};
const lireDans = (racine, rel) => { try { return fs.readFileSync(path.join(racine, rel), 'utf8'); } catch (_) { return null; } };

const UID = '111', PROFIL = 5550001;
const CHEMIN_APPRIS = '/api/v2/users/{moi}/settings';
const CORPS_APPRIS = JSON.stringify({ user_settings: { is_on_holiday: true } });
const RECETTE = { recettes: Object.fromEntries(['on', 'off'].map((s) => [s, { methode: 'PUT', chemin: CHEMIN_APPRIS, corps: CORPS_APPRIS.replace('true', s === 'on' ? 'true' : 'false'), cle: ['user_settings', 'is_on_holiday'], at: '2026-11-10T10:00:00.000Z', uid: UID }])) };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function fondVacances(bgFichier, { etat = false, relu = 'suivre', putStatus = 200 } = {}) {
  const lignes = { vinted_vacances_recette: RECETTE, [`harvest_${UID}_profile`]: { uid: UID, type: 'profile', payload: { user: { id: PROFIL, is_on_holiday: etat } } } };
  let e = etat, nGet = 0;
  const vinted = (q) => {
    if (q.methode === 'GET' && q.chemin === '/api/v2/users/current') { nGet++; if (relu !== 'suivre' && nGet >= 2) return relu === 'ko' ? { status: 500, body: {} } : { status: 200, body: { user: { id: PROFIL, is_on_holiday: relu } } }; return { status: 200, body: { user: { id: PROFIL, is_on_holiday: e } } }; }
    if (q.methode === 'PUT' && q.chemin === `/api/v2/users/${PROFIL}/settings`) { if (putStatus !== 200) return { status: putStatus, body: {} }; try { e = JSON.parse(q.corps).user_settings.is_on_holiday; } catch (_) {} return { status: 200, body: {} }; }
    return { status: 404, body: {} };
  };
  return faireFond({ src: bgFichier, lignes, vinted });
}
const journalDe = (f) => ((f.store.vrmJournal || {})[UID] || []);
const ligneJournal = (f) => { const k = Object.keys(f.lignes).find((x) => x.startsWith(`journal_vrm_${UID}_`)); return k ? f.lignes[k] : null; };
async function commandeVacances(f, vacances) {
  const r = await f.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'vacancesVinted', uid: UID, vacances, confirme: true });
  for (let i = 0; i < 30; i++) { await attendre(10); if (journalDe(f).length) break; }
  return r;
}

async function importer(src, nom) {
  const f = path.join(os.tmpdir(), `a5340-${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
// La règle de la facture importe vestiaire-regle.js : servie depuis SA racine (chemins relatifs justes).
async function importerDans(racine, rel, src) {
  const f = path.join(racine, path.dirname(rel), `.a5340-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

// vc-inject.js : `scalairesVente` et ce qu'elle lit, extraits du vrai fichier.
function scalairesDe(srcVc) {
  const prendre = (re) => { const m = re.exec(srcVc); return m ? m[0] : ''; };
  const morceaux = [
    prendre(/  const CLE_ETAT = [^\n]*\n/), prendre(/  const CLE_DATE = [^\n]*\n/), prendre(/  const CLE_MONTANT = [^\n]*\n/), prendre(/  const PAS_ACHETEUR = [^\n]*\n/),
    prendre(/  const eurosEcrits = [^\n]*\n/), prendre(/  function scalairesVente\(e\) \{[\s\S]*?\n  \}\n/),
  ];
  if (morceaux.some((x) => !x)) return null;
  return vm.runInNewContext(`${morceaux.join('')}; scalairesVente`, { Date, isFinite, Number, String, Object });
}

async function controles(racine, { bg = path.join(racine, F.bg) } = {}) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : String(d).slice(0, 400) });

  // ── V. MODE VACANCES AU JOURNAL ──────────────────────────────────────────
  { const f = fondVacances(bg); const r = await commandeVacances(f, true);
    const j = journalDe(f);
    dit(r && r.etape === 'fait' && j.length === 1 && j[0].s === 'vacances_on', 'V1 mis en vacances, accepté ET relu ⇒ UNE entrée « vacances_on » au journal', JSON.stringify({ r, j }));
    dit(j.length === 1 && Object.keys(j[0]).sort().join(',') === 's,t', 'V2 l’entrée ne porte qu’une heure et une sorte (rien de personnel)', JSON.stringify(j));
    const l = ligneJournal(f);
    dit(l && Array.isArray(l.e) && l.e.some((x) => x.s === 'vacances_on') && l.uid === UID, 'V3 publiée dans la ligne dédiée `journal_vrm_{uid}_{nav}`', JSON.stringify(l)); }
  { const f = fondVacances(bg, { etat: true }); const r = await commandeVacances(f, false); const j = journalDe(f);
    dit(r && r.etape === 'fait' && j.length === 1 && j[0].s === 'vacances_off', 'V4 rouvert, relu ⇒ « vacances_off »', JSON.stringify({ r, j })); }
  for (const [nom, o, att, sens] of [['V5 déjà dans l’état voulu', { etat: true }, 'deja', true], ['V6 Vinted relit l’autre état (écart)', { relu: false }, 'ecart', true], ['V7 relecture ratée (incertain)', { relu: 'ko' }, 'incertain', true], ['V8 Vinted refuse (422)', { putStatus: 422 }, 'echec', true]]) {
    const f = fondVacances(bg, o); const r = await commandeVacances(f, sens); await attendre(40);
    dit(r && r.etape === att && journalDe(f).length === 0 && !ligneJournal(f), `${nom} ⇒ RIEN au journal`, JSON.stringify({ r, j: journalDe(f) }));
  }
  // Serveur et écran.
  let S = null, E = null;
  try { S = await importerDans(racine, F.serveur, lireDans(racine, F.serveur)); } catch (e) { dit(false, 'V9 api/_lib/securite-compte.js se charge', e.message); }
  try { E = await importerDans(racine, F.ecran, lireDans(racine, F.ecran)); } catch (e) { dit(false, 'V10 src/securiteCompte.js se charge', e.message); }
  if (S && S.evenementsExtension) {
    const ev = S.evenementsExtension([{ id: `journal_vrm_${UID}_0123456789abcdef`, e: [{ t: Date.parse('2026-11-11T09:00:00Z'), s: 'vacances_on' }, { t: Date.parse('2026-11-11T10:00:00Z'), s: 'vacances_off' }, { t: Date.parse('2026-11-11T11:00:00Z'), s: 'vacances_autre' }] }]);
    dit(ev.length === 2 && ev[0].type === 'vacances_pose' && ev[1].type === 'vacances_retire' && ev.every((x) => x.compte === UID && x.source === 'extension'), 'V9 le serveur accepte ces deux sortes (et elles seules) : « vacances_pose » / « vacances_retire », compte tiré de la ligne', JSON.stringify(ev));
    if (E && E.ligneJournal) {
      const t = ev.map((x) => E.ligneJournal({ ...x, preuve: 'p' }, {}).titre);
      dit(t[0] === 'Mode vacances · posé' && t[1] === 'Mode vacances · retiré', 'V10 l’écran dit « Mode vacances · posé » / « · retiré »', JSON.stringify(t));
      dit(E.filtrerJournal(ev, { type: 'tous' }).length === 2, 'V11 visibles dans « Tout »');
    }
  } else dit(false, 'V9 `evenementsExtension` exécutable');

  // ── P. PRIX DE VENTE VESTIAIRE ───────────────────────────────────────────
  const sv = scalairesDe(lireDans(racine, F.vc) || '');
  if (!sv) dit(false, 'P1 vc-inject.js porte `scalairesVente`');
  else {
    const a = sv({ sellerEarning: '203,23 €', sellerPrice: '250,00 €', soldDate: '2026-11-02T10:00:00Z' });
    dit(a.prixVente && a.prixVente.valeur === 250 && a.prixVente.devise === 'EUR' && a.prixVente.cle === 'sellerPrice' && a.montant && a.montant.cle === 'sellerEarning', 'P1 `sellerPrice` écrit en euros ⇒ prix de vente 250 € (le versé reste à part)', JSON.stringify(a));
    const b = [sv({ sellerEarning: '203,23 €', sellerPrice: '250.00 USD' }), sv({ sellerEarning: '203,23 €' }), sv({ sellerPrice: 250 }), sv({ sellerPrice: '0,00 €' })];
    dit(b.every((x) => !x.prixVente), 'P2 autre devise, absent, nombre nu, zéro ⇒ AUCUN prix de vente (jamais deviné)', JSON.stringify(b.map((x) => x.prixVente)));
  }
  { const f = faireFond({ src: bg, lignes: {} });
    const ok = typeof f.ctx.rangerVcVentes === 'function';
    if (!ok) dit(false, 'P3 `rangerVcVentes` exécutable');
    else {
      const base = { id: '72987282', productId: '72987282', date: '2026-11-02T10:00:00Z', titre: 'Sac banc', montant: { valeur: 203.23, devise: 'EUR', cle: 'sellerEarning' } };
      await f.ctx.rangerVcVentes({ source: 'ventes', ventes: [{ ...base, prixVente: { valeur: 250, devise: 'EUR', cle: 'sellerPrice', glisse: 'Camille' } }, { ...base, id: '72987283', productId: '72987283', prixVente: { valeur: 203.23, devise: 'EUR', cle: 'sellerEarning' } }, { ...base, id: '72987284', productId: '72987284', prixVente: { valeur: 99.999, devise: 'EUR', cle: 'sellerPrice' } }], offset: 0, total: null, lus: 3 });
      const v = (f.lignes.vc_ventes || {}).ventes || {};
      dit(v['72987282'] && JSON.stringify(v['72987282'].prixVente) === JSON.stringify({ valeur: 250, devise: 'EUR', cle: 'sellerPrice' }), 'P3 rangé rebâti champ par champ (un champ glissé ne passe pas)', JSON.stringify(v['72987282'] && v['72987282'].prixVente));
      dit(v['72987283'] && !('prixVente' in v['72987283']) && v['72987284'] && !('prixVente' in v['72987284']), 'P4 une forme forgée (le versé déguisé, des millièmes) ⇒ rien rangé', JSON.stringify([v['72987283'], v['72987284']].map((x) => x && x.prixVente)));
      await f.ctx.rangerVcVentes({ source: 'a-expedier', ventes: [{ ...base }], offset: 0, total: null, lus: 1 });
      const v2 = (f.lignes.vc_ventes || {}).ventes || {};
      dit(v2['72987282'] && v2['72987282'].prixVente && v2['72987282'].prixVente.valeur === 250, 'P5 une lecture suivante sans le prix ne l’efface pas', JSON.stringify(v2['72987282']));
    }
  }
  let Src = null;
  try { Src = await importerDans(racine, F.sources, lireDans(racine, F.sources)); } catch (e) { dit(false, 'P6 src/facturePro/sources.js se charge', e.message); }
  if (Src && Src.venteVc) {
    const vv = { id: '72987282', productId: '72987282', date: '2026-11-02T10:00:00Z', titre: 'Sac banc', etat: 'sold', montant: { valeur: 203.23, devise: 'EUR', cle: 'sellerEarning' } };
    const avec = Src.venteVc({ ...vv, prixVente: { valeur: 250, devise: 'EUR', cle: 'sellerPrice' } });
    dit(avec.ok && avec.centimes === 25000 && avec.ref === '72987282' && avec.venteLe === '2026-11-02T10:00:00.000Z' && avec.plateforme === 'vestiaire', 'P6 prix de vente lu ⇒ facture à CE prix (250 €), n° = la vente, date lue', JSON.stringify(avec));
    const sans = Src.venteVc(vv);
    dit(!sans.ok && sans.code === 'prix' && sans.raison === 'Vestiaire ne donne pas le prix payé par l’acheteur (seulement ce qu’il te verse)', 'P7 sans prix de vente ⇒ le refus d’avant, mot pour mot (jamais le versé)', JSON.stringify(sans));
    const forge = [Src.venteVc({ ...vv, prixVente: { valeur: 203.23, devise: 'EUR', cle: 'sellerEarning' } }), Src.venteVc({ ...vv, prixVente: { valeur: 250, devise: 'GBP', cle: 'sellerPrice' } })];
    dit(forge.every((x) => !x.ok && x.code === 'prix'), 'P8 le versé déguisé ou une autre devise ⇒ refus', JSON.stringify(forge));
    const ann = Src.venteVc({ ...vv, etat: 'cancelled', prixVente: { valeur: 250, devise: 'EUR', cle: 'sellerPrice' } });
    const sansDate = Src.venteVc({ ...vv, date: '', prixVente: { valeur: 250, devise: 'EUR', cle: 'sellerPrice' } });
    const sansId = Src.venteVc({ ...vv, id: '', prixVente: { valeur: 250, devise: 'EUR', cle: 'sellerPrice' } });
    dit(!ann.ok && ann.code === 'annulee' && !sansDate.ok && sansDate.code === 'date' && !sansId.ok && sansId.code === 'ref', 'P9 annulée, pas datée, sans n° ⇒ pas de facture, la raison dite', JSON.stringify([ann, sansDate, sansId].map((x) => x.code)));
  } else if (Src) dit(false, 'P6 `venteVc` exécutable');

  // ── A. AVIS DATÉS ────────────────────────────────────────────────────────
  const avisVinted = (avis, total) => (q) => (q.methode === 'GET' && /^\/api\/v2\/user_feedbacks\?/.test(q.chemin) ? { status: 200, body: { user_feedbacks: avis, pagination: { total_entries: total, total_pages: 9 } } } : { status: 404, body: {} });
  const AVIS = [{ id: 1, rating: 5, feedback: 'Top, merci Camille', user: { login: 'acheteuse_camille' } }, { id: 2, rating: 4, feedback: 'ok' }, { id: 3, rating: 5 }];
  const hier = new Date(Date.now() - 864e5).toISOString(), vieux = new Date(Date.now() - 120 * 864e5).toISOString();
  { const lignes = { [`harvest_${UID}_feedbacks`]: { type: 'feedbacks', uid: UID, payload: { user_feedbacks: [], historique: [{ at: vieux, total: 10, n: 1, c: [0, 0, 0, 0, 1] }, { at: hier, total: 170, n: 2, c: [0, 0, 0, 1, 1], texte: 'glissé' }] } } };
    const f = faireFond({ src: bg, lignes, vinted: avisVinted(AVIS, 172) });
    const ok = typeof f.ctx.capterAvis === 'function' ? await f.ctx.capterAvis(UID) : null;
    const h = (((f.lignes[`harvest_${UID}_feedbacks`] || {}).payload) || {}).historique;
    dit(ok === true && Array.isArray(h) && h.length === 2, 'A1 une capture AJOUTE un point daté ; le point de plus de 90 jours tombe', JSON.stringify(h));
    const d = Array.isArray(h) ? h[h.length - 1] : null;
    dit(d && d.total === 172 && d.n === 3 && JSON.stringify(d.c) === '[0,0,0,1,2]' && Math.abs(Date.parse(d.at) - Date.now()) < 6e4, 'A2 le point : total Vinted, nombre lu, répartition des étoiles, l’heure de la capture', JSON.stringify(d));
    const tout = JSON.stringify(h || []);
    dit(Array.isArray(h) && h.every((p) => Object.keys(p).sort().join(',') === 'at,c,n,total') && !/Camille|acheteuse|glissé|Top/.test(tout), 'A3 des nombres seulement : ni texte, ni pseudo, ni champ glissé', tout); }
  { const lignes = { [`harvest_${UID}_feedbacks`]: { type: 'feedbacks', uid: UID, payload: { historique: [{ at: new Date(Date.now() - 2 * 3600e3).toISOString(), total: 170, n: 2, c: [0, 0, 0, 1, 1] }] } } };
    const f = faireFond({ src: bg, lignes, vinted: avisVinted(AVIS, 172) });
    if (typeof f.ctx.capterAvis === 'function') await f.ctx.capterAvis(UID);
    const h = (((f.lignes[`harvest_${UID}_feedbacks`] || {}).payload) || {}).historique;
    const memeJour = new Date(Date.now() - 2 * 3600e3).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
    dit(Array.isArray(h) && (memeJour ? h.length === 1 && h[0].total === 172 : h.length === 2), 'A4 deux captures le même jour ⇒ un seul point (le plus récent)', JSON.stringify(h)); }
  { const lignes = { [`harvest_${UID}_feedbacks`]: { type: 'feedbacks', uid: UID, capturedAt: '2026-11-01T00:00:00Z', payload: { user_feedbacks: [{ id: 9, rating: 5 }], historique: [{ at: hier, total: 170, n: 2, c: [0, 0, 0, 1, 1] }] } } };
    const f = faireFond({ src: bg, lignes, vinted: avisVinted(AVIS, 172), lectureKO: (u) => /harvest_111_feedbacks/.test(u) && /historique/.test(u) });
    if (typeof f.ctx.capterAvis === 'function') await f.ctx.capterAvis(UID);
    const l = f.lignes[`harvest_${UID}_feedbacks`];
    dit(l && l.capturedAt === '2026-11-01T00:00:00Z' && l.payload.historique.length === 1, 'A5 lecture de l’historique ratée ⇒ RIEN écrit (l’historique n’est pas effacé)', JSON.stringify(l)); }
  let N = null;
  try { N = await importerDans(racine, F.notes, lireDans(racine, F.notes)); /* (11 nov.) servie depuis SA racine : elle importe dateParis.js */ } catch (e) { dit(false, 'A6 src/notesRecues.js se charge', e.message); }
  if (N && N.evolutionHistorique) {
    const now = Date.parse('2026-11-11T12:00:00Z');
    const e = N.evolutionHistorique([{ at: '2026-10-12T09:00:00Z', total: 140, n: 20, c: [0, 0, 1, 3, 16] }, { at: '2026-11-11T09:00:00Z', total: 174, n: 20, c: [0, 0, 0, 2, 18] }, { at: '2026-07-01T09:00:00Z', total: 2, n: 1, c: [1, 0, 0, 0, 0] }], now);
    dit(e && e.nouveaux === 34 && e.moyAvant === 4.8 && e.moyApres === 4.9 && e.points === 2 && e.depuis === Date.parse('2026-10-12T09:00:00Z'), 'A6 l’app : +34 avis, moyenne 4,8 → 4,9 sur 90 jours (le point trop vieux ignoré)', JSON.stringify(e));
    dit(N.evolutionHistorique(null, now) === null && N.evolutionHistorique([{ at: '2026-11-11T09:00:00Z', total: 1, n: 1, c: [0, 0, 0, 0, 1] }], now) === null && N.evolutionHistorique([{ at: '2026-11-11T08:00:00Z', total: 1, n: 1, c: [0, 0, 0, 0, 1] }, { at: '2026-11-11T09:00:00Z', total: 2, n: 1, c: [0, 0, 0, 0, 1] }], now) === null,
      'A7 rien, un seul point ou un seul jour ⇒ null (« pas su »), jamais « +0 »');
    const sansTot = N.evolutionHistorique([{ at: '2026-10-12T09:00:00Z', total: null, n: 2, c: [0, 0, 0, 1, 1] }, { at: '2026-11-11T09:00:00Z', total: 174, n: 2, c: [0, 0, 0, 0, 2] }], now);
    dit(sansTot && sansTot.nouveaux === null, 'A8 un total pas dit par Vinted ⇒ « +N » pas su (null), jamais compté', JSON.stringify(sansTot));
    const L = N.notesParCompte({ profils: [{ uid: UID, at: new Date(now).toISOString(), rep: '1', n: '174', avis: [{ id: 1, rating: 5 }], hist: [{ at: '2026-10-12T09:00:00Z', total: 140, n: 20, c: [0, 0, 1, 3, 16] }, { at: '2026-11-11T09:00:00Z', total: 174, n: 20, c: [0, 0, 0, 2, 18] }] }], comptes: [{ uid: UID, nom: 'a' }], maintenant: now });
    dit(L.comptes[0].liste && L.comptes[0].liste.historique && L.comptes[0].liste.historique.nouveaux === 34, 'A9 `notesParCompte` porte l’historique au compte', JSON.stringify(L.comptes[0].liste && L.comptes[0].liste.historique));
  } else if (N) dit(false, 'A6 `evolutionHistorique` exécutable');
  return res;
}

const MUTATIONS = [
  ['vacances jamais au journal', F.bg, 'if (s) await noterJournal(msg && msg.uid, s, {});', ''],
  ['vacances : toute issue au journal', F.bg, "if (!r || r.accepte !== true || r.etape !== 'fait' || typeof r.vacances !== 'boolean') return null;", "if (!r || r.accepte !== true || typeof r.vacances !== 'boolean') return null;"],
  ['vacances : la sorte de la DEMANDE', F.bg, "return r.vacances ? 'vacances_on' : 'vacances_off';", "return 'vacances_on';"],
  ['vacances hors liste blanche', F.bg, ", 'vacances_on', 'vacances_off'];", '];'],
  ['serveur sans vacances', F.serveur, ", vacances_on: 'vacances_pose', vacances_off: 'vacances_retire' };", ' };'],
  ['écran sans libellé', F.ecran, "vacances_pose: 'Mode vacances · posé',", ''],
  ['vc-inject : prix non lu', F.vc, "if (pv != null && pv > 0) out.prixVente", "if (false) out.prixVente"],
  ['vc-inject : nombre nu accepté', F.vc, "if (e && typeof e.sellerPrice === 'string') { const pv = eurosEcrits(e.sellerPrice);", "if (e && e.sellerPrice != null) { const pv = typeof e.sellerPrice === 'number' ? e.sellerPrice : eurosEcrits(e.sellerPrice);"],
  ['rangé tel quel', F.bg, "  if (!p || typeof p !== 'object' || p.cle !== 'sellerPrice' || p.devise !== 'EUR') return null;\n  const v = Number(p.valeur);", "  if (p && typeof p === 'object') return p;\n  const v = Number(p.valeur);"],
  ['prix pas gardé', F.bg, 'prixVenteVc(x.prixVente) || prixVenteVc(prev.prixVente) ? { prixVente: prixVenteVc(x.prixVente) || prixVenteVc(prev.prixVente) }', 'prixVenteVc(x.prixVente) ? { prixVente: prixVenteVc(x.prixVente) }'],
  ['facture au versé', F.sources, "const pv = v.prixVente && typeof v.prixVente === 'object' ? v.prixVente : null;", 'const pv = v.prixVente || (v.montant ? { ...v.montant, cle: \'sellerPrice\' } : null);'],
  ['facture annulée', F.sources, "if (vcVenteAnnulee(v)) return non('annulee', 'la vente est annulée');", ''],
  ['historique remplacé', F.bg, "const l = (Array.isArray(avant) ? avant : []).map(propre).filter(Boolean);", 'const l = [];'],
  ['historique sans borne', F.bg, "if (!Number.isFinite(t) || t < lim || t > maintenant + 6e4) return null;", 'if (!Number.isFinite(t)) return null;'],
  ['historique avec texte', F.bg, "    return { at: new Date(t).toISOString(), total, n, c };\n  };", "    return { ...p, at: new Date(t).toISOString(), total, n, c };\n  };"],
  ['historique : lecture ratée écrit', F.bg, "if (hr === null) { noterDiag('avis_historique_lecture_ratee'); return false; }", ''],
  ['historique : deux points le même jour', F.bg, "for (let i = l.length - 1; i >= 0; i--) if (l[i].at.slice(0, 10) === j) l.splice(i, 1); ", ''],
  ['app : un seul jour suffit', F.notes, "if (new Date(a.t).toISOString().slice(0, 10) === new Date(b.t).toISOString().slice(0, 10)) return null;", ''],
  ['app : total absent compté 0', F.notes, 'const nouveaux = a.total != null && b.total != null && b.total >= a.total ? b.total - a.total : null;', 'const nouveaux = (b.total || 0) - (a.total || 0);'],
];

function copieArbre(racine, rel, src) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'a5340-mut-'));
  for (const x of ['vinted-sync-extension', 'src', 'api', 'scripts']) fs.cpSync(path.join(racine, x), path.join(d, x), { recursive: true, filter: (s) => !/node_modules|\.git\b/.test(s) });
  try { fs.writeFileSync(path.join(d, 'package.json'), fs.readFileSync(path.join(racine, 'package.json'))); } catch (_) {}
  if (rel) fs.writeFileSync(path.join(d, rel), src);
  return d;
}

(async () => {
  const prouve = process.argv.includes('--prouve');
  const res = await controles(RACINE);
  let rouge = 0;
  for (const r of res) { console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.ok ? '' : ' — ' + r.d}`); if (!r.ok) rouge++; }
  console.log(`\n${res.length - rouge}/${res.length} verts`);
  if (!prouve) { process.exit(rouge ? 1 : 0); }
  console.log('\n── MUTATIONS');
  let tenues = 0;
  for (const [nom, rel, avant, apres] of MUTATIONS) {
    const src = fs.readFileSync(path.join(RACINE, rel), 'utf8');
    if (!src.includes(avant)) { console.log(`❌ « ${nom} » : morceau introuvable`); rouge++; continue; }
    const d = copieArbre(RACINE, rel, src.replace(avant, apres));
    const r = await controles(d);
    fs.rmSync(d, { recursive: true, force: true });
    const rougis = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
    if (rougis.length) tenues++; else rouge++;
    console.log(`${rougis.length ? '✅' : '❌'} « ${nom} » ⇒ rouge : ${rougis.join(', ') || 'AUCUN'}`);
  }
  console.log(`${tenues}/${MUTATIONS.length} mutations rougissent`);
  // origin/main (git archive) : le code d'AVANT.
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'a5340-main-'));
  try {
    cp.execSync(`git -C "${RACINE}" archive origin/main vinted-sync-extension src api scripts package.json | tar -x -C "${d}"`, { stdio: 'ignore' });
    const r = await controles(d);
    const n = r.filter((x) => !x.ok).length;
    console.log(`\n── origin/main : ${n} contrôle(s) rouge(s) sur ${r.length} ${n ? '✅' : '❌ (le contrôle ne peut pas échouer)'}`);
    if (!n) rouge++;
  } catch (e) { console.log('❌ origin/main illisible', e.message); rouge++; }
  fs.rmSync(d, { recursive: true, force: true });
  process.exit(rouge ? 1 : 0);
})();
