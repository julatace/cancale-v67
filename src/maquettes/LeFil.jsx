// ── MAQUETTE D · « LE FIL » (17 nov. 2026, proposition pour Julien) ───────────────────────────────
// L'app n'est plus rangée en écrans et onglets : UN fil des gestes du jour, qu'on vide comme une boîte de
// réception. Chaque carte = un geste (poster 3 colis, aller chercher 2 colis, répondre à 4 messages…), traité
// SUR PLACE : la carte se déplie avec SES vraies listes et SES vrais boutons (ceux de Ma journée, passés tels
// quels), un glisser à droite la range (« Fait »), à gauche la remet à plus tard. Le reste (Ventes, Achats,
// Annonces, Stock, Argent…) devient des BIBLIOTHÈQUES : la recherche, ou un menu discret.
//
// ⚠️ PROTOTYPE DE BANC, INVISIBLE POUR JULIEN : il ne s'allume que si l'URL porte `?maquette=fil` ET que le
// navigateur est un banc (`vrm_banc_vends`, posé par scripts/bancs/design-passe.cjs seulement). Sans les deux,
// rien ne change (FIL_MAQUETTE = false, aucun de ces composants n'est rendu).
//
// ⚠️ CE FICHIER NE CALCULE RIEN : les cartes sont les tuiles de Ma journée (les mêmes nombres, les mêmes
// listes, « — » quand ce n'est pas su) et les cartes « À faire » déjà rendues par App.jsx. « Fait » et « Plus
// tard » sont SES marques, rangées dans sessionStorage, rien n'est écrit chez Vinted ni dans la base ; une carte
// rangée revient d'elle-même si son nombre change (la signature est `id:nombre`).
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import './le-fil.css';

export const FIL_MAQUETTE = (() => {
  try {
    if (typeof window === 'undefined') return false;
    const banc = localStorage.getItem('vrm_banc_vends') === '1';
    if (!banc) return false;
    const q = new URLSearchParams(window.location.search).get('maquette');
    if (q === 'fil') sessionStorage.setItem('vrm_banc_maquette', 'fil');
    return sessionStorage.getItem('vrm_banc_maquette') === 'fil';
  } catch (_) { return false; }
})();
if (FIL_MAQUETTE) { try { document.documentElement.setAttribute('data-fil', ''); } catch (_) {} }

// Le nombre de gestes du fil, publié pour le rond « Le fil » du dock (une seule source : le fil rendu).
const compteur = { n: null, ecoute: new Set() };
const publierN = (n) => { if (compteur.n === n) return; compteur.n = n; compteur.ecoute.forEach((f) => f()); };
const useNFil = () => React.useSyncExternalStore((f) => { compteur.ecoute.add(f); return () => compteur.ecoute.delete(f); }, () => compteur.n, () => null);

const lireEtat = () => { try { const o = JSON.parse(sessionStorage.getItem('vrm_fil_etat') || '{}'); return { faits: o.faits || [], tard: o.tard || [] }; } catch (_) { return { faits: [], tard: [] }; } };
const ecrireEtat = (e) => { try { sessionStorage.setItem('vrm_fil_etat', JSON.stringify(e)); } catch (_) {} };

// L'ordre du fil : ce qui part (colis), ce qui attend au point, puis ce qui se répond, puis ce qui se règle.
const ORDRE = ['envoyer', 'retirer', 'offres', 'prix-achat', 'messages', 'prix'];
const VERBE = { envoyer: 'fil.v.envoyer', retirer: 'fil.v.retirer', messages: 'fil.v.messages', offres: 'fil.v.offres', 'prix-achat': 'fil.v.prixAchat', prix: 'fil.v.prix' };
const ICONE = { envoyer: 'printer', retirer: 'pin', messages: 'chat', offres: 'tag', 'prix-achat': 'euro', prix: 'tag' };

export const BIBLIOS = [
  { id: 'ventes', tab: 'ventes', icone: 'receipt', aussi: ['cat_ventes'] },
  { id: 'achats', tab: 'achats', icone: 'cart', aussi: [] },
  { id: 'annonces', tab: 'annonces', icone: 'tag', aussi: ['cat_annonces'] },
  { id: 'stock', tab: 'stock', icone: 'box', aussi: ['garage'] },
  { id: 'messages', tab: 'messages', icone: 'chat', aussi: ['cat_msg'] },
  { id: 'argent', tab: 'compta', icone: 'wallet', aussi: ['dashboard', 'argent_declarer', 'invoices'] },
  { id: 'reglages', tab: 'settings', icone: 'gear', aussi: [] },
];
const biblioDe = (tab) => BIBLIOS.find((b) => b.tab === tab || b.aussi.includes(tab)) || null;

// Un glisser qui finit ne doit pas compter comme un toucher (la carte ne s'ouvre pas en plus).
const dernierGlisser = { at: 0 };
// ── Le glisser : à droite « Fait », à gauche « Plus tard ». Le doigt suit, rien ne part sous 96 px. ──
function useGlisser({ onFait, onTard, actif = true }) {
  const [dx, setDx] = React.useState(0);
  const g = React.useRef(null);
  const SEUIL = 96;
  const bas = (e) => {
    if (!actif || (e.button != null && e.button !== 0)) return;
    if (e.target.closest && e.target.closest('button:not(.fil-zone), a, input, textarea, select, [role="slider"]')) return;
    g.current = { x: e.clientX, y: e.clientY, on: false, id: e.pointerId };
  };
  const bouge = (e) => {
    const s = g.current; if (!s) return;
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
    if (!s.on) {
      if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) { g.current = null; return; }
      if (Math.abs(ddx) < 12) return;
      s.on = true; dernierGlisser.at = Date.now(); try { e.currentTarget.setPointerCapture(s.id); } catch (_) {}
    }
    setDx(Math.max(-180, Math.min(180, ddx)));
  };
  const haut = () => {
    const s = g.current; g.current = null;
    if (!s || !s.on) return;
    if (dx >= SEUIL) onFait(); else if (dx <= -SEUIL) onTard();
    setDx(0);
  };
  return { dx, seuil: SEUIL, handlers: { onPointerDown: bas, onPointerMove: bouge, onPointerUp: haut, onPointerCancel: haut } };
}

function Pile({ srcs, Photo, n }) {
  const l = (srcs || []).filter(Boolean).slice(0, 3);
  if (!l.length || !Photo) return null;
  return (
    <span className="fil-pile" aria-hidden="true" data-fil-pile={String(l.length)}>
      {l.map((s, k) => <span key={k} className="fil-pile-ph" style={{ zIndex: 3 - k }}><Photo src={s} alt="" loading="lazy" decoding="async" width={36} height={36}/></span>)}
      {n > l.length ? <span className="fil-pile-plus">+{n - l.length}</span> : null}
    </span>
  );
}

// Une carte du fil. `ouverte` : elle porte SES listes et SES gestes (le dépli de sa tuile).
function CarteFil({ c, ouverte, onOuvrir, onFait, onTard, Icon, Photo, ordi, choisie }) {
  const { dx, seuil, handlers } = useGlisser({ onFait, onTard, actif: !ordi });
  const sens = dx > 0 ? 'fait' : dx < 0 ? 'tard' : '';
  const pret = Math.abs(dx) >= seuil;
  return (
    <article className={'fil-carte' + (ouverte ? ' is-ouverte' : '') + (choisie ? ' is-actif' : '') + (c.urgent ? ' is-urgent' : '')}
      data-fil-carte={c.id} data-fil-n={c.n == null ? '' : String(c.n)} data-fil-ouverte={ouverte ? '1' : '0'}>
      {/* Le dessous de la carte, révélé par le glisser : le geste qu'on va faire, dit en toutes lettres. */}
      {dx !== 0 ? (
        <div className={'fil-dessous is-' + sens + (pret ? ' is-pret' : '')} aria-hidden="true">
          <span className="fil-dessous-g">{Icon ? <Icon name="check" size={22}/> : null}{tr('fil.fait')}</span>
          <span className="fil-dessous-d">{tr('fil.plusTard')}{Icon ? <Icon name="clock" size={22}/> : null}</span>
        </div>
      ) : null}
      <div className={'fil-face' + (dx ? ' is-glisse' : '')} style={dx ? { transform: `translate3d(${dx}px,0,0) rotate(${dx / 60}deg)` } : undefined} {...handlers}>
        {c.el ? (
          <div className="fil-el">
            <div className="fil-tete"><span className="fil-kicker">{c.urgent ? <span className="fil-point" aria-hidden="true"/> : null}{c.kicker}</span></div>
            {c.el}
          </div>
        ) : (<>
          <button type="button" className="fil-zone" aria-expanded={ordi ? undefined : ouverte} aria-pressed={ordi ? !!choisie : undefined}
            data-fil-zone={c.id} onClick={() => { if (Date.now() - dernierGlisser.at < 400) return; onOuvrir(); }} aria-label={c.titre}/>
          <div className="fil-tete">
            <span className="fil-ic" aria-hidden="true">{Icon ? <Icon name={ICONE[c.id] || 'check'} size={19}/> : null}</span>
            <span className="fil-tete-txt">
              <span className="fil-kicker">{c.urgent ? <span className="fil-point" aria-hidden="true"/> : null}{c.kicker}</span>
              <span className="fil-titre">{c.titre}</span>
            </span>
            {ouverte && !ordi ? null : <Pile srcs={c.photos} Photo={Photo} n={c.n || 0}/>}
          </div>
          {ouverte && !ordi ? (
            <div className="fil-corps" data-fil-corps={c.id}>
              {c.plein ? <div className="fil-plein">{c.plein}</div> : null}
              <div className="fil-deplie">{c.deplie}</div>
              <div className="fil-gestes">
                <button type="button" className="sb-touche" data-fil-fait={c.id} onClick={onFait}>{Icon ? <Icon name="check" size={16}/> : null}{tr('fil.fait')}</button>
                <button type="button" className="sb-touche" data-fil-tard={c.id} onClick={onTard}>{Icon ? <Icon name="clock" size={16}/> : null}{tr('fil.plusTard')}</button>
                <span className="fil-aide">{tr('fil.aide.glisser')}</span>
              </div>
            </div>
          ) : null}
        </>)}
      </div>
    </article>
  );
}

const Points = ({ total, faits }) => {
  const n = Math.min(14, total);
  if (!n) return null;
  return <span className="fil-points" aria-hidden="true">{Array.from({ length: n }, (_, k) => <i key={k} className={k < Math.min(faits, n) ? 'is-fait' : ''}/>)}</span>;
};

// ── LE FIL (Ma journée) ─────────────────────────────────────────────────────────────────────────
export function LeFil({ tuiles = [], alertes = [], cartes = [], photos = {}, Photo = null, Icon = null, ordi = false }) {
  const [etat, setEtat] = React.useState(lireEtat);
  const [ouverte, setOuverte] = React.useState(null);
  const [annule, setAnnule] = React.useState(null);
  const [voirTard, setVoirTard] = React.useState(false);
  React.useEffect(() => { ecrireEtat(etat); }, [etat]);

  // Les cartes : les alertes d'argent (urgentes, jamais rangées d'un glisser), les tuiles qui ont un geste, puis « À faire ».
  const toutes = React.useMemo(() => {
    const L = [];
    alertes.forEach((el, k) => L.push({ id: 'alerte-' + k, sig: 'alerte-' + k, urgent: true, kicker: tr('fil.k.urgent'), el, fixe: true }));
    const parId = new Map(tuiles.filter((t) => t && !t.interactif).map((t) => [t.id, t]));
    const ids = [...ORDRE.filter((id) => parId.has(id)), ...[...parId.keys()].filter((id) => !ORDRE.includes(id))];
    const pasSu = [];
    for (const id of ids) {
      const t = parId.get(id);
      const nTxt = t.tasse ? String(t.tasse.n) : '';
      const n = /^\d+$/.test(nTxt) ? Number(nTxt) : null;
      if (n === 0 || t.vide) continue;   // rien à faire : la carte n'existe pas (le fil se vide)
      const c = { id, sig: `${id}:${n == null ? '?' : n}`, n, kicker: t.tasse ? t.tasse.l : t.lib, deplie: t.deplie, plein: t.plein, photos: photos[id] || [],
        titre: n == null ? `${t.tasse ? t.tasse.l : ''} · ${tr('fil.k.pasLu')}` : VERBE[id] ? tr(VERBE[id], { n }) : String(t.aria || t.lib || id),
        urgent: !!(t.attrs && (t.attrs['data-jp-force'] === '' || (id === 'envoyer' && t.attrs['data-presses']))) };
      (n == null ? pasSu : L).push(c);
    }
    cartes.forEach((x, k) => L.push({ id: 'afaire-' + (x.carte || k) + '-' + k, sig: 'afaire-' + (x.carte || k) + '-' + k, kicker: tr('fil.k.afaire'), el: x.el }));
    return [...L, ...pasSu];
  }, [tuiles, alertes, cartes, photos]);

  const faits = new Set(etat.faits), tard = new Set(etat.tard);
  const restent = toutes.filter((c) => c.fixe || (!faits.has(c.sig) && !tard.has(c.sig)));
  const remises = toutes.filter((c) => !c.fixe && tard.has(c.sig) && !faits.has(c.sig));
  const nRanges = toutes.filter((c) => faits.has(c.sig)).length;
  React.useEffect(() => { publierN(restent.length); }, [restent.length]);
  React.useEffect(() => () => publierN(null), []);   // hors du fil (une bibliothèque) : aucun nombre, jamais un nombre périmé

  // Au téléphone : la première carte qui se traite (pas une alerte, pas une carte déjà faite) est OUVERTE d'office —
  // « maintenant » ; un toucher sur une autre l'ouvre à sa place. À l'ordinateur : la carte choisie va au panneau.
  const premiere = restent.find((c) => !c.el) || null;
  const idOuverte = ouverte === '__aucune' && !ordi ? null : ouverte && restent.some((c) => c.id === ouverte) ? ouverte : (premiere ? premiere.id : null);

  const marquer = (c, quoi) => {
    setEtat((e) => ({ faits: quoi === 'fait' ? [...new Set([...e.faits, c.sig])] : e.faits.filter((s) => s !== c.sig), tard: quoi === 'tard' ? [...new Set([...e.tard, c.sig])] : e.tard }));
    setAnnule({ c, quoi, at: Date.now() });
    if (ouverte === c.id) setOuverte(null);
  };
  React.useEffect(() => { if (!annule) return undefined; const t = setTimeout(() => setAnnule(null), 5000); return () => clearTimeout(t); }, [annule]);
  const defaire = () => { if (!annule) return; const s = annule.c.sig; setEtat((e) => ({ faits: e.faits.filter((x) => x !== s), tard: e.tard.filter((x) => x !== s) })); setAnnule(null); };

  // Clavier (ordinateur) : J / K passent d'un geste à l'autre, E le range, H le remet à plus tard.
  const traitables = restent.filter((c) => !c.el);
  React.useEffect(() => {
    if (!ordi) return undefined;
    const f = (e) => {
      const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = traitables.findIndex((c) => c.id === idOuverte);
      if (e.key === 'j' || e.key === 'k') { const j = Math.max(0, Math.min(traitables.length - 1, i + (e.key === 'j' ? 1 : -1))); if (traitables[j]) setOuverte(traitables[j].id); e.preventDefault(); }
      else if ((e.key === 'e' || e.key === 'h') && traitables[i]) { marquer(traitables[i], e.key === 'e' ? 'fait' : 'tard'); e.preventDefault(); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });

  const date = (() => { try { return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); } catch (_) { return ''; } })();
  const tete = (
    <header className="fil-mast" data-fil-gestes={String(restent.length)} data-fil-ranges={String(nRanges)}>
      <span className="fil-date">{date}</span>
      <h1 className="fil-h1">{tr('fil.titre')}</h1>
      <div className="fil-compte">
        <b className="fil-gros">{restent.length}</b>
        <span className="fil-compte-l">{tr('fil.gestes', { n: restent.length }).replace(/^\d+\s*/, '')}{nRanges ? <span className="fil-ranges"> · {tr('fil.ranges', { n: nRanges })}</span> : null}</span>
        <Points total={restent.length + nRanges} faits={nRanges}/>
      </div>
      {ordi ? <span className="fil-aide fil-aide-clavier">{tr('fil.aide.clavier')}</span> : null}
    </header>
  );
  const liste = (
    <div className="fil-liste" role="list" data-fil-liste="">
      {restent.map((c) => (
        <div role="listitem" key={c.id}>
          <CarteFil c={c} ordi={ordi} Icon={Icon} Photo={Photo} ouverte={!ordi && c.id === idOuverte} choisie={ordi && c.id === idOuverte}
            onOuvrir={() => setOuverte(c.id === idOuverte && !ordi ? '__aucune' : c.id)} onFait={() => marquer(c, 'fait')} onTard={() => marquer(c, 'tard')}/>
        </div>
      ))}
      {!restent.length ? (
        <div className="fil-vide" data-fil-vide="">
          <span className="fil-vide-rond" aria-hidden="true">{Icon ? <Icon name="check" size={28}/> : null}</span>
          <b>{tr('fil.vide.titre')}</b><span>{tr('fil.vide.sous')}</span>
        </div>
      ) : null}
      {remises.length ? (
        <div className="fil-tard">
          <button type="button" className="sb-lien" aria-expanded={voirTard} onClick={() => setVoirTard((v) => !v)} data-fil-voir-tard={String(remises.length)}>{tr('fil.plusTardN', { n: remises.length })}</button>
          {voirTard ? remises.map((c) => (
            <button key={c.id} type="button" className="sb-rangee fil-tard-r" onClick={() => setEtat((e) => ({ ...e, tard: e.tard.filter((s) => s !== c.sig) }))}>
              <span className="fil-ic" aria-hidden="true">{Icon ? <Icon name={ICONE[c.id] || 'clock'} size={17}/> : null}</span><span>{c.titre || c.kicker}</span>
            </button>
          )) : null}
        </div>
      ) : null}
    </div>
  );
  const choisie = ordi ? traitables.find((c) => c.id === idOuverte) || null : null;
  const toast = annule ? createPortal(
    <div className="fil-toast" role="status" data-fil-toast={annule.quoi}>
      <span>{annule.quoi === 'fait' ? tr('fil.range') : tr('fil.reporte')}</span>
      <button type="button" className="sb-lien" onClick={defaire}>{tr('fil.annuler')}</button>
    </div>, document.body) : null;

  if (!ordi) return <div className="fil" data-fil="" data-fil-ordi="0">{tete}{liste}{toast}</div>;
  return (
    <div className="fil fil-ordi" data-fil="" data-fil-ordi="1">
      <div className="fil-col">{tete}{liste}</div>
      <section className="fil-panneau" aria-live="polite" data-fil-panneau={choisie ? choisie.id : ''}>
        {choisie ? (<>
          <div className="fil-panneau-tete">
            <span className="fil-kicker">{choisie.urgent ? <span className="fil-point" aria-hidden="true"/> : null}{choisie.kicker}</span>
            <h2 className="fil-panneau-h">{choisie.titre}</h2>
            <div className="fil-gestes">
              {choisie.plein ? <div className="fil-plein">{choisie.plein}</div> : null}
              <button type="button" className="sb-touche" data-fil-fait={choisie.id} onClick={() => marquer(choisie, 'fait')}>{Icon ? <Icon name="check" size={16}/> : null}{tr('fil.fait')}<kbd>E</kbd></button>
              <button type="button" className="sb-touche" data-fil-tard={choisie.id} onClick={() => marquer(choisie, 'tard')}>{Icon ? <Icon name="clock" size={16}/> : null}{tr('fil.plusTard')}<kbd>H</kbd></button>
            </div>
          </div>
          <div className="fil-deplie">{choisie.deplie}</div>
        </>) : <p className="fil-panneau-vide">{tr('fil.choisir')}</p>}
      </section>
      {toast}
    </div>
  );
}

// ── Les bibliothèques : une feuille (téléphone), une rangée de liens (ordinateur). ───────────────────
function FeuilleBiblios({ tab, setTab, fermer, Icon, FermeAuRetour }) {
  React.useEffect(() => { const f = (e) => { if (e.key === 'Escape') fermer(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [fermer]);
  return createPortal(
    <div className="fil-voile" onClick={fermer} data-fil-biblios="">
      {FermeAuRetour ? <FermeAuRetour fermer={fermer}/> : null}
      <div className="fil-feuille" role="dialog" aria-modal="true" aria-label={tr('fil.biblios')} onClick={(e) => e.stopPropagation()}>
        <span className="fil-poignee" aria-hidden="true"/>
        <h2 className="fil-feuille-h">{tr('fil.biblios')}</h2>
        <div className="fil-biblio-liste">
          {BIBLIOS.map((b) => (
            <button key={b.id} type="button" className="sb-rangee fil-biblio" data-fil-biblio={b.id} aria-current={biblioDe(tab) === b ? 'page' : undefined}
              onClick={() => { fermer(); setTab(b.tab); }}>
              <span className="fil-ic" aria-hidden="true">{Icon ? <Icon name={b.icone} size={19}/> : null}</span>
              <span className="fil-biblio-txt"><b>{tr('fil.b.' + b.id)}</b><span>{tr('fil.bd.' + b.id)}</span></span>
              {Icon ? <Icon name="chevron" size={15}/> : null}
            </button>
          ))}
        </div>
      </div>
    </div>, document.body);
}

// Le dock du téléphone : remplace la barre du bas. Trois choses, sous le pouce : le fil, chercher, les bibliothèques.
export function FilDock({ tab, setTab, onChercher, Icon, FermeAuRetour }) {
  const [ouvert, setOuvert] = React.useState(false);
  const n = useNFil();
  const surFil = tab === 'journee';
  return (
    <nav className="fil-dock" aria-label={tr('fil.biblios')} data-fil-dock="">
      <button type="button" className="sb-rond fil-dock-fil" aria-current={surFil ? 'page' : undefined} aria-label={tr('fil.retourFil')} data-fil-dock-fil="" onClick={() => setTab('journee')}>
        {Icon ? <Icon name="home" size={21}/> : null}
        {n && surFil ? <span className="fil-dock-n">{n > 9 ? '9+' : n}</span> : null}
      </button>
      <button type="button" className="sb-touche fil-cherche" data-fil-chercher="" onClick={onChercher}>
        {Icon ? <Icon name="search" size={18}/> : null}<span>{tr('fil.chercher')}</span>
      </button>
      <button type="button" className="sb-rond" aria-label={tr('fil.biblios')} aria-expanded={ouvert} data-fil-dock-biblios="" onClick={() => setOuvert(true)}>
        {Icon ? <Icon name="grid" size={20}/> : null}
      </button>
      {ouvert ? <FeuilleBiblios tab={tab} setTab={setTab} fermer={() => setOuvert(false)} Icon={Icon} FermeAuRetour={FermeAuRetour}/> : null}
    </nav>
  );
}

// La tête d'une bibliothèque au téléphone : « ‹ Le fil » et les autres bibliothèques en touches.
export function FilBiblioTete({ tab, setTab, Icon }) {
  const b = biblioDe(tab);
  return (
    <div className="fil-biblio-tete" data-fil-biblio-tete={b ? b.id : ''}>
      <button type="button" className="sb-lien fil-retour" onClick={() => setTab('journee')} data-fil-retour="">{Icon ? <span className="fil-retour-ch" aria-hidden="true"><Icon name="chevron" size={15}/></span> : null}{tr('fil.retourFil')}</button>
      <div className="fil-biblio-rang" role="group" aria-label={tr('fil.biblios')}>
        {BIBLIOS.filter((x) => x.id !== 'reglages').map((x) => (
          <button key={x.id} type="button" className="sb-touche" aria-pressed={b === x} data-fil-biblio-touche={x.id} onClick={() => setTab(x.tab)}>{tr('fil.b.' + x.id)}</button>
        ))}
      </div>
    </div>
  );
}

// La barre de l'ordinateur : remplace le rail. La marque, le fil, chercher, puis les bibliothèques en liens discrets.
export function FilBarreOrdi({ tab, setTab, onChercher, Icon, champ = null, poserSlot = null }) {
  const n = useNFil();
  const b = biblioDe(tab);
  return (
    <nav className="fil-barre-ordi" aria-label={tr('fil.biblios')} data-fil-barre="">
      <span className="fil-marque" aria-hidden="true"><img src="/logo-vrm-96.png" alt="" width="26" height="26" decoding="async"/></span>
      <button type="button" className="sb-touche" aria-pressed={tab === 'journee'} onClick={() => setTab('journee')} data-fil-barre-fil="">
        {tr('fil.retourFil')}{n && tab === 'journee' ? <span className="fil-barre-n">{n}</span> : null}
      </button>
      {/* La VRAIE recherche de la coque (touche « / ») quand elle est passée ; sinon une touche qui l'ouvre. */}
      {champ ? <span className="fil-champ-ordi">{champ}</span> : (
        <button type="button" className="sb-touche fil-cherche fil-cherche-ordi" onClick={onChercher} data-fil-chercher="">
          {Icon ? <Icon name="search" size={16}/> : null}<span>{tr('fil.chercher')}</span><kbd>/</kbd>
        </button>)}
      <span className="fil-barre-biblios" role="group" aria-label={tr('fil.biblios')}>
        {BIBLIOS.map((x) => (
          <button key={x.id} type="button" className="sb-lien fil-barre-lien" aria-current={b === x ? 'page' : undefined} onClick={() => setTab(x.tab)} data-fil-barre-biblio={x.id}>{tr('fil.b.' + x.id)}</button>
        ))}
      </span>
      {/* La place que chaque écran donne à ses filtres de site (le slot de la barre du haut d'avant). */}
      {poserSlot ? <div className="vrm-barre-haut-droite fil-slot" ref={poserSlot}/> : null}
    </nav>
  );
}
