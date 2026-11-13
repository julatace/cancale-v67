// ════════════════════════════════════════════════════════════════════════════
//  LES SCÉNARIOS DES VIDÉOS DU « ? » (13 nov., lot 49) — un par écran principal,
//  30 s au plus, LE geste principal de l'écran, joué pour de vrai dans l'app
//  (touchers réels, lettres tapées une à une). Titres courts = sous-titres
//  incrustés (et recopiés dans la piste `.vtt` par aide-videos.cjs).
//  Monde INVENTÉ : `_monde.cjs` (et `_monde-emails.cjs` pour E-mails).
//  Chaque scénario finit sur un plan posé (pas de carton de fin : c'est de l'aide).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const { monde } = require('./_monde.cjs');
const { mondeEmails } = require('./_monde-emails.cjs');

// La typographie française : espace insécable avant « : ? ! ; » et dans les guillemets
// (un titre ne se coupe jamais avant ses deux-points ; la scène ne coupe pas l'insécable).
const nb = (s) => String(s || '').replace(/ ([:?!;»])/g, ' $1').replace(/« /g, '« ');
async function debut(f, titre, sous, duree = 3.4) {
  if (!f._nb) { const t = f.titre.bind(f); f.titre = (x, o = {}) => t(nb(x), { ...o, sous: o.sous ? nb(o.sous) : '' }); f._nb = true; }
  f.telY = f.F.h; f.telOpacite = 0;
  f.titre(titre, { sous, duree });
  await f.jouer(0.3);
  await f.entree(1.0);
  await f.jouer(0.5);
  // L'aperçu (l'image de la rangée « Regarder ») : l'écran posé, son titre lisible.
  f.cle('apercu');
}
async function finir(f, dur = 1.2) { f.repos_(0.8); await f.jouer(dur); }

const SCENARIOS = {
  // Ma journée : le plus pressé en haut ; une ligne touchée ouvre son geste.
  async journee(f) {
    await debut(f, 'Ta journée : le plus pressé en haut.', 'Un geste par ligne, dans l’ordre.');
    await f.viser('[data-tuile="envoyer"]', { zoom: 1.38, dur: 1.0 });
    await f.jouer(1.6); f.cle('plan');
    f.titre('Ce que tu as vendu, reçu, gagné.', { duree: 3.2 });
    await f.defilerVers('[data-fu-case="vendu-mois"]', { marge: 300, dur: 0.9 });
    await f.viser('[data-fu-case="vendu-mois"]', { zoom: 1.38, dur: 0.9 });
    await f.jouer(2.0); f.cle('chiffres');
    f.titre('Puis la suite : un geste par ligne.', { sous: 'Colis à retirer, messages, prix à baisser.', duree: 3.8 });
    await f.defilerVers('[data-tuile="retirer"]', { marge: 200, dur: 1.0 });
    await f.viser('[data-tuile="messages"]', { zoom: 1.3, dur: 0.9 });
    await f.jouer(2.2); f.cle('ensuite');
    f.repos_(0.8);
    await f.defilerVers('[data-tuile="envoyer"]', { marge: 220, dur: 1.0 });
    f.titre('Touche une ligne : son geste s’ouvre.', { duree: 3.4 });
    await f.viser('[data-tuile="envoyer"]', { zoom: 1.38, dur: 0.8 });
    await f.toucher('[data-fu-principal]', { apres: 0.3 });
    await f.attendreQue('[data-lot-ouvrir]', 4);
    f.repos_(0.8);
    f.titre('Tes colis à envoyer, prêts à imprimer.', { duree: 3.4 });
    await f.jouer(0.6);
    await f.viser('[data-lot-ouvrir]', { zoom: 1.38, dur: 1.0, dy: 120 });
    await f.jouer(2.0); f.cle('geste');
    await finir(f, 1.0);
  },
  // Ventes : « À expédier » → Tout imprimer → l'aperçu, le N° tamponné → Imprimer.
  async ventes(f) {
    await debut(f, 'Ventes : en haut, ce qui part.', 'Les colis à envoyer, de tous tes sites.');
    await f.viser('[data-lot-ouvrir]', { zoom: 1.38, dur: 1.0, dy: 140 });
    await f.jouer(1.6); f.cle('plan');
    f.titre('Tout imprimer, d’un geste.', { duree: 3.0 });
    await f.toucher('[data-lot-ouvrir]', { apres: 0.4 });
    await f.attendreQue('[data-lot-section="partent"]', 4);
    f.repos_(0.8);
    await f.jouer(1.4); f.cle('feuille');
    f.titre('Coche ce qui part.', { sous: 'L’aperçu montre le N° de chaque paire.', duree: 4.0 });
    await f.defilerVers('[data-lot-section="apercu"]', { marge: 80, dur: 0.9 });
    await f.viser('[data-lot-apercu="81001"]', { zoom: 1.45, zmax: 1.45, dur: 1.1 });
    await f.jouer(1.8); f.cle('apercu-lot');
    f.repos_(0.8); await f.jouer(0.3);
    await f.toucher('texte:Imprimer (2)', { avant: 0.4, apres: 0.4 });
    await f.attendreQue('[data-placeur-tampon="pret"]', 6);
    f.titre('Le N° est tamponné sur le bordereau.', { sous: 'Tu emballes la bonne paire, sans hésiter.', duree: 4.6 });
    await f.jouer(0.3);
    await f.viser('[data-tampon-scene]', { zoom: 1.38, dur: 1.1, part: [0, 0, 1, 0.45] });
    await f.jouer(2.4); f.cle('tampon');
    f.repos_(0.8); await f.jouer(0.3);
    f.titre('Imprimer : c’est prêt.', { duree: 2.8 });
    await f.toucher('[data-tampon-imprimer]', { avant: 0.4, apres: 0.6 });
    await f.jouer(1.2); f.cle('imprime');
    await finir(f, 0.6);
  },
  // Colis à retirer (Achats) : un point relais = une carte → le code → copier → en grand.
  async colis(f) {
    await debut(f, 'Tes colis à retirer, par point relais.', 'Le code de chacun, sans fouiller tes messages.', 3.6);
    await f.defilerVers('texte:Relais du Marché', { marge: 60, dur: 1.0 });
    await f.viser('texte:Relais du Marché', { zoom: 1.3, dur: 1.0, dy: 130 });
    await f.jouer(1.8); f.cle('plan');
    f.titre('Touche un colis : tout s’affiche.', { duree: 3.2 });
    await f.toucher('1@[data-rp-comptoir]', { apres: 0.5 });
    await f.viser('[aria-label^="Copier code de retrait"]', { zoom: 1.38, dur: 0.9, dy: 60 });
    await f.jouer(1.2); f.cle('deplie');
    f.titre('Copier le code.', { duree: 2.4 });
    await f.toucher('[aria-label^="Copier code de retrait"]', { apres: 0.8 });
    f.titre('Le code en *grand*, au comptoir.', { sous: 'Il se lit de loin.', duree: 5.4 });
    await f.toucher('[data-colis-plein-ecran]', { avant: 0.36, apres: 0.3 });
    f.repos_(1.0);
    await f.jouer(1.0);
    await f.viser('texte:Code de retrait', { zoom: 1.38, dur: 1.0, dy: 30 });
    await f.jouer(2.2); f.cle('en-grand');
    await finir(f, 0.8);
  },
  // Achats : « + Ajouter » un achat de brocante → titre, prix, lieu, N° → enregistré.
  async achats(f) {
    await debut(f, 'Tes achats Vinted arrivent seuls.', 'Une brocante, un magasin ? Tu l’ajoutes.');
    await f.defilerVers('texte:Achats hors plateforme', { marge: 260, dur: 1.2 });
    await f.viser('texte:Achats hors plateforme', { zoom: 1.38, dur: 0.9 });
    await f.jouer(0.8); f.cle('plan');
    f.titre('« + *Ajouter* » un achat.', { duree: 2.6 });
    await f.toucher('texte:+ Ajouter', { apres: 0.4 });
    f.titre('Ce que tu as acheté, et son prix.', { duree: 5.0 });
    await f.defilerVers('[data-champ="titre"]', { marge: 140, dur: 0.8 });
    await f.viser('[data-champ="titre"]', { zoom: 1.3, dur: 0.8, dy: 60 });
    await f.toucher('[data-champ="titre"]', { avant: 0.3, apres: 0.2 });
    await f.taper('Adidas Gazelle verte T41', { cps: 16 });
    await f.toucher('[data-champ="prix"]', { avant: 0.3, apres: 0.2 });
    await f.taper('25', { cps: 6 });
    await f.toucher('[data-source="Brocante"]', { avant: 0.3, apres: 0.4 });
    f.cle('saisie');
    f.titre('Son N° de rangement : c’est rangé.', { sous: 'Son prix devient le coût de la paire.', duree: 4.6 });
    await f.toucher('texte:Prendre le N°45', { avant: 0.36, apres: 0.5 });
    await f.toucher('[data-achat-hors-enregistrer]', { avant: 0.4, apres: 0.6 });
    await f.attendreQue('texte:Adidas Gazelle verte T41', 3);
    f.titre('Ajouté à tes achats.', { duree: 3.0 });
    await f.defilerVers('texte:Adidas Gazelle verte T41', { marge: 260, dur: 1.0 });
    await f.viser('texte:Adidas Gazelle verte T41', { zoom: 1.3, dur: 0.9 });
    await f.jouer(1.6); f.cle('ajoute');
    await finir(f, 0.8);
  },
  // Annonces : chaque annonce avec son N° → les détails : prix d'achat, marge, gestes.
  async annonces(f) {
    await debut(f, 'Tes annonces, chacune avec son N°.', 'Le même N° que sur sa boîte.');
    await f.defilerVers('[data-carte-annonce="7115"]', { marge: 120, dur: 1.2 });
    await f.viser('[data-carte-annonce="7115"]', { zoom: 1.38, dur: 1.0 });
    await f.jouer(1.4); f.cle('plan');
    f.titre('Touche la flèche : ses détails.', { duree: 3.0 });
    await f.toucher('[aria-label^="Détails et gestes — N°16"]', { apres: 0.4, clic: true });
    await f.attendreQue('[data-fiche-achat]', 2);
    f.repos_(0.8);
    await f.defilerVers('[data-fiche-achat]', { marge: 260, dur: 0.9 });
    f.titre('Prix d’achat, marge : ce que tu gagnes.', { sous: 'Le prix d’achat se change d’un toucher.', duree: 4.6 });
    await f.viser('[data-fiche-achat]', { zoom: 1.38, dur: 1.0, dy: 60 });
    await f.jouer(2.6); f.cle('fiche');
    f.titre('Et ses gestes : prix, stock, ailleurs.', { duree: 3.4 });
    await f.viser('[data-fiche-gestes]', { zoom: 1.38, dur: 1.0 });
    await f.jouer(2.4); f.cle('gestes');
    await finir(f, 0.8);
  },
  // Stock : taper un N° → le meuble et la case ; ranger une paire.
  async garage(f) {
    await debut(f, 'Où est rangée une paire ?', 'Tape son N° : VRM dit le meuble et la case.', 3.6);
    await f.defilerVers('[data-stock-recherche]', { marge: 220, dur: 1.0 });
    await f.viser('[data-stock-recherche]', { zoom: 1.38, dur: 0.8 });
    await f.toucher('[data-stock-recherche]', { avant: 0.3, apres: 0.2 });
    await f.taper('7', { cps: 4 });
    await f.jouer(0.6); f.cle('plan');
    f.titre('Le N°7 : Couloir, rangée 2.', { duree: 3.4 });
    f.repos_(0.8);
    await f.jouer(2.6); f.cle('trouve');
    f.titre('Une paire à ranger ?', { sous: 'Touche-la, puis une case libre.', duree: 6.4 });
    // La croix vide la recherche : les meubles reviennent entiers.
    await f.toucher('button[aria-label="Effacer la recherche"]', { avant: 0.3, apres: 0.3, clic: true });
    await f.defilerVers('texte:À ranger', { marge: 40, dur: 1.0 });
    await f.toucher('button[aria-label^="Ranger l’article N°12"]', { viser: { zoom: 1.35, dur: 0.8 }, apres: 0.3, clic: true });
    await f.defilerVers('[data-meuble="m2"]', { marge: 120, dur: 0.9 });
    await f.viser('[data-meuble="m2"]', { zoom: 1.35, dur: 0.8 });
    await f.toucher('[data-case-ici="m2:4"]', { apres: 0.7, clic: true });
    await f.viser('[data-case-ici="m2:4"]', { zoom: 1.7, zmax: 1.7, dur: 0.9 });
    await f.jouer(1.2); f.cle('rangee');
    await finir(f, 0.8);
  },
  // Argent : Déclarer → le montant du mois (daté au versement) → Copier → « J'ai déclaré ».
  async compta(f) {
    await debut(f, 'Ton argent : vendu, reçu, gagné.', 'Et ce qu’il te reste à déclarer.');
    await f.viser('texte:À déclarer', { zoom: 1.38, dur: 1.0, dy: 30 });
    await f.jouer(1.6); f.cle('plan');
    f.titre('*Déclarer* : le montant du mois.', { sous: 'Daté au jour du versement.', duree: 4.4 });
    f.repos_(0.7);
    await f.toucher('texte:Déclarer', { apres: 0.5 });
    await f.viser('texte:Chiffre d’affaires', { zoom: 1.38, dur: 1.0, dy: 40 });
    await f.jouer(1.8); f.cle('montant');
    f.titre('Copie-le, recopie-le sur l’URSSAF.', { duree: 3.2 });
    await f.toucher('texte:Copier', { avant: 0.4, apres: 1.0 });
    await f.jouer(0.6);
    f.titre('Puis « J’ai déclaré » : tu notes le montant.', { sous: 'Le mois est rangé, le suivant prend sa place.', duree: 6.0 });
    await f.viser('texte:Ouvrir l’URSSAF', { zoom: 1.38, dur: 0.9 });
    await f.toucher('texte:J’ai déclaré', { avant: 0.4, apres: 0.8 });
    f.repos_(0.9);
    await f.jouer(0.6);
    await f.toucher('input[placeholder^="ex. 1"]', { avant: 0.3, apres: 0.2 });
    await f.taper('1643,90', { cps: 10 });
    f.cle('declare');
    await f.toucher('texte:Enregistrer', { avant: 0.4, apres: 1.2 });
    await finir(f, 0.8);
  },
  // Messages : la liste, un fil ouvert, la paire (N°, rangement), l'offre et ce qu'elle laisse.
  async messages(f) {
    await debut(f, 'Tes messages, de tous tes sites.', 'Les non lus portent un point bleu.');
    await f.viser('[aria-label="Ouvrir le fil lucie_r"]', { zoom: 1.3, dur: 1.0, dy: 60 });
    await f.jouer(1.4); f.cle('plan');
    f.titre('Ouvre une conversation.', { duree: 2.6 });
    await f.toucher('[aria-label="Ouvrir le fil lucie_r"]', { apres: 0.8 });
    f.repos_(0.6);
    f.titre('La paire, son N°, où elle est rangée.', { duree: 3.8 });
    await f.jouer(0.4);
    await f.viser('texte:Couloir', { zoom: 1.38, dur: 1.0, dy: -20 });
    await f.jouer(2.2); f.cle('paire');
    f.titre('Une offre ? VRM dit si tu y perds.', { sous: 'Ton prix d’achat, les frais : le seuil est là.', duree: 4.8 });
    f.repos_(0.8);
    await f.viser('texte:tu perds de l’argent', { zoom: 1.38, dur: 1.0 });
    await f.jouer(3.0); f.cle('offre');
    f.titre('Tu réponds sur ton clic, depuis ton navigateur.', { duree: 3.4 });
    await f.viser('texte:Répondre sur Vinted', { zoom: 1.3, dur: 0.9 });
    await f.jouer(2.4);
    await finir(f, 0.8);
  },
  // E-mails : la boîte rangée → copier un code → « Codes » → ouvrir un e-mail.
  async emails(f) {
    await debut(f, 'Les e-mails de tes plateformes, rangés.', 'Codes, bordereaux, ventes, offres.');
    await f.viser('0@[data-boite-email]', { zoom: 1.3, dur: 1.0, dy: 60 });
    await f.jouer(1.4); f.cle('plan');
    f.titre('Un code de retrait ? Copié d’un geste.', { duree: 3.6 });
    await f.viser('[data-boite-code-copier="259036"]', { zoom: 1.38, dur: 0.8 });
    await f.toucher('[data-boite-code-copier="259036"]', { apres: 1.0 });
    f.cle('copie');
    f.titre('Trie d’un toucher : les codes seulement.', { duree: 3.6 });
    f.repos_(0.8);
    await f.toucher('[data-boite-rubrique="codes"]', { apres: 1.2 });
    f.cle('codes');
    f.titre('Touche un e-mail : l’essentiel en haut.', { sous: 'Le code, le lieu, la date limite.', duree: 5.0 });
    await f.toucher('[data-boite-quoi="Colis à retirer"]', { apres: 0.8 });
    f.repos_(0.8);
    await f.jouer(3.0); f.cle('ouvert');
    await finir(f, 0.8);
  },
  // Réglages : chercher un réglage par son nom → l'ouvrir.
  async settings(f) {
    await debut(f, 'Tes réglages : comptes, e-mails, extension.', 'Un réglage, une phrase.');
    await f.defilerVers('[data-recherche-reglages]', { marge: 200, dur: 1.0 });
    await f.viser('[data-recherche-reglages]', { zoom: 1.38, dur: 0.8 });
    await f.jouer(0.6); f.cle('plan');
    f.titre('Cherche-le par son nom.', { duree: 4.0 });
    await f.toucher('[data-recherche-reglages] input', { avant: 0.3, apres: 0.2 });
    await f.taper('vacances', { cps: 9 });
    f.repos_(0.8);
    await f.jouer(1.4); f.cle('cherche');
    f.titre('Touche-le : il s’ouvre.', { sous: 'Ici : tes comptes en pause pendant ton absence.', duree: 5.0 });
    await f.toucher('texte:Mode vacances', { apres: 0.8 });
    f.repos_(0.8);
    await f.jouer(3.0); f.cle('ouvert');
    await finir(f, 0.8);
  },
};

// Écrans à ouvrir AVANT le tournage (ils publient ce que lit l'écran filmé) et leur monde.
const PLATEAUX = {
  journee: { tab: 'journee' },
  ventes: { tab: 'ventes' },
  colis: { tab: 'achats' },
  achats: { tab: 'achats' },
  annonces: { tab: 'annonces' },
  // Annonces d'abord : c'est l'écran qui publie les preuves de vente que le Stock lit.
  garage: { tab: ['annonces', 'garage'] },
  // Ventes d'abord : c'est l'écran qui publie le CA daté au versement.
  compta: { tab: ['cat_ventes', 'ventes', 'compta'] },
  messages: { tab: 'messages' },
  emails: { tab: 'emails', monde: mondeEmails },
  settings: { tab: 'settings' },
};
for (const k of Object.keys(PLATEAUX)) PLATEAUX[k].monde = PLATEAUX[k].monde || monde;

module.exports = { SCENARIOS, PLATEAUX };
