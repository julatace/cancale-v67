// ── « DEPUIS TA DERNIÈRE VISITE » : LA FEUILLE D'ARRIVÉE (19 nov., ext. 5.409) ─────────────
// Julien : « je veux que quand je rentre sur l'app, et que l'extension a capté quelque chose,
// on est informé avec un pop up ».
// Montée une fois par la coque (App.jsx, à côté du toast `CapteNotif`). À l'ouverture de VRM
// (session prête) et quand il REVIENT sur l'app (onglet de nouveau visible après 2 min au moins),
// elle lit les lignes `capte_journal_*` (une par Chrome, projection `e` seulement) et dit EN UNE
// FOIS ce que l'extension a rangé depuis le marqueur « vu » : par sorte, une rangée par élément
// (5 au plus, puis « Voir les N autres »). Chaque rangée mène à l'élément (`lienDe`, identité).
//   · rien de neuf, lecture ratée, marqueur inconnu (premier passage : posé en silence),
//     réglage « Dire ce que l'extension capte » coupé ⇒ rien ne s'affiche ;
//   · jamais par-dessus une autre feuille (elle attend qu'elle se ferme) ;
//   · « vu » = la plus récente entrée montrée, posée ICI (localStorage) ET synchronisée
//     (`vrm_capte_vu`, SYNC_KEYS) : vu sur l'iPhone, vu sur le Mac ;
//   · un lot montré en direct par le toast (app ouverte, au premier plan) avance le marqueur :
//     il n'est pas redit à l'arrivée suivante.
// Les règles : ./arrivee.js (pures). Les textes : `tr()` (capte.arrivee.*).
import React from 'react';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { Feuille, Groupe, Rangee, Bouton } from '../natif/index.js';
import { SELECT_JOURNAL_CAPTE, CLE_VU_NUAGE, CLE_VU_ICI, PAR_GROUPE, fusionner, marqueur, depuis, groupes, lienDe, lienGroupe, vuJusqua } from './arrivee.js';
import { capteCoupe } from './regle.js';

const RETOUR_MIN_MS = 2 * 60000;
const rien = () => () => {};
const lireIci = () => { try { const v = Number(localStorage.getItem(CLE_VU_ICI)); return Number.isFinite(v) && v > 0 ? v : null; } catch (_) { return null; } };
const ecrireIci = (t) => { try { localStorage.setItem(CLE_VU_ICI, String(Math.round(t))); } catch (_) {} };
const aller = (q) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: String(q).replace(/^\//, '') })); } catch (_) {} };

function ilYa(t, maintenant) {
  const m = Math.max(0, Math.round((maintenant - t) / 60000));
  if (m < 1) return tr('capte.arrivee.aLinstant');
  if (m < 60) return tr('capte.arrivee.minutes', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return tr('capte.arrivee.heures', { n: h });
  return tr('capte.arrivee.jours', { n: Math.round(h / 24) });
}
const SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };

// Props (toutes données par App.jsx — ce module n'importe pas App.jsx) :
//   lire(query) → Promise<rows|null> · load(k, d) · save(k, v) · onCloudReady(f) → off
//   pret : la session est là · nomCompte(p, c) → '' | nom · exclu(p, c) → vrai si compte retiré
//   feuilleOuverte(), abonnerFeuilles(f) : les autres feuilles de l'app
export default function FeuilleArrivee({ pret = false, lire, load, save, onCloudReady = rien, nomCompte = () => '', exclu = () => false, feuilleOuverte = () => false, abonnerFeuilles = rien }) {
  useLangue();
  const autre = React.useSyncExternalStore(abonnerFeuilles, feuilleOuverte, () => false);
  const [montre, setMontre] = React.useState(null);     // { groupes, entrees, at }
  const enCours = React.useRef(false);
  const cache = React.useRef(0);
  // Les fonctions de l'app changent à chaque rendu de la coque : lues par référence (l'effet ne repart pas).
  const ref = React.useRef({});
  ref.current = { lire, load, save, onCloudReady, exclu, feuilleOuverte };
  const attente = React.useRef(null);
  const montreRef = React.useRef(null);
  montreRef.current = montre;
  const vuLu = React.useCallback(() => { const l = ref.current.load; return marqueur(lireIci(), l ? l(CLE_VU_NUAGE, null) : null); }, []);
  const poserVu = React.useCallback((t) => {
    if (!(t > 0)) return;
    const avant = vuLu() || 0;
    if (t <= avant) return;
    ecrireIci(t);
    try { const sv = ref.current.save; if (sv) sv(CLE_VU_NUAGE, { at: Math.round(t) }); } catch (_) {}
  }, [vuLu]);

  const verifier = React.useCallback(async () => {
    const lireF = ref.current.lire;
    if (!pret || !lireF || enCours.current || montreRef.current) return;
    if (capteCoupe()) return;
    enCours.current = true;
    try {
      let rows = null; try { rows = await lireF(SELECT_JOURNAL_CAPTE); } catch (_) { rows = null; }
      const toutes = fusionner(rows);
      if (!toutes) return;                                   // pas su : rien n'est dit
      const vu = vuLu();
      if (!vu) { poserVu(vuJusqua(toutes, Date.now())); return; }   // premier passage : point de départ, en silence
      const ex = ref.current.exclu || (() => false);
      const neuves = depuis(toutes, vu).filter((e) => !ex(e.p, e.c));
      if (!neuves.length) return;
      const m = { groupes: groupes(neuves), entrees: neuves, at: Date.now() };
      // Une autre feuille est ouverte : elle attend qu'elle se ferme (jamais par-dessus).
      if (ref.current.feuilleOuverte && ref.current.feuilleOuverte()) attente.current = m; else setMontre(m);
    } finally { enCours.current = false; }
  }, [pret, vuLu, poserVu]);

  // À l'ouverture (session prête, nuage chargé), puis à chaque retour sur l'app après 2 min.
  React.useEffect(() => {
    if (!pret) return undefined;
    let mort = false;
    const t = setTimeout(() => { if (!mort) verifier(); }, 1200);
    const ocr = ref.current.onCloudReady || rien;
    const off = ocr(() => { if (!mort) verifier(); });
    const auRetour = () => {
      if (document.visibilityState === 'hidden') { cache.current = Date.now(); return; }
      if (cache.current && Date.now() - cache.current >= RETOUR_MIN_MS) verifier();
      cache.current = 0;
    };
    document.addEventListener('visibilitychange', auRetour);
    // Un lot dit EN DIRECT par le toast (app au premier plan) : déjà vu, pas redit à l'arrivée.
    const surExt = (e) => { const d = e && e.detail; if (d && d.type === 'capte' && document.visibilityState === 'visible' && !capteCoupe()) setTimeout(() => poserVu(Date.now()), 2000); };
    window.addEventListener('vrm:ext', surExt);
    return () => { mort = true; clearTimeout(t); if (typeof off === 'function') off(); document.removeEventListener('visibilitychange', auRetour); window.removeEventListener('vrm:ext', surExt); };
  }, [pret, verifier, poserVu]);

  const fermer = React.useCallback(() => { setMontre((m) => { if (m) poserVu(vuJusqua(m.entrees, 0)); return null; }); }, [poserVu]);
  const ouvrir = (q) => { fermer(); setTimeout(() => aller(q), 0); };

  React.useEffect(() => { if (!autre && attente.current && !montreRef.current) { const m = attente.current; attente.current = null; setMontre(m); } }, [autre]);
  // (Notre propre feuille entre dans la pile des feuilles ouvertes : une fois montrée, on ne se cache plus.)
  if (!montre) return null;
  const n = montre.entrees.length;
  const sousTitre = (e) => [nomCompte(e.p, e.c) || '', SITE[e.p], ilYa(e.t, montre.at)].filter(Boolean).join(' · ');
  return (
    <Feuille ouverte onFermer={fermer} titre={tr('capte.arrivee.titre')} detentes={['moitie', 'pleine']} detente="moitie"
      attrs={{ 'data-capte-arrivee': String(n) }}
      pied={<Bouton variante="plein" onClick={fermer} attrs={{ 'data-capte-arrivee-vu': '' }}>{tr('capte.arrivee.cestVu')}</Bouton>}>
      {montre.groupes.map((g) => (
        <Groupe key={g.s} titre={tr(`capte.arrivee.g.${g.s}`, { n: g.n })} attrs={{ 'data-capte-groupe': g.s, 'data-n': String(g.n) }}>
          {g.entrees.slice(0, PAR_GROUPE).map((e) => (
            <Rangee key={e.p + e.c + e.id} titre={tr(g.s === 'refus' ? `capte.arrivee.refus.${e.q || 'pause'}` : `capte.arrivee.un.${g.s}`)} sousTitre={sousTitre(e)} fin="chevron"
              onClick={() => ouvrir(lienDe(e))} attrs={{ 'data-capte-ligne': g.s, 'data-capte-lien': lienDe(e) }}/>
          ))}
          {g.n > PAR_GROUPE ? <Rangee titre={tr('capte.arrivee.autres', { n: g.n - PAR_GROUPE })} fin="chevron" onClick={() => ouvrir(lienGroupe(g))} attrs={{ 'data-capte-autres': g.s }}/> : null}
        </Groupe>
      ))}
    </Feuille>
  );
}
