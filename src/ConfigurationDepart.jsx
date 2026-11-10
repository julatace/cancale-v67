// ── MA CONFIGURATION (9 nov.) : plein écran, une étape par écran, des cartes ──
// La règle (étapes, pré-sélection, écritures) est dans src/configurationDepart.js ;
// les taux et le profil fiscal dans src/profilFiscal.js. Ce fichier ne fait que
// DESSINER et transmettre : chaque « Continuer » écrit l'étape (ce qui a changé
// seulement) par `ecrire`, qui rend true/false — un refus n'avance pas et le dit.
import React from 'react';
import { createPortal } from 'react-dom';
import { PLATEFORMES } from './plateformes.js';
import {
  etapesActives, choixInitiaux, ecrituresEtape, ecritureFin, recapConfiguration, appliquerEcritures, famillesDe,
  CHOIX_VENDS, CHOIX_STATUT, CHOIX_RYTHME, CHOIX_LIBERATOIRE, CHOIX_ACRE, CHOIX_TVA_SOCIETE, CHOIX_NUMERO, CHOIX_OU, CHOIX_AFFICHAGE, FAMILLES_NOTIF,
  affichageRecommande, CHEMIN_REGLAGE_AFFICHAGE,
} from './configurationDepart.js';
import { AUTRE_MAX } from './profilVendeur.js';
import { useRechercheEntreprise, CarteVerifEntreprise } from './RechercheEntreprise.jsx';
import { statutProposeEntreprise } from './entrepriseRecherche.js';
import { tauxMicro, detailTaux, AIDE_NEUTRE, SOURCES_OFFICIELLES, seuilsActivite, regimeLu } from './profilFiscal.js';
import './configuration-depart.css';
import Pourquoi from './composants/PourquoiReplie.jsx';

const pct = (n) => `${String(n).replace('.', ',')} %`;
const euros = (n) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
const NOMS_PLATEFORMES = Object.fromEntries(PLATEFORMES.map((p) => [p.id, p.nom]));
const NOTE_FAMILLE = {
  ventes: 'Une vente, l’argent reçu.', offres: 'Une offre à trancher.', messages: 'Un message d’acheteur.',
  poster: 'Un bordereau prêt, une date limite.', arrives: 'Un colis t’attend, avec son code.',
  doublevente: 'Un article vendu deux fois.', rappels: 'Déclarations, bilan, factures.', comptes: 'Un compte relié pour la première fois.',
};

function Carte({ choisi, onClick, titre, sous, effet, logo, data, multi = false, desactive = false, note, puces, badge }) {
  return (
    <button type="button" className="vrm-cfg-carte" role={multi ? undefined : 'radio'} aria-checked={multi ? undefined : !!choisi} aria-pressed={multi ? !!choisi : undefined}
      data-choisi={choisi ? '1' : '0'} disabled={desactive} onClick={onClick} {...(data || {})}>
      {logo ? <span className="vrm-cfg-logo" aria-hidden="true" style={{ '--vrm-cfg-logo': `url("${logo}")` }} /> : null}
      <span className="vrm-cfg-carte-texte">
        {badge ? <span className="vrm-cfg-badge" data-configuration-recommande="">{badge}</span> : null}
        <b>{titre}</b>
        {sous ? <small>{sous}</small> : null}
        {puces && puces.length ? <ul className="vrm-cfg-puces">{puces.map((t) => <li key={t}>{t}</li>)}</ul> : null}
        {effet ? <small className="vrm-cfg-effet">{effet}</small> : null}
        {note ? <small className="vrm-cfg-note-carte">{note}</small> : null}
      </span>
      <span className="vrm-cfg-coche" aria-hidden="true">{choisi ? <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg> : null}</span>
    </button>
  );
}
// Les icônes des tuiles « Qu'est-ce que tu vends ? » : au trait, une couleur (celle du
// texte), dessinées ici (24 × 24) — jamais un emoji.
const TRAITS_VENDS = {
  sneakers: 'M2.5 15.5c0-2 1-3.2 2.4-3.6L8 11l2-3.5 1.6.9c1 .6 2.2.9 3.4.9H16c2.6 0 5.5 2.1 5.5 4.6v1.6H2.5zM2.5 17.5h19M9 11l1.5 1M11 9.5l1.5 1',
  vetements: 'M8.5 3.5 4 6l1.6 4 2-.8V20.5h8.8V9.2l2 .8L20 6l-4.5-2.5c-.6 1.6-1.9 2.5-3.5 2.5s-2.9-.9-3.5-2.5z',
  luxe: 'M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16M15 4l-3 16',
  sacs: 'M4.5 8.5h15l-1.2 12h-12.6zM8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5',
  montres: 'M8 7.5 9 3h6l1 4.5M8 16.5 9 21h6l1-4.5M12 9.5v2.7l1.6 1.3M17.5 12a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z',
  accessoires: 'M3 11.5h7M14 11.5h7M3.5 11.5l1 4.5a2 2 0 0 0 2 1.5h1.6a2 2 0 0 0 1.9-1.4l1-3.1h2l1 3.1a2 2 0 0 0 1.9 1.4h1.6a2 2 0 0 0 2-1.5l1-4.5',
  vintage: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
  enfants: 'M7 13.5a5 5 0 0 0 10 0V9.5H7zM9.5 9.5V7a2.5 2.5 0 0 1 5 0v2.5M5 13.5h2M17 13.5h2M10 20.5h4',
  livres: 'M4 5.5c2.7-.8 5.4-.4 8 1.2v13c-2.6-1.6-5.3-2-8-1.2zM20 5.5c-2.7-.8-5.4-.4-8 1.2v13c2.6-1.6 5.3-2 8-1.2z',
  jeux: 'M7.5 8.5h9a4 4 0 0 1 3.9 4.9l-.8 3.6a2 2 0 0 1-3.4.9L14 15.5h-4l-2.2 2.4a2 2 0 0 1-3.4-.9l-.8-3.6a4 4 0 0 1 3.9-4.9zM8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01',
  hightech: 'M7.5 2.5h9a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1zM10.5 18.5h3',
  cartes: 'M7 3.5h9.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM9.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7M11.8 8.5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z',
  jouets: 'M8 8.5a4 4 0 1 1 8 0v1H8zM7 9.5h10l-1 11H8zM10 13.5h4',
  maison: 'M3.5 11 12 4l8.5 7M5.5 9.5v11h13v-11M10 20.5v-6h4v6',
  sport: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4zM12 3.5v4M20.2 9.9l-4.4.4M17.2 18.8l-2.9-4.1M6.8 18.8l2.9-4.1M3.8 9.9l4.4.4',
  beaute: 'M10 3.5h4v5h-4zM8.5 8.5h7v12h-7zM8.5 12.5h7',
  musique: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 12h.01',
  autre: 'M5 12h.01M12 12h.01M19 12h.01M3.5 5.5h17v13h-17z',
};
function IconeVends({ v }) {
  return <svg className="vrm-cfg-tuile-icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={TRAITS_VENDS[v] || TRAITS_VENDS.autre} /></svg>;
}
function Tuile({ choisi, onClick, titre, v }) {
  return (
    <button type="button" className="vrm-cfg-tuile" aria-pressed={!!choisi} data-choisi={choisi ? '1' : '0'} onClick={onClick} data-configuration-choix={`vends:${v}`}>
      <IconeVends v={v} />
      <span className="vrm-cfg-tuile-t">{titre}</span>
      <span className="vrm-cfg-coche" aria-hidden="true">{choisi ? <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg> : null}</span>
    </button>
  );
}

function Groupe({ label, children, multi = false, colonnes }) {
  return <div className="vrm-cfg-grille" role={multi ? 'group' : 'radiogroup'} aria-label={label} data-colonnes={colonnes || undefined}>{children}</div>;
}

export default function ConfigurationDepart({ lus: lus0, lirePushPrefs, ecrire, onFin, depart = null, relies = {}, contexte = null, entreprise = null }) {
  const [lus, setLus] = React.useState(() => ({ ...lus0, relies }));
  const [initial, setInitial] = React.useState(() => choixInitiaux({ ...lus0, relies }));
  const [choix, setChoix] = React.useState(initial);
  const [cle, setCle] = React.useState(depart || 'vends');
  const [occupe, setOccupe] = React.useState(false);
  const [erreur, setErreur] = React.useState('');
  const titre = React.useRef(null);

  // Les notifications : la ligne `push_prefs` est LUE avant de proposer quoi que ce soit.
  React.useEffect(() => {
    let mort = false;
    if (!lirePushPrefs) { setLus((l) => ({ ...l, pushPrefs: null })); return undefined; }
    Promise.resolve().then(lirePushPrefs).then((p) => {
      if (mort) return;
      const pp = p && typeof p === 'object' ? p : null;
      setLus((l) => ({ ...l, pushPrefs: pp }));
      const f = famillesDe(pp);
      setInitial((x) => ({ ...x, familles: f }));
      setChoix((x) => (x.familles ? x : { ...x, familles: f }));
    }).catch(() => { if (!mort) setLus((l) => ({ ...l, pushPrefs: null })); });
    return () => { mort = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const etapes = etapesActives(choix);
  const idx = Math.max(0, etapes.findIndex((e) => e.cle === cle));
  const etape = etapes[idx];
  React.useEffect(() => { try { titre.current && titre.current.focus({ preventScroll: true }); } catch (_) {} setErreur(''); }, [cle]);

  const poser = (patch) => { setErreur(''); setChoix((c) => ({ ...c, ...patch })); };
  // Écrit l'étape courante. Rend true si tout est rangé (ou rien à ranger).
  const ecrireEtape = async () => {
    const w = ecrituresEtape(etape.cle, choix, initial, lus);
    if (!w.length) return true;
    let ok = false;
    try { ok = await ecrire(w); } catch (_) { ok = false; }
    if (!ok) { setErreur('Ce choix n’a pas pu être enregistré. Tes sélections sont gardées : réessaie.'); return false; }
    const l2 = appliquerEcritures(lus, w);
    setLus(l2);
    const i2 = choixInitiaux(l2);
    if (choix.statut === 'inconnu' && regimeLu(l2.regime) === null) i2.statut = 'inconnu';
    setInitial(i2);
    return true;
  };
  const verrou = React.useRef(false);
  const avec = async (f) => { if (verrou.current) return; verrou.current = true; setOccupe(true); try { await f(); } finally { verrou.current = false; setOccupe(false); } };
  const suivant = () => avec(async () => {
    if (!(await ecrireEtape())) return;
    const n = etapesActives(choix);
    const j = n.findIndex((e) => e.cle === etape.cle);
    if (j < n.length - 1) setCle(n[j + 1].cle);
  });
  const retour = () => { if (idx > 0) setCle(etapes[idx - 1].cle); };
  const finir = (etat) => avec(async () => {
    if (etat === 'plusTard' && etape.cle !== 'recap' && !(await ecrireEtape())) return;
    let ok = false;
    try { ok = await ecrire([ecritureFin(etat, choix)]); } catch (_) { ok = false; }
    if (!ok) { setErreur('La configuration n’a pas pu être enregistrée. Réessaie.'); return; }
    onFin && onFin(etat);
  });
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !occupe) finir('plusTard'); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  const rep = choixRepondu(etape.cle, choix, lus);
  const corps = corpsEtape(etape.cle, { choix, poser, lus, initial, aller: setCle, contexte, entreprise });
  const n = etapes.length;
  return createPortal(
    <div className="vrm-cfg" data-configuration={etape.cle} data-configuration-etape={idx + 1} data-configuration-sur={n}>
      <div className="vrm-cfg-panneau" role="dialog" aria-modal="true" aria-labelledby="vrm-cfg-titre">
        <header className="vrm-cfg-tete">
          <button type="button" className="vrm-cfg-lien" data-configuration-retour="" onClick={retour} disabled={idx === 0 || occupe} aria-hidden={idx === 0 ? 'true' : undefined} style={idx === 0 ? { visibility: 'hidden' } : undefined}>Retour</button>
          <div className="vrm-cfg-barre" role="progressbar" aria-label="Avancement de ta configuration" aria-valuemin={1} aria-valuemax={n} aria-valuenow={idx + 1} aria-valuetext={`Étape ${idx + 1} sur ${n}`}>
            {etapes.map((e, i) => <span key={e.cle} data-fait={i < idx ? '1' : '0'} data-ici={i === idx ? '1' : '0'} />)}
          </div>
          <button type="button" className="vrm-cfg-lien" data-configuration-plus-tard="" onClick={() => finir('plusTard')} disabled={occupe}>Plus tard</button>
        </header>
        <main className="vrm-cfg-corps" key={etape.cle}>
          <p className="vrm-cfg-sur">{idx + 1} sur {n}</p>
          <h1 id="vrm-cfg-titre" className="vrm-cfg-titre" tabIndex={-1} ref={titre}>{etape.titre}</h1>
          <p className="vrm-cfg-sous">{etape.sous}</p>
          {corps}
        </main>
        <footer className="vrm-cfg-pied">
          {erreur ? <p className="vrm-cfg-erreur" role="alert">{erreur}</p> : null}
          {etape.cle === 'recap'
            ? <button type="button" className="vrm-cfg-principal" data-configuration-fin="" disabled={occupe} aria-busy={occupe || undefined} onClick={() => finir('fait')}>{occupe ? 'Enregistrement…' : 'C’est parti'}</button>
            : <button type="button" className="vrm-cfg-principal" data-configuration-suivant="" data-repondu={rep ? '1' : '0'} disabled={occupe} aria-busy={occupe || undefined} onClick={suivant}>{occupe ? 'Enregistrement…' : rep ? 'Continuer' : 'Passer cette étape'}</button>}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function choixRepondu(cle, c, lus) {
  if (cle === 'vends') return Array.isArray(c.vends) && c.vends.length > 0;
  if (cle === 'plateformes') return (c.plateformes || []).length > 0;
  if (cle === 'statut') return !!c.statut;
  if (cle === 'micro') return !!(c.rythme && c.liberatoire && c.acre);
  if (cle === 'societe') return !!c.tvaSociete;
  if (cle === 'numero') return c.numero === 'vrm' || (c.numero === 'moi' && (c.numeroOu || []).length > 0);
  if (cle === 'affichage') return !!c.affichage;
  if (cle === 'notifs') return !!c.familles && !!lus.pushPrefs;
  return true;
}

function corpsEtape(cle, { choix: c, poser, lus, aller, contexte, entreprise }) {
  if (cle === 'vends') {
    const cats = Array.isArray(c.vends) ? c.vends : [];
    const basculer = (v) => { const n = cats.includes(v) ? cats.filter((x) => x !== v) : [...cats, v]; poser({ vends: n.length ? n : null }); };
    const mot = !cats.length ? null : cats.length === 1 && cats[0] === 'sneakers' ? 'paire' : 'article';
    return (<>
      <div className="vrm-cfg-tuiles" role="group" aria-label="Ce que tu vends (plusieurs choix possibles)">
        {CHOIX_VENDS.map((x) => <Tuile key={x.v} v={x.v} titre={x.titre} choisi={cats.includes(x.v)} onClick={() => basculer(x.v)} />)}
      </div>
      {cats.includes('autre') ? <label className="vrm-cfg-libre">
        <span>Autre chose : quoi ?</span>
        <input type="text" value={c.vendsAutre || ''} maxLength={AUTRE_MAX} placeholder="Vélos, plantes, outils…" onChange={(e) => poser({ vendsAutre: e.target.value })} data-configuration-autre="" />
      </label> : null}
      <p className="vrm-cfg-note" data-configuration-mot={mot || ''}>{mot === 'paire'
        ? 'VRM dira « paire » et vérifiera la taille et la marque avant de publier.'
        : mot === 'article'
          ? 'VRM dira « article » ; la taille et la marque sont facultatives.'
          : 'Plusieurs choix possibles. Tu pourras changer dans Réglages → Affichage → Je vends.'}</p>
    </>);
  }
  if (cle === 'plateformes') {
    const relies = lus.relies || {};
    return (<>
      <Groupe label="Tes plateformes" multi colonnes="2">
        {PLATEFORMES.map((p) => {
          const relie = relies[p.id] === true;
          const on = relie || (c.plateformes || []).includes(p.id);
          return <Carte key={p.id} multi logo={p.logo} choisi={on} desactive={relie} titre={p.nom} sous={relie ? 'Compte relié' : on ? 'Affichée' : 'Masquée'}
            onClick={() => poser({ plateformes: on ? (c.plateformes || []).filter((x) => x !== p.id) : [...(c.plateformes || []), p.id] })}
            data={{ 'data-configuration-choix': `plateforme:${p.id}`, 'data-choix-plateforme': p.id }} />;
        })}
      </Groupe>
      <p className="vrm-cfg-note">Un compte que tu relies avec l’extension s’affiche tout seul.</p>
    </>);
  }
  if (cle === 'statut') return (<>
    <Groupe label="Ton statut">
      {CHOIX_STATUT.map((x) => <Carte key={x.v} choisi={c.statut === x.v} onClick={() => poser({ statut: x.v })} titre={x.titre} sous={x.sous} effet={x.effet} data={{ 'data-configuration-choix': `statut:${x.v}` }} />)}
    </Groupe>
    {c.statut === 'inconnu' ? <AideNeutre /> : null}
    {entreprise && (c.statut === 'micro-vente' || c.statut === 'micro-services' || c.statut === 'societe')
      ? <SiretConfiguration entreprise={entreprise} statut={c.statut} poser={poser} /> : null}
  </>);
  if (cle === 'micro') {
    const activite = c.statut === 'micro-services' ? 'services' : 'vente';
    const acre = c.acre === 'non' || !c.acre ? false : c.acre;
    const lib = c.liberatoire === 'oui';
    const s = seuilsActivite(new Date().getFullYear(), activite);
    return (<>
      <h2 className="vrm-cfg-question">Tu déclares</h2>
      <Groupe label="Rythme de déclaration" colonnes="duo">
        {CHOIX_RYTHME.map((x) => <Carte key={x.v} choisi={c.rythme === x.v} onClick={() => poser({ rythme: x.v })} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `rythme:${x.v}` }} />)}
      </Groupe>
      <h2 className="vrm-cfg-question">Versement libératoire de l’impôt</h2>
      <Groupe label="Versement libératoire" colonnes="duo">
        {CHOIX_LIBERATOIRE.map((x) => <Carte key={x.v} choisi={c.liberatoire === x.v} onClick={() => poser({ liberatoire: x.v })} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `liberatoire:${x.v}` }} />)}
      </Groupe>
      <h2 className="vrm-cfg-question">ACRE (aide à la création)</h2>
      <Groupe label="ACRE">
        {CHOIX_ACRE.map((x) => <Carte key={x.v} choisi={c.acre === x.v} onClick={() => poser({ acre: x.v })} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `acre:${x.v}` }} />)}
      </Groupe>
      <div className="vrm-cfg-taux" data-configuration-taux={String(tauxMicro({ activite, liberatoire: lib, acre }))}>
        <div className="vrm-cfg-taux-ligne"><span>Ton taux</span><b>{pct(tauxMicro({ activite, liberatoire: lib, acre }))}</b></div>
        {detailTaux({ activite, liberatoire: lib, acre }).map((l) => <div key={l.quoi} className="vrm-cfg-taux-detail"><span>{l.quoi} · {l.note}</span><span>{pct(l.taux)}</span></div>)}
        {c.liberatoire == null ? <p className="vrm-cfg-note">Sans réponse sur le versement libératoire, le taux est compté sans lui.</p> : null}
        {s ? <div className="vrm-cfg-note">Plafond {euros(s.plafond)} · TVA au-delà de {euros(s.tvaBase)} (2026). <Pourquoi>Taux et seuils officiels 2026, à vérifier sur autoentrepreneur.urssaf.fr. Un taux posé à la main n’est jamais remplacé.</Pourquoi></div> : null}
      </div>
    </>);
  }
  if (cle === 'societe') return (
    <Groupe label="Ta TVA">
      {CHOIX_TVA_SOCIETE.map((x) => <Carte key={x.v} choisi={c.tvaSociete === x.v} onClick={() => poser({ tvaSociete: x.v })} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `tva:${x.v}` }} />)}
    </Groupe>
  );
  if (cle === 'numero') {
    // Les endroits : plusieurs possibles, jamais aucun (la dernière cochée reste, comme `basculerOu`).
    const ou = c.numeroOu || [];
    const basculer = (k) => { const n = ou.includes(k) ? ou.filter((x) => x !== k) : [...ou, k]; if (n.length) poser({ numero: 'moi', numeroOu: n }); };
    return (<>
      <Groupe label="Qui numérote" colonnes="2">
        {CHOIX_NUMERO.map((x) => <Carte key={x.v} choisi={c.numero === x.v} onClick={() => poser({ numero: x.v, ...(x.v === 'moi' && !ou.length ? { numeroOu: ['description'] } : {}) })} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `numero:${x.v}` }} />)}
      </Groupe>
      {c.numero === 'moi' ? <>
        <h2 className="vrm-cfg-question">Où l’écris-tu ?</h2>
        <Groupe label="Où est ton numéro" multi>
          {CHOIX_OU.map((x) => <Carte key={x.v} multi choisi={ou.includes(x.v)} onClick={() => basculer(x.v)} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `ou:${x.v}` }} />)}
        </Groupe>
      </> : null}
      <p className="vrm-cfg-note">Changer de méthode ne renumérote aucun article.</p>
    </>);
  }
  if (cle === 'affichage') {
    const reco = affichageRecommande(contexte);
    return (<>
      <Groupe label="Affichage">
        {CHOIX_AFFICHAGE.map((x) => <Carte key={x.v} choisi={c.affichage === x.v} onClick={() => poser({ affichage: x.v })} titre={x.titre} sous={x.sous} puces={x.puces}
          badge={reco === x.v ? 'Recommandé pour toi' : null} data={{ 'data-configuration-choix': `affichage:${x.v}` }} />)}
      </Groupe>
      <p className="vrm-cfg-note" data-configuration-reco={reco || ''}>{reco === 'simple'
        ? 'Recommandé : un seul compte Vinted et moins de 30 ventes sur 30 jours.'
        : reco === 'complet' ? 'Recommandé : tu as plusieurs comptes ou beaucoup de ventes.' : ''}
        {reco ? ' ' : ''}Rien n’est supprimé : chaque écran reste joignable. Tu pourras changer dans {CHEMIN_REGLAGE_AFFICHAGE}.</p>
    </>);
  }
  if (cle === 'notifs') {
    if (lus.pushPrefs === undefined) return <p className="vrm-cfg-note" data-configuration-notifs="encours">Je lis tes réglages de notifications…</p>;
    if (!lus.pushPrefs || !c.familles) return <p className="vrm-cfg-note" data-configuration-notifs="passu">Notifications pas lues : rien changé. Elles sont dans Réglages → Notifications.</p>;
    const micro = c.statut === 'micro-vente' || c.statut === 'micro-services';
    return (
      <Groupe label="Notifications" multi colonnes="2">
        {FAMILLES_NOTIF.map((f) => <Carte key={f.id} multi choisi={!!c.familles[f.id]} titre={f.titre}
          sous={f.id === 'rappels' && !micro ? 'Bilan, factures. Aucun rappel URSSAF : tu n’es pas micro-entrepreneur.' : NOTE_FAMILLE[f.id]}
          onClick={() => poser({ familles: { ...c.familles, [f.id]: !c.familles[f.id] } })} data={{ 'data-configuration-choix': `notif:${f.id}` }} />)}
      </Groupe>
    );
  }
  if (cle === 'recap') {
    const L = recapConfiguration(c, { nomsPlateformes: NOMS_PLATEFORMES });
    return (<>
      <ul className="vrm-cfg-recap">
        {L.map((l) => <li key={l.etape} data-configuration-recap={l.etape}>
          <span className="vrm-cfg-recap-t">{l.titre}</span>
          <span className="vrm-cfg-recap-v" data-vide={l.valeur ? '0' : '1'}>{l.valeur || 'Pas choisi'}</span>
          <button type="button" className="vrm-cfg-lien" onClick={() => aller(l.etape)} aria-label={`Modifier : ${l.titre}`}>Modifier</button>
        </li>)}
      </ul>
      {c.statut === 'inconnu' ? <p className="vrm-cfg-note">Statut pas choisi : aucune cotisation calculée. Argent te le redemandera.</p> : null}
    </>);
  }
  return null;
}

// ── LE SIRET À L'ÉTAPE STATUT (9 nov., soir) ─────────────────────────────────────
// « Pareil lorsqu'on choisit le statut de l'entreprise » : micro-entreprise ou société ⇒
// le champ SIRET, la MÊME recherche et la MÊME vérification que « Ma facture »
// (src/RechercheEntreprise.jsx). Ce qu'il valide est écrit dans SA fiche de facture
// (`vrm_pro_facture`, relue juste avant, fusionnée ; lecture ratée ⇒ rien écrit) ; le
// statut trouvé est seulement PROPOSÉ (« C'est bon » ⇒ coché, écrit au « Continuer »).
const ID_FICHE = 'vrm_pro_facture';
function SiretConfiguration({ entreprise, statut, poser }) {
  const [fiche, setFiche] = React.useState(undefined);        // undefined en cours · null pas su · objet
  const [saisie, setSaisie] = React.useState('');
  const touche = React.useRef(false);
  React.useEffect(() => {
    let mort = false;
    Promise.resolve().then(() => entreprise.lireReglage(ID_FICHE)).then((d) => {
      if (mort) return;
      const f = d === null || d === undefined ? null : { ...(d || {}) };
      setFiche(f);
      if (f && f.siret && !touche.current) setSaisie(String(f.siret));
    }).catch(() => { if (!mort) setFiche(null); });
    return () => { mort = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const recherche = useRechercheEntreprise(entreprise.chercherEntreprise, saisie);
  const ecrireFiche = async (patch) => {
    const frais = await entreprise.lireReglage(ID_FICHE);
    if (frais === null || frais === undefined) return false;          // lecture ratée : rien n'est écrit
    const fusion = { ...(frais || {}), ...patch };
    const ok = await entreprise.ecrireReglage(ID_FICHE, fusion);
    if (ok) { setFiche(fusion); try { window.dispatchEvent(new CustomEvent('vrm:fiche-facturation', { detail: fusion })); } catch (_) {} }
    return !!ok;
  };
  const rep = recherche.rep && typeof recherche.rep === 'object' ? recherche.rep : null;
  const prop = statutProposeEntreprise(rep);
  const [statutVu, setStatutVu] = React.useState('');
  const enTete = prop.statut && prop.statut !== statut && statutVu !== recherche.ch
    ? <div className="vrm-cfg-statut-propose" data-configuration-statut-propose={prop.statut}>
        <p>{prop.texte} Ton statut serait donc <b>Société</b>.</p>
        <div className="vrm-ent-gestes">
          <button type="button" className="vrm-ent-b" data-ent-statut-ok="" onClick={() => { poser({ statut: prop.statut }); setStatutVu(recherche.ch); }}>C’est bon</button>
          <button type="button" className="vrm-ent-b" data-ent-statut-non="" onClick={() => setStatutVu(recherche.ch)}>Non</button>
        </div>
      </div>
    : prop.texte && !prop.statut && statut === 'societe' ? <p className="vrm-cfg-statut-propose" data-configuration-statut-propose="ei">{prop.texte}</p> : null;
  return (
    <div className="vrm-cfg-siret" data-configuration-siret={fiche === undefined ? 'lecture' : fiche === null ? 'passu' : 'lu'}>
      <h2 className="vrm-cfg-question">Ton SIRET (facultatif)</h2>
      <label className="vrm-cfg-libre">
        <span>VRM cherche ton entreprise au registre public. Rien écrit sans ton accord.</span>
        <input type="text" inputMode="numeric" autoComplete="off" placeholder="14 chiffres" value={saisie} data-configuration-siret-champ=""
          onChange={(e) => { touche.current = true; setSaisie(e.target.value); }} />
      </label>
      {fiche === null ? <p className="vrm-cfg-note" style={{ textAlign: 'left' }}>Fiche de facture pas lue : rien ne sera écrit. Elle est dans Argent → Factures → Ma facture.</p> : null}
      <CarteVerifEntreprise recherche={recherche} actuel={fiche || {}} avecSiret enTete={enTete}
        onEcrire={(patch) => (fiche === null || fiche === undefined ? false : ecrireFiche(patch))} data={{ 'data-configuration-registre': '' }} />
    </div>
  );
}

function AideNeutre() {
  return (
    <div className="vrm-cfg-aide" data-configuration-aide="">
      {AIDE_NEUTRE.map((t) => <p key={t}>{t}</p>)}
      <ul>{SOURCES_OFFICIELLES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.nom}</a></li>)}</ul>
    </div>
  );
}
