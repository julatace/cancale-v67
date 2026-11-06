// Audit : LE QR MONDIAL RELAY N'EXISTE QUE DANS L'APP (5 nov.) — « je ne peux pas avoir
// les qr code dans le navigateur c'est que dans l'app » (Julien, mot pour mot).
// src/qrCapture.js exécuté pour de vrai (import ESM), avec les VRAIES bibliothèques
// (qrcode-generator, jsQR), sur des données INVENTÉES :
//  A. le jugement d'une capture : SON clic est l'identité ; aucun QR, plusieurs QR, un
//     contenu qui porte le n° ou le code d'un AUTRE colis, un QR déjà posé ailleurs,
//     un contenu non recopiable ⇒ RIEN n'est posé ;
//  B. la recopie : le contenu LU, dessiné, relu (aller-retour exact) — sinon rien ;
//  C. rien n'est jamais généré depuis le code : un colis sans capture n'a pas d'image ;
//     un QR posé ne va que sur SON n° (50 colis identiques), pas sur un code nouveau ;
//     dans l'app, la recopie ne reçoit QUE le contenu jugé ;
//  D. aucun texte ne promet un QR Mondial Relay lu par le navigateur ou l'extension
//     (app, module, animation, passation) ; un QR « lu dans un compte » est ignoré ;
//  E. l'app : « QR dans l'app Mondial Relay », « Ajouter le QR », « Retirer ce QR »,
//     le QR posé nourrit les lignes de suivi, synchronisé, lu localement.
// `--prouve` : chaque mutation doit rendre l'audit ROUGE.
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const F = {
  qr: path.join(RACINE, 'src', 'qrCapture.js'),
  rqr: path.join(RACINE, 'src', 'retraitQr.js'),
  lire: path.join(RACINE, 'src', 'lireQrCapture.js'),
  explique: path.join(RACINE, 'src', 'ExpliqueMondialRelay.jsx'),
  app: path.join(RACINE, 'src', 'App.jsx'),
  doc: path.join(RACINE, 'docs', 'passation', '2026-11-05-colis-qr.md'),
};
const lire = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
let qrcode, jsQR;
try { qrcode = require(path.join(RACINE, 'node_modules', 'qrcode-generator')); jsQR = require(path.join(RACINE, 'node_modules', 'jsqr')); jsQR = jsQR.default || jsQR; }
catch (_) { qrcode = require('qrcode-generator'); jsQR = require('jsqr'); jsQR = jsQR.default || jsQR; }

const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

async function verifier(src, bavard) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-qrcap-'));
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (bavard || !c) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  const charge = async (nom, code) => { const f = path.join(tmp, nom + '.mjs'); fs.writeFileSync(f, code || 'export {};'); return import('file://' + f + '?t=' + Date.now() + Math.random()); };
  let M = {}, R = {};
  try { M = await charge('qrCapture', src.qr); } catch (e) { dit(false, 'src/qrCapture.js a pu se charger', String(e.message || e).slice(0, 120)); }
  try { R = await charge('retraitQr', src.rqr); } catch (e) { dit(false, 'src/retraitQr.js a pu se charger', String(e.message || e).slice(0, 120)); }
  try {
    const ICI = { suivi: '81000001', code: '100001' };
    const AUTRES = [{ suivi: '81000002', code: '200002' }, { suivi: '81000003', code: 'A30003', code2: 'B30003' }, { suivi: ICI.suivi, code: ICI.code }];

    // ── A. le jugement ──
    const j0 = M.jugerQrCapture({ contenus: [], colis: ICI, autres: AUTRES });
    dit(j0 && j0.etat === 'aucun', 'A1 aucun QR lisible sur la capture ⇒ rien n’est posé', JSON.stringify(j0));
    const jn = M.jugerQrCapture({ contenus: null, colis: ICI, autres: AUTRES });
    dit(jn && jn.etat === 'illisible', 'A2 capture pas ouverte (null) ⇒ « illisible », rien n’est posé', JSON.stringify(jn));
    const j2 = M.jugerQrCapture({ contenus: ['MR:ABC', 'MR:DEF'], colis: ICI, autres: AUTRES });
    dit(j2 && j2.etat === 'plusieurs', 'A3 deux QR différents sur la capture ⇒ on ne choisit pas', JSON.stringify(j2));
    const ja = M.jugerQrCapture({ contenus: ['MRQR;81000002;X'], colis: ICI, autres: AUTRES });
    dit(ja && ja.etat === 'autre' && ja.suivi === '81000002', 'A4 le contenu porte le n° de suivi d’un AUTRE colis ⇒ rien n’est posé, et c’est dit', JSON.stringify(ja));
    const jc = M.jugerQrCapture({ contenus: ['RETRAIT 200002'], colis: ICI, autres: AUTRES });
    dit(jc && jc.etat === 'autre', 'A5 le contenu porte le CODE DE RETRAIT d’un autre colis ⇒ rien', JSON.stringify(jc));
    const jl = M.jugerQrCapture({ contenus: ['56810000020101000000000000'], colis: ICI, autres: AUTRES });
    dit(jl && jl.etat === 'autre', 'A6 un code-barres de 26 chiffres qui désigne l’autre n° (chiffres 3 à 10) ⇒ rien', JSON.stringify(jl));
    const jp = M.jugerQrCapture({ contenus: ['MRQR;81000001;100001'], colis: ICI, autres: AUTRES });
    dit(jp && jp.etat === 'pose' && jp.porte === true && jp.contenu === 'MRQR;81000001;100001', 'A7 le contenu porte CE colis ⇒ posé, « il porte le n° de ce colis »', JSON.stringify(jp));
    const jx = M.jugerQrCapture({ contenus: ['Z9Q8W7'], colis: ICI, autres: AUTRES });
    dit(jx && jx.etat === 'pose' && jx.porte === false, 'A8 un contenu sans identité connue ⇒ posé sur SON clic (porte = non)', JSON.stringify(jx));
    const jd = M.jugerQrCapture({ contenus: ['Z9Q8W7'], colis: ICI, autres: AUTRES, poses: { '81000002': { contenu: 'Z9Q8W7' } } });
    dit(jd && jd.etat === 'deja' && jd.suivi === '81000002', 'A9 le même QR déjà posé sur un autre colis ⇒ rien (un QR, un colis)', JSON.stringify(jd));
    const jr = M.jugerQrCapture({ contenus: ['Colis été ✓'], colis: ICI, autres: AUTRES });
    dit(jr && jr.etat === 'recopie', 'A10 un contenu qui ne se recopie pas à l’identique (hors ASCII) ⇒ rien', JSON.stringify(jr));
    const js = M.jugerQrCapture({ contenus: ['Z9Q8W7'], colis: { code: '100001' }, autres: AUTRES });
    dit(js && js.etat === 'sans-suivi', 'A11 un colis sans n° de suivi ⇒ rien ne peut y être posé', JSON.stringify(js));
    const jt = M.jugerQrCapture({ contenus: ['X 100001'], colis: ICI, autres: [{ suivi: '', code: '100001' }] });
    dit(jt && jt.etat === 'pose', 'A12 la conversation du MÊME colis (même code, sans n°) n’est pas « un autre colis »', JSON.stringify(jt));
    const tous = ['aucun', 'illisible', 'plusieurs', 'autre', 'deja', 'recopie', 'sans-suivi'].every((e) => /rien/i.test(M.messageQrCapture({ etat: e, suivi: '81000002' })));
    dit(tous, 'A13 chaque refus dit « rien n’est posé »');

    // ── B. la recopie (aller-retour) ──
    const d = M.dessinerQrCapture('MRQR;81000001;100001', { qrcode, jsQR });
    dit(d && d.type === 'image/gif' && /^[A-Za-z0-9+/]+=*$/.test(d.b64) && d.b64.length < 20000, 'B1 le contenu lu est dessiné (GIF, petit)', d ? `${d.modules} modules, ${d.b64.length} car.` : 'null');
    const faux = (px, w, h, o) => { const r = jsQR(px, w, h, o); return r ? { ...r, data: r.data + 'X' } : r; };
    dit(M.dessinerQrCapture('MRQR;81000001;100001', { qrcode, jsQR: faux }) === null, 'B2 une image qui ne se RELIT pas exactement ⇒ rien (aller-retour exigé)');
    dit(M.dessinerQrCapture('Colis été', { qrcode, jsQR }) === null && M.dessinerQrCapture('MRQR', {}) === null, 'B3 hors ASCII, ou sans bibliothèques ⇒ rien');
    // Relecture indépendante du dessin : la matrice redessinée par qrcode-generator, relue par jsQR, rend le contenu.
    let relu = null, nMod = 0;
    try { const q = qrcode(0, 'M'); q.addData('MRQR;81000001;100001', 'Byte'); q.make(); const n = q.getModuleCount(), c = 3, w = (n + 8) * c; nMod = n; const px = new Uint8ClampedArray(w * w * 4).fill(255);
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) { const i = (((r + 4) * c + y) * w + (k + 4) * c + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
      relu = jsQR(px, w, w); } catch (_) {}
    dit(relu && relu.data === 'MRQR;81000001;100001' && d && d.modules === nMod, 'B4 relecture indépendante : le dessin porte exactement le contenu lu');

    // ── C. rien depuis le code ──
    const lignes = [];
    for (let i = 0; i < 50; i++) lignes.push({ id: 'e' + i, carrier: 'mondialrelay', status: 'available', suivi: String(82000000 + i), code: String(500000 + i), artTitle: 'Nike Air Max 90 blanc 42', lieu: 'RELAIS A, 1 RUE X, 35000 RENNES' });
    const sansPose = M.avecQrPoses(lignes, {});
    dit(Array.isArray(sansPose) && sansPose.every((t) => !t.qrB64 && !t.qrUrl), 'C1 aucun QR posé ⇒ aucune image, même avec un code de retrait (jamais un QR depuis le code)');
    const pose = { contenu: 'MRQR;82000007;500007', type: 'image/gif', b64: d ? d.b64 : 'R0lGODlh', code: '500007', at: '2026-11-05T10:00:00.000Z' };
    // Les 50 sans code lu (le code ne départage donc rien) : seul le n° de suivi désigne le colis.
    const avec = M.avecQrPoses(lignes.map((t) => ({ ...t, code: '' })), { '82000007': pose });
    const touchees = avec.filter((t) => t.qrB64);
    dit(touchees.length === 1 && touchees[0].id === 'e7' && touchees[0].qrSource === 'capture', 'C2 50 colis au même titre, au même relais : le QR posé ne va que sur SON n°', touchees.map((t) => t.id).join(','));
    const nouveauCode = M.avecQrPoses([{ suivi: '82000007', code: '999999' }], { '82000007': pose });
    dit(!nouveauCode[0].qrB64, 'C3 un code NOUVEAU pour ce n° ⇒ le QR posé (de l’ancien code) n’est pas montré');
    const aSonQr = M.avecQrPoses([{ suivi: '82000007', code: '500007', qrUrl: 'https://exemple.invalid/qr' }], { '82000007': pose });
    dit(aSonQr[0].qrUrl === 'https://exemple.invalid/qr' && !aSonQr[0].qrB64, 'C4 une ligne qui a déjà son QR le garde');
    dit(M.avecQrPoses(null, { '82000007': pose }) === null, 'C5 e-mails pas lus (null) ⇒ toujours null');
    dit(!M.poseValide({ ...pose, type: 'image/svg+xml' }) && !M.poseValide({ ...pose, contenu: '' }) && !M.poseValide({ ...pose, b64: '<svg>' }) && !!M.poseValide(pose), 'C6 une pose de forme inconnue n’entre pas');

  } catch (e) { dit(false, 'A–C src/qrCapture.js a pu s’exécuter', String(e.message || e).slice(0, 160)); }
  try {
    // ── D. aucune promesse d'un QR Mondial Relay par le navigateur ──
    const mr = R.lireColisMondialRelay([{ id: 'mr_colis_a', v: '1', compte: { libelle: 'x' }, luAt: '2026-11-05T10:00:00.000Z', complet: 'true',
      colis: [{ suivi: '81000009', etat: 'disponible', code: '100009', sens: 'entrant', qr: { type: 'image/png', b64: 'iVBORw0KGgo=' } }] }]);
    const lmr = R.lignesSuiviMondialRelay(mr);
    dit(mr && mr.colis.length === 1 && !mr.colis[0].qr && lmr.length === 1 && !lmr[0].qrB64 && !lmr[0].qrType, 'D1 un « QR » lu dans un compte mondialrelay.fr est IGNORÉ (il n’y existe pas) ; le code reste', JSON.stringify(lmr[0] && { code: lmr[0].code, qr: lmr[0].qrB64 }));
    const ouMr = R.ouTrouverQr('mondialrelay');
    dit(typeof M.titreQrAbsent === 'function' && M.titreQrAbsent('mondialrelay') === 'QR dans l’app Mondial Relay' && M.titreQrAbsent('chronopost') === 'QR pas reçu' && !/compte|site|mondialrelay\.fr|e-mail/i.test(ouMr) && /code suffit/.test(ouMr),
      'D2 Mondial Relay sans QR ⇒ « QR dans l’app Mondial Relay » ; le code suffit ; ni site ni compte', ouMr);
  } catch (e) { dit(false, 'D1–D2 a pu s’exécuter', String(e.message || e).slice(0, 160)); }
  try {
    const textes = sansCommentaires(src.app) + '\n' + sansCommentaires(src.explique) + '\n' + sansCommentaires(src.rqr) + '\n' + sansCommentaires(src.qr);
    const PROMESSES = [
      [/colis et leurs QR/i, '« tes colis et leurs QR »'],
      [/Ouvrir Mondial Relay \(QR\)/, '« Ouvrir Mondial Relay (QR) »'],
      [/compte Mondial Relay \(site ou application\)/i, '« compte Mondial Relay (site ou application) »'],
      [/[^\n]{0,80}QR[^\n]{0,80}mondialrelay\.fr|mondialrelay\.fr[^\n]{0,80}QR/, 'QR et mondialrelay.fr sur une même ligne'],
      [/QR[^\n`'"]{0,60}(?:ton|tes|ses) compte[s]? Mondial Relay|compte[s]? Mondial Relay[^\n`'"]{0,40}(?:et|avec) (?:leur|son|ses) QR/i, 'le QR « dans ton compte Mondial Relay »'],
      [/extension[^\n`'"]{0,80}QR[^\n`'"]{0,40}Mondial|Mondial Relay[^\n`'"]{0,80}extension[^\n`'"]{0,60}QR/i, 'l’extension et le QR Mondial Relay'],
    ];
    const trouves = PROMESSES.filter(([re]) => re.test(textes)).map(([, n]) => n);
    dit(!trouves.length, 'D3 aucun texte (app, animation, modules) ne promet un QR Mondial Relay lu par le navigateur ou l’extension', trouves.join(' ; '));
    const ex = sansCommentaires(src.explique);
    dit(/App Mondial Relay/.test(ex) && /capture/.test(ex) && /Ajouter le QR/.test(ex) && !/mondialrelay\.fr<|>mondialrelay\.fr|Ouvre ton compte/i.test(ex.split('export function LecturesMondialRelay')[0] || ''), 'D4 l’animation montre le SEUL chemin : une capture de l’app, « Ajouter le QR »');
    const sec3 = (src.doc.split(/\n## 3\./)[1] || '').split(/\n## 4\./)[0];
    dit(sec3.length > 200 && /jamais pour le QR/i.test(sec3) && !/"qr"\s*:/.test(sec3) && !/capte TOUS les colis arrivés avec leurs QR/.test(src.doc.split('## 6.')[0]), 'D5 la passation §3 : la lecture des comptes mondialrelay.fr = CODE, lieu, date, jamais le QR (plus de champ `qr`)');

    // ── E. l'app ──
    const app = sansCommentaires(src.app);
    const iT = app.indexOf('const trackingRetrait = useMemo('), iP = app.indexOf("useStateCle(CLE_QR_POSES");
    dit(iP > 0 && iT > iP && /avecQrPoses\(suivisAvecMondialRelay\(tracking, mrColis\), qrPoses,/.test(app), 'E1 les QR posés nourrissent les lignes de suivi (une règle), déclarés AVANT (§4.6)');
    // (6 nov., v36) Depuis le chantier D (« En grand » refait), la vue en grand lit le
    // transporteur UNE fois (`const ck = carrierKey(qrView.carrier) || ''`) et écrit
    // `titreQrAbsent(ck)`. On juge la RÈGLE : le titre « QR absent » de la vue en grand
    // vient de `titreQrAbsent` appliqué au transporteur DE CE colis (directement ou par
    // une constante qui le porte), jamais un texte en dur.
    const vueGrand = (() => { const i = app.indexOf('{qrView && (()=>{'); return i < 0 ? '' : app.slice(i, app.indexOf('</SheetShell>', i)); })();
    const cstCk = (vueGrand.match(/const (\w+) = carrierKey\(qrView\.carrier\)(?: \|\| '')?;/) || [])[1];
    const grandOk = /titreQrAbsent\(carrierKey\(qrView\.carrier\)\)/.test(vueGrand) || (!!cstCk && new RegExp('<strong>\\{titreQrAbsent\\(' + cstCk + '\\)\\}</strong>').test(vueGrand));
    dit(/titreQrAbsent\(carrierKey\(tr\)\)/.test(app) && grandOk && !/<strong>QR pas reçu<\/strong>/.test(app), 'E2 carte et vue en grand : « QR dans l’app Mondial Relay » (plus « QR pas reçu » écrit en dur)');
    dit(/data-colis-qr-ajouter=""/.test(app) && /data-qr-plein-ajouter=""/.test(app) && /qrParCapture\(carrierKey\(t\.carrier\)\)/.test(app), 'E3 « Ajouter le QR (capture) » sur la carte et dans « En grand », Mondial Relay seulement');
    // (6 nov., v36) Les espaces autour de la flèche ne sont pas la règle : le bouton
    // « Retirer ce QR » de la vue en grand appelle `retirerQrPose` sur CE colis, à son clic.
    dit(/data-qr-plein-retirer=""[^>]*onClick=\{\s*\(\)\s*=>\s*retirerQrPose\(qrView\._t\)\s*\}[^>]*>Retirer ce QR</.test(vueGrand), 'E4 « Retirer ce QR » sur son clic');
    const appels = app.match(/dessinerQrCapture\(([^,)]*)/g) || [];
    dit(appels.length === 1 && /dessinerQrCapture\(j\.contenu$/.test(appels[0]) && !/from ['"]qrcode-generator['"]/.test(app) && !/\bqrcode\(/.test(app), 'E5 la recopie ne reçoit QUE le contenu jugé (jamais le code ni le n°) ; aucun générateur de QR dans l’app', appels.join(' | '));
    const aj = app.slice(app.indexOf('const ajouterQrCapture = async'), app.indexOf('const retirerQrPose ='));
    dit(/if \(j\.etat === 'pose'\) \{\s*const p = \{ contenu: j\.contenu/.test(aj) && (aj.match(/save\(CLE_QR_POSES/g) || []).length === 1 && /const k = t \? suiviDeLigne\(t\) : ''/.test(aj), 'E6 rangé seulement si le jugement dit « pose », sous le n° du colis de SON clic');
    dit(/'vrm_colis_qr_poses',/.test(app.slice(0, app.indexOf('const save = (k,v)'))) && /setQrPoses\(n => vide\(n\) \? load\(CLE_QR_POSES/.test(app), 'E7 synchronisé (SYNC_KEYS) et relu du nuage au montage');
    const lq = sansCommentaires(src.lire);
    dit(lq.length > 200 && /import\('jsqr'\)/.test(lq) && /BarcodeDetector/.test(lq) && !/fetch\(|XMLHttpRequest|https?:\/\/|sendBeacon|createElement\('script'\)/.test(lq), 'E8 lu DANS la page : BarcodeDetector, sinon jsQR embarqué — aucun envoi, aucun script d’ailleurs');
  } catch (e) { dit(false, 'les modules ont pu s’exécuter', String(e.message || e).slice(0, 160)); }
  fs.rmSync(tmp, { recursive: true, force: true });
  return { ok, ko };
}

const MUTATIONS = [
  ['qr', 'A4 : un autre colis ignoré', (s) => s.replace("if (!miennes.has(id) && ids.has(id)) return { etat: 'autre'", "if (false) return { etat: 'autre'")],
  ['qr', 'A3 : plusieurs QR ⇒ le premier', (s) => s.replace("if (uniques.length > 1) return { etat: 'plusieurs', n: uniques.length };", '')],
  ['qr', 'A9 : un QR posé deux fois', (s) => s.replace("if (k !== cle && p && p.contenu === contenu) return { etat: 'deja', suivi: k };", '')],
  ['qr', 'A10 : tout contenu recopiable', (s) => s.replace("&& /^[\\x20-\\x7E]+$/.test(s)", '')],
  ['qr', 'B2 : aller-retour retiré', (s) => s.replace('if (!relu || relu.data !== contenu) return null;', '')],
  ['qr', 'C2 : le QR posé sur toutes les lignes', (s) => s.replace('const k = suiviDe(t); const p = k ? poseValide(poses[k]) : null;', 'const p = poseValide(Object.values(poses)[0]);')],
  ['qr', 'C3 : code nouveau ignoré', (s) => s.replace('if (cLigne && cPose && cLigne !== cPose) return t;', '')],
  ['qr', 'D2 : « QR pas reçu » pour Mondial Relay', (s) => s.replace("=== 'mondialrelay' ? 'QR dans l’app Mondial Relay' : 'QR pas reçu'", "=== 'x' ? '' : 'QR pas reçu'")],
  ['rqr', 'D1 : QR lu dans un compte accepté', (s) => s.replace('code: c.code || null, code2: null, qrB64: null, qrType: null,', "code: c.code || null, code2: null, qrB64: 'iVBORw0KGgo=', qrType: 'image/png',")],
  ['rqr', 'D2 : l’ancienne phrase (site ou application)', (s) => s.replace("mondialrelay: 'Le code suffit au comptoir.',", "mondialrelay: 'Il est dans ton compte Mondial Relay (site ou application). Au comptoir, le code suffit.',")],
  ['explique', 'D3 : l’animation promet les QR du compte', (s) => s.replace('ouvre le colis et fais une capture d’écran de son QR.', 'VRM récupère tes colis et leurs QR.')],
  // (6 nov., v36) « En grand » refait (chantier D) : le lien de suivi est un `Bouton`.
  ['app', 'D3 : « Ouvrir Mondial Relay (QR) » remis', (s) => s.replace('data-qr-plein-suivre="">Suivre le colis</Bouton>', "data-qr-plein-suivre=\"\">{qrView.carrier==='mondialrelay' && !qrView.img ? 'Ouvrir Mondial Relay (QR)' : 'Suivre le colis'}</Bouton>")],
  ['app', 'E5 : un QR fabriqué depuis le code', (s) => s.replace("dessinerQrCapture(j.contenu, libs || {})", 'dessinerQrCapture(codeRetrait(t.code) || j.contenu, libs || {})')],
  ['app', 'E6 : posé quel que soit le jugement', (s) => s.replace("if (j.etat === 'pose') {\n      const p = { contenu: j.contenu", "if (true) {\n      const p = { contenu: j.contenu")],
  ['app', 'E2 : « QR pas reçu » en dur sur la carte', (s) => s.replace('<strong>{titreQrAbsent(carrierKey(tr))}</strong>', '<strong>QR pas reçu</strong>')],
  ['app', 'E2 : « QR pas reçu » en dur dans « En grand »', (s) => s.replace('<strong>{titreQrAbsent(ck)}</strong>', '<strong>QR pas reçu</strong>')],
  ['app', 'E2 : « En grand » juge un autre transporteur', (s) => s.replace("const ck = carrierKey(qrView.carrier) || '';", "const ck = 'colissimo';")],
  ['app', 'E4 : « Retirer ce QR » ne retire rien', (s) => s.replace('onClick={() => retirerQrPose(qrView._t)}>Retirer ce QR', 'onClick={() => setQrView(null)}>Retirer ce QR')],
  ['lire', 'E8 : ZXing chargé d’un CDN', (s) => s.replace("const { default: jsQR } = await import('jsqr');", "const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js'; const { default: jsQR } = await import('jsqr');")],
  ['doc', 'D5 : la spécification remet un champ qr', (s) => s.replace('"code": "<code de retrait>",', '"code": "<code de retrait>", "qr": { "type": "image/png" },')],
];

(async () => {
  const src = { qr: lire(F.qr), rqr: lire(F.rqr), lire: lire(F.lire), explique: lire(F.explique), app: lire(F.app), doc: lire(F.doc) };
  console.log('— audit-qr-capture-mr');
  const r = await verifier(src, true);
  console.log(`\n${r.ok} vert(s), ${r.ko} rouge(s)`);
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    for (const [cible, nom, f] of MUTATIONS) {
      const m = f(src[cible]);
      if (m === src[cible]) { console.log(`  ⚠️ mutation non appliquée : ${nom}`); continue; }
      const x = await verifier({ ...src, [cible]: m }, false);
      console.log(`  ${x.ko ? '🔴' : '⚪'} mutation « ${nom} » : ${x.ko} rouge(s)`);
      if (x.ko) rouges++;
    }
    console.log(`\nmutations rouges : ${rouges}/${MUTATIONS.length}`);
    if (rouges !== MUTATIONS.length) process.exit(1);
  }
  process.exit(r.ko ? 1 : 0);
})();
