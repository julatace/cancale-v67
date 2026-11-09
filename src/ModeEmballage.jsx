// ── LE MODE EMBALLAGE (1er nov., maquette « journee-mode-emballage » validée) ──
// Un écran plein, téléphone d'abord : les colis prêts UN PAR UN, dans l'ordre
// de la colonne « Prêts à imprimer » (jamais triés par emplacement — refus du
// 11 oct.). Le N° en très grand (Geist Mono) ; rouge seulement si deux paires
// présentes le portent (§5), ambre s'il est à vérifier sur son carton.
// Rien n'est posté sans SON clic : « Marquer ces colis comme postés », à la fin,
// appelle le geste existant de Colis (`onMarquer`, fourni par l'écran).
// Les cases cochées vivent sur l'appareil le temps de la séance (src/emballage.js).
import React from 'react';
import { createPortal } from 'react-dom';
import { CASES_EMBALLAGE, ordreSeance, complet, aMarquerPostes, lireSeance, ecrireSeance, oublierSeance } from './emballage.js';
import './styles-emballage.css';

const PHRASE_NUM = {
  double: (n) => `Deux paires portent le N°${n} : vérifie là où elles sont rangées avant d'emballer.`,
  'a-verifier': (n) => `Le N°${n} est à vérifier là où l'article est rangé : regarde l'étiquette avant d'emballer.`,
  sans: () => 'Aucun N° relié à cette vente : fie-toi à la photo et au titre.',
};

function Case({ libelle, coche, onBascule, cle }) {
  return (
    <button type="button" className="vrm-emb-case" role="checkbox" aria-checked={coche} data-emb-case={cle} onClick={onBascule}>
      <span className={'vrm-emb-boite' + (coche ? ' is-coche' : '')} aria-hidden="true">
        {coche ? <svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg> : null}
      </span>
      <span className="vrm-emb-case-lib">{libelle}</span>
    </button>
  );
}

export default function ModeEmballage({ colis, lecture = null, onFermer, onMarquer, Photo, Icon, Retour, onFiche }) {
  const vivants = Array.isArray(colis) ? colis : [];
  const [seance, setSeance] = React.useState(() => lireSeance());
  const [i, setI] = React.useState(0);
  const [vue, setVue] = React.useState('colis');           // colis · fin · fait
  const [fait, setFait] = React.useState(null);
  // L'ordre de la séance suit la colonne ; un nouveau prêt s'ajoute à la fin.
  const ordre = React.useMemo(() => ordreSeance(seance.ordre, vivants), [seance.ordre, vivants]);
  React.useEffect(() => { if (ordre.length !== seance.ordre.length) setSeance((s) => ({ ...s, ordre })); }, [ordre]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (vue !== 'fait') ecrireSeance(seance); }, [seance, vue]);
  const parCle = React.useMemo(() => new Map(vivants.map((c) => [c.cle, c])), [vivants]);
  // On ne propose que ce qui est encore « prêt » ; un colis sorti entre-temps
  // (Vinted l'a vu partir) est dit, une fois, en fin de séance.
  const liste = ordre.filter((cle) => parCle.has(cle));
  const sortis = ordre.length - liste.length;
  const n = liste.length;
  const idx = Math.min(i, Math.max(0, n - 1));
  const cle = liste[idx];
  const c = cle ? parCle.get(cle) : null;
  const cases = (cle && seance.cases[cle]) || {};
  const basculer = (k) => setSeance((s) => ({ ...s, cases: { ...s.cases, [cle]: { ...(s.cases[cle] || {}), [k]: !(s.cases[cle] || {})[k] } } }));
  const aMarquer = aMarquerPostes(liste, seance.cases, vivants);

  // L'écran reste allumé pendant l'emballage, si le navigateur le permet
  // (Wake Lock) ; sinon rien — aucune promesse.
  const veille = typeof navigator !== 'undefined' && !!navigator.wakeLock;
  React.useEffect(() => {
    if (!veille) return undefined;
    let verrou = null, vivant = true;
    const prendre = async () => { try { if (document.visibilityState === 'visible') { const v = await navigator.wakeLock.request('screen'); if (!vivant) v.release(); else verrou = v; } } catch (_) {} };
    prendre();
    const vis = () => { if (document.visibilityState === 'visible') prendre(); };
    document.addEventListener('visibilitychange', vis);
    return () => { vivant = false; document.removeEventListener('visibilitychange', vis); try { if (verrou) verrou.release(); } catch (_) {} };
  }, [veille]);
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  const haut = React.useRef(null);
  React.useEffect(() => { try { if (haut.current) haut.current.scrollTop = 0; } catch (_) {} }, [idx, vue]);

  const suivant = () => { if (idx + 1 < n) setI(idx + 1); else setVue('fin'); };
  const marquer = () => {
    if (!aMarquer.length) return;
    const r = onMarquer(aMarquer.map((k) => parCle.get(k)));
    setFait({ n: Number.isFinite(r) ? r : aMarquer.length });
    oublierSeance();
    setVue('fait');
  };
  const titreTete = vue === 'colis' && n ? `Colis ${idx + 1} sur ${n}` : vue === 'fait' ? 'Terminé' : 'Récapitulatif';

  const contenu = (() => {
    if (vue === 'fait') return (
      <div className="vrm-emb-fin" data-emb-fait={fait ? fait.n : 0}>
        <p className="vrm-emb-grand-texte">{fait && fait.n > 1 ? `${fait.n} colis marqués postés.` : '1 colis marqué posté.'}</p>
        <p className="vrm-emb-aide">Ils sortent de « Prêts à imprimer ». Vinted confirmera l'envoi au premier passage chez le transporteur.</p>
      </div>
    );
    if (!n) return (
      <div className="vrm-emb-fin" data-emb-vide="">
        <p className="vrm-emb-grand-texte">{lecture || 'Aucun colis prêt à emballer.'}</p>
        {!lecture && <p className="vrm-emb-aide">Un colis arrive ici quand son bordereau est prêt à imprimer.</p>}
      </div>
    );
    if (vue === 'fin') return (
      <div className="vrm-emb-fin" data-emb-recap={aMarquer.length}>
        <ul className="vrm-emb-recap">
          {liste.map((k, j) => { const x = parCle.get(k); const cs = seance.cases[k] || {}; const nb = CASES_EMBALLAGE.filter((q) => cs[q.cle]).length; return (
            <li key={k}>
              <button type="button" className="vrm-emb-recap-ligne" data-emb-recap-cle={k} data-emb-complet={complet(cs) ? '1' : '0'} onClick={() => { setI(j); setVue('colis'); }}>
                <span className={'vrm-emb-recap-num is-' + x.etatNum}>{x.num ? `N°${x.num}` : '—'}</span>
                <span className="vrm-emb-recap-nom">{x.nom}</span>
                <span className="vrm-emb-recap-etat">{complet(cs) ? 'prêt à marquer' : `${nb}/3 cases`}</span>
              </button>
            </li>); })}
        </ul>
        {sortis > 0 && <p className="vrm-emb-aide" data-emb-sortis={sortis}>{sortis > 1 ? `${sortis} colis ne sont plus` : '1 colis n’est plus'} dans « Prêts à imprimer » (Vinted l’a vu partir) : rien à marquer.</p>}
        <p className="vrm-emb-aide">{aMarquer.length === liste.length ? 'Les trois cases sont cochées pour chaque colis.' : 'Seuls les colis dont les trois cases sont cochées seront marqués. Les autres restent dans « Prêts à imprimer ».'}</p>
      </div>
    );
    const etat = c.etatNum;
    return (
      <div className="vrm-emb-colis" data-emb-cle={c.cle} data-emb-num={c.num || ''} data-emb-etat-num={etat}>
        <p className="vrm-emb-sur">N° de rangement</p>
        <div className={'vrm-emb-num is-' + etat} data-emb-grand-num="">{c.num || '—'}</div>
        {PHRASE_NUM[etat] && <p className={'vrm-emb-alerte is-' + etat} role={etat === 'double' ? 'alert' : undefined} data-emb-alerte={etat}>{PHRASE_NUM[etat](c.num)}</p>}
        <div className="vrm-emb-produit">
          <span className="vrm-emb-photo">{(c.photo && Photo && Photo(c.photo)) || <span className="vrm-emb-photo-vide" aria-hidden="true"/>}</span>
          <span className="vrm-emb-produit-txt">
            <span className="vrm-emb-nom">{c.nom}</span>
            {c.sous ? <span className="vrm-emb-sous">{c.sous}</span> : null}
          </span>
        </div>
        <div className="vrm-emb-ou" data-emb-emplacement={c.emplacement.etat}>
          <span className="vrm-emb-ou-lib">Où est la paire</span>
          <span className="vrm-emb-ou-txt">{c.emplacement.texte}</span>
          {c.emplacement.detail ? <span className="vrm-emb-ou-detail">{c.emplacement.detail}</span> : null}
        </div>
        {c.transport ? <p className="vrm-emb-transport" data-emb-transport="">{c.transport}</p> : null}
        <div className="vrm-emb-cases" role="group" aria-label="Avant de passer au suivant">
          {CASES_EMBALLAGE.map((q) => <Case key={q.cle} cle={q.cle} libelle={q.cle === 'colle' && c.transporteur ? `Bordereau ${c.transporteur} collé` : q.libelle} coche={!!cases[q.cle]} onBascule={() => basculer(q.cle)}/>)}
        </div>
        {onFiche && c.num ? <button type="button" className="vrm-emb-lien" data-emb-fiche={c.num} onClick={() => onFiche(c.num)}>Toute l'histoire du N°{c.num} ›</button> : null}
      </div>
    );
  })();

  const pied = vue === 'fait' || !n
    ? <button type="button" className="vrm-emb-b vrm-emb-b-plein" data-emb-fermer-fin="" onClick={onFermer}>Fermer</button>
    : vue === 'fin'
      ? <>
          <button type="button" className="vrm-emb-b" onClick={() => { setI(0); setVue('colis'); }}>Revoir</button>
          <button type="button" className="vrm-emb-b vrm-emb-b-plein" data-emb-marquer={aMarquer.length} disabled={!aMarquer.length} onClick={marquer}>
            {aMarquer.length > 1 ? `Marquer ces ${aMarquer.length} colis comme postés` : aMarquer.length === 1 ? 'Marquer ce colis comme posté' : 'Aucun colis complet'}
          </button>
        </>
      : <>
          <button type="button" className="vrm-emb-b" data-emb-passer="" onClick={suivant}>Passer</button>
          <button type="button" className="vrm-emb-b vrm-emb-b-plein" data-emb-suivant="" onClick={suivant}>{idx + 1 < n ? (complet(cases) ? 'Emballé · colis suivant' : 'Colis suivant') : 'Terminer'}</button>
        </>;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-emb" role="dialog" aria-modal="true" aria-label="Mode emballage" data-emballage={n} data-emb-vue={vue} data-emb-ordre={liste.join(',')} data-emb-veille={veille ? '1' : '0'} data-noswipe="1" ref={haut}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-emb-cadre">
        <header className="vrm-emb-tete">
          <button type="button" className="vrm-emb-rond" aria-label="Fermer le mode emballage" data-emb-fermer="" onClick={onFermer}>{Icon ? <Icon name="close" size={20}/> : '×'}</button>
          <span className="vrm-emb-titre" data-emb-titre="">{titreTete}</span>
          {vue === 'colis' && n ? <button type="button" className="vrm-emb-rond" aria-label="Voir tous les colis de la séance" data-emb-liste="" onClick={() => setVue('fin')}>{Icon ? <Icon name="menu" size={20}/> : '≡'}</button> : <span className="vrm-emb-rond-vide" aria-hidden="true"/>}
        </header>
        <div className="vrm-emb-corps">{contenu}</div>
        <div className="vrm-emb-pied">{pied}</div>
      </div>
    </div>, document.body);
}
