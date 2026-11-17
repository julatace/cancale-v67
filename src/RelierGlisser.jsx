// ════════════════════════════════════════════════════════════════════════════
//  RELIER EN GLISSANT (16 nov., lot relier-glisser) — l'écran
// ════════════════════════════════════════════════════════════════════════════
// Julien : « faire comme quand on reste appuyé sur une app sur iPhone : ça vibre, et après tu
// places [l'achat] sur la vente ou l'annonce. Sinon une liste, ça peut être aussi simple. »
// Règles : src/relierGlisser.js (appui long, défilement au bord, listes, phrase, écriture).
//   · téléphone : achats EN HAUT, annonces / ventes EN BAS ; ordinateur : achats À GAUCHE ;
//   · appui long (400 ms) sur un achat ⇒ il se soulève (agrandi, ombre, oscillation), suit le
//     doigt ; un doigt qui bouge avant = un défilement normal (jamais un glisser) ;
//   · la cible survolée s'éclaire ; lâcher dessus ⇒ « Relier N°215 à cet achat de 24,63 € ?
//     Oui · Annuler » ; lâcher ailleurs ⇒ rien ;
//   · au clavier / lecteur d'écran (et au simple toucher) : TOUCHER un achat le sélectionne,
//     chaque cible offre alors « Relier ici » (la même confirmation). La liste reste aussi.
//   · la vibration seulement si `navigator.vibrate` existe (pas sur iPhone : le soulèvement la remplace).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tr, monnaie } from './i18n/index.js';
import { appuiSuivant, vitesseBord, listesGlisser, phraseConfirmation, vibrerSiPossible, DELAI_APPUI_MS, ATTENTE_BORD_MS } from './relierGlisser.js';
import { lotDe } from './suggestionsAchat.js';
import './styles-relier-glisser.css';

const montant = (n) => { try { return monnaie(n); } catch (_) { return `${Number(n).toFixed(2).replace('.', ',')} €`; } };
const jourCourt = (d) => { const t = Date.parse(d || ''); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };

export default function RelierGlisser({ achats, liens, tresProbables = null, cibles = [], prixDe, compteDe = () => '', photoDe = () => '', tailleDe = () => '',
  onRelier, onListe = null, onFermer, Photo, Icon, Retour = null, zIndex = 1400, C = {}, achatInitial = '', cibleInitiale = '' }) {
  const L = useMemo(() => listesGlisser({ achats, liens, tresProbables, cibles }), [achats, liens, tresProbables, cibles]);
  const [leve, setLeve] = useState(null);          // { tx, x, y, dx, dy, w, h }
  const [survol, setSurvol] = useState('');        // key de la cible sous le doigt
  // (17 nov., Julien : « je dois rester appuyé sur l'achat […] et après on ne voit pas ce que j'ai sélectionné ») RELIER
  // EN TOUCHANT : un toucher choisit l'achat (ou la vente / l'annonce), un bandeau fixe le montre tout du long, la liste
  // d'en face prend la place ; un toucher sur l'autre côté pose la question. Le glisser reste un bonus.
  const [choisi, setChoisi] = useState(String(achatInitial || ''));        // tx de l'achat choisi
  const [cibleChoisie, setCibleChoisie] = useState(String(cibleInitiale || ''));   // key de la vente / annonce choisie
  const [confirme, setConfirme] = useState(null);  // { a, cible }
  const [enCours, setEnCours] = useState(false);
  const [large, setLarge] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 900 : false));
  const bordDepuis = useRef(0), vientDeGlisser = useRef(false), appui = useRef(null), minuteur = useRef(0), raf = useRef(0), pos = useRef({ x: 0, y: 0 }), listeCibles = useRef(null), carteSource = useRef(null), survolRef = useRef('');
  const parTx = useMemo(() => new Map((L.achats || []).map((x) => [x.tx, x])), [L.achats]);
  const parCle = useMemo(() => new Map(L.cibles.map((c) => [String(c.key), c])), [L.cibles]);
  useEffect(() => { const f = () => setLarge(window.innerWidth >= 900); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  // Un achat choisi qui n'est plus libre (relié ailleurs) : la sélection tombe.
  useEffect(() => { if (choisi && Array.isArray(L.achats) && !parTx.has(choisi)) setChoisi(''); }, [choisi, parTx, L.achats]);
  useEffect(() => { if (cibleChoisie && !parCle.has(cibleChoisie)) setCibleChoisie(''); }, [cibleChoisie, parCle]);

  const cibleSous = (x, y) => {
    const el = typeof document !== 'undefined' && document.elementFromPoint ? document.elementFromPoint(x, y) : null;
    const c = el && el.closest ? el.closest('[data-glisser-cible]') : null;
    return c ? String(c.getAttribute('data-glisser-cible') || '') : '';
  };
  const poserSurvol = (k) => { if (survolRef.current !== k) { survolRef.current = k; setSurvol(k); } };
  const finir = () => {
    clearTimeout(minuteur.current); minuteur.current = 0;
    cancelAnimationFrame(raf.current); raf.current = 0;
    appui.current = null; survolRef.current = ''; setSurvol(''); setLeve(null);
  };
  useEffect(() => () => finir(), []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Le défilement automatique : tant que l'achat est levé, le doigt près d'un bord de la liste cible la fait défiler.
  const boucle = () => {
    const l = listeCibles.current;
    if (l && appui.current && appui.current.phase === 'leve') {
      const r = l.getBoundingClientRect();
      const v = vitesseBord(pos.current.y, r.top, r.bottom);
      const now = performance.now();
      if (!v) bordDepuis.current = 0;
      else if (!bordDepuis.current) bordDepuis.current = now;
      if (v && now - bordDepuis.current >= ATTENTE_BORD_MS) { l.scrollTop += v; poserSurvol(cibleSous(pos.current.x, pos.current.y)); }
      raf.current = requestAnimationFrame(boucle);
    }
  };
  const lever = (e0) => {
    const a = appui.current; if (!a) return;
    appui.current = { ...a, phase: 'leve' };
    const r = carteSource.current ? carteSource.current.getBoundingClientRect() : { left: a.x0 - 120, top: a.y0 - 30, width: 240, height: 60 };
    setLeve({ tx: a.tx, x: pos.current.x, y: pos.current.y, dx: a.x0 - r.left, dy: a.y0 - r.top, w: r.width, h: r.height });
    vibrerSiPossible();
    cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(boucle);
    if (e0 && e0.preventDefault) { try { e0.preventDefault(); } catch (_) {} }
  };

  // Les écouteurs de la fenêtre pendant un appui (pointeur) ; le toucher : un `touchmove` NON passif
  // empêche le défilement SEULEMENT une fois l'achat levé (avant, le doigt défile normalement).
  useEffect(() => {
    const bouge = (e) => {
      const a = appui.current; if (!a || (a.id != null && e.pointerId !== a.id)) return;
      pos.current = { x: e.clientX, y: e.clientY };
      if (a.phase === 'appui') {
        const n = appuiSuivant(a, { type: 'bouge', x: e.clientX, y: e.clientY, t: performance.now() });
        if (n.phase === 'defile') { finir(); return; }
        if (n.phase === 'leve') { appui.current = n; lever(e); }
        return;
      }
      if (a.phase === 'leve') {
        setLeve((l) => (l ? { ...l, x: e.clientX, y: e.clientY } : l));
        poserSurvol(cibleSous(e.clientX, e.clientY));
      }
    };
    const lache = (e) => {
      const a = appui.current; if (!a || (a.id != null && e.pointerId !== a.id)) return;
      if (a.phase === 'leve') {
        vientDeGlisser.current = true; setTimeout(() => { vientDeGlisser.current = false; }, 400);
        const k = cibleSous(e.clientX, e.clientY);
        const x = parTx.get(a.tx), c = parCle.get(k);
        finir();
        if (x && c) setConfirme({ a: x.a, cible: c });      // lâché sur une cible ⇒ la question
        return;                                              // lâché ailleurs ⇒ rien
      }
      finir();
    };
    const annule = (e) => { const a = appui.current; if (!a || (a.id != null && e.pointerId !== a.id)) return; finir(); };
    const bloque = (e) => { if (appui.current && appui.current.phase === 'leve' && e.cancelable) e.preventDefault(); };
    window.addEventListener('pointermove', bouge);
    window.addEventListener('pointerup', lache);
    window.addEventListener('pointercancel', annule);
    document.addEventListener('touchmove', bloque, { passive: false });
    return () => {
      window.removeEventListener('pointermove', bouge);
      window.removeEventListener('pointerup', lache);
      window.removeEventListener('pointercancel', annule);
      document.removeEventListener('touchmove', bloque, { passive: false });
    };
  }, [parTx, parCle, large]);   // eslint-disable-line react-hooks/exhaustive-deps

  const debut = (e, x) => {
    if (enCours || confirme) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    carteSource.current = e.currentTarget;
    pos.current = { x: e.clientX, y: e.clientY };
    appui.current = { phase: 'appui', x0: e.clientX, y0: e.clientY, t0: performance.now(), souris: e.pointerType === 'mouse', tx: x.tx, id: e.pointerId };
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      const a = appui.current; if (!a || a.phase !== 'appui') return;
      const n = appuiSuivant(a, { type: 'temps', t: performance.now() });
      if (n.phase === 'leve') { appui.current = n; lever(null); }
    }, DELAI_APPUI_MS);
  };

  const oui = async () => {
    if (!confirme || enCours) return;
    setEnCours(true);
    let ok = false; try { ok = await onRelier(confirme.a, confirme.cible); } catch (_) { ok = false; }
    setEnCours(false); setConfirme(null);
    if (ok) { setChoisi(''); setCibleChoisie(''); }
  };
  const relierIci = (c) => { const x = parTx.get(choisi); if (x && c) setConfirme({ a: x.a, cible: c }); };
  // Toucher une vente / annonce : l'achat est choisi ⇒ la question ; sinon elle devient LE choix (sens inverse).
  const toucherCible = (c) => { if (leve || vientDeGlisser.current || !c) return; if (choisi) relierIci(c); else setCibleChoisie((k) => (k === String(c.key) ? '' : String(c.key))); };
  const toucherAchat = (x) => { if (leve || vientDeGlisser.current || !x) return; const c = cibleChoisie ? parCle.get(cibleChoisie) : null; if (c) { setConfirme({ a: x.a, cible: c }); return; } setChoisi((v) => (v === x.tx ? '' : x.tx)); };
  const changer = () => { setChoisi(''); setCibleChoisie(''); setConfirme(null); };
  const mode = choisi ? 'achat' : cibleChoisie ? 'cible' : '';
  const xChoisi = choisi ? parTx.get(choisi) : null, cChoisie = cibleChoisie ? parCle.get(cibleChoisie) : null;

  const achatLeve = leve ? parTx.get(leve.tx) : null;
  const nA = Array.isArray(L.achats) ? L.achats.length : null;
  const carteAchat = (x, flottante = false) => {
    const a = x.a, ph = photoDe(a), px = prixDe(a), lot = lotDe(a).lot, taille = tailleDe(a);
    const sous = [taille ? tr('liaison.taille', { taille }) : '', a.date ? jourCourt(a.date) : '', compteDe(a)].filter(Boolean).join(' · ');
    return (
      <>
        <span className="vrm-rg-photo" aria-hidden="true">{ph ? <Photo src={ph} alt="" loading="lazy" decoding="async" draggable={false}/> : <Icon name="bag" size={20}/>}</span>
        <span className="vrm-rg-texte">
          <span className="vrm-rg-titre">{a.title || '—'}</span>
          <span className="vrm-rg-sous">{sous}</span>
          {x.propose && !flottante ? <span className="vrm-rg-propose" data-glisser-propose={x.propose}>{tr('liaison.niveau.tresProbable')}</span> : null}
        </span>
        <span className="vrm-rg-prix">{lot ? tr('glisser.lot') : px != null ? montant(px) : '—'}</span>
      </>
    );
  };

  return createPortal(
    <div className="vrm-rg" data-relier-glisser="" data-glisser-mode={mode || undefined} data-glisser-large={large ? '1' : '0'} data-glisser-leve={leve ? leve.tx : undefined} role="dialog" aria-modal="true" aria-label={tr('glisser.titre')}
      style={{ zIndex, '--rg-fond': C.bg, '--rg-carte': C.card, '--rg-encre': C.text, '--rg-gris': C.muted, '--rg-filet': C.border, '--rg-accent': C.accent, '--rg-sur-accent': C.onAccent }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <header className="vrm-rg-tete">
        <div className="vrm-rg-tete-texte">
          <h2 className="vrm-rg-h">{tr('glisser.titre')}</h2>
          <p className="vrm-rg-aide" data-glisser-aide="">{choisi ? tr('glisser.aideChoisi') : cibleChoisie ? tr('glisser.aideCible') : tr('glisser.aide')}</p>
        </div>
        {onListe ? <button type="button" className="vrm-rg-lien" data-glisser-liste="" onClick={onListe}>{tr('glisser.liste')}</button> : null}
        <button type="button" className="vrm-rg-fermer" data-glisser-fermer="" aria-label={tr('glisser.fermer')} onClick={onFermer}><Icon name="close" size={20}/></button>
      </header>
      {mode ? (
        <div className="vrm-rg-choisi" data-glisser-choisi={mode === 'achat' ? choisi : cibleChoisie} data-glisser-choisi-sorte={mode} role="status" aria-live="polite">
          <span className="vrm-rg-photo" aria-hidden="true">{(() => { const ph = mode === 'achat' ? (xChoisi ? photoDe(xChoisi.a) : '') : (cChoisie && cChoisie.photo) || ''; return ph ? <Photo src={ph} alt="" draggable={false}/> : <Icon name={mode === 'achat' ? 'bag' : 'image'} size={20}/>; })()}</span>
          <span className="vrm-rg-texte">
            <span className="vrm-rg-sous">{mode === 'achat' ? tr('glisser.choisiAchat') : tr('glisser.choisiCible')}</span>
            <span className="vrm-rg-titre">{mode === 'achat' ? ((xChoisi && xChoisi.a.title) || '…') : <>{cChoisie && cChoisie.num ? <b className="vrm-rg-num">N°{cChoisie.num}</b> : null}{(cChoisie && cChoisie.titre) || '—'}</>}</span>
          </span>
          {mode === 'achat' && xChoisi ? <span className="vrm-rg-prix">{lotDe(xChoisi.a).lot ? tr('glisser.lot') : prixDe(xChoisi.a) != null ? montant(prixDe(xChoisi.a)) : '—'}</span> : null}
          <button type="button" className="vrm-rg-changer" data-glisser-changer="" onClick={changer}>{tr('glisser.changer')}</button>
        </div>
      ) : null}
      <div className="vrm-rg-corps">
        <section className="vrm-rg-col vrm-rg-achats" aria-label={tr('glisser.achats')}>
          <h3 className="vrm-rg-h3">{tr('glisser.achats')}{nA != null ? <span className="vrm-rg-n">{nA}</span> : null}</h3>
          <ul className="vrm-rg-liste" data-glisser-achats={nA == null ? '' : String(nA)}>
            {L.achats === undefined ? <li className="vrm-rg-vide">…</li>
              : L.achats === null ? <li className="vrm-rg-vide">{tr('glisser.pasSu')}</li>
              : !L.achats.length ? <li className="vrm-rg-vide" data-glisser-vide="achats">{tr('glisser.aucunAchat')}</li>
              : L.achats.map((x) => (
                <li key={x.tx}>
                  <button type="button" className="vrm-rg-carte vrm-rg-achat" data-glisser-achat={x.tx} aria-pressed={choisi === x.tx}
                    data-glisser-source={leve && leve.tx === x.tx ? '1' : undefined}
                    onPointerDown={(e) => debut(e, x)} onContextMenu={(e) => e.preventDefault()}
                    onClick={() => toucherAchat(x)}>
                    {carteAchat(x)}
                  </button>
                </li>))}
          </ul>
        </section>
        <section className="vrm-rg-col vrm-rg-cibles" aria-label={tr('glisser.cibles')}>
          <h3 className="vrm-rg-h3">{tr('glisser.cibles')}<span className="vrm-rg-n">{L.cibles.length}</span></h3>
          <ul className="vrm-rg-liste" ref={listeCibles} data-glisser-cibles={String(L.cibles.length)}>
            {!L.cibles.length ? <li className="vrm-rg-vide" data-glisser-vide="cibles">{tr('glisser.aucuneCible')}</li> : L.cibles.map((c) => {
              const actif = survol === String(c.key);
              const propose = achatLeve && achatLeve.propose === String(c.key);
              return (
                <li key={c.key}>
                  <button type="button" className="vrm-rg-carte vrm-rg-cible" data-glisser-cible={c.key} data-glisser-ici={choisi ? c.key : undefined} aria-pressed={cibleChoisie === String(c.key)} data-glisser-genre={c.genre} data-glisser-survol={actif ? '1' : undefined} data-glisser-attendue={propose ? '1' : undefined}
                    onClick={() => toucherCible(c)}>
                    <span className="vrm-rg-photo" aria-hidden="true">{c.photo ? <Photo src={c.photo} alt="" loading="lazy" decoding="async" draggable={false}/> : <Icon name="image" size={20}/>}</span>
                    <span className="vrm-rg-texte">
                      <span className="vrm-rg-titre">{c.num ? <b className="vrm-rg-num">N°{c.num}</b> : null}{c.titre || '—'}</span>
                      <span className="vrm-rg-sous">{[c.genre === 'vente' ? tr('glisser.vendue') : tr('glisser.enVente'), c.sous].filter(Boolean).join(' · ')}</span>
                    </span>
                    {choisi ? <span className="vrm-rg-ici" aria-hidden="true">{tr('glisser.relierIci')}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      {leve && achatLeve ? (
        <div className="vrm-rg-flotte" data-glisser-flotte={leve.tx} aria-hidden="true"
          style={{ width: leve.w, height: leve.h, transform: `translate(${Math.round(leve.x - leve.dx)}px, ${Math.round(leve.y - leve.dy)}px)` }}>
          <div className="vrm-rg-flotte-in vrm-rg-carte vrm-rg-achat">{carteAchat(achatLeve, true)}</div>
        </div>
      ) : null}
      {confirme ? (
        <div className="vrm-rg-question" role="alertdialog" aria-live="assertive" data-glisser-question={`${confirme.a.transaction_id}>${confirme.cible.key}`}>
          <p className="vrm-rg-question-texte">{phraseConfirmation({ cible: confirme.cible, prix: prixDe(confirme.a), lot: lotDe(confirme.a).lot }, tr, montant)}</p>
          <button type="button" className="vrm-rg-oui" data-glisser-oui="" disabled={enCours} onClick={oui}>{tr('glisser.oui')}</button>
          <button type="button" className="vrm-rg-non" data-glisser-non="" disabled={enCours} onClick={() => setConfirme(null)}>{tr('glisser.annuler')}</button>
        </div>
      ) : null}
    </div>, document.body);
}
