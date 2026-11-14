// ═══════════════════════════════════════════════════════════════════════════
// « COLLER UN TABLEAU » DE PRIX D'ACHAT — la feuille (14 nov., proposition 75)
// La règle : src/collerPrixAchat.js. Ouverte depuis la saisie en série (« Prix
// d'achat à compléter », que « Coût d'achat · x/y renseignés » ouvre).
// ═══════════════════════════════════════════════════════════════════════════
// Il colle « N° ; prix » ⇒ chaque ligne montrée (à enregistrer, déjà ce prix,
// refusée et pourquoi) ⇒ RIEN n'est écrit avant « Enregistrer N prix » (SON clic).
// Un prix différent déjà posé n'est remplacé que s'il coche « Remplacer aussi ».
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { apercuCollage, ecrituresCollage } from '../collerPrixAchat.js';
import '../argent-choix.css';
import { AccAvant, AccApres, AccEchec } from '../ui/Accompagne.jsx';   // (14 nov.) les quatre moments du geste

const LIGNES_AFFICHEES = 200;
const eur = (c) => `${(c / 100).toFixed(2).replace('.', ',')} €`;
const REFUSEES = ['conflit', 'inconnu', 'deux', 'illisible', 'colonnes'];

function raison(l, remplacer) {
  switch (l.etat) {
    case 'ok': return tr('ac.coller.etat.ok');
    case 'different': return remplacer ? tr('ac.coller.etat.remplace', { avant: eur(l.avant) }) : tr('ac.coller.etat.different', { avant: eur(l.avant) });
    case 'identique': return tr('ac.coller.etat.identique');
    case 'doublon': return tr('ac.coller.etat.doublon');
    case 'conflit': return tr('ac.coller.etat.conflit');
    case 'inconnu': return tr('ac.coller.etat.inconnu');
    case 'deux': return tr('ac.coller.etat.deux', { n: l.nFiches || 2 });
    case 'vide': return tr('ac.coller.etat.vide');
    case 'colonnes': return tr('ac.coller.etat.colonnes');
    case 'entete': return tr('ac.coller.etat.entete');
    default: return tr('ac.coller.etat.illisible');
  }
}

export function CollerPrixAchatFeuille({ onClose, onEnregistrer, fichesDe, lu, Feuille, Bouton }) {
  const [texte, setTexte] = React.useState('');
  const [remplacer, setRemplacer] = React.useState(false);
  const [fait, setFait] = React.useState(null);   // { ecrits, changees } après SON clic
  const A = React.useMemo(() => (texte.trim() ? apercuCollage({ texte, fichesDe, lu }) : null), [texte, fichesDe, lu]);
  const R = A ? A.resume : null;
  const ecritures = A ? ecrituresCollage(A, { remplacer }) : [];
  const refusees = R ? REFUSEES.reduce((t, e) => t + R[e], 0) : 0;
  const enregistrer = () => {
    if (!A || !A.lu || !ecritures.length) return;
    const r = onEnregistrer(ecritures);
    if (r) setFait(r);
  };
  return (
    <Feuille onClose={onClose} titre={tr('ac.coller.titre')} sousTitre={tr('ac.coller.sous')} maxWidth={620} z={2100} data-coller-prix={fait ? 'fait' : A ? 'apercu' : 'vide'}>
      <div className="vrm-ac-coller">
        {fait ? (
          <div className="vrm-ac-fait" data-coller-ecrits={fait.ecrits} data-coller-changees={fait.changees} data-acc-apres="prix.achat">
            <p className="vrm-ac-affiche">{fait.ecrits}</p>
            <p className="vrm-ac-libelle">{tr('ac.coller.ecrits', { n: fait.ecrits })}</p>
            {fait.changees > 0 ? <p className="vrm-ac-note is-ambre" data-coller-changees-texte="">{tr('ac.coller.changees', { n: fait.changees })}</p> : null}
            {/* (14 nov.) La suite : le bénéfice se complète avec ces prix. */}
            <AccApres geste="prix.achat" texte={tr('acc.prix.achat.suite')} onEnsuite={(suite) => { onClose(); try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: suite.lien })); } catch (_) {} }}/>
          </div>
        ) : (
          <>
            <textarea className="vrm-ac-zone" data-coller-zone="" value={texte} onChange={(e) => setTexte(e.target.value)} rows={6}
              aria-label={tr('ac.coller.zone')} placeholder={'12 ; 60\nB125 ; 45,50\n7 60 €'} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
            {!A ? <p className="vrm-ac-note">{tr('ac.coller.aide')}</p> : null}
            {A && !A.lu ? <div className="vrm-ac-note" data-coller-lecture="ko"><AccEchec geste="prix.achat" erreur={tr('ac.coller.pasLu')} lu={{ code: 'pasSu', texte: tr('ac.coller.pasLu').replace(/[.\s]+$/, '') }}/></div> : null}
            {A && A.lu ? (
              <div className="vrm-ac-tuiles" data-coller-resume="" data-ok={R.ok} data-different={R.different} data-identique={R.identique} data-refusees={refusees} data-vides={R.vide}>
                <div className="vrm-ac-tuile"><b className="vrm-ac-chiffre">{ecritures.length}</b><span className="vrm-ac-libelle">{tr('ac.coller.tuile.ecrire')}</span></div>
                {R.identique + R.doublon > 0 ? <div className="vrm-ac-tuile"><b className="vrm-ac-chiffre">{R.identique + R.doublon}</b><span className="vrm-ac-libelle">{tr('ac.coller.tuile.deja')}</span></div> : null}
                {refusees + (remplacer ? 0 : R.different) > 0 ? <div className="vrm-ac-tuile is-ambre"><b className="vrm-ac-chiffre">{refusees + (remplacer ? 0 : R.different)}</b><span className="vrm-ac-libelle">{tr('ac.coller.tuile.refusees')}</span></div> : null}
              </div>
            ) : null}
            {A && A.lu && R.different > 0 ? (
              <label className="vrm-ac-case" data-coller-remplacer={remplacer ? '1' : '0'}>
                <input type="checkbox" checked={remplacer} onChange={(e) => setRemplacer(e.target.checked)} />
                <span>{tr('ac.coller.remplacer', { n: R.different })}</span>
              </label>
            ) : null}
            {A ? (
              <ul className="vrm-ac-lignes" data-coller-lignes={A.lignes.length}>
                {A.lignes.slice(0, LIGNES_AFFICHEES).map((l) => {
                  const ecrit = l.etat === 'ok' || (remplacer && l.etat === 'different');
                  return (
                    <li key={l.n} className={'vrm-ac-ligne vrm-at-rangee' + (ecrit ? ' is-ecrit' : REFUSEES.includes(l.etat) ? ' is-refuse' : '')} data-coller-ligne={l.n} data-coller-etat={l.etat} data-coller-cle={l.cle || ''} data-coller-prix={l.centimes == null ? '' : String(l.centimes)}>
                      <span className="vrm-ac-num">{l.fiche ? `N°${l.fiche.numero}` : l.numero ? `N°${l.numero}` : '—'}</span>
                      <span className="vrm-ac-corps">
                        <span className="vrm-ac-titre">{l.fiche && l.fiche.titre ? l.fiche.titre : l.brut}</span>
                        <span className="vrm-ac-sous">{raison(l, remplacer)}</span>
                      </span>
                      <span className="vrm-ac-prix">{l.centimes == null ? '—' : eur(l.centimes)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {A && A.lignes.length > LIGNES_AFFICHEES ? <p className="vrm-ac-note">{tr('ac.coller.autres', { n: A.lignes.length - LIGNES_AFFICHEES })}</p> : null}
            {A && A.trop > 0 ? <p className="vrm-ac-note is-ambre" data-coller-trop={A.trop}>{tr('ac.coller.trop', { n: A.trop })}</p> : null}
          </>
        )}
      </div>
      {!fait && A && A.lu && ecritures.length ? <AccAvant geste="prix.achat" vars={{ n: ecritures.length }}/> : null}
      <div className="vrm-fs-pied vrm-ac-pied">
        {fait
          ? <Bouton variante="primaire" plein onClick={onClose} data-coller-fermer="">{tr('ac.coller.fermer')}</Bouton>
          : <Bouton variante="primaire" plein disabled={!A || !A.lu || !ecritures.length} onClick={enregistrer} data-coller-enregistrer={ecritures.length}>
              {ecritures.length ? tr('ac.coller.enregistrer', { n: ecritures.length }) : tr('ac.coller.rien')}
            </Bouton>}
      </div>
    </Feuille>
  );
}
export default CollerPrixAchatFeuille;
