// ── src/natif/ecrans/rangeeVente.jsx — LA RANGÉE D'UNE VENTE AU TÉLÉPHONE, compacte (25 nov. 2026, lot ventes-rangee) ──────────
// Julien, capture iPhone de Ventes → « En route » : « Regarde c'est atroce, c'est moche, la mise en page est catastrophique ».
// Chaque vente prenait ~260 px : vignette vide, titre coupé à 60 % de la largeur, « Livré · 3/4 » ET l'étiquette « Livrée »
// (le même état deux fois), le logo du transporteur coupé au bord, une grosse frise camion et « Relier » · « + prix » en gros
// sur CHAQUE ligne. La rangée devient (comme la page Commandes de Vintex, NATIF.md §0) :
//   [photo 56]  Titre de la paire, deux lignes au plus                       43 €
//               (V) N° 193 · T42 · ▮▮▮▯ Livrée (logo transporteur entier)
// UN état (le mot de `statutRangee`, aucune règle neuve) et sa mini-frise des étapes PROUVÉES ; le prix aligné à droite.
// L'ACHAT (Relier, prix d'achat) n'est plus posé sur la rangée : il a un sens pour une vente sans achat seulement, et il se
// fait au balayage de la rangée (« Relier », « Prix d'achat » : le champ s'ouvre SOUS la rangée), dans la fiche de la vente
// et dans la colonne « Achat » du tableau à l'ordinateur — les mêmes gestes (`GestesAchat`), la même saisie (§2.5).
// Une VUE : aucune lecture, aucune règle ; les identités et les états viennent de l'écran (src/ventes/modeleVentes.js).
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Plaque } from '../Plaque.jsx';
import { LogoSite } from '../LogoSite.jsx';
import { GestesAchat } from './celluleAchat.jsx';

// La mini-frise : un trait par étape, plein quand l'étape est PROUVÉE (les mêmes `etapes` que la fiche). Décorative : le mot
// d'état à côté le dit, et son nom accessible porte « étape n sur m ».
export function MiniFrise({ etapes }) {
  const L = (Array.isArray(etapes) ? etapes : []).filter((e) => e && e.cle);   // une étape a SA clé (`etapesRoute`)
  if (!L.length) return null;
  return <span className="n-vr-frise" aria-hidden="true" data-vr-frise={String(L.filter((e) => e.fait).length)}>{L.map((e) => <i key={e.cle} data-fait={e.fait ? '1' : '0'}/>)}</span>;
}

// LA DEUXIÈME LIGNE : le site, le N°, la taille, l'état (frise + mot), ce qui reste à dire (date limite…), le transporteur.
// Chaque morceau garde sa taille (jamais rogné) ; s'il manque de place, la ligne passe à la ligne entre deux morceaux.
// `logo` : le logo du site, posé par l'écran (<LogoSite site={r.site}/>) ; sinon dessiné ici depuis `site`.
// `etat.etiquette` : l'étiquette d'état dans son propre élément (une <Pastille>{mot}</Pastille>) ; sinon le mot seul.
export function MetaVente({ site = '', nomSite = '', logo = null, num = '', numDouble = false, taille = '', etat = null, morceaux = [], transporteur = null }) {
  const autres = (morceaux || []).filter(Boolean);
  return (
    <span className="n-vr-meta" data-vr-meta="">
      {logo || (site ? <LogoSite site={site} taille={16} nom={nomSite}/> : null)}
      {num ? <Plaque numero={num} doublon={numDouble}/> : null}
      {taille ? <span className="n-vr-morceau" data-vr-taille="">{taille}</span> : null}
      {etat && etat.mot ? <span className="n-vr-etat" data-vr-etat={etat.cle || ''} aria-label={etat.aria || undefined} role={etat.aria ? 'img' : undefined}>
        <MiniFrise etapes={etat.etapes}/>{etat.etiquette ? <span className="n-vr-mot" aria-hidden={etat.aria ? 'true' : undefined}>{etat.etiquette}</span>
          : <span className="n-vr-mot" aria-hidden={etat.aria ? 'true' : undefined}>{etat.mot}</span>}
      </span> : null}
      {autres.map((m) => <span key={typeof m === 'string' ? m : m.key} className="n-vr-morceau">{m}</span>)}   {/* un morceau-nœud porte SA clé (« limite ») */}
      {transporteur && transporteur.logo ? <span className="n-vr-logo" data-vt-transporteur={transporteur.cle || ''} title={transporteur.nom || ''}>{transporteur.logo}</span> : null}
    </span>
  );
}

// L'ACHAT d'une vente, rangé : des actions de BALAYAGE (Relier ; Prix d'achat qui ouvre le champ sous la rangée) seulement quand
// elles ont un sens pour CETTE vente — pas d'achat relié et pas de prix connu. Rien n'est relié tout seul (§5).
export function useAchatRange(a, titre, Icon) {
  const [champ, setChamp] = React.useState(false);
  const libre = !!(a && !a.relie && !a.prix);
  const actions = [];
  if (libre && a.saisir) actions.push({ cle: 'prix', libelle: tr('vt.prixAchatChamp'), ton: 'neutre', icone: Icon ? <Icon name="tag" size={20}/> : null, onClick: () => setChamp(true) });
  if (libre && a.ouvrir) actions.push({ cle: 'relier', libelle: tr('vt.relierCourt'), ton: 'encre', icone: Icon ? <Icon name="relier" size={20}/> : null, onClick: () => a.ouvrir() });
  const pied = champ && a && a.saisir ? <GestesAchat a={{ ...a, ouvrir: null, titre: a.titre || titre }} Icon={Icon} court auto/> : null;
  return { actions, pied, libre };
}
