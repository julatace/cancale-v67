#!/usr/bin/env node
// AUDIT (11 nov.) — RETRAITS FIABLES (docs/passation/2026-11-11-retraits-fiables.md)
// Julien : « Là tu me regroupes tout à Super U. Ceux qui ont changé de point relais, tu les mets dans un autre,
// mais tu ne donnes pas les codes. […] Personnalisable, peu importe la personne, tout doit marcher. »
// Il EXÉCUTE les vraies règles, jamais une copie :
//   A. la VRAIE route api/email-inbound.js (fausse base à état, scripts/_faux-inbound.cjs) sur un corpus
//      d'e-mails INVENTÉS de chaque réseau français (Mondial Relay / InPost, Relais Colis, Chronopost Pickup /
//      Chrono Relais / Shop2Shop, Colissimo, La Poste, Vinted Go, DPD, UPS, GLS), vendeurs de Lille à Cayenne :
//      chaque e-mail d'arrivée ⇒ UNE ligne, SON code, SON point — jamais la première suggestion d'une liste
//      « Points de proximité » (LA cause du « tout à Super U ») ;
//   B. une relance du même n° met à jour la ligne (jamais un 2e colis) ; deux e-mails sans n° au même sujet ⇒
//      deux colis ; l'e-mail d'une adresse d'un AUTRE vendeur n'est jamais rangé chez lui ;
//   C. un point = son ADRESSE (src/relaisColis.js) : même enseigne, deux rues ⇒ deux cartes ; un nom seul ne
//      rejoint jamais un autre point ; le type de lieu n'est pas un nom ;
//   D. point relais changé : le code de CE colis (e-mail du changement, sinon un autre e-mail du même n°) ;
//   E. un colis non revu depuis 48 h n'est plus présenté comme sûr ;
//   F. une ligne déjà rangée sur une suggestion est relue (src/lieuxRetrait.js) ;
//   G. le branchement (App, carte d'un point).
// `--prouve` : réaffaiblit chaque règle, chacune doit rendre ROUGE. Aucune donnée réelle.
require(require('path').join(__dirname, '_horloge-notif.cjs'));
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'suggestions-lues': ['api/_lib/retrait-colis.js', '  const txt = sansSuggestions(txt0);', '  const txt = txt0;'],
  'annonce-ignoree': ['api/_lib/retrait-colis.js', '    if (!ANNONCE_POINT.test(', '    if (true || !ANNONCE_POINT.test('],
  'lieu-generique': ['api/email-inbound.js', 'if (lieuGenerique(l)) continue;', ''],
  'sujet-d-abord': ['api/email-inbound.js', '  if (!lieu) for (const src of [txt, all]) {', '  if (!lieu) for (const src of [all, txt]) {'],
  'colissimo-sans-n': ['api/email-inbound.js', "|[A-Z]{2}\\d{9}[A-Z]{2})\\b/); if (m) suivi = m[1]; }", "|[A-Z]{2}\\d{9}[A-Z]{2})\\b/); if (m && false) suivi = m[1]; }"],
  'sans-suivi-ecrase': ['api/email-inbound.js', 'shortHash(track.sansSuivi && track.code ? `${subject}|${track.code}` : subject)', 'shortHash(subject)'],
  'rue-hors-cle': ['src/relaisColis.js', "normNomRelais(nom) + '|' + cp + '|' + rueCle", "normNomRelais(nom) + '|' + cp + '|' + ''"],
  'nom-seul-fondu': ['src/relaisColis.js', '    const nomSeul = !!nom && !cp && !rueCle && !villeLue;', '    const nomSeul = false;'],
  'code-change-absent': ['src/relaisChange.js', "    const code = codeOk(t.code) ? String(t.code).trim() : (avecCode[0] ? String(avecCode[0].code).trim() : '');", "    const code = codeOk(t.code) ? String(t.code).trim() : '';"],
  'jamais-ancien': ['src/sourcesRetrait.js', 'maintenant - ms > CONFIRMATION_MAX_MS', 'false'],
  'relecture-suggestion': ['src/lieuxRetrait.js', "return { ...t, lieu: l, lieuLuDansTexte: true, lieuSuggestionEcarte", "return t; ({ ...t, lieu: l, lieuLuDansTexte: true, lieuSuggestionEcarte"],
  'deplace-ignore': ['src/relaisColis.js', "  const plusRecent = tr.etat === 'disponible'", "  const plusRecent = false && tr.etat === 'disponible'"],
  'verifie-sans-qui': ['src/sourcesRetrait.js', "  if (par && parQui(par)) return", "  if (false) return"],
  'registre-revient': ['src/App.jsx', '    const completer = (lu) => lu;', '    const completer = (lu) => completerParPointConnu(lu, new Map());'],
};
if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-retraits-fiables-'));
    for (const x of ['api', 'src', 'scripts', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [path.join(t, 'scripts', path.basename(__filename))], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
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

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.stack || e).slice(0, 300)); } };
const importer = (p) => import('file://' + path.join(R, p));
const J = (o) => JSON.stringify(o);

// ── Le corpus : formes françaises INVENTÉES (n°, codes, adresses, enseignes fictives « Exemple ») ──
const CORPUS = [
  { nom: 'MR comptoir Lille', from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis 41000001 est disponible', text: "Bonjour,\nVotre colis 41000001 est disponible.\n\nPOINT RELAIS®\n\nTABAC DU BEFFROI\n\n12 Rue Exemple\n\n59000 Lille\n\nRETRAIT JUSQU'AU 18/11\n\nVotre code de retrait : 410001\n" },
  { nom: 'MR locker Super U Brest', from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis 41000002 est disponible', text: "Bonjour,\nVotre colis 41000002 est disponible.\n\nLOCKER\n\nLOCKER 24/7 SUPER U\n\nRue de l'Exemple\n\n29200 Brest\n\nRETRAIT JUSQU'AU 18/11\n\nVotre code de retrait : 410002\n" },
  { nom: 'MR changé de plan avec code', from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis a changé de plan 📍', text: "Bonjour,\nVotre colis a changé de plan !\nVotre colis n° 41000003 sera livré dans le Point Relais® suivant :\n\nVotre nouveau Point Relais®\nPRESSE DU PORT\n3 Quai Exemple\n13002 Marseille\n\nVotre code de retrait : 410003\n" },
  { nom: 'InPost locker', from: 'InPost <noreply@inpost.fr>', subject: 'Votre colis vous attend dans le Locker InPost', text: "Bonjour,\nVotre colis n° 41000004 vous attend.\n\nLocker InPost\nCARREFOUR EXEMPLE\n5 Avenue Exemple\n67000 Strasbourg\n\nCode de retrait : 410004\nÀ retirer avant le 17/11\n" },
  { nom: 'Relais Colis', from: 'Relais Colis <ne-pas-repondre@relaiscolis.com>', subject: 'Votre colis est disponible dans votre Relais Colis', text: "Bonjour,\nVotre colis n° 4100000500000 est disponible dans votre Relais Colis®.\n\nRelais : TABAC LE NARVAL, 8 Place Exemple, 20000 Ajaccio\n\nCode de retrait : 410005\nVous avez jusqu'au 20/11 pour le retirer.\n" },
  { nom: 'Chronopost Pickup', from: 'Chronopost <noreply@chronopost.fr>', subject: 'Votre colis est arrivé en relais Pickup', text: "Votre colis XW410000006TS est arrivé en relais Pickup.\nCommuniquez le code de retrait suivant au commerçant : 410006\n\nRELAIS PICKUP\nEPICERIE EXEMPLE\n2 Rue Exemple\n97400 Saint-Denis\n\nÀ retirer avant le 16/11/2026\n" },
  { nom: 'Colissimo point retrait', from: 'Colissimo <noreply@notif-colissimo-laposte.info>', subject: 'Votre colis est disponible dans votre point de retrait', text: "Bonjour,\nVotre colis 6A41000000701 est disponible.\n\nPoint de retrait\nBUREAU DE POSTE BREST CENTRE\n4 Rue Exemple\n29200 Brest\n\nCode de retrait : 4107\nÀ retirer jusqu'au 25/11\n" },
  { nom: 'La Poste bureau', from: 'La Poste <noreply@laposte.fr>', subject: 'Votre colis vous attend en bureau de poste', text: "Votre colis n° 6A41000000801 vous attend.\nAdresse du point : BUREAU DE POSTE EXEMPLE, 1 Place Exemple, 97200 Fort-de-France\nCode de retrait : 4108\n" },
  { nom: 'Vinted Go', from: 'Vinted <noreply@vinted.com>', subject: 'Ton colis est arrivé à la consigne Vinted Go #1790000004100009', text: "Ton colis t'attend à la consigne Vinted Go.\nSaisis le code suivant : V41009\n\nAdresse\nConsigne Vinted Go, Laverie Exemple, 9 Rue Exemple\nLille, France\nRécupère ton colis avant le 17/11/2026\n" },
  { nom: 'DPD Pickup', from: 'DPD France <noreply@dpd.fr>', subject: 'Votre colis DPD est disponible en Relais Pickup', text: "Bonjour,\nVotre colis n° 25000041000010 est disponible dans votre Relais Pickup.\n\nRELAIS PICKUP\nTABAC EXEMPLE\n10 Rue Exemple\n69001 Lyon\n\nCode de retrait : 410010\nVotre colis sera conservé jusqu'au 19/11\n" },
  { nom: 'UPS Access Point', from: 'UPS <mcinfo@ups.com>', subject: 'Votre colis UPS est disponible dans un UPS Access Point', text: "Numéro de suivi : 1Z41000011EXEMPLE\nVotre colis est disponible au point UPS Access Point™ :\nUPS Access Point\nLIBRAIRIE EXEMPLE\n11 Rue Exemple\n31000 Toulouse\nCode de retrait : 410011\nÀ retirer avant le 21/11\n" },
  { nom: 'GLS ParcelShop', from: 'GLS <noreply@gls-france.com>', subject: 'Votre colis GLS vous attend dans un GLS ParcelShop', text: "Votre colis n° 41000012 vous attend.\nPoint relais\nPRESSING EXEMPLE\n12 Rue Exemple\n44000 Nantes\nCode de retrait : 410012\n" },
  { nom: 'Shop2Shop', from: 'Shop2Shop <noreply@chronopost.fr>', subject: 'Votre colis Shop2Shop est disponible', text: "Votre colis XW410000013TS est disponible dans votre relais Shop2Shop.\nCommuniquez le code de retrait suivant au commerçant : 410013\nRELAIS PICKUP\nFLEURISTE EXEMPLE\n13 Rue Exemple\n97300 Cayenne\n" },
  { nom: 'MR sans n° de suivi', from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis est disponible', text: "Bonjour,\nVotre colis est disponible.\n\nPOINT RELAIS®\nTABAC SANS NUMERO\n1 Rue Exemple\n59000 Lille\n\nVotre code de retrait : 410014\n" },
];
CORPUS.push(
  { nom: 'Chrono suggestions puis vrai point', from: 'Chronopost <noreply@chronopost.fr>', subject: 'Votre colis XW410000020TS est disponible en Chrono Relais', text: "Votre colis XW410000020TS est disponible.\n\nPoints de proximité\nSUPER U ACCUEIL\n1 Rue Exemple\n35000 Villeexemple\nTABAC EXEMPLE DEUX\n2 Rue Exemple\n35000 Villeexemple\n\nVotre point de retrait\nChrono Relais – BAR TABAC EXEMPLE\n7 Rue Exemple\n64000 Pau\n\nCommuniquez le code de retrait suivant au commerçant : 410020\n" },
  { nom: 'Chrono vrai point puis suggestions', from: 'Chronopost <noreply@chronopost.fr>', subject: 'Votre colis XW410000021TS est disponible en Chrono Relais', text: "Votre colis XW410000021TS est disponible dans votre Chrono Relais :\nBAR TABAC EXEMPLE\n7 Rue Exemple\n64000 Pau\n\nCommuniquez le code de retrait suivant au commerçant : 410021\n\nAutres points près de chez vous\nPoint relais\nSUPER U ACCUEIL\n1 Rue Exemple\n35000 Villeexemple\n" },
  { nom: 'MR suggestions Point Relais en premier', from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis 41000022 est disponible', text: "Pour vos prochains envois, déposez vos colis près de chez vous :\nPoint Relais\nSUPER U ACCUEIL\n1 Rue Exemple\n35000 Villeexemple\n\nVotre colis 41000022 est disponible au Point Relais suivant :\nPOINT RELAIS®\nTABAC EXEMPLE TROIS\n3 Rue Exemple\n06000 Nice\n\nVotre code de retrait : 410022\n" },
  { nom: 'Vinted suggestions', from: 'Vinted <noreply@vinted.com>', subject: 'Ton colis est disponible au point relais', text: "Ton colis n° 41000023 est arrivé.\nPoint relais : TABAC EXEMPLE QUATRE, 4 Rue Exemple, 20200 Bastia\nCode de retrait : 410023\n\nPoints relais à proximité :\nSUPER U ACCUEIL, 1 Rue Exemple, 35000 Villeexemple\n" }
);

CORPUS.push(
  { nom: 'MR suggestions sous un en-tête, vrai point sous un autre', from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis 41000024 est disponible', text: "Déposez vos colis près de chez vous\nPoint Relais\nSUPER U ACCUEIL\n1 Rue Exemple\n35000 Villeexemple\n\nVotre colis 41000024 est disponible.\nPOINT RELAIS®\nTABAC EXEMPLE NEUF\n9 Rue Exemple\n59800 Lille\n\nVotre code de retrait : 410024\n" },
  { nom: 'Sujet « à retirer dans les 10 jours », point dans le corps', from: 'Relais Colis <ne-pas-repondre@relaiscolis.com>', subject: 'Votre colis est à retirer dans les 10 jours', text: "Votre colis n° 4100002500000 est disponible chez TABAC EXEMPLE SEPT, 7 Rue Exemple, 33000 Bordeaux\nCode de retrait : 410025\n" },
  { nom: 'DPD : « dans votre Relais Pickup » avant le vrai point', from: 'DPD France <noreply@dpd.fr>', subject: 'Votre colis DPD', text: "Votre colis n° 25000041000026 est disponible dans votre Relais Pickup.\nIl vous attend chez TABAC EXEMPLE HUIT, 8 Rue Exemple, 21000 Dijon.\nCode de retrait : 410026\n" }
);
const ATTENDU = {"MR suggestions sous un en-tête, vrai point sous un autre": ["59800", "410024", "available"], "Sujet « à retirer dans les 10 jours », point dans le corps": ["33000", "410025", "available"], "DPD : « dans votre Relais Pickup » avant le vrai point": ["21000", "410026", "available"], "MR comptoir Lille": ["59000", "410001", "available"], "MR locker Super U Brest": ["29200", "410002", "available"], "MR changé de plan avec code": ["13002", "410003", "transit"], "InPost locker": ["67000", "410004", "available"], "Relais Colis": ["20000", "410005", "available"], "Chronopost Pickup": ["97400", "410006", "available"], "Colissimo point retrait": ["29200", "4107", "available"], "La Poste bureau": ["97200", "4108", "available"], "Vinted Go": ["Lille", "V41009", "available"], "DPD Pickup": ["69001", "410010", "available"], "UPS Access Point": ["31000", "410011", "available"], "GLS ParcelShop": ["44000", "410012", "available"], "Shop2Shop": ["97300", "410013", "available"], "MR sans n° de suivi": ["59000", "410014", "info"], "Chrono suggestions puis vrai point": ["64000", "410020", "available"], "Chrono vrai point puis suggestions": ["64000", "410021", "available"], "MR suggestions Point Relais en premier": ["06000", "410022", "available"], "Vinted suggestions": ["20200", "410023", "available"]};

(async () => {
  const { fauxInbound, A } = require(path.join(R, 'scripts', '_faux-inbound.cjs'));
  const f = fauxInbound(R);
  const lignesTrack = () => f.ids(/^email_track_/).filter((l) => l.owner === A).map((l) => ({ id: l.id, ...l.data }));

  console.log('§A chaque e-mail d’arrivée ⇒ SON colis, SON code, SON point (vraie route)');
  await essaie('A', async () => {
    for (const c of CORPUS) {
      f.vider();
      const r = await f.recoit({ from: c.from, subject: c.subject, text: c.text, sourceDate: '2026-11-10T09:00:00.000Z' });
      const ls = lignesTrack();
      const [lieuAttendu, code, statut] = ATTENDU[c.nom];
      const l = ls[0] || {};
      dit(r.code === 200 && ls.length === 1, `${c.nom} : rangé (une ligne)`, `${r.code} · ${ls.length}`);
      dit(l.status === statut && l.code === code, `${c.nom} : ${statut === 'info' ? '« à vérifier » (sans n°) avec' : statut === 'transit' ? 'en route vers le nouveau point, avec' : 'à retirer, avec'} son code ${code}`, `${l.status} · ${l.code}`);
      dit(new RegExp(lieuAttendu).test(String(l.lieu || '')) && !/SUPER U ACCUEIL/.test(String(l.lieu || '')), `${c.nom} : son point (${lieuAttendu}), jamais une suggestion`, String(l.lieu));
      if (statut === 'info') dit(l.sansSuivi === true, `${c.nom} : marqué « sans n° » (montré « à vérifier », jamais perdu)`, J(l));
    }
  });

  console.log('§B relances, doublons, autre vendeur');
  await essaie('B', async () => {
    f.vider();
    const mr = (sujet, corps, d) => f.recoit({ from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: sujet, text: corps, sourceDate: d });
    await mr('Votre colis 41000030 est disponible', "Votre colis 41000030 est disponible.\nPOINT RELAIS®\nTABAC EXEMPLE CINQ\n5 Rue Exemple\n67000 Strasbourg\nRETRAIT JUSQU'AU 15/11\nVotre code de retrait : 410030\n", '2026-11-10T09:00:00.000Z');
    await mr('Pensez à retirer votre colis 41000030', "Votre colis 41000030 vous attend toujours.\nRETRAIT JUSQU'AU 16/11\nVotre code de retrait : 410030\n", '2026-11-13T09:00:00.000Z');
    let ls = lignesTrack();
    dit(ls.length === 1, 'une relance du même n° ne crée JAMAIS un 2e colis', J(ls.map((x) => x.id)));
    dit(ls[0] && ls[0].limite === '2026-11-16' && ls[0].code === '410030' && /67000/.test(ls[0].lieu || ''), 'la relance met à jour la date limite ; code et point restent', J(ls[0] && { l: ls[0].limite, c: ls[0].code, p: ls[0].lieu }));
    await mr('Votre colis 41000030 a été retiré', 'Votre colis 41000030 a été retiré le 13/11.\n', '2026-11-13T15:00:00.000Z');
    await mr('Votre colis 41000030 est disponible', "Votre colis 41000030 est disponible.\nVotre code de retrait : 410030\n", '2026-11-10T09:00:00.000Z');
    ls = lignesTrack();
    dit(ls[0] && ls[0].status === 'delivered', 'retiré, puis un e-mail plus ancien traité en retard : reste retiré', ls[0] && ls[0].status);
    f.vider();
    const sans = (code) => f.recoit({ from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis est disponible', text: `Votre colis est disponible.\nPOINT RELAIS®\nTABAC EXEMPLE SIX\n6 Rue Exemple\n59000 Lille\nVotre code de retrait : ${code}\n`, sourceDate: '2026-11-10T09:00:00.000Z' });
    await sans('410031'); await sans('410032'); await sans('410031');
    ls = lignesTrack();
    dit(ls.length === 2 && ls.every((x) => x.sansSuivi), 'deux e-mails sans n° au même sujet ⇒ DEUX colis (avant : le second effaçait le premier) ; le rappel du même code retombe sur sa ligne', J(ls.map((x) => x.code)));
    f.vider();
    await f.recoit({ to: 'quelquun-d-autre@banc.test', from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis 41000033 est disponible', text: 'Votre colis 41000033 est disponible.\nVotre code de retrait : 410033\n', sourceDate: '2026-11-10T09:00:00.000Z' });
    dit(!lignesTrack().length, 'l’e-mail reçu sur l’adresse d’un AUTRE vendeur n’est jamais rangé chez lui (l’adresse de réception décide)', J(f.ids(/^email_track_/).map((l) => l.owner + ':' + l.id)));
  });

  console.log('§C un point = son adresse (src/relaisColis.js)');
  await essaie('C', async () => {
    const M = await importer('src/relaisColis.js');
    const g = M.regrouperRelais({ arrives: [
      { id: 'a', nom: 'Super U', adresse: '12 Rue Exemple, 59000 Lille' }, { id: 'b', nom: 'Super U', adresse: '40 Avenue Exemple, 59000 Lille' },
      { id: 'c', nom: 'SUPER U', adresse: '12 rue exemple, 59000 LILLE' }, { id: 'd', nom: 'Super U', adresse: '' }, { id: 'e', nom: 'Super U', adresse: '' },
      { id: 'f', nom: 'Super U', adresse: '3 Rue Exemple, 13001 Marseille' }, { id: 'g', nom: 'Tabac Exemple', adresse: '1 Rue Exemple, 20000 Ajaccio' },
      { id: 'h', nom: 'Tabac Exemple', adresse: '1 Rue Exemple, 97400 Saint-Denis' }, { id: 'i', nom: 'votre Relais Pickup', adresse: '' }, { id: 'j', nom: 'un UPS Access Point', adresse: '' },
      { id: 'k', nom: 'Super U', adresse: '59000 Lille' },
    ] });
    const ou = {}; for (const p of g) for (const c of p.arrives) ou[c.id] = p;
    dit(ou.a && ou.a === ou.c && ou.a !== ou.b, 'deux Super U de la même ville, deux rues ⇒ deux cartes ; la même adresse écrite autrement ⇒ la même', J(g.map((p) => [p.cle, p.arrives.map((c) => c.id)])));
    dit(ou.d && ou.e && ou.d !== ou.e && ou.d.adressePasLue && ou.d !== ou.a && ou.d !== ou.f, 'un « Super U » sans adresse reste SEUL (« adresse pas lue »), jamais rangé avec un autre', J([ou.d && ou.d.cle, ou.e && ou.e.cle]));
    dit(ou.f !== ou.a && ou.g !== ou.h, 'même enseigne à Lille et à Marseille, en Corse et à La Réunion ⇒ points distincts');
    dit(ou.i && ou.i.inconnu && ou.j && ou.j.inconnu, '« votre Relais Pickup », « un UPS Access Point » : le type de lieu n’est pas un point (« point pas su »)', J([ou.i && ou.i.cle, ou.j && ou.j.cle]));
    dit(ou.k && ou.k !== ou.a && ou.k !== ou.b, 'un Super U au code postal seul, quand deux Super U y sont : aucun n’est choisi', ou.k && ou.k.cle);
    const R2 = await importer('api/_lib/retrait-colis.js');
    dit(R2.lieuGenerique('votre Relais Pickup') && R2.lieuGenerique('un UPS Access Point™') && !R2.lieuGenerique('Super U') && !R2.lieuGenerique('Tabac du Port'), 'la règle serveur des lieux génériques (`lieuGenerique`)');
  });

  console.log('§D point relais changé : le code de CE colis (src/relaisChange.js)');
  await essaie('D', async () => {
    const M = await importer('src/relaisChange.js');
    const maintenant = Date.parse('2026-11-11T12:00:00.000Z');
    const plan = (o) => ({ suivi: '41000040', carrier: 'mondialrelay', status: 'transit', relaisChange: true, lieu: 'PRESSE EXEMPLE, 3 Quai Exemple, 13002 Marseille', ancienLieu: 'TABAC ANCIEN, 1 Rue Exemple, 13001 Marseille', emailAt: '2026-11-10T10:00:00.000Z', ...o });
    const l1 = M.colisRelaisChange([plan({ code: '410040' })], { maintenant });
    dit(l1[0] && l1[0].code === '410040' && l1[0].codeDe === 'changement', 'le code de l’e-mail du changement', J(l1));
    const autre = { suivi: '41000040', carrier: 'mondialrelay', status: 'info', code: '410041', emailAt: '2026-11-10T11:00:00.000Z' };
    const l2 = M.colisRelaisChange([plan({ code: null }), autre], { maintenant });
    dit(l2[0] && l2[0].code === '410041' && l2[0].codeDe === 'autre-email', 'sans code dans l’e-mail du changement : le code d’un autre e-mail du MÊME n°', J(l2));
    const l3 = M.colisRelaisChange([plan({ code: null }), { ...autre, suivi: '41000099' }], { maintenant });
    dit(l3[0] && l3[0].code === '', 'aucun e-mail du même n° n’a de code ⇒ « code pas encore reçu » (jamais le code d’un autre colis)', J(l3));
  });

  console.log('§E un colis non revu depuis 48 h n’est plus présenté comme sûr (src/sourcesRetrait.js)');
  await essaie('E', async () => {
    const S = await importer('src/sourcesRetrait.js');
    const now = Date.parse('2026-11-11T12:00:00.000Z');
    dit(S.verifieAncien(now - 49 * 3600e3, now) && !S.verifieAncien(now - 47 * 3600e3, now) && !S.verifieAncien(null, now), '> 48 h ⇒ « pas confirmé » ; < 48 h ⇒ vérifié ; aucune date ⇒ rien (pas su)');
    const sc = S.sourcesDuColis({ t: { suivi: '41000060', carrier: 'chronopost', receivedAt: '2026-11-11T09:12:00.000Z' }, tr: { carrier: 'chronopost', lu: '2026-11-11T13:05:00.000Z', etat: 'disponible' } });
    dit(sc.verifiePar === 'chronopost' && S.texteVerifie(sc.verifieMs, now, sc.verifiePar) === 'vérifié par Chronopost à 14:05', 'la dernière vérification dit QUI : « vérifié par Chronopost à 14:05 »', J(sc));
    const se = S.sourcesDuColis({ t: { suivi: '41000061', carrier: 'mondialrelay', receivedAt: '2026-11-11T08:12:00.000Z' } });
    dit(se.verifiePar === 'email' && S.texteVerifie(se.verifieMs, now, se.verifiePar) === 'vérifié par e-mail à 09:12', '« vérifié par e-mail à 09:12 » quand seul l’e-mail l’a vu', J(se));
    dit(/^pas confirmé depuis le \d+ nov\.$/.test(S.texteNonConfirme(Date.parse('2026-11-08T12:00:00.000Z'))), '« pas confirmé depuis le 8 nov. »', S.texteNonConfirme(Date.parse('2026-11-08T12:00:00.000Z')));
  });

  console.log('§F une ligne déjà rangée sur une suggestion est relue (src/lieuxRetrait.js)');
  await essaie('F', async () => {
    const L = await importer('src/lieuxRetrait.js');
    const texte = "Votre colis 41000050 est disponible.\n\nPoints de proximité\nPoint relais\nSUPER U ACCUEIL\n1 Rue Exemple\n35000 Villeexemple\n\nVotre point de retrait\nBAR EXEMPLE\n7 Rue Exemple\n64000 Pau\n";
    const ligne = { suivi: '41000050', status: 'available', lieu: 'SUPER U ACCUEIL, 1 Rue Exemple, 35000 Villeexemple', code: '410050' };
    const lire = async (q) => (/email_reception_/.test(q) ? [{ id: 'email_reception_' + 'a'.repeat(32), s: '41000050' }] : [{ id: 'email_texte_' + 'a'.repeat(32), texte }]);
    const [r] = await L.lieuxRelusDansTextes([ligne], lire);
    dit(/64000 Pau/.test(r.lieu || '') && r.lieuSuggestionEcarte, 'le point d’une liste de suggestions est remplacé par celui de CE colis, lu dans le même e-mail', J(r));
    const vrai = { ...ligne, lieu: 'BAR EXEMPLE, 7 Rue Exemple, 64000 Pau' };
    const [r2] = await L.lieuxRelusDansTextes([vrai], lire);
    dit(r2.lieu === vrai.lieu && !r2.lieuSuggestionEcarte, 'un point déjà juste ne bouge pas', J(r2));
  });

  console.log('§H le transporteur dit le colis ailleurs, plus tard que l’e-mail : le plus récent prouvé gagne (src/relaisColis.js)');
  await essaie('H', async () => {
    const M = await importer('src/relaisColis.js');
    const lu = { lieuNom: 'Laverie Exemple', lieuAdresse: '13 Rue Exemple, Lille' };
    const tr = { carrier: 'vinted', etat: 'disponible', etatAt: '2026-11-11T13:05:00Z', lieuNom: 'Laverie Autre', lieuRue: '24 Rue Autre', lieuVille: 'Lille' };
    const r = M.lieuCompleteParTransporteur(lu, tr, Date.parse('2026-11-10T09:00:00Z'));
    dit(/24 Rue Autre/.test(r.lieuAdresse) && r.lieuDeplace && r.lieuDeplace.carrier === 'vinted' && !r.lieuConflit, 'lecture « disponible » APRÈS l’e-mail, autre adresse ⇒ l’adresse du transporteur, « déplacé » dit', J(r));
    const r2 = M.lieuCompleteParTransporteur(lu, { ...tr, etatAt: '2026-11-09T13:05:00Z' }, Date.parse('2026-11-10T09:00:00Z'));
    dit(r2.lieuConflit && !r2.lieuDeplace && /13 Rue Exemple/.test(r2.lieuAdresse), 'lecture d’AVANT l’e-mail ⇒ rien n’est choisi, le désaccord est dit', J(r2));
    const r3 = M.lieuCompleteParTransporteur(lu, tr, null);
    dit(r3.lieuConflit && !r3.lieuDeplace, 'date de l’e-mail inconnue ⇒ rien n’est choisi', J(r3));
    const carte = fs.readFileSync(path.join(R, 'src/CarteRelais.jsx'), 'utf8');
    dit(/data-rp-deplace=/.test(carte) && /déplacé · selon/.test(carte), 'la ligne dit « déplacé · selon … à hh:mm »');
  });

  console.log('§G le branchement');
  await essaie('G', async () => {
    const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const app = sansCom(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
    dit(/const completer = \(lu\) => lu;/.test(app) && !/completerParPointConnu\(/.test(app), 'aucune carte n’emprunte l’adresse d’un autre point au même nom');
    dit(/sansSuivi && t\.status === 'info' && codeLigne\(t\)/.test(app) && /etat: 'sans_suivi'/.test(app), 'un e-mail sans n° avec code va dans « à vérifier »');
    const carte = sansCom(fs.readFileSync(path.join(R, 'src/CarteRelais.jsx'), 'utf8'));
    dit(/data-rp-code-visible=\{x\.code/.test(carte) && /\(x\.code \|\| \(x\.qr \? 'QR' : 'Code'\)\)/.test(carte), 'le code est LISIBLE sur la ligne (0 toucher), un toucher le copie');
    dit(/data-relais-masques=\{masquesIci\.length\}/.test(carte) && /!pressant\(p\)/.test(carte), 'un point masqué laisse sa trace (« N points masqués · Afficher ») ; un colis du dernier jour n’est jamais masqué');
    dit(/data-rp-pas-confirme/.test(carte) && /verifieAncien\(x\.verifieMs\)/.test(carte), 'la ligne dit « pas confirmé depuis » en ambre');
    dit(/data-relais-adresse-pas-lue/.test(carte), 'la carte d’un point au nom seul dit « Adresse pas lue »');
    const al = sansCom(fs.readFileSync(path.join(R, 'src/AlerteRelaisChange.jsx'), 'utf8'));
    dit(/data-relais-change-code=\{x\.code\}/.test(al) && /Code pas encore reçu/.test(al) && /data-relais-change-ancien/.test(al), '« Point relais changé » montre le code (copiable), « code pas encore reçu », et l’ancien point');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
