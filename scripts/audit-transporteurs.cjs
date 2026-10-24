#!/usr/bin/env node
// AUDIT : un email de colis ne doit JAMAIS passer à travers, et un email de
// vente ne doit JAMAIS être pris pour un colis.
// « Je veux qu'il n'y ait aucune erreur du côté Chronopost, Mondial Relay,
//   Vinted GO. » — Julien, 23 août 2026.
// Fonction pure `detecterTransporteur` (api/email-inbound.js). Aucun réseau.
const path = require('path');
let ko = 0;
const ok = (t) => console.log('✅ ' + t);
const nok = (t, d) => { ko++; console.log('❌ ' + t + (d ? ' — ' + d : '')); };

(async () => {
const { detecterTransporteur } = await import('file://' + path.resolve(__dirname, '../api/email-inbound.js'));
const T = (nom, mail, attendu) => {
  const r = detecterTransporteur({ from: '', subject: '', text: '', html: '', ...mail });
  (r === attendu) ? ok(`${nom} → ${r === null ? 'pas un colis' : r}`)
                  : nok(nom, `attendu ${attendu === null ? 'pas un colis' : attendu}, obtenu ${r === null ? 'null' : r}`);
};

// ── Les trois transporteurs qu'il nomme, sous toutes leurs formes réelles ────
T('Chronopost Pickup (direct)', { from: 'Chronopost Pickup <chronopost@network1.pickup.fr>', subject: 'Votre colis Chronopost est arrivé en consigne Pickup' }, 'chronopost');
T('Chronopost via Vinted', { from: 'Chronopost Pickup via Vinted <shipping@relay.vinted.com>', subject: 'Votre colis a été retiré' }, 'chronopost');
T('Chronopost — RAPPEL', { from: 'Chronopost Pickup <chronopost@network1.pickup.fr>', subject: 'Rappel : votre colis vous attend en consigne Pickup' }, 'chronopost');
T('Mondial Relay via Vinted', { from: 'Mondial Relay via Vinted <shipping@relay.vinted.com>', subject: 'Votre colis est entre de bonnes mains 📦' }, 'mondialrelay');
T('Mondial Relay (direct)', { from: 'noreply@mondialrelay.fr', subject: 'Votre colis 60385202 est disponible' }, 'mondialrelay');
T('Vinted Go (@vintedgo.com)', { from: 'Vinted Go <noreply@vintedgo.com>', subject: 'Ton colis est arrivé au point relais' }, 'vinted');
T('Vinted Go nommé dans le sujet', { from: 'shipping@relay.vinted.com', subject: 'Vinted Go — ton colis est à retirer' }, 'vinted');
// ⚠️ LE VRAI EMAIL (capture de Julien, 2 oct.) : from `noreply@vinted.com` nu
// (ni vintedgo.com, ni shipping@relay), « Vinted Go » dans le sujet/corps + suivi
// VGS. Le narrowing `carrierSrc = mail.from` le classait « autre » → badge
// « Transporteur » au lieu de « Vinted Go ». Doit être 'vinted'.
T('Vinted Go depuis @vinted.com nu (vrai email)', { from: 'noreply@vinted.com', subject: 'Ton colis Vinted Go est arrivé', text: 'Ton colis Vinted Go est arrivé. Scanne ce QR code ou saisis le code suivant : C49341. Numéro de suivi : VGS0000906049457' }, 'vinted');
T('Vinted Go reconnu par le suivi VGS dans le corps', { from: 'noreply@vinted.com', subject: 'Ton colis est arrivé', text: 'Code de retrait C49341. Numéro de suivi : VGS0000906049457' }, 'vinted');
T('Vinted shipping générique', { from: 'shipping@relay.vinted.com', subject: 'Ton colis est en chemin' }, 'vinted');
T('Colis annoncé par Vinted lui-même', { from: "L'équipe Vinted <no-reply@vinted.fr>", subject: 'Ton colis est arrivé au point relais' }, 'autre');
T('Transporteur inconnu, mots de colis', { from: 'info@transporteur-x.com', subject: 'Votre colis est à retirer', text: 'code de retrait 1234' }, 'autre');
T('Shop2Shop', { from: 'noreply@shop2shop.fr', subject: 'Suite à votre dépôt de colis Shop2Shop' }, 'shop2shop');
T('Colissimo', { from: 'noreply@laposte.fr', subject: 'Votre colis Colissimo est livré' }, 'colissimo');

// ── Ce qui ne doit JAMAIS devenir un colis ──────────────────────────────────
T('vente Vinted', { from: "L'équipe Vinted <no-reply@vinted.fr>", subject: 'Ton article est vendu !' }, null);
T('offre Vinted', { from: "L'équipe Vinted <no-reply@vinted.fr>", subject: 'Nouvelle offre pour nike zoom fly 5' }, null);
T('message Vinted', { from: "L'équipe Vinted <no-reply@vinted.fr>", subject: 'Tu as reçu un message' }, null);
T('favori Vinted', { from: "L'équipe Vinted <no-reply@vinted.fr>", subject: 'Ton article a été ajouté aux favoris' }, null);
T('transfert bancaire', { from: "L'équipe Vinted <no-reply@vinted.fr>", subject: 'Le transfert bancaire est en cours' }, null);
T('bordereau (traité ailleurs)', { from: "L'équipe Vinted <no-reply@vinted.fr>", subject: "Bordereau d'envoi pour ta commande" }, null);
T('bordereau même chez un transporteur', { from: 'Chronopost <chronopost@network1.pickup.fr>', subject: "Bordereau d'envoi" }, null);
T('email quelconque', { from: 'ami@exemple.fr', subject: 'Coucou' }, null);

// ── Le bout en bout : la forme du contenant ne doit rien changer ────────────
const { normaliserEntrant } = await import('file://' + path.resolve(__dirname, '../api/_lib/lire-email.js'));
const mime = [
  'From: Chronopost Pickup <chronopost@network1.pickup.fr>',
  'Subject: =?UTF-8?Q?Votre_colis_Chronopost_est_arriv=C3=A9_en_consigne_Pickup?=',
  'Content-Type: text/plain; charset="UTF-8"', '', 'Identifiant : *8156*', '',
].join('\n');
for (const [nom, brut] of [['MIME brut', mime], ['MIME emballé', { raw: mime }], ['JSON à plat', { from: 'Chronopost Pickup <chronopost@network1.pickup.fr>', subject: 'Votre colis Chronopost est arrivé en consigne Pickup' }]]) {
  const m = normaliserEntrant(brut);
  detecterTransporteur(m) === 'chronopost'
    ? ok(`bout en bout — ${nom} → chronopost`)
    : nok(`bout en bout — ${nom}`, 'détecté ' + detecterTransporteur(m));
}

// ── ⚠️ « HIDE MY EMAIL » D'iCLOUD (mesuré le 30 août sur la vraie base) ─────
// Julien reçoit une partie de ses emails via un alias iCloud, qui RÉÉCRIT
// l'expéditeur : `shipping@relay.vinted.com` devient
// `shipping_at_relay_vinted_com_t9zx4089tn7g48_18rq1890@icloud.com`. Tout test
// sur l'expéditeur échoue alors. Le cas réel trouvé était un VRAI email de
// transporteur (SEUR, « Tu envío ha sido recogido ») qui n'a été reconnu par
// AUCUNE règle et s'est retrouvé dans les emails « non compris ».
// ⚠️ Ce contrôle échoue sur le code d'avant : détection `null` au lieu de
//    `vinted` — vérifié.
const { demasquerRelais } = await import('file://' + path.resolve(__dirname, '../api/_lib/lire-email.js'));
{
  const alias = 'SEUR via Vinted <shipping_at_relay_vinted_com_t9zx4089tn7g48_18rq1890@icloud.com>';
  const reel = demasquerRelais(alias);
  /relay\.vinted/i.test(reel) ? ok('alias iCloud → le domaine réel redevient lisible')
    : nok('alias iCloud démasqué', 'obtenu ' + JSON.stringify(reel));
  const mailAlias = { from: `${alias} (${reel})`, subject: 'Tu envío ha sido recogido', text: 'Vinted te transfère cet e-mail de la part de SEUR.' };
  detecterTransporteur(mailAlias) ? ok('email de colis derrière un alias iCloud → reconnu')
    : nok('email de colis derrière un alias iCloud', 'détecté null');
  // et l'inverse : une adresse normale ne doit pas être touchée
  demasquerRelais('Chronopost <chronopost@network1.pickup.fr>') === ''
    ? ok('une adresse normale n\'est pas réécrite')
    : nok('adresse normale intacte', 'démasquée à tort');
}

// ── LE CODE DE RETRAIT « … SUIVANT AU COMMERÇANT : 123456 » (22 octobre) ──────
// MESURÉ (lecture seule) : l'email Chronopost « Votre colis VINTED est arrivé en
// relais Pickup » du 22 octobre porte « communiquez le code de retrait suivant au
// commer&ccedil;ant :  NNNNNN » (entité HTML non décodée, deux espaces) ; la route
// ne le lisait pas, la ligne rangée a `code: null` et garde cette phrase dans
// `extraitCode`. Chiffres INVENTÉS ici. Trois couches :
//   A. la règle (api/_lib/code-retrait-email.js) — ne prend que les chiffres qui
//      SUIVENT la tournure, sur la même ligne ;
//   B. la vraie route (`parseCarrierEmail`) range le code à l'arrivée ;
//   C. l'app (`reclassifyTrack`, extraite de src/App.jsx) relit le code d'une
//      ligne DÉJÀ rangée, depuis `extraitCode`, avec la même règle (§11).
// `--mutation ligne-suivante|sans-regle|app-sans-relecture` réaffaiblit une règle
// dans une copie : le contrôle visé doit repasser au rouge (§6.1).
{
  const fs = require('fs'), os = require('os'), vm = require('vm');
  const R = path.join(__dirname, '..');
  const iMut = process.argv.indexOf('--mutation'); const mut = iMut > 0 ? process.argv[iMut + 1] : '';
  const MUT_REGLE = {
    'ligne-suivante': ['[:：][ \\t\\u00a0*_]*(\\d{4,10})', '[:：]\\s*(\\d{4,10})'],
    'sans-regle': ['return m ? m[1] : \'\';', 'return \'\';'],
  };
  const MUT_APP = { 'app-sans-relecture': ['if(!codeRetrait(d.code)&&d.extraitCode){const c=codeRetraitTournure(d.extraitCode);if(c)d={...d,code:c};}', ''] };
  if (mut && !MUT_REGLE[mut] && !MUT_APP[mut]) { console.log('mutation inconnue : ' + mut); process.exit(2); }
  const cheminRegle = path.join(R, 'api/_lib/code-retrait-email.js');
  let modRegle = null;
  try {
    let src = fs.readFileSync(cheminRegle, 'utf8');
    if (MUT_REGLE[mut]) { const [de, vers] = MUT_REGLE[mut]; if (src.split(de).length !== 2) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); } src = src.replace(de, vers); }
    const f = path.join(os.tmpdir(), `vrm-code-retrait-${process.pid}.mjs`); fs.writeFileSync(f, src);
    modRegle = await import('file://' + f);
  } catch (e) { nok('la règle partagée existe (api/_lib/code-retrait-email.js)', String(e && e.message || e).slice(0, 120)); }
  const lit = (t) => (modRegle && modRegle.codeRetraitTournure ? modRegle.codeRetraitTournure(t) : null);
  const A = (nom, texte, attendu) => (lit(texte) === attendu ? ok(`règle — ${nom}`) : nok(`règle — ${nom}`, `attendu « ${attendu} », obtenu « ${lit(texte)} »`));
  A('la forme mesurée (entité HTML, deux espaces) → les 6 chiffres', 'communiquez le code de retrait suivant au commer&ccedil;ant :  482913', '482913');
  A('la même, accents décodés', 'Communiquez le code de retrait suivant au commerçant : 482913', '482913');
  A('le mot « suivant » sans nombre → rien', 'communiquez le code de retrait suivant au commerçant : suivant', '');
  A('un nombre sur la LIGNE SUIVANTE (un code postal ?) → rien', 'communiquez le code de retrait suivant au commerçant :\n35260 Cancale', '');
  A('un n° de suivi de 14 chiffres → rien', 'communiquez le code de retrait suivant au commerçant : 09440000000001', '');
  A('une date → rien', 'communiquez le code de retrait suivant au commerçant : 29/10/2026', '');
  A('« code de retrait » ailleurs dans le texte → rien', 'Présentez votre Pickup Pass ou le code de retrait ci-dessus. Agence 35260', '');

  // B. la vraie route
  try {
    const { parseCarrierEmail } = await import('file://' + path.join(R, 'api/email-inbound.js'));
    const html = '<p>Bonjour,</p><p>Votre colis 09440000000001 est arrivé en relais Pickup.</p><p>communiquez le code de retrait suivant au commer&ccedil;ant :&nbsp; <b>482913</b></p><p>D&eacute;tails du colis</p><p>Pr&eacute;sentez votre Pickup Pass ou le code</p><p>de retrait ci-dessus.</p>';
    const t = parseCarrierEmail({ from: 'Chronopost Pickup via Vinted <shipping@relay.vinted.com>', subject: 'Votre colis VINTED est arrivé en relais Pickup', text: '', html }, 'chronopost');
    (t.status === 'available' && t.code === '482913' && !t.extraitCode) ? ok('route — l’email du 22 oct. (forme mesurée) range le code « 482913 », plus d’extrait à mesurer')
      : nok('route — l’email Pickup du 22 oct. range son code', JSON.stringify({ s: t.status, c: t.code, e: t.extraitCode }));
    const t2 = parseCarrierEmail({ from: 'Chronopost Pickup via Vinted <shipping@relay.vinted.com>', subject: 'Votre colis VINTED est arrivé en relais Pickup', text: '', html: '<p>Votre colis 09440000000002 est arrivé.</p><p>communiquez le code de retrait suivant au commer&ccedil;ant :</p><p>35260 Cancale</p>' }, 'chronopost');
    (!t2.code && typeof t2.extraitCode === 'string') ? ok('route — la tournure sans nombre sur sa ligne : AUCUN code inventé (le code postal n’est pas pris), l’extrait reste pour mesurer')
      : nok('route — pas de code inventé', JSON.stringify({ c: t2.code, e: t2.extraitCode }));
  } catch (e) { nok('route — parseCarrierEmail', String(e && e.message || e).slice(0, 160)); }

  // C. l'app relit la ligne DÉJÀ rangée
  try {
    const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
    let src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    if (MUT_APP[mut]) { const [de, vers] = MUT_APP[mut]; if (src.split(de).length !== 2) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); } src = src.replace(de, vers); }
    const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
    const decl = {};
    for (const n of ast.program.body) if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && ['codeRetrait', 'reclassifyTrack'].includes(d.id.name)) decl[d.id.name] = 'const ' + src.slice(d.start, d.end) + ';';
    const etat = await import('file://' + path.join(R, 'api/_lib/etat-colis-email.js'));
    // (23 oct.) `reclassifyTrack` relit aussi le lieu et la date limite des
    // lignes gardées par la règle partagée (api/_lib/retrait-colis.js, §11) :
    // le banc la lui donne telle quelle (absente sur un arbre d'avant ⇒ rien).
    let retrait = {};
    try { retrait = await import('file://' + path.join(R, 'api/_lib/retrait-colis.js')); } catch (_) { retrait = {}; }
    const ctx = { etatColisDepuisTexte: etat.etatColisDepuisTexte, normaliserSuivi: etat.normaliserSuivi,
      codeRetraitTournure: (t) => (modRegle && modRegle.codeRetraitTournure ? modRegle.codeRetraitTournure(t) : ''),
      lieuDepuisExtrait: retrait.lieuDepuisExtrait, limiteRetraitDepuisTexte: retrait.limiteRetraitDepuisTexte, LIEU_AU_FUTUR: retrait.LIEU_AU_FUTUR };
    // (revue du 23 oct., n° 2) La relecture vit dans la règle partagée (api/_lib/suivi-colis.js).
    try { const sc = await import('file://' + path.join(R, 'api/_lib/suivi-colis.js')); ctx.relireLigneSuivi = sc.relireLigneSuivi; } catch (_) {}
    vm.createContext(ctx);
    vm.runInContext(`${decl.codeRetrait}\n${decl.reclassifyTrack}\nthis.reclassifyTrack=reclassifyTrack;this.codeRetrait=codeRetrait;`, ctx);
    const ligne = { carrier: 'chronopost', suivi: '09440000000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis VINTED est arrivé en relais Pickup', code: null,
      extraitCode: "communiquez le code de retrait suivant au commer&ccedil;ant :  482913 | D&eacute;tails du colis | Pr&eacute;sentez votre Pickup Pass ou le code | de retrait ci-dessus." };
    const lu = ctx.reclassifyTrack(ligne);
    ctx.codeRetrait(lu && lu.code) === '482913' ? ok('app — la ligne déjà rangée (code vide, extrait gardé) affiche son code « 482913 »')
      : nok('app — la ligne déjà rangée affiche son code', JSON.stringify(lu && lu.code));
    const sans = ctx.reclassifyTrack({ ...ligne, extraitCode: 'communiquez le code de retrait suivant au commer&ccedil;ant : | 35260 Cancale' });
    !ctx.codeRetrait(sans && sans.code) ? ok('app — un extrait sans nombre sur la ligne : aucun code inventé')
      : nok('app — aucun code inventé', JSON.stringify(sans && sans.code));
    const garde = ctx.reclassifyTrack({ ...ligne, code: '715204', extraitCode: ligne.extraitCode });
    garde && garde.code === '715204' ? ok('app — un code déjà rangé n’est jamais remplacé') : nok('app — code rangé gardé', JSON.stringify(garde && garde.code));
  } catch (e) { nok('app — reclassifyTrack', String(e && e.message || e).slice(0, 160)); }
}

console.log(ko ? `\n${ko} email(s) mal aiguillés.` : '\nAucun email de colis ne passe à travers.');
process.exit(ko ? 1 : 0);
})();
