// ── CHOISIR UNE PÉRIODE « COMME AIRBNB » (29 octobre) ───────────────────────
// Julien : « pour le filtre des périodes je veux que ce soit mieux, tu peux
// peut-être ajouter un calendrier pour que l'on fasse comme avec Airbnb ».
// UN composant pour tous les écrans qui filtrent par période (Ventes, Achats,
// Statistiques) ; la règle vit dans `periodeCalendrier.js` (§11).
//   · Ordinateur : deux mois côte à côte, ‹ › pour remonter, le survol dessine
//     la plage avant le second clic.
//   · Au doigt (≤ 767 px) : une feuille du bas, UN calendrier qui défile (les
//     18 derniers mois, le mois en cours en bas), le bouton en bas du pouce.
//   · Raccourcis : 7 jours · 30 jours · Ce mois · Mois dernier · Cette année
//     (un toucher applique).
//   · La plage choisie se LIT en clair (« Du 12 au 28 oct. 2026 · 17 jours »).
// La VALEUR garde sa forme (`{from, to, label?}` ou `null`) : aucun lecteur ne
// change. Les jours après aujourd'hui ne se choisissent pas (aucune vente n'y
// est encore) ; « Ce mois » et « Cette année » vont jusqu'au bout du mois / de
// l'année, comme avant.
import React from 'react';
import { createPortal } from 'react-dom';
import './choix-periode.css';
import {
  grilleMois, nomMois, decalerMois, cleJour, libellePlage, nbJours, raccourcisPeriode, raccourciDe,
  toucherJour, etatJour, valeurDeSelection, moisDefilants, JOURS_INITIALES, MOIS_LONG,
} from './periodeCalendrier.js';

const majuscule = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
// Une borne peut arriver en Date ou en chaîne (vue enregistrée, session) :
// on la relit, et une date illisible vaut « pas de borne » (jamais un jour inventé).
const versDate = (x) => { if (!x) return null; const d = x instanceof Date ? x : new Date(x); return isNaN(d.getTime()) ? null : d; };
const normaliser = (v) => (v ? { ...v, from: versDate(v.from), to: versDate(v.to) } : null);
export const libelleValeur = (brut) => { const v = normaliser(brut); return (!v || (!v.from && !v.to)) ? 'Toute la période' : majuscule(v.label || libellePlage(v.from, v.to)); };

function useEtroit() {
  const q = '(max-width: 767px)';
  const lire = () => { try { return window.matchMedia(q).matches; } catch (_) { return false; } };
  const [e, setE] = React.useState(lire);
  React.useEffect(() => {
    let m = null; try { m = window.matchMedia(q); } catch (_) { return undefined; }
    const f = () => setE(m.matches);
    try { m.addEventListener('change', f); } catch (_) { try { m.addListener(f); } catch (__) {} }
    return () => { try { m.removeEventListener('change', f); } catch (_) { try { m.removeListener(f); } catch (__) {} } };
  }, []);
  return e;
}

function Mois({ annee, mois, sel, survol, setSurvol, toucher, max, auj, entete = false }) {
  const semaines = grilleMois(annee, mois);
  const kMax = cleJour(max), kAuj = cleJour(auj);
  return (
    <div className="vrm-cal-mois" data-periode-mois={`${annee}-${String(mois + 1).padStart(2, '0')}`}>
      <div className="vrm-cal-mois-nom">{majuscule(nomMois(annee, mois))}</div>
      {entete ? <div className="vrm-cal-jours-tete" aria-hidden="true">{JOURS_INITIALES.map((j, i) => <span key={i}>{j}</span>)}</div> : null}
      <div className="vrm-cal-grille" role="grid" aria-label={nomMois(annee, mois)}>
        {semaines.map((sem, i) => (
          <div className="vrm-cal-semaine" role="row" key={i}>
            {sem.map((d, j) => {
              if (!d) return <span key={j} className="vrm-cal-vide" role="gridcell"/>;
              const k = cleJour(d);
              const etat = etatJour(d, sel, survol);
              const futur = k > kMax;
              return (
                <span key={j} role="gridcell" className={`vrm-cal-case${etat ? ' ' + etat : ''}`}>
                  <button type="button" className="vrm-cal-jour" data-jour={k} data-etat={etat || undefined}
                    disabled={futur} aria-pressed={etat === 'debut' || etat === 'fin' || etat === 'seul'}
                    aria-label={`${d.getDate()} ${MOIS_LONG[d.getMonth()]} ${d.getFullYear()}${k === kAuj ? ", aujourd'hui" : ''}`}
                    onClick={() => toucher(d)} onMouseEnter={() => setSurvol(d)} onFocus={() => setSurvol(d)}>
                    <span>{d.getDate()}</span>{k === kAuj ? <i aria-hidden="true"/> : null}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChoixPeriode({ value: brut, onChange, Retour, Icon, titre = 'Période', data = {} }) {
  const value = normaliser(brut);
  const etroit = useEtroit();
  // Au doigt : 18 mois d'abord ; « Voir les mois d'avant » en ajoute 12 (ses
  // ventes remontent à 2023 — mesuré le 29 oct.).
  const [nbMois, setNbMois] = React.useState(18);
  const [ouvert, setOuvert] = React.useState(false);
  const [sel, setSel] = React.useState({ from: null, to: null });
  const [survol, setSurvol] = React.useState(null);
  const [cote, setCote] = React.useState('gauche');
  const auj = React.useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, [ouvert]);
  const [vue, setVue] = React.useState(() => decalerMois(auj.getFullYear(), auj.getMonth(), -1));
  const boite = React.useRef(null);
  const pop = React.useRef(null);
  const defile = React.useRef(null);
  const raccourcis = raccourcisPeriode(auj);
  const actif = raccourciDe(value, auj);

  const ouvrir = (ev) => {
    const s = value && value.from ? { from: value.from, to: value.to || value.from } : { from: null, to: null };
    setSel(s); setSurvol(null);
    // Les deux mois montrés : celui de la fin choisie (à droite) et le précédent.
    const ref = s.to || auj;
    const droite = { annee: ref.getFullYear(), mois: ref.getMonth() };
    setVue(decalerMois(droite.annee, droite.mois, -1));
    // Au doigt, la liste remonte au moins jusqu'au mois du début choisi.
    if (s.from) { const ecart = (auj.getFullYear() - s.from.getFullYear()) * 12 + (auj.getMonth() - s.from.getMonth()) + 1; setNbMois(Math.max(18, Math.min(120, ecart + 1))); } else setNbMois(18);
    try { const r = ev.currentTarget.getBoundingClientRect(); setCote(r.left + 660 > window.innerWidth - 16 ? 'droite' : 'gauche'); } catch (_) {}
    setOuvert(true);
  };
  const fermer = () => { setOuvert(false); setSurvol(null); };
  const appliquer = (v) => { onChange(v); fermer(); };

  // Ordinateur : un clic dehors ou Échap referme (rien n'est appliqué).
  React.useEffect(() => {
    if (!ouvert || etroit) return undefined;
    const dehors = (ev) => { if (boite.current && !boite.current.contains(ev.target)) fermer(); };
    const echap = (ev) => { if (ev.key === 'Escape') fermer(); };
    document.addEventListener('mousedown', dehors); document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap); };
  }, [ouvert, etroit]);
  // Au doigt : la feuille s'ouvre sur le mois de la sélection (ou le mois en cours, en bas).
  React.useEffect(() => {
    if (!ouvert || !etroit || !defile.current) return;
    const k = sel.from ? cleJour(sel.from).slice(0, 7) : cleJour(auj).slice(0, 7);
    const m = defile.current.querySelector(`[data-periode-mois="${k}"]`);
    try { if (m) defile.current.scrollTop = Math.max(0, m.offsetTop - 8); else defile.current.scrollTop = defile.current.scrollHeight; } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, etroit]);

  const toucher = (d) => setSel((s) => toucherJour(s, d, { max: auj }));
  const choix = valeurDeSelection(sel, auj);
  const plage = sel.from
    ? (sel.to ? `${majuscule(libellePlage(sel.from, sel.to))} · ${nbJours(sel.from, sel.to)} jour${nbJours(sel.from, sel.to) > 1 ? 's' : ''}` : `Du ${libellePlage(sel.from, sel.from).replace(/^le /, '')} — choisis le dernier jour`)
    : 'Choisis le premier jour';
  const droite = decalerMois(vue.annee, vue.mois, 1);
  const auBout = droite.annee > auj.getFullYear() || (droite.annee === auj.getFullYear() && droite.mois >= auj.getMonth());

  const corpsRaccourcis = (
    <div className="vrm-cal-raccourcis" role="group" aria-label="Raccourcis de période">
      {raccourcis.map((r) => (
        <button key={r.cle} type="button" data-periode-raccourci={r.cle} aria-pressed={actif === r.cle} onClick={() => appliquer({ ...r.valeur })}>{r.nom}</button>
      ))}
    </div>
  );
  const pied = (
    <div className="vrm-cal-pied">
      <div className="vrm-cal-plage" data-periode-plage={sel.from && !sel.to ? 'debut' : choix ? 'choisie' : 'vide'}
        data-periode-du={sel.from ? cleJour(sel.from) : ''} data-periode-au={sel.from ? cleJour(sel.to || sel.from) : ''} aria-live="polite">{plage}</div>
      <div className="vrm-cal-boutons">
        <button type="button" className="vrm-cal-effacer" data-periode-effacer onClick={() => appliquer(null)}>Effacer</button>
        <button type="button" className="vrm-cal-appliquer" data-periode-appliquer disabled={!choix} onClick={() => choix && appliquer(choix)}>Appliquer</button>
      </div>
    </div>
  );
  const propsMois = { sel, survol, setSurvol, toucher, max: auj, auj };

  return (
    <div className="vrm-period vrm-cal" ref={boite} {...data}>
      <div className="vrm-rangee" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="button" className="vrm-cal-declencheur" data-periode-ouvrir onClick={(ev) => (ouvert ? fermer() : ouvrir(ev))}
          aria-expanded={ouvert} aria-haspopup="dialog" data-periode-valeur={value && value.from ? `${cleJour(value.from)}..${cleJour(value.to || value.from)}` : ''}>
          {Icon ? <Icon name="calendar" size={15}/> : null}<span data-periode-libelle>{libelleValeur(value)}</span>
        </button>
        {value && (value.from || value.to) ? <button type="button" className="vrm-icon-control vrm-cal-croix" aria-label="Effacer la période" onClick={() => { onChange(null); fermer(); }}>{Icon ? <Icon name="close" size={14}/> : '×'}</button> : null}
      </div>
      {ouvert && !etroit && (
        <div ref={pop} className={`vrm-cal-pop ${cote}`} role="dialog" aria-label={titre} data-periode-panneau data-periode-mode="deux-mois"
          onMouseLeave={() => setSurvol(null)}>
          {corpsRaccourcis}
          <div className="vrm-cal-duo">
            <div className="vrm-cal-fleches">
              <button type="button" className="vrm-cal-fleche an" aria-label="Un an plus tôt" title="Un an plus tôt" data-periode-prec-an onClick={() => setVue((v) => decalerMois(v.annee, v.mois, -12))}>«</button>
              <button type="button" className="vrm-cal-fleche prec" aria-label="Mois précédent" data-periode-prec onClick={() => setVue((v) => decalerMois(v.annee, v.mois, -1))}>‹</button>
            </div>
            <Mois annee={vue.annee} mois={vue.mois} entete {...propsMois}/>
            <Mois annee={droite.annee} mois={droite.mois} entete {...propsMois}/>
            <div className="vrm-cal-fleches">
              <button type="button" className="vrm-cal-fleche suiv" aria-label="Mois suivant" data-periode-suiv disabled={auBout} onClick={() => setVue((v) => decalerMois(v.annee, v.mois, 1))}>›</button>
              <button type="button" className="vrm-cal-fleche an" aria-label="Un an plus tard" title="Un an plus tard" data-periode-suiv-an disabled={auBout} onClick={() => setVue((v) => { const n = decalerMois(v.annee, v.mois, 12); const max = decalerMois(auj.getFullYear(), auj.getMonth(), -1); return (n.annee > max.annee || (n.annee === max.annee && n.mois > max.mois)) ? max : n; })}>»</button>
            </div>
          </div>
          {pied}
        </div>
      )}
      {ouvert && etroit && createPortal(
        <>
          {Retour ? <Retour fermer={fermer}/> : null}
          <div className="vrm-cal-voile" onClick={fermer}/>
          <div className="vrm-cal-feuille" role="dialog" aria-label={titre} data-periode-panneau data-periode-mode="defile">
            <div className="vrm-cal-tete">
              <b>{titre}</b>
              <button type="button" className="vrm-cal-fermer" aria-label="Fermer" onClick={fermer}>×</button>
            </div>
            {corpsRaccourcis}
            <div className="vrm-cal-jours-tete" aria-hidden="true">{JOURS_INITIALES.map((j, i) => <span key={i}>{j}</span>)}</div>
            <div className="vrm-cal-defile" ref={defile}>
              {nbMois < 120 ? <button type="button" className="vrm-cal-avant" data-periode-avant onClick={() => {
                // On garde le mois regardé à sa place à l'écran pendant que la liste s'allonge au-dessus.
                const el = defile.current; const avant = el ? el.scrollHeight - el.scrollTop : 0;
                setNbMois((n) => Math.min(120, n + 12));
                requestAnimationFrame(() => { try { if (el) el.scrollTop = el.scrollHeight - avant; } catch (_) {} });
              }}>Voir les mois d'avant</button> : null}
              {moisDefilants(auj, nbMois).map((m) => <Mois key={`${m.annee}-${m.mois}`} annee={m.annee} mois={m.mois} {...propsMois}/>)}
            </div>
            {pied}
          </div>
        </>, document.body)}
    </div>
  );
}
