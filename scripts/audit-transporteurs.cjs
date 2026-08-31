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

console.log(ko ? `\n${ko} email(s) mal aiguillés.` : '\nAucun email de colis ne passe à travers.');
process.exit(ko ? 1 : 0);
})();
