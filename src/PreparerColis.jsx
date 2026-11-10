// ════════════════════════════════════════════════════════════════════════════
//  « PRÉPARER MES COLIS » PAS À PAS (9 nov., lot AD, proposition 46 validée)
//  Colis → À envoyer : un colis à la fois, plein écran (portail, `FermeAuRetour`),
//  dans l'ORDRE de la liste « À envoyer » (depuis le 9 nov. au soir, lot AJ, décision de
//  Julien : la vente la plus RÉCENTE en haut, tous comptes mélangés — src/ordreRecent.js ;
//  la date limite reste sur chaque écran ; jamais trié par emplacement, refus du 11 oct.). Chaque écran : la photo de la paire, le N°
//  en pastille, titre, taille, compte, transporteur, date limite ; le bordereau
//  (« Imprimer ce bordereau » seul, ou « Scanner » pour vérifier que c'est le bon,
//  le scanner existant) ; « Colis fait » = le geste des cartes (`marquerColisFait`
//  via `deposeScan`, « Annuler » 5 s) ; puis « Suivant ».
//  AUCUNE RÈGLE ICI : la liste, l'ordre, la paire (par n° de transaction, §5) et
//  « paire à vérifier » viennent de l'écran Colis. Une paire pas sûre n'a JAMAIS
//  de photo devinée. Sortie à tout moment ; la séance reprend où il en était
//  (src/preparerRelais.js, mémoire sur l'appareil).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { ordreDeSeance, indexDeReprise, progression, lireSeancePreparer, ecrireSeancePreparer, oublierSeancePreparer } from './preparerRelais.js';

const PHRASE_NUM = {
  double: (n) => `Deux paires portent le N°${n} : vérifie le carton avant de fermer le colis.`,
  'a-verifier': (n) => `Le N°${n} est à vérifier sur son carton.`,
  litige: (n, c) => `L’e-mail du bordereau disait N°${c.litige ? c.litige.mail : '?'}, la vente dit N°${n} : on garde celui de la vente. Vérifie le carton.`,
};

// (10 nov., lot AZ + M) `photoCarton(c)` : le geste « Photo du carton » (facultatif) d'un colis FAIT, rangé avec
// SA vente (src/photoCarton.js) — le même que celui du scanner ; l'écran le fournit, rien n'est décidé ici.
export default function PreparerColis({ colis, uid = '', attente = '', onFait, onAnnuler, onImprimer, onScanner, onFermer, Retour, Icon, Photo, zIndex, photoCarton = null }) {
  const vivants = Array.isArray(colis) ? colis : [];
  // Ce que la séance a vu (un colis fait sort de « À envoyer » après ses 5 s : la
  // séance le garde, montré fait). Le dernier état vivant l'emporte.
  const vus = React.useRef(new Map());
  for (const c of vivants) if (c && c.cle) vus.current.set(c.cle, c);
  const [seance, setSeance] = React.useState(() => lireSeancePreparer(uid));
  const memo = (seance.memo && typeof seance.memo === 'object') ? seance.memo : {};
  // L'ordre : celui de la séance (reprise), puis les colis vivants à la suite ; un
  // colis inconnu (ni vivant, ni vu, ni fait pendant la séance) n'est plus proposé.
  const ordre = ordreDeSeance(seance.ordre, vivants.map((c) => c.cle)).filter((k) => vus.current.has(k) || (seance.faits[k] && memo[k]));
  const [i, setI] = React.useState(() => indexDeReprise(ordre, seance.cle, seance.faits));
  const [fin, setFin] = React.useState(false);
  const [impression, setImpression] = React.useState('');   // '' · cle en cours d'impression
  const n = ordre.length;
  const idx = Math.min(Math.max(0, i), Math.max(0, n - 1));
  const cle = ordre[idx] || '';
  const vivant = new Set(vivants.map((c) => c.cle));
  const c = cle ? (vus.current.get(cle) || { cle, titre: (memo[cle] && memo[cle].titre) || 'Colis', num: (memo[cle] && memo[cle].num) || '', paire: 'sure' }) : null;
  const fait = !!(cle && seance.faits[cle]);
  const sorti = !!(cle && !vivant.has(cle) && !fait);
  const enAttente = !!(cle && attente && String(attente) === cle);
  const prog = progression(ordre, idx, seance.faits);

  // La séance est gardée sur l'appareil à chaque pas (reprise où il en était).
  React.useEffect(() => {
    if (!n) return;
    const s = { ...seance, ordre, cle };
    if (s.cle !== seance.cle || JSON.stringify(s.ordre) !== JSON.stringify(seance.ordre)) setSeance(s);
    ecrireSeancePreparer(uid, s);
  }, [cle, n]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const k = (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') { e.preventDefault(); onFermer(); }
      else if (e.key === 'ArrowRight' && !fin) { e.preventDefault(); suivant(); }
      else if (e.key === 'ArrowLeft' && !fin) { e.preventDefault(); precedent(); }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });
  const haut = React.useRef(null);
  React.useEffect(() => { try { if (haut.current) haut.current.scrollTop = 0; } catch (_) {} }, [idx, fin]);

  const suivant = () => { if (idx + 1 < n) setI(idx + 1); else setFin(true); };
  const precedent = () => { if (fin) { setFin(false); return; } if (idx > 0) setI(idx - 1); };
  const noter = (k, oui) => setSeance((s) => {
    const faits = { ...s.faits }; const m = { ...(s.memo || {}) };
    if (oui) { faits[k] = Date.now(); const x = vus.current.get(k); if (x) m[k] = { titre: String(x.titre || '').slice(0, 80), num: x.num || '' }; }
    else { delete faits[k]; delete m[k]; }
    const nv = { ...s, faits, memo: m }; ecrireSeancePreparer(uid, nv); return nv;
  });
  // Ce que la séance note « fait » suit l'écriture réelle : un « Colis fait » posé par le scanner (même
  // geste, même attente de 5 s) est noté ; un colis noté fait mais encore dans « À envoyer » sans
  // attente a été ANNULÉ (dans la feuille, le scanner ou la pilule) : il redevient « pas fait ».
  React.useEffect(() => {
    const a = attente ? String(attente) : '';
    const aNoter = a && vus.current.has(a) && !seance.faits[a];
    const aDefaire = Object.keys(seance.faits).filter((k) => k !== a && vivant.has(k));
    if (aNoter) noter(a, true);
    for (const k of aDefaire) noter(k, false);
  });
  // « Colis fait » : LE geste des cartes (l'écran le différe de 5 s, « Annuler »).
  const colisFait = () => { if (!c || fait || !c.peutFaire) return; try { onFait(c); } catch (_) {} noter(c.cle, true); };
  const annuler = () => { if (!enAttente) return; try { onAnnuler(); } catch (_) {} noter(cle, false); };
  const imprimer = async () => {
    if (!c || !c.pdf || impression) return;
    setImpression(c.cle);
    try { await onImprimer(c); } catch (_) {} finally { setImpression(''); }
  };
  const fermer = () => { if (n && ordre.every((k) => seance.faits[k])) oublierSeancePreparer(uid); onFermer(); };

  const nFaits = prog.faits;
  const titreTete = fin ? 'Récapitulatif' : n ? `Colis ${prog.position} sur ${prog.total}` : 'Préparer mes colis';

  const contenu = (() => {
    if (!n) return (
      <div className="vrm-emb-fin" data-preparer-vide="">
        <p className="vrm-emb-grand-texte">Aucun colis à envoyer.</p>
        <p className="vrm-emb-aide">Un colis arrive ici quand une vente attend son envoi.</p>
      </div>
    );
    if (fin) return (
      <div className="vrm-emb-fin" data-preparer-fin={nFaits}>
        <p className="vrm-emb-grand-texte">{nFaits === n ? (n > 1 ? `Les ${n} colis sont faits.` : 'Le colis est fait.') : `${nFaits} colis fait${nFaits > 1 ? 's' : ''} sur ${n}.`}</p>
        <ul className="vrm-emb-recap">
          {ordre.map((k, j) => { const x = vus.current.get(k) || { titre: (memo[k] && memo[k].titre) || 'Colis', num: (memo[k] && memo[k].num) || '' }; const f = !!seance.faits[k]; return (
            <li key={k}>
              <button type="button" className="vrm-emb-recap-ligne" data-preparer-recap={k} data-preparer-recap-fait={f ? '1' : '0'} onClick={() => { setI(j); setFin(false); }}>
                <span className={'vrm-emb-recap-num is-' + (x.etatNum || 'ok')}>{x.num ? `N°${x.num}` : '—'}</span>
                <span className="vrm-emb-recap-nom">{x.titre}</span>
                <span className="vrm-emb-recap-etat">{f ? 'colis fait' : 'pas encore'}</span>
              </button>
            </li>); })}
        </ul>
        {nFaits < n ? <p className="vrm-emb-aide">Les autres restent dans « À envoyer ».</p> : null}
      </div>
    );
    const sure = c.paire === 'sure';
    const puces = [c.taille ? (/^\d/.test(String(c.taille)) ? `Taille ${c.taille}` : String(c.taille)) : '', c.compte || '', c.transporteur || ''].filter(Boolean);
    return (
      <div className="vrm-prep" data-preparer-cle={c.cle} data-preparer-num={c.num || ''} data-preparer-paire={sure ? 'sure' : 'a-verifier'} data-preparer-site={c.site || ''} data-preparer-etat={fait ? 'fait' : sorti ? 'sorti' : 'a-faire'}>
        <div className="vrm-prep-photo">
          {sure
            ? ((c.photo && Photo && Photo(c.photo)) || <span className="vrm-prep-photo-vide" data-preparer-sans-photo="">Photo pas encore lue</span>)
            : <span className="vrm-prep-verif" data-preparer-verif="" role="note"><b>Paire à vérifier</b><span>{c.raisonPaire || 'Ce colis n’est relié à aucune vente par son n° : VRM ne montre pas de photo devinée. Regarde le bordereau et le carton.'}</span></span>}
          {c.num ? <span className={'vrm-prep-num is-' + (c.etatNum || 'ok')} data-preparer-grand-num={c.num}>N°{c.num}</span> : <span className="vrm-prep-num is-sans" data-preparer-grand-num="">Sans N°</span>}
        </div>
        {PHRASE_NUM[c.etatNum] ? <p className={'vrm-emb-alerte is-' + c.etatNum} role={c.etatNum === 'double' ? 'alert' : undefined} data-preparer-alerte={c.etatNum}>{PHRASE_NUM[c.etatNum](c.num, c)}</p> : null}
        <h2 className="vrm-prep-titre" data-preparer-titre="">{c.titre}</h2>
        {puces.length ? <p className="vrm-prep-puces">{puces.map((p, k) => <span key={k} className={k === 1 && c.compte ? 'vrm-sensible' : undefined} data-stream-type={k === 1 && c.compte ? 'compte' : undefined}>{p}</span>)}</p> : null}
        {c.limite ? <p className={'vrm-prep-limite' + (c.limiteAmbre ? ' is-ambre' : '')} data-preparer-limite="">{c.limite}</p> : null}
        <div className="vrm-prep-bord" data-preparer-bordereau={c.pdf ? 'pret' : 'absent'}>
          <span className="vrm-prep-bord-lib">Bordereau</span>
          {c.pdf || (c.suivi && onScanner) ? (
            <div className="vrm-prep-bord-gestes">
              {c.pdf ? <button type="button" className="vrm-emb-b" data-preparer-imprimer={c.cle} disabled={!!impression} onClick={imprimer}>{impression === c.cle ? 'Impression…' : 'Imprimer ce bordereau'}</button> : null}
              {c.suivi && onScanner ? <button type="button" className="vrm-emb-b" data-preparer-scanner={c.cle} onClick={() => onScanner(c)}>Scanner</button> : null}
            </div>
          ) : null}
          {c.sansBordereau ? <span className="vrm-prep-bord-note" data-preparer-sans-bord="">{c.sansBordereau}</span> : null}
          {c.lien ? <a className="vrm-emb-lien" href={c.lien} target="_blank" rel="noreferrer" data-preparer-lien="">{c.lienLib || 'Ouvrir'} ↗</a> : null}
        </div>
        {fait ? <p className="vrm-prep-fait" data-preparer-fait-note="" role="status">{enAttente ? 'Colis fait · annulable quelques secondes' : 'Colis fait ✓'}</p>
          : sorti ? <p className="vrm-emb-aide" data-preparer-sorti="">Ce colis n’est plus dans « À envoyer ».</p> : null}
        {fait && photoCarton ? photoCarton(c) : null}
      </div>
    );
  })();

  const pied = !n
    ? <button type="button" className="vrm-emb-b vrm-emb-b-plein" data-preparer-fermer-fin="" onClick={fermer}>Fermer</button>
    : fin
      ? <>
          <button type="button" className="vrm-emb-b" data-preparer-revoir="" onClick={() => { setI(0); setFin(false); }}>Revoir</button>
          <button type="button" className="vrm-emb-b vrm-emb-b-plein" data-preparer-fermer-fin="" onClick={fermer}>Fermer</button>
        </>
      : <>
          <button type="button" className="vrm-emb-b vrm-prep-fleche" data-preparer-precedent="" aria-label="Colis précédent" disabled={idx === 0} onClick={precedent}>‹</button>
          {enAttente
            ? <button type="button" className="vrm-emb-b" data-preparer-annuler={cle} onClick={annuler}>Annuler</button>
            : !fait && c && c.peutFaire && !sorti
              ? <button type="button" className="vrm-emb-b vrm-emb-b-plein" data-preparer-fait={cle} onClick={colisFait}>Colis fait</button>
              : null}
          <button type="button" className={'vrm-emb-b' + (fait || !c || !c.peutFaire || sorti || enAttente ? ' vrm-emb-b-plein' : '')} data-preparer-suivant="" onClick={suivant}>{idx + 1 < n ? 'Suivant ›' : 'Terminer'}</button>
        </>;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-emb vrm-prep-feuille" role="dialog" aria-modal="true" aria-label="Préparer mes colis" data-preparer={n} data-preparer-ordre={ordre.join(',')} data-preparer-position={fin ? 'fin' : `${prog.position}/${prog.total}`} data-preparer-faits={nFaits} data-noswipe="1" ref={haut} style={zIndex ? { zIndex } : undefined}>
      {Retour ? <Retour fermer={fermer}/> : null}
      <div className="vrm-emb-cadre">
        <header className="vrm-emb-tete">
          <button type="button" className="vrm-emb-rond" aria-label="Fermer : la séance reprendra ici" data-preparer-fermer="" onClick={fermer}>{Icon ? <Icon name="close" size={20}/> : '×'}</button>
          <span className="vrm-emb-titre" data-preparer-titre-tete="">{titreTete}{n && !fin && nFaits ? <span className="vrm-prep-faits"> · {nFaits} fait{nFaits > 1 ? 's' : ''}</span> : null}</span>
          {n && !fin ? <button type="button" className="vrm-emb-rond" aria-label="Voir tous les colis de la séance" data-preparer-liste="" onClick={() => setFin(true)}>{Icon ? <Icon name="menu" size={20}/> : '≡'}</button> : <span className="vrm-emb-rond-vide" aria-hidden="true"/>}
        </header>
        {n && !fin ? <div className="vrm-prep-barre" aria-hidden="true"><span style={{ width: `${Math.round((nFaits / n) * 100)}%` }}/></div> : null}
        <div className="vrm-emb-corps">{contenu}</div>
        <div className="vrm-emb-pied">{pied}</div>
      </div>
    </div>, document.body);
}
