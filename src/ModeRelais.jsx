// ════════════════════════════════════════════════════════════════════════════
//  MODE RELAIS (9 nov., lot AD, proposition 48 validée)
//  Au comptoir du point relais : les colis À RETIRER un par un, plein écran
//  (portail, `FermeAuRetour`) — le code de retrait (et son QR s'il existe) en très
//  grand, le nom du point, le titre de l'achat. Fond blanc plein, encre noire, en
//  grand contraste MÊME en mode sombre (un scanner de comptoir lit mieux un fond
//  clair). L'écran ne peut pas régler la luminosité du téléphone : c'est DIT, une
//  ligne. L'écran ne se met pas en veille pendant le mode si le navigateur le
//  permet (Wake Lock) ; sinon rien, aucune promesse.
//  Suivant / précédent : glisser sur la carte du code (permis DANS cette feuille ;
//  la décision du 9 nov. ne retire que le balayage ENTRE onglets) ou ‹ ›.
//  « Retiré » sous chaque code = le geste « J'ai retiré » des cartes (l'écran le
//  fournit), « Annuler » 5 s. Aucune règle ici : la liste est EXACTEMENT celle
//  publiée dans `vrm_colis_retirer` (l'écran Colis la passe), ou, hors ligne, les
//  codes gardés sur l'appareil (« codes de retrait hors ligne », G9).
//  Pas d'import paresseux : il doit s'ouvrir sans réseau.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { ordreDeSeance, ordreRelais, pointsDeSeance, cleDuPoint, sensGlisse } from './preparerRelais.js';
import { heureVue } from './modeDepot.js';

const DUREE_ANNULER = 5000;

// Garder l'écran allumé pendant le mode (Wake Lock), le rendre en sortant.
// (10 nov., lot AU) Exporté : le mode « dépôt » (src/ModeDepot.jsx) garde l'écran allumé de la même façon.
export function useEcranAllume() {
  const [etat, setEtat] = React.useState(() => (typeof navigator !== 'undefined' && navigator.wakeLock && typeof navigator.wakeLock.request === 'function') ? 'demande' : 'absent');
  React.useEffect(() => {
    if (!(typeof navigator !== 'undefined' && navigator.wakeLock && typeof navigator.wakeLock.request === 'function')) return undefined;
    let verrou = null, vivant = true;
    const prendre = async () => {
      try {
        if (document.visibilityState !== 'visible' || verrou) return;
        const v = await navigator.wakeLock.request('screen');
        if (!vivant) { try { await v.release(); } catch (_) {} return; }
        verrou = v; setEtat('actif');
        try { v.addEventListener && v.addEventListener('release', () => { if (verrou === v) verrou = null; }); } catch (_) {}
      } catch (_) { if (vivant) setEtat('refuse'); }
    };
    prendre();
    const vis = () => { if (document.visibilityState === 'visible') prendre(); };
    document.addEventListener('visibilitychange', vis);
    return () => { vivant = false; document.removeEventListener('visibilitychange', vis); const v = verrou; verrou = null; try { if (v) v.release(); } catch (_) {} };
  }, []);
  return etat;
}

// (10 nov., lot AY) `vueA` : hors ligne, l'instant où ces codes ont été lus pour la dernière fois (« codes vus à 14:02 ») —
// jamais présentés comme frais.
// `Photo` : <PhotoVinted> de l'app (référent coupé, secours, sonde) — une photo d'achat est une photo Vinted (audit-photos-vinted).
export default function ModeRelais({ colis, onRetire, onAnnuler, onFermer, Retour, Icon, Photo = null, horsLigne = false, note = '', vueA = null, zIndex }) {
  const vivants = React.useMemo(() => ordreRelais(Array.isArray(colis) ? colis : []), [colis]);
  // Un colis « Retiré » sort de « à retirer » tout de suite (le geste est optimiste) :
  // la séance le garde à sa place, montré retiré, avec « Annuler » 5 s.
  const vus = React.useRef(new Map());
  for (const c of vivants) if (c && c.cle) vus.current.set(c.cle, c);
  const [ordreSeance, setOrdreSeance] = React.useState(() => vivants.map((c) => c.cle));
  const ordreTout = ordreDeSeance(ordreSeance, vivants.map((c) => c.cle));
  React.useEffect(() => { if (ordreTout.length !== ordreSeance.length) setOrdreSeance(ordreTout); }); // eslint-disable-line react-hooks/exhaustive-deps
  const [retires, setRetires] = React.useState({});      // cle ⇒ { id, at }
  const [point, setPoint] = React.useState('');          // '' = tous les points
  const points = pointsDeSeance(ordreTout.map((k) => vus.current.get(k)).filter(Boolean));
  const ordre = point ? ordreTout.filter((k) => cleDuPoint(vus.current.get(k)) === point) : ordreTout;
  const [i, setI] = React.useState(0);
  const n = ordre.length;
  const idx = Math.min(Math.max(0, i), Math.max(0, n - 1));
  const cle = ordre[idx] || '';
  const c = cle ? vus.current.get(cle) : null;
  const vivant = new Set(vivants.map((x) => x.cle));
  const r = cle ? retires[cle] : null;
  const [maintenant, setMaintenant] = React.useState(Date.now());
  const peutAnnuler = !!(r && r.id != null && maintenant - r.at < DUREE_ANNULER);
  React.useEffect(() => { if (!r) return undefined; const t = setTimeout(() => setMaintenant(Date.now()), Math.max(50, DUREE_ANNULER - (Date.now() - r.at) + 30)); return () => clearTimeout(t); }, [r]);
  const sorti = !!(c && !vivant.has(cle) && !r);
  const veille = useEcranAllume();

  React.useEffect(() => {
    const k = (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') { e.preventDefault(); onFermer(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); aller(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); aller(-1); }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });
  const aller = (d) => setI((x) => Math.min(Math.max(0, Math.min(x, n - 1) + d), Math.max(0, n - 1)));
  // Glisser sur la carte du code : suivant / précédent (DANS la feuille seulement).
  const glisse = React.useRef(null);
  const debut = (e) => { const p = e.touches ? e.touches[0] : e; glisse.current = { x: p.clientX, y: p.clientY }; };
  const finGlisse = (e) => {
    const g = glisse.current; glisse.current = null; if (!g) return;
    const p = e.changedTouches ? e.changedTouches[0] : e;
    const s = sensGlisse(p.clientX - g.x, p.clientY - g.y);
    if (s === -1) aller(1); else if (s === 1) aller(-1);
  };
  const retirer = () => {
    if (!c || r || horsLigne || !onRetire) return;
    let id = null; try { id = onRetire(c); } catch (_) { id = null; }
    const at = Date.now(); setMaintenant(at);
    setRetires((m) => ({ ...m, [c.cle]: { id: id == null ? null : id, at } }));
  };
  const annuler = () => {
    if (!peutAnnuler || !onAnnuler) return;
    try { onAnnuler(r.id); } catch (_) {}
    setRetires((m) => { const u = { ...m }; delete u[cle]; return u; });
  };
  const nRetires = ordreTout.filter((k) => retires[k]).length;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-relais" role="dialog" aria-modal="true" aria-label="Mode relais" data-relais={n} data-relais-ordre={ordre.join(',')} data-relais-idents={ordreTout.map((k) => (vus.current.get(k) || {}).ident || '').join(',')}
      data-relais-position={n ? `${idx + 1}/${n}` : '0/0'} data-relais-veille={veille} data-relais-hors-ligne={horsLigne ? '1' : '0'} data-noswipe="1" style={zIndex ? { zIndex } : undefined}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-relais-cadre">
        <header className="vrm-relais-tete">
          <button type="button" className="vrm-relais-rond" aria-label="Fermer le mode relais" data-relais-fermer="" onClick={onFermer}>{Icon ? <Icon name="close" size={22}/> : '×'}</button>
          <span className="vrm-relais-titre">{n ? `${idx + 1} sur ${n}` : 'Mode relais'}{nRetires ? <span className="vrm-relais-sous"> · {nRetires} retiré{nRetires > 1 ? 's' : ''}</span> : null}</span>
          <span className="vrm-relais-rond-vide" aria-hidden="true"/>
        </header>
        {horsLigne ? <p className="vrm-relais-lum vrm-relais-vue" data-relais-vue={vueA || ''}>Hors ligne · codes {heureVue(vueA, Date.now(), 'vus') || 'gardés ici'}</p> : null}
        <p className="vrm-relais-lum" data-relais-luminosite="">Monte la luminosité au maximum : VRM ne peut pas la régler.{veille === 'actif' ? ' L’écran reste allumé.' : ''}</p>
        {points.length > 1 ? (
          <div className="vrm-relais-points" role="group" aria-label="Le point où tu es">
            <button type="button" className={'vrm-relais-point' + (!point ? ' is-choisi' : '')} aria-pressed={!point} data-relais-point="" onClick={() => { setPoint(''); setI(0); }}>Tous · {ordreTout.length}</button>
            {points.map((p) => <button key={p.cle} type="button" className={'vrm-relais-point' + (point === p.cle ? ' is-choisi' : '')} aria-pressed={point === p.cle} data-relais-point={p.cle} onClick={() => { setPoint(p.cle); setI(0); }}>{p.nom} · {p.n}</button>)}
          </div>
        ) : null}
        {!n ? (
          <div className="vrm-relais-vide" data-relais-vide="">
            <p className="vrm-relais-grand">Aucun colis à retirer.</p>
            {note ? <p className="vrm-relais-note">{note}</p> : null}
          </div>
        ) : (
          <div className="vrm-relais-carte" data-relais-cle={cle} data-relais-ident={c.ident || ''} data-relais-etat={r ? 'retire' : sorti ? 'sorti' : 'a-retirer'}
            onTouchStart={debut} onTouchEnd={finGlisse} onPointerDown={(e) => { if (e.pointerType === 'mouse') debut(e); }} onPointerUp={(e) => { if (e.pointerType === 'mouse') finGlisse(e); }}>
            <p className="vrm-relais-lieu" data-relais-lieu="">{c.lieu || 'Point pas encore connu'}</p>
            {c.adresse ? <p className="vrm-relais-adresse">{c.adresse}</p> : null}
            <div className="vrm-relais-codes">
              {c.code2 ? <div className="vrm-relais-code-bloc"><span className="vrm-relais-code-lib">Identifiant</span><span className="vrm-relais-code vrm-sensible" data-stream-type="code" data-relais-code2={c.code2}>{c.code2}</span></div> : null}
              {c.code ? <div className="vrm-relais-code-bloc"><span className="vrm-relais-code-lib">{c.code2 ? 'Code d’ouverture' : 'Code de retrait'}</span><span className="vrm-relais-code vrm-sensible" data-stream-type="code" data-relais-code={c.code}>{c.code}</span></div> : null}
              {c.qr ? <img className="vrm-relais-qr" data-relais-qr="" src={c.qr} alt="QR de retrait" draggable={false}/> : null}
              {/* (10 nov., retraits irréprochables) Deux sources, deux codes : les deux, avec leur source — jamais un choix silencieux. */}
              {!c.code && Array.isArray(c.desaccord) && c.desaccord.length > 1 ? <div className="vrm-relais-code-bloc" data-relais-desaccord=""><span className="vrm-relais-code-lib" style={{ color: 'var(--vrm-warn, #B25000)' }}>Deux codes différents — essaie l’un puis l’autre</span>
                {c.desaccord.map((d) => <span key={d.source + d.code} className="vrm-relais-code vrm-sensible" data-stream-type="code" data-relais-desaccord-code={d.code}>{d.code} <small style={{ fontSize: '0.35em', fontWeight: 500 }}>{d.source === 'message' ? 'message' : d.source === 'sms' ? 'SMS' : 'e-mail'}</small></span>)}</div> : null}
              {!c.code && !c.code2 && !c.qr && !(Array.isArray(c.desaccord) && c.desaccord.length > 1) ? <p className="vrm-relais-sans" data-relais-sans-code="">{c.sansQrHorsLigne ? 'Son QR a besoin d’internet pour s’afficher : donne ton nom ou le n° de suivi au comptoir.' : 'Code pas encore lu : donne ton nom ou le n° de suivi au comptoir.'}</p> : null}
            </div>
            {c.suivi ? <p className="vrm-relais-suivi">n° {c.suivi}</p> : null}
            <div className="vrm-relais-achat">
              {c.photo && Photo ? <Photo className="vrm-relais-photo" data-vrm-vignette="" src={c.photo} alt="" decoding="async"/> : null}
              <span className="vrm-relais-achat-titre" data-relais-titre="">{c.titre}</span>
            </div>
            <div className="vrm-relais-geste">
              {horsLigne ? <p className="vrm-relais-note">Hors ligne : « Retiré » se note quand VRM répond.</p>
                : r ? (<>
                    <span className="vrm-relais-fait" data-relais-retire-note="" role="status">Retiré ✓</span>
                    {peutAnnuler ? <button type="button" className="vrm-relais-b" data-relais-annuler={cle} onClick={annuler}>Annuler</button> : null}
                  </>)
                : sorti ? <p className="vrm-relais-note" data-relais-sorti="">Ce colis n’est plus à retirer.</p>
                : <button type="button" className="vrm-relais-b vrm-relais-b-plein" data-relais-retirer={cle} onClick={retirer}>Retiré</button>}
            </div>
          </div>
        )}
        {n ? (
          <nav className="vrm-relais-pied" aria-label="Colis précédent ou suivant">
            <button type="button" className="vrm-relais-b vrm-relais-fleche" data-relais-precedent="" aria-label="Colis précédent" disabled={idx === 0} onClick={() => aller(-1)}>‹</button>
            <span className="vrm-relais-points-pos" aria-hidden="true">{ordre.map((k, j) => <i key={k} className={(j === idx ? 'is-ici' : '') + (retires[k] ? ' is-fait' : '')}/>)}</span>
            <button type="button" className="vrm-relais-b vrm-relais-fleche" data-relais-suivant="" aria-label="Colis suivant" disabled={idx >= n - 1} onClick={() => aller(1)}>›</button>
          </nav>
        ) : null}
      </div>
    </div>, document.body);
}
