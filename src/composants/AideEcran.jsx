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
import { fichesPour, fichesEcran, chercherAide, pourVendeur, emmener, FICHES_AIDE } from '../aideFiches.js';
import { AideAnimation } from './AideAnimation.jsx';
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

// (11 nov., lot centre-aide) Une fiche « Comment faire » : la question, 1 à 3
// étapes, « M'y emmener » (src/aideFiches.js). Dépliée, une à la fois lisible.
function FicheAide({ f, ouverte, avecEcran, onEmmener, Bouton }) {
  return (
    <li>
      <details className="vrm-aide-q vrm-aide-fiche" data-aide-fiche={f.id} data-aide-fiche-avance={f.avance ? '1' : undefined} open={ouverte ? true : undefined}>
        <summary><span>{f.q}{avecEcran ? <small className="vrm-aide-fiche-ou">{NOMS_ECRANS_AIDE[f.ecran] || ''}</small> : null}</span><Chevron/></summary>
        <ol className="vrm-aide-fiche-etapes">{f.etapes.map((e, i) => <li key={i}>{e}</li>)}</ol>
        <div className="vrm-aide-fiche-aller"><Bouton variante="secondaire" onClick={() => onEmmener(f)} data-aide-emmener={f.id}>M’y emmener</Bouton></div>
      </details>
    </li>
  );
}

// `vend` / `mode` : le profil du vendeur (src/profilVendeur.js) — les mots et les
// fiches suivent ; `ficheOuverte` / `requete` : ouverte depuis la loupe.
export function AideEcranFeuille({ cle, onClose, onSignaler, Feuille = SheetShellBase, Bouton = BoutonBase, vend = 'sneakers', mode = 'complet', ficheOuverte = null, requete = '' }) {
  const a = AIDE_ECRANS[cle];
  const [etape, setEtape] = React.useState(-1);
  const [q, setQ] = React.useState(requete || '');
  const fiches = React.useMemo(() => fichesPour({ vend, mode }), [vend, mode]);
  const trouvees = React.useMemo(() => (q.trim() ? chercherAide(fiches, q) : null), [fiches, q]);
  React.useEffect(() => { if (!ficheOuverte) return; try { const el = document.querySelector(`[data-aide-fiche="${ficheOuverte}"]`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); } catch (_) {} }, [ficheOuverte]);
  if (!a) return null;
  const article = ARTICLES_AIDE[a.article];
  const etapes = (Array.isArray(ETAPES_ECRANS[cle]) ? ETAPES_ECRANS[cle] : []).map((e) => pourVendeur(e, vend));
  // L'écran : ses fiches ; la fiche demandée par la loupe passe en tête.
  let liste = trouvees || fichesEcran(fiches, cle);
  if (!trouvees && ficheOuverte && !liste.some((f) => f.id === ficheOuverte)) { const f = fiches.find((x) => x.id === ficheOuverte); if (f) liste = [f, ...liste]; }
  const allerA = (f) => { onClose && onClose(); emmener(f); };
  return (
    <Feuille onClose={onClose} titre={NOMS_ECRANS_AIDE[cle] || 'Aide'} sousTitre={etapes.length ? 'En quelques gestes' : 'Questions fréquentes'} z={10400} maxWidth={520} data-aide-feuille={cle}>
      {/* (11 nov.) L'animation de l'écran : une scène par geste, le geste en cours s'allume dessous. */}
      <AideAnimation cle={cle} onEtape={setEtape}/>
      {/* (10 nov., lot J) EN TÊTE : les 3 à 5 gestes de cet écran (sans vidéo), texte de scripts/aide-contenu.cjs. */}
      {etapes.length ? (
        <ol className="vrm-aide-etapes" data-aide-etapes={etapes.length}>
          {etapes.map((e, i) => <li key={i} data-aide-etape={i + 1} data-aide-etape-actif={etape === i ? '1' : undefined} aria-current={etape === i ? 'step' : undefined}><span className="vrm-aide-etape-n" aria-hidden="true">{i + 1}</span><span>{e}</span></li>)}
        </ol>
      ) : null}
      {/* (11 nov.) « Comment faire… ? » : toutes les fiches, sans IA (src/aideFiches.js). */}
      <label className="vrm-aide-cherche" data-aide-cherche="">
        <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true" focusable="false"><circle cx="7.3" cy="7.3" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M11.6 11.6l3.8 3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Comment faire… ?" aria-label="Comment faire… ? Cherche dans l’aide" enterKeyHint="search" autoComplete="off" spellCheck={false} data-aide-champ=""/>
      </label>
      <h3 className="vrm-aide-tete" data-aide-liste={trouvees ? 'recherche' : 'ecran'}>{trouvees ? (trouvees.length ? (trouvees.some((f) => f.approx) ? 'Ce qui s’en approche' : 'Comment faire') : 'Rien trouvé') : 'Comment faire'}</h3>
      {liste.length ? (
        <ul className="vrm-aide-groupe" data-aide-fiches={liste.length}>
          {liste.map((f, i) => <FicheAide key={f.id} f={f} ouverte={f.id === ficheOuverte || (trouvees && i === 0)} avecEcran={!!trouvees && f.ecran !== cle} onEmmener={allerA} Bouton={Bouton}/>)}
        </ul>
      ) : <p className="vrm-aide-rien" data-aide-rien="">Essaie un autre mot : « bordereau », « URSSAF », « vacances ».</p>}
      <h3 className="vrm-aide-tete">Questions fréquentes</h3>
      <ul className="vrm-aide-groupe" data-aide-questions={a.questions.length}>
        {a.questions.map(([qq, r], i) => (
          <li key={i}>
            <details className="vrm-aide-q" data-aide-question={i}>
              <summary><span>{pourVendeur(qq, vend)}</span><Chevron/></summary>
              <p>{pourVendeur(r, vend)}</p>
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
export function AideEcran({ cle, Feuille = SheetShellBase, Bouton = BoutonBase, Signaler = null, contexte, entetes, masque, vend = 'sneakers', mode = 'complet' }) {
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
      {vue === 'aide' && <AideEcranFeuille cle={cle} vend={vend} mode={mode} Feuille={Feuille} Bouton={Bouton} onClose={() => setVue(null)} onSignaler={() => setVue('signaler')}/>}
      {vue === 'signaler' && Signaler && <Signaler Feuille={Feuille} Bouton={Bouton} entetes={entetes} masque={masque} contexte={() => ({ ...(instantane.current || {}), ecran: (instantane.current && instantane.current.ecran) || (cle === 'colis' ? 'cat_bord' : cle) })} onClose={() => setVue(null)}/>}
    </>
  );
}

// (11 nov., lot centre-aide) L'AIDE OUVERTE D'AILLEURS : la loupe (« Comment faire »)
// envoie `vrm:aide` { fiche, q } ; la coque monte cet hôte une fois. Rien ne
// s'ouvre sans un toucher : seul un geste de la personne émet l'événement.
export function CentreAide({ Feuille = SheetShellBase, Bouton = BoutonBase, Signaler = null, contexte, entetes, masque, vend = 'sneakers', mode = 'complet' }) {
  const [ouvert, setOuvert] = React.useState(null);   // { cle, fiche, q } · 'signaler'
  React.useEffect(() => {
    const f = (e) => { const d = (e && e.detail) || {}; const fi = d.fiche ? FICHES_AIDE.find((x) => x.id === d.fiche) : null; const cle = fi ? fi.ecran : (AIDE_ECRANS[d.ecran] ? d.ecran : null); if (!cle) return; setOuvert({ cle, fiche: fi ? fi.id : null, q: typeof d.q === 'string' ? d.q.slice(0, 80) : '' }); };
    window.addEventListener('vrm:aide', f); return () => window.removeEventListener('vrm:aide', f);
  }, []);
  if (!ouvert) return null;
  if (ouvert === 'signaler') return Signaler ? <Signaler Feuille={Feuille} Bouton={Bouton} entetes={entetes} masque={masque} contexte={() => (contexte ? contexte() : {})} onClose={() => setOuvert(null)}/> : null;
  return <AideEcranFeuille key={ouvert.cle + (ouvert.fiche || '')} cle={ouvert.cle} vend={vend} mode={mode} ficheOuverte={ouvert.fiche} Feuille={Feuille} Bouton={Bouton} onClose={() => setOuvert(null)} onSignaler={() => setOuvert('signaler')}/>;
}

export default AideEcran;
