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
} from './configurationDepart.js';
import { tauxMicro, detailTaux, AIDE_NEUTRE, SOURCES_OFFICIELLES, seuilsActivite, regimeLu } from './profilFiscal.js';
import './configuration-depart.css';

const pct = (n) => `${String(n).replace('.', ',')} %`;
const euros = (n) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
const NOMS_PLATEFORMES = Object.fromEntries(PLATEFORMES.map((p) => [p.id, p.nom]));
const NOTE_FAMILLE = {
  ventes: 'Une vente, l’argent reçu.', offres: 'Une offre à trancher.', messages: 'Un message d’acheteur.',
  poster: 'Un bordereau prêt, une date limite.', arrives: 'Un colis t’attend, avec son code.',
  doublevente: 'Un article vendu deux fois.', rappels: 'Déclarations, bilan, factures.', comptes: 'Un compte relié pour la première fois.',
};

function Carte({ choisi, onClick, titre, sous, effet, logo, data, multi = false, desactive = false, note }) {
  return (
    <button type="button" className="vrm-cfg-carte" role={multi ? undefined : 'radio'} aria-checked={multi ? undefined : !!choisi} aria-pressed={multi ? !!choisi : undefined}
      data-choisi={choisi ? '1' : '0'} disabled={desactive} onClick={onClick} {...(data || {})}>
      {logo ? <span className="vrm-cfg-logo" aria-hidden="true" style={{ '--vrm-cfg-logo': `url("${logo}")` }} /> : null}
      <span className="vrm-cfg-carte-texte">
        <b>{titre}</b>
        {sous ? <small>{sous}</small> : null}
        {effet ? <small className="vrm-cfg-effet">{effet}</small> : null}
        {note ? <small className="vrm-cfg-note-carte">{note}</small> : null}
      </span>
      <span className="vrm-cfg-coche" aria-hidden="true">{choisi ? <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg> : null}</span>
    </button>
  );
}
function Groupe({ label, children, multi = false, colonnes }) {
  return <div className="vrm-cfg-grille" role={multi ? 'group' : 'radiogroup'} aria-label={label} data-colonnes={colonnes || undefined}>{children}</div>;
}

export default function ConfigurationDepart({ lus: lus0, lirePushPrefs, ecrire, onFin, depart = null, relies = {} }) {
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
  const corps = corpsEtape(etape.cle, { choix, poser, lus, initial, aller: setCle });
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
  if (cle === 'vends') return !!c.vends;
  if (cle === 'plateformes') return (c.plateformes || []).length > 0;
  if (cle === 'statut') return !!c.statut;
  if (cle === 'micro') return !!(c.rythme && c.liberatoire && c.acre);
  if (cle === 'societe') return !!c.tvaSociete;
  if (cle === 'numero') return c.numero === 'vrm' || (c.numero === 'moi' && (c.numeroOu || []).length > 0);
  if (cle === 'affichage') return !!c.affichage;
  if (cle === 'notifs') return !!c.familles && !!lus.pushPrefs;
  return true;
}

function corpsEtape(cle, { choix: c, poser, lus, aller }) {
  if (cle === 'vends') return (
    <Groupe label="Ce que tu vends">
      {CHOIX_VENDS.map((x) => <Carte key={x.v} choisi={c.vends === x.v} onClick={() => poser({ vends: x.v })} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `vends:${x.v}` }} />)}
    </Groupe>
  );
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
        {s ? <p className="vrm-cfg-note">Plafond {euros(s.plafond)} · TVA au-delà de {euros(s.tvaBase)}. Taux et seuils officiels 2026, à vérifier sur autoentrepreneur.urssaf.fr. Un taux posé à la main n’est jamais remplacé.</p> : null}
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
      <Groupe label="Qui numérote" colonnes="duo">
        {CHOIX_NUMERO.map((x) => <Carte key={x.v} choisi={c.numero === x.v} onClick={() => poser({ numero: x.v, ...(x.v === 'moi' && !ou.length ? { numeroOu: ['description'] } : {}) })} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `numero:${x.v}` }} />)}
      </Groupe>
      {c.numero === 'moi' ? <>
        <h2 className="vrm-cfg-question">Où l’écris-tu ?</h2>
        <Groupe label="Où est ton numéro" multi>
          {CHOIX_OU.map((x) => <Carte key={x.v} multi choisi={ou.includes(x.v)} onClick={() => basculer(x.v)} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `ou:${x.v}` }} />)}
        </Groupe>
      </> : null}
      <p className="vrm-cfg-note">Changer de méthode ne renumérote aucun article : les numéros déjà écrits sur tes cartons restent.</p>
    </>);
  }
  if (cle === 'affichage') return (
    <Groupe label="Affichage">
      {CHOIX_AFFICHAGE.map((x) => <Carte key={x.v} choisi={c.affichage === x.v} onClick={() => poser({ affichage: x.v })} titre={x.titre} sous={x.sous} data={{ 'data-configuration-choix': `affichage:${x.v}` }} />)}
    </Groupe>
  );
  if (cle === 'notifs') {
    if (lus.pushPrefs === undefined) return <p className="vrm-cfg-note" data-configuration-notifs="encours">Je lis tes réglages de notifications…</p>;
    if (!lus.pushPrefs || !c.familles) return <p className="vrm-cfg-note" data-configuration-notifs="passu">Tes réglages de notifications n’ont pas pu être lus : rien n’est changé. Tu les retrouves dans Réglages → Notifications.</p>;
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
      {c.statut === 'inconnu' ? <p className="vrm-cfg-note">Ton statut n’est pas choisi : VRM ne calcule aucune cotisation. Comptabilité te reposera la question.</p> : null}
    </>);
  }
  return null;
}

function AideNeutre() {
  return (
    <div className="vrm-cfg-aide" data-configuration-aide="">
      {AIDE_NEUTRE.map((t) => <p key={t}>{t}</p>)}
      <ul>{SOURCES_OFFICIELLES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.nom}</a></li>)}</ul>
    </div>
  );
}
