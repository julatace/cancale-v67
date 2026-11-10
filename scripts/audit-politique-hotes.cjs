// AUDIT « POLITIQUE DE CONFIDENTIALITÉ ↔ HÔTES CONTACTÉS PAR LE NAVIGATEUR »
// (22 octobre, relecture du chantier « carte »).
// Le défaut : en remplaçant la ligne « Nominatim, CARTO » par OpenFreeMap, la
// politique a perdu la seule ligne qui disait que l'écran ACHATS envoie, depuis
// TON navigateur, l'adresse de chaque point relais à la Base Adresse Nationale
// et à Nominatim (géocodage automatique à chaque ouverture). Rien ne liait le
// code à la politique : une déclaration vraie est partie sans que rien ne crie.
// Ce contrôle relit TOUTES les adresses https:// écrites dans le CODE de src/
// (commentaires retirés) et exige que chaque couple (fichier, hôte) soit dans
// une liste FERMÉE, avec sa raison :
//   · « politique » : le navigateur contacte cet hôte tout seul (fetch, image,
//     script, tuiles) ⇒ la politique doit avoir une ligne qui NOMME le service,
//     dit À QUOI il sert ici (l'écran) et QUI envoie (« ton navigateur » / ton
//     adresse IP) — juger le seul nom du service serait vert sur le défaut
//     (Nominatim restait nommé, pour la communauté seulement) ;
//   · « lien » : une adresse que la personne OUVRE d'un clic (rien ne part tout
//     seul) ; « vrm » : VRM lui-même ; « eteint » : chargé seulement quand un
//     réglage l'allume (dit, pas exigé).
// Un couple inconnu ⇒ ROUGE : un nouvel hôte appelé par le navigateur se
// déclare (politique + cette liste), il ne passe pas en silence.
// `--prouve` réaffaiblit la politique ou le code : chaque mutation ⇒ ROUGE.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// ── Ce que la politique doit dire, par usage ────────────────────────────────
const SERVICE = {
  'api-adresse.data.gouv.fr': /Base Adresse Nationale/,
  'nominatim.openstreetmap.org': /Nominatim/,
  'tiles.openfreemap.org': /OpenFreeMap/,
  'cdn.discordapp.com': /Discord/,
  'cdn.jsdelivr.net': /jsDelivr/,
  'lgonxzrzjcqthjtbdpzo.supabase.co': /Supabase/,
  'ws.chronopost.fr': /Chronopost/,
  'carrier.vintedgo.com': /Vinted Go/,
  'www.mondialrelay.fr': /Mondial Relay/,
  // (5 nov.) les icônes de site des transporteurs (src/transporteursVisuels.js, PastilleTransporteur)
  'www.chronopost.fr': /Chronopost/,
  'www.laposte.fr': /La Poste/,
  'vintedgo.com': /Vinted Go/,
  'www.relaiscolis.com': /Relais Colis/,
  'www.dpd.fr': /DPD/,
  'www.ups.com': /UPS/,
  'gls-group.com': /GLS/,
  'www.colisprive.com': /Colis Privé/,
  'inpost.fr': /InPost/,
  'www.dhl.com': /DHL/,
  'www.fedex.com': /FedEx/,
};
const USAGES = {
  achats: { quoi: 'géocodage automatique des points relais (écran Achats)', role: /points? relais/i, donnee: /navigateur/i },
  ville: { quoi: 'recherche de ville de la carte de la communauté (repli du navigateur)', role: /communaut/i, donnee: /navigateur/i },
  fond: { quoi: 'fond de la carte de la communauté (tuiles)', role: /carte de la communaut/i, donnee: /adresse IP/i },
  avatar: { quoi: 'photos de profil Discord sur la carte', role: /communaut/i, donnee: /navigateur|adresse IP/i },
  pdfjs: { quoi: 'aperçu des bordereaux (pdf.js)', role: /pdf\.js|aperçu des bordereaux/i, donnee: /navigateur|adresse IP/i },
  ort: { quoi: 'détourage du Studio photo (onnxruntime)', role: /Studio photo|onnxruntime/i, donnee: /navigateur|adresse IP/i },
  base: { quoi: 'la base de données de VRM', role: /./, donnee: /./ },
  // (5 nov.) deux outils de plus chargés de jsDelivr par le navigateur, et les logos des transporteurs.
  zxing: { quoi: 'lecture du code-barres d’un colis à la caméra (ZXing, src/ScannerColis.jsx)', role: /ZXing/, donnee: /navigateur|adresse IP/i },
  tesseract: { quoi: 'lecture d’un ticket de dépense photographié (Tesseract, src/depensesTicket.js)', role: /Tesseract/, donnee: /navigateur|adresse IP/i },
  logos: { quoi: 'logo du transporteur (icône de son site, src/transporteursVisuels.js)', role: /logo du transporteur/i, donnee: /navigateur/i },
  // (24 oct.) Le statut public d'un colis, lu par le SERVEUR (Chronopost, Vinted Go).
  transp: { quoi: 'statut public des colis, lu par le serveur', role: /statut public des colis/i, donnee: /n° de suivi[\s\S]*serveur VRM/i },
  // (24 oct., suite) Mondial Relay lu par le SERVEUR (route `_mvc`) : n° ET code postal.
  transpmr: { quoi: 'statut public des colis Mondial Relay, lu par le serveur (n° + code postal)', role: /statut public des colis/i, donnee: /code postal[\s\S]*serveur VRM/i },
};
// ── La liste FERMÉE des couples (fichier, hôte) écrits dans le code ─────────
const LIEN = 'lien ouvert d’un clic par la personne (rien ne part tout seul)';
const COUPLES = {
  'src/App.jsx|api-adresse.data.gouv.fr': ['politique', 'achats'],
  'src/App.jsx|nominatim.openstreetmap.org': ['politique', 'achats'],
  // (1er nov.) La carte des points relais (Colis → À retirer, Tournée) géocode par la même BAN, depuis le navigateur.
  'src/CarteRelais.jsx|api-adresse.data.gouv.fr': ['politique', 'achats'],
  'src/App.jsx|cdn.jsdelivr.net': ['politique', 'pdfjs'],
  'src/studioPhoto.js|cdn.jsdelivr.net': ['politique', 'ort'],
  'src/communaute/Communaute.jsx|api-adresse.data.gouv.fr': ['politique', 'ville'],
  'src/fondCarte.js|tiles.openfreemap.org': ['politique', 'fond'],
  'src/communaute/avatarDiscord.js|cdn.discordapp.com': ['politique', 'avatar'],
  'src/App.jsx|lgonxzrzjcqthjtbdpzo.supabase.co': ['politique', 'base'],
  'src/App.jsx|vrm.center': ['vrm', 'VRM lui-même'],
  'src/captcha.js|challenges.cloudflare.com': ['eteint', 'Turnstile : chargé seulement quand la clé de site est posée — la politique devra alors citer Cloudflare (Turnstile)'],
  'src/fondCarte.js|openfreemap.org': ['lien', 'lien de l’attribution de la carte'],
  'src/fondCarte.js|www.openmaptiles.org': ['lien', 'lien de l’attribution de la carte'],
  'src/fondCarte.js|www.openstreetmap.org': ['lien', 'lien de l’attribution de la carte'],
  'src/App.jsx|discord.com': ['lien', 'connexion Discord : le navigateur y va sur le clic de la personne'],
  'src/communaute/Communaute.jsx|discord.com': ['lien', 'connexion Discord : le navigateur y va sur le clic de la personne'],
  'src/photoroomCle.js|app.photoroom.com': ['lien', LIEN + ' — créer sa clé Photoroom (carte « Ta clé Photoroom »)'],
  'src/photoroomCle.js|www.photoroom.com': ['lien', LIEN + ' — les tarifs de Photoroom (même carte)'],
  'src/App.jsx|supabase.com': ['lien', LIEN],
  'src/agendaEcheances.js|calendar.google.com': ['lien', LIEN + ' — « Ajouter à Google Agenda » (le lien de SON calendrier)'],
  'src/LivrePoliceCarte.jsx|entreprendre.service-public.gouv.fr': ['lien', LIEN + ' — la fiche officielle du livre de police'],
  'src/LivrePoliceCarte.jsx|www.legifrance.gouv.fr': ['lien', LIEN + ' — les articles R321-1 et suivants'],
  'src/communaute/formateur.js|vrm.center': ['vrm', 'VRM lui-même (adresse de la page publique du formateur)'],
  'src/raccourcisSiri.js|vrm.center': ['vrm', 'VRM lui-même (les liens à copier dans Raccourcis)'],
  'src/profilFiscal.js|www.service-public.gouv.fr': ['lien', LIEN + ' — la fiche officielle du statut (Ma configuration)'],
  'src/profilFiscal.js|entreprendre.service-public.gouv.fr': ['lien', LIEN + ' — la fiche officielle du statut (Ma configuration)'],
  'src/profilFiscal.js|www.autoentrepreneur.urssaf.fr': ['lien', LIEN + ' — le site de l’URSSAF (Ma configuration)'],
  'src/relaisChange.js|maps.apple.com': ['lien', LIEN + ' — « Itinéraire » vers le nouveau point relais (adresse lue dans l’e-mail)'],
  'src/relaisChange.js|www.google.com': ['lien', LIEN + ' — « Itinéraire » (Google Maps) vers le nouveau point relais'],
  'src/App.jsx|vercel.com': ['lien', LIEN],
  'src/App.jsx|www.autoentrepreneur.urssaf.fr': ['lien', LIEN],
  'src/App.jsx|fr.vestiairecollective.com': ['lien', LIEN],
  'src/App.jsx|www.chronopost.fr': ['lien', LIEN],
  'src/App.jsx|www.ebay.fr': ['lien', LIEN],
  'src/App.jsx|www.google.com': ['lien', LIEN],
  'src/App.jsx|www.leboncoin.fr': ['lien', LIEN],
  'src/App.jsx|www.mondialrelay.fr': ['lien', LIEN],
  'src/App.jsx|www.vinted.fr': ['lien', LIEN],
  'src/OutilsArticlesVinted.jsx|www.vinted.fr': ['lien', LIEN],
  'src/EnLigneDeuxFois.jsx|www.vinted.fr': ['lien', LIEN + ' — « Ouvrir sur Vinted » l’annonce en trop (Ma journée, « en ligne deux fois »)'],
  'src/SynchronisationVinted.jsx|www.vinted.fr': ['lien', LIEN],
  'src/ebayGestion.jsx|www.ebay.fr': ['lien', LIEN],
  'src/ConfigurerTransfert.jsx|mail.google.com': ['lien', LIEN],
  'src/ConfigurerTransfert.jsx|outlook.live.com': ['lien', LIEN],
  'src/ConfigurerTransfert.jsx|www.icloud.com': ['lien', LIEN],
  // (8 nov.) « Ton adresse VRM » : le pas-à-pas ouvre la messagerie choisie, sur son clic.
  'src/adresseReception.js|mail.google.com': ['lien', LIEN],
  'src/adresseReception.js|www.icloud.com': ['lien', LIEN],
  'src/adresseReception.js|outlook.live.com': ['lien', LIEN],
  'src/adresseReception.js|mail.yahoo.com': ['lien', LIEN],
  // (10 nov.) « Recevoir tes e-mails Vinted dans VRM » : Orange et Free, sur son clic.
  'src/adresseReception.js|mail.orange.fr': ['lien', LIEN],
  'src/adresseReception.js|zimbra.free.fr': ['lien', LIEN],
  'src/navigateurExtension.js|play.google.com': ['lien', LIEN],
  'src/Tournee.jsx|maps.apple.com': ['lien', LIEN + ' — « Ouvrir dans Plans » d’un point de retrait'],
  // Une origine SENTINELLE en `.invalid` (RFC 6761 : ne se résout jamais) quand
  // le domaine Vinted reçu n'est pas reconnu — rien ne part.
  'src/favorisVinted.js|invalide.invalid': ['vrm', 'origine sentinelle .invalid, jamais contactée'],
  // (5 nov.) Hôtes écrits depuis le 24 oct. sans être déclarés ici.
  // Contactés TOUT SEULS par le navigateur ⇒ une ligne de la politique :
  'src/ScannerColis.jsx|cdn.jsdelivr.net': ['politique', 'zxing'],
  'src/depensesTicket.js|cdn.jsdelivr.net': ['politique', 'tesseract'],
  'src/transporteursVisuels.js|www.chronopost.fr': ['politique', 'logos'],
  'src/transporteursVisuels.js|www.mondialrelay.fr': ['politique', 'logos'],
  'src/transporteursVisuels.js|www.laposte.fr': ['politique', 'logos'],
  'src/transporteursVisuels.js|vintedgo.com': ['politique', 'logos'],
  'src/transporteursVisuels.js|www.relaiscolis.com': ['politique', 'logos'],
  'src/transporteursVisuels.js|www.dpd.fr': ['politique', 'logos'],
  'src/transporteursVisuels.js|www.ups.com': ['politique', 'logos'],
  'src/transporteursVisuels.js|gls-group.com': ['politique', 'logos'],
  'src/transporteursVisuels.js|www.colisprive.com': ['politique', 'logos'],
  'src/transporteursVisuels.js|inpost.fr': ['politique', 'logos'],
  'src/transporteursVisuels.js|www.dhl.com': ['politique', 'logos'],
  'src/transporteursVisuels.js|www.fedex.com': ['politique', 'logos'],
  // Liens ouverts d'un clic (rien ne part tout seul) :
  'src/AchatsOutils.jsx|www.vinted.fr': ['lien', LIEN + ' — « Publier sur Vinted » (valeur par défaut de lienPublier)'],
  'src/OffresVestiaire.jsx|fr.vestiairecollective.com': ['lien', LIEN + ' — « Répondre sur Vestiaire ↗ »'],
  'src/annulationsCompte.js|www.vinted.fr': ['lien', LIEN + ' — la conversation ou la transaction annulée'],
  'src/dac7Comptes.js|www.vinted.fr': ['lien', LIEN + ' — Vinted → Informations fiscales'],
  'src/dac7Comptes.js|assistance.leboncoin.info': ['lien', LIEN + ' — l’aide Leboncoin sur DAC7'],
  'src/histoireArticle.js|www.vinted.fr': ['lien', LIEN + ' — l’annonce, dans l’historique d’un article'],
  'src/histoireArticle.js|www.ebay.fr': ['lien', LIEN + ' — l’annonce eBay, dans l’historique d’un article'],
  'src/litiges.js|www.ebay.fr': ['lien', LIEN + ' — « Répondre sur eBay » d’un retour'],
  'src/litiges.js|www.vinted.fr': ['lien', LIEN + ' — la conversation ou la transaction du litige'],
  'src/prixPartout.js|www.vinted.fr': ['lien', LIEN + ' — « À faire sur le site » de Changer le prix'],
  'src/prixPartout.js|www.ebay.fr': ['lien', LIEN + ' — l’annonce eBay de Changer le prix'],
  'src/prixPartout.js|www.leboncoin.fr': ['lien', LIEN + ' — l’annonce Leboncoin de Changer le prix'],
  'src/prixPartout.js|fr.vestiairecollective.com': ['lien', LIEN + ' — Vestiaire, « À faire sur le site »'],
  'src/communaute/accompagnement.js|vrm.center': ['vrm', 'VRM lui-même (origine par défaut du lien d’invitation)'],
  'src/smsColis.js|vrm.center': ['vrm', 'VRM lui-même (adresse de la route SMS à coller dans Raccourcis)'],
  // (8 nov.) App.jsx découpé (src/ecrans/*.jsx) : le code a DÉMÉNAGÉ sans changer, chaque
  // couple ci-dessous a été relu à sa ligne (un <a href>, un `lien` de pied « … ↗ », une
  // table d'adresses ouverte d'un clic) — aucun n'est contacté tout seul par le navigateur.
  'src/ecrans/Compta.jsx|www.autoentrepreneur.urssaf.fr': ['lien', LIEN + ' — « Déclarer sur autoentrepreneur.urssaf.fr »'],
  'src/ecrans/Reglages.jsx|www.autoentrepreneur.urssaf.fr': ['lien', LIEN],
  'src/ecrans/Ebay.jsx|www.ebay.fr': ['lien', LIEN + ' — Finances eBay'],
  'src/ecrans/Ebay.jsx|www.vinted.fr': ['lien', LIEN + ' — l’annonce Vinted de la même paire'],
  'src/ecrans/Leboncoin.jsx|www.leboncoin.fr': ['lien', LIEN + ' — la transaction Leboncoin (générer le bordereau)'],
  'src/ecrans/Leboncoin.jsx|www.vinted.fr': ['lien', LIEN + ' — l’annonce Vinted d’origine'],
  'src/ecrans/MessagesLeboncoin.jsx|www.leboncoin.fr': ['lien', LIEN + ' — « Répondre sur Leboncoin ↗ » / « Ouvrir sur Leboncoin ↗ »'],
  'src/ecrans/Reglages.jsx|www.vinted.fr': ['lien', LIEN + ' — Comptes : « Ouvrir » le site du compte (URL_SITE_COMPTE)'],
  'src/ecrans/Reglages.jsx|fr.vestiairecollective.com': ['lien', LIEN + ' — Comptes : « Ouvrir » le site du compte'],
  'src/ecrans/Reglages.jsx|www.leboncoin.fr': ['lien', LIEN + ' — Comptes : « Ouvrir » le site du compte'],
  'src/ecrans/Reglages.jsx|www.ebay.fr': ['lien', LIEN + ' — Comptes : « Ouvrir » le site du compte'],
  'src/ecrans/Reglages.jsx|vrm.center': ['vrm', 'VRM lui-même (le lien privé du widget iPhone)'],
  'src/abonnement/etatAbonnement.js|vrm.center': ['vrm', 'VRM lui-même (le lien de parrainage, 8 nov.)'],
  'src/ecrans/Reglages.jsx|discord.com': ['lien', 'connexion Discord : le navigateur y va sur le clic de la personne'],
  'src/ecrans/Reglages.jsx|vercel.com': ['lien', LIEN],
  'src/ecrans/Republier.jsx|www.vinted.fr': ['lien', LIEN + ' — « compléter sur Vinted » (page de modification de l’annonce)'],
  'src/ecrans/Vestiaire.jsx|www.vinted.fr': ['lien', LIEN + ' — « Ouvrir » l’annonce encore en ligne sur Vinted'],
  'src/ecrans/Vestiaire.jsx|fr.vestiairecollective.com': ['lien', LIEN + ' — « Répondre sur Vestiaire ↗ »'],
  'src/enLigneLbc.js|www.leboncoin.fr': ['lien', LIEN + ' — « Ouvrir « Mes annonces » sur leboncoin.fr ↗ »'],
  // (24 oct.) Le SERVEUR lit le statut public des colis (api/_lib/transporteurs-lecture.js).
  'api/_lib/transporteurs-lecture.js|ws.chronopost.fr': ['politique', 'transp'],
  'api/_lib/transporteurs-lecture.js|carrier.vintedgo.com': ['politique', 'transp'],
  'api/_lib/transporteurs-lecture.js|www.mondialrelay.fr': ['politique', 'transpmr'],
  'api/_lib/transporteurs-lecture.js|lgonxzrzjcqthjtbdpzo.supabase.co': ['politique', 'base'],
  'api/_lib/transporteurs-lecture.js|vrm.center': ['vrm', 'le User-Agent honnête de VRM'],
};
// (24 oct.) Ce que la politique doit dire même si l'hôte n'est pas écrit dans
// ces fichiers : Mondial Relay est AUSSI lu depuis le navigateur, par
// l'extension (sa voie de secours, la même route `_mvc`), quand il refuse le
// serveur — avec le n° ET le code postal.
const DECLARATIONS = [
  { quoi: 'Mondial Relay (secours : statut lu par l’extension, n° + code postal, depuis le navigateur)', service: /Mondial Relay/, role: /statut public des colis/i, donnee: /code postal[\s\S]*(navigateur|extension)/i },
];

function couplesDuCode(fichiers) {
  const out = new Map();
  for (const [rel, texte] of fichiers) {
    sansCommentaires(texte).split('\n').forEach((l, i) => {
      for (const m of l.matchAll(/https:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) {
        const k = rel + '|' + m[1].toLowerCase();
        if (!out.has(k)) out.set(k, []);
        out.get(k).push(i + 1);
      }
    });
  }
  return out;
}
const texteCellule = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function lignesPolitique(html) {
  return [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => texteCellule(c[1]))).filter((c) => c.length >= 3);
}

function juger(fichiers, politique, { muet = false } = {}) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (!muet) console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  const couples = couplesDuCode(fichiers);
  const lignes = lignesPolitique(politique);
  dit(lignes.length > 5, 'le tableau des prestataires de la politique se lit', lignes.length + ' lignes');
  const inconnus = [...couples.keys()].filter((k) => !COUPLES[k]);
  dit(inconnus.length === 0, 'chaque adresse https:// du code est dans la liste fermée (politique · lien · VRM · éteint)', inconnus.map((k) => k + ':' + couples.get(k)[0]).join(' · '));
  for (const [k, [classe, quoi]] of Object.entries(COUPLES)) {
    if (!couples.has(k)) { if (!muet) console.log('ℹ️  ' + k + ' : plus écrit dans le code (rien à exiger)'); continue; }
    if (classe !== 'politique') continue;
    const hote = k.split('|')[1], u = USAGES[quoi], service = SERVICE[hote];
    const ligne = lignes.find((c) => service.test(c[0]) && u.role.test(c[1]) && u.donnee.test(c[2]));
    dit(!!ligne, `${k.split('|')[0]} contacte ${hote} (${u.quoi}) : une ligne de la politique nomme le service, dit à quoi il sert ici et qui l’envoie`, ligne ? '« ' + ligne[1].slice(0, 70) + ' »' : 'aucune ligne');
  }
  for (const d of DECLARATIONS) {
    const ligne = lignes.find((c) => d.service.test(c[0]) && d.role.test(c[1]) && d.donnee.test(c[2]));
    dit(!!ligne, `la politique déclare ${d.quoi}`, ligne ? '« ' + ligne[2].slice(0, 70) + ' »' : 'aucune ligne');
  }
  const eteints = Object.entries(COUPLES).filter(([k, [c]]) => c === 'eteint' && couples.has(k));
  if (!muet) for (const [k, [, quoi]] of eteints) console.log('ℹ️  ' + k + ' : ' + quoi);
  return ko;
}

const SERVEUR = ['api/_lib/transporteurs-lecture.js'];
function lireFichiers() {
  const out = [];
  (function marche(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) marche(p); else if (/\.(jsx?|mjs)$/.test(f)) out.push([path.relative(R, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8')]); } })(path.join(R, 'src'));
  // (24 oct.) + les fichiers SERVEUR qui contactent un tiers au nom du vendeur.
  for (const rel of SERVEUR) { const p = path.join(R, rel); if (fs.existsSync(p)) out.push([rel, fs.readFileSync(p, 'utf8')]); }
  return out;
}

const fichiers = lireFichiers();
const politique = fs.readFileSync(path.join(R, 'public', 'legal', 'confidentialite.html'), 'utf8');
let ko = juger(fichiers, politique);
if (PROUVE) {
  console.log('\n── --prouve : la politique ou le code réaffaibli doit repasser au ROUGE');
  const sansLigne = (motif) => politique.replace(new RegExp('<tr>(?:(?!</tr>)[\\s\\S])*' + motif + '(?:(?!</tr>)[\\s\\S])*</tr>\\s*'), '');
  const MUT = [
    ['la ligne « points relais (écran Achats) » retirée', () => [fichiers, sansLigne('points relais où arrivent tes colis')]],
    ['la ligne Achats dit « le serveur » au lieu du navigateur', () => [fichiers, politique.replace('Adresse du point relais, envoyée par ton navigateur (ton adresse IP)', 'Adresse du point relais, envoyée par le serveur VRM')]],
    ['la ligne jsDelivr retirée', () => [fichiers, sansLigne('jsDelivr')]],
    ['la ligne jsDelivr ne cite plus ZXing ni Tesseract', () => [fichiers, politique.replace(', la lecture du code-barres d’un colis à la caméra quand le téléphone ne sait pas le lire seul (ZXing) et la lecture d’un ticket de dépense photographié (Tesseract)', '')]],
    ['la ligne des logos des transporteurs retirée', () => [fichiers, sansLigne('Afficher le logo du transporteur')]],
    ['la ligne des photos Discord retirée', () => [fichiers, sansLigne('Photo de profil Discord')]],
    ['la ligne Chronopost / Vinted Go retirée', () => [fichiers, sansLigne('Chronopost \\(groupe La Poste\\)')]],
    ['la ligne Mondial Relay ne dit plus le secours par le navigateur', () => [fichiers, politique.replace('envoyés depuis ton navigateur par l’extension VRM', 'envoyés par le serveur VRM')]],
    ['la ligne Mondial Relay ne dit plus que le serveur VRM l’appelle', () => [fichiers, politique.replace('envoyés par le serveur VRM (son adresse IP, pas la tienne) ; en secours, quand Mondial Relay refuse le serveur, ', '')]],
    ['un nouvel hôte contacté par le serveur des transporteurs, non déclaré', () => [fichiers.map(([f, t]) => [f, f === 'api/_lib/transporteurs-lecture.js' ? t + '\nconst sonde = () => fetch(`https://suivi.exemple-tiers.com/v1/x`);\n' : t]), politique]],
    ['un nouvel hôte appelé par le navigateur, non déclaré', () => [fichiers.map(([f, t]) => [f, f === 'src/App.jsx' ? t + '\nconst sonde = () => fetch(`https://api.exemple-tiers.com/v1/x`);\n' : t]), politique]],
  ];
  let prouvees = 0;
  for (const [nom, f] of MUT) {
    const [fi, po] = f();
    if (po === politique && fi === fichiers) { console.log('❌ mutation « ' + nom + ' » : le texte visé n’existe plus'); ko++; continue; }
    const n = juger(fi, po, { muet: true });
    if (n > 0) { prouvees++; console.log(`✅ mutation « ${nom} » ⇒ ${n} contrôle(s) rouge(s)`); }
    else { ko++; console.log(`❌ mutation « ${nom} » : TOUT reste vert — le contrôle ne la voit pas`); }
  }
  console.log(`${prouvees}/${MUT.length} mutations attrapées.`);
}
console.log(ko ? `\n${ko} contrôle(s) rouge(s).` : '\nChaque service que le navigateur contacte tout seul est déclaré dans la politique, avec son usage.');
process.exit(ko ? 1 : 0);
