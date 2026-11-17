// ── src/maquettes/Comptoir.jsx — MAQUETTE E « Le comptoir » (17 nov., proposition à Julien) ──
// L'accueil devient l'app : plus de barre d'onglets. Une grille de grandes tuiles vivantes (façon widgets
// iOS), une par ZONE de l'activité, chacune avec SON chiffre et SON geste. Une tuile touchée s'agrandit EN
// PLACE jusqu'à devenir l'écran (la forme de la tuile s'ouvre, rien ne « change de page ») ; en bas, le dock
// des autres tuiles en miniature remplace la barre d'onglets. Les tuiles se rangent (appui long ou « Ranger »).
// Aucune règle neuve : chaque chiffre est celui que Ma journée calcule déjà (src/App.jsx, `T`, `colisJournee`,
// `bilanVentes`, `recuDuMois`, `stockQuiDort`…), « — » quand il n'est pas su. Les panneaux ouverts montrent les
// listes RÉELLES de Ma journée (`deplie`), le geste « Imprimer » est le sien. Derrière `?banc_maquette=e`.
import React from 'react';
import { createPortal } from 'react-dom';
import { tr, localeCourante } from '../i18n/index.js';
import { lireOrdre, ecrireOrdre, deplacer, gesteCoque } from './comptoirBanc.js';
import './comptoir.css';

const ORDRE_DEFAUT = ['envoyer', 'argent', 'retirer', 'messages', 'jour', 'enligne', 'prix', 'offres', 'sansprix', 'tout'];
const TAILLE = { envoyer: 'L', argent: 'M', retirer: 'M' };   // les autres : S

const reduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
const nombre = (v, dec = 0) => new Intl.NumberFormat(localeCourante(), { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
function Euros({ v, dec = 0 }) {
  if (v == null || !Number.isFinite(Number(v))) return <>—</>;
  return <>{nombre(Number(v), dec)}<span className="cp-eur">€</span></>;
}
const Agrandir = () => (
  <svg className="cp-agrandir" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg>
);
const Retour = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
);

// Les 14 derniers jours (VENDU au jour de la vente, la série de Ma journée) en barres fines ; aujourd'hui à l'encre.
function Barres({ jours, haut = 34, lettres = false }) {
  if (!Array.isArray(jours) || !jours.length) return null;
  const max = Math.max(1, ...jours.map((j) => (j && j.vendu ? j.vendu.eur : 0)));
  return (
    <div className={'cp-barres' + (lettres ? ' avec-lettres' : '')} style={{ '--cp-h': haut + 'px' }} aria-hidden="true" data-cp-barres={String(jours.length)}>
      {jours.map((j, k) => {
        const v = j && j.vendu ? j.vendu.eur : 0;
        return (
          <span key={j.cle || k} className={'cp-barre' + (k === jours.length - 1 ? ' is-auj' : '') + (v > 0 ? '' : ' is-zero')}>
            <i style={{ height: v > 0 ? Math.max(8, Math.round((v / max) * 100)) + '%' : undefined }}/>
            {lettres ? <b>{j.jour}</b> : null}
          </span>
        );
      })}
    </div>
  );
}

function Eventail({ photos, Photo, n = 3 }) {
  const l = (photos || []).filter(Boolean).slice(0, n);
  if (!l.length) return null;
  return (
    <span className="cp-eventail" data-n={String(l.length)} aria-hidden="true">
      {l.map((src, k) => <span key={k} className="cp-vignette" style={{ '--k': k, '--nb': l.length }}><Photo src={src} alt="" loading="lazy" decoding="async"/></span>)}
    </span>
  );
}

export default function Comptoir({ d, onNav, Photo, Icon, FermeAuRetour = null, ordi = false }) {
  const [ordre, setOrdre] = React.useState(() => lireOrdre(ORDRE_DEFAUT));
  const [ranger, setRanger] = React.useState(false);
  const [prise, setPrise] = React.useState(null);           // la tuile soulevée en mode « Ranger »
  const [ouverte, setOuverte] = React.useState(null);       // { id, phase: 'ouvre' | 'ouverte' | 'ferme' }
  const tuilesRef = React.useRef({});
  const sceneRef = React.useRef(null);
  const appuiLong = React.useRef(null);

  // ── Les tuiles : chiffre, geste, ce qui s'ouvre. Une tuile sans rien à montrer (pas de jobs Offres…) n'existe pas.
  const T = (id) => (d.T || []).find((x) => x.id === id) || null;
  const nDe = (x) => (x && x.t ? Number(x.t.n) || 0 : 0);
  const tE = T('envoyer'), tR = T('retirer'), tM = T('messages'), tP = T('prix');
  const A = d.argent || {};
  const def = {};

  if (d.envoyer && tE) {
    const n = nDe(tE), premier = (d.colis || []).find((c) => c.e && c.e.txt) || null;
    def.envoyer = {
      lib: tr('cp.l.envoyer'), icone: 'truck', n: tE.pasSu ? '—' : String(n), calme: !tE.pasSu && n === 0, ambre: !!(premier && premier.e.ambre),
      face: (<>
        <span className="cp-sous">{tE.pasSu ? tr('cp.pasSu') : n === 0 ? tr('cp.rienEnvoyer') : tr('cp.colis', { n })}</span>
        {premier && !tE.pasSu ? <span className={'cp-echeance' + (premier.e.ambre ? ' is-ambre' : '')}>{tr('cp.premier', { q: premier.e.txt })}</span> : null}
        <Eventail photos={d.photos && d.photos.envoyer} Photo={Photo}/>
      </>),
      plein: d.envoyer.plein || null,
      ecran: d.envoyer.deplie, tab: tE.tab, mini: tr('cp.m.envoyer'),
    };
  }
  {
    const pasSu = !!A.pasSu;
    def.argent = {
      lib: A.moisNom ? A.moisNom.charAt(0).toUpperCase() + A.moisNom.slice(1) : tr('cp.l.argent'), icone: 'euro',
      n: pasSu ? '—' : <Euros v={A.moisEur}/>, nClasse: 'is-euros', auMoins: !pasSu && !!A.auMoins,
      face: (<>
        <span className="cp-sous">{pasSu ? tr('cp.pasSu') : tr('cp.ventesMois', { n: A.moisN || 0 })}</span>
        <span className="cp-sous cp-sous-2">{tr('cp.recu')} <b><Euros v={A.recuMois}/></b></span>
        <Barres jours={A.jours}/>
      </>),
      tab: 'compta', mini: tr('cp.m.argent'), miniN: pasSu ? '—' : <Euros v={A.moisEur}/>,
      ecran: (
        <div className="cp-argent" data-cp-argent="">
          <section className="cp-carte cp-heros">
            <span className="cp-lib">{tr('cp.venduEn', { m: A.moisNom || '' })}</span>
            <b className="cp-n cp-n-heros" data-cp-vendu={pasSu ? '' : String(A.moisEur)}>{A.auMoins && !pasSu ? <small className="cp-aumoins">{tr('cp.auMoins')} </small> : null}{pasSu ? '—' : <Euros v={A.moisEur} dec={2}/>}</b>
            <span className="cp-sous">{pasSu ? tr('cp.pasSu') : tr('cp.ventesMois', { n: A.moisN || 0 })}{A.phraseNc ? ' · ' + A.phraseNc : ''}</span>
            <Barres jours={A.jours} haut={96} lettres/>
            <span className="cp-legende">{tr('cp.quatorze')}</span>
          </section>
          <div className="cp-bande" role="list">
            <div role="listitem"><span className="cp-lib">{tr('cp.recuMois')}</span><b className="cp-n cp-n-bande"><Euros v={A.recuMois}/></b></div>
            <div role="listitem"><span className="cp-lib">{tr('cp.deCote')}</span><b className="cp-n cp-n-bande"><Euros v={A.cotisMois}/></b></div>
            <div role="listitem"><span className="cp-lib">{tr('cp.caAnnee')}</span><b className="cp-n cp-n-bande"><Euros v={A.caAnnee}/></b></div>
          </div>
          <button type="button" className="sb-lien cp-lien-ecran" onClick={() => onNav && onNav('compta')}>{tr('cp.toutArgent')}</button>
        </div>
      ),
    };
  }
  if (d.retirer && tR) {
    const n = nDe(tR), codes = (d.codes || []).filter((c) => c && c.compte).slice(0, 2);
    def.retirer = {
      lib: tr('cp.l.retirer'), icone: 'box', n: tR.pasSu ? '—' : String(n), calme: !tR.pasSu && n === 0, ambre: !tR.pasSu && n > 0,
      face: (<>
        {codes.length && !tR.pasSu ? <span className="cp-codes">{codes.map((c, k) => (
          <span key={k} className="cp-code"><span className="sb-plaque">{c.code || 'QR'}</span><span className="cp-code-ou">{String(c.lieu || '').split(/[\n,]/)[0].trim()}</span></span>))}</span>
          : <span className="cp-sous">{tR.pasSu ? tr('cp.pasSu') : n === 0 ? tr('cp.rienRetirer') : tr('cp.codesPasLus')}</span>}
      </>),
      ecran: d.retirer.deplie, tab: tR.tab, mini: tr('cp.m.retirer'),
    };
  }
  if (d.messages && tM) {
    const n = nDe(tM);
    def.messages = { lib: tr('cp.l.messages'), icone: 'chat', n: tM.pasSu ? '—' : String(n), calme: !tM.pasSu && n === 0,
      face: <Eventail photos={d.photos && d.photos.messages} Photo={Photo} n={2}/>, ecran: d.messages.deplie, tab: tM.tab, mini: tr('cp.m.messages') };
  }
  {
    const pasSu = !!A.pasSu;
    def.jour = { lib: tr('cp.l.jour'), icone: 'calendar', n: pasSu ? '—' : String(A.jourN || 0), calme: !pasSu && !A.jourN,
      face: <span className="cp-sous cp-a-droite">{pasSu ? '' : <Euros v={A.jourEur}/>}</span>,
      tab: 'cat_ventes', mini: tr('cp.m.jour'),
      ecran: (<div className="cp-jour">{d.frise ? <section className="cp-carte">{d.frise}</section> : null}
        <button type="button" className="sb-lien cp-lien-ecran" onClick={() => onNav && onNav('cat_ventes')}>{tr('cp.toutesVentes')}</button></div>) };
  }
  {
    const E = d.enligne || {};
    def.enligne = { lib: tr('cp.l.enligne'), icone: 'shop', n: E.pasSu ? '—' : String(E.n || 0),
      face: <span className="cp-sous">{E.dort ? tr('cp.dorment', { n: E.dort.n, j: E.dort.seuil }) : ''}</span>,
      tab: 'cat_annonces', mini: tr('cp.m.enligne'),
      ecran: (<div className="cp-enligne">
        <section className="cp-carte cp-heros">
          <span className="cp-lib">{tr('cp.l.enligne')}</span>
          <b className="cp-n cp-n-heros">{E.pasSu ? '—' : nombre(E.n || 0)}</b>
          <span className="cp-sous">{E.dort ? tr('cp.dormentLong', { n: E.dort.n, j: E.dort.seuil }) : tr('cp.aucuneDort')}</span>
        </section>
        <div className="cp-gestes">
          <button type="button" className="sb-touche" onClick={() => gesteCoque('publier')}><Icon name="spark" size={16}/>{tr('cp.publierAilleurs')}</button>
          <button type="button" className="sb-touche" onClick={() => gesteCoque('scanner')}><Icon name="scan" size={16}/>{tr('cp.scanner')}</button>
        </div>
        <button type="button" className="sb-lien cp-lien-ecran" onClick={() => onNav && onNav('cat_annonces')}>{tr('cp.voirAnnonces')}</button>
        <button type="button" className="sb-lien cp-lien-ecran" onClick={() => onNav && onNav('stock')}>{tr('cp.voirStock')}</button>
      </div>) };
  }
  if (d.prix && tP) {
    const n = nDe(tP);
    def.prix = { lib: tr('cp.l.prix'), icone: 'tag', n: tP.pasSu ? '—' : String(n), calme: !tP.pasSu && n === 0, ecran: d.prix.deplie, tab: tP.tab, mini: tr('cp.m.prix') };
  }
  if (d.offres) def.offres = { lib: tr('cp.l.offres'), icone: 'cash', n: d.offres.tasse ? d.offres.tasse.n : '—', ambre: true, ecran: d.offres.deplie, tab: 'cat_msg', mini: tr('cp.m.offres') };
  if (d.sansprix) def.sansprix = { lib: tr('cp.l.sansPrix'), icone: 'receipt', n: d.sansprix.tasse ? d.sansprix.tasse.n : '—', ambre: true, ecran: d.sansprix.deplie, tab: 'cat_ventes', mini: tr('cp.m.sansPrix') };
  {
    const ECR = [['cat_ventes', 'cp.e.ventes', 'cart'], ['achats', 'cp.e.achats', 'bag'], ['cat_annonces', 'cp.e.annonces', 'shop'], ['stock', 'cp.e.stock', 'grid'],
      ['cat_bord', 'cp.e.colis', 'truck'], ['cat_msg', 'cp.e.messages', 'chat'], ['compta', 'cp.e.argent', 'euro'], ['invoices', 'cp.e.factures', 'receipt'], ['settings', 'cp.e.reglages', 'gear']];
    def.tout = { lib: tr('cp.l.tout'), icone: 'ecrans', n: null, mini: tr('cp.m.tout'),
      face: <span className="cp-points" aria-hidden="true">{ECR.slice(0, 8).map((e) => <span key={e[0]}><Icon name={e[2]} size={14}/></span>)}</span>,
      ecran: (<div className="cp-index" role="list">
        {ECR.map(([tab, cle, ic]) => (
          <button key={tab} type="button" role="listitem" className="cp-rangee" data-cp-ecran={tab} onClick={() => onNav && onNav(tab)}>
            <span className="cp-rangee-ic"><Icon name={ic} size={18}/></span><span className="cp-rangee-t">{tr(cle)}</span><span className="cp-chevron" aria-hidden="true">›</span>
          </button>))}
        <button type="button" className="sb-lien cp-lien-ecran" onClick={() => { fermer(); setTimeout(() => setRanger(true), 450); }}>{tr('cp.rangerLong')}</button>
      </div>) };
  }

  const ids = ordre.filter((id) => def[id]);

  // ── Ouvrir : la forme de la tuile s'ouvre jusqu'au cadre de l'écran (clip-path, sans déformer le contenu).
  const rectDe = (id) => { const el = tuilesRef.current[id]; return el && el.getBoundingClientRect ? el.getBoundingClientRect() : null; };
  const departRef = React.useRef(null);
  const ouvrir = (id) => {
    if (ranger) { if (!prise) setPrise(id); else { const o = deplacer(ordre, prise, id); setOrdre(o); ecrireOrdre(o); setPrise(null); } return; }
    if (!def[id] || !def[id].ecran) { if (def[id] && def[id].tab && onNav) onNav(def[id].tab); return; }
    departRef.current = rectDe(id);
    setOuverte({ id, phase: 'ouvre' });
  };
  const fermer = React.useCallback(() => {
    setOuverte((o) => (o ? { ...o, phase: 'ferme' } : o));
  }, []);
  const coupe = (r, p, rayon) => `inset(${Math.max(0, r.top - p.top)}px ${Math.max(0, p.right - r.right)}px ${Math.max(0, p.bottom - r.bottom)}px ${Math.max(0, r.left - p.left)}px round ${rayon}px)`;
  React.useLayoutEffect(() => {
    const s = sceneRef.current;
    if (!ouverte || !s) return undefined;
    const p = s.getBoundingClientRect();
    const rayonFin = ordi ? 28 : 0;
    if (ouverte.phase === 'ouvre') {
      const r = departRef.current;
      if (!r || reduit()) { s.style.clipPath = ''; s.dataset.cpEtat = 'ouverte'; setOuverte((o) => o && { ...o, phase: 'ouverte' }); return undefined; }
      s.style.transition = 'none'; s.style.clipPath = coupe(r, p, 22); s.dataset.cpEtat = 'depart';
      void s.offsetWidth;
      s.style.transition = ''; s.style.clipPath = `inset(0px 0px 0px 0px round ${rayonFin}px)`; s.dataset.cpEtat = 'ouvre';
      const fin = setTimeout(() => setOuverte((o) => o && o.phase === 'ouvre' ? { ...o, phase: 'ouverte' } : o), 460);
      return () => clearTimeout(fin);
    }
    if (ouverte.phase === 'ouverte') { s.dataset.cpEtat = 'ouverte'; return undefined; }
    if (ouverte.phase === 'ferme') {
      const id = ouverte.id, r = rectDe(id);
      const finir = () => { setOuverte(null); setTimeout(() => { const z = tuilesRef.current[id] && tuilesRef.current[id].querySelector('.cp-zone'); if (z) { try { z.focus({ preventScroll: true }); } catch (_) {} } }, 0); };
      if (!r || reduit()) { finir(); return undefined; }
      s.dataset.cpEtat = 'ferme'; s.style.clipPath = coupe(r, p, 22);
      const fin = setTimeout(finir, 400);
      return () => clearTimeout(fin);
    }
    return undefined;
  }, [ouverte && ouverte.id, ouverte && ouverte.phase, ordi]);
  React.useEffect(() => {
    if (!ouverte) return undefined;
    const echap = (e) => { if (e.key === 'Escape') fermer(); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [!!ouverte, fermer]);
  // Passer d'une tuile ouverte à une autre par le dock : la scène reste, son contenu change (fondu court).
  const basculer = (id) => { if (!def[id]) return; if (!def[id].ecran) { if (def[id].tab && onNav) onNav(def[id].tab); return; } setOuverte({ id, phase: 'ouverte' }); const s = sceneRef.current; if (s) s.scrollTop = 0; };

  const debutAppui = (id) => { clearTimeout(appuiLong.current); appuiLong.current = setTimeout(() => { setRanger(true); setPrise(id); appuiLong.current = 'fait'; }, 550); };
  const finAppui = () => { if (appuiLong.current !== 'fait') clearTimeout(appuiLong.current); };

  const maintenant = new Date();
  const dateTxt = maintenant.toLocaleDateString(localeCourante(), { weekday: 'long', day: 'numeric', month: 'long' });
  const tuileOuverte = ouverte ? def[ouverte.id] : null;
  const grilleCachee = !!(ouverte && ouverte.phase === 'ouverte' && !ordi);

  const tuile = (id) => {
    const t = def[id];
    const taille = TAILLE[id] || 'S';
    const actif = !!(ouverte && ouverte.id === id);
    return (
      <div key={id} ref={(el) => { tuilesRef.current[id] = el; }} className={'cp-t' + (t.calme ? ' is-calme' : '') + (actif ? ' is-actif' : '') + (ranger ? ' is-ranger' : '') + (prise === id ? ' is-prise' : '')}
        data-taille={taille} data-cp-tuile={id} data-n={typeof t.n === 'string' ? t.n : undefined} style={{ '--cp-i': ids.indexOf(id) }}>
        <button type="button" className="cp-zone" aria-label={(t.aria || (typeof t.lib === 'string' ? t.lib : '')) + (typeof t.n === 'string' ? ' · ' + t.n : '')}
          aria-expanded={t.ecran ? actif : undefined} aria-pressed={ranger ? prise === id : undefined} data-cp-zone={id}
          onClick={() => { if (appuiLong.current === 'fait') { appuiLong.current = null; return; } ouvrir(id); }}
          onPointerDown={() => debutAppui(id)} onPointerUp={finAppui} onPointerLeave={finAppui} onPointerCancel={finAppui}
          onContextMenu={(e) => e.preventDefault()}/>
        <span className="cp-lib" aria-hidden="true">{t.icone ? <Icon name={t.icone} size={15}/> : null}<span>{t.lib}</span>{t.ambre ? <span className="cp-point"/> : null}</span>
        {t.ecran ? <Agrandir/> : null}
        <div className="cp-corps" aria-hidden="true">
          {t.n != null ? <b className={'cp-n ' + (t.nClasse || '')}>{t.auMoins ? <small className="cp-aumoins">{tr('cp.auMoins')} </small> : null}{t.n}</b> : null}
          {t.face || null}
        </div>
        {t.plein && !ranger ? <div className="cp-plein">{t.plein}</div> : null}
      </div>
    );
  };

  const racine = (
    <div className="cp-racine" data-cp="" data-cp-ordi={ordi ? '1' : '0'} data-cp-ouverte={ouverte ? ouverte.id : ''} data-cp-ranger={ranger ? '1' : '0'}>
      <div className="cp-accueil" inert={grilleCachee ? '' : undefined} aria-hidden={grilleCachee ? 'true' : undefined}>
        <header className="cp-tete">
          <div className="cp-tete-txt">
            <span className="cp-date">{dateTxt}</span>
            <h1 className="cp-titre">{tr('cp.titre')}</h1>
          </div>
          <div className="cp-tete-gestes">
            {ranger ? <button type="button" className="sb-touche is-actif" aria-pressed="true" data-cp-fini="" onClick={() => { setRanger(false); setPrise(null); }}>{tr('cp.fini')}</button>
              : <>
                <button type="button" className="sb-rond" aria-label={tr('cp.chercher')} onClick={() => gesteCoque('chercher')}><Icon name="search" size={20}/></button>
                <button type="button" className="sb-rond" aria-label={tr('cp.scanner')} onClick={() => gesteCoque('scanner')}><Icon name="scan" size={20}/></button>
              </>}
          </div>
        </header>
        {ranger ? <p className="cp-aide-ranger" role="status">{prise ? tr('cp.rangerOu') : tr('cp.rangerQui')}</p> : null}
        <div className="cp-grille" data-cp-grille="">{ids.map(tuile)}</div>
        {!ranger ? <div className="cp-pied"><button type="button" className="sb-lien" data-cp-ranger="" onClick={() => setRanger(true)}>{tr('cp.ranger')}</button></div> : null}
      </div>
      {tuileOuverte ? (
        <section ref={sceneRef} className="cp-scene" data-cp-scene={ouverte.id} data-cp-etat="depart" role="dialog" aria-modal={ordi ? undefined : 'true'}
          aria-label={typeof tuileOuverte.lib === 'string' ? tuileOuverte.lib : ''}>
          {FermeAuRetour && !ordi ? <FermeAuRetour fermer={fermer}/> : null}
          <header className="cp-scene-tete">
            <button type="button" className="sb-rond" aria-label={tr('cp.revenir')} data-cp-fermer="" onClick={fermer}><Retour/></button>
            <h2 className="cp-scene-titre">{tuileOuverte.icone ? <Icon name={tuileOuverte.icone} size={18}/> : null}{tuileOuverte.lib}</h2>
            {tuileOuverte.tab ? <button type="button" className="sb-lien cp-scene-ecran" onClick={() => onNav && onNav(tuileOuverte.tab)}>{tr('cp.ecranComplet')}</button> : <span/>}
          </header>
          <div className="cp-scene-corps" key={ouverte.id}>{tuileOuverte.ecran}</div>
          {!ordi ? (
            <nav className="cp-dock" aria-label={tr('cp.dock')}>
              <div className="cp-dock-rail">
                {ids.map((id) => { const t = def[id]; const on = id === ouverte.id; return (
                  <button key={id} type="button" className={'cp-dock-t' + (on ? ' is-actif' : '')} aria-current={on ? 'page' : undefined} data-cp-dock={id} onClick={() => (on ? fermer() : basculer(id))}>
                    <b>{t.miniN != null ? t.miniN : (t.n != null ? t.n : <Icon name={t.icone} size={16}/>)}</b><span>{t.mini || t.lib}</span>
                    {on ? <i className="sb-diode" aria-hidden="true"/> : null}
                  </button>); })}
              </div>
            </nav>) : null}
        </section>
      ) : null}
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(racine, document.body) : racine;
}
