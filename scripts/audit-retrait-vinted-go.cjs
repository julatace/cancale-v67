#!/usr/bin/env node
// AUDIT (14 nov.) — LE COLIS VINTED GO RÉACHEMINÉ : SON QR, SON POINT.
// Julien, sur son iPhone : « Il n'y a pas le QR code qui est présent dans l'application. » Vinted Go avait
// changé le point (« Nouveau relais : il est temps de récupérer ton colis ! », code et QR dans l'e-mail) :
// l'e-mail était rangé « en route · point changé », son QR n'atteignait jamais « À retirer ».
// Ce contrôle EXÉCUTE les vraies règles (aucune lecture de texte du code) :
//   A. `parseCarrierEmail` (api/email-inbound.js) : l'e-mail « Nouveau relais… il est temps de récupérer » est une
//      ARRIVÉE (code, QR décodé) ; « Votre colis a changé de plan » (Mondial Relay) reste EN ROUTE ;
//   B. `relireLigneSuivi` (api/_lib/suivi-colis.js) : une ligne déjà rangée « en route · point changé » avec ce sujet
//      redevient « à retirer », notée « redirigée » ; « changé de plan », inchangée ;
//   C. le QR prouvé (api/_lib/qr-retrait.js) : un QR Vinted Go n'est montré que si son adresse porte le n° ET/OU le
//      code du colis, sans rien de contraire ; jamais fabriqué ; `&amp;` décodé ;
//   D. `qrImage` de l'app (src/App.jsx, extraite par Babel) applique la même règle ;
//   E. `colisRelaisChange` (src/relaisChange.js) : le colis arrivé n'est plus annoncé « change de point » ;
//   F. l'adresse la plus récente PROUVÉE gagne (`lieuCompleteParTransporteur`) ; sans date, rien n'est choisi.
// `--prouve` : réaffaiblit chaque correction, chacune doit rendre ROUGE. §6.1 : lancé sur l'arbre d'avant
// (AUDIT_RACINE=<arbre>), il est rouge. Données INVENTÉES (le dépôt est public) : aucun n°, code ni adresse réels.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'sujet-recuperer-ignore': ['api/_lib/etat-colis-email.js', 'if(SUJET_RECUPERER_AU_NOUVEAU.test(s))return \'available\';', ''],
  'relecture-sans-redirige': ['api/_lib/suivi-colis.js', "if (d.status === 'transit' && d.relaisChange && etat === 'available') {", "if (false) {"],
  'qr-autre-code-montre': ['api/_lib/qr-retrait.js', "  if ((s && s !== id.suivi) || (c && c !== id.code)) return 'contredit';\n", ''],
  'qr-sans-identite-montre': ['api/_lib/qr-retrait.js', "  if (j === 'contredit' || j === 'inconnu') return '';", "  if (j === 'contredit') return '';"],
  'qr-amp-garde': ['api/_lib/qr-retrait.js', ".replace(/&amp;/gi, '&')", ''],
  'deplace-garde-ancien-nom': ['src/relaisColis.js', "? { lieuNom: String(tr.lieuNom || ''), lieuAdresse:", "? { lieuNom: String(tr.lieuNom || '') || base.lieuNom, lieuAdresse:"],
  'app-qr-sans-regle': ['src/App.jsx', "const u = t.qrUrl ? urlQrDuColis(t.qrUrl, t) : '';", "const u = t.qrUrl || '';"],
};
if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-vgo-'));
    for (const x of ['api', 'src', 'vinted-sync-extension', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 200)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── LA FORME RÉELLE, INVENTÉE ───────────────────────────────────────────────
// L'e-mail Vinted Go « Nouveau relais » mesuré (lecture seule, 14 nov.) : le point d'origine « pas disponible »,
// « Ton colis a donc été livré dans un nouveau relais », « À retirer avant le », le point SANS code postal,
// « Scanne ce QR code … ou saisis le code suivant : », le QR hébergé chez p.vintedgo.com (http, `&amp;` non décodé).
const SUIVI = '1ZZTE5TAAAAAA', CODE = '481516', SIG = 'ab12cd34'.repeat(8);
const QR = (s = SUIVI, c = CODE) => `http://p.vintedgo.com/public/v1/qr_codes/${s}:${c}:${SIG}?email_code=VCARRIER_REROUTED_PICKUP&amp;time=2026-11-13T11%3A01%3A34Z`;
const SUJET_VGO = `Nouveau relais : il est temps de récupérer ton colis ! #${SUIVI}`;
const TEXTE_VGO = `Bonjour Camille Exemple ,\n\nLe point Vinted Go que tu avais sélectionné n'est pas disponible pour le \nmoment. Ton colis a donc été livré dans un nouveau relais.\n\nÀ retirer avant le \n*19/11/2026* \nNous le retournerons à l'expéditeur si tu ne le récupères pas à temps. \nAdresse\nNous avons livré ton colis dans un autre relais afin que tu puisses le \nrecevoir à temps. \n*Relais Vinted Go* \n* Épicerie du Marché * \n* 12 Rue de la Fontaine\n\n* \n*Ville-Exemple \n * \nDétails de la commande\n\n*Baskets toile grises15.00 €* \nCode de retrait\n[image: QR code] \nScanne ce QR code pour récupérer ton colis ou saisis le code suivant : \n*${CODE}*\n\nNuméro de suivi : ${SUIVI}\n\nL'équipe Vinted Go`;
const HTML_VGO = `<p>Le point Vinted Go que tu avais sélectionné n&#39;est pas disponible pour le moment. Ton colis a donc été livré dans un nouveau relais.</p><div class="block-header">Code de retrait</div><div class="img-div"><img src="${QR()}" alt="QR code"></div><div class="mobile-left">Scanne ce QR code pour récupérer ton colis ou saisis le code suivant : <b>${CODE}</b></div><p>Numéro de suivi : <a href="https://links.exemple.test/x">${SUIVI}</a></p>`;
const MR_PLAN = 'Votre colis a changé de plan 📍';
const TEXTE_MR = "Bonjour,\nLe Point Relais prévu est temporairement indisponible.\nIl sera finalement livré ici :\n\nPOINT RELAIS®\n\nTABAC EXEMPLE\n\n4 Rue Exemple\n\n35000 Rennes\n";

(async () => {
  let parseCarrierEmail = null, relire = null, qr = null;
  await essaie('A. e-mail (vraie parseCarrierEmail)', async () => {
    ({ parseCarrierEmail } = await importer('api/email-inbound.js'));
    const v = parseCarrierEmail({ from: 'Vinted Go <no-reply@exemple.test>', subject: SUJET_VGO, text: TEXTE_VGO, html: HTML_VGO }, 'vinted', '2026-11-13T11:02:33.000Z');
    dit(v.status === 'available' && !v.relaisChange, 'A « Nouveau relais : il est temps de récupérer ton colis » est une ARRIVÉE (à retirer), pas « en route · point changé »', `${v.status} · relaisChange ${!!v.relaisChange} · ${v.label}`);
    dit(v.code === CODE && v.limite === '2026-11-19', 'A …avec SON code et SA date limite', `${v.code} · ${v.limite}`);
    const m = parseCarrierEmail({ from: 'Mondial Relay <noreply@exemple.test>', subject: MR_PLAN, text: TEXTE_MR, html: '' }, 'mondialrelay', '2026-11-13T09:00:00.000Z');
    dit(m.status === 'transit' && m.relaisChange === true, 'A « Votre colis a changé de plan » (Mondial Relay, il roule encore) reste EN ROUTE (inchangé)', `${m.status} · ${m.relaisChange}`);
    const o = parseCarrierEmail({ from: 'Mondial Relay <noreply@exemple.test>', subject: 'Où vous livrer en cas de point indisponible ?', text: 'Choisissez un point de secours.', html: '' }, 'mondialrelay', '2026-11-13T09:00:00.000Z');
    dit(o.status === 'transit', 'A « Où vous livrer en cas de point indisponible ? » reste en route (inchangé)', o.status);
  });
  await essaie('A. route : le QR rangé est décodé (`&amp;` ⇒ `&`)', async () => {
    const src = fs.readFileSync(path.join(R, 'api/email-inbound.js'), 'utf8');
    // La fonction n'est pas exportée : on exécute SON texte (les deux fonctions et la règle qu'elles appellent).
    const corps = (nom) => { const i = src.indexOf(nom.startsWith('const ') ? nom : `function ${nom}(`); if (i < 0) return ''; let p = src.indexOf('{', i), n = 0, j = p; for (; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}') { n--; if (!n) break; } } return src.slice(i, j + 1); };
    const ctx = {}; vm.createContext(ctx);
    let regle = null; try { regle = await importer('api/_lib/qr-retrait.js'); } catch (_) {}
    ctx.urlQrPropre = regle ? regle.urlQrPropre : undefined;
    const cst = (nom) => { const i = src.indexOf(`const ${nom} = `); if (i < 0) return ''; const j = src.indexOf(';\n', i); return src.slice(i, j + 1); };
    vm.runInContext([cst('URL_QR_CERTAIN'), cst('URL_PAS_UN_QR'), cst('INDICE_QR_FORT'), corps('const imgMinuscule = ') + ';', corps('qrUrlPlausible'), corps('extractPickupQrBrut'), corps('extractPickupQr'), 'this.f = extractPickupQr;'].join('\n'), ctx);
    const r = ctx.f({ subject: SUJET_VGO, text: TEXTE_VGO, html: HTML_VGO, attachments: [] }, 'available');
    dit(!!(r && r.qrUrl) && !/&amp;/.test(r.qrUrl) && /&time=/.test(r.qrUrl), 'A le QR Vinted Go de l’e-mail est rangé, son adresse décodée (`&time=`, plus `&amp;time=`)', r && r.qrUrl);
  });
  await essaie('B. relecture d’une ligne déjà rangée (relireLigneSuivi)', async () => {
    ({ relireLigneSuivi: relire } = await importer('api/_lib/suivi-colis.js'));
    const rangee = { type: 'suivi', carrier: 'vinted', suivi: SUIVI, status: 'transit', statusLabel: 'Point relais changé', relaisChange: true, subject: SUJET_VGO, code: CODE, qrUrl: QR(), lieu: null, limite: '2026-11-19', emailAt: '2026-11-13T11:01:34.000Z', receivedAt: '2026-11-13T11:02:33.736Z' };
    const a = relire(rangee);
    dit(a.status === 'available' && !a.relaisChange && a.redirige === true, 'B la ligne rangée « en route · point changé » (forme mesurée) redevient À RETIRER, notée « redirigée »', `${a.status} · ${a.statusLabel}`);
    const c = relire({ ...rangee, subject: MR_PLAN });
    dit(c.status === 'transit' && c.relaisChange === true, 'B « changé de plan » rangé en route : inchangé', `${c.status} · ${c.relaisChange}`);
  });
  await essaie('C. le QR prouvé (api/_lib/qr-retrait.js)', async () => {
    qr = await importer('api/_lib/qr-retrait.js');
    const ligne = { suivi: SUIVI, code: CODE };
    dit(qr.jugerQrDuColis(QR(), ligne) === 'prouve' && qr.urlQrDuColis(QR(), ligne) === QR().replace('&amp;', '&'), 'C un QR Vinted Go au n° ET au code du colis : montré, adresse décodée');
    dit(qr.urlQrDuColis(QR(SUIVI, '999999'), ligne) === '', 'C un QR Vinted Go d’un AUTRE code (le point d’avant, un autre colis) : jamais montré');
    dit(qr.urlQrDuColis(QR('1ZZTE5TBBBBBB', CODE), ligne) === '', 'C un QR Vinted Go d’un AUTRE n° : jamais montré');
    dit(qr.urlQrDuColis(QR(), { suivi: '', code: '' }) === '', 'C un QR Vinted Go qu’aucune identité du colis ne relie : jamais montré');
    dit(qr.urlQrDuColis(QR(), { suivi: SUIVI }) !== '' && qr.urlQrDuColis(QR(), { code: CODE }) !== '', 'C le n° seul OU le code seul suffit quand rien ne contredit');
    dit(qr.urlQrDuColis('http://p.vintedgo.com/public/v1/qr_codes/abc', ligne) === '', 'C une adresse Vinted Go sans la forme {n°}:{code}:{signature} : jamais montrée');
    const pickup = 'https://www.pickup-services.example/api/barcode/AztecCode?d=PICKUPPASS:123&amp;s=2';
    dit(qr.jugerQrDuColis(pickup, ligne) === 'autre' && qr.urlQrDuColis(pickup, ligne) === pickup.replace('&amp;', '&'), 'C un Pickup Pass (autre transporteur) : la règle d’avant, adresse décodée');
    dit(qr.urlQrDuColis('', ligne) === '', 'C aucune adresse ⇒ rien (jamais un QR fabriqué depuis le code)');
  });
  await essaie('D. l’app : qrImage (src/App.jsx, Babel)', async () => {
    const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
    const src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
    const noms = ['URL_PAS_UN_QR', 'URL_QR_CERTAIN', 'qrEnHttps', 'qrImage'];
    const t = {};
    for (const n of ast.program.body) if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) t[d.id.name] = 'const ' + src.slice(d.start, d.end) + ';';
    const ctx = {}; let regle = null; try { regle = await importer('api/_lib/qr-retrait.js'); } catch (_) {}
    if (regle) ctx.urlQrDuColis = regle.urlQrDuColis;
    vm.createContext(ctx);
    for (const nom of noms) vm.runInContext(t[nom] + `\nthis.${nom}=${nom};`, ctx);
    const bon = ctx.qrImage({ suivi: SUIVI, code: CODE, qrUrl: QR() });
    dit(bon === QR().replace('http://', 'https://').replace('&amp;', '&'), 'D le QR du colis : en https, adresse décodée', bon);
    dit(ctx.qrImage({ suivi: SUIVI, code: CODE, qrUrl: QR(SUIVI, '999999') }) == null, 'D le QR d’un AUTRE code n’est jamais montré à côté de ce colis');
    dit(ctx.qrImage({ suivi: SUIVI, code: CODE }) == null, 'D sans QR lu : aucune image (jamais fabriquée)');
  });
  await essaie('E. « change de point relais » (src/relaisChange.js)', async () => {
    const { colisRelaisChange } = await importer('src/relaisChange.js');
    const rangee = { type: 'suivi', carrier: 'vinted', suivi: SUIVI, status: 'transit', statusLabel: 'Point relais changé', relaisChange: true, subject: SUJET_VGO, code: CODE, qrUrl: QR(), lieu: null, emailAt: '2026-11-13T11:01:34.000Z' };
    // Le transporteur l'a dit disponible 18 s AVANT l'e-mail (mesuré) : seule la relecture de la ligne le sort.
    const transp = new Map([[SUIVI, { etat: 'disponible', etatAt: '2026-11-13T11:01:16.017Z' }]]);
    const l = colisRelaisChange([relire ? relire(rangee) : rangee], { maintenant: Date.parse('2026-11-14T09:00:00Z'), transp });
    dit(Array.isArray(l) && l.length === 0, 'E le colis arrivé au nouveau point n’est plus annoncé « change de point relais · en route »', JSON.stringify(l));
  });
  await essaie('F. l’adresse la plus récente PROUVÉE gagne (lieuCompleteParTransporteur)', async () => {
    const { lieuCompleteParTransporteur } = await importer('src/relaisColis.js');
    const ancien = { lieuNom: 'Tabac du Port', lieuAdresse: '1 Rue du Port, 35260 Ville-Avant' };
    const tr = { etat: 'disponible', carrier: 'vinted', lieuRue: '12 Rue de la Fontaine', lieuCp: '', lieuVille: 'Ville-Exemple', etatAt: '2026-11-13T11:01:16.000Z' };
    const apres = lieuCompleteParTransporteur(ancien, tr, Date.parse('2026-11-12T08:00:00Z'));
    dit(/Ville-Exemple/.test(apres.lieuAdresse) && !/Ville-Avant/.test(apres.lieuAdresse) && apres.lieuDeplace && /Tabac du Port/.test(apres.lieuDeplace.avant), 'F modifiée APRÈS l’arrivée lue : la nouvelle adresse partout, l’ancienne seulement dite « avant »', JSON.stringify(apres));
    dit(!/Tabac du Port/.test(apres.lieuNom || ''), 'F …et le NOM de l’ancien point ne reste pas au-dessus de la nouvelle adresse', apres.lieuNom);
    const sansDate = lieuCompleteParTransporteur(ancien, tr, null);
    dit(!!sansDate.lieuConflit && /Ville-Avant/.test(sansDate.lieuAdresse), 'F message sans date : rien n’est écrasé ni deviné, le désaccord est dit', JSON.stringify(sansDate.lieuConflit));
    const plusVieux = lieuCompleteParTransporteur(ancien, { ...tr, etatAt: '2026-11-11T08:00:00Z' }, Date.parse('2026-11-12T08:00:00Z'));
    dit(!!plusVieux.lieuConflit, 'F une lecture du transporteur PLUS ANCIENNE que le message ne remplace rien', JSON.stringify(plusVieux.lieuConflit));
  });
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ le colis Vinted Go réacheminé : son QR prouvé, son nouveau point — tout est vert');
  process.exit(ko ? 1 : 0);
})();
