// ── src/design/DisqueEventail.jsx — le disque « + » de la barre du bas et son éventail ──
// Studio bleu clair (14 nov., décision de Julien) : les actions GLOBALES quittent les écrans
// et partent d'un disque au centre de la barre du bas (téléphone). Un appui ouvre l'éventail :
// l'écran recule sous un voile de bleu éclairé par le bas, quatre gestes s'ouvrent en arc —
// Chercher · Scanner · Publier · Imprimer N (le seul plein, sous le pouce droit). On touche un
// geste, ou on GLISSE le pouce du disque vers lui et on relâche.
// Aucun geste neuf : chacun appelle un geste qui existait déjà dans l'app (`gestes`, posés par
// la coque, src/App.jsx) — la loupe, le scanner de bordereau de Ventes, « Publier ailleurs »,
// « Tout imprimer » (la feuille d'aperçu : rien n'est imprimé avant SON clic).
// « Imprimer N » : N = ce que « Tout imprimer (N) » de Ventes ferait partir, publié par Ventes
// (`vrm_colis_prets.lot`, §11 : le même nombre que son bouton) ; pas su ⇒ « Imprimer » sans nombre (jamais un 0 deviné) ;
// 0 lu ⇒ le plein désactivé, et une ligne dit pourquoi.
// Fermer : toucher le voile, Échap, le bouton retour du téléphone (`Retour` = FermeAuRetour),
// ou retoucher le disque. Mouvement réduit : fondus seulement (studio.css §8).
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';

const T = (d, taille = 21) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const ICONES_EVENTAIL = {
  plus: (t) => T(<path d="M12 5v14M5 12h14"/>, t),
  chercher: (t) => T(<><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>, t),
  scanner: (t) => T(<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 9v6M11 9v6M14 9v6M17 9v6"/></>, t),
  publier: (t) => T(<><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 14v3.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V14"/></>, t),
  imprimer: (t) => T(<><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/></>, t),
};
// L'arc : rayon 156, centré 14 px au-dessus du disque ; 152° · 111° · 69° · 28° (le plein côté pouce droit).
export const ARC = Object.freeze({ rayon: 156, dessus: 14, angles: [152, 111, 69, 28] });
export function placesEventail(cx, cy, largeur = 390) {
  const R = Math.min(ARC.rayon, Math.max(110, (largeur - 2 * 52) / 2 / Math.cos((28 * Math.PI) / 180)));
  // (16 nov., lot barre-achats) Avec Achats dans la barre, le disque n'est plus au milieu (3 onglets à gauche, 2 à
  // droite) : l'arc garde ses lames (100 px, centrées) DANS l'écran, à 8 px des bords — sinon la dernière sortait à
  // droite (banc studio-coque D). Trop étroit pour les deux bords : l'arc au milieu de l'écran.
  const bord = 8 + 50 + R * Math.cos((28 * Math.PI) / 180);
  const x0 = bord <= largeur - bord ? Math.min(largeur - bord, Math.max(bord, cx)) : largeur / 2;
  return ARC.angles.map((a) => { const r = (a * Math.PI) / 180; return { x: x0 + R * Math.cos(r), y: cy - ARC.dessus - R * Math.sin(r) }; });
}

export function DisqueEventail({ gestes = {}, nImprimer, Retour = null, ecran = '' }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [centre, setCentre] = React.useState(null);
  const [vise, setVise] = React.useState(null);
  const disque = React.useRef(null);
  const glisse = React.useRef({ actif: false, x: 0, y: 0, bouge: false, ouvertAvant: false });
  const fermer = React.useCallback(() => { setOuvert(false); setVise(null); }, []);
  // Un autre écran (un onglet touché par-dessus le voile) : l'éventail se referme.
  React.useEffect(() => { fermer(); }, [ecran, fermer]);
  const mesurer = () => { try { const r = disque.current.getBoundingClientRect(); setCentre({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: window.innerWidth }); } catch (_) {} };
  // L'écran recule pendant que l'éventail est ouvert (studio.css : html[data-sb-eventail]).
  React.useEffect(() => {
    const h = document.documentElement;
    if (ouvert) h.setAttribute('data-sb-eventail', ''); else h.removeAttribute('data-sb-eventail');
    return () => h.removeAttribute('data-sb-eventail');
  }, [ouvert]);
  React.useEffect(() => {
    if (!ouvert) return undefined;
    const k = (e) => { if (e.key === 'Escape') fermer(); };
    const r = () => mesurer();
    window.addEventListener('keydown', k); window.addEventListener('resize', r);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('resize', r); };
  }, [ouvert, fermer]);
  const connu = typeof nImprimer === 'number' && Number.isFinite(nImprimer) && nImprimer >= 0;
  const rienAImprimer = connu && nImprimer === 0;
  const lames = [
    { id: 'chercher', mot: tr('studio.chercher'), faire: gestes.chercher },
    { id: 'scanner', mot: tr('studio.scanner'), faire: gestes.scanner },
    { id: 'publier', mot: tr('studio.publier'), faire: gestes.publier },
    { id: 'imprimer', plein: true, mot: connu && nImprimer > 0 ? tr('studio.imprimerN', { n: nImprimer }) : tr('studio.imprimer'),
      sous: rienAImprimer ? tr('studio.rienAImprimer') : '', faire: rienAImprimer ? null : gestes.imprimer,
      aria: connu && nImprimer > 0 ? tr('studio.imprimerAria', { n: nImprimer }) : rienAImprimer ? tr('studio.rienAImprimerAria') : tr('studio.imprimerAriaPasSu') },
  ];
  const lancer = (l) => {
    if (!l || typeof l.faire !== 'function') return;
    fermer();
    // Le geste part APRÈS la fermeture (l'écran revient à sa place, puis la feuille s'ouvre dessus).
    setTimeout(() => { try { l.faire(); } catch (_) {} }, 0);
  };
  const laneSous = (x, y) => { try { const el = document.elementFromPoint(x, y); const b = el && el.closest && el.closest('[data-sb-lame]'); return b ? lames.find((l) => l.id === b.getAttribute('data-sb-lame')) || null : null; } catch (_) { return null; } };
  // Appui : l'éventail s'ouvre AU TOUCHER (pointer-down), sans attendre le relâcher.
  const surAppui = (e) => {
    if (e.button != null && e.button !== 0) return;
    glisse.current = { actif: true, x: e.clientX, y: e.clientY, bouge: false, ouvertAvant: ouvert };
    if (!ouvert) { mesurer(); setOuvert(true); }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const surGlisse = (e) => {
    const g = glisse.current; if (!g.actif) return;
    if (!g.bouge && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) g.bouge = true;
    if (g.bouge) { const l = laneSous(e.clientX, e.clientY); setVise(l ? l.id : null); }
  };
  const surRelache = (e) => {
    const g = glisse.current; glisse.current = { ...g, actif: false };
    if (g.bouge) { const l = laneSous(e.clientX, e.clientY); setVise(null); if (l) lancer(l); return; }
    if (g.ouvertAvant) fermer();   // retoucher le disque referme
  };
  const surAnnule = () => { glisse.current = { ...glisse.current, actif: false }; setVise(null); };
  const places = ouvert && centre ? placesEventail(centre.x, centre.y, centre.w) : null;
  return (
    <>
      <button ref={disque} type="button" className="sb-rond sb-rond--disque sb-disque" data-sb-disque="" aria-haspopup="menu" aria-expanded={ouvert}
        aria-label={ouvert ? tr('studio.fermerActions') : tr('studio.ouvrirActions')}
        onPointerDown={surAppui} onPointerMove={surGlisse} onPointerUp={surRelache} onPointerCancel={surAnnule}
        onClick={(e) => { if (e.detail === 0) { if (ouvert) fermer(); else { mesurer(); setOuvert(true); } } }}>
        {ICONES_EVENTAIL.plus(24)}
      </button>
      {ouvert && places && typeof document !== 'undefined' ? createPortal(
        <>
          <div className="sb-voile" data-sb-voile="" onClick={fermer} aria-hidden="true"/>
          {Retour ? <Retour fermer={fermer}/> : null}
          <p className="sb-astuce" style={{ top: Math.max(16, places[1].y - 90) }} aria-hidden="true">{tr('studio.astuce')}</p>
          <div className="sb-eventail" role="menu" aria-label={tr('studio.actions')} data-sb-eventail="">
            {lames.map((l, i) => {
              const p = places[i];
              const h = l.plein ? 36 : 30;
              const desactive = typeof l.faire !== 'function';
              return (
                <button key={l.id} type="button" role="menuitem" className={'sb-lame' + (vise === l.id ? ' is-vise' : '')} data-sb-lame={l.id}
                  aria-label={l.aria || l.mot} aria-disabled={desactive || undefined} data-sb-n={l.plein ? (connu ? String(nImprimer) : '') : undefined}
                  style={{ left: p.x, top: p.y - h, '--i': i, '--dx': `${(centre.x - p.x).toFixed(0)}px`, '--dy': `${(centre.y - p.y + h).toFixed(0)}px` }}
                  onClick={() => lancer(l)}>
                  {l.plein
                    ? <span className="sb-btn-plein" aria-disabled={desactive || undefined} data-sb-plein="">{ICONES_EVENTAIL.imprimer(24)}</span>
                    : <span className="sb-rond sb-rond--disque">{ICONES_EVENTAIL[l.id](23)}</span>}
                  <span className="sb-lame-mot">{l.mot}{l.sous ? <small>{l.sous}</small> : null}</span>
                </button>
              );
            })}
          </div>
        </>, document.body) : null}
    </>
  );
}
export default DisqueEventail;
