// ══════════════════════════════════════════════════════════════════════════════
//  « MOIS BOUCLÉ » (10 nov., lot BK) — Argent → Déclarer
//  La FORME seulement : ce qui manque et la décision « prêt » sont src/moisBoucle.js
//  (aucune règle neuve : montant = `montantPeriodeUrssaf`, prix et frais =
//  `beneficeDesJours`, comptes = la ligne de fraîcheur publiée, registre déclaré).
//  Peu de texte, du visuel : un rond par ligne (✓ gris quand c'est réglé, le nombre
//  en ambre quand il faut un geste, « — » quand ce n'est pas su), la ligne touchée
//  OUVRE l'endroit où le régler. Couleur rare (§7) : l'accent seulement sur le
//  montant du mois prêt ; jamais rouge.
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { montant as fmtMontant } from './format.js';
import { moisBoucle, moisChoisissables, moisParDefaut, NomMois } from './moisBoucle.js';
import { fraicheurPubliee, suivreFraicheur } from './fraicheur.js';
import { moisCouvertParPublication } from './beneficeNoms.js';
import { useLigneSynchro, useLigneUrssaf, lireBeneficeJours, lireDeclarations, montantPeriodeUrssaf, moisDeclare, beneficeDesJours, tauxUrssaf, useRegimeFiscal, DEMANDE_SAISIE_PRIX } from './App.jsx';
import './styles-mois-boucle.css';
import { Carte, Rangee, Pastille, Glyphe } from './natif/index.js';
import './natif/ecrans/argent.css';
import { tr } from './i18n/index.js';

const REGLES = { montantPeriodeUrssaf, moisDeclare, beneficeDesJours, moisCouvert: moisCouvertParPublication };
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const libelleMois = (ym) => `${NomMois(ym)} ${String(ym).slice(0, 4)}`;

// Les mots de chaque ligne : le nom, ce qui s'affiche réglé, la raison d'un « — ».
const NOMS = {
  adater: 'Dates de versement en lecture',   // (15 nov., 5.390) l’extension les récupère : aucune porte
  prix: 'Prix d’achat à saisir',
  comptes: 'Comptes à relire',
  frais: 'Frais inconnus',
  fini: 'Mois en cours',
  montant: 'Montant incomplet',
};
// Réglée, la ligne se dit au passé (une liste cochée).
const NOMS_OK = { adater: 'Ventes datées', prix: 'Prix d’achat saisis', comptes: 'Comptes relus', frais: 'Frais connus' };
const GESTES_MB = { adater: 'nc.mb.adater', prix: 'nc.mb.prix', comptes: 'nc.mb.comptes', frais: 'nc.mb.frais', montant: 'nc.mb.montant' };
const RAISONS = {
  absente: 'ouvre Ventes une fois',
  publication: 'ouvre Ventes une fois',
  'mois pas couvert': 'mois trop ancien',
  extension: 'extension pas vérifiée',
  'hors-ligne': 'hors ligne',
  base: 'base injoignable',
  rien: 'aucun compte relié',
  pasSu: 'pas vérifié',
};

function useFraicheurPubliee() {
  const [f, setF] = React.useState(fraicheurPubliee);
  React.useEffect(() => suivreFraicheur(setF), []);
  return f;
}

export default function MoisBoucle({ portes = {} }) {
  const [ym, setYm] = React.useState(() => moisParDefaut());
  const [pub, pret] = useLigneSynchro('vrm_benefice_jours', lireBeneficeJours);
  const [reg, regPret] = useLigneSynchro('vrm_urssaf_declare', lireDeclarations);
  const ligneU = useLigneUrssaf();
  const fraicheur = useFraicheurPubliee();
  const regime = useRegimeFiscal();
  const maintenant = Date.now();
  // Le mois à DÉCLARER à l'URSSAF : un micro-entrepreneur seulement (statut pas lu ou autre : rien ici).
  if (regime !== 'micro') return null;
  const K = moisBoucle({ ym, maintenant, ligne: pret ? ligneU : undefined, declare: regPret ? reg : undefined,
    joursBenef: pret ? pub : undefined, fraicheur, taux: tauxUrssaf(), R: REGLES });
  if (!K) return null;
  const choix = moisChoisissables(maintenant);
  const ouvrir = (cle) => { const f = portes[cle]; if (typeof f === 'function') f(); };
  const somme = (v) => fmtMontant(v);
  const etatTxt = K.etat === 'pret' ? `${K.nom} est prêt à déclarer`
    : K.etat === 'declare' ? `${K.nom} est noté déclaré`
    : K.etat === 'manque' ? `${K.aRegler} ${K.aRegler > 1 ? 'choses' : 'chose'} à régler`
    : K.etat === 'passu' ? 'Pas tout vérifié' : 'Vérification…';
  // (20 nov., lot argent-natif) AU STYLE NATIF §2 bis : une carte-tableau à filet. L'en-tête (« MOIS BOUCLÉ », le mois en
  // choix à droite), une ligne d'état (« 1 chose à régler · 2 604,20 € à déclarer »), puis UNE rangée par vérification :
  // le nom, sa précision en gris, à droite le nombre en pastille ambre (à régler) ou ✓ (réglé) ; la rangée qui a une porte
  // se touche (chevron). Les mêmes règles (src/moisBoucle.js), les mêmes data-mb-*.
  return (
    <Carte className="vrm-mb n-arg-mb" titre="Mois bouclé" tonSous={K.etat === 'manque' ? 'ambre' : 'neutre'}
      sousTitre={<span role="status"><span className="vrm-mb-titre-etat">{etatTxt}</span>{K.montant && K.montant.ca != null ? <> · <span className="vrm-mb-montant" data-mb-a-declarer={String(Math.round(K.montant.ca * 100))}>{somme(K.montant.ca)} à déclarer</span></> : null}</span>}
      action={<select className="n-arg-select" aria-label="Mois à boucler" data-mb-choix="" value={K.ym} onChange={(e) => setYm(e.target.value)}>
        {choix.map((m) => <option key={m} value={m}>{libelleMois(m)}</option>)}
      </select>}
      attrs={{ 'data-mois-boucle': K.ym, 'data-mb-etat': K.etat, 'data-mb-a-regler': K.aRegler, 'data-mb-montant': K.montant && K.montant.ca != null ? String(Math.round(K.montant.ca * 100)) : '', 'aria-label': `Mois bouclé : ${libelleMois(K.ym)}` }}>
      {/* (16 nov. au soir, décision de Julien) Ventes Pro à deux prix COMPTÉES au prix de l'article : l'écart du mois
          (la ligne publiée `vinted_urssaf_mois`), écrit à côté du montant, jamais ajouté. */}
      {(() => { const m = ligneU && Array.isArray(ligneU.mois) ? ligneU.mois.find((x) => x && x.ym === K.ym) : null;
        return m && Number(m.nEcart) > 0 && Number.isSafeInteger(m.ecartC)
          ? <p className="vrm-mb-ecart" data-mb-ecart-pro={m.ecartC} data-mb-ecart-n={m.nEcart}>{tr('nc.ecart', { n: Number(m.nEcart), x: somme(m.ecartC / 100) })}</p> : null; })()}
      {K.etat === 'declare' ? null : K.lignes.map((l) => {
        const action = l.etat === 'manque' && typeof portes[l.cle] === 'function';
        const sous = l.etat === 'passu' ? (RAISONS[l.raison] || RAISONS.pasSu)
          : l.cle === 'fini' && l.jusqua ? `jusqu’au ${new Date(l.jusqua).getDate()} ${MOIS_COURT[new Date(l.jusqua).getMonth()]}`
          : l.cle === 'montant' && l.etat === 'manque' ? (l.raison === 'nonComptees' ? 'ventes au montant pas lu' : 'recalcule dans Ventes')
          : l.cle === 'comptes' && l.etat === 'manque' && l.noms && l.noms.length ? l.noms.slice(0, 2).join(', ') + (l.noms.length > 2 ? ` +${l.noms.length - 2}` : '')
          : l.cle === 'prix' && l.etat === 'manque' && l.sur ? `sur ${l.sur} ventes` : '';
        // (16 nov., lot argent-mieux) Chaque ligne à régler dit SON geste, en une ligne.
        const geste = l.etat === 'manque' && GESTES_MB[l.cle] ? tr(GESTES_MB[l.cle]) : '';
        const nom = (l.etat === 'ok' && NOMS_OK[l.cle]) || NOMS[l.cle] || l.cle;
        const droite = l.etat === 'ok' ? <Glyphe nom="check" taille={18} className="n-arg-coche"/>
          : l.etat === 'manque' ? <Pastille ton="ambre">{l.n != null ? String(l.n) : '!'}</Pastille>
          : <span className="n-arg-muet">{l.cle === 'fini' || l.etat === 'encours' ? '…' : '—'}</span>;
        const attrs = { 'data-mb-ligne': l.cle, 'data-mb-ligne-etat': l.etat, 'data-mb-n': l.n == null ? '' : String(l.n), ...(action ? { 'data-mb-porte': l.cle } : {}),
          'aria-label': `${nom} : ${l.etat === 'ok' ? 'réglé' : l.etat === 'manque' ? (l.n != null ? l.n : 'à régler') : l.etat === 'encours' ? 'vérification' : 'pas su'}${sous ? ', ' + sous : ''}${geste ? '. ' + geste : ''}` };
        return (
          <Rangee key={l.cle} className={'vrm-mb-ligne is-' + l.etat} titre={nom} sousTitre={[sous, geste].filter(Boolean).join(' · ')} ton={geste ? 'ambre' : 'neutre'}
            pastille={droite} fin={action ? 'chevron' : null} onClick={action ? () => ouvrir(l.cle) : null} attrs={attrs}/>
        );
      })}
    </Carte>
  );
}

// Les portes de la liste, telles que Comptabilité les branche (l'endroit où régler chaque ligne).
export const portesMoisBoucle = ({ onNav, ouvrirRepli }) => ({
  // (15 nov., extension 5.390) Plus de porte « à dater » : Julien ne date rien lui-même, l’extension
  // récupère les dates de versement (la ligne reste dite, inerte : le mois n’est pas « prêt » d’ici là).
  prix: () => { DEMANDE_SAISIE_PRIX.on = true; if (onNav) onNav('vinted_annonces'); },
  comptes: () => onNav && onNav('vintedaccounts'),
  frais: () => onNav && onNav('cat_ventes'),
  montant: () => onNav && onNav('cat_ventes'),
});
