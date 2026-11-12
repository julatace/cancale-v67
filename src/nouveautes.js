// ═══════════════════════════════════════════════════════════════════════════
// « QUOI DE NEUF » — les nouveautés de VRM, versionnées dans le dépôt (11 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « plus beau, simple, surtout PRATIQUE ». Après une mise en ligne, une
// petite carte en haut de Ma journée (« Nouveau · 3 nouveautés »), JAMAIS une
// fenêtre bloquante ; elle s'ouvre en feuille : une ligne par nouveauté, « Voir »
// mène à l'écran, « Tout vu » la range. Aussi dans Paramètres → Aide → « Quoi de neuf ».
//
// ⚠️ RÈGLE POUR LA SUITE (CLAUDE.md §9) : chaque lot VISIBLE ajoute SA ligne en
// tête de `NOUVEAUTES` — `scripts/audit-quoi-de-neuf.cjs` vérifie le format :
//   id      unique, [a-z0-9-], jamais réutilisé (l'état « vu » est rangé par id) ;
//   date    'AAAA-MM-JJ', le jour de la mise en ligne, du plus récent au plus ancien ;
//   titre   8 mots au plus ;  phrase  12 mots au plus ;
//   tab     un écran que `?tab=` sait ouvrir (ONGLETS_LIENS d'App.jsx) ;
//   pour    'tous' · 'sneakers' · 'autre' (pas que des sneakers) · 'pro' (micro, société, marge) ;
//   mode    'tous' · 'complet' (un écran que l'affichage Simple ne montre pas).
//
// L'état « vu » : `vrm_nouveautes_vues` = { vues: { [id]: iso } }, dans SYNC_KEYS
// (le même sur tous ses appareils, par compte VRM). Règles PURES : aucune lecture.
// ═══════════════════════════════════════════════════════════════════════════

export const CLE_NOUVEAUTES_VUES = 'vrm_nouveautes_vues';
export const POUR = Object.freeze(['tous', 'sneakers', 'autre', 'pro']);
export const MODES = Object.freeze(['tous', 'complet']);
export const TITRE_MOTS_MAX = 8;
export const PHRASE_MOTS_MAX = 12;

export const NOUVEAUTES = Object.freeze([
  { id: 'publier-partout', date: '2026-11-11', titre: 'Publier partout depuis ton annonce Vinted', phrase: 'Leboncoin, Vestiaire, eBay : chaque réglage, par défaut ou par annonce.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'import-historique-sites', date: '2026-11-11', titre: 'Ton historique Leboncoin, Vestiaire et eBay aussi', phrase: 'Anciennes ventes et achats récupérés, site par site.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'favoris-clair', date: '2026-11-11', titre: 'Messages aux favoris : qui, quoi, quand', phrase: 'Choisis tes annonces, vois l’aperçu et l’offre, puis envoie.', tab: 'favoris', pour: 'tous', mode: 'tous' },
  { id: 'lbc-baisse-prix', date: '2026-11-11', titre: 'Baisser tes prix Leboncoin en série', phrase: 'VRM propose les annonces sans favori ; tu choisis et lances.', tab: 'leboncoin', pour: 'tous', mode: 'tous' },
  { id: 'lbc-remise-main-propre', date: '2026-11-11', titre: 'Remise en main propre organisée', phrase: 'Jour, heure, lieu, rappel une heure avant, puis « Remis ».', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'lbc-republier-atelier', date: '2026-11-11', titre: 'Republier sur Leboncoin comme sur Vinted', phrase: 'Ton ordre, ton rythme, par l’extension ou à la main.', tab: 'leboncoin', pour: 'tous', mode: 'tous' },
  { id: 'vestiaire-parcours', date: '2026-11-11', titre: 'Vestiaire : ta vente étape par étape', phrase: 'Envoyé, arrivé, authentifié, payé : chaque étape lue chez Vestiaire.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'vestiaire-baisse-prix', date: '2026-11-11', titre: 'Baisse tes prix Vestiaire en série', phrase: 'Fais-le une fois à la main : VRM apprend ton geste.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'vestiaire-offres-journee', date: '2026-11-11', titre: 'Tes offres Vestiaire dans Ma journée', phrase: 'Celle qui expire le plus tôt d’abord, avec « Répondre ».', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'creer-vinted', date: '2026-11-11', titre: 'Créer sur Vinted depuis une fiche', phrase: 'Un brouillon prêt sur Vinted ; c’est toi qui publies.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'suivi-travail', date: '2026-11-11', titre: 'Pendant que VRM travaille, tu vois tout', phrase: 'Une barre, chaque étape, pause ou arrêt quand tu veux.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'sante-comptes', date: '2026-11-11', titre: 'La santé de chaque compte Vinted', phrase: 'Note, envois, annulations : « En forme » ou « À surveiller ».', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'photos-comptes', date: '2026-11-11', titre: 'La même photo sur deux comptes', phrase: 'VRM te montre les photos en double entre tes comptes Vinted.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'tva-marge', date: '2026-11-11', titre: 'TVA sur marge : ta déclaration prête', phrase: 'Vente par vente, avec les ventes à compléter. Export CSV et PDF.', tab: 'invoices', pour: 'pro', mode: 'tous' },
  { id: 'achats-email-sites', date: '2026-11-11', titre: 'Achats Leboncoin, eBay, Vestiaire lus par e-mail', phrase: 'Tes confirmations d’achat arrivent : un toucher les ajoute.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'vinted-pro-comptes', date: '2026-11-11', titre: 'Tes comptes Vinted Pro reconnus', phrase: 'Pro seulement si Vinted le dit, et leur argent compté juste.', tab: 'vintedaccounts', pour: 'pro', mode: 'tous' },
  { id: 'ebay-tous-reglages', date: '2026-11-11', titre: 'eBay : tous les réglages de publication', phrase: 'Enchères, offres, retours, politiques : VRM demande ce qui manque.', tab: 'ebay_annonces', pour: 'tous', mode: 'tous' },
  { id: 'visuels-reseaux', date: '2026-11-11', titre: 'Un visuel pour tes réseaux', phrase: 'Carré ou story, depuis une annonce : partage ou télécharge.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'retours-bordereaux', date: '2026-11-11', titre: 'Tes bordereaux de retour, prêts à imprimer', phrase: 'Tamponnés « RETOUR », avec la date limite et le remboursement.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'retour-pas-a-pas', date: '2026-11-11', titre: 'Un retour, pas à pas', phrase: 'Délais, preuves, dossier PDF, puis le retour au stock.', tab: 'litiges', pour: 'tous', mode: 'tous' },
  { id: 'colis-a-leur-place', date: '2026-11-11', titre: 'Tes colis rangés dans Ventes et Achats', phrase: 'À expédier en tête de Ventes, à retirer en tête d’Achats.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'retirer-lisible', date: '2026-11-11', titre: 'À retirer : le code sur chaque ligne', phrase: 'Code, n° de suivi et itinéraire, sans carte.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'ventes-logo-transporteur', date: '2026-11-11', titre: 'Le logo du transporteur sur chaque vente', phrase: 'Au même endroit, dès que son transporteur est connu.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'impression-thermique', date: '2026-11-11', titre: 'Bordereaux pour ton imprimante thermique', phrase: '10 × 15, Dymo, Brother ou ta taille : choisis le tampon.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'toute-app-hors-ligne', date: '2026-11-11', titre: 'Toute l’app marche sans réseau', phrase: 'Tes gestes attendent et partent au retour du réseau.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'gros-lot-achat', date: '2026-11-11', titre: 'Un lot de N articles, une saisie', phrase: 'Le coût réparti au centime, les fiches et N° en série.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'rangement-guide', date: '2026-11-11', titre: 'Un achat retiré, rangé en un geste', phrase: 'N° et case libre proposés, la fiche déjà remplie.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'livre-registre', date: '2026-11-11', titre: 'Livre des recettes et registre des achats complets', phrase: 'Client, règlement, pièce : par mois, en PDF, CSV ou Excel.', tab: 'compta', pour: 'pro', mode: 'tous' },
  { id: 'alerte-arnaque', date: '2026-11-11', titre: 'Arnaque possible ? VRM te prévient', phrase: 'WhatsApp, faux lien, code SMS : une alerte sur la conversation.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'prix-mini-manquants', date: '2026-11-11', titre: 'Prix mini manquants, saisis en série', phrase: 'Tape le mini de chaque annonce : le bénéfice s’affiche aussitôt.', tab: 'cat_msg', pour: 'tous', mode: 'tous' },
  { id: 'quoi-republier', date: '2026-11-11', titre: 'Quelles annonces republier ?', phrase: 'Anciennes et peu vues, triées : un toucher les coche, tu lances.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'achetes-pas-en-ligne', date: '2026-11-11', titre: 'Achetés, mais pas encore en ligne', phrase: 'Ce qui dort chez toi depuis plus de 14 jours, prouvé.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'alertes-ebay', date: '2026-11-11', titre: 'Alertes d’achat sur tes recherches eBay', phrase: 'Une nouvelle annonce ? VRM te prévient, avec la marge possible.', tab: 'plat_ebay', pour: 'tous', mode: 'tous' },
  { id: 'securite-comptes', date: '2026-11-11', titre: 'Tes comptes protégés, comme par toi', phrase: 'Pas la nuit, pas en rafale, arrêt au premier refus.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'import-depart', date: '2026-11-11', titre: 'Tout ton historique Vinted, relu', phrase: 'Laisse vinted.fr ouvert : ventes et achats arrivent peu à peu.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'stats-categories', date: '2026-11-11', titre: 'Tes statistiques par catégorie', phrase: 'Ventes, vendu et bénéfice, catégorie par catégorie.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'achat-photo-ticket', date: '2026-11-11', titre: 'Un achat en photo du ticket', phrase: 'VRM lit le ticket, tu valides le montant.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'partage-fiche', date: '2026-11-11', titre: 'Partage la fiche d’un article', phrase: 'Un lien avec photos et prix, jamais ton prix d’achat.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'objectif-mois-v2', date: '2026-11-11', titre: 'Ton objectif du mois, en clair', phrase: 'Ce qu’il reste par jour, et si tu es en avance.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'pour-mon-comptable', date: '2026-11-11', titre: 'Pour ton comptable, en un clic', phrase: 'Un dossier zip : récap PDF, tableur et factures du mois.', tab: 'compta', pour: 'pro', mode: 'tous' },
  { id: 'aide-integree', date: '2026-11-11', titre: 'Le « ? » de chaque écran montre comment', phrase: 'Une petite animation, puis des fiches « M’y emmener ».', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'app-installable', date: '2026-11-11', titre: 'Installe VRM sur ton téléphone', phrase: 'Elle s’ouvre aussitôt, comme une vraie app.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'facture-siret', date: '2026-11-11', titre: 'Facture Pro : ton entreprise retrouvée', phrase: 'Tape ton SIRET : VRM retrouve ton entreprise, tu confirmes.', tab: 'invoices', pour: 'pro', mode: 'tous' },
  { id: 'tu-vends-quoi', date: '2026-11-11', titre: 'VRM parle de ce que tu vends', phrase: 'Vêtements, livres, lunettes : les mots et exemples suivent tes articles.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'ebay-sans-pointure', date: '2026-11-11', titre: 'eBay : moins de champs', phrase: 'Seuls les champs utiles à tes articles sont demandés.', tab: 'ebay_annonces', pour: 'autre', mode: 'tous' },
  { id: 'profil-photo', date: '2026-11-11', titre: 'Ta photo ouvre ton menu', phrase: 'Touche ta photo : Paramètres et ton compte sont là.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'offres-auto-sures', date: '2026-11-11', titre: 'Offres auto plus sûres', phrase: 'Une jauge, un arrêt en deux gestes, réponses depuis l’onglet Vinted.', tab: 'favoris', pour: 'tous', mode: 'complet' },
  { id: 'republier-main', date: '2026-11-11', titre: 'Republier à la main, en trois gestes', phrase: '« Vinted ↗ » copie aussi la description.', tab: 'republier', pour: 'tous', mode: 'complet' },
  { id: 'cree-par-vrm', date: '2026-11-11', titre: 'Une petite mention sur tes bordereaux', phrase: '« Créé par vrm.center », seulement là où il reste de la place.', tab: 'cat_bord', pour: 'tous', mode: 'tous' },
  { id: 'dates-versement', date: '2026-11-11', titre: 'Les dates de versement arrivent plus vite', phrase: 'Laisse vinted.fr ouvert : l’extension les relève en quelques jours.', tab: 'argent_declarer', pour: 'pro', mode: 'tous' },
  { id: 'messages-tous', date: '2026-11-11', titre: 'Messages s’ouvre sur toutes tes conversations', phrase: 'Vinted, Leboncoin et Vestiaire ensemble, dès l’ouverture.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'resume-soir-heure', date: '2026-11-11', titre: 'Choisis l’heure du résumé du soir', phrase: 'Entre 18 h et 22 h, dans Paramètres → Notifications.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'import-tableur', date: '2026-11-10', titre: 'Importe tes achats depuis un tableur', phrase: 'Un fichier .csv ou .xlsx : tu vois tout avant d’importer.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'partage-photo', date: '2026-11-10', titre: 'Partage une photo vers VRM', phrase: 'Photos → Partager → VRM ouvre un nouvel achat avec elle.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'chercher-photo', date: '2026-11-09', titre: 'Retrouve un article par sa photo', phrase: 'Dans le Stock, l’appareil photo retrouve l’article et son N°.', tab: 'garage', pour: 'tous', mode: 'complet' },
]);

export const motsDe = (s) => String(s || '').trim().split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
export const lienDe = (n) => `?tab=${encodeURIComponent(n.tab)}`;

// Le jour civil local (AAAA-MM-JJ) d'une date d'inscription ; illisible ⇒ null (pas su).
export function jourDe(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const lireVues = (r) => {
  const v = r && typeof r === 'object' && r.vues && typeof r.vues === 'object' && !Array.isArray(r.vues) ? r.vues : {};
  const out = {};
  for (const k of Object.keys(v)) if (typeof v[k] === 'string') out[k] = v[k];
  return out;
};

// Pour qui, selon ce qu'il vend et son statut. « Pas su » (null) ⇒ on ne montre pas
// une nouveauté qui ne vaut que pour certains (un faux « pour toi » ne sert à rien).
//   vend        'sneakers' | 'autre' | null
//   categories  les tuiles de « Tu vends quoi ? » (null = pas répondu)
//   pro         true | false | null (régime micro, société ou marge)
//   mode        'simple' | 'complet'
export function pourLui(n, { vend = null, categories = null, pro = null, mode = 'complet' } = {}) {
  if (!n) return false;
  if (n.mode === 'complet' && mode === 'simple') return false;
  const cats = Array.isArray(categories) ? categories : null;
  if (n.pour === 'sneakers') return vend === 'sneakers' || !!(cats && cats.includes('sneakers'));
  if (n.pour === 'autre') return vend === 'autre' && !(cats && cats.length === 1 && cats[0] === 'sneakers');
  if (n.pour === 'pro') return pro === true;
  return n.pour === 'tous';
}

// Ce qui le concerne, inscription comprise : un compte ne voit QUE ce qui est arrivé
// APRÈS le jour de son inscription (jamais l'historique) ; date d'inscription pas sue ⇒ rien.
export function nouveautesDuCompte(ctx = {}, liste = NOUVEAUTES) {
  const depuis = jourDe(ctx.inscritLe);
  if (!depuis) return [];
  return liste.filter((n) => n && n.date > depuis && pourLui(n, ctx));
}

// Celles à montrer sur la carte : pas encore vues.
export function nouveautesAVoir(ctx = {}, vuesBrut = null, liste = NOUVEAUTES) {
  const vues = lireVues(vuesBrut);
  return nouveautesDuCompte(ctx, liste).filter((n) => !vues[n.id]);
}

// L'état à ranger après « Vu » (ou « Voir » sur une ligne) : on AJOUTE, on n'efface rien.
export function marquerVues(vuesBrut, ids, at = new Date().toISOString()) {
  const vues = lireVues(vuesBrut);
  for (const id of ids || []) if (typeof id === 'string' && id && !vues[id]) vues[id] = at;
  return { vues };
}

// « 1 nouveauté » / « 3 nouveautés ».
export const libelleNombre = (k) => `${k} nouveauté${k > 1 ? 's' : ''}`;
