// ════════════════════════════════════════════════════════════════════════════
//  « TES DONNÉES » — CE QUE VRM LIT, GARDE ET FAIT, EN CLAIR (8 nov., confiance)
// ════════════════════════════════════════════════════════════════════════════
// Julien (8 nov.) : « des vendeurs vont payer et doivent avoir confiance ». Une
// page de Paramètres → Mon compte → Tes données, en français simple.
//
// ⚠️ CHAQUE PHRASE EST UNE PROMESSE. Elle dit ce que fait le CODE, pas ce qu'on
//    voudrait : chaque ligne porte `preuve` — le fichier et le morceau de code qui
//    la tiennent. `scripts/audit-confiance.cjs` vérifie que chaque preuve existe,
//    ET juge les règles elles-mêmes (le plafond de l'extension est bien le nombre
//    écrit ici ; aucune commande de l'app ne supprime une annonce Vinted ; les
//    sites que l'extension peut ouvrir sont tous nommés ici ; le serveur tourne
//    bien à Dublin). Changer le code sans changer la phrase ⇒ rouge.
//    Ce qu'on ne peut pas prouver par le code ne s'écrit pas (ex. : « l'extension
//    ne clique jamais » serait FAUX — elle remplit les formulaires de dépôt
//    Leboncoin, eBay et Vestiaire que tu lui demandes de remplir).
// ════════════════════════════════════════════════════════════════════════════

const EXT = 'vinted-sync-extension/background.js';

// Le plafond d'actions de l'extension, par heure et par compte (§3, sa décision
// du 29 oct.). L'audit le relit dans `background.js` (`ACTIONS_MAX_HEURE`).
export const PLAFOND_ACTIONS_HEURE = 50;
// Le plafond des suppressions Leboncoin demandées depuis VRM (`LBC_SUPPRIME_MAX_HEURE`).
export const PLAFOND_SUPPRESSIONS_LBC = 10;

// Les sites que l'extension a le droit d'ouvrir (son manifeste) : TOUS doivent
// être ici, avec la raison dite à l'écran. Un site ajouté au manifeste sans être
// nommé ici ⇒ l'audit est rouge.
export const SITES_EXTENSION = [
  { motif: /(^|\.)vinted\.(fr|com|it|de|net)$/, nom: 'Vinted' },
  { motif: /(^|\.)leboncoin\.fr$/, nom: 'Leboncoin' },
  { motif: /(^|\.)vestiairecollective\.com$/, nom: 'Vestiaire Collective' },
  { motif: /(^|\.)ebay\.(fr|com)$/, nom: 'eBay' },
  { motif: /^(www\.)?mondialrelay\.(fr|be)$|^(ws|www)\.chronopost\.fr$|^(carrier\.)?vintedgo\.com$/, nom: 'les transporteurs (suivi de tes colis)' },
  { motif: /(^|\.)amazonaws\.com$/, nom: 'les serveurs de photos et de bordereaux de ces sites' },
  { motif: /^lgonxzrzjcqthjtbdpzo\.supabase\.co$/, nom: 'ta base VRM' },
  { motif: /^(vrm\.center|cancale-v67-ten\.vercel\.app)$/, nom: 'VRM' },
];

// ── Ce que VRM lit, site par site ───────────────────────────────────────────
export const CE_QUE_VRM_LIT = [
  { id: 'vinted', titre: 'Vinted', detail: 'Tes annonces, ventes, achats, conversations et offres, bordereaux, relevé du porte-monnaie et avis reçus — lus par l’extension quand tu ouvres Vinted dans ton navigateur.',
    preuve: [[EXT, 'async function capterReleves'], [EXT, 'async function capterAvis'], [EXT, 'async function recupererLabel']] },
  { id: 'leboncoin', titre: 'Leboncoin', detail: 'Tes annonces, ventes, conversations, et le nombre de favoris et de vues de tes annonces.',
    preuve: [[EXT, 'rangerLbcFil'], [EXT, 'noterStatsAnnonceLbc']] },
  { id: 'vestiaire', titre: 'Vestiaire Collective', detail: 'Tes annonces, ventes, achats, conversations et offres reçues.',
    preuve: [[EXT, 'rangerVcFil'], [EXT, 'rangerVcOffres'], [EXT, 'rangerVcAchats']] },
  { id: 'ebay', titre: 'eBay', detail: 'Tes annonces, commandes et messages, par la connexion officielle d’eBay que tu as autorisée.',
    preuve: [['api/ebay.js', "mode=callback"]] },
  { id: 'emails', titre: 'Tes e-mails', detail: 'Seulement ceux que tu fais suivre à VRM : ventes, bordereaux, codes de retrait, suivis de colis.',
    preuve: [['api/email-inbound.js', 'export default']] },
];
export const CE_QUE_VRM_NE_LIT_PAS = 'L’extension n’a accès qu’aux sites nommés ci-dessus. Elle ne lit ni les autres sites, ni ton historique de navigation.';

// ── Ce que l'extension fait, et quand ───────────────────────────────────────
export const GESTES = [
  { id: 'seule', titre: 'Toute seule', lignes: [
    { id: 'lire', texte: 'Lire tes pages de Vinted, Leboncoin et Vestiaire quand tu les ouvres.', preuve: [[EXT, 'async function visiteVinted']] },
    { id: 'bordereaux', texte: 'Récupérer le PDF des bordereaux de tes ventes.', preuve: [[EXT, 'async function recupererLabel']] },
  ] },
  { id: 'allume', titre: 'Seulement si tu l’as allumé', pied: 'Éteint au départ. Tu l’allumes et l’éteins toi-même.', lignes: [
    { id: 'offres', texte: 'Accepter une offre Vinted au-dessus du prix mini que tu as posé, refuser sous ton seuil.', preuve: [[EXT, 'm.vinted_offres_auto === true']] },
    { id: 'favoris', texte: 'Écrire aux personnes qui ont mis ton annonce en favori.', preuve: [['api/_lib/favoris-auto.js', 'Confirme l’allumage du mode automatique.']] },
    { id: 'ebay', texte: 'Retirer d’eBay une paire vendue ailleurs (fait par le serveur VRM).', preuve: [['src/ecrans/Ebay.jsx', "load('vrm_ebay_retrait_auto', false) === true"]] },
  ] },
  { id: 'clic', titre: 'Jamais sans ton clic', lignes: [
    { id: 'repondre', texte: 'Répondre à un acheteur, faire, accepter ou refuser une offre.', preuve: [[EXT, 'const EXEC_PERMIS = [']] },
    { id: 'telephone', texte: 'Depuis ton téléphone, accepter une offre te demande de confirmer.', preuve: [[EXT, "'confirmation': 'ce geste vend la paire"]] },
    { id: 'republier', texte: 'Republier une annonce Vinted : c’est toi qui choisis les paires et qui lances.', preuve: [[EXT, 'async function recreerVinted']] },
    { id: 'publier', texte: 'Publier sur Leboncoin, préparer sur eBay ou Vestiaire.', preuve: [[EXT, 'async function publierVestiaire']] },
    { id: 'supprimer-lbc', texte: `Supprimer une annonce Leboncoin, après confirmation, ${PLAFOND_SUPPRESSIONS_LBC} par heure au plus.`, preuve: [[EXT, 'async function supprimeLbcDepuisApp']] },
    { id: 'repondre-autres', texte: 'Envoyer un message sur Leboncoin ou Vestiaire.', preuve: [[EXT, 'async function repondreLeboncoin'], [EXT, 'async function repondreVestiaire']] },
  ] },
  { id: 'jamais', titre: 'Jamais', lignes: [
    { id: 'supprimer-vinted', texte: 'Supprimer une annonce Vinted en dehors de « Republier ».', preuve: [[EXT, 'const EXEC_PERMIS = [']] },
    { id: 'autre-compte', texte: 'Agir sur un autre compte que celui ouvert dans ton onglet.', preuve: [[EXT, 'async function gardeStricte']] },
    { id: 'plafond', texte: `Dépasser ${PLAFOND_ACTIONS_HEURE} actions par heure sur un compte.`, preuve: [[EXT, 'const ACTIONS_MAX_HEURE =']] },
    { id: 'frein', texte: 'Insister quand Vinted demande de ralentir : elle s’arrête.', preuve: [[EXT, 'poserPauseVinted']] },
  ] },
];

// ── Où c'est rangé, qui y a accès ───────────────────────────────────────────
// La région de la base : MESURÉE (adresse du serveur `aws-0-eu-west-1`, Postgres
// 17.6 — docs/passation/2026-11-06-sauvegarde-prix.md), et dite pareil dans la
// politique de confidentialité. Le serveur : `vercel.json` → `regions: ["dub1"]`.
export const STOCKAGE = [
  { id: 'base', titre: 'Ta base VRM', detail: 'Chez Supabase, en Irlande (Union européenne). Tes données, et les sessions de tes comptes de revente que l’extension utilise pour agir.',
    preuve: [['docs/passation/2026-11-06-sauvegarde-prix.md', 'eu-west-1'], ['public/legal/confidentialite.html', 'région eu-west-1']] },
  { id: 'serveur', titre: 'Le serveur VRM', detail: 'Chez Vercel, à Dublin. Il range tes e-mails, envoie tes rappels et tes notifications.',
    preuve: [['vercel.json', '"dub1"']] },
  { id: 'appareil', titre: 'Ton navigateur', detail: 'L’extension garde sur ton ordinateur ses compteurs et les 15 derniers gestes.',
    preuve: [[EXT, 'vrmActivity: cur.slice(0, 15)']] },
];
export const ACCES = [
  { id: 'toi', titre: 'Toi', detail: 'Ta base ne rend tes lignes qu’à ta session.', preuve: [['supabase/migrations/001-multi-utilisateurs.sql', 'using (owner = auth.uid())']] },
  { id: 'aide', titre: 'Un aide, si tu en invites un', detail: 'Il voit les colis et les codes de retrait, aucun montant.', preuve: [['src/App.jsx', 'const CE_QUE_VOIT_UN_MEMBRE']] },
  { id: 'serveur', titre: 'Le serveur VRM', detail: 'Pour les tâches que tu as activées : e-mails, rappels, notifications, eBay.', preuve: [['api/_lib/cle-service.js', 'SUPABASE_SERVICE_KEY']] },
  { id: 'editeur', titre: 'L’éditeur de VRM', detail: 'Seulement à ta demande (assistance), pour la sécurité ou si la loi l’exige.', preuve: [['public/legal/confidentialite.html', 'Personne ne les lit, sauf à ta demande']] },
  { id: 'personne', titre: 'Personne d’autre', detail: 'Tes données ne sont ni vendues, ni utilisées pour de la publicité.', preuve: [['public/legal/confidentialite.html', 'ni vendues']] },
];

// Toutes les preuves d'un coup (pour l'audit).
export function toutesLesPreuves() {
  const out = [];
  const prendre = (id, p) => { for (const [fichier, cherche] of p || []) out.push({ id, fichier, cherche }); };
  for (const x of CE_QUE_VRM_LIT) prendre('lit:' + x.id, x.preuve);
  for (const g of GESTES) for (const l of g.lignes) prendre(g.id + ':' + l.id, l.preuve);
  for (const x of STOCKAGE) prendre('stockage:' + x.id, x.preuve);
  for (const x of ACCES) prendre('acces:' + x.id, x.preuve);
  return out;
}
