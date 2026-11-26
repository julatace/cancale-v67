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
// (25 nov., Julien : « change l'affichage du pop up message, ça doit faire mieux, jeu vidéo ») L'écran de RETOUR d'un jeu :
//   · en tête, une médaille et le nombre de nouveautés qui « tombe » de 0 à N ;
//   · chaque nouveauté est une CARTE avec ce que VRM sait DÉJÀ, par identité (./details.js) : pseudo et photo de profil de
//     qui écrit, photo de l'article, extrait du message (conversation non lue seulement), titre et prix d'une commande ;
//     une info absente ne s'affiche pas ; plusieurs nouveautés dont on ne sait rien de plus, même site, même compte ⇒ UNE
//     ligne (« 3 messages »), jamais trois lignes identiques ; pastille « NOUVEAU » ;
//   · la feuille entre sur un ressort, les cartes en cascade (40 ms, 120 ms au plus, un petit « pop »), une carte touchée
//     s'enfonce ; « Tout vu » éclate (coche + confettis discrets) puis la feuille se ferme. Transform et opacité seulement,
//     ≤ 400 ms ; `prefers-reduced-motion` ⇒ aucune animation, même contenu.
// Rien d'autre ne change : déclenchement, ce qui est compté, « vu » posé comme avant.
// Les règles : ./arrivee.js et ./details.js (pures). Les textes : `tr()` (capte.arrivee.*).
import React from 'react';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { Feuille, Bouton } from '../natif/index.js';
import { Glyphe } from '../natif/icones.jsx';
import { Confettis, mouvementReduit } from '../natif/Jeu.jsx';
import { SELECT_JOURNAL_CAPTE, CLE_VU_NUAGE, CLE_VU_ICI, PAR_GROUPE, fusionner, marqueur, depuis, groupes, lienDe, lienGroupe, vuJusqua, cleEntree } from './arrivee.js';
import { detailPropre, detailsDepuis, regrouper } from './details.js';
import { capteCoupe } from './regle.js';
import './capte.css';

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
// (25 nov.) L'icône de chaque sorte (noms d'ICON_PATHS) : le médaillon de la carte quand aucune photo n'est connue.
const ICONE = { refus: 'alert', ventes: 'cash', codes: 'pin', bordereaux: 'box', achats: 'bag', offres: 'tag', messages: 'chat', versements: 'wallet', numerotes: 'tag', annonces: 'tag' };
const DETAILS_MAX_MS = 1500;   // ce qui n'est pas lu à temps reste nu (jamais plus d'attente devant la feuille)
const ECLAT_MS = 380;          // « Tout vu » : l'éclat, puis la feuille se ferme
const vibrer = () => { try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10); } catch (_) {} };
const euros = (v) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: v % 1 ? 2 : 0 }).format(v); } catch (_) { return v + ' €'; } };

// Le gros compteur : de 0 à N en ≤ 400 ms (seul le texte change : chiffres tabulaires, largeur réservée) ; mouvement réduit ⇒ N d'emblée.
function Compteur({ n }) {
  const [v, setV] = React.useState(() => (mouvementReduit() ? n : 0));
  React.useEffect(() => {
    if (mouvementReduit() || typeof requestAnimationFrame !== 'function') { setV(n); return undefined; }
    let r = 0; const t0 = performance.now(), d = Math.min(400, 160 + n * 40);
    const pas = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / d)); setV(Math.round(n * (1 - Math.pow(1 - k, 3)))); if (k < 1) r = requestAnimationFrame(pas); };
    r = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(r);
  }, [n]);
  return <span className="vrm-arr-n" data-capte-compteur={n} data-valeur={v} style={{ '--vrm-arr-chiffres': String(n).length }} aria-hidden="true">{v}</span>;
}

// Une image (photo d'article, photo de profil) ; une adresse qui ne charge pas ⇒ rien (l'icône de la sorte reste dessous).
function Image({ src, className, attrs = null }) {
  const [rate, setRate] = React.useState(false);
  if (!src || rate) return null;
  return <img className={className} src={src} alt="" referrerPolicy="no-referrer" decoding="async" draggable="false" onError={() => setRate(true)} {...(attrs || {})}/>;
}

// Props (toutes données par App.jsx — ce module n'importe pas App.jsx) :
//   lire(query) → Promise<rows|null> · load(k, d) · save(k, v) · onCloudReady(f) → off
//   pret : la session est là · nomCompte(p, c) → '' | nom · exclu(p, c) → vrai si compte retiré
//   feuilleOuverte(), abonnerFeuilles(f) : les autres feuilles de l'app
//   lireCopie(compte, ou) → Promise<liste | null> : les copies DÉJÀ captées d’un compte Vinted (`ou` = 'inbox' : ses conversations ;
//     'sold' / 'purchased' : ses commandes) ⇒ `detailsDepuis` (./details.js), par identité ; absent, lent (> 1,5 s) ou raté ⇒ lignes nues.
export default function FeuilleArrivee({ pret = false, lire, load, save, onCloudReady = rien, nomCompte = () => '', exclu = () => false, feuilleOuverte = () => false, abonnerFeuilles = rien, lireCopie = null }) {
  useLangue();
  const autre = React.useSyncExternalStore(abonnerFeuilles, feuilleOuverte, () => false);
  const [montre, setMontre] = React.useState(null);     // { groupes, entrees, details, at }
  const [eclat, setEclat] = React.useState(false);
  const enCours = React.useRef(false);
  const cache = React.useRef(0);
  // Les fonctions de l'app changent à chaque rendu de la coque : lues par référence (l'effet ne repart pas).
  const ref = React.useRef({});
  ref.current = { lire, load, save, onCloudReady, exclu, feuilleOuverte, lireCopie };
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
      // Ce que VRM sait déjà de chaque nouveauté (pseudo, photo, extrait…) — 1,5 s au plus, sinon les lignes restent nues.
      let brut = null; const lc = ref.current.lireCopie;
      if (typeof lc === 'function') {
        let minuteur = 0;
        try { brut = await Promise.race([Promise.resolve().then(() => detailsDepuis(neuves, lc)), new Promise((r) => { minuteur = setTimeout(() => r(null), DETAILS_MAX_MS); })]); } catch (_) { brut = null; }
        clearTimeout(minuteur);
      }
      const details = {};
      for (const e of neuves) { const d = detailPropre(brut && brut[cleEntree(e)]); if (d) details[cleEntree(e)] = d; }
      const m = { groupes: groupes(neuves), entrees: neuves, details, at: Date.now() };
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

  const fermer = React.useCallback(() => { setEclat(false); setMontre((m) => { if (m) poserVu(vuJusqua(m.entrees, 0)); return null; }); }, [poserVu]);
  const ouvrir = (q) => { fermer(); setTimeout(() => aller(q), 0); };
  // « Tout vu » : le marqueur est posé au toucher, un petit éclat, puis la feuille se ferme ; mouvement réduit ⇒ fermée aussitôt.
  const eclatRef = React.useRef(0);
  React.useEffect(() => () => clearTimeout(eclatRef.current), []);
  const toutVu = () => {
    if (eclatRef.current) return;
    if (mouvementReduit()) { fermer(); return; }
    const m = montreRef.current; if (m) poserVu(vuJusqua(m.entrees, 0));
    vibrer(); setEclat(true);
    eclatRef.current = setTimeout(() => { eclatRef.current = 0; fermer(); }, ECLAT_MS);
  };

  React.useEffect(() => { if (!autre && attente.current && !montreRef.current) { const m = attente.current; attente.current = null; setMontre(m); } }, [autre]);
  // (Notre propre feuille entre dans la pile des feuilles ouvertes : une fois montrée, on ne se cache plus.)
  if (!montre) return null;
  const n = montre.entrees.length;
  const meta = (e) => [nomCompte(e.p, e.c) || '', SITE[e.p], ilYa(e.t, montre.at)].filter(Boolean).join(' · ');
  const libelle = (g, e) => tr(g.s === 'refus' ? `capte.arrivee.refus.${e.q || 'pause'}` : `capte.arrivee.un.${g.s}`);
  let rang = 0;   // la cascade : 40 ms d'une carte à l'autre, 120 ms au plus (src/CLAUDE.md)
  const cascade = () => ({ '--vrm-arr-i': Math.min(3, rang++) });
  const vignette = (s, enfants = null) => (
    <span className="vrm-arr-vignette" data-sorte={s}>
      <span className="vrm-arr-vignette-icone" aria-hidden="true"><Glyphe nom={ICONE[s] || 'bell2'} taille={22}/></span>
      {enfants}
    </span>
  );
  const fin = (
    <>
      <span className="vrm-arr-nouveau" aria-hidden="true">{tr('capte.arrivee.nouveau')}</span>
      <span className="vrm-arr-chevron" aria-hidden="true"><Glyphe nom="chevron" taille={16}/></span>
    </>
  );
  const carte = (g, e, d) => {
    const nature = libelle(g, e);
    const titre = d.nom || d.titre || nature;
    // La 2e ligne : l'extrait (un message), l'offre, sinon ce que c'est (« Nouvelle vente · 45 € ») ; jamais deux fois le titre.
    const second = d.extrait ? '« ' + d.extrait + ' »'
      : d.offre ? tr('capte.arrivee.offre', { montant: euros(d.offre) })
      : [titre !== nature ? nature : '', d.prix ? euros(d.prix) : ''].filter(Boolean).join(' · ');
    return (
      <button key={e.p + e.c + e.id} type="button" className="vrm-arr-carte" style={cascade()} onClick={() => ouvrir(lienDe(e))}
        data-capte-ligne={g.s} data-capte-lien={lienDe(e)} data-capte-carte="" data-capte-pseudo={d.nom || undefined}
        data-capte-photo={d.photo ? '1' : '0'} data-capte-avatar={d.nom && d.avatar ? '1' : '0'} data-capte-extrait={d.extrait ? '1' : '0'}>
        {vignette(g.s, <>
          <Image src={d.photo} className="vrm-arr-photo" attrs={{ 'data-capte-photo-img': '' }}/>
          {d.nom && d.avatar ? <Image src={d.avatar} className="vrm-arr-avatar" attrs={{ 'data-capte-avatar-img': '' }}/> : null}
        </>)}
        <span className="vrm-arr-corps">
          <span className="vrm-arr-titre">{titre}</span>
          {second ? <span className="vrm-arr-extrait" data-capte-second="">{second}</span> : null}
          <span className="vrm-arr-meta">{meta(e)}</span>
        </span>
        {fin}
      </button>
    );
  };
  const ligne = (g, e) => (
    <button key={e.p + e.c + e.id} type="button" className="vrm-arr-carte" data-nue="" style={cascade()} onClick={() => ouvrir(lienDe(e))}
      data-capte-ligne={g.s} data-capte-lien={lienDe(e)}>
      {vignette(g.s)}
      <span className="vrm-arr-corps"><span className="vrm-arr-titre">{libelle(g, e)}</span><span className="vrm-arr-meta">{meta(e)}</span></span>
      {fin}
    </button>
  );
  // Plusieurs nouveautés dont VRM ne sait rien de plus, même site, même compte : UNE ligne (« 3 messages »), jamais N lignes identiques.
  const lot = (g, x) => {
    const q = lienGroupe({ s: g.s, entrees: x.entrees });
    return (
      <button key={'lot' + x.p + x.c} type="button" className="vrm-arr-carte" data-nue="" style={cascade()} onClick={() => ouvrir(q)}
        data-capte-lot={g.s} data-n={String(x.entrees.length)} data-capte-lien={q}>
        {vignette(g.s, <span className="vrm-arr-pile" aria-hidden="true">{x.entrees.length}</span>)}
        <span className="vrm-arr-corps"><span className="vrm-arr-titre">{tr(`capte.arrivee.g.${g.s}`, { n: x.entrees.length })}</span><span className="vrm-arr-meta">{meta(x.entrees[0])}</span></span>
        {fin}
      </button>
    );
  };
  return (
    <Feuille ouverte onFermer={fermer} titre={tr('capte.arrivee.titre')} detentes={['moitie', 'pleine']} detente="moitie" className="vrm-arr-feuille"
      attrs={{ 'data-capte-arrivee': String(n) }}
      pied={<span className="vrm-arr-pied" data-eclat={eclat ? '1' : undefined}>
        <Bouton variante="plein" onClick={toutVu} icone={eclat ? <span className="vrm-arr-coche"><Glyphe nom="check" taille={20}/></span> : null} attrs={{ 'data-capte-arrivee-vu': '' }}>{tr('capte.arrivee.toutVu')}</Bouton>
        {eclat ? <Confettis n={16} duree={ECLAT_MS + 220} graine={n}/> : null}
      </span>}>
      <div className="vrm-arr-tete" role="status" aria-label={tr('capte.arrivee.nouveautes', { n })}>
        <span className="vrm-arr-medaille" aria-hidden="true"><Glyphe nom="star" taille={26}/></span>
        <span className="vrm-arr-score" aria-hidden="true"><Compteur n={n}/><span className="vrm-arr-score-l">{tr('capte.arrivee.nouveautesMot', { n })}</span></span>
      </div>
      {montre.groupes.map((g) => {
        const lignes = regrouper(g, montre.details);
        const reste = lignes.slice(PAR_GROUPE).reduce((k, x) => k + (x.type === 'lot' ? x.entrees.length : 1), 0);
        return (
          <section key={g.s} className="vrm-arr-groupe" data-capte-groupe={g.s} data-n={String(g.n)}>
            <h3 className="vrm-arr-groupe-t">{tr(`capte.arrivee.g.${g.s}`, { n: g.n })}</h3>
            <div className="vrm-arr-liste">
              {lignes.slice(0, PAR_GROUPE).map((x) => (x.type === 'carte' ? carte(g, x.e, x.d) : x.type === 'lot' ? lot(g, x) : ligne(g, x.e)))}
              {reste > 0 ? (
                <button type="button" className="vrm-arr-autres" onClick={() => ouvrir(lienGroupe(g))} data-capte-autres={g.s}>
                  <span>{tr('capte.arrivee.autres', { n: reste })}</span><Glyphe nom="chevron" taille={16}/>
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
    </Feuille>
  );
}
