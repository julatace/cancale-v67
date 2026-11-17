// ══════════════════════════════════════════════════════════════════════════════
//  LA SÉLECTION EN SÉRIE — un mécanisme, toutes les listes (11 nov., actions-serie)
// ══════════════════════════════════════════════════════════════════════════════
// La règle (cocher, plage, tout le filtre, résumé honnête, plafond Vinted) est
// dans src/selectionSerie.js ; ici, le geste et la barre :
//   · `useSelectionSerie(ordre)` : l'état d'une liste (clés dans l'ordre affiché) ;
//   · `<CaseSerie>` : la case d'une ligne (Maj-clic = la plage) ;
//   · `serie.ligne(cle)` : les props d'une ligne (appui long au doigt ; quand la
//     sélection est ouverte, un tap coche au lieu d'ouvrir la ligne) ;
//   · `<BarreSerie>` : « N sélectionnés », « Tout sélectionner », les actions,
//     « Annuler » — en portail (une feuille au-dessus d'elle reste au-dessus, §7).
import { lancerTravail } from '../suiviTravail.js';   // (11 nov., lot suivi-travail) l'API unique des actions longues
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BoutonBase as Bouton } from './Bouton.jsx';
import { basculer, plage, toutSelectionner, garderVisibles, APPUI_LONG_MS } from '../selectionSerie.js';
import '../selection-serie.css';
import { tr } from '../i18n/index.js';
// (17 nov., nouveau design) La barre de sélection redessinée (Julien : « même le imprimer, le je dépose, etc c'est bizarre ») :
// allumé seulement (`vrm_design_v2`) ; éteint, la barre d'hier, inchangée.
import { useDesignV2 } from '../designV2/reglage.js';
import { BoutonV2, BoutonIconeV2 } from '../designV2/BoutonV2.jsx';

const feuilleOuverte = () => {
  try { return !!document.querySelector('[role="dialog"][aria-modal="true"], .vrm-sheet-voile, [data-sheet-ouverte]'); } catch (_) { return false; }
};

// `ordre` = les clés des lignes SÉLECTIONNABLES, dans l'ordre affiché : celles DESSINÉES à l'écran
// (`clesSelectionnables`, src/selectionSerie.js), jamais l'historique entier (16 nov., lot
// ventes-selection). `vue` = ce qui définit la liste montrée (filtre, compte, période) : quand elle
// change, la sélection se VIDE — une action ne part jamais sur des lignes choisies dans une autre vue.
export function useSelectionSerie(ordre, { nom = '', vue = '' } = {}) {
  const [sel, setSel] = useState([]);
  const [actif, setActif] = useState(false);
  const ancre = useRef(null);
  const appui = useRef(null);
  const ordreS = useMemo(() => (Array.isArray(ordre) ? ordre.map(String) : []), [ordre]);
  // Une ligne qui n'est plus affichée (filtre changé) sort de la sélection.
  useEffect(() => { setSel((s) => garderVisibles(s, ordreS)); }, [ordreS]);
  const vider = useCallback(() => { setSel([]); setActif(false); ancre.current = null; }, []);
  // Une autre vue (filtre, compte, période) ⇒ la sélection se vide (rien ne reste choisi hors de l'écran).
  const vueAvant = useRef(vue);
  useEffect(() => { if (vueAvant.current !== vue) { vueAvant.current = vue; vider(); } }, [vue, vider]);
  const visibles = useMemo(() => new Set(ordreS), [ordreS]);
  // Échap sort de la sélection — sauf si une feuille est ouverte (elle se ferme d'abord).
  useEffect(() => {
    if (!actif) return undefined;
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !feuilleOuverte()) { e.preventDefault(); vider(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [actif, vider]);
  const estCoche = useCallback((cle) => sel.includes(String(cle)), [sel]);
  const cocher = useCallback((cle, e) => {
    const k = String(cle);
    if (!visibles.has(k)) return;   // une ligne pas sélectionnable (estompée, repliée) ne se coche pas
    setActif(true);
    setSel((s) => {
      if (e && e.shiftKey && ancre.current != null) return plage(ordreS, ancre.current, k, s, !s.includes(k));
      return basculer(s, k);
    });
    ancre.current = k;
  }, [ordreS, visibles]);
  const tout = useCallback(() => { setActif(true); setSel(toutSelectionner(ordreS)); }, [ordreS]);
  const commencer = useCallback((cle) => {
    if (!visibles.has(String(cle))) return;
    setActif(true); ancre.current = String(cle);
    setSel((s) => (s.includes(String(cle)) ? s : [...s, String(cle)]));
    try { navigator.vibrate && navigator.vibrate(12); } catch (_) {}
  }, [visibles]);
  // Les props d'une ligne : appui long au doigt ; sélection ouverte ⇒ le tap coche.
  // Au repos (rien d'ouvert), les props d'une ligne ne changent pas : gardées par clé,
  // une ligne mémoïsée (React.memo) ne se redessine pas pour rien.
  const repos = useRef(new Map());
  useEffect(() => { repos.current = new Map(); }, [visibles]);
  const ligne = useCallback((cle) => {
    const k = String(cle);
    if (!actif && !sel.length && repos.current.has(k)) return repos.current.get(k);
    // ⚠️ (16 nov.) Le doigt posé AVANT de faire défiler (iPhone) ouvrait la sélection en 450 ms :
    // « 1 sélectionné » sans l'avoir voulu. Tout défilement pendant l'appui l'annule.
    const annulerAppui = () => { const a = appui.current; if (a) { clearTimeout(a.t); if (a.off) a.off(); appui.current = null; } };
    const props = {
      'data-serie-ligne': k,
      'data-serie-coche': sel.includes(k) ? '1' : '0',
      onPointerDown: (e) => {
        if (e.pointerType !== 'touch' || actif) return;
        annulerAppui();
        const x = e.clientX, y = e.clientY;
        const surDefile = () => annulerAppui();
        try { document.addEventListener('scroll', surDefile, { capture: true, passive: true }); } catch (_) {}
        const off = () => { try { document.removeEventListener('scroll', surDefile, { capture: true }); } catch (_) {} };
        appui.current = { x, y, off, t: setTimeout(() => { off(); appui.current = { fait: true }; commencer(k); }, APPUI_LONG_MS) };
      },
      onPointerMove: (e) => { const a = appui.current; if (a && !a.fait && (Math.abs(e.clientX - a.x) > 8 || Math.abs(e.clientY - a.y) > 8)) annulerAppui(); },
      onPointerUp: () => { if (appui.current && !appui.current.fait) annulerAppui(); },
      onPointerCancel: annulerAppui,
      onContextMenu: (e) => { if (appui.current && appui.current.fait) e.preventDefault(); },
      onClickCapture: (e) => {
        // L'appui long vient d'ouvrir la sélection : le relâcher n'ouvre pas la ligne.
        if (appui.current && appui.current.fait) { appui.current = null; e.preventDefault(); e.stopPropagation(); return; }
        if (!actif) return;
        // La case elle-même gère son clic (Maj-clic compris).
        if (e.target && e.target.closest && e.target.closest('[data-serie-case]')) return;
        e.preventDefault(); e.stopPropagation(); cocher(k, e);
      },
    };
    if (!visibles.has(k)) { const p = { ...props }; delete p.onPointerDown; delete p.onClickCapture; p['data-serie-hors'] = '1'; return p; }
    if (!actif && !sel.length) repos.current.set(k, props);
    return props;
  }, [sel, actif, commencer, cocher, visibles]);
  const choisies = useMemo(() => ordreS.filter((k) => sel.includes(k)), [ordreS, sel]);
  return { nom, actif, sel, choisies, n: choisies.length, total: ordreS.length, estCoche, cocher, tout, vider, commencer, ligne, ouvrir: () => setActif(true) };
}

// Deux jeux de props sur la même ligne (le glisser « déposé » ET la sélection) :
// chaque gestionnaire appelle les deux ; celui de la sélection passe d'abord, et
// s'il arrête le clic, l'autre ne le voit pas.
export function avecSerie(a, b) {
  const out = { ...(a || {}), ...(b || {}) };
  for (const k of Object.keys(a || {})) {
    if (!/^on[A-Z]/.test(k) || typeof a[k] !== 'function' || !b || typeof b[k] !== 'function') continue;
    out[k] = (e) => { b[k](e); if (e && typeof e.isPropagationStopped === 'function' && e.isPropagationStopped()) return; a[k](e); };
  }
  return out;
}

// La case d'une ligne. À la souris elle est toujours là (discrète tant que rien
// n'est coché) ; au doigt elle n'apparaît qu'une fois la sélection ouverte.
// `surPhoto` : la case se pose dans le coin de la vignette (les lignes en grille
// gardent leurs colonnes) ; le parent devient `position: relative` (CSS).
export function CaseSerie({ serie, cle, etiquette, surPhoto = false }) {
  const k = String(cle);
  const on = serie.estCoche(k);
  return (
    <label className={surPhoto ? 'vrm-serie-case vrm-serie-case-photo' : 'vrm-serie-case'} data-serie-case={k} data-serie-on={on ? "1" : "0"} data-serie-actif={serie.actif ? '1' : '0'} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={on} aria-label={etiquette ? `Sélectionner ${etiquette}` : 'Sélectionner cette ligne'}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); serie.cocher(k, e); }} onChange={() => {}}/>
    </label>
  );
}

// Le bouton « Sélectionner » d'une liste (ouvre la sélection sans appui long).
export function OuvrirSerie({ serie, libelle = 'Sélectionner' }) {
  if (serie.actif || !serie.total) return null;
  return <Bouton variante="discret" taille="petit" data-serie-ouvrir={serie.nom} onClick={() => serie.ouvrir()}>{libelle}</Bouton>;
}

// La barre flottante. `actions` = [{ k, libelle, icone?, desactive?, raison?, faire }]
// `faire(choisies)` rend (ou promet) un résumé (texte) ; il est dit dans la barre.
export function BarreSerie({ serie, actions = [], unite = null, rendreIcone }) {
  if (!unite) unite = { un: tr('serie.un'), plusieurs: tr('serie.plusieurs') };
  const [resume, setResume] = useState('');
  const [occupe, setOccupe] = useState(false);
  const barreRef = useRef(null);
  const v2 = useDesignV2();
  const [menuV2, setMenuV2] = useState(false);
  // La barre neuve entre et sort en ressort : elle reste montée 220 ms après la fin de la sélection (la sortie se voit).
  const [sortieV2, setSortieV2] = useState(false);
  const etaitActif = useRef(false);
  useEffect(() => {
    if (!v2) return undefined;
    if (serie.actif) { etaitActif.current = true; setSortieV2(false); return undefined; }
    if (!etaitActif.current) return undefined;
    etaitActif.current = false; setMenuV2(false); setSortieV2(true);
    const t = setTimeout(() => setSortieV2(false), 220); return () => clearTimeout(t);
  }, [serie.actif, v2]);
  // (16 nov., lot ventes-selection) Sélection ouverte : la racine le dit (`data-serie-ouverte`) et porte
  // la hauteur de la barre (`--vrm-serie-h`) — au téléphone la barre PREND LA PLACE de la barre du bas
  // et la page garde cet espace en bas (rien de caché dessous) ; la ligne touchée reste au-dessus d'elle.
  useEffect(() => {
    if (!serie.actif || typeof document === 'undefined') return undefined;
    const racine = document.documentElement;
    racine.setAttribute('data-serie-ouverte', serie.nom || '1');
    const poser = () => { const b = barreRef.current; if (b) racine.style.setProperty('--vrm-serie-h', Math.ceil(b.getBoundingClientRect().height) + 'px'); };
    poser();
    let ro = null; try { if (typeof ResizeObserver === 'function' && barreRef.current) { ro = new ResizeObserver(poser); ro.observe(barreRef.current); } } catch (_) {}
    const t = setTimeout(() => {
      try {
        poser();
        const b = barreRef.current, l = document.querySelector('[data-serie-coche="1"]');
        if (b && l) { const rb = b.getBoundingClientRect(), rl = l.getBoundingClientRect(); if (rl.bottom > rb.top - 8) l.scrollIntoView({ block: 'center' }); }
      } catch (_) {}
    }, 60);
    return () => { clearTimeout(t); if (ro) ro.disconnect(); racine.removeAttribute('data-serie-ouverte'); racine.style.removeProperty('--vrm-serie-h'); };
  }, [serie.actif, serie.nom]);
  // Le résumé reste lisible quelques secondes après la fermeture de la sélection.
  useEffect(() => { if (!resume || serie.actif) return undefined; const t = setTimeout(() => setResume(''), 8000); return () => clearTimeout(t); }, [resume, serie.actif]);
  if (typeof document === 'undefined') return null;
  if (v2 && !serie.actif && sortieV2) return createPortal(<div className="v2-serie is-sortie" aria-hidden="true"/>, document.body);
  if (!serie.actif) {
    return resume ? createPortal(<div className="vrm-serie-barre" data-serie-barre={serie.nom} data-serie-fermee="">
      <p className="vrm-serie-resume" role="status" data-serie-resume="">{resume}</p>
      <Bouton variante="discret" taille="petit" onClick={() => setResume('')}>OK</Bouton></div>, document.body) : null;
  }
  const n = serie.n;
  const lancer = async (a) => {
    if (!n || occupe || a.desactive) return;
    setOccupe(true);
    try {
      // (11 nov., lot suivi-travail) Une action en série qui dure (bordereaux, factures…) fige VRM avec
      // la feuille « VRM travaille » ; finie sous 1 s et sans souci, rien ne s'affiche (src/suiviTravail.js).
      const { valeur: r, resultats } = await lancerTravail({ sorte: `serie-${serie.nom || ''}`, titre: `${a.libelle} · ${n}`, executer: async (o) => {
        const v = await a.faire(serie.choisies);
        if (v && typeof v === 'object' && v.annule) { o.noter('Annulé'); return v; }
        const txt = typeof v === 'string' ? v : (v && v.texte) || '';
        if (txt) o.noter(txt);
        return v;
      } });
      if (resultats && resultats.action && resultats.action.etat === 'refus' && r === undefined) { setResume('Pas fait : ' + resultats.action.raison); setOccupe(false); return; }
      if (r && typeof r === 'object' && r.annule) { setOccupe(false); return; }
      setResume(typeof r === 'string' ? r : (r && r.texte) || '');
      if (!(r && r.garder)) serie.vider();
    } catch (e) { setResume('Pas fait : ' + String((e && e.message) || e)); }
    setOccupe(false);
  };
  if (v2) {
    // UNE barre fine, posée au-dessus de la barre du bas : « 3 sélectionnés · Tout · 60 · Annuler » à gauche ; à droite UN
    // plein — la première action que la sélection permet, avec SON nombre (« Imprimer 3 bordereaux ») — et « ⋯ » pour les
    // autres, chacune avec son nombre ou la raison (jamais de tuile grisée, jamais « 0 sur 1 »).
    const vues = actions.filter(Boolean).map((a) => { let p = null; try { p = n && typeof a.portee === 'function' ? a.portee(serie.choisies) : null; } catch (_) { p = null; }
      const nA = p ? p.n : n; return { a, p, nA, possible: !!n && !a.desactive && nA > 0 }; });
    const princ = vues.find((x) => x.possible) || null;
    const autres = vues.filter((x) => x !== princ);
    const libPlein = (x) => (typeof x.a.plein === 'function' ? x.a.plein(x.nA) : x.a.libelle + ' · ' + x.nA);
    return createPortal(
      <div ref={barreRef} className="v2-serie" role="toolbar" aria-label={tr('serie.barre')} data-serie-barre={serie.nom} data-serie-n={n} data-serie-total={serie.total} data-v2-serie="">
        <div className="v2-serie-g">
          <b role="status" data-serie-compte={n}>{tr('v2s.n', { n })}</b>
          <span className="v2-serie-liens">
            {n < serie.total ? <button type="button" className="v2-serie-lien" data-serie-tout={serie.total} onClick={() => serie.tout()}>{tr('v2s.tout', { n: serie.total })}</button> : null}
            <button type="button" className="v2-serie-lien" data-serie-annuler="" onClick={() => serie.vider()} title="Échap">{tr('serie.annuler')}</button>
          </span>
        </div>
        {resume ? <p className="v2-serie-resume" role="status" data-serie-resume="">{resume}</p> : null}
        <div className="v2-serie-d">
          {princ ? <BoutonV2 role="principal" compact icone={rendreIcone ? rendreIcone(princ.a.icone || 'check', 20) : null} chargement={occupe}
            attrs={{ 'data-serie-action': princ.a.k, 'data-serie-principal': princ.a.k, 'data-serie-portee': princ.p ? `${princ.p.n}/${princ.p.m}` : undefined }} onClick={() => lancer(princ.a)}>{libPlein(princ)}</BoutonV2>
            : <span className="v2-serie-rien" data-serie-rien="">{n ? tr('v2s.rien') : tr('v2s.choisir')}</span>}
          {autres.length ? <BoutonIconeV2 icone={rendreIcone ? rendreIcone('more', 22) : <span aria-hidden="true">⋯</span>} label={tr('v2s.autres')} onClick={() => setMenuV2(true)} attrs={{ 'data-serie-plus': '' }}/> : null}
        </div>
        {menuV2 ? createPortal(<div className="v2-feuille-hote is-ouverte" data-v2-feuille="serie">
          <div className="v2-voile" onClick={() => setMenuV2(false)} aria-hidden="true"/>
          <div className="v2-feuille v2-outils-feuille" role="dialog" aria-modal="true" aria-label={tr('v2s.autres')}>
            <div className="v2-feuille-tete"><span className="v2-feuille-poignee" aria-hidden="true"/><h2 className="v2-feuille-titre">{tr('v2s.n', { n })}</h2>
              <BoutonIconeV2 icone={rendreIcone ? rendreIcone('close', 22) : <span aria-hidden="true">×</span>} label={tr('v2.menu.fermer')} onClick={() => setMenuV2(false)} attrs={{ 'data-v2-feuille-fermer': '' }}/></div>
            <div className="v2-feuille-corps v2-ann-menu">
              {autres.map((x) => x.possible
                ? <button key={x.a.k} type="button" className="vrm-annbar-outil" data-serie-action={x.a.k} onClick={() => { setMenuV2(false); lancer(x.a); }}>
                    <span aria-hidden="true" className="vrm-annbar-outil-icone">{rendreIcone ? rendreIcone(x.a.icone || 'check', 18) : null}</span>
                    <span className="vrm-annbar-outil-mot">{x.a.libelle}</span><span className="vrm-annbar-outil-n" style={{ marginLeft: 'auto' }}>{x.nA}</span></button>
                : <div key={x.a.k} className="v2-serie-indispo" data-serie-indispo={x.a.k}>
                    <span aria-hidden="true" className="vrm-annbar-outil-icone">{rendreIcone ? rendreIcone(x.a.icone || 'check', 18) : null}</span>
                    <span className="vrm-annbar-outil-mot">{x.a.libelle}</span><span className="v2-serie-raison">{x.a.desactive ? (x.a.raison || tr('serie.aucune')) : (x.a.raisonZero || tr('serie.aucune'))}</span></div>)}
            </div>
          </div>
        </div>, document.body) : null}
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div ref={barreRef} className="vrm-serie-barre" role="toolbar" aria-label={tr('serie.barre')} data-serie-barre={serie.nom} data-serie-n={n} data-serie-total={serie.total}>
      <div className="vrm-serie-tete">
        <b role="status" data-serie-compte={n}>{n} {n > 1 ? unite.plusieurs : unite.un}</b>
        <Bouton variante="discret" taille="petit" data-serie-annuler="" onClick={() => serie.vider()} title="Échap">{tr('serie.annuler')}</Bouton>
        {n < serie.total
          ? <Bouton variante="discret" taille="petit" className="vrm-serie-tout" data-serie-tout={serie.total} onClick={() => serie.tout()}>{tr('serie.tout', { n: serie.total })}</Bouton>
          : null}
      </div>
      {resume ? <p className="vrm-serie-resume" role="status" data-serie-resume="">{resume}</p> : null}
      <div className="vrm-serie-actions" style={{ '--vrm-serie-nb': actions.filter(Boolean).length }}>
        {actions.filter(Boolean).map((a) => {
          // (16 nov.) Ce que l'action ferait VRAIMENT : « 2 sur 3 » (la règle de l'action, `portee`) ; 0 ⇒ grisée, la raison au survol.
          let p = null; try { p = n && typeof a.portee === 'function' ? a.portee(serie.choisies) : null; } catch (_) { p = null; }
          const zero = !!(p && p.n === 0);
          return (
            <Bouton key={a.k} variante={a.variante || 'secondaire'} taille="petit" icone={a.icone} {...(rendreIcone ? { rendreIcone } : {})} data-serie-action={a.k}
              data-serie-portee={p ? `${p.n}/${p.m}` : undefined}
              disabled={!n || occupe || !!a.desactive || zero} title={a.desactive ? a.raison : zero ? (a.raisonZero || tr('serie.aucune')) : undefined} onClick={() => lancer(a)}>
              <span className="vrm-serie-action-nom">{a.libelle}</span>
              {p && p.n !== p.m ? <span className="vrm-serie-action-portee">{tr('serie.portee', { n: p.n, m: p.m })}</span> : null}
            </Bouton>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
