// ════════════════════════════════════════════════════════════════════════════
//  LA PILULE « ANNULER » (6 nov., v36) — le visage de src/gesteAnnulable.js
// ════════════════════════════════════════════════════════════════════════════
// Une pilule en bas de l'écran, au-dessus de la barre (iPhone), 5 s : ce qui
// vient d'être fait et « Annuler ». Elle ne prend jamais le focus (le geste en
// cours n'est pas coupé) ; VoiceOver l'annonce (zone `role=status`, polie,
// toujours montée). Survol, focus clavier ou onglet caché : le temps s'arrête.
// « Pas enregistré » : l'écran est déjà revenu en arrière, « Réessayer » rejoue.
// Une feuille ouverte : la pilule passe EN HAUT (comme les messages), pour ne
// pas couvrir le pied de la feuille.
import React from 'react';
import { createPortal } from 'react-dom';
import './pilule-annuler.css';

const TEXTES = {
  envoi: (v) => ({ titre: v.texte }),
  enregistre: (v) => ({ titre: v.texte, ok: true }),
  garde: (v) => ({ titre: v.texte, sous: 'Pas encore envoyé — gardé sur cet appareil' }),
  annulation: () => ({ titre: 'Annulation…' }),
  annule: () => ({ titre: 'Annulé' }),
  echec: (v) => ({ titre: 'Pas enregistré', sous: v.texte, alerte: true }),
  'echec-annulation': (v) => ({ titre: 'Annulation pas enregistrée', sous: v.texte, alerte: true }),
};

const Coche = () => <svg className="vrm-pil-ic" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const Alerte = () => <svg className="vrm-pil-ic is-alerte" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 3.2l7.4 13H2.6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 8.2v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="10" cy="14" r="1" fill="currentColor"/></svg>;

export function PiluleAnnuler({ gestes, enHaut = false }) {
  const [etat, setEtat] = React.useState(() => gestes.etat());
  const [sortante, setSortante] = React.useState(null);   // la dernière pilule, le temps de sa sortie
  const raisons = React.useRef({ survol: false, focus: false, cache: false });
  React.useEffect(() => gestes.abonner(setEtat), [gestes]);
  const suspendre = React.useCallback(() => { const r = raisons.current; gestes.suspendre(r.survol || r.focus || r.cache); }, [gestes]);
  React.useEffect(() => {
    const f = () => { raisons.current.cache = document.visibilityState === 'hidden'; suspendre(); };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [suspendre]);
  const v = etat.visible;
  const derniere = React.useRef(null);
  const zone = React.useRef(null);
  // (11 nov., lot DJ4) LE FOCUS ET LE SURVOL RÉELS, relus à chaque changement de la pilule.
  // Un bouton focalisé qui disparaît (« Annuler » remplacé par « Annulé ») ne déclenche aucun
  // `blur` : la raison « focus » restait vraie, la pause jamais levée, et la pilule (puis celle
  // du geste suivant, « Annuler » compris) restait affichée pour toujours.
  const relire = React.useCallback(() => {
    const z = zone.current; const r = raisons.current;
    let dedans = false, survol = false;
    try { dedans = !!(z && document.activeElement && z.contains(document.activeElement)); } catch (_) {}
    try { survol = !!(z && z.matches(':hover') && window.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch (_) {}
    // Relire ne fait que LEVER une raison périmée, jamais en inventer une (le :hover du navigateur
    // peut être en retard d'une image : seul l'événement du pointeur pose le survol).
    r.focus = r.focus && dedans; r.survol = r.survol && survol; suspendre();
  }, [suspendre]);
  React.useEffect(() => {
    if (v) { derniere.current = v; setSortante(null); relire(); return undefined; }
    raisons.current.survol = false; raisons.current.focus = false; suspendre();
    if (!derniere.current) return undefined;
    setSortante(derniere.current); derniere.current = null;
    const t = setTimeout(() => setSortante(null), 180);
    return () => clearTimeout(t);
  }, [v && v.id, v && v.etat, v && v.peutAnnuler]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (typeof document === 'undefined') return null;
  const montree = v || sortante;
  const t = montree ? (TEXTES[montree.etat] || TEXTES.envoi)(montree) : null;
  return createPortal(
    <div ref={zone} className="vrm-pil-zone" data-pilule-place={enHaut ? 'haut' : 'bas'} role="status" aria-live="polite" aria-atomic="true">
      {montree ? (
        <div key={montree.id} className={'vrm-pil' + (v ? '' : ' is-sortie') + (t.alerte ? ' is-alerte' : '')} data-pilule={montree.id} data-pilule-etat={montree.etat}
          data-acc-apres={montree.acc && !t.alerte && montree.etat !== 'annule' ? montree.acc : undefined} data-acc-echec={montree.acc && t.alerte ? montree.acc : undefined}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') { raisons.current.survol = true; suspendre(); } }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') { raisons.current.survol = false; suspendre(); } }}
          onFocus={() => { raisons.current.focus = true; suspendre(); }}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { raisons.current.focus = false; suspendre(); } }}>
          {t.alerte ? <Alerte/> : t.ok ? <Coche/> : null}
          <span className="vrm-pil-txt">
            <span className="vrm-pil-titre">{t.titre}</span>
            {t.sous ? <span className="vrm-pil-sous">{t.sous}</span> : null}
          </span>
          {v && v.peutAnnuler ? <button type="button" className="vrm-pil-action" data-pilule-annuler={v.id} aria-label={`Annuler : ${v.texte}`} onClick={() => gestes.annuler(v.id)}>Annuler</button> : null}
          {v && v.peutReessayer ? <button type="button" className="vrm-pil-action" data-pilule-reessayer={v.id} aria-label={`Réessayer : ${v.texte}`} onClick={() => gestes.reessayer(v.id)}>Réessayer</button> : null}
        </div>
      ) : null}
    </div>,
    document.body
  );
}
