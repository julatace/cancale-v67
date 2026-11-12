// Audit : LE CODE DE RETRAIT ET LE QR D'UN COLIS, RELIÉS PAR IDENTITÉ (5 nov.).
// src/retraitQr.js exécuté pour de vrai (import ESM), sur des données INVENTÉES :
//  A. lecture des lignes `mr_colis_*` : forme vérifiée, une forme inconnue n'entre pas ;
//  B. un colis lu dans un compte Mondial Relay rejoint l'e-mail du MÊME n° de suivi, jamais
//     un autre (50 colis au même titre, au même relais : aucun ne reçoit le compte d'un autre) ;
//  C. accord des codes, où trouver le QR, fraîcheur, compte du colis ;
//  D. l'achat Leboncoin / Vestiaire d'un colis par son n° de suivi (deux au même n° ⇒ personne) ;
//  E. App.jsx (commentaires retirés) : la lecture projetée, la règle de `pickupUnion` nourrie
//     par les lignes fusionnées, la vue en grand sans titre ni rouge, le QR toujours montré.
// `--prouve` : chaque mutation du module (ou de l'app) doit rendre l'audit ROUGE.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src', 'retraitQr.js');
const APP = path.join(RACINE, 'src', 'App.jsx');

const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

async function verifier(srcModule, srcApp, bavard) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-rqr-'));
  const f = path.join(tmp, 'retraitQr.mjs'); fs.writeFileSync(f, srcModule);
  const M = await import('file://' + f + '?t=' + Date.now());
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (bavard || !c) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  const QR = { type: 'image/svg+xml', b64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64') };
  const L = '2026-11-05T10:00:00.000Z', L2 = '2026-11-05T11:00:00.000Z';
  const ligne = (id, compte, luAt, colis, extra = {}) => ({ id: 'mr_colis_' + id, v: '1', compte, luAt, complet: 'true', colis, ...extra });

  try {
  // ── A. lecture ──
  dit(M.lireColisMondialRelay(null) === null, 'A1 rien lu (null) ⇒ pas su (null), jamais une liste vide');
  const mr = M.lireColisMondialRelay([
    ligne('a1', { libelle: 'compte-a@exemple.fr' }, L, [
      { suivi: '10 000 001', etat: 'disponible', code: '123456', qr: QR, lieu: 'RELAIS A, 1 RUE X, 35000 RENNES', limite: '2026-11-12', sens: 'entrant' },
      { suivi: '10000002', etat: 'en_route', code: '', qr: null, sens: 'entrant' },
      { suivi: '10000003', etat: 'disponible', code: 'suivant', qr: { type: 'text/html', b64: 'PHNjcmlwdD4=' }, sens: 'entrant' },
      { suivi: '10000004', etat: 'disponible', code: '222222', sens: 'sortant' },
      { suivi: '', etat: 'disponible', code: '333333' },
      { suivi: '10000005', etat: 'bizarre' },
    ]),
    ligne('b2', { libelle: 'compte-b@exemple.fr' }, L2, [{ suivi: '10000001', etat: 'disponible', code: '123456', qr: QR, sens: 'entrant' }]),
    ligne('c3', {}, L, [{ suivi: '10000009', etat: 'disponible' }], { v: '2' }),
  ]);
  dit(mr && mr.comptes.length === 2, 'A2 une version inconnue n’entre pas (2 comptes sur 3)', JSON.stringify(mr && mr.comptes.map((c) => c.cle)));
  dit(mr && mr.colis.length === 4, 'A3 sans n°, colis envoyé (sortant), état inconnu : écartés (4 colis gardés)', String(mr && mr.colis.length));
  const c3 = mr && mr.colis.find((c) => c.suivi === '10000003');
  // (5 nov.) « c'est que dans l'app » : AUCUN QR ne vient d'un compte Mondial Relay lu dans le navigateur.
  dit(c3 && c3.code === '' && mr.colis.every((c) => !c.qr), 'A4 un « code » sans chiffres n’est pas pris ; aucun QR n’est pris d’un compte (il n’existe que dans l’app)', JSON.stringify(c3));
  dit(mr && mr.comptes[0].cle === 'b2', 'A5 les comptes du plus récemment relu au plus ancien');

  // ── B. identité ──
  const lignesMr = M.lignesSuiviMondialRelay(mr);
  const l1 = lignesMr.filter((l) => l.suivi === '10000001');
  dit(l1.length === 1 && l1[0].mrCompte.cle === 'b2', 'B1 le même n° lu sur deux comptes = UN colis, la lecture la plus récente', JSON.stringify(l1.map((l) => l.mrCompte)));
  dit(l1[0] && l1[0].carrier === 'mondialrelay' && l1[0].status === 'available' && !l1[0].qrB64 && l1[0].code === '123456', 'B2 forme d’une ligne d’e-mail (transporteur, statut, code ; jamais de QR)');
  dit(M.suivisAvecMondialRelay(null, null) === null && M.suivisAvecMondialRelay(null, { comptes: [], colis: [] }) === null, 'B3 e-mails pas lus et rien de Mondial Relay ⇒ toujours « pas lus » (null)');
  const emails = [];
  for (let i = 0; i < 50; i++) emails.push({ id: 'e' + i, carrier: 'mondialrelay', status: 'available', suivi: String(20000000 + i), artTitle: 'Nike Air Max 90 blanc 42', lieu: 'RELAIS A, 1 RUE X, 35000 RENNES', code: String(400000 + i), receivedAt: L });
  emails.push({ id: 'cible', carrier: 'mondialrelay', status: 'available', suivi: '10000001', artTitle: 'Nike Air Max 90 blanc 42', lieu: 'RELAIS A, 1 RUE X, 35000 RENNES', code: '123456', receivedAt: L });
  const fus = M.suivisAvecMondialRelay(emails, mr);
  const avecCompte = fus.filter((t) => t.mrCompte && t.source !== 'mondialrelay-compte');
  dit(avecCompte.length === 1 && avecCompte[0].id === 'cible', 'B4 50 colis au même titre et au même relais : SEUL celui du même n° reçoit le compte Mondial Relay', avecCompte.map((t) => t.id).join(','));
  dit(fus.length === emails.length + lignesMr.length, 'B5 aucune ligne d’e-mail perdue, les colis Mondial Relay ajoutés');
  dit(fus.every((t, i) => i === 0 || (Date.parse(fus[i - 1].receivedAt || 0) || 0) >= (Date.parse(t.receivedAt || 0) || 0)), 'B6 triées du plus récent au plus ancien (l’ordre attendu par pickupUnion)');

  // ── C. accord, où, fraîcheur, compte ──
  dit(M.accordCodes(fus, '10000001') === 'confirme', 'C1 même code dans l’e-mail et le compte ⇒ « confirmé »');
  const fus2 = M.suivisAvecMondialRelay([{ carrier: 'mondialrelay', status: 'available', suivi: '10000001', code: '999999', receivedAt: L }], mr);
  dit(M.accordCodes(fus2, '10000001') === 'different', 'C2 codes différents ⇒ dit « différent »');
  dit(M.accordCodes(fus, '20000003') === '', 'C3 une seule source ⇒ rien');
  dit(!/compte|site/.test(M.ouTrouverQr('mondialrelay')) && /code suffit/.test(M.ouTrouverQr('mondialrelay')), 'C4 QR Mondial Relay absent ⇒ le code suffit ; ni « compte » ni « site » (le QR n’est que dans l’app)');
  dit(/Chronopost/.test(M.ouTrouverQr('chronopost')) && M.ouTrouverQr('zz') === M.QR_OU_DEFAUT, 'C5 un transporteur inconnu ⇒ la phrase générale');
  const now = Date.parse('2026-11-05T11:03:00Z');
  dit(M.ilYa(L2, now) === 'il y a 3 min' && M.ilYa('', now) === '' && M.ilYa('2026-11-03T11:03:00Z', now) === 'il y a 48 h' || M.ilYa('2026-11-03T11:03:00Z', now) === 'il y a 2 j', 'C6 « relu il y a 3 min » ; date illisible ⇒ rien', M.ilYa(L2, now));
  const cMr = M.compteDuRetrait(fus.find((t) => t.id === 'cible'), mr);
  dit(cMr && cMr.source === 'mondialrelay' && cMr.libelle === 'compte-b@exemple.fr' && cMr.aussiEmail, 'C7 colis d’e-mail aussi lu dans un compte ⇒ ce compte, « aussi par e-mail »', JSON.stringify(cMr));
  const AVANT = '2026-11-05T09:00:00.000Z', APRES = '2026-11-05T10:30:00.000Z';
  const cHors = M.compteDuRetrait({ carrier: 'mondialrelay', recuSur: ['boite@exemple.fr'], receivedAt: AVANT }, mr);
  dit(cHors && cHors.source === 'email' && cHors.libelle === 'boite@exemple.fr' && cHors.horsComptes === true, 'C8 arrivé par e-mail, dans aucun compte relu complet ⇒ dit', JSON.stringify(cHors));
  const mrPartiel = { comptes: [{ ...mr.comptes[0], complet: false }], colis: [] };
  dit(M.compteDuRetrait({ carrier: 'mondialrelay', recuSur: ['boite@exemple.fr'], receivedAt: AVANT }, mrPartiel).horsComptes === false, 'C9 une lecture partielle ne permet pas de dire « dans aucun compte » (pas su ≠ non)');
  dit(M.compteDuRetrait({ carrier: 'chronopost' }, mr) === null, 'C10 rien de su ⇒ null (jamais deviné)');
  // (revue adverse du 5 nov.)
  const cApres = M.compteDuRetrait({ carrier: 'mondialrelay', recuSur: ['boite@exemple.fr'], receivedAt: APRES }, mr);
  dit(cApres && cApres.horsComptes === false, 'C11 e-mail reçu APRÈS la lecture d’un compte ⇒ jamais « dans aucun compte » (pas su ≠ non)', JSON.stringify(cApres));
  dit(M.compteDuRetrait({ carrier: 'mondialrelay', receivedAt: AVANT }, mr) && M.compteDuRetrait({ carrier: 'mondialrelay', _o: {}, receivedAt: AVANT }, mr) === null
    && M.compteDuRetrait({ carrier: 'mondialrelay', synthetique: true, receivedAt: AVANT }, mr) === null, 'C12 un colis vu par Vinted ou lu chez le transporteur n’est jamais « arrivé par e-mail »');
  const fus3 = M.suivisAvecMondialRelay([{ carrier: 'mondialrelay', status: 'available', suivi: '10000001', code: '123456', account: 'compte_v', recuSur: ['boite@exemple.fr'], artTitle: 'Paire X', arriveLe: '2026-11-03T08:00:00.000Z', receivedAt: AVANT }], mr);
  const lmr = fus3.find((t) => t.source === 'mondialrelay-compte' && t.suivi === '10000001');
  dit(lmr && lmr.account === 'compte_v' && lmr.recuSur && lmr.recuSur[0] === 'boite@exemple.fr' && lmr.artTitle === 'Paire X' && lmr.arriveLe === '2026-11-03T08:00:00.000Z' && lmr.aussiEmail,
    'C13 la ligne du compte reprend ce que seul l’e-mail du MÊME n° sait (compte Vinted, adresse, titre, arrivée lue)', JSON.stringify(lmr && { a: lmr.account, r: lmr.recuSur, ar: lmr.arriveLe }));
  const autre = fus3.find((t) => t.source === 'mondialrelay-compte' && t.suivi !== '10000001');
  dit(autre && !autre.account && !autre.artTitle && !autre.aussiEmail, 'C14 un autre n° ne reçoit rien de cet e-mail (§5)');
  dit(M.codeDuCompteMr(fus2, '10000001') === '123456' && M.codeDuCompteMr(fus2, '20000003') === '', 'C15 le code du compte pour CE n° (pour dire qui fait foi sous le code montré)');

  // ── D. achats des autres sites ──
  const idx = M.indexAchatsAutresSites({
    lbcVentes: [
      { isSeller: false, txId: 1, title: 'Air Max', label: { trackingUrl: 'https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRLBCOIN&exp=30000001&language=FR&CodePostal=35000' } },
      { isSeller: true, txId: 2, title: 'Vendue', label: { trackingUrl: 'https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRLBCOIN&exp=30000002&language=FR' } },
      { isSeller: false, txId: 3, title: 'Doublon A', label: { trackingUrl: 'https://www.mondialrelay.com/x?exp=30000003' } },
      { isSeller: false, txId: 4, title: 'Doublon B', label: { trackingUrl: 'https://www.mondialrelay.com/x?exp=30000003' } },
      { isSeller: false, txId: 5, title: 'Air Max', label: { trackingUrl: 'https://autre.example/x?exp=30000005' } },
    ],
    vcAchats: { v1: { nom: 'Sac', suivi: 'XW 1234 5678 FR' } },
  });
  dit(idx.get('30000001') && idx.get('30000001').site === 'leboncoin', 'D1 achat Leboncoin relié par le n° d’expédition Mondial Relay de son lien de suivi');
  dit(!idx.has('30000002'), 'D2 une VENTE n’est jamais l’achat d’un colis à retirer');
  dit(!idx.has('30000003'), 'D3 deux achats au même n° ⇒ personne (§5)');
  dit(!idx.has('30000005'), 'D4 un lien qui n’est pas Mondial Relay ne donne aucun n°');
  dit(idx.get('XW12345678FR') && idx.get('XW12345678FR').site === 'vestiaire', 'D5 achat Vestiaire relié par son n° de suivi');
  dit(![...idx.keys()].some((k) => /AIR|MAX/.test(k)), 'D6 aucune clé tirée d’un titre');

  } catch (e) { dit(false, 'A–D src/retraitQr.js a pu s’exécuter', String(e.message || e).slice(0, 120)); }
  // ── E. l'app ──
  const app = sansCommentaires(srcApp);
  dit(/lireTout\(`id=like\.mr_colis_\*&select=\$\{MR_SELECT\}`/.test(app) && !/mr_colis_[^`]*select=data[`&]/.test(app), 'E1 les lignes mr_colis_* lues projetées (jamais select=data), paginées');
  const pu = app.slice(app.indexOf('const pickupUnion = useMemo('), app.indexOf('const groupesRelais = useMemo('));
  dit(/finsColis\(trackingRetrait,/.test(pu) && !/\btracking\b/.test(pu.replace(/trackingRetrait/g, '')), 'E2 pickupUnion ne lit QUE les lignes fusionnées (e-mails + comptes Mondial Relay)');
  dit(/const trackingRetrait = useMemo\(\(\) => (?:avecQrPoses\()?suivisAvecMondialRelay\(tracking, mrColis\)/.test(app), 'E3 la fusion vient de src/retraitQr.js (une règle ; + les QR posés depuis une capture, src/qrCapture.js)');
  const ov = app.slice(app.indexOf('const openQrView = async'), app.indexOf('const openQrView = async') + 3000);
  dit(!/normTitle/.test(ov), 'E4 la vue en grand ne cherche plus la photo par le titre (§5)');
  dit(/if \(t\.qrB64\) \{ setQrView/.test(ov) && !/r\.mode === 'qr' && t\.qrB64/.test(ov), 'E5 un vrai QR se montre quel que soit le mode du transporteur (Mondial Relay compris)');
  // (6 nov., v36) La vue en grand finit à SA feuille (l'ancien bandeau « Colis retiré » qui la suivait est parti : la pilule « Annuler »).
  const iVue = app.indexOf('data-qr-plein=""'), fVue = app.indexOf('</SheetShell>', iVue);
  const vue = iVue > 0 && fVue > iVue ? app.slice(iVue, fVue) : '';
  dit(vue.length > 100 && !/#c53030|#ff3b30|#e53e3e|\bred\b|C\.danger/i.test(vue), 'E6 aucun rouge dans la vue en grand (§7 : rouge = deux paires sous un N°)');
  // (intégration g1) Julien, 11 nov. (« des QR codes dans tous les sens ») : la carte ne commente plus un QR
  // absent ; la vue en grand dit où le trouver (`qrOu`, issu de `ouTrouverQr`).
  dit(!/data-colis-qr-absent=/.test(app) && /ouTrouverQr\(/.test(app) && /data-qr-plein-absent=\{ck\}[\s\S]{0,120}qrView\.qrOu/.test(app), 'E7 un QR absent est dit dans la vue en grand, avec où le trouver (plus sur la carte, décision du 11 nov.)');
  dit(/<GardeEcranAllume\/>/.test(app) && /data-qr-plein-luminosite/.test(app), 'E8 l’écran reste allumé et la luminosité est expliquée');
  dit(/data-lbc-qr-depot/.test(app), 'E9 le QR de dépôt Leboncoin sur la carte du colis à envoyer');
  dit(/=== codeDuCompteMr\(trackingRetrait, suiviDeLigne\(t\)\) \? 'compte' : 'email'/.test(app) && /qrView\.code===qrView\.codeMr/.test(app), 'E10 « qui fait foi » se juge sur le code MONTRÉ (carte et vue en grand)');
  const iTx = app.indexOf('const txSuivisColis = useMemo('), iFs = app.indexOf('const finsSuivis = useMemo(');
  dit(iTx > 0 && /trackingRetrait/.test(app.slice(iTx, iTx + 900)) && /finsColis\(trackingRetrait,/.test(app.slice(iFs, iFs + 200)) && app.indexOf('const trackingRetrait = useMemo(') < iTx,
    'E11 fenêtre des transactions et étapes des suivis à la main lisent les mêmes lignes que pickupUnion (déclarées avant, §4.6)');
  fs.rmSync(tmp, { recursive: true, force: true });
  return { ok, ko };
}

const MUTATIONS = [
  ['module', 'B4 : relier par le titre', (s) => s.replace("const k = t ? norm(t.suivi) : '';", "const k = t ? norm(t.suivi) : ''; if (t && t.artTitle && parN.size) return { ...t, mrCompte: [...parN.values()][0] };")],
  ['module', 'A3 : accepter le sens sortant', (s) => s.replace("|| (x.sens && x.sens !== 'entrant')", '')],
  ['module', 'A4 : le QR d’un compte repris', (s) => s.replace("colis.push({ suivi, status, code: codeRetraitMr(x.code), lieu", "colis.push({ suivi, status, code: codeRetraitMr(x.code), qr: x.qr || null, lieu")],
  ['module', 'B1 : garder la plus ancienne lecture', (s) => s.replace('>= (Date.parse(c.luAt) || 0)) continue;', '<= (Date.parse(c.luAt) || 0)) continue;')],
  ['module', 'C9 : lecture partielle = complète', (s) => s.replace('mrLus.every((c) => c.complet &&', 'mrLus.every((c) => true &&')],
  ['module', 'C11 : lecture d’avant l’e-mail suffit', (s) => s.replace("mrLus.every((c) => c.complet && (Date.parse(c.luAt || '') || 0) >= recuMs)", 'mrLus.every((c) => c.complet)')],
  ['module', 'C12 : conversation « par e-mail »', (s) => s.replace("if (t._o || t.synthetique || t.source === 'mondialrelay-compte') return null;", '')],
  ['module', 'C13 : la ligne du compte efface l’e-mail', (s) => s.replace('if (!es.length) return l;', 'return l;')],
  ['app', 'E10 : « fait foi » sans regarder le code montré', (s) => s.replace("codeRetrait(t.code) === codeDuCompteMr(trackingRetrait, suiviDeLigne(t)) ? 'compte' : 'email'", "true ? 'compte' : 'email'")],
  ['module', 'D3 : doublon gardé', (s) => s.replace('for (const k of doubles) m.delete(k);', '')],
  ['module', 'A1 : rien lu ⇒ liste vide', (s) => s.replace('if (!Array.isArray(rows)) return null;', 'if (!Array.isArray(rows)) return { comptes: [], colis: [], ignores: 0 };')],
  ['app', 'E4 : photo par le titre', (s) => s.replace('const ph = (t && t._o) ||', 'const ph = buysBase.find(o => normTitle(o.title) === normTitle(t.artTitle)) || (t && t._o) ||')],
  ['app', 'E2 : pickupUnion sur les e-mails seuls', (s) => s.replace('const fins = finsColis(trackingRetrait,', 'const fins = finsColis(tracking,')],
  // (5 nov., chantier D) « En grand » passe en SheetShell : la date limite est une ligne `is-ambre` — l'ancre suit.
  ['app', 'E6 : rouge remis sur la date limite', (s) => s.replace("<li className={lim.j <= 1 ? 'is-ambre' : ''}", "<li style={{color:lim.j<=2?'#c53030':undefined}} className={lim.j <= 1 ? 'is-ambre' : ''}")],
  ['app', 'E5 : QR seulement en mode qr', (s) => s.replace('if (t.qrB64) { setQrView', "if (r.mode === 'qr' && t.qrB64) { setQrView")],
];

(async () => {
  const mod = fs.existsSync(SRC) ? fs.readFileSync(SRC, 'utf8') : 'export {};', app = fs.readFileSync(APP, 'utf8');
  console.log('— audit-retrait-qr');
  const r = await verifier(mod, app, true);
  console.log(`\n${r.ok} vert(s), ${r.ko} rouge(s)`);
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    for (const [cible, nom, f] of MUTATIONS) {
      const m2 = cible === 'module' ? f(mod) : mod, a2 = cible === 'app' ? f(app) : app;
      if ((cible === 'module' ? m2 : a2) === (cible === 'module' ? mod : app)) { console.log(`  ⚠️ mutation non appliquée : ${nom}`); continue; }
      const x = await verifier(m2, a2, false);
      console.log(`  ${x.ko ? '🔴' : '⚪'} mutation « ${nom} » : ${x.ko} rouge(s)`);
      if (x.ko) rouges++;
    }
    console.log(`\nmutations rouges : ${rouges}/${MUTATIONS.length}`);
    if (rouges !== MUTATIONS.length) process.exit(1);
  }
  process.exit(r.ko ? 1 : 0);
})();
