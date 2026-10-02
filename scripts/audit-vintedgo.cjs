#!/usr/bin/env node
// Vérifie que l'email Vinted Go (mesuré sur un vrai mail de Julien, 2 oct. 2026)
// est bien analysé : code ALPHANUMÉRIQUE, suivi « VGS… », date « à retirer avant
// le … », lieu « Adresse » → consigne, et statut « à retirer » (sans quoi le
// colis disparaissait, faute de suivi capté).
(async () => {
  const mod = await import('../api/email-inbound.js');
  const { parseCarrierEmail, detecterTransporteur } = mod;
  // Corps RÉEL (retranscrit des captures d'écran du 2 octobre).
  const text = [
    'Bonjour Julien Fournier,',
    'Ton colis Vinted Go est arrivé. Tu peux dès à présent le récupérer.',
    "Grâce à toi, d'autres membres pourront eux aussi profiter de la consigne.",
    'Code de retrait',
    'Scanne ce QR code pour récupérer ton colis ou saisis le code suivant : C49341',
    'À retirer avant le 29/09/2026',
    "Nous le retournerons à l'expéditeur si tu ne le récupères pas à temps.",
    'Adresse',
    'Consigne Vinted Go',
    'Speed Queen - Vannes',
    '24 Rue Hoche',
    'Vannes',
    'Détails de la commande',
    'uniqlo jacket',
    '20.00 €',
    "Horaires d'ouverture",
    'Lundi–Dimanche',
    '07:00-21:00',
    'Numéro de suivi : VGS0000906049457',
    "Besoin d'aide ? N'hésite pas à consulter notre site Web.",
    "L'équipe Vinted Go",
  ].join('\n');
  const mail = { from: 'no-reply@vintedgo.com', subject: 'Ton colis Vinted Go est arrivé', text };

  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null ? ' — ' + d : '')); };

  const carrier = detecterTransporteur(mail);
  dit(carrier === 'vinted', 'le transporteur est reconnu Vinted Go', carrier);

  const t = parseCarrierEmail(mail, carrier);
  dit(t.code === 'C49341', 'le CODE alphanumérique est capté', t.code);
  dit(t.suivi === 'VGS0000906049457', 'le n° de suivi VGS est capté', t.suivi);
  dit(t.limite === '2026-09-29', 'la date limite « à retirer avant le » est captée', t.limite);
  dit(t.status === 'available', "le colis est « à retirer » (pas retombé en info)", t.status + '/' + t.label);
  dit(/consigne vinted go/i.test(t.lieu || ''), 'le lieu de retrait est capté', t.lieu);
  // Garde-fou : on ne doit PAS capter le mot « suivant » comme un code.
  dit(t.code !== 'suivant' && !/suivant/i.test(String(t.code || '')), 'le mot « suivant » n\'est jamais pris pour un code');

  console.log(ko === 0 ? '\nTOUS VERTS — Vinted Go est lu correctement.' : `\n${ko} CONTRÔLE(S) EN ÉCHEC`);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log('❌ le test a planté — ' + e.message); process.exit(2); });
