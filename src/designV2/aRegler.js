// ════════════════════════════════════════════════════════════════════════════
//  « À RÉGLER » — où va chaque chose à faire (19 nov., décision de Julien, mot pour mot : « tout ça ne sert à rien,
//  ça doit être rangé dans les onglets dédiés justement à ça. Par exemple les litiges dans les ventes, ou les retours
//  en cours, pas forcément en plein milieu de ma journée »). Puis : « l'outil doit être pratique, pas chiant ».
//
//  AUCUNE RÈGLE ICI (§5 : un seul propriétaire par notion). Les groupes sont ceux que « Aujourd'hui » calcule déjà
//  (les cartes `jobs` de Ma journée, leur nombre, LEUR geste) : cet écran PUBLIE, les onglets CONSOMMENT. Ce module :
//    1. dit dans QUEL onglet va un groupe (`ongletDe` : par son identifiant, sinon par l'écran que son geste ouvre) ;
//    2. regroupe « sans numéro », « sans prix mini », « sans prix d'achat » en UNE rangée « Compléter mes annonces »
//       (ce ne sont pas des alertes) ;
//    3. garde la dernière publication en mémoire (avec les gestes), et un résumé sur l'appareil pour que l'onglet
//       rouvert directement (l'app reprend sur le dernier écran) ne soit pas vide : au plus 12 h, son geste est alors
//       « ouvrir l'écran » ; dès qu'Aujourd'hui recalcule, la publication fraîche le remplace.
//  « Pas su » ne vaut pas « rien » : sans publication (ni fraîche ni gardée), `lireARegler()` rend `null` — le bloc ne
//  s'affiche pas et la pastille n'ajoute rien (jamais un 0 inventé).
// ════════════════════════════════════════════════════════════════════════════

export const ONGLETS_A_REGLER = ['ventes', 'achats', 'annonces', 'stock', 'messages', 'argent', 'sante'];
export const CLE_A_REGLER = 'vrm_a_regler_v1';
export const AGE_MAX_MS = 12 * 3600000;
const EVT = 'vrm:a-regler';

// L'onglet d'un groupe, par son identifiant (la partie avant « : »).
const PAR_ID = {
  // Ventes : ce qui part, ce qui revient, ce qui se discute.
  'colis-limite': 'ventes', 'poste-sans-depart': 'ventes', 'ebay-ne-pas-poster': 'ventes', 'colis-en-retard': 'ventes',
  'a-confirmer': 'ventes', 'retours-vente': 'ventes', 'retours-vente-revenus': 'ventes', 'remettre-en-vente': 'ventes',
  'prix-achat-vente': 'ventes', 'double-vente': 'ventes', 'vestiaire-envoyer': 'ventes',
  // Achats : ce qui arrive.
  'achats-a-numeroter': 'achats', 'atelier-arrivee': 'achats', 'atelier-attente': 'achats',
  'retrait-a-verifier': 'achats', 'retrait-en-verification': 'achats', 'retrait-dernier-jour': 'achats',
  // Annonces.
  'sans-numero': 'annonces', 'numeros-a-donner': 'annonces', 'numeros-republiee': 'annonces', 'numeros-en-double': 'annonces',
  'achat-a-relier': 'annonces', 'prix-mini-manquants': 'annonces', 'prix': 'annonces', 'paires-dorment': 'annonces',
  'quoi-republier': 'annonces', 'supprime-vinted': 'annonces', 'meme-photo': 'annonces',
  // Stock.
  'inventaire-en-cours': 'stock', 'numeros-nouveaux': 'stock',
  // Messages : la pastille de Messages (plus une rangée).
  'messages': 'messages', 'messages-ebay': 'messages', 'vestiaire-messages': 'messages', 'vestiaire-offre': 'messages', 'vestiaire-offres-reste': 'messages',
  // Argent.
  'urssaf': 'argent', 'cloture-annee': 'argent',
  // « Tout va bien ? » (Paramètres).
  'a-trancher': 'sante', 'emails-personne': 'sante',
};
// Sinon, l'écran que son geste ouvre.
const PAR_ECRAN = [
  [/^(cat_ventes|cat_bord|cat_expedition|ventes|litiges)$/, 'ventes'],
  [/^(achats|retraits)$/, 'achats'],
  [/^(annonces|vinted_annonces|republier)$/, 'annonces'],
  [/^(garage|inventaire)$/, 'stock'],
  [/^(messages|favoris)$/, 'messages'],
  [/^(compta|dashboard|urssaf|factures)$|^argent/, 'argent'],
];
// Ce que la pastille de l'onglet compte DÉJÀ (les colis à envoyer sur Ventes, à retirer sur Achats, les annonces sans
// numéro sur Annonces) : un groupe qui redit ces mêmes colis n'ajoute rien à la pastille (un colis se compte une fois).
const DEJA_DANS_LA_PASTILLE = new Set(['colis-limite', 'poste-sans-depart', 'colis-en-retard', 'ebay-ne-pas-poster', 'vestiaire-envoyer',
  'retrait-a-verifier', 'retrait-en-verification', 'retrait-dernier-jour', 'sans-numero', 'numeros-en-double', 'double-vente', 'completer']);
// « Compléter mes annonces » : trois manques, UNE rangée (ce ne sont pas des alertes).
export const SUJETS_COMPLETER = { 'sans-numero': 'numero', 'prix-mini-manquants': 'prixMini', 'achat-a-relier': 'prixAchat' };

export const racineId = (id) => String(id == null ? '' : id).split(':')[0];
export function ongletDe(g) {
  if (!g) return 'sante';
  const r = racineId(g.id);
  if (r === 'litige') return g.sens === 'achat' ? 'achats' : 'ventes';
  if (PAR_ID[r]) return PAR_ID[r];
  const ecran = String(g.tab || '');
  for (const [re, o] of PAR_ECRAN) if (re.test(ecran)) return o;
  return 'sante';
}

// Les groupes d'UN onglet, prêts à montrer : « Compléter » fusionné, l'urgent d'abord (l'ordre reçu sinon).
// `ouvrirCompleter` (l'atelier « Compléter », branché à l'intégration) : s'il n'est pas là, le geste est celui du premier manque.
export function groupesDe(onglet, groupes, { completer = null, titreCompleter = (n) => String(n) } = {}) {
  const l = (groupes || []).filter((g) => g && (g.onglet || ongletDe(g)) === onglet);
  if (onglet !== 'annonces') return trier(l);
  const manques = l.filter((g) => SUJETS_COMPLETER[racineId(g.id)]);
  if (!manques.length) return trier(l);
  const n = manques.reduce((t, g) => t + (Number(g.n) > 0 ? Number(g.n) : 0), 0);
  const premier = manques[0];
  const un = { id: 'completer', onglet, icone: 'pencil', n: n || null, titre: titreCompleter(n), detail: '', ambre: false, photo: null, tab: premier.tab || 'annonces',
    sujets: manques.map((g) => SUJETS_COMPLETER[racineId(g.id)]),
    geste: { txt: (premier.geste && premier.geste.txt) || '', faire: () => { if (typeof completer === 'function') return completer({ sujet: SUJETS_COMPLETER[racineId(premier.id)] }); if (premier.geste && typeof premier.geste.faire === 'function') return premier.geste.faire(); return undefined; } } };
  return trier([...l.filter((g) => !SUJETS_COMPLETER[racineId(g.id)]), un]);
}
const trier = (l) => l.map((g, i) => [g, i]).sort((a, b) => (b[0].ambre ? 1 : 0) - (a[0].ambre ? 1 : 0) || a[1] - b[1]).map((x) => x[0]);

// Ce que la pastille de l'onglet AJOUTE à ce qu'elle compte déjà : un par groupe, sauf ceux qu'elle compte déjà.
export function ajoutPastille(onglet, groupes) {
  return groupesDe(onglet, groupes).filter((g) => !DEJA_DANS_LA_PASTILLE.has(racineId(g.id))).length;
}

// ── La publication ───────────────────────────────────────────────────────────
let etat = null;          // { at, frais: true|false, groupes: [...] } | null (jamais publié, rien de gardé)
let branche = { naviguer: null, completer: null, uid: '' };
let ecritA = 0, gardeLue = false;
// Une ligne par vendeur de l'appareil : les rangées de l'un ne se montrent jamais à l'autre.
const cle = () => CLE_A_REGLER + (branche.uid ? ':' + branche.uid : '');
const ecouteurs = new Set();
const dire = () => { for (const f of [...ecouteurs]) { try { f(); } catch (_) { /* un lecteur cassé ne tait pas les autres */ } } try { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT)); } catch (_) {} };
const resume = (g) => ({ id: String(g.id), onglet: g.onglet || ongletDe(g), icone: g.icone || '', titre: String(g.titre || ''), detail: String(g.detail || ''), n: g.n == null ? null : Number(g.n), ambre: !!g.ambre,
  photo: typeof g.photo === 'string' ? g.photo : null, tab: g.tab || '', gesteTxt: (g.geste && g.geste.txt) || '', sens: g.sens || undefined });
const signature = (l) => JSON.stringify((l || []).map(resume));

// La coque dit comment ouvrir un écran (les rangées gardées d'une session précédente n'ont plus leur geste) et, quand
// il existe, l'atelier « Compléter ».
export function brancherARegler({ naviguer, completer, uid } = {}) {
  if (naviguer !== undefined) branche.naviguer = naviguer;
  if (completer !== undefined) branche.completer = completer;
  if (uid !== undefined && String(uid || '') !== branche.uid) { branche.uid = String(uid || ''); etat = null; ecritA = 0; gardeLue = false; dire(); }
}
export const atelierCompleter = () => branche.completer;

// Aujourd'hui publie SES groupes (chacun avec son geste). Même contenu ⇒ rien n'est redit (aucun rendu en boucle).
export function publierARegler(groupes, maintenant = Date.now()) {
  const l = (groupes || []).filter((g) => g && g.id).map((g) => ({ ...g, onglet: g.onglet || ongletDe(g) }));
  const meme = !!etat && etat.frais && signature(etat.groupes) === signature(l);
  // Même contenu : on garde l'objet publié (les lecteurs ne sont pas réveillés), ses gestes sont rafraîchis en place.
  if (meme) { etat.groupes.forEach((g, i) => { g.geste = l[i].geste; }); if (maintenant - ecritA < 10 * 60000) return; }
  else etat = { at: maintenant, frais: true, groupes: l };
  ecritA = maintenant;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(cle(), JSON.stringify({ at: maintenant, g: l.map(resume) })); } catch (_) { /* stockage bloqué : la mémoire suffit pour la session */ }
  if (!meme) dire();
}

// Le résumé gardé sur l'appareil (au plus 12 h) : le geste d'une rangée gardée OUVRE son écran.
function lireGarde(maintenant) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const v = JSON.parse(localStorage.getItem(cle()) || 'null');
    if (!v || !Array.isArray(v.g) || !Number.isFinite(Number(v.at)) || maintenant - Number(v.at) > AGE_MAX_MS || Number(v.at) > maintenant + 60000) return null;
    return { at: Number(v.at), frais: false, groupes: v.g.filter((g) => g && g.id && g.titre).map((g) => ({ ...g,
      geste: g.tab ? { txt: g.gesteTxt || '', faire: () => { if (typeof branche.naviguer === 'function') branche.naviguer(g.tab); } } : null })) };
  } catch (_) { return null; }
}
export function lireARegler(maintenant = Date.now()) {
  if (!etat && !gardeLue) { gardeLue = true; etat = lireGarde(maintenant); }   // une seule lecture de l'appareil, pas à chaque rendu
  return etat;
}
export function abonnerARegler(f) { ecouteurs.add(f); return () => { ecouteurs.delete(f); }; }
// (bancs, déconnexion) Tout oublier : un autre vendeur sur le même appareil ne voit pas les rangées du précédent.
export function oublierARegler() { etat = null; ecritA = 0; gardeLue = true; try { if (typeof localStorage !== 'undefined') localStorage.removeItem(cle()); } catch (_) {} dire(); }
