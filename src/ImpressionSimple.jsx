// ═══════════════════════════════════════════════════════════════════════════
// « IMPRIMER » EN UN TOUCHER — les deux feuilles (14 nov., impression-simple)
// ═══════════════════════════════════════════════════════════════════════════
// Le parcours (règles : src/impression/lotSimple.js ; moteur : App.jsx) :
//   · « Imprimer (N) » ⇒ le PDF de tous les bordereaux, chacun tamponné de SON N°,
//     au format retenu, s'ouvre tout de suite (préparé d'avance) ;
//   · le format se choisit UNE fois (`ChoixPapier`, la première fois seulement),
//     puis d'un toucher discret à côté du bouton ;
//   · APRÈS : `FeuilleImpression` — « Tout est sorti ? Oui / Il en manque », et
//     les vignettes des bordereaux : en toucher une ⇒ changer SON tampon et la
//     réimprimer seule. Rien n'est imposé avant d'imprimer.
// Règles des boutons (direction t25) : UN bouton plein par feuille, le reste en
// touches et liens ; cibles ≥ 44 px ; « actif » = enfoncé (aria-pressed).
// Tous les textes passent par tr() (5 langues, clés `impr.*`).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from './i18n/index.js';
import { FORMATS_IMPRESSION } from './impression/lotSimple.js';
import { TAMPONS } from './impression/thermique.js';
import './styles-impression.css';

// (25 nov., moins-texte-a) Le papier se DESSINE (une feuille A4 et SON bordereau, l'étiquette 10×15, la feuille en quatre) :
// la phrase qui le décrivait passe au lecteur d'écran. Dessin seul (aria-hidden), à la couleur du texte.
function PictoPapier({ format }) {
  const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' };
  const plein = { fill: 'currentColor', opacity: 0.22 };
  return (
    <svg className="vrm-impr-picto" data-impr-picto={format} width="44" height="52" viewBox="0 0 44 52" aria-hidden="true">
      {format === 'thermique' ? <><rect x="9" y="8" width="26" height="38" rx="3" {...trait}/><rect x="13" y="13" width="18" height="6" rx="1" {...plein}/><path d="M13 25h18M13 30h12M13 35h15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></>
        : format === 'planche4' ? <><rect x="5" y="3" width="34" height="46" rx="2.5" {...trait}/><path d="M22 3v46M5 26h34" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.5 2.5"/><rect x="9" y="7" width="9" height="15" rx="1" {...plein}/><rect x="26" y="7" width="9" height="15" rx="1" {...plein}/><rect x="9" y="30" width="9" height="15" rx="1" {...plein}/><rect x="26" y="30" width="9" height="15" rx="1" {...plein}/></>
        : <><rect x="5" y="3" width="34" height="46" rx="2.5" {...trait}/><rect x="11" y="9" width="22" height="30" rx="1.5" {...plein}/><circle cx="29" cy="43" r="2.4" fill="currentColor"/></>}
    </svg>
  );
}

// LA QUESTION DU PAPIER — une fois. Toucher un papier = le choisir (et, la première
// fois, imprimer aussitôt : `puisImprimer`, le même toucher).
export function ChoixPapier({ Feuille, valeur = null, puisImprimer = false, onChoisir, onFermer }) {
  return (
    <Feuille onClose={onFermer} maxWidth={460} z={9000} titre={tr('impr.papier.titre')} data-impr-papier-feuille={puisImprimer ? 'premiere' : 'changer'} data-noswipe="1">
      <p className="vrm-impr-phrase">{tr(puisImprimer ? 'impr.papier.phraseUneFois' : 'impr.papier.phrase')}</p>
      <div className="vrm-impr-papiers" role="radiogroup" aria-label={tr('impr.papier.titre')}>
        {FORMATS_IMPRESSION.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={valeur === f ? 'true' : 'false'} className="vrm-impr-papier" data-impr-papier-choix={f} data-actif={valeur === f ? '1' : undefined}
            onClick={() => onChoisir(f)}>
            <PictoPapier format={f}/>
            {/* « Classique · A4 » : le nom, puis la mesure en gris dessous (rien ne se coupe au milieu). */}
            <span className="vrm-impr-papier-nom">{tr(`impr.format.${f}`).split(' · ').map((x, i) => (i ? <span key={i} className="vrm-impr-papier-mesure">{x}</span> : <span key={i}>{x}</span>))}</span>
            <span className="vrm-sr-seul">{tr(`cp.guide.imprimante.${f}`)}</span>
            <span className="vrm-impr-diode" aria-hidden="true"/>
          </button>
        ))}
      </div>
    </Feuille>
  );
}

// UNE VIGNETTE : la vraie page du PDF produit (pdf.js, `dessiner`), jamais un dessin inventé.
function Vignette({ octets, page, dessiner, largeur = 96 }) {
  const ref = React.useRef(null);
  const [etat, setEtat] = React.useState('charge');
  React.useEffect(() => {
    let vivant = true;
    if (!octets || !ref.current || !dessiner) return undefined;
    setEtat('charge');
    dessiner(ref.current, octets, { page, largeur }).then(() => { if (vivant) setEtat('pret'); }, () => { if (vivant) setEtat('rate'); });
    return () => { vivant = false; };
  }, [octets, page, largeur, dessiner]);
  return <span className="vrm-impr-vignette-cadre" data-etat={etat}><canvas ref={ref} aria-hidden="true"/></span>;
}

// LA FEUILLE D'APRÈS. `etat` : { res, voie, etape: 'question'|'manque', manque: Set, corrige }.
export function FeuilleImpression({ Feuille, Bouton, etat, dessiner, occupe = false, pretManque = false, pretUn = false,
  onOuvrir, onOui, onManque, onBasculer, onReimprimerManque, onAnnulerManque, onCorriger, onTampon, onReimprimerUn, onDeplacer, onFermer }) {
  if (!etat || !etat.res) return null;
  const { res, voie, etape } = etat;
  const lignes = (res.plages || []).map((p) => { const it = (res.items || []).find((x) => String(x.cle) === String(p.cle)) || {}; return { cle: String(p.cle), num: it.numero || '', titre: it.title || '', page: (p.debut | 0) + 1, tampon: it.tamponVu || '', retour: !!(p.retour || it.retour) }; });
  const n = lignes.length, manque = etat.manque || new Set(), k = manque.size;
  // (16 nov., lot impression-retours) « N bordereaux dans le PDF · dont N retours » : un retour n'est jamais confondu.
  const nRetours = lignes.filter((l) => l.retour).length;
  const ouvert = voie && voie !== 'bouton';
  const corrige = etat.corrige ? lignes.find((l) => l.cle === etat.corrige) : null;
  const absents = etat.absents || [];
  const entiers = (res.entiers || []).length;
  const phrase = etape === 'manque' ? tr('impr.manque.phrase') : ouvert ? tr(`impr.voie.${voie}`) : tr('impr.voie.bouton');
  return (
    <Feuille onClose={onFermer} maxWidth={620} z={9000} titre={tr('impr.feuille.titre', { n }) + (nRetours ? ' · ' + tr('impr.retour.dont', { n: nRetours }) : '')} data-impr-feuille={etape} data-impr-voie={voie || 'bouton'} data-impr-n={n} data-impr-retours={nRetours} data-noswipe="1" className="vrm-impr-feuille">
      <p className="vrm-impr-phrase" data-impr-phrase="" data-acc-apres={etape === 'manque' ? undefined : 'colis.imprimer'}>{phrase}</p>
      {res.planche ? <p className="vrm-impr-sous" data-planche-resultat={`${res.planche.etiquettes}/${res.planche.feuilles}/${res.planche.echelle}`}>{tr('cp.planche.resultat', { etiquettes: res.planche.etiquettes, feuilles: res.planche.feuilles, echelle: res.planche.echelle })}</p> : null}
      {entiers ? <p className="vrm-impr-sous" data-impr-entiers={entiers}>{tr('impr.entiers', { n: entiers })}</p> : null}
      {absents.length ? <div className="vrm-impr-absents" data-impr-absents={absents.length}>
        <b>{tr('impr.absents', { n: absents.length })}</b>
        {absents.map((a) => <span key={a.cle} className="vrm-impr-absent" data-impr-absent={a.cle} data-impr-absent-raison={a.raison}>{a.num ? <b>N°{a.num}</b> : null} {a.titre} — {tr(`impr.raison.${a.raison}`)}</span>)}
      </div> : null}
      <div className="vrm-impr-vignettes" role="list">
        {lignes.map((l) => {
          const coche = manque.has(l.cle);
          return (
            <button key={l.cle} type="button" role="listitem" className={'vrm-impr-vignette' + (l.retour ? ' is-retour' : '')} data-impr-vignette={l.cle} data-impr-vignette-num={l.num} data-impr-vignette-retour={l.retour ? '1' : '0'} aria-pressed={etape === 'manque' ? (coche ? 'true' : 'false') : undefined}
              aria-label={etape === 'manque' ? tr('impr.manque.aria', { qui: l.num ? `N°${l.num}` : l.titre }) : l.retour ? `${tr('impr.retour.section')} · ${l.num ? `N°${l.num}` : l.titre}` : tr('impr.corriger.aria', { qui: l.num ? `N°${l.num}` : l.titre })}
              disabled={occupe} onClick={() => (etape === 'manque' ? onBasculer(l.cle) : l.retour ? null : onCorriger(l.cle))}>
              <Vignette octets={res.unitBytes} page={l.page} dessiner={dessiner}/>
              {l.retour ? <span className="vrm-impr-vignette-retour" data-retour-mot="">{tr('impr.retour.mot')}</span> : null}
              <span className="vrm-impr-vignette-num">{l.num ? `N°${l.num}` : tr('impr.sansNum')}</span>
              {etape === 'manque' ? <span className="vrm-impr-diode" aria-hidden="true"/> : null}
            </button>);
        })}
      </div>
      {etape === 'question' && !corrige ? <p className="vrm-impr-sous">{tr('impr.corriger.phrase')}</p> : null}
      {corrige && etape === 'question' ? <section className="vrm-impr-corrige" data-impr-corrige={corrige.cle} aria-label={tr('impr.corriger.titre', { qui: corrige.num ? `N°${corrige.num}` : corrige.titre })}>
        <h3>{tr('impr.corriger.titre', { qui: corrige.num ? `N°${corrige.num}` : corrige.titre })}</h3>
        <div className="vrm-impr-tampons" role="radiogroup" aria-label={tr('impr.corriger.titre', { qui: corrige.num ? `N°${corrige.num}` : corrige.titre })}>
          {TAMPONS.map((t) => <button key={t} type="button" role="radio" className="vrm-impr-touche" data-impr-tampon-choix={t} aria-checked={(etat.tamponCorrige || '') === t ? 'true' : 'false'} disabled={occupe} onClick={() => onTampon(corrige.cle, t)}>{tr(`impression.tampon.${t}`)}</button>)}
        </div>
        <div className="vrm-impr-pied">
          <button type="button" className="vrm-impr-lien" data-impr-deplacer={corrige.cle} disabled={occupe} onClick={() => onDeplacer(corrige.cle)}>{tr('impr.deplacer')}</button>
          <Bouton variante="primaire" icone="printer" data-impr-reimprimer-un={corrige.cle} data-impr-pret={pretUn ? '1' : '0'} occupe={occupe} disabled={!etat.tamponCorrige} onClick={() => onReimprimerUn(corrige.cle)}>{tr('impr.reimprimerUn')}</Bouton>
        </div>
      </section> : null}
      {!corrige ? <div className="vrm-impr-pied">
        {etape === 'manque' ? <>
          <button type="button" className="vrm-impr-lien" data-impr-annuler-manque="" onClick={onAnnulerManque}>{tr('impr.annuler')}</button>
          <Bouton variante="primaire" icone="printer" data-impr-reimprimer={k} data-impr-pret={pretManque ? '1' : '0'} occupe={occupe} disabled={!k} onClick={onReimprimerManque}>{tr('impr.reimprimer', { n: k })}</Bouton>
        </> : !ouvert ? <>
          <Bouton variante="primaire" icone="printer" data-impr-ouvrir="" href={res.url} target="_blank" rel="noopener" onClick={onOuvrir}>{tr('impr.ouvrir')}</Bouton>
        </> : <>
          <span className="vrm-impr-question" data-impr-question="">{tr('impr.question')}</span>
          <button type="button" className="vrm-impr-touche" data-impr-manque="" onClick={onManque}>{tr('impr.manque')}</button>
          <Bouton variante="primaire" icone="check" data-impr-oui="" onClick={onOui}>{tr('impr.oui')}</Bouton>
        </>}
      </div> : null}
    </Feuille>
  );
}
