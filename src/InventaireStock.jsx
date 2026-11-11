// ════════════════════════════════════════════════════════════════════════════
//  L'INVENTAIRE — Stock → « Inventaire » (6 nov. 2026, vague 1, demande de Julien)
//  Il passe devant ses cartons et tape (ou dit) chaque N° : retour immédiat —
//  « ✓ Attendu » à l'encre (neutre), ambre « en trop » ou « vendu, à sortir », rouge SEULEMENT
//  deux paires sous un même N° (§7), neutre « pas su » —, « Annuler le dernier »,
//  case par case s'il a des meubles. « Terminer » donne le bilan : ce qui MANQUE,
//  ce qui est EN TROP, ce qui est VENDU MAIS ENCORE RANGÉ, avec les gestes.
//
//  ⚠️ « N° + Entrée » vit ICI et nulle part ailleurs : la saisie « N° + Entrée » a
//     été retirée des autres écrans le 29 oct. (§3) ; ici, c'est le geste même de
//     l'inventaire. Au téléphone, le pavé numérique n'a pas de touche Entrée :
//     le grand bouton « OK » à côté du champ fait la même chose.
//  ⚠️ Les règles (attendu, jugement, bilan, fusion, écriture) sont dans
//     src/inventaire.js — cet écran n'en recalcule aucune. L'attendu vient du
//     Stock (`stock`, construit par `StockMeubles` depuis SES lectures).
//  ⚠️ L'inventaire en cours survit à la fermeture : la ligne `vrm_inventaire`
//     (lire-fusionner-réécrire sur `rev`, `enregistrerInventaire`) et, en attendant
//     qu'elle réponde, une copie sur cet appareil (`vrm_inventaire_local_{owner}`)
//     — une écriture ratée garde la saisie ici et la renvoie au geste suivant.
//  ⚠️ AUCUN NUMÉRO N'EST CHANGÉ (§5) : l'écran n'écrit que sa ligne. « Je l'ai
//     sortie » est le geste du Stock (`onSortir`), « Fiche » la fiche du N°.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import {
  jugerSaisie, indexerAttendu, bilanInventaire, saisiesVivantes, nouvelleSession, ajouterSaisie, annulerDerniere,
  terminerSession, reprendreSession, enCours, fusionnerInventaire, normaliserInventaire, enregistrerInventaire, inventaireVide, constatInventaire,
} from './inventaire.js';
import { motifVibration, cleAttente } from './inventaireHorsLigne.js';
import { requeteDeLaVoix } from './rechercheVocale.js';
import { placeCase } from './stockSortie.js';
import { SegmenteBase } from './composants/Bouton.jsx';
import { Numero } from './composants/Numero.jsx';
import Pourquoi from './composants/PourquoiReplie.jsx';
import { motsVendeur } from './profilVendeur.js';
import './styles-inventaire.css';
import { useLectureCamera, creerBip } from './ScannerColis.jsx';   // (10 nov., lot W) la caméra du lot V
import { numeroDuScan } from './inventaireAnnuel.js';
import './styles-inventaire-annuel.css';

const plur = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
const cleLocale = (owner) => 'vrm_inventaire_local_' + (owner || 'anon');
const lireLocal = (owner) => { try { const v = localStorage.getItem(cleLocale(owner)); return v ? normaliserInventaire(JSON.parse(v)) : inventaireVide(); } catch (_) { return inventaireVide(); } };
const ecrireLocal = (owner, d) => { try { localStorage.setItem(cleLocale(owner), JSON.stringify(d)); } catch (_) {} };
const NOM_PLAT = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
const RAISON_TROP = { archive: 'ancien numéro (archive) : plus une annonce', jamais: 'jamais donné par VRM', plusenligne: 'plus en annonce nulle part' };
const majuscule = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
// (9 nov.) « des saisies attendent d'être envoyées » : l'app le relit au retour du
// réseau (src/inventaireHorsLigne.js) pour envoyer l'inventaire même feuille fermée.
const poserAttente = (owner, oui) => { try { if (oui) localStorage.setItem(cleAttente(owner || 'anon'), String(Date.now())); else localStorage.removeItem(cleAttente(owner || 'anon')); } catch (_) {} };
// (9 nov.) La vibration du retour (Android ; l'iPhone l'ignore, rien n'en dépend).
const vibrer = (etat) => { try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(motifVibration(etat)); } catch (_) {} };
// (9 nov.) Le PAVÉ GÉANT : au doigt (pointeur grossier), VRM dessine son propre pavé —
// des touches de 64 px, « B » pour l'archive, ⌫ — et le clavier du téléphone ne
// s'ouvre pas par-dessus (`inputMode="none"`). « ABC » rend le clavier texte.
const doigt = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch (_) { return false; } };
const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'B', '0', '⌫'];
function PaveGeant({ onTouche, desactive }) {
  return (
    <div className="vrm-inv-pave" role="group" aria-label="Pavé numérique" data-inv-pave="">
      {TOUCHES.map((t) => (
        <button key={t} type="button" className={'vrm-inv-touche' + (t === '⌫' ? ' vrm-inv-touche-efface' : '') + (t === 'B' ? ' vrm-inv-touche-lettre' : '')} data-inv-touche={t}
          aria-label={t === '⌫' ? 'Effacer le dernier chiffre' : (t === 'B' ? 'Lettre B (ancien numéro)' : t)} disabled={desactive}
          onPointerDown={(e) => { e.preventDefault(); }} onClick={() => onTouche(t)}>{t}</button>
      ))}
    </div>
  );
}
const heure = (t) => { try { return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
const jour = (t) => { try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch (_) { return ''; } };

// Le mot d'un jugement, une règle pour le retour immédiat et la liste.
export function motJugement(j) {
  if (!j) return { t: '', s: '' };
  if (j.etat === 'illisible') return { t: 'Pas un N°', s: 'Tape le numéro écrit sur l’article ou son rangement (125, B125…)' };
  const dbl = j.doublon ? ` · porté par deux ${motsVendeur().noms} : vérifie les deux` : '';
  if (j.etat === 'attendu') {
    if (j.raison === 'gardee') return { t: '✓ Attendu', s: `Tu l’avais gardé « encore là »${dbl}` };
    const u = j.unite || {};
    const ou = (u.plateformes || []).map((x) => NOM_PLAT[x] || x).join(' et ');
    return { t: '✓ Attendu', s: `${u.titre ? u.titre + ' · ' : ''}${u.etat === 'masquee' ? 'masquée par Vinted, toujours chez toi' : (u.etat === 'aconfirmer' ? 'à confirmer (lecture ancienne) — le voilà' : (ou ? 'en ligne sur ' + ou : 'en ligne'))}${dbl}` };
  }
  if (j.etat === 'vendu') return { t: 'Vendu — à sortir', s: j.parti === true ? `VRM croit le colis déjà parti : vérifie (retour ?)${dbl}` : `Sors-le pour l’envoi${dbl}` };
  if (j.etat === 'trop') return { t: 'À vérifier', s: `Pas attendu ici : ${RAISON_TROP[j.raison] || 'VRM ne l’attend pas'}${dbl}` };
  return { t: 'Pas su', s: `${j.raison === 'ventes' ? 'Tes ventes ne sont pas encore lues : ouvre Ventes une fois' : 'Une lecture manque pour ce N° — je ne dis ni présent ni en trop'}${dbl}` };
}
const etatAffiche = (j, deuxieme = false) => (j && j.etat !== 'illisible' && (j.doublon || deuxieme) ? 'doublon' : (j ? j.etat : ''));

// (10 nov., lot W) LE SCANNER : la caméra du lot V (`useLectureCamera`) lit le code collé
// sur un carton ; un N° (« 125 », « B125 ») ou le SKU « VRM-125 » passe par la MÊME saisie
// que le clavier (`valider`) ; tout autre code ⇒ « Pas un N° », rien n'est compté.
function ScanNumeros({ onLu }) {
  const video = React.useRef(null);
  const lu = React.useRef(onLu); lu.current = onLu;
  const bip = React.useRef(null); if (!bip.current) bip.current = creerBip();
  const traiter = React.useCallback((brut) => { const ok = lu.current(brut); bip.current(!!ok); }, []);
  const camera = useLectureCamera(video, traiter);
  return (
    <div className="vrm-inv-scan" data-inv-scan={camera}>
      <video ref={video} playsInline muted autoPlay aria-hidden="true"/>
      {camera === 'sans' ? <p className="vrm-inv-scan-sans" data-inv-scan-sans="">Pas de caméra ici : tape le N°.</p> : <span className="vrm-inv-scan-viseur" aria-hidden="true"/>}
    </div>
  );
}

// (9 nov.) `horsLigne` : { at } — l'inventaire est fait HORS CONNEXION contre la liste des
// paires figée à cette heure (src/inventaireHorsLigne.js) ; dit en tête, une fois.
// `pave` : true/false force le pavé géant (sinon : au doigt).
export function InventaireStock({ stock, meubles = [], slots = {}, owner = '', lire, ecrire, onFermer, onFiche, onVoirCase, onSortir, peutSortir, Feuille, Micro = null, confirmer, nomsComptes = null, cle, horsLigne = null, pave: paveForce = null, EnTete = null }) {
  const [data, setData] = React.useState(() => lireLocal(owner));
  const dataRef = React.useRef(data);
  const [sync, setSync] = React.useState('lecture');   // lecture · ok · envoi · ko
  const [texte, setTexte] = React.useState('');
  const [lettres, setLettres] = React.useState(false);
  const [dernier, setDernier] = React.useState(null);  // { s, j, deja?, sid? }
  const [vue, setVue] = React.useState('auto');        // auto · bilan
  const [modeCase, setModeCase] = React.useState(false);
  const [caseIdx, setCaseIdx] = React.useState(0);
  const [revoir, setRevoir] = React.useState(null);    // l'id d'un inventaire précédent relu
  const [auDoigt] = React.useState(() => (paveForce == null ? doigt() : !!paveForce));
  const [scan, setScan] = React.useState(false);   // (10 nov., lot W) la caméra ouverte
  const champ = React.useRef(null);
  const enVol = React.useRef(false), encore = React.useRef(false), minuteur = React.useRef(null), vivant = React.useRef(true);

  const index = React.useMemo(() => (stock ? indexerAttendu(stock, cle) : null), [stock, cle]);
  const courant = data.courant;
  const ouvert = !!courant && enCours(courant);
  const vivantes = React.useMemo(() => saisiesVivantes(courant), [courant]);
  const bilan = React.useMemo(() => (stock && courant ? bilanInventaire({ session: courant, stock, cle }) : null), [stock, courant, cle]);

  // ── la synchronisation (lire-fusionner-réécrire, §5) ───────────────────────
  const synchroniser = React.useCallback(async () => {
    if (enVol.current) { encore.current = true; return; }
    enVol.current = true; setSync((s) => (s === 'lecture' ? s : 'envoi'));
    const r = await enregistrerInventaire({ lire, ecrire, local: dataRef.current });
    enVol.current = false;
    if (!vivant.current && !r.ok) return;
    if (r.ok) {
      const fus = fusionnerInventaire(r.data, dataRef.current);
      dataRef.current = fus; ecrireLocal(owner, fus);
      if (vivant.current) setData(fus);
      const reste = JSON.stringify(fus) !== JSON.stringify(normaliserInventaire(r.data));
      if (vivant.current) setSync(reste ? 'envoi' : 'ok');
      if (reste) encore.current = true; else poserAttente(owner, false);
    } else { poserAttente(owner, true); if (vivant.current) setSync('ko'); }
    if (encore.current) { encore.current = false; if (vivant.current) { clearTimeout(minuteur.current); minuteur.current = setTimeout(() => synchroniser(), 400); } else synchroniser(); }
  }, [lire, ecrire, owner]);
  React.useEffect(() => {
    vivant.current = true; synchroniser();
    return () => { vivant.current = false; if (minuteur.current) { clearTimeout(minuteur.current); minuteur.current = null; synchroniser(); } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const changer = (f) => {
    const next = f(dataRef.current); if (next === dataRef.current) return;
    dataRef.current = next; setData(next); ecrireLocal(owner, next); poserAttente(owner, true);
    clearTimeout(minuteur.current); minuteur.current = setTimeout(() => { minuteur.current = null; synchroniser(); }, 500);
  };

  // ── case par case ──────────────────────────────────────────────────────────
  const cases = React.useMemo(() => (Array.isArray(meubles) ? meubles : []).flatMap((m) => {
    const n = Math.max(1, Number(m.cols) || 1) * Math.max(1, Number(m.rows) || 1);
    return Array.from({ length: n }, (_, i) => { const p = placeCase(i, m); return { cle: String(m.id) + ':' + i, m: String(m.id), i, nom: `${m.name || 'Meuble'} · rangée ${p.rangee}, colonne ${p.colonne}` }; });
  }), [meubles]);
  const caseCour = modeCase && cases.length ? cases[Math.min(caseIdx, cases.length - 1)] : null;
  const nomCase = (cleCase) => { const c = cases.find((x) => x.cle === cleCase); return c ? c.nom : 'une case qui n’existe plus'; };
  const noteesIci = caseCour ? Object.keys(slots || {}).filter((k) => slots[k] && String(slots[k].m) === caseCour.m && Number(slots[k].i) === caseCour.i) : [];
  const vusCles = new Set(vivantes.map((x) => x.k));

  // ── les gestes ─────────────────────────────────────────────────────────────
  const commencer = () => { changer((d) => fusionnerInventaire(d, { courant: nouvelleSession(), anciens: d.courant ? [d.courant, ...d.anciens] : d.anciens })); setDernier(null); setVue('auto'); setTimeout(() => { try { champ.current && champ.current.focus(); } catch (_) {} }, 60); };
  const valider = (brut, { deuxieme = false } = {}) => {
    const t = String(brut == null ? '' : brut).trim();
    if (!t || !courant) return;
    const sansAppel = t.replace(/^(?:n°|no|n|#)\s*(?=[a-z]*\d)/i, '');
    const j = jugerSaisie(sansAppel, stock, { index, cle });
    setTexte('');
    if (j.etat === 'illisible') { setDernier({ s: t, j }); vibrer('illisible'); return; }
    const deja = vivantes.find((x) => x.k === j.k);
    if (deja && !deuxieme) { setDernier({ s: t, j, deja }); vibrer('deja'); return; }
    vibrer(etatAffiche(j, deuxieme));
    changer((d) => ({ ...d, courant: ajouterSaisie(d.courant, { k: j.k, s: sansAppel, c: caseCour ? caseCour.cle : '', d: deuxieme ? 1 : 0 }) }));
    setDernier({ s: sansAppel, j, deuxieme, ailleurs: caseCour && slots[j.k] && !(String(slots[j.k].m) === caseCour.m && Number(slots[j.k].i) === caseCour.i) ? String(slots[j.k].m) + ':' + Number(slots[j.k].i) : '' });
    try { champ.current && champ.current.focus(); } catch (_) {}
  };
  const annuler = () => {
    let fait = null;
    changer((d) => { const r = annulerDerniere(d.courant); fait = r.annulee; return r.annulee ? { ...d, courant: r.session } : d; });
    setDernier(fait ? { s: fait.k, annule: true } : null);
  };
  const terminer = async () => {
    const ok = confirmer ? await confirmer({ title: 'Terminer l’inventaire ?', desc: `${plur(vusCles.size, 'N° vu', 'N° vus')}. Le bilan dit ce qui manque, ce qui est en trop et ce qui est vendu mais encore rangé. Rien n’est changé dans tes numéros.`, ok: 'Voir le bilan', cancel: 'Continuer' }) : true;
    if (!ok) return;
    // (9 nov.) Le constat FIGÉ de ce jour-là (relisible tel quel dans « Inventaires précédents »).
    const constat = stock && stock.su ? constatInventaire(bilanInventaire({ session: dataRef.current.courant, stock, cle }), { base: horsLigne && Number.isFinite(horsLigne.at) ? horsLigne.at : null }) : null;
    changer((d) => ({ ...d, courant: terminerSession(d.courant, Date.now(), constat) })); setVue('bilan');
  };
  const reprendre = () => { changer((d) => ({ ...d, courant: reprendreSession(d.courant) })); setVue('auto'); setTimeout(() => { try { champ.current && champ.current.focus(); } catch (_) {} }, 60); };
  const toucher = (t) => {
    if (t === '⌫') { setTexte((x) => x.slice(0, -1)); return; }
    setTexte((x) => (x.length >= 12 ? x : (t === 'B' ? (/^[A-Za-z]*$/.test(x) && x.length < 3 ? x + 'B' : x) : x + t)));
  };
  const scanne = (brut) => { const n = numeroDuScan(brut, cle); if (!n) { setDernier({ s: String(brut || '').slice(0, 20), j: { etat: 'illisible' } }); vibrer('illisible'); return false; } valider(n); return true; };
  const voix = (t) => { const r = requeteDeLaVoix(t); if (r.numero) valider(r.requete); else setDernier({ s: String(t || ''), j: { etat: 'illisible' } }); };

  // ── ce qui manque aux lectures, NOMMÉ (pas su ≠ manque) ─────────────────────
  const lectures = stock && Array.isArray(stock.manque) ? stock.manque : [];
  const lecturesTxt = lectures.map((m) => (m.plateforme === 'vinted' ? `${m.nom} sur Vinted` : m.nom) + (m.raison ? ` (${m.raison})` : '')).join(', ');
  const etatSync = sync === 'ko' ? (horsLigne
      ? <p className="vrm-inv-sync" data-inv-sync="ko" data-inv-sync-hl="">Hors connexion : {plur(vivantes.length, 'saisie gardée', 'saisies gardées')} sur cet appareil — envoyée{vivantes.length > 1 ? 's' : ''} au retour du réseau. Tu peux fermer l’app.</p>
      : <p className="vrm-inv-sync" data-inv-sync="ko">Pas encore enregistré dans le nuage : {plur(vivantes.length, 'saisie gardée', 'saisies gardées')} sur cet appareil, renvoyée{vivantes.length > 1 ? 's' : ''} au prochain geste.</p>)
    : <p className="vrm-inv-sync" data-inv-sync={sync}>{sync === 'lecture' ? 'Je relis ton inventaire…' : (sync === 'envoi' ? 'Enregistrement…' : 'Enregistré — tu peux fermer l’app, tu reprendras ici.')}</p>;

  // ── rendu ──────────────────────────────────────────────────────────────────
  const voirBilan = vue === 'bilan' || (courant && !ouvert);
  const titre = 'Inventaire';
  const sous = courant ? (ouvert ? `Commencé le ${jour(courant.debut)} à ${heure(courant.debut)}` : `Terminé le ${jour(courant.finAt)} à ${heure(courant.finAt)}`) : 'Tes articles rangés, un par un';

  const ligneVue = (x) => {
    const j = jugerSaisie(x.k, stock, { index, cle }); const m = motJugement(j); const et = etatAffiche(j, x.d);
    return (
      <li key={x.sid} className={'vrm-inv-ligne' + (et === 'doublon' ? ' vrm-inv-double' : '')} data-inv-ligne={x.k} data-inv-etat={et}>
        <Numero n={x.k} taille="petit" etat={et === 'doublon' ? 'doublon' : undefined}/>
        <span className="vrm-inv-ligne-t"><b>{x.d ? '2ᵉ article · ' : ''}{m.t}</b>{x.c ? <small> · {nomCase(x.c)}</small> : null}</span>
        <span className="vrm-inv-point" aria-hidden="true"/>
      </li>
    );
  };

  const accueil = (
    <div className="vrm-inv-accueil" data-inv-vue="accueil">
      <div className="vrm-inv-intro">Tape chaque N° vu : <b>attendu</b>, <b>en trop</b> ou <b>vendu</b>. Aucun N° changé. <Pourquoi>Passe devant tes rangements (cartons, étagères, bacs…) et tape chaque N° que tu vois. Je te dis tout de suite s’il est attendu, en trop ou vendu ; à la fin, ce qui manque. Aucun numéro n’est changé.</Pourquoi></div>
      {stock === undefined ? <p className="vrm-inv-note" data-inv-lecture="encours">Je lis tes annonces…</p>
        : (!stock || !stock.su ? <p className="vrm-inv-note" data-inv-lecture="passu">Annonces pas lues{lecturesTxt ? ` (${lecturesTxt})` : ''} : « manque » pas su. Ouvre Vinted, puis reviens.</p>
          : <p className="vrm-inv-note" data-inv-lecture="ok" data-inv-attendus={index ? index.unites.length : 0}>{plur(index ? index.unites.length : 0, `${motsVendeur().nom} attendu${motsVendeur().e}`, `${motsVendeur().noms} attendu${motsVendeur().e}s`)} en stock{lecturesTxt ? <> · <b>pas lu : {lecturesTxt}</b> — ses {motsVendeur().noms} ne comptent pas</> : null}.</p>)}
      <button type="button" className="vrm-b vrm-b-primaire vrm-inv-large" data-inv-commencer="" disabled={sync === 'lecture' || stock === undefined} onClick={commencer}>Commencer l’inventaire</button>
      {sync === 'lecture' ? etatSync : (sync === 'ko' ? <p className="vrm-inv-sync" data-inv-sync="ko">{horsLigne ? 'Hors connexion : un inventaire commencé sur un autre appareil n’apparaît pas ici.' : 'Je n’ai pas pu relire ton inventaire : un inventaire commencé sur un autre appareil n’apparaît pas encore ici.'}</p> : null)}
    </div>
  );

  const saisie = ouvert ? (
    <div className="vrm-inv-saisie" data-inv-vue="saisie" data-inv-n={vusCles.size}>
      {cases.length > 0 && (
        <div className="vrm-inv-mode">
          <SegmenteBase label="Comment tu fais le tour" plein value={modeCase ? 'case' : 'tout'} onChange={(v) => setModeCase(v === 'case')}
            options={[{ v: 'tout', l: 'Tout le stock', data: { 'data-inv-mode': 'tout' } }, { v: 'case', l: 'Case par case', data: { 'data-inv-mode': 'case' } }]}/>
          {caseCour && (
            <div className="vrm-inv-case" data-inv-case={caseCour.cle}>
              <button type="button" className="vrm-inv-pas" aria-label="Case précédente" disabled={caseIdx <= 0} onClick={() => setCaseIdx((i) => Math.max(0, i - 1))}>‹</button>
              <span className="vrm-inv-case-nom"><b>{caseCour.nom}</b>
                <small>{noteesIci.length ? <>Notées ici : {noteesIci.map((k) => <span key={k} data-inv-notee={k} data-inv-notee-vue={vusCles.has(k) ? '1' : '0'} className="vrm-inv-notee">N°{k}{vusCles.has(k) ? ' ✓' : ''}</span>)}</> : `${motsVendeur().Aucune} noté${motsVendeur().e} dans cette case`}</small></span>
              <button type="button" className="vrm-inv-pas" aria-label="Case suivante" data-inv-case-suivante="" disabled={caseIdx >= cases.length - 1} onClick={() => setCaseIdx((i) => Math.min(cases.length - 1, i + 1))}>›</button>
            </div>
          )}
        </div>
      )}
      {scan ? <ScanNumeros onLu={scanne}/> : null}
      {(() => { const etR = dernier ? (dernier.annule ? 'annule' : (dernier.deja ? 'deja' : etatAffiche(dernier.j, dernier.deuxieme))) : 'vide'; return (
      <div className={'vrm-inv-retour' + (etR === 'doublon' ? ' vrm-inv-double' : '')} role="status" aria-live="polite" data-inv-retour={etR}>
        {!dernier ? <span className="vrm-inv-retour-vide">Tape le premier N°</span>
          : dernier.annule ? <><span className="vrm-inv-retour-n">N°{dernier.s}</span><span className="vrm-inv-retour-t">Annulé</span><span className="vrm-inv-retour-s">Il n’est plus compté</span></>
          : dernier.deja ? <><span className="vrm-inv-retour-n">N°{dernier.j.k}</span><span className="vrm-inv-retour-t">Déjà compté</span><span className="vrm-inv-retour-s">à {heure(dernier.deja.at)} — même article, rien à faire.</span>
              <button type="button" className="vrm-b vrm-b-secondaire" data-inv-deuxieme={dernier.j.k} onClick={() => valider(dernier.j.k, { deuxieme: true })}>C’est un 2ᵉ article N°{dernier.j.k}</button></>
          : (() => { const m = motJugement(dernier.j); return <><span className="vrm-inv-retour-n">{dernier.j.etat === 'illisible' ? `« ${dernier.s} »` : `N°${dernier.j.k}`}</span><span className="vrm-inv-retour-t">{dernier.deuxieme ? 'Deux articles sous ce N°' : m.t}</span><span className="vrm-inv-retour-s">{dernier.deuxieme ? `Deux ${motsVendeur().noms} sous un même numéro : ${motsVendeur().la} mauvais${motsVendeur().e} peut partir. Ouvre sa fiche après l’inventaire.` : m.s}{dernier.ailleurs ? ` · noté dans ${nomCase(dernier.ailleurs)}` : ''}{!dernier.ailleurs && !dernier.deuxieme && dernier.j.etat === 'vendu' && slots && slots[dernier.j.k] ? ` · ${nomCase(String(slots[dernier.j.k].m) + ':' + Number(slots[dernier.j.k].i))}` : ''}</span></>; })()}
      </div>); })()}
      <form className="vrm-inv-champ" onSubmit={(e) => { e.preventDefault(); valider(texte); }}>
        <input ref={champ} value={texte} onChange={(e) => setTexte(e.target.value)} inputMode={lettres ? 'text' : (auDoigt ? 'none' : 'numeric')} pattern={lettres ? undefined : '[0-9]*'}
          autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done" maxLength={12}
          placeholder={lettres ? 'B125' : 'N°'} aria-label="Numéro écrit sur l’article ou son rangement" data-inv-champ=""/>
        <button type="button" className="vrm-inv-abc" aria-pressed={lettres} onClick={() => { setLettres((x) => !x); setTimeout(() => { try { champ.current && champ.current.focus(); } catch (_) {} }, 30); }} title="Un N° avec une lettre (B125)">{lettres ? '123' : 'ABC'}</button>
        <button type="submit" className="vrm-b vrm-b-primaire vrm-inv-ok" data-inv-valider="" disabled={!texte.trim()}>OK</button>
      </form>
      {auDoigt && !lettres ? <PaveGeant onTouche={toucher}/> : null}
      <div className="vrm-inv-gestes">
        <button type="button" className="vrm-b vrm-b-secondaire" data-inv-annuler="" disabled={!vivantes.length} onClick={annuler}>{vivantes.length ? `Annuler N°${vivantes[vivantes.length - 1].k}` : 'Annuler le dernier'}</button>
        {Micro ? <Micro titre="Dire le N° (« numéro 125 », « B 125 »)" onText={voix}/> : null}
        <button type="button" className="vrm-b vrm-b-secondaire" data-inv-scanner={scan ? '1' : '0'} aria-pressed={scan} onClick={() => setScan((x) => !x)}>{scan ? 'Fermer la caméra' : 'Scanner'}</button>
        <span style={{ flex: 1 }}/>
        <button type="button" className="vrm-b vrm-b-secondaire" data-inv-terminer="" onClick={terminer}>Terminer</button>
      </div>
      {vivantes.length > 0 && <ol className="vrm-inv-liste" data-inv-recents={Math.min(8, vivantes.length)} reversed>{vivantes.slice(-8).reverse().map(ligneVue)}</ol>}
      <p className="vrm-inv-note">{plur(vusCles.size, 'N° vu', 'N° vus')}{bilan ? <> · <span data-inv-compte="attendu">{bilan.attendus.length} attendu{bilan.attendus.length > 1 ? 's' : ''}</span>{bilan.vendus.length ? <> · <span data-inv-compte="vendu">{bilan.vendus.length} vendu{bilan.vendus.length > 1 ? 's' : ''}</span></> : null}{bilan.trop.length ? <> · <span data-inv-compte="trop">{bilan.trop.length} en trop</span></> : null}</> : null}{lecturesTxt ? <> · pas lu : {lecturesTxt}</> : null}</p>
      {etatSync}
    </div>
  ) : null;

  const section = (id, titreS, liste, rendu, aide) => (liste.length ? (
    <section className="vrm-inv-section" data-inv-section={id} data-inv-section-n={liste.length}>
      <h3>{titreS} · {liste.length}</h3>
      {aide ? <p className="vrm-inv-aide">{aide}</p> : null}
      <ul>{liste.map(rendu)}</ul>
    </section>) : null);
  const gesteFiche = (numero) => (onFiche ? <button type="button" className="vrm-b vrm-b-discret" data-inv-fiche={numero} onClick={() => onFiche(String(numero))}>Fiche</button> : null);
  const ligneBilan = (k, numero, etat, t, s, gestes) => (
    <li key={k} className={'vrm-inv-ligne vrm-inv-ligne-bilan' + (etat === 'doublon' ? ' vrm-inv-double' : '')} data-inv-bilan={k} data-inv-etat={etat}>
      <Numero n={numero} taille="petit" etat={etat === 'doublon' ? 'doublon' : undefined}/>
      <span className="vrm-inv-ligne-t"><b>{t}</b>{s ? <small>{s}</small> : null}</span>
      <span className="vrm-inv-ligne-g">{gestes}</span>
    </li>);
  const placeDe = (k) => { const sl = slots && slots[k]; return sl ? nomCase(String(sl.m) + ':' + Number(sl.i)) : ''; };
  const comptes = (u) => (u.comptes || []).map((x) => (nomsComptes && nomsComptes.get ? nomsComptes.get(x) : null) || x).join(', ');
  const vueBilan = courant && bilan ? (
    <div className="vrm-inv-bilan" data-inv-vue="bilan" data-inv-manque={bilan.manque.length} data-inv-trop={bilan.trop.length} data-inv-vendus={bilan.vendus.length} data-inv-doublons={bilan.doublons.length} data-inv-passu={bilan.passu.length + bilan.aConfirmer.length}>
      <div className="vrm-inv-resume">
        <div><b data-inv-total="vus">{vusCles.size}</b><small>vus</small></div>
        <div data-inv-ton={bilan.manque.length ? 'geste' : ''}><b>{bilan.su ? bilan.manque.length : '—'}</b><small>à chercher</small></div>
        <div data-inv-ton={bilan.trop.length ? 'geste' : ''}><b>{bilan.trop.length}</b><small>à vérifier</small></div>
        <div data-inv-ton={bilan.vendus.length ? 'geste' : ''}><b>{bilan.vendus.length}</b><small>vendus rangés</small></div>
      </div>
      {!bilan.su ? <p className="vrm-inv-note" data-inv-lecture="passu">Je n’ai pas pu lire tes annonces : je ne dis pas ce qui manque.</p> : null}
      {(lectures.length > 0 || bilan.aConfirmer.length > 0) && <p className="vrm-inv-note" data-inv-lectures-manquent="">
        {lectures.length ? <>Pas lu : <b>{lecturesTxt}</b> — ses {motsVendeur().noms} ne sont pas compté{motsVendeur().e}s comme manquant{motsVendeur().e}s. </> : null}
        {bilan.aConfirmer.length ? <>{plur(bilan.aConfirmer.length, 'annonce', 'annonces')} « à confirmer » (lecture de plus de 24 h) pas vue{bilan.aConfirmer.length > 1 ? 's' : ''} : {bilan.aConfirmer.slice(0, 6).map((u) => 'N°' + u.numero).join(', ')}{bilan.aConfirmer.length > 6 ? '…' : ''} — repasse sur Vinted avec ce compte, puis refais le tour. </> : null}
      </p>}
      {section('doublons', `Deux ${motsVendeur().noms} sous un même N°`, bilan.doublons, (v) => ligneBilan(v.k, v.k, 'doublon', v.raison === 'cartons' ? 'Deux articles rangés portent ce N°' : `Porté par deux ${motsVendeur().noms} dans VRM`, `${motsVendeur().La} mauvais${motsVendeur().e} ${motsVendeur().nom} peut partir : ouvre la fiche et corrige avant d’expédier.`, gesteFiche(v.k)), null)}
      {section('vendus', 'À vérifier — vendues, encore rangées', bilan.vendus, (v) => ligneBilan(v.k, v.k, 'vendu', v.jugement.parti === true ? 'Colis parti selon VRM' : 'À sortir pour l’envoi', [v.jugement.unite && v.jugement.unite.titre, v.jugement.parti === true ? 'vérifie : retour, ou mauvais carton ?' : placeDe(v.k)].filter(Boolean).join(' · '),
        <>{onSortir && peutSortir && peutSortir(v.k) ? <button type="button" className="vrm-b vrm-b-secondaire" data-inv-sortir={v.k} onClick={() => onSortir(v.k)}>Je l’ai sortie</button> : null}{gesteFiche(v.k)}</>), 'Prouvées vendues : sors-les de leur rangement pour l’envoi.')}
      {section('manque', 'À chercher', bilan.manque, (u) => ligneBilan(u.cles[0], u.numero, 'manque', u.titre || 'Sans titre lu', [u.source === 'gardee' ? 'tu l’avais gardée « encore là »' : (u.plateformes || []).map((x) => NOM_PLAT[x] || x).join(' et '), comptes(u), placeDe(u.cles[0]) ? 'notée : ' + placeDe(u.cles[0]) : ''].filter(Boolean).join(' · '),
        <>{onVoirCase && slots && slots[u.cles[0]] ? <button type="button" className="vrm-b vrm-b-discret" data-inv-voir-case={u.cles[0]} onClick={() => onVoirCase(u.cles[0])}>Voir la case</button> : null}{gesteFiche(u.numero)}</>), 'Attendues chez toi, pas vues : cherche l’article, ou ouvre la fiche (vendue ailleurs ? perdue ?).')}
      {section('trop', 'À vérifier', bilan.trop, (v) => ligneBilan(v.k, v.k, 'trop', majuscule(RAISON_TROP[v.jugement.raison] || 'VRM ne l’attend pas'), v.cases.length ? 'vu dans ' + v.cases.map(nomCase).join(', ') : '', gesteFiche(v.k)), 'Vues dans tes rangements, mais VRM ne les attend pas (plus en annonce, jamais donné, ancien N°) : remets-les en vente, ou sors-les.')}
      {section('passu', 'Pas su', bilan.passu, (v) => ligneBilan(v.k, v.k, 'passu', motJugement(v.jugement).s, '', gesteFiche(v.k)), null)}
      {section('place', 'Pas dans leur case', bilan.pasASaPlace, (v) => ligneBilan(v.k, v.k, 'place', 'Vue dans ' + v.cases.map(nomCase).join(', '), 'notée dans ' + nomCase(v.notee.m + ':' + v.notee.i), onVoirCase ? <button type="button" className="vrm-b vrm-b-discret" data-inv-voir-case={v.k} onClick={() => onVoirCase(v.k)}>Voir la case</button> : null), null)}
      {bilan.vendusNonVus.length > 0 && <p className="vrm-inv-note" data-inv-vendus-non-vus={bilan.vendusNonVus.length}>{plur(bilan.vendusNonVus.length, 'vente à envoyer', 'ventes à envoyer')} pas vue{bilan.vendusNonVus.length > 1 ? 's' : ''} : N°{bilan.vendusNonVus.slice(0, 8).join(', N°')}{bilan.vendusNonVus.length > 8 ? '…' : ''} — déjà emballée{bilan.vendusNonVus.length > 1 ? 's' : ''} ?</p>}
      {bilan.attendus.length > 0 && <p className="vrm-inv-note" data-inv-attendus-vus={bilan.attendus.length}>{plur(bilan.attendus.length, `${motsVendeur().nom} attendu${motsVendeur().e} vu${motsVendeur().e}`, `${motsVendeur().noms} attendu${motsVendeur().e}s vu${motsVendeur().e}s`)} : tout va bien pour {bilan.attendus.length > 1 ? motsVendeur().eux : motsVendeur().lui}.</p>}
      {bilan.sansNumero > 0 && <p className="vrm-inv-note">{plur(bilan.sansNumero, 'annonce', 'annonces')} sans N° : l’inventaire ne peut pas les vérifier (donne-leur un N° dans Annonces).</p>}
      <div className="vrm-inv-gestes">
        {!ouvert ? <button type="button" className="vrm-b vrm-b-secondaire" data-inv-reprendre="" onClick={reprendre}>Reprendre cet inventaire</button> : <button type="button" className="vrm-b vrm-b-secondaire" onClick={() => setVue('auto')}>Continuer la saisie</button>}
        <span style={{ flex: 1 }}/>
        {!ouvert ? <button type="button" className="vrm-b vrm-b-primaire" data-inv-nouveau="" onClick={async () => { const ok = confirmer ? await confirmer({ title: 'Commencer un nouvel inventaire ?', desc: 'Celui-ci est gardé (les 3 derniers).', ok: 'Commencer', cancel: 'Annuler' }) : true; if (ok) commencer(); }}>Nouvel inventaire</button> : null}
      </div>
      {etatSync}
    </div>
  ) : (courant ? <p className="vrm-inv-note">Je lis tes annonces…</p> : null);

  // ── (9 nov.) LES INVENTAIRES PRÉCÉDENTS : le constat FIGÉ de chacun, relu tel quel ──
  // (le bilan d'un inventaire terminé, tel qu'il était CE jour-là — pas recalculé
  // sur les annonces d'aujourd'hui). Un inventaire d'avant le 9 nov. n'a pas de
  // constat : on dit ce qu'il a vu, rien d'inventé.
  const precedents = (Array.isArray(data.anciens) ? data.anciens : []).filter((x) => x && x.id);
  const resumeConstat = (c) => (c ? [plur(c.vus, 'N° vu', 'N° vus'), c.su ? `${c.manque.length} à chercher` : 'à chercher : pas su', `${c.trop.length + c.vendus.length} à vérifier`, c.doublons.length ? plur(c.doublons.length, 'doublon', 'doublons') : ''].filter(Boolean).join(' · ') : '');
  const blocPrecedents = precedents.length ? (
    <section className="vrm-inv-section vrm-inv-precedents" data-inv-precedents={precedents.length}>
      <h3>Inventaires précédents · {precedents.length}</h3>
      <ul>{precedents.map((p) => { const c = p.constat || null; const fin = Number(p.finAt) || Number(p.debut) || 0; return (
        <li key={p.id} className="vrm-inv-ligne vrm-inv-ligne-bilan" data-inv-precedent={p.id} data-inv-precedent-constat={c ? '1' : '0'}>
          <span className="vrm-inv-ligne-t"><b>{jour(fin)} à {heure(fin)}</b><small>{c ? resumeConstat(c) : `${plur(saisiesVivantes(p).length, 'N° vu', 'N° vus')} · bilan pas gardé (inventaire d’avant le 9 nov.)`}</small></span>
          <span className="vrm-inv-ligne-g"><button type="button" className="vrm-b vrm-b-discret" data-inv-revoir={p.id} onClick={() => setRevoir(p.id)}>Revoir</button></span>
        </li>); })}</ul>
    </section>) : null;
  const sRevoir = revoir ? precedents.find((p) => p.id === revoir) || null : null;
  const listeN = (id, t, l, etat, aide) => (l && l.length ? (
    <section className="vrm-inv-section" data-inv-constat-section={id} data-inv-section-n={l.length}>
      <h3>{t} · {l.length}</h3>{aide ? <p className="vrm-inv-aide">{aide}</p> : null}
      <p className={'vrm-inv-numeros' + (etat === 'doublon' ? ' vrm-inv-double' : '')} data-inv-etat={etat}>{l.map((n) => <span key={n} data-inv-constat-n={n}><Numero n={n} taille="petit" etat={etat === 'doublon' ? 'doublon' : undefined}/></span>)}</p>
    </section>) : null);
  const vueRevoir = sRevoir ? (() => { const c = sRevoir.constat; const fin = Number(sRevoir.finAt) || Number(sRevoir.debut) || 0; return (
    <div className="vrm-inv-bilan" data-inv-vue="revoir" data-inv-revu={sRevoir.id}>
      <p className="vrm-inv-note">Constat du <b>{jour(fin)} à {heure(fin)}</b>{c && c.base ? <> — fait hors connexion, avec la liste des {motsVendeur().noms} du {jour(c.base)} à {heure(c.base)}</> : null}. Tel qu’il était ce jour-là, rien recalculé.</p>
      {c ? (<>
        <div className="vrm-inv-resume">
          <div><b>{c.vus}</b><small>vus</small></div>
          <div><b>{c.su ? c.manque.length : '—'}</b><small>à chercher</small></div>
          <div><b>{c.trop.length}</b><small>à vérifier</small></div>
          <div><b>{c.vendus.length}</b><small>vendus rangés</small></div>
        </div>
        {c.lectures.length ? <p className="vrm-inv-note">Pas lu ce jour-là : <b>{c.lectures.join(', ')}</b> — ses {motsVendeur().noms} n’étaient pas compté{motsVendeur().e}s.</p> : null}
        {listeN('doublons', `Deux ${motsVendeur().noms} sous un même N°`, c.doublons, 'doublon')}
        {listeN('vendus', 'À vérifier — vendues, encore rangées', c.vendus, 'vendu')}
        {listeN('manque', 'À chercher', c.manque, 'manque', 'Attendues, pas vues ce jour-là.')}
        {listeN('trop', 'À vérifier', c.trop, 'trop', 'Vues, mais VRM ne les attendait pas.')}
        {listeN('passu', 'Pas su', c.passu, 'passu')}
        {listeN('aconfirmer', 'À confirmer (lecture ancienne)', c.aConfirmer, 'passu')}
      </>) : listeN('vus', 'N° vus', [...new Set(saisiesVivantes(sRevoir).map((x) => x.k))], 'vu', 'Le bilan de cet inventaire n’a pas été gardé (avant le 9 nov.) : voici seulement ce que tu avais vu.')}
      <div className="vrm-inv-gestes"><button type="button" className="vrm-b vrm-b-secondaire" data-inv-revoir-retour="" onClick={() => setRevoir(null)}>Retour</button></div>
    </div>); })() : null;

  // (9 nov.) Hors connexion : dit UNE fois, en tête — la liste date de quand, et
  // au-delà d'un jour, ambre : des paires ont pu partir ou arriver depuis.
  const ageH = horsLigne && Number.isFinite(horsLigne.at) ? (Date.now() - horsLigne.at) / 3600e3 : null;
  const teteHl = horsLigne ? (<>
    <p className="vrm-inv-hl" role="status" data-inv-hors-ligne={new Date(horsLigne.at).toISOString()}>Hors connexion · liste des {motsVendeur().noms} du {jour(horsLigne.at)} à {heure(horsLigne.at)}. Tes N° partent au retour du réseau.</p>
    {ageH != null && ageH >= 24 ? <p className="vrm-inv-hl-vieux" role="note" data-inv-hl-vieux={Math.floor(ageH)}>Liste de plus d’un jour : refais le bilan avec du réseau.</p> : null}
  </>) : null;

  return (
    <Feuille onClose={onFermer} titre={titre} sousTitre={sous} maxWidth={560} data-inventaire="" data-inventaire-hl={horsLigne ? '' : undefined} className="vrm-inv">
      <div className="vrm-inv-corps">
        {EnTete}
        {teteHl}
        {vueRevoir || (!courant ? accueil : (voirBilan ? vueBilan : saisie))}
        {!vueRevoir && (!courant || voirBilan) ? blocPrecedents : null}
      </div>
    </Feuille>
  );
}

export default InventaireStock;
