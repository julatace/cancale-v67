// ── MA JOURNÉE · « STUDIO BLEU CLAIR » (14 nov. 2026, décision de Julien) ──────────────────────
// La grille Bento de Ma journée : des tuiles en porcelaine posées sous une lumière de studio,
// chacune porte SON geste réel. Toucher une tuile (ou son « + », qui n'est qu'un signe) la déplie
// sur place en pleine largeur — sa liste, son geste — ; au téléphone les autres se tassent en une
// rangée de chiffres, sur ordinateur la grille reste en haut et ce qui est déplié vient dessous.
// « × » replie (Échap aussi, le retour du téléphone aussi).
//
// ⚠️ CE FICHIER NE CALCULE RIEN. Chaque chiffre, chaque liste et chaque geste lui sont passés par
// Ma journée (src/App.jsx, `Comptabilite` only="journee") : les MÊMES sources qu'avant, « — »
// quand ce n'est pas su, la couverture dite à côté (§5). Il range, il ne décide pas.
// Les quatre formes de bouton seulement (note t25 « Règles des boutons ») : le plein (`sb-btn-plein`,
// un par écran au plus), la touche (`sb-touche`), le rond (`sb-rond`), le lien (`sb-lien`) ; une
// tuile et une rangée se touchent entières. Récit : docs/passation/2026-11-14-studio-journee.md.
import React from 'react';
import { tr } from './i18n/index.js';
import { appliquerTuiles, lireTuilesJournee, estOrigineTuiles, deplacerTuile, basculerTuile, agrandirTuile, tailleSuivante, tuilesOrigine, TAILLES, TAILLES_DE } from './tuilesJournee.js';

// Le « + » du coin d'une tuile : un SIGNE, pas une cible (la tuile entière se touche).
export const SignePlus = ({ taille = 15 }) => (
  <svg className="sb-tuile-plus" width={taille} height={taille} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M8 2.5v11M2.5 8h11" vectorEffect="non-scaling-stroke"/>
  </svg>
);
const SigneFermer = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" vectorEffect="non-scaling-stroke"/>
  </svg>
);
export const Chevron = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3.5L10.5 8 6 12.5" vectorEffect="non-scaling-stroke"/>
  </svg>
);

// Un montant d'affiche : « 1 471 » puis le € plus petit, remonté (Urbanist). `texte` est le montant
// DÉJÀ formaté par l'écran (« 1 471 € », « 275,50 € ») : on ne fait que poser le symbole à part.
export function MontantAffiche({ texte }) {
  const s = String(texte == null ? '' : texte);
  const m = /^(.*?)[\s  ]*€$/.exec(s);
  if (!m) return <bdi className="sb-nb">{s}</bdi>;
  return <bdi className="sb-nb">{m[1]}<sup className="sb-eur">€</sup></bdi>;
}

// La plaque gravée du N° (`.sb-plaque`). `double` : deux paires sous ce N° — le seul rouge (§5).
export function Plaque({ num, double = false }) {
  if (!num) return <span className="sj-plaque-vide" aria-hidden="true"/>;
  return <span className={'sb-plaque' + (double ? ' is-double' : '')}><small>N°</small>{num}</span>;
}

// Une rangée de liste (64 px) : N° · vignette · titre / méta · à droite (échéance, prix). La rangée
// ENTIÈRE est la cible ; aucun bouton dedans.
export function RangeeJ({ num, photo, Photo, icone = null, titre, meta, droite, ambre = false, onClick, attrs = null }) {
  return (
    <button type="button" className="sb-rangee sj-rangee" onClick={onClick} {...(attrs || {})}>
      <Plaque num={num}/>
      <span className={'sb-vignette' + (photo ? '' : ' is-vide')} aria-hidden="true">
        {photo ? (Photo ? <Photo src={photo} alt="" loading="lazy" decoding="async" width={40} height={40}/> : <img src={photo} alt="" loading="lazy" decoding="async" width={40} height={40}/>) : icone}
      </span>
      <span className="sj-r-txt">
        <span className="sj-r-titre">{titre}</span>
        {meta ? <span className="sj-r-meta">{meta}</span> : null}
      </span>
      {droite != null && droite !== '' ? <span className={'sj-r-droite' + (ambre ? ' is-ambre' : '')}>{droite}</span> : <span/>}
    </button>
  );
}

// Le lien du pied d'une tuile dépliée (« 2 autres › », « Ouvrir Colis › »).
export function LienJ({ children, onClick, attrs = null }) {
  return <button type="button" className="sb-lien" onClick={onClick} {...(attrs || {})}>{children}<Chevron/></button>;
}

// ── LA GRILLE ──────────────────────────────────────────────────────────────────────────────
// tuiles : [{ id, lib, taille ('2x2'|'2x1'|'3x1'|'1x1'|'3x2'), place ({ c, r } colonnes/rangées sur
// ordinateur), attrs (data-* de la tuile : ses compteurs), face (le corps de la tuile), plein (le
// bouton plein posé SUR la tuile, au-dessus de sa zone), tasse ({ n, l } : la tuile tassée),
// deplie (ce qui s'ouvre ; null ⇒ `toucher` est son geste), toucher, aria (nom de la tuile) }].
// « Tes tuiles à toi » (idée 148) : `reglage` (vrm_tuiles_journee), `poser` (l'enregistre), `urgent`
// ({ id: true } : une tuile cachée qui porte un geste urgent revient, « remise car urgente »).
const APPUI_LONG_MS = 520;
const SigneOeil = ({ barre }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" vectorEffect="non-scaling-stroke"/><circle cx="12" cy="12" r="2.8" vectorEffect="non-scaling-stroke"/>
    {barre ? <path d="M4 20L20 4" vectorEffect="non-scaling-stroke"/> : null}
  </svg>
);
const SigneTaille = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" vectorEffect="non-scaling-stroke"/>
  </svg>
);
export function BentoJournee({ tuiles: tuilesBrutes, ordi = false, FermeAuRetour = null, avant = null, reglage = null, poser = null, urgent = null }) {
  const [ouverte, setOuverte] = React.useState(null);
  const [rangement, setRangement] = React.useState(false);
  const [brouillon, setBrouillon] = React.useState(null);
  const [annonce, setAnnonce] = React.useState('');
  const zones = React.useRef({});
  const elTuiles = React.useRef({});
  const fermerRef = React.useRef(null);
  const termineRef = React.useRef(null);
  const panneauRef = React.useRef(null);
  const appui = React.useRef(null);      // l'appui long en cours { id, x, y, minuterie }
  const apresLong = React.useRef(false);  // le clic qui suit un appui long ne déplie rien
  const glisse = React.useRef(null);      // le glisser en cours { id, x0, y0, pointerId, cible }
  const reglageVu = rangement && brouillon ? brouillon : reglage;
  const toutes = appliquerTuiles(tuilesBrutes, reglageVu, urgent || {});
  const tuiles = toutes.filter((t) => rangement || !t.cachee);
  const remises = toutes.filter((t) => t.remise);
  const ids = toutes.map((t) => t.id);
  const tuileOuverte = !rangement && ouverte ? tuiles.find((t) => t.id === ouverte && t.deplie) : null;
  // Une tuile qui disparaît (plus rien à faire) se replie d'elle-même : jamais un panneau orphelin.
  React.useEffect(() => { if (ouverte && !tuileOuverte) setOuverte(null); }, [ouverte, tuileOuverte]);
  const ouvrir = (t) => {
    if (apresLong.current) { apresLong.current = false; return; }
    if (rangement) return;
    if (!t.deplie) { if (t.toucher) t.toucher(); return; }
    setOuverte((o) => (o === t.id ? null : t.id));
  };
  const fermer = React.useCallback(() => {
    const id = ouverte;
    setOuverte(null);
    // Le doigt (et le clavier) reviennent sur la tuile qu'on avait ouverte.
    setTimeout(() => { const z = id && zones.current[id]; if (z && typeof z.focus === 'function') { try { z.focus({ preventScroll: true }); } catch (_) { z.focus(); } } }, 0);
  }, [ouverte]);
  React.useEffect(() => {
    if (!tuileOuverte) return undefined;
    const t = setTimeout(() => {
      const f = fermerRef.current; if (f) { try { f.focus({ preventScroll: true }); } catch (_) { f.focus(); } }
      // Au téléphone la grille se tasse : le panneau doit être en vue, sous la rangée tassée.
      if (!ordi && panneauRef.current && typeof panneauRef.current.getBoundingClientRect === 'function') {
        const r = panneauRef.current.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight * 0.6) { try { panneauRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {} }
      }
    }, 30);
    const echap = (e) => { if (e.key === 'Escape') fermer(); };
    window.addEventListener('keydown', echap);
    return () => { clearTimeout(t); window.removeEventListener('keydown', echap); };
  }, [tuileOuverte && tuileOuverte.id, ordi, fermer]);
  // L'écran entier sait qu'une tuile est ouverte (`data-sj-ouverte` sur `.sj-journee`) : au téléphone l'affiche
  // s'efface (CSS) pour que la tuile monte sous la rangée tassée — rien n'est démonté, ses compteurs restent.
  const racine = React.useRef(null);
  const idOuvert = tuileOuverte ? tuileOuverte.id : '';
  React.useEffect(() => {
    const ecran = racine.current && racine.current.closest ? racine.current.closest('.sj-journee') : null;
    if (!ecran) return undefined;
    if (idOuvert) ecran.setAttribute('data-sj-ouverte', idOuvert); else ecran.removeAttribute('data-sj-ouverte');
    return () => { try { ecran.removeAttribute('data-sj-ouverte'); } catch (_) {} };
  }, [idOuvert]);

  // ── LE MODE RANGEMENT ──
  const entrer = (id) => {
    setOuverte(null); setBrouillon(lireTuilesJournee(reglage)); setRangement(true);
    setAnnonce(tr('sj.r.annonceEntree'));
    setTimeout(() => { const z = id && zones.current[id]; if (z) { try { z.focus({ preventScroll: true }); } catch (_) {} } }, 30);
  };
  const terminer = () => {
    if (brouillon && poser) poser(brouillon);
    setRangement(false); setBrouillon(null); setAnnonce(tr('sj.r.annonceRange'));
  };
  React.useEffect(() => {
    if (!rangement) return undefined;
    const echap = (e) => { if (e.key === 'Escape') terminer(); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  });
  const deplacer = (id, vers) => {
    setBrouillon((b) => deplacerTuile(b, ids, id, vers));
    const t = toutes.find((x) => x.id === id);
    setAnnonce(tr('sj.r.annoncePlace', { lib: (t && (t.aria || t.lib)) || id, n: Math.max(1, Math.min(ids.length, vers + 1)), total: ids.length }));
  };
  const annulerAppui = () => { const a = appui.current; if (a) clearTimeout(a.minuterie); appui.current = null; };
  const surAppui = (t, e) => {
    if (rangement) {
      // Glisser : la tuile suit le doigt (ou la souris) depuis l'endroit où on l'a prise.
      if (e.target && e.target.closest && e.target.closest('[data-sj-r-geste]')) return;
      const el = elTuiles.current[t.id]; if (!el) return;
      glisse.current = { id: t.id, x0: e.clientX, y0: e.clientY, pointerId: e.pointerId, cible: null };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.setAttribute('data-sj-glisse', '');
      return;
    }
    if (e.button != null && e.button > 0) return;
    annulerAppui();
    appui.current = { id: t.id, x: e.clientX, y: e.clientY, minuterie: setTimeout(() => { appui.current = null; apresLong.current = true; entrer(t.id); }, APPUI_LONG_MS) };
  };
  const surMouvement = (t, e) => {
    const a = appui.current;
    if (a && (Math.abs(e.clientX - a.x) > 10 || Math.abs(e.clientY - a.y) > 10)) annulerAppui();
    const g = glisse.current; if (!g || g.id !== t.id || g.pointerId !== e.pointerId) return;
    const el = elTuiles.current[t.id]; if (!el) return;
    el.style.transform = `translate(${e.clientX - g.x0}px, ${e.clientY - g.y0}px)`;
    // La tuile survolée (par le doigt) prend la place : l'ordre suit, la tuile reprend depuis sa nouvelle case.
    let vers = null;
    for (const id of ids) {
      if (id === t.id) continue;
      const o = elTuiles.current[id]; if (!o || !o.getClientRects().length) continue;
      const r = o.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { vers = id; break; }
    }
    if (vers && vers !== g.cible) {
      g.cible = vers;
      deplacer(t.id, ids.indexOf(vers));
      g.x0 = e.clientX; g.y0 = e.clientY; el.style.transform = '';
    } else if (!vers) g.cible = null;
  };
  const surFin = (t, e) => {
    annulerAppui();
    const g = glisse.current; if (!g || g.id !== t.id) return;
    const el = elTuiles.current[t.id];
    if (el) { el.style.transform = ''; el.removeAttribute('data-sj-glisse'); try { el.releasePointerCapture(e.pointerId); } catch (_) {} }
    glisse.current = null;
  };
  const surTouche = (t, e) => {
    if (!rangement) return;
    const i = ids.indexOf(t.id);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) { deplacer(t.id, i - 1); setTimeout(() => zones.current[t.id] && zones.current[t.id].focus(), 0); } }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); if (i < ids.length - 1) { deplacer(t.id, i + 1); setTimeout(() => zones.current[t.id] && zones.current[t.id].focus(), 0); } }
  };

  const autres = tuiles.filter((t) => !tuileOuverte || t.id !== tuileOuverte.id);
  return (
    <div ref={racine} className="sj-bento" data-sj-bento="" data-sj-ouverte={tuileOuverte ? tuileOuverte.id : ''} data-sj-ordi={ordi ? '1' : '0'}
      data-sj-rangement={rangement ? '1' : undefined} data-sj-perso={estOrigineTuiles(reglageVu) ? undefined : '1'}>
      <p className="sj-sr" aria-live="polite">{annonce}</p>
      {/* Une tuile qu'il a cachée et qui porte un geste urgent revient d'elle-même : une ligne le dit. */}
      {!rangement && remises.length ? (
        <p className="sj-remises" data-sj-remises={remises.map((t) => t.id).join(' ')}>
          <span className="sj-point" aria-hidden="true"/>{remises.map((t) => tr('sj.r.remise', { lib: t.lib })).join(' · ')}
        </p>
      ) : null}
      {rangement ? (
        <div className="sj-rangement-tete" data-sj-rangement-tete="">
          <span className="sj-rangement-titre">{tr('sj.r.titre')}</span>
          {!estOrigineTuiles(brouillon) ? <button type="button" className="sb-lien" data-sj-r-origine="" onClick={() => { setBrouillon(tuilesOrigine()); setAnnonce(tr('sj.r.annonceOrigine')); }}>{tr('sj.r.origine')}</button> : null}
          <button type="button" ref={termineRef} className="sb-touche" data-sj-r-termine="" onClick={terminer}>{tr('sj.r.termine')}</button>
        </div>
      ) : null}
      {/* La rangée tassée (téléphone, une tuile ouverte) : les AUTRES tuiles en chiffres ; une touche
          ouvre la sienne à la place. Pas de compteur `data-*` ici : ils restent sur la grille. */}
      {tuileOuverte && !ordi ? (
        <div className="sj-tasse" role="group" aria-label={tr('sj.tassees')} data-sj-tasse="">
          {autres.filter((t) => t.tasse).map((t) => (
            <button key={t.id} type="button" className="sb-tuile sj-tasse-t" data-sj-tasse-id={t.id} onClick={() => ouvrir(t)}
              aria-label={t.aria || t.lib}>
              <b className="sj-tasse-n">{t.tasse ? t.tasse.n : '—'}</b>
              <span className="sj-tasse-l">{t.tasse ? t.tasse.l : t.lib}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="sj-grille" data-sj-grille="" hidden={!!(tuileOuverte && !ordi)}>
        {toutes.map((t) => {
          const actif = !!(tuileOuverte && tuileOuverte.id === t.id);
          const montree = rangement || !t.cachee;
          return (
            <div key={t.id} ref={(el) => { elTuiles.current[t.id] = el; }}
              className={'sb-tuile sj-t sj-t-' + t.id + (actif ? ' is-actif' : '') + (t.vide ? ' is-calme' : '') + (rangement && t.cachee ? ' is-cachee' : '')}
              data-taille={t.taille} data-sj-tuile={t.id} hidden={!montree}
              data-sj-cachee={t.cacheeParLui ? '1' : undefined} data-sj-remise={t.remise ? '1' : undefined}
              style={t.place ? { '--sj-c': t.place.c, '--sj-r': t.place.r || 1 } : undefined}
              onPointerDown={(e) => surAppui(t, e)} onPointerMove={(e) => surMouvement(t, e)}
              onPointerUp={(e) => surFin(t, e)} onPointerCancel={(e) => surFin(t, e)} onPointerLeave={() => { if (!glisse.current) annulerAppui(); }}
              onContextMenu={(e) => { if (appui.current || rangement) e.preventDefault(); }}
              {...(t.attrs || {})}>
              {/* Une tuile « interactif » (le mois : ses chiffres, son « Modifier ») ne se déplie pas : pas de zone
                  par-dessus, ses propres gestes restent touchables — sauf pendant le rangement (on la déplace). */}
              {t.interactif && !rangement ? null : <button type="button" className="sj-zone" ref={(el) => { zones.current[t.id] = el; }}
                aria-expanded={t.deplie && !rangement ? actif : undefined} aria-controls={t.deplie && !rangement ? 'sj-deplie' : undefined}
                aria-label={rangement ? tr('sj.r.zone', { lib: t.aria || t.lib || '' }) : (t.aria || t.lib)} data-sj-zone={t.id}
                onClick={() => ouvrir(t)} onKeyDown={(e) => surTouche(t, e)}/>}
              {t.lib ? <span className="sj-lib" aria-hidden="true">{t.lib}</span> : null}
              {t.deplie && !rangement ? <SignePlus/> : null}
              {actif ? <span className="sb-diode sj-diode" aria-hidden="true"/> : null}
              <div className="sj-face" aria-hidden={t.interactif && !rangement ? undefined : 'true'} inert={rangement ? '' : undefined}>{t.face}</div>
              {t.plein && !rangement ? <div className="sj-plein-place">{t.plein}</div> : null}
              {rangement ? (
                <div className="sj-r-gestes">
                  <button type="button" className="sb-rond" data-sj-r-geste="cacher" data-sj-r-cacher={t.id} aria-pressed={t.cacheeParLui ? 'true' : 'false'}
                    aria-label={t.cacheeParLui ? tr('sj.r.montrer', { lib: t.aria || t.lib }) : tr('sj.r.cacher', { lib: t.aria || t.lib })}
                    onClick={() => setBrouillon((b) => basculerTuile(b, t.id, !t.cacheeParLui))}><SigneOeil barre={!t.cacheeParLui}/></button>
                  {(TAILLES_DE[t.id] || TAILLES).length > 1 ? (
                    <button type="button" className="sb-rond" data-sj-r-geste="taille" data-sj-r-taille={t.id}
                      aria-label={tr('sj.r.taille', { lib: t.aria || t.lib, taille: tailleSuivante(t.id, t.taille).replace('x', ' × ') })}
                      onClick={() => setBrouillon((b) => agrandirTuile(b, t.id, t.taille))}><SigneTaille/></button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {/* L'appui long a son double pour la souris et le clavier : un lien discret sous la grille. */}
      {!rangement && !tuileOuverte ? <div className="sj-ranger"><button type="button" className="sb-lien" data-sj-ranger="" onClick={() => entrer(tuiles[0] && tuiles[0].id)}>{tr('sj.r.ranger')}</button></div> : null}
      {avant}
      {tuileOuverte ? (
        <section id="sj-deplie" ref={panneauRef} className="sb-tuile sb-avant sj-deplie" data-sj-deplie={tuileOuverte.id}
          aria-label={tuileOuverte.aria || tuileOuverte.lib}>
          {FermeAuRetour && !ordi ? <FermeAuRetour fermer={fermer}/> : null}
          <div className="sj-deplie-tete">
            <h2 className="sj-deplie-lib">{tuileOuverte.lib}</h2>
            <button type="button" ref={fermerRef} className="sb-rond sj-fermer" aria-label={tr('sj.replier', { lib: tuileOuverte.lib })} data-sj-fermer="" onClick={fermer}><SigneFermer/></button>
          </div>
          <div className="sj-deplie-corps">{tuileOuverte.deplie}</div>
        </section>
      ) : null}
    </div>
  );
}

// La place de chaque tuile, sans trou. Téléphone : trois colonnes ; « À envoyer » 2 × 2, « À retirer »
// 2 × 1, le mois 3 × 1, les simples 1 × 1 — les simples remplissent la colonne de droite, dans l'ordre ;
// quand il en manque, la grande tuile prend la largeur (jamais une case vide). Ordinateur : douze
// colonnes — En haut « À envoyer » (4 × 2), « À retirer » (4) et le mois (4) ; dessous les simples.
// Ordinateur (douze colonnes, même ordre) : « À envoyer » 4 × 2, deux simples et « À retirer » sur la
// première rangée ; la seconde : la troisième simple, le mois, une simple ; le reste à parts égales.
export function placerTuiles({ envoyer, retirer, mois, simples }) {
  const out = [];
  const S = simples.slice();
  const poser = (t, taille, c, r) => out.push({ ...t, taille, place: { c, r: r || 1 } });
  if (envoyer) {
    poser(envoyer, S.length ? '2x2' : '3x2', S.length ? 4 : 12, 2);
    if (S.length) poser(S.shift(), '1x1', 2);
    if (S.length) poser(S.shift(), '1x1', 2);
  }
  let deuxieme = 0;   // colonnes d'ordinateur prises sur la seconde rangée
  if (retirer) {
    const avec = S.length > 0;
    poser(retirer, avec ? '2x1' : '3x1', 4);
    if (avec) { poser(S.shift(), '1x1', 2); deuxieme += 2; }
  }
  const apres = S.length ? S.shift() : null;   // la simple qui ferme la seconde rangée d'ordinateur
  if (mois) poser(mois, '3x1', Math.max(4, 8 - deuxieme - (apres ? 2 : 0)));
  // Le reste (téléphone : par rangées de trois ; une rangée incomplète s'élargit, 2 ⇒ 2 + 1, 1 ⇒ 3).
  const reste = apres ? [apres, ...S] : S;
  const cOrdi = (i) => (apres && i === 0 && mois ? 2 : Math.max(3, Math.floor(12 / Math.min(4, Math.max(1, reste.length - (apres && mois ? 1 : 0))))));
  for (let i = 0; i < reste.length; i += 3) {
    const r = reste.slice(i, i + 3);
    const tailles = r.length === 3 ? ['1x1', '1x1', '1x1'] : r.length === 2 ? ['2x1', '1x1'] : ['3x1'];
    r.forEach((t, k) => poser(t, tailles[k], cOrdi(i + k)));
  }
  return out;
}
