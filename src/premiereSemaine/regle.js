// ── « TA PREMIÈRE SEMAINE » (24 nov., lot debutant) — la règle, JS pur ────────────────────────────────────────
// Julien : « tout doit être parfait, imagine un débutant achat-revente qui ne connaît pas du tout le site ».
// UNE carte en tête d'Aujourd'hui pour un compte NEUF, trois étapes prouvées (jamais cochées par un toucher) :
//   1. relier son compte de vente (Vinted, ou Leboncoin / Vestiaire / eBay) — la preuve : la liste des comptes LUE ;
//   2. noter son premier prix d'achat — la preuve : un prix saisi (fiche ou table par N°) ;
//   3. numéroter sa première paire — la preuve : un N° posé sur une fiche.
// Elle disparaît quand les trois sont faites, ou sur « × » (rangé, synchronisé). Aucune fenêtre ne s'ouvre seule,
// rien ne revient la relancer. Tant qu'elle est là, elle REMPLACE les autres cartes de démarrage d'Aujourd'hui
// (« Configure VRM », « Démarrer avec VRM », « Bien démarrer », le conseil du jour) et les visites en bulles ne
// partent pas d'elles-mêmes : une seule chose à faire, un seul bouton plein.
// Trois états partout (§5) : `true` fait · `false` pas fait · `null` pas su (rien de lu ⇒ jamais « fait »).
// Exécuté par scripts/audit-premiere-semaine.cjs.

export const CLE_PREMIERE_SEMAINE = 'vrm_premiere_semaine';
export const ETAPES_SEMAINE = Object.freeze(['compte', 'prix', 'numero']);
export const JOURS_SEMAINE = 30;   // un compte « neuf » : créé il y a 30 jours au plus

// Les étapes, dans l'ordre ; la première pas faite est « courante » (elle seule porte le geste).
export function etapesPremiereSemaine({ compte = null, prix = null, numero = null } = {}) {
  const preuves = { compte, prix, numero };
  const etapes = ETAPES_SEMAINE.map((cle) => ({ cle, etat: preuves[cle] === true ? 'fait' : preuves[cle] === false ? 'afaire' : 'passu' }));
  const courante = etapes.find((e) => e.etat !== 'fait');
  return etapes.map((e) => ({ ...e, courante: !!courante && e.cle === courante.cle }));
}
export const nombreFaitesSemaine = (etapes) => (etapes || []).filter((e) => e.etat === 'fait').length;

// Le réglage rangé : { masque: iso } (« × ») ou { fin: iso } (les trois faites, constaté) — un seul geste, pour toujours.
export function lireReglageSemaine(v) {
  if (!v || typeof v !== 'object') return null;
  const ok = (x) => typeof x === 'string' && !Number.isNaN(Date.parse(x));
  if (ok(v.masque)) return { masque: v.masque };
  if (ok(v.fin)) return { fin: v.fin };
  return null;
}
export const reglageMasqueSemaine = (maintenant = Date.now()) => ({ masque: new Date(maintenant).toISOString() });
export const reglageFinSemaine = (maintenant = Date.now()) => ({ fin: new Date(maintenant).toISOString() });

// Un compte neuf ? `creeLe` (la session Supabase) ; pas su ⇒ non (jamais montrée au hasard à un ancien compte).
export function compteNeuf(creeLe, maintenant = Date.now()) {
  const t = Date.parse(String(creeLe || ''));
  if (!Number.isFinite(t)) return false;
  return maintenant - t >= -3600e3 && maintenant - t <= JOURS_SEMAINE * 86400e3;
}

// La carte est-elle à montrer ? Le propriétaire de l'installation (pas su compris) ne la voit pas ; le mode exemple non plus.
export function premiereSemaineAMontrer({ etapes, reglage = null, proprietaire = null, creeLe = null, exemple = false, maintenant = Date.now() } = {}) {
  if (exemple || proprietaire !== false) return false;
  if (!compteNeuf(creeLe, maintenant)) return false;
  if (lireReglageSemaine(reglage)) return false;
  return nombreFaitesSemaine(etapes) < ETAPES_SEMAINE.length;
}

// Les visites en bulles partent-elles seules ? Pas pendant la première semaine (la carte n'est ni rangée ni finie
// sur un compte neuf). `reglage` illisible sur un compte neuf ⇒ la semaine court encore.
export function semaineEnCours({ reglage = null, creeLe = null, proprietaire = null, exemple = false, maintenant = Date.now() } = {}) {
  if (exemple || proprietaire === true) return false;
  if (!compteNeuf(creeLe, maintenant)) return false;
  return !lireReglageSemaine(reglage);
}

// Les preuves, depuis les tables synchronisées (aucune requête) : `fiches` = `vinted_annonce_numeros`
// ({ id: { numero, buyPrice } }), `parNum` = `vinted_buyprice_by_num`, `vc` = `vrm_vc_numeros`. `undefined` (nuage pas
// arrivé) ⇒ null. Un prix saisi est un nombre > 0 (« 0 » saisi compte aussi : c'est un prix donné).
const unPrix = (v) => v != null && String(v).trim() !== '' && Number.isFinite(parseFloat(String(v).replace(',', '.')));
export function preuvesTables({ fiches, parNum, vc } = {}) {
  if (fiches === undefined) return { prix: null, numero: null };
  const F = fiches && typeof fiches === 'object' ? Object.values(fiches) : [];
  const V = vc && typeof vc === 'object' ? Object.values(vc) : [];
  const numero = F.some((e) => e && String(e.numero || '').trim()) || V.some((e) => e && String((e && e.numero) || e || '').trim());
  const prix = F.some((e) => e && unPrix(e.buyPrice)) || (parNum && typeof parNum === 'object' && Object.values(parNum).some(unPrix));
  return { prix: !!prix, numero: !!numero };
}
