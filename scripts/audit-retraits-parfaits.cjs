#!/usr/bin/env node
// AUDIT (19 nov.) — LES CODES DE RETRAIT PARFAITS (docs/passation/2026-11-19-retraits-parfaits.md).
// Julien : « l'app doit être en mesure de reconnaître absolument tous les types de code de retrait » ; « il y a quatre
// colis, j'ai un seul code de retrait » ; « je dois voir dans l'app quand un nouveau QR code ou colis à retirer a été
// détecté ». Il EXÉCUTE les vraies fonctions (jamais une copie), sur des données INVENTÉES (le dépôt est public) :
//   A. Mondial Relay : un code postal REFUSÉ pour un n° n'est plus reproposé ; l'essai borné (le code postal prouvé
//      chez le vendeur) part tout de suite (`codePostalPourMondialRelay`, `suivisAInterroger`) ;
//   B. `parseCarrierEmail` : codes de consigne (« Saisissez le code … sur l'écran »), codes alphanumériques mêlés,
//      codes en groupes, n° UPS et InPost — et ce qui n'est JAMAIS un code ;
//   C. la forme d'un code : la règle (api/_lib/forme-code-retrait.js) et ses copies (App `codeRetrait`,
//      src/retraitQr.js `codeRetraitMr`) rendent la même chose sur un corpus ;
//   D. consigne ≠ comptoir : `sorteRetrait` et `regrouperRelais` (deux points au même magasin) ;
//   E. « nouveau » : `comparerRetraits` (rien la 1re fois, un colis neuf, un QR qui arrive, « vu ») ;
//   F. la veille signale `email_track_*` et `panel_colis_relais` ; l'écran les relit ; les passes disent la sorte.
// `--mutation` : réaffaiblit chaque règle, chacune doit rendre ROUGE. Lancé sur l'arbre d'avant
// (AUDIT_RACINE=<arbre>), il est rouge (§6.1).
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'cp-refuse-repropose': ['api/_lib/transporteurs.js', "const libreDe = (cps) => cps.find((c) => !refuses.has(c));", 'const libreDe = (cps) => cps[0];'],
  'code-consigne-oublie': ['api/email-inbound.js', 'const m = all.match(new RegExp(`(?:${VERBE}|${LIBELLE})', 'const m = null && all.match(new RegExp(`(?:${VERBE}|${LIBELLE})'],
  'code-mele-refuse': ['api/_lib/forme-code-retrait.js', 'return FORME_SIMPLE.test(c) || FORME_MELEE.test(c);', 'return FORME_SIMPLE.test(c);'],
  'code-mele-O-accepte': ['api/_lib/forme-code-retrait.js', 'const FORME_MELEE = /^(?=(?:[A-HJ-NP-Z]*\\d){2})(?=\\d*[A-HJ-NP-Z])[A-HJ-NP-Z0-9]{5,10}$/;', 'const FORME_MELEE = /^(?=(?:[A-Z]*\\d){2})(?=\\d*[A-Z])[A-Z0-9]{5,10}$/;'],
  'groupes-non-joints': ['api/email-inbound.js', "if (m && /^\\d{4,10}$/.test(joint)) code = joint;", 'if (false) code = joint;'],
  'suivi-ups-oublie': ['api/email-inbound.js', "  if (!suivi) { const m = all.match(/\\b(1Z[0-9A-Z]{16})\\b/); if (m) suivi = m[1].toUpperCase(); }\n", ''],
  'consigne-avec-comptoir': ['src/relaisColis.js', "const sorteCle = x.sorte === 'consigne' ? 'consigne~' : '';", "const sorteCle = '';"],
  'sorte-drapeau-ignore': ['src/retraitSorte.js', "if (consigne === true || consigne === 'true') return 'consigne';", ''],
  'nouveau-des-la-1re-fois': ['src/retraitsNouveaux.js', '    if (a) {\n      let raison', '    if (true) {\n      let raison'],
  'qr-neuf-ignore': ['src/retraitsNouveaux.js', "else if (forme.includes('q') && !String(v).includes('q')) raison = 'qr';", ''],
  'veille-sans-colis': ['src/tempsReel.js', "  [/^email_track_[a-z0-9]{1,30}_[A-Za-z0-9_.-]{1,120}$/, 'colis'],\n", ''],
  'ecran-ne-relit-pas': ['src/App.jsx', "if (q.quoi === 'colis') { if (!deja.has('colis')", "if (false) { if (!deja.has('colis')"],
};
if (process.argv.includes('--mutation') || process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-rp-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
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
const lire = (p) => { try { return fs.readFileSync(path.join(R, p), 'utf8'); } catch (_) { return ''; } };

(async () => {
  // ── A. Mondial Relay : le code postal refusé ──────────────────────────────
  // Forme mesurée chez Julien (chiffres seulement) : l'e-mail « disponible » ne donne que le code postal du POINT ;
  // Mondial Relay ne lit le colis qu'avec celui du DESTINATAIRE, prouvé par les autres colis du vendeur.
  await essaie('A. code postal Mondial Relay', async () => {
    const T = await importer('api/_lib/transporteurs.js');
    const NOW = Date.parse('2026-11-19T14:00:00.000Z');
    const ligne = { suivi: '87000001', carrier: 'mondialrelay', status: 'available', lieu: 'LOCKER 24/7 MAGASIN TEST, ZA EXEMPLE, 11111 VILLETEST', receivedAt: '2026-11-18T09:00:00.000Z', emailAt: '2026-11-18T09:00:00.000Z' };
    const refuse = { carrier: 'mondialrelay', suivi: '87000001', essaiRes: 'cp-inconnu', cpRefuse: '11111', cpRefuseSource: 'email', essai: '2026-11-19T13:30:00.000Z', fini: false, essais: 0 };
    const r0 = T.codePostalPourMondialRelay({ suivi: '87000001', transp: null, lignes: [ligne], prouves: ['22222'], maintenant: NOW });
    dit(r0 && r0.cp === '11111' && r0.source === 'email', 'A1 jamais lu : le code postal de l’e-mail d’abord (inchangé)', JSON.stringify(r0));
    const r1 = T.codePostalPourMondialRelay({ suivi: '87000001', transp: refuse, lignes: [ligne], prouves: ['22222'], maintenant: NOW });
    dit(r1 && r1.cp === '22222' && r1.source === 'essai', 'A2 code postal de l’e-mail REFUSÉ pour ce n° ⇒ l’essai borné (le code postal prouvé chez le vendeur)', JSON.stringify(r1));
    const r2 = T.codePostalPourMondialRelay({ suivi: '87000001', transp: refuse, lignes: [ligne], prouves: [], maintenant: NOW });
    dit(r2 === null, 'A3 refusé et aucun autre code postal connu ⇒ rien (jamais inventé)', JSON.stringify(r2));
    const r3 = T.codePostalPourMondialRelay({ suivi: '87000001', transp: { ...refuse, cpJour: T.jourParis(NOW), cpEssayes: '22222' }, lignes: [ligne], prouves: ['22222'], maintenant: NOW });
    dit(!(r3 && r3.cp === '11111' && r3.source === 'email'), 'A4 l’essai du jour déjà tenté : le refusé n’est pas reproposé comme « e-mail »', JSON.stringify(r3));
    const items = T.suivisAInterroger({ lignes: [ligne], transp: new Map([['87000001', refuse]]), prouves: ['22222'], maintenant: NOW });
    const it = items.find((x) => x.suivi === '87000001');
    dit(!!it && it.cp === '22222' && it.cpSource === 'essai', 'A5 le passage suivant interroge CE colis tout de suite, avec le code postal prouvé (avant : le refusé, toutes les 30 min, jamais lu)', JSON.stringify(it || null));
  });

  // ── B. Les e-mails : tous les types de code ───────────────────────────────
  // [nom, transporteur, sujet, texte, code attendu (null = aucun), statut attendu (undefined = non jugé), consigne attendue]
  const CORPUS = [
    ['Mondial Relay Locker : « Saisissez le code 482918 sur l’écran du Locker »', 'mondialrelay', 'Votre colis 38230098 est disponible', 'Votre colis 38230098 est disponible dans un Locker 24/7.\nSaisissez le code 482918 sur l\'écran du Locker.\n', '482918', 'available', true],
    ['consigne : « Code du casier : 5271 »', 'colissimo', 'Votre colis est disponible dans une consigne Pickup Station', 'Votre colis 6A00000000003 vous attend.\nCode du casier : 5271\n', '5271', 'available', true],
    ['« Tapez le code suivant : K7P2Q9 » (mêlé)', 'gls', 'Votre colis GLS est arrivé dans le Parcel Locker', 'Colis 00000000004 disponible.\nTapez le code suivant : K7P2Q9\n', 'K7P2Q9', 'available', true],
    ['Relais Colis : code alphanumérique mêlé « 6A4B2C »', 'relaiscolis', 'Votre colis est disponible dans votre Relais Colis', 'Votre colis n° 4F00000000001 est disponible.\nVotre code de retrait : 6A4B2C\n', '6A4B2C', 'available', false],
    ['code en groupes « 731 204 » en fin de ligne ⇒ 731204', 'chronopost', 'Votre colis XW611500009TS est arrivé en relais Pickup', 'Votre colis XW611500009TS est arrivé.\nCode de retrait : 731 204\n', '731204', 'available', false],
    ['UPS Access Point : n° « 1Z… » lu ⇒ disponible', 'ups', 'Votre colis UPS est disponible dans un UPS Access Point', 'Colis 1Z999AA10123456784 disponible.\nCode de retrait : 864209\n', '864209', 'available', false],
    ['Locker InPost : n° à 24 chiffres lu ⇒ disponible', 'mondialrelay', 'Votre colis est arrivé dans le Locker InPost', 'Votre colis 520000000000000000000001 vous attend dans le Locker InPost.\nCode de retrait : 482913\n', '482913', 'available', true],
    // — ce qui n'est jamais un code —
    ['« 12O456 » (lettre O pour zéro) : aucun code', 'mondialrelay', 'Votre colis 38230008 est disponible', 'Votre code de retrait : 12O456\n', null],
    ['« 1234 56000 » (un groupe de 5 : un code postal collé) : jamais joint en « 123456000 » (le 1er nombre, comme avant)', 'mondialrelay', 'Votre colis 38230017 est disponible', 'Votre code de retrait : 1234 56000\n', '1234'],
    ['« suivant » n’est jamais un code', 'chronopost', 'Votre colis XW611500003TS est arrivé en relais Pickup', 'Communiquez le code de retrait suivant au commerçant :\nsuivant\n', null],
    ['« Saisissez le code » puis l’adresse à la ligne : aucun code', 'mondialrelay', 'Votre colis 38230019 est disponible', 'Saisissez le code\n35000 Rennes\n', null],
    ['un mot sans chiffre après « code de retrait » : aucun code', 'relaiscolis', 'Votre colis est disponible', 'Votre colis n° 4F00000000005 est disponible.\nVotre code de retrait : CONFIDENTIEL\n', null],
  ];
  await essaie('B. corpus (vraie parseCarrierEmail)', async () => {
    const { parseCarrierEmail } = await importer('api/email-inbound.js');
    for (const [nom, carrier, subject, text, attendu, statut, consigne] of CORPUS) {
      const r = parseCarrierEmail({ from: 'noreply@banc.test', subject, text, html: '' }, carrier, '2026-11-19T10:00:00.000Z');
      const ok = (r.code || null) === attendu && (statut === undefined || r.status === statut) && (consigne === undefined || r.consigne === consigne);
      dit(ok, `B ${nom} ⇒ ${attendu || 'aucun code'}${statut ? ' · ' + statut : ''}${consigne !== undefined ? ' · ' + (consigne ? 'consigne' : 'comptoir') : ''}`, `lu « ${r.code || ''} » · ${r.status} · consigne ${r.consigne}`);
    }
  });

  // ── C. La forme d'un code : la règle et ses deux copies ────────────────────
  await essaie('C. forme d’un code', async () => {
    const F = await importer('api/_lib/forme-code-retrait.js');
    const app = lire('src/App.jsx');
    const ligneApp = (app.match(/^const codeRetrait = \(v\) => \{[^\n]*\};$/m) || [])[0];
    dit(!!ligneApp, 'C0 App : `codeRetrait` est une ligne autonome');
    // eslint-disable-next-line no-new-func
    const codeRetrait = ligneApp ? new Function(ligneApp.replace(/^const codeRetrait = /, 'return ') )() : () => '';
    const { codeRetraitMr } = await importer('src/retraitQr.js');
    const CAS = ['123456', 'B12345', 'CA4934', '012345', '6A4B2C', 'K7P2Q9', '12O456', 'I23456', 'SUIVANT', 'AB', '1234', '12', '35260CANCALE', 'XW611500001TS', 'ABCDE1', 'A1B2C', '9539'];
    let accord = true; const ecarts = [];
    for (const c of CAS) { const v = F.codeDeForme(c); if (codeRetrait(c) !== v || codeRetraitMr(c) !== v) { accord = false; ecarts.push(c); } }
    dit(accord, 'C1 la règle, l’app et src/retraitQr.js rendent la même chose sur 17 formes', ecarts.join(', '));
    dit(F.codeDeForme('6A4B2C') === '6A4B2C' && F.codeDeForme('12O456') === '' && F.codeDeForme('SUIVANT') === '' && F.codeDeForme('XW611500001TS') === '', 'C2 un code mêlé est lu ; « 12O456 », un mot, un n° de suivi ne le sont pas');
  });

  // ── D. Consigne ≠ comptoir ────────────────────────────────────────────────
  await essaie('D. consigne ou comptoir', async () => {
    const { sorteRetrait } = await importer('src/retraitSorte.js');
    const { regrouperRelais, pointsARetirer } = await importer('src/relaisColis.js');
    dit(sorteRetrait({ lieu: 'LOCKER 24/7 MAGASIN TEST, ZA EXEMPLE, 11111 VILLETEST' }) === 'consigne', 'D1 « Locker 24/7 … » ⇒ consigne');
    dit(sorteRetrait({ lieu: 'MAGASIN TEST, ZA EXEMPLE, 11111 VILLETEST', consigne: true }) === 'consigne', 'D2 le drapeau de SON e-mail ⇒ consigne (nom sans « locker »)');
    dit(sorteRetrait({ lieu: 'MAGASIN TEST', libelleTransp: 'Le colis est prêt à être retiré en consigne' }) === 'consigne', 'D3 le libellé du transporteur de SON n° ⇒ consigne');
    dit(sorteRetrait({ lieu: 'MAGASIN TEST, ZA EXEMPLE, 11111 VILLETEST', consigne: false }) === 'comptoir', 'D4 rien ne le dit ⇒ comptoir');
    const arr = [
      { id: 'a', nom: 'Magasin Test', rue: 'ZA Exemple', cp: '11111', ville: 'Villetest', sorte: 'comptoir', code: '111111' },
      { id: 'b', nom: 'Magasin Test', rue: 'ZA Exemple', cp: '11111', ville: 'Villetest', sorte: 'comptoir', code: '222222' },
      { id: 'c', nom: 'Magasin Test', rue: 'ZA Exemple', cp: '11111', ville: 'Villetest', sorte: 'consigne', code: '333333' },
    ];
    const g = regrouperRelais({ arrives: arr });
    dit(g.length === 2, 'D5 un casier et le comptoir du MÊME magasin (même nom, même adresse) : deux points', `${g.length} point(s) : ${g.map((p) => p.arrives.length).join(' + ')}`);
    const pc = g.find((p) => p.arrives.some((x) => x.id === 'c'));
    dit(!!pc && pc.consigne === true && pc.arrives.length === 1, 'D6 le point de la consigne le dit (`consigne`), seul avec son colis');
    const pv = pointsARetirer({ colis: arr });
    dit(pv.points.length === 2 && pv.nComptes === 3, 'D7 `pointsARetirer` : 2 points, 3 colis comptés (rien perdu)', `${pv.points.length} · ${pv.nComptes}`);
  });

  // ── E. « Nouveau » ────────────────────────────────────────────────────────
  await essaie('E. nouveau colis / code / QR', async () => {
    const N = await importer('src/retraitsNouveaux.js');
    const l0 = [{ id: 'e:87000001', code: '111111', qr: false, compte: true, lieu: 'Magasin Test', carrier: 'mondialrelay' }];
    const p1 = N.comparerRetraits(null, l0, 1000);
    dit(p1.annonces.length === 0, 'E1 première fois sur cet appareil : rien n’est annoncé (il avait déjà ces colis)');
    const p2 = N.comparerRetraits(p1.etat, [...l0, { id: 'e:87000002', code: '222222', qr: false, compte: true, lieu: 'Magasin Test', carrier: 'mondialrelay' }], 2000);
    dit(p2.annonces.length === 1 && p2.annonces[0].cle === 'E:87000002'.replace(/^E/, 'e') && p2.annonces[0].raison === 'colis', 'E2 un colis neuf ⇒ annoncé une fois', JSON.stringify(p2.annonces));
    const p3 = N.comparerRetraits(p2.etat, [{ ...l0[0], qr: true }, { id: 'e:87000002', code: '222222', qr: false, compte: true }], 3000);
    dit(p3.annonces.length === 1 && p3.annonces[0].raison === 'qr', 'E3 un QR qui arrive sur un colis déjà là ⇒ « nouveau QR »', JSON.stringify(p3.annonces));
    const p4 = N.comparerRetraits(p3.etat, [{ ...l0[0], qr: true }, { id: 'e:87000002', code: '222222', qr: false, compte: true }], 4000);
    dit(p4.annonces.length === 0, 'E4 rien de neuf ⇒ rien annoncé (pas deux fois)');
    dit(N.estNouveau(p4.etat, 'r:e:87000002') && !N.estNouveau(N.marquerVu(p4.etat, 'r:e:87000002'), 'r:e:87000002'), 'E5 la ligne de l’écran (`r:e:…`) est « nouveau » jusqu’à ce qu’il l’ouvre');
    dit(N.cleNouveau('v:123:456') === 'tx:456' && N.cleNouveau('r:v:456') === 'tx:456' && N.cleNouveau('k:abc') === '', 'E6 identité : n° de suivi ou transaction, jamais une clé d’e-mail');
    const trF = (k, p) => ({ 'retraits.nouveau.codeLieu': `Nouveau code de retrait · ${p && p.lieu}` })[k] || k;
    dit(N.texteAnnonce(p2.annonces, { tr: trF, nomTransp: () => 'Mondial Relay' }) === 'Nouveau code de retrait · Mondial Relay Magasin Test', 'E7 le toast dit le transporteur et le point', N.texteAnnonce(p2.annonces, { tr: trF, nomTransp: () => 'Mondial Relay' }));
  });

  // ── F. La veille, l'écran, les passes ─────────────────────────────────────
  await essaie('F. en direct', async () => {
    const V = await importer('src/tempsReel.js');
    const q1 = V.quoiDe('email_track_mondialrelay_87000001'), q2 = V.quoiDe('panel_colis_relais');
    dit(!!q1 && q1.quoi === 'colis' && !!q2 && q2.quoi === 'retrait', 'F1 la veille signale un e-mail de colis rangé et un code lu dans une conversation', JSON.stringify([q1, q2]));
    const app = lire('src/App.jsx');
    dit(/if \(q\.quoi === 'colis'\) \{ if \(!deja\.has\('colis'\)[^\n]*lireSuivis\(\{ force: true \}\)/.test(app), 'F2 l’écran relit les suivis sur ce signal');
    dit(/'suivi', 'transp', 'retrait'\]\.includes\(q\.quoi\)/.test(app), 'F3 …et les codes des conversations (`retrait` ⇒ `relireColisRelais`)');
    dit(/comparerRetraits\(avantN, tous, Date\.now\(\)\)/.test(app) && /toast\(t, 'info'\)/.test(app), 'F4 la liste publiée annonce le nouveau (toast) — la même liste que « à retirer »');
    const pr = lire('src/designV2/PassesRetrait.jsx');
    dit(/data-v2-sorte=\{p\.consigne \? 'consigne' : 'comptoir'\}/.test(pr) && /data-v2-nouveau=""/.test(pr), 'F5 la passe dit consigne / comptoir et marque la ligne « nouveau »');
    dit(/sorte: sorteRetrait\(\{ lieu: t\.lieu/.test(app), 'F6 chaque colis d’e-mail porte sa sorte (src/retraitSorte.js)');
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
