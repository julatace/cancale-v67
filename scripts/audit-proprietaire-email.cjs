// ════════════════════════════════════════════════════════════════════════════
//  À QUI APPARTIENT CET EMAIL ? — la règle exécutée, pas relue.
//
//  `api/_lib/proprietaire-email.js` porte en commentaire « fonction PURE, donc
//  testable exhaustivement »… et RIEN ne l'exécutait. C'est §4.10 mot pour mot
//  (« une fonction serverless n'est vérifiée que si un banc l'EXÉCUTE ») sur la
//  règle qui décide dans quelle boutique atterrit un bordereau.
//
//  Une erreur ici ne se voit pas : l'email part chez un autre vendeur, et celui
//  qui l'attendait ne saura jamais qu'il a existé.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`✅ ${quoi}`); }
  else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};

const J = '11111111-1111-1111-1111-111111111111';   // le propriétaire de l'installation
const B = '22222222-2222-2222-2222-222222222222';   // un second vendeur

(async () => {
  const mod = await import(path.join(__dirname, '..', 'api', '_lib', 'proprietaire-email.js'));
  const { resoudreProprietaire: r, adressesDeLivraison: adr, normAdresse, sansEtiquette } = mod;

  // ── L'adresse de réception décide, et elle seule ──────────────────────────
  const regJ = { 'recu@vrm.center': { owner: J } };
  const regJB = { 'recu@vrm.center': { owner: J }, 'sophie@vrm.center': { owner: B } };

  dit(r(['recu@vrm.center'], regJB, J).owner === J, 'une adresse déclarée désigne SON vendeur');
  dit(r(['sophie@vrm.center'], regJB, J).owner === B, 'et l’autre adresse désigne l’autre vendeur');

  // ⚠️ Deux vendeurs en destinataires : personne ne tranche à leur place.
  dit(r(['recu@vrm.center', 'sophie@vrm.center'], regJB, J).via === 'quarantaine',
    'deux vendeurs destinataires : quarantaine, jamais un des deux au hasard');

  // L'étiquette « + » n'est qu'un repli, et seulement si l'exacte est inconnue.
  dit(r(['recu+vinted@vrm.center'], regJ, '').owner === J,
    'l’étiquette « + » retombe sur l’adresse de base');
  dit(r(['recu+vinted@vrm.center'], { 'recu+vinted@vrm.center': { owner: B }, 'recu@vrm.center': { owner: J } }, '').owner === B,
    'mais l’adresse EXACTE gagne toujours sur le repli');

  // ── ⚠️⚠️ LE REPLI « INSTALLATION » S'ÉTEINT QUAND ON N'EST PLUS SEUL ──────
  // Tant que Julien est seul, tout lui appartient : c'est explicite, réglé par
  // lui, et c'est ce qui a évité de refaire l'incident du 16 au 22 août.
  dit(r(['inconnue@vrm.center'], {}, J).via === 'installation',
    'seul vendeur, registre vide : l’email lui revient (pas de quarantaine inutile)');
  dit(r(['inconnue@vrm.center'], regJ, J).via === 'installation',
    'seul vendeur qui a déclaré SES adresses : rien ne change');
  // Le jour où quelqu'un d'autre est là, ce repli devient une devinette — et
  // celle qui coûte le plus cher : le bordereau d'un vendeur chez un autre.
  const deux = r(['inconnue@vrm.center'], regJB, J);
  dit(deux.via === 'quarantaine' && !deux.owner,
    'DEUX vendeurs, adresse inconnue : quarantaine — le repli ne devine plus',
    JSON.stringify(deux));
  dit(/plusieurs vendeurs/i.test(deux.raison || ''),
    'et la raison dit pourquoi, pour que ça se répare', deux.raison);

  // Sans propriétaire d'installation réglé, rien ne s'invente non plus.
  dit(r(['inconnue@vrm.center'], {}, '').via === 'quarantaine',
    'aucun propriétaire réglé : quarantaine');
  dit(r([], {}, '').via === 'quarantaine', 'aucune adresse lisible : quarantaine');

  // ── Ce qui NE doit jamais décider ─────────────────────────────────────────
  // Le corps, le sujet et l'expéditeur sont écrits par n'importe qui.
  const corps = {
    from: 'sophie@vrm.center', subject: 'Bordereau pour sophie@vrm.center',
    text: 'livré à sophie@vrm.center', to: 'recu@vrm.center',
  };
  const vues = adr(corps, { to: 'recu@vrm.center' });
  dit(!vues.includes('sophie@vrm.center'),
    'ni l’expéditeur, ni le sujet, ni le corps ne comptent comme adresse de livraison',
    vues.join(', '));
  dit(r(vues, regJB, J).owner === J, 'un email qui NOMME un autre vendeur reste chez le bon');

  // ── Les formes d'adresse ──────────────────────────────────────────────────
  dit(normAdresse('Julien <Recu@VRM.center> ') === 'recu@vrm.center', 'une adresse se compare normalisée');
  dit(sansEtiquette('recu+a+b@vrm.center') === 'recu@vrm.center', 'l’étiquette est retirée en entier');
  // Un registre écrit avec des majuscules ou des espaces doit marcher : c'est
  // Julien qui le saisit à la main dans Réglages.
  dit(r(['recu@vrm.center'], { ' Recu@VRM.center ': { owner: J } }, '').owner === J,
    'un registre saisi à la main (majuscules, espaces) marche quand même');

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''} — un email ne part jamais chez le mauvais vendeur.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ l’audit est tombé :', e && e.message); process.exit(1); });
