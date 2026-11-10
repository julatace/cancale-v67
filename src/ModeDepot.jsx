// ════════════════════════════════════════════════════════════════════════════
//  MODE « DÉPÔT » (10 nov., lot AU ; hors ligne : lot AY)
//  Au point relais, les colis à DÉPOSER sur un écran plein (portail,
//  `FermeAuRetour`), groupés par transporteur (logos, src/transporteursVisuels.js),
//  dans l'ordre de la liste « À envoyer ». Il scanne chaque bordereau (la caméra du
//  scanner, `useLectureCamera`) : le colis qui porte EXACTEMENT ce n° de suivi se
//  coche — le geste existant, passé par l'écran (`onDeposer`) : en ligne « Colis
//  fait » annulable 5 s, hors ligne le « Déposé » gardé dans la file d'envoi.
//  Un bordereau absent de la liste ⇒ « Pas dans tes colis à déposer », rien
//  d'écrit. Barre « 3 sur 5 déposés » ; tout coché ⇒ « Tout est déposé » en grand.
//  Sans caméra : le n° se tape. L'écran reste allumé (Wake Lock, comme le mode
//  relais). AUCUNE RÈGLE ICI (src/modeDepot.js). Pas d'import paresseux : il doit
//  s'ouvrir sans réseau.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { useLectureCamera, vibrer, creerBip } from './ScannerColis.jsx';
import { useEcranAllume } from './ModeRelais.jsx';
import { LogoTransporteur, LogoInconnu } from './PastilleTransporteur.jsx';
import { ordreDeSeance } from './preparerRelais.js';
import { progressionDepot, groupesDepot, trouverDepot, enFileDepot, estDepose, heureVue } from './modeDepot.js';
import './styles-mode-depot.css';

export default function ModeDepot({ colis, etatDe = () => '', onDeposer, onAnnuler, onFermer, Retour, Icon, horsLigne = false, vueA = null, zIndex }) {
  const vivants = Array.isArray(colis) ? colis.filter((c) => c && c.cle) : [];
  // La séance : un colis coché sort de « À envoyer » après ses 5 s ; elle le garde à sa place, coché.
  const vus = React.useRef(new Map());
  for (const c of vivants) vus.current.set(c.cle, c);
  const [ordreS, setOrdreS] = React.useState(() => vivants.map((c) => c.cle));
  const ordre = ordreDeSeance(ordreS, vivants.map((c) => c.cle));
  React.useEffect(() => { if (ordre.length !== ordreS.length) setOrdreS(ordre); }); // eslint-disable-line react-hooks/exhaustive-deps
  const [faits, setFaits] = React.useState({});   // cle ⇒ instant du geste dans cette séance
  const vivant = new Set(vivants.map((c) => c.cle));
  const etat = (c) => { const e = c ? etatDe(c) : ''; if (e) return e; return c && faits[c.cle] && !vivant.has(c.cle) ? 'fait' : ''; };
  const liste = ordre.map((k) => { const c = vus.current.get(k); return c ? (vivant.has(k) || faits[k] ? c : { ...c, sorti: true }) : null; }).filter(Boolean);
  // Un colis noté ici mais encore dans la liste sans attente a été ANNULÉ (ici ou ailleurs) : il redevient à déposer.
  React.useEffect(() => {
    const aDefaire = Object.keys(faits).filter((k) => vivant.has(k) && !etatDe(vus.current.get(k)));
    if (aDefaire.length) setFaits((f) => { const u = { ...f }; aDefaire.forEach((k) => delete u[k]); return u; });
  });
  const prog = progressionDepot(liste, etat);
  const nFile = horsLigne ? enFileDepot(liste, etat) : 0;
  const [masqueTout, setMasqueTout] = React.useState(false);
  React.useEffect(() => { if (!prog.tout) setMasqueTout(false); }, [prog.tout]);
  const veille = useEcranAllume();

  const deposer = (c) => {
    if (!c || !c.peutFaire || c.sorti || estDepose(etat(c))) return false;
    try { onDeposer(c); } catch (_) { return false; }
    setFaits((f) => ({ ...f, [c.cle]: Date.now() }));
    return true;
  };
  const annuler = (c) => { if (!c || etat(c) !== 'attente') return; try { onAnnuler(c); } catch (_) {} setFaits((f) => { const u = { ...f }; delete u[c.cle]; return u; }); };

  // ── LE SCAN ──
  const video = React.useRef(null);
  const [res, setRes] = React.useState(null);   // { etat, colis, n, lu }
  const ref = React.useRef({}); ref.current.liste = liste; ref.current.etat = etat; ref.current.deposer = deposer;
  const bip = React.useRef(null); if (!bip.current) bip.current = creerBip();
  const n = React.useRef(0);
  const traiter = React.useCallback((brut) => {
    const r = trouverDepot(brut, ref.current.liste, ref.current.etat);
    if (r.etat === 'vide') return;
    let e = r.etat;
    if (e === 'trouve' && !ref.current.deposer(r.colis)) e = 'deja';
    n.current += 1; const ok = e === 'trouve';
    vibrer(ok ? 40 : [30, 60, 30]); bip.current(ok);
    setRes({ etat: e, colis: r.colis || null, n: n.current, lu: String(brut) });
  }, []);
  const camera = useLectureCamera(video, traiter);
  const saisieRef = React.useRef(null);
  const [saisie, setSaisie] = React.useState('');
  React.useEffect(() => { if (camera === 'sans') { try { if (saisieRef.current) saisieRef.current.focus({ preventScroll: true }); } catch (_) {} } }, [camera]);
  const valider = (e) => { e.preventDefault(); const s = saisie.trim(); if (!s) return; traiter(s); setSaisie(''); };

  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);

  const groupes = groupesDepot(liste);
  const rc = res && res.colis && !Array.isArray(res.colis) ? res.colis : null;
  const rcEtat = rc ? etat(rc) : '';
  const vue = horsLigne ? heureVue(vueA) : '';
  const tout = prog.tout && !masqueTout;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-depot" role="dialog" aria-modal="true" aria-label="Je dépose" data-depot={liste.length} data-depot-ordre={liste.map((c) => c.cle).join(',')}
      data-depot-progres={`${prog.deposes}/${prog.total}`} data-depot-hors-ligne={horsLigne ? '1' : '0'} data-depot-veille={veille} data-depot-camera={camera} data-noswipe="1" style={zIndex ? { zIndex } : undefined}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-depot-cadre">
        <header className="vrm-depot-tete">
          <button type="button" className="vrm-depot-rond" aria-label="Fermer" data-depot-fermer="" onClick={onFermer}>{Icon ? <Icon name="close" size={22}/> : '×'}</button>
          <span className="vrm-depot-titre">Je dépose</span>
          <span className="vrm-depot-rond-vide" aria-hidden="true"/>
        </header>
        {horsLigne ? <p className="vrm-depot-hl" data-depot-vue={vueA || ''}>Hors ligne · liste {vue || 'gardée ici'}</p> : null}
        {nFile ? <p className="vrm-depot-file" data-depot-file={nFile} role="status">{nFile} dépôt{nFile > 1 ? 's' : ''} à envoyer</p> : null}
        {prog.total ? (
          <div className="vrm-depot-progres" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.deposes} aria-label={`${prog.deposes} sur ${prog.total} déposés`}>
            <span className="vrm-depot-progres-n" data-depot-compte=""><b>{prog.deposes}</b> sur {prog.total} déposés</span>
            <span className="vrm-depot-barre" aria-hidden="true"><span style={{ width: `${Math.round((prog.deposes / prog.total) * 100)}%` }}/></span>
          </div>
        ) : null}
        <div className="vrm-depot-scan">
          <div className="vrm-depot-video">
            <video ref={video} playsInline muted autoPlay aria-hidden="true"/>
            {camera === 'sans' ? <p className="vrm-depot-sans" data-depot-sans-camera="">Pas de caméra : tape le n° du bordereau.</p> : <span className="vrm-depot-viseur" aria-hidden="true"/>}
          </div>
          <div className="vrm-depot-res" role="status" aria-live="assertive" data-depot-resultat={res ? res.etat : ''} data-depot-res-cle={rc ? rc.cle : ''} data-depot-n={res ? res.n : 0}>
            {!res ? <span className="vrm-depot-attente">Scanne chaque bordereau.</span>
              : rc && (res.etat === 'trouve' || res.etat === 'deja') ? (
                <span className="vrm-depot-res-paire">
                  {rc.num ? <b className="vrm-depot-res-num">N°{rc.num}</b> : null}
                  <span className="vrm-depot-res-titre">{rc.titre}</span>
                  <span className={'vrm-depot-res-etat' + (res.etat === 'deja' ? ' is-deja' : '')}>{res.etat === 'deja' ? 'Déjà déposé' : 'Déposé ✓'}</span>
                  {rcEtat === 'attente' && !horsLigne ? <button type="button" className="vrm-depot-b" data-depot-res-annuler={rc.cle} onClick={() => annuler(rc)}>Annuler</button> : null}
                </span>)
              : <span className="vrm-depot-res-non" data-depot-message="">{res.etat === 'ambigu' ? `${Array.isArray(res.colis) ? res.colis.length : 2} colis portent ce n° : vérifie` : 'Pas dans tes colis à déposer'}<small>{res.lu} · rien n’est coché</small></span>}
          </div>
          <form className="vrm-depot-saisie" onSubmit={valider}>
            <input ref={saisieRef} data-depot-saisie="" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="N° du bordereau" inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-label="N° de suivi du bordereau"/>
            <button type="submit" data-depot-ok="" disabled={!saisie.trim()}>OK</button>
          </form>
        </div>
        {!liste.length ? <p className="vrm-depot-vide" data-depot-vide="">Aucun colis à déposer.</p> : null}
        {groupes.map((g) => (
          <section key={g.cle} className="vrm-depot-groupe" data-depot-groupe={g.trCle || g.nom || 'inconnu'}>
            <h3 className="vrm-depot-groupe-tete">
              <span className="vrm-depot-logo" aria-hidden="true">{g.trCle ? <LogoTransporteur cle={g.trCle} taille={26} repli={<LogoInconnu taille={26}/>}/> : <LogoInconnu taille={26}/>}</span>
              <span className="vrm-depot-groupe-nom">{g.nom || 'Transporteur inconnu'}</span>
              <span className="vrm-depot-groupe-n">{g.colis.length}</span>
            </h3>
            <ul className="vrm-depot-liste">
              {g.colis.map((c) => {
                const e = etat(c); const fait = estDepose(e);
                return (
                  <li key={c.cle} className={'vrm-depot-colis' + (fait ? ' is-fait' : '') + (c.sorti ? ' is-sorti' : '')} data-depot-colis={c.cle} data-depot-etat={c.sorti ? 'sorti' : fait ? e : c.peutFaire ? 'a-deposer' : (c.raison || 'non')}>
                    <span className={'vrm-depot-coche' + (fait ? ' is-oui' : '')} aria-hidden="true">{fait ? '✓' : ''}</span>
                    <span className="vrm-depot-quoi">
                      <span className="vrm-depot-l1">{c.num ? <b className="vrm-depot-num">N°{c.num}</b> : null}<span className="vrm-depot-t">{c.titre}</span></span>
                      {c.sorti ? <span className="vrm-depot-l2">Plus à déposer</span>
                        : e === 'attente' ? <span className="vrm-depot-l2" data-depot-attente="">{horsLigne ? 'Part au retour du réseau' : 'Déposé · annulable 5 s'}</span>
                        : c.raison === 'ebay' ? <span className="vrm-depot-l2">Suivi dans eBay</span>
                        : c.raison === 'sans-identite' ? <span className="vrm-depot-l2">Il faut le réseau</span>
                        : c.sansBordereau && !fait ? <span className="vrm-depot-l2">Bordereau pas encore là</span> : null}
                    </span>
                    {e === 'attente' ? <button type="button" className="vrm-depot-b" data-depot-annuler={c.cle} onClick={() => annuler(c)}>Annuler</button>
                      : !fait && c.peutFaire && !c.sorti ? <button type="button" className="vrm-depot-b" data-depot-deposer={c.cle} onClick={() => deposer(c)}>Déposé</button> : null}
                  </li>);
              })}
            </ul>
          </section>
        ))}
      </div>
      {tout ? (
        <div className="vrm-depot-tout" role="alertdialog" aria-label="Tout est déposé" data-depot-tout={prog.total}>
          <span className="vrm-depot-tout-coche" aria-hidden="true">✓</span>
          <p className="vrm-depot-tout-t">Tout est déposé</p>
          {nFile ? <p className="vrm-depot-tout-s">{nFile} dépôt{nFile > 1 ? 's' : ''} à envoyer au retour du réseau</p> : null}
          <div className="vrm-depot-tout-gestes">
            <button type="button" className="vrm-depot-b" data-depot-revoir="" onClick={() => setMasqueTout(true)}>Revoir</button>
            <button type="button" className="vrm-depot-b vrm-depot-b-plein" data-depot-fini="" onClick={onFermer}>Fermer</button>
          </div>
        </div>
      ) : null}
    </div>, document.body);
}
