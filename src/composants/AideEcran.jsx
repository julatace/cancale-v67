// ═══════════════════════════════════════════════════════════════════════════
// LE « ? » D'UN ÉCRAN (8 nov.) — src/aideEcrans.js porte le texte
// ═══════════════════════════════════════════════════════════════════════════
// Un « ? » discret qui SUIT la phrase de l'écran (icône seule : le texte de la
// phrase ne change pas). Il ouvre une feuille : les trois questions de CET écran
// (dépliables, une à la fois lisible), l'article du centre d'aide, et
// « Signaler un problème ».
// ⚠️ L'instantané de l'écran (la capture schématique de « Signaler ») est pris
//    AU TOUCHER du « ? », avant que la feuille ne le recouvre : le signalement
//    montre l'écran tel qu'il était, pas la feuille d'aide.
// Rien ne s'ouvre tout seul : pas de visite forcée, pas de bulle.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { SheetShell as SheetShellBase } from './SheetShell.jsx';
import { BoutonBase } from './Bouton.jsx';
import { AIDE_ECRANS, ARTICLES_AIDE } from '../aideEcrans.js';
import { ETAPES_ECRANS } from '../aideEtapes.js';
import { phraseVendeur } from '../profilVendeur.js';
import './aide-ecran.css';

export const NOMS_ECRANS_AIDE = {
  journee: 'Ma journée', annonces: 'Annonces', ventes: 'Ventes', colis: 'Colis', messages: 'Messages', achats: 'Achats',
  emails: 'E-mails', compta: 'Comptabilité', dashboard: 'Statistiques', garage: 'Stock', settings: 'Réglages', communaute: 'Communauté',
};

function IconeAide() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8.4 8.6a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.1-2.6 3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="11" cy="15.7" r="1.05" fill="currentColor"/>
    </svg>
  );
}
const Chevron = () => (
  <svg className="vrm-aide-chevron" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export function AideEcranFeuille({ cle, onClose, onSignaler, Feuille = SheetShellBase, Bouton = BoutonBase }) {
  const a = AIDE_ECRANS[cle];
  if (!a) return null;
  const article = ARTICLES_AIDE[a.article];
  const etapes = Array.isArray(ETAPES_ECRANS[cle]) ? ETAPES_ECRANS[cle] : [];
  return (
    <Feuille onClose={onClose} titre={NOMS_ECRANS_AIDE[cle] || 'Aide'} sousTitre={etapes.length ? 'En quelques gestes' : 'Questions fréquentes'} z={10400} maxWidth={520} data-aide-feuille={cle}>
      {/* (10 nov., lot J) EN TÊTE : les 3 à 5 gestes de cet écran (sans vidéo), texte de scripts/aide-contenu.cjs. */}
      {etapes.length ? (
        <ol className="vrm-aide-etapes" data-aide-etapes={etapes.length}>
          {etapes.map((e, i) => <li key={i} data-aide-etape={i + 1}><span className="vrm-aide-etape-n" aria-hidden="true">{i + 1}</span><span>{phraseVendeur(e)}</span></li>)}
        </ol>
      ) : null}
      <ul className="vrm-aide-groupe" data-aide-questions={a.questions.length}>
        {a.questions.map(([q, r], i) => (
          <li key={i}>
            <details className="vrm-aide-q" data-aide-question={i} open={i === 0 ? true : undefined}>
              <summary><span>{phraseVendeur(q)}</span><Chevron/></summary>
              <p>{phraseVendeur(r)}</p>
            </details>
          </li>
        ))}
      </ul>
      <ul className="vrm-aide-groupe vrm-aide-liens">
        {article ? <li><a href={`/aide/${a.article}`} target="_blank" rel="noopener" data-aide-article={a.article}><span>{article}</span><Chevron/></a></li> : null}
        <li><a href="/aide" target="_blank" rel="noopener" data-aide-centre=""><span>Tout le centre d’aide</span><Chevron/></a></li>
      </ul>
      <div className="vrm-aide-signaler">
        <p>Quelque chose ne marche pas comme prévu&nbsp;?</p>
        <Bouton variante="secondaire" plein onClick={onSignaler} data-aide-signaler="">Signaler un problème</Bouton>
      </div>
    </Feuille>
  );
}

// `Signaler` : la feuille « Signaler un problème » ; `contexte()` : l'instantané.
export function AideEcran({ cle, Feuille = SheetShellBase, Bouton = BoutonBase, Signaler = null, contexte, entetes, masque }) {
  const [vue, setVue] = React.useState(null);           // null · 'aide' · 'signaler'
  const instantane = React.useRef(null);
  if (!AIDE_ECRANS[cle]) return null;
  const ouvrir = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    try { instantane.current = contexte ? contexte() : null; } catch (_) { instantane.current = null; }
    setVue('aide');
  };
  return (
    <>
      <button type="button" className="vrm-aide-bouton" onClick={ouvrir} aria-label={`Aide : ${NOMS_ECRANS_AIDE[cle] || 'cet écran'}`} aria-haspopup="dialog" data-aide-ouvrir={cle}><IconeAide/></button>
      {vue === 'aide' && <AideEcranFeuille cle={cle} Feuille={Feuille} Bouton={Bouton} onClose={() => setVue(null)} onSignaler={() => setVue('signaler')}/>}
      {vue === 'signaler' && Signaler && <Signaler Feuille={Feuille} Bouton={Bouton} entetes={entetes} masque={masque} contexte={() => ({ ...(instantane.current || {}), ecran: (instantane.current && instantane.current.ecran) || (cle === 'colis' ? 'cat_bord' : cle) })} onClose={() => setVue(null)}/>}
    </>
  );
}

export default AideEcran;
