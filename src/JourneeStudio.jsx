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
export function BentoJournee({ tuiles, ordi = false, FermeAuRetour = null, avant = null }) {
  const [ouverte, setOuverte] = React.useState(null);
  const zones = React.useRef({});
  const fermerRef = React.useRef(null);
  const panneauRef = React.useRef(null);
  const racine = React.useRef(null);   // la grille entière (rangée tassée + déplié), pour la mettre en vue
  const tuileOuverte = ouverte ? tuiles.find((t) => t.id === ouverte && t.deplie) : null;
  // Une tuile qui disparaît (plus rien à faire) se replie d'elle-même : jamais un panneau orphelin.
  React.useEffect(() => { if (ouverte && !tuileOuverte) setOuverte(null); }, [ouverte, tuileOuverte]);
  const ouvrir = (t) => {
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
        if (r.top < 0 || r.top > window.innerHeight * 0.6) { try { (racine.current || panneauRef.current).scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {} }
      }
    }, 30);
    const echap = (e) => { if (e.key === 'Escape') fermer(); };
    window.addEventListener('keydown', echap);
    return () => { clearTimeout(t); window.removeEventListener('keydown', echap); };
  }, [tuileOuverte && tuileOuverte.id, ordi, fermer]);
  // L'écran entier sait qu'une tuile est ouverte (`data-sj-ouverte` sur `.sj-journee`) : au téléphone l'affiche
  // s'efface (CSS) pour que la tuile monte sous la rangée tassée — rien n'est démonté, ses compteurs restent.
  const idOuvert = tuileOuverte ? tuileOuverte.id : '';
  React.useEffect(() => {
    const ecran = racine.current && racine.current.closest ? racine.current.closest('.sj-journee') : null;
    if (!ecran) return undefined;
    if (idOuvert) ecran.setAttribute('data-sj-ouverte', idOuvert); else ecran.removeAttribute('data-sj-ouverte');
    return () => { try { ecran.removeAttribute('data-sj-ouverte'); } catch (_) {} };
  }, [idOuvert]);
  const autres = tuiles.filter((t) => !tuileOuverte || t.id !== tuileOuverte.id);
  return (
    <div ref={racine} className="sj-bento" data-sj-bento="" data-sj-ouverte={tuileOuverte ? tuileOuverte.id : ''} data-sj-ordi={ordi ? '1' : '0'}>
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
        {tuiles.map((t) => {
          const actif = !!(tuileOuverte && tuileOuverte.id === t.id);
          return (
            <div key={t.id} className={'sb-tuile sj-t sj-t-' + t.id + (actif ? ' is-actif' : '') + (t.vide ? ' is-calme' : '')}
              data-taille={t.taille} data-sj-tuile={t.id}
              style={t.place ? { '--sj-c': t.place.c, '--sj-r': t.place.r || 1 } : undefined}
              {...(t.attrs || {})}>
              {/* Une tuile « interactif » (le mois : ses chiffres, son « Modifier ») ne se déplie pas : pas de zone
                  par-dessus, ses propres gestes restent touchables. */}
              {t.interactif ? null : <button type="button" className="sj-zone" ref={(el) => { zones.current[t.id] = el; }}
                aria-expanded={t.deplie ? actif : undefined} aria-controls={t.deplie ? 'sj-deplie' : undefined}
                aria-label={t.aria || t.lib} data-sj-zone={t.id} onClick={() => ouvrir(t)}/>}
              {t.lib ? <span className="sj-lib" aria-hidden="true">{t.lib}</span> : null}
              {t.deplie ? <SignePlus/> : null}
              {actif ? <span className="sb-diode sj-diode" aria-hidden="true"/> : null}
              <div className="sj-face" aria-hidden={t.interactif ? undefined : 'true'}>{t.face}</div>
              {t.plein ? <div className="sj-plein-place">{t.plein}</div> : null}
            </div>
          );
        })}
      </div>
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
  const simplesHaut = envoyer ? out.length - 1 : 0;   // les simples posées à côté de « À envoyer » (rangée 1)
  if (retirer) {
    const avec = S.length > 0;
    // Sur ordinateur, « À retirer » ferme la première rangée : ce qui reste des douze colonnes (jamais un trou).
    poser(retirer, avec ? '2x1' : '3x1', envoyer ? Math.max(4, 8 - 2 * simplesHaut) : 4);
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
