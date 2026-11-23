// ══════════════════════════════════════════════════════════════════════════
// LE TEMPS QUE VRM TE FAIT GAGNER — la règle du calculateur de la page d'accueil
// publique (11 nov., lot temps-gagne, demande validée par Julien).
// ══════════════════════════════════════════════════════════════════════════
// Le visiteur donne SES chiffres (ventes, achats, comptes, plateformes, baisses de
// prix par semaine) ; la page montre une ESTIMATION des minutes gagnées, geste par
// geste. Fonction pure : aucun réseau, aucune donnée de qui que ce soit.
//
// ⚠️ §2.3 « n'invente jamais de données » : ce ne sont PAS des résultats de clients.
//    Chaque durée ci-dessous est une durée de RÉFÉRENCE, écrite et justifiée ici
//    (`nature` : « raisonnée » = décomposée en gestes à la main ; « mesurée » =
//    chronométrée, avec la date et la façon). Aujourd'hui toutes sont RAISONNÉES :
//    la page le dit (« Estimation »). Jamais de témoignage, de « nos clients
//    gagnent… », de moyenne d'utilisateurs : scripts/audit-temps-gagne.cjs le refuse.
// ⚠️ Prudence voulue : chaque « avec VRM » garde le temps du geste qui reste à faire
//    (vérifier, cliquer, imprimer) ; on ne compte jamais un geste que VRM ne fait pas.
// ⚠️ Changer une durée = changer `pourquoi` dans la même ligne.

// Les bornes des curseurs (et la valeur de départ, un petit revendeur ordinaire).
export const CHAMPS = [
  { id: 'ventes', min: 0, max: 100, pas: 1, depart: 10 },
  { id: 'achats', min: 0, max: 50, pas: 1, depart: 3 },
  { id: 'comptes', min: 1, max: 10, pas: 1, depart: 2 },
  { id: 'plateformes', min: 1, max: 4, pas: 1, depart: 2 },
  { id: 'baisses', min: 0, max: 100, pas: 1, depart: 5 },
];

// `sans` / `avec` : secondes par unité (`par`), à la main puis avec VRM.
export const GESTES = [
  {
    id: 'bordereaux', par: 'vente', sans: 120, avec: 20, nature: 'raisonnée',
    pourquoi: "À la main : ouvrir la vente sur le bon compte, télécharger le bordereau, l'ouvrir, l'imprimer seul, écrire dessus quel article c'est (≈ 2 min). Avec VRM : tous les bordereaux du jour tamponnés du titre et du N°, imprimés en une fois — il reste à les sortir de l'imprimante (≈ 20 s chacun).",
  },
  {
    id: 'numeros', par: 'vente', sans: 60, avec: 10, nature: 'raisonnée',
    pourquoi: "À la main : retrouver dans le stock l'article vendu d'après le titre ou la photo (≈ 1 min, plus quand plusieurs se ressemblent). Avec VRM : le N° de rangement est écrit sur le bordereau et sur la vente, on va droit au carton (≈ 10 s).",
  },
  {
    id: 'urssaf', par: 'vente', sans: 30, avec: 0, nature: 'raisonnée',
    pourquoi: "À la main : recopier chaque vente et la date de son versement dans un tableau pour la déclaration du mois (≈ 30 s par vente). Avec VRM : les ventes sont datées au versement et totalisées par mois ; rien à recopier.",
  },
  {
    id: 'suivi', par: 'colis', sans: 60, avec: 10, nature: 'raisonnée',
    pourquoi: "Un colis = une vente ou un achat de la semaine. À la main : ouvrir le site ou le transporteur, chercher le colis, lire son état (≈ 1 min, une fois). Avec VRM : l'état est dans une seule liste, on le lit (≈ 10 s).",
  },
  {
    id: 'sites', par: 'site', sans: 300, avec: 0, nature: 'raisonnée',
    pourquoi: "Chaque compte en plus du premier (un compte = un site où se connecter). À la main : s'y connecter et faire le tour une fois par jour ouvré, 5 fois par semaine (≈ 1 min × 5). Avec VRM : un seul écran pour tous ; le premier compte n'est pas compté.",
  },
  {
    id: 'codes', par: 'achat', sans: 90, avec: 15, nature: 'raisonnée',
    pourquoi: "À la main : au point relais, retrouver le code de retrait dans les e-mails ou l'application du bon compte (≈ 1 min 30). Avec VRM : les codes sont réunis, même sans réseau (≈ 15 s).",
  },
  {
    id: 'prix', par: 'baisse', sans: 60, avec: 10, nature: 'raisonnée',
    pourquoi: "À la main : ouvrir l'annonce, la modifier, changer le prix, enregistrer (≈ 1 min). Avec VRM : cocher l'annonce dans « Baisser le prix » en série, VRM l'envoie et relit le prix (≈ 10 s).",
  },
];

const borne = (c, v) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return c.depart;
  return Math.min(c.max, Math.max(c.min, n));
};
export const valeursDepart = () => Object.fromEntries(CHAMPS.map((c) => [c.id, c.depart]));
export const valeursBornees = (v = {}) => Object.fromEntries(CHAMPS.map((c) => [c.id, borne(c, v[c.id])]));

// Combien d'unités de chaque sorte, pour ces chiffres.
export function unites(v) {
  const x = valeursBornees(v);
  // Un compte vit sur une plateforme : au moins autant de comptes que de plateformes.
  const sites = Math.max(x.comptes, x.plateformes);
  return { vente: x.ventes, achat: x.achats, colis: x.ventes + x.achats, site: sites - 1, baisse: x.baisses };
}

// Les secondes gagnées par semaine, geste par geste, et le total.
export function tempsGagne(v) {
  const u = unites(v);
  const gestes = GESTES.map((g) => {
    const n = u[g.par] || 0;
    return { id: g.id, par: g.par, n, sans: g.sans, avec: g.avec, secondes: n * (g.sans - g.avec) };
  });
  const secondes = gestes.reduce((s, g) => s + g.secondes, 0);
  return { gestes, secondes };
}

// L'arrondi qu'on affiche : jamais une précision qu'une estimation n'a pas.
// Par semaine, à 5 min près (au-dessous de 5 min : à la minute) ; par mois
// (52 semaines / 12), au quart d'heure près.
export const SEMAINES_PAR_MOIS = 52 / 12;
export function arrondiSemaine(secondes) {
  const m = secondes / 60;
  return m < 5 ? Math.round(m) : Math.round(m / 5) * 5;
}
export const arrondiMois = (secondes) => Math.round((secondes * SEMAINES_PAR_MOIS) / 60 / 15) * 15;

// ── (21 nov., lot journee-stats) LE TEMPS GAGNÉ SUR SES PROPRES GESTES ─────────────────────────────────────────
// « Ce que VRM fait pour toi · Temps gagné » (Statistiques → Pilotage) : chaque geste ACCEPTÉ du journal de VRM
// (`/api/compte?mode=journal`, résultat « ok ») × une durée de RÉFÉRENCE (secondes gagnées = à la main − avec VRM).
// Mêmes règles que le calculateur : durées RAISONNÉES, écrites et justifiées ici ; l'écran dit « estimation ».
// Un type absent de cette table ne compte pour AUCUNE seconde (jamais une durée devinée) et l'écran le dit (« sur N gestes »).
// `de` : la ligne de GESTES dont la durée est reprise telle quelle (une durée, un endroit).
export const GESTES_JOURNAL = [
  { types: ['bordereau'], de: 'bordereaux' },
  { types: ['baisse_prix'], de: 'prix' },
  {
    types: ['favori', 'favori_offre'], sans: 60, avec: 0, nature: 'raisonnée',
    pourquoi: "À la main : ouvrir la notification du favori, ouvrir la conversation, écrire le message, faire l'offre si besoin, envoyer (≈ 1 min). Avec VRM : la file l'envoie seule, rien à faire.",
  },
  {
    types: ['republication'], sans: 300, avec: 30, nature: 'raisonnée',
    pourquoi: "À la main : enregistrer les photos, recopier titre, description, taille, marque, état et prix dans une nouvelle annonce, la publier, supprimer l'ancienne (≈ 5 min). Avec VRM : cocher la paire et lancer (≈ 30 s).",
  },
  {
    types: ['offre_acceptee', 'offre_refusee', 'offre_faite', 'message_envoye'], sans: 30, avec: 0, nature: 'raisonnée',
    pourquoi: "À la main : ouvrir la conversation, lire l'offre ou le message, répondre (≈ 30 s). Avec VRM : la règle qu'il a posée répond seule.",
  },
];
// Les secondes gagnées par UN geste de ce type ; null = type sans durée de référence (pas compté).
export function secondesGeste(type) {
  const g = GESTES_JOURNAL.find((x) => x.types.includes(type));
  if (!g) return null;
  const r = g.de ? GESTES.find((x) => x.id === g.de) : g;
  return r ? Math.max(0, r.sans - r.avec) : null;
}
