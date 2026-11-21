// (14 nov., Studio bleu clair) « compte_1 ▾ » est une TOUCHE du studio (`sb-touche`) ; chaque compte de la feuille, une rangée.
// ── src/ui/MenuCompte.jsx — le choix du compte, en UN bouton « compte_1 ▾ » ─────
// Julien (AJOUT 3) : plus de rangée de pilules géantes (« Tous · compte_1 · compte_2 · … »).
// Un bouton texte (15/600, 44 px au doigt) qui dit le compte choisi, ou « Tous les comptes »,
// et ouvre une feuille avec la liste (le compte de l'onglet Vinted marqué, le nombre de
// chaque compte à droite si l'écran le donne). Rien n'est décidé ici : `valeur` et
// `onChange` sont ceux de l'écran (son identité de compte, jamais un nom deviné).
//   <MenuCompte comptes={[{ id:'123', nom:'compte_1', n:12, connecte:true }]} valeur="" onChange={setSel}/>
//   `tous` (défaut vrai) : la première ligne « Tous les comptes » (valeur '').
import React, { useState } from 'react';
import { tr } from '../i18n/index.js';
import { Feuille } from './Feuille.jsx';
import './ui.css';

const Chevron = () => <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const Coche = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// (15 nov., Annonces propre) `court` : sur une ligne partagée (les sites d'Annonces au téléphone), « Tous les comptes »
// s'écrit « Tous » derrière le pictogramme d'un compte — il se coupait en « Tou… ». Le nom entier reste à l'oreille
// (`aria-label`) et dans la feuille.
const Personne = () => <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className="vrm-ui-menu-compte-ic"><circle cx="8" cy="5.4" r="2.9" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M2.6 14c.6-2.7 2.8-4.3 5.4-4.3s4.8 1.6 5.4 4.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;

export function MenuCompte({ comptes = [], valeur = '', onChange, tous = true, titre, className = '', court = false, ...attrs }) {
  const [ouvert, setOuvert] = useState(false);
  const choisi = (comptes || []).find((c) => String(c.id) === String(valeur));
  const nom = choisi ? choisi.nom : tr('listes.tousComptes');
  const nomVu = choisi ? choisi.nom : court ? tr('listes.tousComptesCourt') : nom;
  const lignes = [...(tous ? [{ id: '', nom: tr('listes.tousComptes') }] : []), ...(comptes || [])];
  return (
    <>
      <button type="button" className={'vrm-ui-menu-compte sb-touche' + (className ? ' ' + className : '')} aria-haspopup="dialog" aria-expanded={ouvert}
        aria-label={tr('listes.choisirCompte', { nom })} data-ui-menu-compte={valeur || 'tous'} onClick={() => setOuvert(true)} {...attrs}>
        {court ? <Personne/> : null}<span translate={choisi ? 'no' : undefined}>{nomVu}</span><Chevron/>
      </button>
      {ouvert ? (
        <Feuille titre={titre || tr('listes.comptes')} onClose={() => setOuvert(false)} data-ui-menu-compte-feuille="">
          <ul className="vrm-ui-choix" role="radiogroup">
            {lignes.map((c) => {
              const oui = String(c.id) === String(valeur || '');
              return (
                <li key={c.id || '__tous'}>
                  <button type="button" className="sb-rangee" role="radio" aria-checked={oui} data-ui-compte-choix={c.id || 'tous'} onClick={() => { setOuvert(false); if (!oui && onChange) onChange(c.id); }}>
                    <span><span translate={c.id ? 'no' : undefined}>{c.nom}</span>{c.connecte ? ' · ' + tr('listes.ouvertVinted') : ''}</span>
                    {c.n != null ? <span className="vrm-ui-choix-n">{c.n}</span> : null}
                    <span className="vrm-ui-choix-coche" style={{ visibility: oui ? 'visible' : 'hidden' }}><Coche/></span>
                  </button>
                </li>);
            })}
          </ul>
        </Feuille>) : null}
    </>
  );
}
export default MenuCompte;
