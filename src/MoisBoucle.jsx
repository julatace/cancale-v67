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

const REGLES = { montantPeriodeUrssaf, moisDeclare, beneficeDesJours, moisCouvert: moisCouvertParPublication };
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const libelleMois = (ym) => `${NomMois(ym)} ${String(ym).slice(0, 4)}`;

// Les mots de chaque ligne : le nom, ce qui s'affiche réglé, la raison d'un « — ».
const NOMS = {
  adater: 'Ventes à dater',
  prix: 'Prix d’achat à saisir',
  comptes: 'Comptes à relire',
  frais: 'Frais inconnus',
  fini: 'Mois en cours',
  montant: 'Montant incomplet',
};
// Réglée, la ligne se dit au passé (une liste cochée).
const NOMS_OK = { adater: 'Ventes datées', prix: 'Prix d’achat saisis', comptes: 'Comptes relus', frais: 'Frais connus' };
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
  const tete = K.etat === 'pret' ? <><b className="vrm-mb-titre-etat">{K.nom} est prêt à déclarer</b></>
    : K.etat === 'declare' ? <b className="vrm-mb-titre-etat">{K.nom} est noté déclaré</b>
    : K.etat === 'manque' ? <b className="vrm-mb-titre-etat">{K.aRegler} {K.aRegler > 1 ? 'choses' : 'chose'} à régler</b>
    : K.etat === 'passu' ? <b className="vrm-mb-titre-etat">Pas tout vérifié</b>
    : <b className="vrm-mb-titre-etat">Vérification…</b>;
  return (
    <section className="vrm-mb" data-mois-boucle={K.ym} data-mb-etat={K.etat} data-mb-a-regler={K.aRegler}
      data-mb-montant={K.montant && K.montant.ca != null ? String(Math.round(K.montant.ca * 100)) : ''} aria-label={`Mois bouclé : ${libelleMois(K.ym)}`}>
      <div className="vrm-mb-tete">
        <h3 className="vrm-mb-titre">Mois bouclé</h3>
        <select className="vrm-mb-mois" aria-label="Mois à boucler" data-mb-choix="" value={K.ym} onChange={(e) => setYm(e.target.value)}>
          {choix.map((m) => <option key={m} value={m}>{libelleMois(m)}</option>)}
        </select>
      </div>
      <div className={'vrm-mb-etat is-' + K.etat} role="status">
        {tete}
        {K.montant && K.montant.ca != null ? <span className="vrm-mb-montant" data-mb-a-declarer={String(Math.round(K.montant.ca * 100))}>{somme(K.montant.ca)}<small>à déclarer</small></span> : null}
      </div>
      {K.etat === 'declare' ? null : (
        <ul className="vrm-mb-liste">
          {K.lignes.map((l) => {
            const action = l.etat === 'manque' && typeof portes[l.cle] === 'function';
            const rond = l.etat === 'ok' ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.2 5.8 10 11 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : l.cle === 'fini' ? '…' : l.etat === 'manque' ? (l.n != null ? l.n : '!') : l.etat === 'encours' ? '…' : '—';
            const sous = l.etat === 'passu' ? (RAISONS[l.raison] || RAISONS.pasSu)
              : l.cle === 'fini' && l.jusqua ? `jusqu’au ${new Date(l.jusqua).getDate()} ${MOIS_COURT[new Date(l.jusqua).getMonth()]}`
              : l.cle === 'montant' && l.etat === 'manque' ? (l.raison === 'nonComptees' ? 'ventes au montant pas lu' : 'recalcule dans Ventes')
              : l.cle === 'comptes' && l.etat === 'manque' && l.noms && l.noms.length ? l.noms.slice(0, 2).join(', ') + (l.noms.length > 2 ? ` +${l.noms.length - 2}` : '')
              : l.cle === 'prix' && l.etat === 'manque' && l.sur ? `sur ${l.sur} ventes` : '';
            const corps = <>
              <span className={'vrm-mb-rond is-' + (l.cle === 'fini' ? 'attente' : l.etat)} aria-hidden="true">{rond}</span>
              <span className="vrm-mb-l">
                <span className="vrm-mb-nom">{(l.etat === 'ok' && NOMS_OK[l.cle]) || NOMS[l.cle] || l.cle}</span>
                {sous ? <span className={'vrm-mb-sous' + (l.cle === 'comptes' ? ' vrm-sensible' : '')}>{sous}</span> : null}
              </span>
              {action ? <span className="vrm-mb-chev" aria-hidden="true">›</span> : null}
            </>;
            const attrs = { 'data-mb-ligne': l.cle, 'data-mb-ligne-etat': l.etat, 'data-mb-n': l.n == null ? '' : String(l.n) };
            const aria = `${(l.etat === 'ok' && NOMS_OK[l.cle]) || NOMS[l.cle] || l.cle} : ${l.etat === 'ok' ? 'réglé' : l.etat === 'manque' ? (l.n != null ? l.n : 'à régler') : l.etat === 'encours' ? 'vérification' : 'pas su'}${sous ? ', ' + sous : ''}`;
            return (
              <li key={l.cle} className={'vrm-mb-ligne is-' + l.etat}>
                {action ? <button type="button" className="vrm-mb-porte" {...attrs} data-mb-porte={l.cle} aria-label={aria} onClick={() => ouvrir(l.cle)}>{corps}</button>
                  : <div className="vrm-mb-porte is-inerte" {...attrs} aria-label={aria}>{corps}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Les portes de la liste, telles que Comptabilité les branche (l'endroit où régler chaque ligne).
export const portesMoisBoucle = ({ onNav, ouvrirRepli }) => ({
  adater: () => ouvrirRepli && ouvrirRepli('compta-ca'),
  prix: () => { DEMANDE_SAISIE_PRIX.on = true; if (onNav) onNav('vinted_annonces'); },
  comptes: () => onNav && onNav('vintedaccounts'),
  frais: () => onNav && onNav('cat_ventes'),
  montant: () => onNav && onNav('cat_ventes'),
});
