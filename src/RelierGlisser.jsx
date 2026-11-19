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
import { appuiSuivant, vitesseBord, listesGlisser, marquerPour, achatsRelies, compterCibles, filtrerCibles, phraseConfirmation, vibrerSiPossible, DELAI_APPUI_MS, ATTENTE_BORD_MS } from './relierGlisser.js';
import { lotDe } from './suggestionsAchat.js';
import { FaitsAchat, NoteTailleAchats } from './FaitsAchat.jsx';   // (17 nov., lot relier-taille)
import { faitsAchat, sansTailleLue } from './faitsAchat.js';
import './styles-relier-glisser.css';

const montant = (n) => { try { return monnaie(n); } catch (_) { return `${Number(n).toFixed(2).replace('.', ',')} €`; } };
const jourCourt = (d) => { const t = Date.parse(d || ''); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };

export default function RelierGlisser({ achats, liens, tresProbables = null, cibles = [], prixDe, compteDe = () => '', photoDe = () => '', tailleDe = () => '',
  onRelier, onListe = null, onFermer, Photo, Icon, Retour = null, zIndex = 1400, C = {}, achatInitial = '', cibleInitiale = '',
  details = undefined, marqueDe = null, couleursDe = null }) {
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
  // (17 nov., Julien sur iPhone : « Ici ça bug de ouf quand je swipe ») Au téléphone, UN SEUL défilement : l'écran montre
  // UNE liste à la fois (onglets « Tes achats libres » / « Sans achat relié »), dans la feuille qui défile elle-même —
  // plus deux petites boîtes qui défilent chacune dans la page (le doigt s'y coinçait, la page rebondissait, un grand vide
  // restait en bas). Toucher un achat ⇒ la liste d'en face prend la place ; le glisser (appui long 400 ms) montre la liste
  // d'en face sous le doigt. Les listes arrivent par tranches de 60 (2 000 achats ne figent plus l'écran).
  const [ongletTel, setOngletTel] = useState('achats');
  // (19 nov., Julien) Les filtres : à gauche « Libres · Déjà reliés », à droite « Toutes · En ligne · Vendues ».
  const [filtreA, setFiltreA] = useState('libres'), [filtreC, setFiltreC] = useState('toutes');
  const [nVusA, setNVusA] = useState(60), [nVusC, setNVusC] = useState(60);
  const corpsRef = useRef(null), finA = useRef(null), finC = useRef(null), tirer = useRef(null);
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
    const l = large ? listeCibles.current : corpsRef.current;
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
  // La liste montrée au téléphone : celle d'en face du choix (ou de l'achat levé), sinon l'onglet touché.
  const vueTel = leve || mode === 'achat' ? 'cibles' : mode === 'cible' ? 'achats' : ongletTel;
  // Une autre liste à l'écran : elle commence en haut (au téléphone, la feuille entière défile).
  useEffect(() => { if (!large && corpsRef.current) corpsRef.current.scrollTop = 0; }, [vueTel, large]);
  // La tranche suivante arrive quand la fin de la liste approche (défilement de la feuille, ou de la liste à l'ordinateur).
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { if (e.target === finA.current) setNVusA((n) => n + 60); if (e.target === finC.current) setNVusC((n) => n + 60); } }, { rootMargin: '600px 0px' });
    if (finA.current) io.observe(finA.current); if (finC.current) io.observe(finC.current);
    return () => io.disconnect();
  });
  // Fermer en tirant vers le bas : seulement depuis la poignée / l'en-tête (jamais depuis une liste qui défile).
  const tirerDebut = (e) => { if (e.pointerType === 'mouse') return; tirer.current = { y: e.clientY, id: e.pointerId }; };
  const tirerFin = (e) => { const t = tirer.current; tirer.current = null; if (t && t.id === e.pointerId && e.clientY - t.y > 80) onFermer(); };
  const xChoisi = choisi ? parTx.get(choisi) : null, cChoisie = cibleChoisie ? parCle.get(cibleChoisie) : null;

  const achatLeve = leve ? parTx.get(leve.tx) : null;
  // (17 nov., lot relier-taille) Un achat choisi : chaque vente / annonce dit si sa taille est la même (« ✓ ») ou non.
  const accordCible = (c) => {
    if (!xChoisi) return null;
    const f = faitsAchat(xChoisi.a, { details: details || null, cible: c, marqueDe, couleursDe });
    if (!f.accord) return null;
    return <span className={`vrm-faits-taille vrm-rg-accord is-${f.accord}`} data-taille-accord={f.accord} data-relier-taille={f.taille}>
      {f.accord === 'meme' ? tr('faits.memeCible') : tr('faits.diffCible', { taille: f.taille })}</span>;
  };
  const nSansTaille = useMemo(() => (details && Array.isArray(L.achats) ? sansTailleLue(L.achats.map((x) => x.a), details) : 0), [details, L.achats]);
  const nA = Array.isArray(L.achats) ? L.achats.length : null;
  const relies = useMemo(() => achatsRelies({ achats, liens }), [achats, liens]);
  const nRelies = Array.isArray(relies) ? relies.length : null;
  // « Très probable » : seulement pour la vente / l'annonce CHOISIE, et ces achats-là en tête.
  const achatsVus = useMemo(() => (filtreA === 'relies' ? relies : marquerPour(L.achats, tresProbables, cibleChoisie)), [filtreA, relies, L.achats, tresProbables, cibleChoisie]);
  const nCibles = useMemo(() => compterCibles(L.cibles), [L.cibles]);
  const ciblesVues = useMemo(() => filtrerCibles(L.cibles, filtreC), [L.cibles, filtreC]);
  // Un choix fait (achat ou article) : la liste d'en face revient à « Libres » / garde son filtre.
  useEffect(() => { if (cibleChoisie && filtreA !== 'libres') setFiltreA('libres'); }, [cibleChoisie, filtreA]);
  const carteAchat = (x, flottante = false) => {
    const a = x.a, ph = photoDe(a), px = prixDe(a), lot = lotDe(a).lot;
    // (17 nov., lot relier-taille) La taille (lue chez Vinted, sinon celle du titre), comparée à la vente / l'annonce
    // CHOISIE (« ✓ » ou « ≠ 42 »), l'état, les couleurs, la marque, la date, le compte, le vendeur — src/FaitsAchat.jsx.
    const sous = <FaitsAchat achat={a} details={details || null} cible={cChoisie || null} marqueDe={marqueDe} couleursDe={couleursDe}
      date={a.date ? jourCourt(a.date) : ''} compte={compteDe(a)} court className="vrm-rg-faits"/>;
    return (
      <>
        <span className="vrm-rg-photo" aria-hidden="true">{ph ? <Photo src={ph} alt="" loading="lazy" decoding="async" draggable={false}/> : <Icon name="bag" size={20}/>}</span>
        <span className="vrm-rg-texte">
          <span className="vrm-rg-titre">{a.title || '—'}</span>
          <span className="vrm-rg-sous">{sous}</span>
          {x.pour && !flottante ? <span className="vrm-rg-propose" data-glisser-propose={cibleChoisie}>{tr('liaison.niveau.tresProbable')}</span> : null}
          {x.relie ? <span className="vrm-rg-propose" data-glisser-deja-relie="">{tr('glisser.dejaRelie')}</span> : null}
        </span>
        <span className="vrm-rg-prix">{lot ? tr('glisser.lot') : px != null ? montant(px) : '—'}</span>
      </>
    );
  };

  return createPortal(
    <div className="vrm-rg" data-relier-glisser="" data-glisser-mode={mode || undefined} data-glisser-vue={large ? undefined : vueTel} data-glisser-large={large ? '1' : '0'} data-glisser-leve={leve ? leve.tx : undefined} role="dialog" aria-modal="true" aria-label={tr('glisser.titre')}
      style={{ zIndex, '--rg-fond': C.bg, '--rg-carte': C.card, '--rg-encre': C.text, '--rg-gris': C.muted, '--rg-filet': C.border, '--rg-accent': C.accent, '--rg-sur-accent': C.onAccent }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-rg-poignee" data-glisser-poignee="" aria-hidden="true" onPointerDown={tirerDebut} onPointerUp={tirerFin} onPointerCancel={() => { tirer.current = null; }}><span/></div>
      <header className="vrm-rg-tete" onPointerDown={tirerDebut} onPointerUp={tirerFin} onPointerCancel={() => { tirer.current = null; }}>
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
      {!large && !mode && !leve ? (
        <div className="vrm-rg-onglets" role="tablist" data-glisser-onglets="">
          {[['achats', tr('glisser.achatsTitre'), null], ['cibles', tr('glisser.cibles'), null]].map(([k, lib, n]) => (
            <button key={k} type="button" role="tab" aria-selected={vueTel === k} className="vrm-rg-onglet" data-glisser-onglet={k} onClick={() => setOngletTel(k)}>
              {lib}{n != null ? <span className="vrm-rg-n">{n}</span> : null}</button>))}
        </div>
      ) : null}
      <div className="vrm-rg-corps" ref={corpsRef} data-glisser-defile="">
        <section className="vrm-rg-col vrm-rg-achats" aria-label={tr('glisser.achats')}>
          <div className="vrm-rg-entete">
          <h3 className="vrm-rg-h3">{tr('glisser.achatsTitre')}</h3>
          {!mode && !leve ? (
            <div className="vrm-rg-filtres" role="group" aria-label={tr('glisser.filtrer')} data-glisser-filtre-achats={filtreA}>
              {[['libres', tr('glisser.filtre.libres'), nA], ['relies', tr('glisser.filtre.relies'), nRelies]].map(([k, lib, n]) => (
                <button key={k} type="button" className="vrm-rg-filtre" aria-pressed={filtreA === k} data-glisser-filtre={k} onClick={() => { setFiltreA(k); setNVusA(60); }}>
                  {lib}{n != null ? <span className="vrm-rg-n">{n}</span> : null}</button>))}
            </div>
          ) : null}
          </div>
          <ul className="vrm-rg-liste" data-glisser-achats={nA == null ? '' : String(nA)} data-glisser-achats-vus={Array.isArray(achatsVus) ? String(achatsVus.length) : ''}>
            {achatsVus === undefined ? <li className="vrm-rg-vide">…</li>
              : achatsVus === null ? <li className="vrm-rg-vide">{tr('glisser.pasSu')}</li>
              : !achatsVus.length ? <li className="vrm-rg-vide" data-glisser-vide="achats">{filtreA === 'relies' ? tr('glisser.aucunRelie') : tr('glisser.aucunAchat')}</li>
              : achatsVus.slice(0, nVusA).map((x) => (x.relie ? (
                <li key={'r' + x.tx}>
                  <div className="vrm-rg-carte vrm-rg-achat is-relie" data-glisser-relie={x.tx}>{carteAchat(x)}</div>
                </li>) : (
                <li key={x.tx}>
                  <button type="button" className="vrm-rg-carte vrm-rg-achat" data-glisser-achat={x.tx} aria-pressed={choisi === x.tx}
                    data-glisser-source={leve && leve.tx === x.tx ? '1' : undefined}
                    onPointerDown={(e) => debut(e, x)} onContextMenu={(e) => e.preventDefault()}
                    onClick={() => toucherAchat(x)}>
                    {carteAchat(x)}
                  </button>
                </li>)))}
            {/* La phrase « N achats sans taille lue », une fois, au BAS de la liste : au téléphone la moitié haute de
                l'écran reste aux achats eux-mêmes. */}
            {Array.isArray(achatsVus) && achatsVus.length > nVusA ? <li ref={finA} className="vrm-rg-plus-li"><button type="button" className="vrm-rg-plus" data-glisser-plus="achats" onClick={() => setNVusA((n) => n + 60)}>{tr('relierTout.plus', { n: String(achatsVus.length - nVusA) })}</button></li> : null}
            {filtreA === 'libres' && details && nSansTaille && Array.isArray(L.achats) && L.achats.length ? <li className="vrm-rg-note-li"><NoteTailleAchats n={nSansTaille} className="vrm-rg-note"/></li> : null}
          </ul>
        </section>
        <section className="vrm-rg-col vrm-rg-cibles" aria-label={tr('glisser.cibles')}>
          <div className="vrm-rg-entete">
          <h3 className="vrm-rg-h3">{tr('glisser.cibles')}</h3>
          {L.cibles.length ? (
            <div className="vrm-rg-filtres" role="group" aria-label={tr('glisser.filtrer')} data-glisser-filtre-cibles={filtreC}>
              {[['toutes', tr('glisser.filtre.toutes'), nCibles.toutes], ['annonce', tr('glisser.filtre.enLigne'), nCibles.annonce], ['vente', tr('glisser.filtre.vendues'), nCibles.vente]].map(([k, lib, n]) => (
                <button key={k} type="button" className="vrm-rg-filtre" aria-pressed={filtreC === k} data-glisser-filtre={k} onClick={() => { setFiltreC(k); setNVusC(60); }}>
                  {lib}<span className="vrm-rg-n">{n}</span></button>))}
            </div>
          ) : null}
          </div>
          <ul className="vrm-rg-liste" ref={listeCibles} data-glisser-cibles={String(L.cibles.length)} data-glisser-cibles-vues={String(ciblesVues.length)}>
            {!L.cibles.length ? <li className="vrm-rg-vide" data-glisser-vide="cibles">{tr('glisser.aucuneCible')}</li>
              : !ciblesVues.length ? <li className="vrm-rg-vide" data-glisser-vide="cibles-filtre">{tr('glisser.aucuneFiltre')}</li>
              : ciblesVues.slice(0, nVusC).map((c) => {
              const actif = survol === String(c.key);
              const propose = achatLeve && achatLeve.propose === String(c.key);
              return (
                <li key={c.key}>
                  <button type="button" className="vrm-rg-carte vrm-rg-cible" data-glisser-cible={c.key} data-glisser-ici={choisi ? c.key : undefined} aria-pressed={cibleChoisie === String(c.key)} data-glisser-genre={c.genre} data-glisser-survol={actif ? '1' : undefined} data-glisser-attendue={propose ? '1' : undefined}
                    onClick={() => toucherCible(c)}>
                    <span className="vrm-rg-photo" aria-hidden="true">{c.photo ? <Photo src={c.photo} alt="" loading="lazy" decoding="async" draggable={false}/> : <Icon name="image" size={20}/>}</span>
                    <span className="vrm-rg-texte">
                      <span className="vrm-rg-titre">{c.num ? <b className="vrm-rg-num">N°{c.num}</b> : null}{c.titre || '—'}</span>
                      <span className="vrm-rg-sous">{[c.genre === 'vente' ? tr('glisser.vendue') : tr('glisser.enVente'), c.taille ? tr('faits.taille', { taille: String(c.taille).replace('.', ',') }) : '', c.sous].filter(Boolean).join(' · ')}</span>
                      {accordCible(c)}
                    </span>
                    {choisi ? <span className="vrm-rg-ici" aria-hidden="true">{tr('glisser.relierIci')}</span> : null}
                  </button>
                </li>
              );
            })}
            {ciblesVues.length > nVusC ? <li ref={finC} className="vrm-rg-plus-li"><button type="button" className="vrm-rg-plus" data-glisser-plus="cibles" onClick={() => setNVusC((n) => n + 60)}>{tr('relierTout.plus', { n: String(ciblesVues.length - nVusC) })}</button></li> : null}
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
