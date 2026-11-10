// ══════════════════════════════════════════════════════════════════════════
//  FILTRES ENREGISTRÉS (10 nov., lot X — validé par Julien, proposition 36)
// ══════════════════════════════════════════════════════════════════════════
// Il nomme une combinaison de filtres (plateforme, compte, état, période) et la
// retrouve en UNE puce, sur Ventes, Achats et Colis. Rangés dans SES données :
// la clé synchronisée `vrm_vues_filtres` (ligne `main`, tous ses appareils),
// écrite par un geste annulable (`gesteVrm`, ops « cle ») — jamais le
// `localStorage` seul (l'ancien « Mes vues » des ventes ne quittait pas le
// navigateur).
//
// Forme : { [id]: { e: 'ventes'|'achats'|'colis', nom, f: { site, compte, etat, periode }, at } }
//  · site    : 'toutes' | 'vinted' | 'leboncoin' | 'ebay' | 'vestiaire' (la plateforme) ;
//  · compte  : l'identifiant du compte Vinted choisi ('' = tous) — jamais un pseudo ;
//  · etat    : l'onglet/filtre de l'écran (liste fermée ci-dessous) ou '' ;
//  · periode : { from, to } en ISO, ou null.
// Rien d'autre n'est rangé (pas de recherche tapée, pas de nom d'acheteur).
// Module PUR : exécuté tel quel par scripts/audit-vues-filtres.cjs.

export const CLE_VUES_FILTRES = 'vrm_vues_filtres';
export const VUES_MAX = 12;          // par écran
export const NOM_MAX = 30;
export const ECRANS_VUES = ['ventes', 'achats', 'colis'];
export const SITES_VUES = ['toutes', 'vinted', 'leboncoin', 'ebay', 'vestiaire'];
// Les états que chaque écran sait appliquer (ceux de l'écran Vinted pour Ventes/Achats,
// les onglets pour Colis). Un état inconnu n'est pas rangé (il serait faux à l'ouverture).
export const ETATS_VUES = {
  ventes: ['all', 'aexpedier', 'transit', 'finalisees', 'annulees'],
  achats: ['attente', 'route', 'recus', 'all'],
  colis: ['envoyer', 'envoyes', 'retirer'],
};
const LIB_ETAT = {
  ventes: { all: 'Toutes', aexpedier: 'À envoyer', transit: 'En route', finalisees: 'Finalisées', annulees: 'Annulées' },
  achats: { attente: 'À retirer', route: 'En route', recus: 'Arrivés', all: 'Tous' },
  colis: { envoyer: 'À envoyer', envoyes: 'Envoyés', retirer: 'À retirer' },
};
const LIB_SITE = { toutes: 'Tous les sites', vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };

const isoOk = (v) => { if (v == null || v === '') return null; const t = new Date(v).getTime(); return Number.isFinite(t) ? new Date(t).toISOString() : undefined; };

// La combinaison PROPRE (ou null si elle ne peut pas être rangée telle quelle).
// L'état et la période ne valent que pour Vinted (Ventes, Achats) : ailleurs ils
// ne s'appliqueraient pas — on ne range pas une promesse qu'on ne tient pas.
export function filtresPropres(f, ecran) {
  if (!f || typeof f !== 'object' || !ECRANS_VUES.includes(ecran)) return null;
  const site = SITES_VUES.includes(f.site) ? f.site : null;
  if (!site) return null;
  const compte = f.compte == null ? '' : String(f.compte);
  if (compte.length > 40 || !/^[\w.-]*$/.test(compte) || compte === '*') return null;
  const etatsOk = ETATS_VUES[ecran];
  const etat = f.etat == null ? '' : String(f.etat);
  if (etat && !etatsOk.includes(etat)) return null;
  let periode = null;
  if (f.periode && (f.periode.from || f.periode.to)) {
    const from = isoOk(f.periode.from), to = isoOk(f.periode.to);
    if (from === undefined || to === undefined) return null;
    if (from && to && from > to) return null;
    periode = { from, to };
  }
  const vinted = site === 'vinted';
  return {
    site,
    compte: ecran === 'colis' ? '' : compte,
    etat: ecran === 'colis' ? etat : (vinted ? etat : ''),
    periode: ecran === 'colis' || !vinted ? null : periode,
  };
}

// Les vues d'UN écran, dans l'ordre où il les a créées (au plus VUES_MAX).
export function vuesDe(map, ecran) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
  const out = [];
  for (const [id, v] of Object.entries(map)) {
    if (!v || typeof v !== 'object' || v.e !== ecran) continue;
    const nom = typeof v.nom === 'string' ? v.nom.trim() : '';
    if (!nom || nom.length > NOM_MAX) continue;
    const f = filtresPropres(v.f, ecran);
    if (!f) continue;
    out.push({ id, nom, f, at: Number(v.at) || 0 });
  }
  out.sort((a, b) => (a.at - b.at) || (a.id < b.id ? -1 : 1));
  return out.slice(0, VUES_MAX);
}

const egalPeriode = (a, b) => (!a && !b) || (!!a && !!b && (a.from || null) === (b.from || null) && (a.to || null) === (b.to || null));
export const memesFiltres = (a, b) => !!a && !!b && a.site === b.site && (a.compte || '') === (b.compte || '') && (a.etat || '') === (b.etat || '') && egalPeriode(a.periode, b.periode);

// La vue qui correspond EXACTEMENT aux filtres affichés (sa puce est « appuyée »).
export function vueActive(vues, courant, ecran) {
  const c = filtresPropres(courant, ecran);
  if (!c) return null;
  const v = (vues || []).find((x) => memesFiltres(x.f, c));
  return v ? v.id : null;
}

// Ajouter : les ops du geste (src/gesteAnnulable.js) ou la raison du refus, dite.
export function opsAjoutVue(map, ecran, nom, filtres, { id, at }) {
  const titre = String(nom || '').trim().replace(/\s+/g, ' ');
  if (!titre) return { erreur: 'Donne un nom.' };
  if (titre.length > NOM_MAX) return { erreur: `${NOM_MAX} lettres au plus.` };
  const f = filtresPropres(filtres, ecran);
  if (!f) return { erreur: 'Ces filtres ne peuvent pas être enregistrés.' };
  const vues = vuesDe(map, ecran);
  if (vues.length >= VUES_MAX) return { erreur: `Déjà ${VUES_MAX} filtres : supprimes-en un.` };
  if (vues.some((v) => v.nom.toLocaleLowerCase('fr') === titre.toLocaleLowerCase('fr'))) return { erreur: 'Ce nom existe déjà.' };
  if (vues.some((v) => memesFiltres(v.f, f))) return { erreur: 'Ces filtres sont déjà enregistrés.' };
  if (!id || (map && map[id])) return { erreur: 'Réessaie.' };
  return { ops: [{ k: CLE_VUES_FILTRES, type: 'cle', id, apres: { e: ecran, nom: titre, f, at }, avant: undefined }] };
}

export function opsSupprimerVue(map, id) {
  if (!map || !id || !map[id]) return [];
  return [{ k: CLE_VUES_FILTRES, type: 'cle', id, apres: undefined, avant: map[id] }];
}

// Ce que la puce redit sous son nom (court) : « Vinted · compte_a · À envoyer · 1 → 30 oct. ».
export function resumeFiltres(f, ecran, nomCompte = () => '') {
  if (!f) return '';
  const jour = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '…';
  const morceaux = [LIB_SITE[f.site] || ''];
  if (f.compte) morceaux.push(nomCompte(f.compte) || 'un compte');
  if (f.etat) morceaux.push((LIB_ETAT[ecran] || {})[f.etat] || '');
  if (f.periode) morceaux.push(`${jour(f.periode.from)} → ${jour(f.periode.to)}`);
  return morceaux.filter(Boolean).join(' · ');
}
