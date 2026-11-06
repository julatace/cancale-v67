// ── « RELIER MA BOÎTE » (5 nov., demande de Julien) ─────────────────────────
// « Un motion design qui montre, boîte par boîte (Google, iCloud…), comment
// transmettre les e-mails à VRM (Vinted, Leboncoin, Vestiaire, eBay, Mondial
// Relay, Chronopost, Vinted Go…) ; un vrai accompagnement. »
//
// Ce module porte le CONTENU, sans React : les messageries, leurs étapes, les
// expéditeurs à faire suivre et la règle de filtre à poser. L'écran
// (src/RelierBoite.jsx) l'anime.
//
// ⚠️ RIEN N'EST ENVOYÉ À PERSONNE : cette page n'écrit rien et n'appelle aucune
//    route. Elle montre ; c'est LUI qui pose la règle dans SA messagerie.
// ⚠️ Les écrans et adresses de l'animation sont INVENTÉS (`ADRESSE_EXEMPLE`,
//    `BOITE_VRM_EXEMPLE`) : jamais une de ses adresses ni un de ses emails
//    (vocal du 5 nov. : « des données simulées, jamais les siennes »). La vraie
//    adresse de VRM à copier est donnée à part, hors animation.
// ⚠️ Les mots-clés d'expéditeur viennent des domaines VUS dans sa base (mesuré
//    le 5 nov. : vinted.fr, relay.vinted.com, team.vinted.com, mondialrelay.fr/
//    .com, reply.ebay.fr, ebay.com, leboncoin.fr…) et de ceux que la route
//    email-inbound sait lire (chronopost.fr, vintedgo.com, vestiairecollective.com).
//    Relais Colis : domaine pas encore vu dans sa base — le mot-clé reste large.

export const ADRESSE_EXEMPLE = 'camille.exemple@boite.test';
export const BOITE_VRM_EXEMPLE = 'vrm-exemple@collecte.test';

export const EXPEDITEURS = [
  { id: 'vinted', nom: 'Vinted', mot: 'vinted', domaines: ['vinted.fr', 'vinted.com'], sujet: 'Ton article a été vendu', quoi: 'ventes, bordereaux, reçus d’achat, offres' },
  { id: 'vintedgo', nom: 'Vinted Go', mot: 'vintedgo', domaines: ['vintedgo.com'], sujet: 'Ton colis t’attend au casier', quoi: 'codes de retrait des casiers' },
  { id: 'mondialrelay', nom: 'Mondial Relay', mot: 'mondialrelay', domaines: ['mondialrelay.fr', 'mondialrelay.com'], sujet: 'Votre colis est disponible', quoi: 'colis arrivés, codes de retrait' },
  { id: 'chronopost', nom: 'Chronopost', mot: 'chronopost', domaines: ['chronopost.fr'], sujet: 'Votre colis est en point relais', quoi: 'suivi, colis disponibles' },
  { id: 'relaiscolis', nom: 'Relais Colis', mot: 'relaiscolis', domaines: ['relaiscolis.com'], sujet: 'Votre colis est arrivé', quoi: 'colis disponibles' },
  { id: 'leboncoin', nom: 'Leboncoin', mot: 'leboncoin', domaines: ['leboncoin.fr'], sujet: 'Votre annonce a trouvé preneur', quoi: 'ventes et messages Leboncoin' },
  { id: 'ebay', nom: 'eBay', mot: 'ebay', domaines: ['ebay.fr', 'ebay.com'], sujet: 'Votre objet est vendu', quoi: 'ventes et offres eBay' },
  { id: 'vestiaire', nom: 'Vestiaire Collective', mot: 'vestiairecollective', domaines: ['vestiairecollective.com'], sujet: 'Félicitations, votre article est vendu', quoi: 'ventes Vestiaire' },
];

// Les scènes de l'animation (une par étape) : l'écran sait les dessiner.
//   reglages  — la roue des paramètres s'ouvre
//   adresse   — l'adresse de VRM est collée dans « Transfert »
//   code      — la messagerie demande une validation (code ou lien)
//   filtre    — la règle se remplit, expéditeur par expéditeur
//   flux      — un email de l'expéditeur arrive et part vers VRM
export const SCENES = ['reglages', 'adresse', 'code', 'filtre', 'flux'];

export const MESSAGERIES = [
  { id: 'gmail', nom: 'Gmail', famille: 'Google', regle: 'filtre',
    etapes: [
      { scene: 'reglages', titre: 'Ouvre les paramètres', geste: 'Sur ordinateur, dans Gmail : la roue en haut à droite → « Voir tous les paramètres ».' },
      { scene: 'adresse', titre: 'Ajoute l’adresse de VRM', geste: 'Onglet « Transfert et POP/IMAP » → « Ajouter une adresse de transfert » → colle l’adresse de VRM.' },
      { scene: 'code', titre: 'Valide le transfert', geste: 'Gmail envoie un code de validation à la boîte de VRM : VRM te le rend dans Réglages → E-mails → Adresses, une fois ton adresse confirmée. Tape-le à côté de « Valider ».' },
      { scene: 'filtre', titre: 'Crée le filtre', geste: 'Dans la barre de recherche : l’icône des options → champ « De » : colle la règle ci-dessous → « Créer un filtre » → coche « Transférer à » l’adresse de VRM.' },
      { scene: 'flux', titre: 'C’est en place', geste: 'Le prochain email d’un de ces expéditeurs part aussi vers VRM. Ton courrier personnel, lui, ne part pas.' },
    ] },
  { id: 'icloud', nom: 'iCloud Mail', famille: 'Apple', regle: 'regles',
    etapes: [
      { scene: 'reglages', titre: 'Ouvre les réglages', geste: 'Sur icloud.com/mail (ordinateur) : la roue → « Réglages » → « Règles ».' },
      { scene: 'adresse', titre: 'Ajoute une règle', geste: '« Ajouter une règle » → « Si un message est de » → l’expéditeur (un par règle).' },
      { scene: 'filtre', titre: 'Fais-la suivre à VRM', geste: '« Alors » → « Transférer à » → colle l’adresse de VRM. Recommence pour chaque expéditeur de la liste.' },
      { scene: 'code', titre: 'Garde une copie', geste: 'Laisse les emails aussi dans ta boîte : le transfert envoie une copie, rien n’est déplacé.' },
      { scene: 'flux', titre: 'C’est en place', geste: 'Le prochain email d’un de ces expéditeurs part aussi vers VRM.' },
    ] },
  { id: 'outlook', nom: 'Outlook / Hotmail', famille: 'Microsoft', regle: 'regles',
    etapes: [
      { scene: 'reglages', titre: 'Ouvre les paramètres', geste: 'Sur outlook.com : la roue → « Courrier » → « Règles ».' },
      { scene: 'adresse', titre: 'Ajoute une règle', geste: '« Ajouter une nouvelle règle » → condition « De » → l’expéditeur.' },
      { scene: 'filtre', titre: 'Fais-la suivre à VRM', geste: 'Action « Transférer à » → colle l’adresse de VRM → « Enregistrer ». Ajoute les autres expéditeurs à la même condition.' },
      { scene: 'code', titre: 'Si Outlook bloque', geste: 'Certains comptes Outlook refusent le transfert automatique. Si, après le prochain email de Vinted, rien n’apparaît dans la boîte de réception de VRM, c’est qu’Outlook l’a bloqué.' },
      { scene: 'flux', titre: 'C’est en place', geste: 'Le prochain email d’un de ces expéditeurs part aussi vers VRM.' },
    ] },
  { id: 'fai', nom: 'Orange, SFR, Free', famille: 'Fournisseur d’accès', regle: 'regles',
    etapes: [
      { scene: 'reglages', titre: 'Ouvre les préférences', geste: 'Dans le webmail de ton fournisseur, cherche « Préférences », « Paramètres » ou « Réglages ».' },
      { scene: 'adresse', titre: 'Trouve les filtres', geste: 'Le menu s’appelle selon la version « Filtres », « Règles » ou « Règles de tri » (parfois « Messages » → « Filtres »).' },
      { scene: 'filtre', titre: 'Crée la règle', geste: 'Condition « Expéditeur contient » → l’expéditeur ; action « Rediriger » ou « Transférer » vers l’adresse de VRM.' },
      { scene: 'code', titre: 'Garde une copie', geste: 'Choisis l’option qui garde aussi le message dans ta boîte, si elle existe.' },
      { scene: 'flux', titre: 'C’est en place', geste: 'Les menus changent d’une version à l’autre : si un nom ne correspond pas, cherche « filtre », « règle » ou « transfert ».' },
    ] },
  // (6 nov., onglets C) Yahoo : le transfert automatique est réservé à Yahoo Mail Plus
  // (payant) depuis le 15 janv. 2021, et il fait suivre TOUTE la boîte, sans filtre
  // (help.yahoo.com/kb/SLN35503.html, SLN36684.html). On le DIT, avec le geste gratuit.
  { id: 'yahoo', nom: 'Yahoo Mail', famille: 'Yahoo', regle: 'transfert',
    etapes: [
      { scene: 'reglages', titre: 'Le transfert de Yahoo est payant', geste: 'Yahoo ne fait suivre les e-mails qu’avec Yahoo Mail Plus, et il envoie alors TOUTE la boîte (pas seulement Vinted).' },
      { scene: 'flux', titre: 'Le plus simple, gratuit', geste: 'Dans les paramètres du compte Vinted, remplace l’adresse e-mail par celle d’une boîte déjà reliée à VRM (Gmail ou iCloud).' },
      { scene: 'adresse', titre: 'Avec Yahoo Mail Plus', geste: 'Sur ordinateur, dans Yahoo Mail : la roue → « Plus de paramètres » → « Boîtes aux lettres » → ta boîte → « Transfert » → colle l’adresse de VRM.' },
      { scene: 'code', titre: 'Vérifie le transfert', geste: 'Yahoo envoie un lien de vérification à l’adresse de VRM. Si l’option « Transfert » n’apparaît pas, elle n’est pas disponible pour ton compte.' },
    ] },
  // (6 nov., onglets C) L'adresse « Masquer mon adresse » d'Apple (…@privaterelay.appleid.com) :
  // ce n'est pas une boîte, c'est un relais. Apple fait suivre ses e-mails vers UNE boîte
  // (« Transférer à ») ; il suffit que ce soit une boîte déjà reliée à VRM. Sources :
  // support.apple.com/102571 (Se connecter avec Apple : « Transférer à », transfert par
  // développeur) et support.apple.com/102548 (Masquer mon adresse e-mail, iCloud+).
  // Mesuré le 6 nov. : les trois comptes Vinted sans aucun e-mail utilisent ce relais.
  { id: 'relais-apple', nom: 'Masquer mon adresse (Apple)', famille: 'Adresse relais d’Apple', regle: 'relais',
    etapes: [
      { scene: 'reglages', titre: 'Ouvre « Masquer mon adresse »', geste: 'Sur l’iPhone : Réglages → ton nom → iCloud → « Masquer mon adresse e-mail ».' },
      { scene: 'adresse', titre: 'Choisis où Apple fait suivre', geste: '« Transférer à » → choisis une boîte qui arrive DÉJÀ à VRM. Seules les adresses de ton compte Apple sont proposées.' },
      { scene: 'code', titre: 'Le transfert doit être activé pour Vinted', geste: 'Réglages → ton nom → Connexion et sécurité → « Se connecter avec Apple » → Vinted : le transfert des e-mails doit être activé.' },
      { scene: 'flux', titre: 'C’est en place', geste: 'Le prochain e-mail de Vinted pour ce compte arrive dans cette boîte, qui le fait suivre à VRM.' },
    ] },
  { id: 'autre', nom: 'Autre messagerie', famille: 'Toutes les autres', regle: 'regles',
    etapes: [
      { scene: 'reglages', titre: 'Ouvre les paramètres', geste: 'Cherche « Paramètres », « Préférences » ou la roue.' },
      { scene: 'adresse', titre: 'Trouve « Filtres » ou « Règles »', geste: 'Le nom change d’une messagerie à l’autre ; « transfert » marche aussi dans la recherche des paramètres.' },
      { scene: 'filtre', titre: 'Crée la règle', geste: 'Condition sur l’expéditeur, action « Transférer » vers l’adresse de VRM.' },
      { scene: 'code', titre: 'Valide si on te le demande', geste: 'Si ta messagerie envoie un code à VRM, VRM te le rend dans Réglages → E-mails → Adresses (une fois ton adresse confirmée).' },
      { scene: 'flux', titre: 'C’est en place', geste: 'Le prochain email d’un de ces expéditeurs part aussi vers VRM.' },
    ] },
];

// La règle à poser, pour les expéditeurs choisis. Gmail : UNE ligne pour le
// champ « De » ; les autres : une condition par expéditeur.
export function regleFiltre(messagerie, ids) {
  const choisis = EXPEDITEURS.filter((x) => (ids || []).includes(x.id));
  if (!choisis.length) return { lignes: [], texte: '' };
  const m = MESSAGERIES.find((x) => x.id === messagerie) || MESSAGERIES[MESSAGERIES.length - 1];
  // Yahoo (toute la boîte) et le relais d'Apple : aucune règle d'expéditeur à poser.
  if (m.regle === 'transfert' || m.regle === 'relais') return { lignes: [], texte: '' };
  if (m.regle === 'filtre') {
    const texte = choisis.length === 1 ? choisis[0].mot : `${choisis.map((x) => x.mot).join(' OR ')}`;
    return { lignes: [texte], texte };
  }
  const lignes = choisis.map((x) => `L’expéditeur contient « ${x.mot} »`);
  return { lignes, texte: choisis.map((x) => x.mot).join('\n') };
}

// (6 nov., onglets C) Les mots de la scène animée selon la façon dont la messagerie
// fait suivre : `filtre` (Gmail : adresse de transfert, code, filtre), `transfert`
// (Yahoo : toute la boîte), `relais` (Apple : « Transférer à »), `regles` (une règle
// par expéditeur). Pur : l'écran les dessine.
export function motsScene(regle, expediteur) {
  const de = `De : ${(expediteur && expediteur.mot) || 'vinted'}`;
  if (regle === 'relais') return { menu: 'Masquer mon adresse e-mail', libAdresse: 'Transférer à', champAdresse: ADRESSE_EXEMPLE, bouton: 'OK', libCode: 'Vinted · transfert des e-mails', code: false, coche: 'Activé' };
  if (regle === 'filtre' || regle === 'transfert') return { menu: regle === 'filtre' ? 'Voir tous les paramètres' : 'Plus de paramètres', libAdresse: 'Adresse de transfert', champAdresse: BOITE_VRM_EXEMPLE, bouton: regle === 'filtre' ? 'Ajouter' : 'Vérifier', libCode: 'Code de validation (exemple)', code: true, coche: '' };
  return { menu: 'Réglages · Règles', libAdresse: 'Nouvelle règle', champAdresse: de, bouton: 'Suivant', libCode: 'Garder une copie dans ma boîte', code: false, coche: 'Copie gardée' };
}

// La messagerie d'une adresse, lue sur son DOMAINE : une SUGGESTION pour ouvrir le
// bon pas-à-pas (il peut en choisir une autre) — jamais une identité.
const DOMAINES = [
  ['relais-apple', /^privaterelay\.appleid\.com$/],
  ['gmail', /^(?:gmail|googlemail)\.com$/],
  ['icloud', /^(?:icloud|me|mac)\.com$/],
  ['outlook', /^(?:outlook|hotmail|live|msn)\.[a-z.]+$/],
  ['yahoo', /^(?:yahoo\.[a-z.]+|ymail\.com)$/],
  ['fai', /^(?:orange|wanadoo|sfr|neuf|free|aliceadsl|bbox)\.fr$/],
];
export function messagerieDeAdresse(adresse) {
  const a = String(adresse || '').trim().toLowerCase();
  const i = a.lastIndexOf('@');
  if (i < 1) return 'autre';
  const d = a.slice(i + 1);
  for (const [id, re] of DOMAINES) if (re.test(d)) return id;
  return 'autre';
}
