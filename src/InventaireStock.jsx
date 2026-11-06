// ════════════════════════════════════════════════════════════════════════════
//  L'INVENTAIRE — Stock → « Inventaire » (6 nov. 2026, vague 1, demande de Julien)
//  Il passe devant ses cartons et tape (ou dit) chaque N° : retour immédiat —
//  vert « attendu », ambre « en trop » ou « vendu, à sortir », rouge SEULEMENT
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
  terminerSession, reprendreSession, enCours, fusionnerInventaire, normaliserInventaire, enregistrerInventaire, inventaireVide,
} from './inventaire.js';
import { requeteDeLaVoix } from './rechercheVocale.js';
import { placeCase } from './stockSortie.js';
import { SegmenteBase } from './composants/Bouton.jsx';
import { Numero } from './composants/Numero.jsx';
import './styles-inventaire.css';

const plur = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
const cleLocale = (owner) => 'vrm_inventaire_local_' + (owner || 'anon');
const lireLocal = (owner) => { try { const v = localStorage.getItem(cleLocale(owner)); return v ? normaliserInventaire(JSON.parse(v)) : inventaireVide(); } catch (_) { return inventaireVide(); } };
const ecrireLocal = (owner, d) => { try { localStorage.setItem(cleLocale(owner), JSON.stringify(d)); } catch (_) {} };
const NOM_PLAT = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
const RAISON_TROP = { archive: 'ancien numéro (archive) : plus une annonce', jamais: 'jamais donné par VRM', plusenligne: 'plus en annonce nulle part' };
const majuscule = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const heure = (t) => { try { return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
const jour = (t) => { try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch (_) { return ''; } };

// Le mot d'un jugement, une règle pour le retour immédiat et la liste.
export function motJugement(j) {
  if (!j) return { t: '', s: '' };
  if (j.etat === 'illisible') return { t: 'Pas un N°', s: 'Tape le numéro écrit sur le carton (125, B125…)' };
  const dbl = j.doublon ? ' · porté par deux paires : vérifie les deux cartons' : '';
  if (j.etat === 'attendu') {
    if (j.raison === 'gardee') return { t: 'Attendu', s: `Tu l’avais gardé « encore là »${dbl}` };
    const u = j.unite || {};
    const ou = (u.plateformes || []).map((x) => NOM_PLAT[x] || x).join(' et ');
    return { t: 'Attendu', s: `${u.titre ? u.titre + ' · ' : ''}${u.etat === 'masquee' ? 'masquée par Vinted, toujours chez toi' : (u.etat === 'aconfirmer' ? 'à confirmer (lecture ancienne) — le voilà' : (ou ? 'en ligne sur ' + ou : 'en ligne'))}${dbl}` };
  }
  if (j.etat === 'vendu') return { t: 'Vendu — à sortir', s: j.parti === true ? `VRM croit le colis déjà parti : vérifie (retour ?)${dbl}` : `Sors-le pour l’envoi${dbl}` };
  if (j.etat === 'trop') return { t: 'En trop', s: `${RAISON_TROP[j.raison] || 'VRM ne l’attend pas'}${dbl}` };
  return { t: 'Pas su', s: `${j.raison === 'ventes' ? 'Tes ventes ne sont pas encore lues : ouvre Ventes une fois' : 'Une lecture manque pour ce N° — je ne dis ni présent ni en trop'}${dbl}` };
}
const etatAffiche = (j, deuxieme = false) => (j && j.etat !== 'illisible' && (j.doublon || deuxieme) ? 'doublon' : (j ? j.etat : ''));

export function InventaireStock({ stock, meubles = [], slots = {}, owner = '', lire, ecrire, onFermer, onFiche, onVoirCase, onSortir, peutSortir, Feuille, Micro = null, confirmer, nomsComptes = null, cle }) {
  const [data, setData] = React.useState(() => lireLocal(owner));
  const dataRef = React.useRef(data);
  const [sync, setSync] = React.useState('lecture');   // lecture · ok · envoi · ko
  const [texte, setTexte] = React.useState('');
  const [lettres, setLettres] = React.useState(false);
  const [dernier, setDernier] = React.useState(null);  // { s, j, deja?, sid? }
  const [vue, setVue] = React.useState('auto');        // auto · bilan
  const [modeCase, setModeCase] = React.useState(false);
  const [caseIdx, setCaseIdx] = React.useState(0);
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
      if (reste) encore.current = true;
    } else if (vivant.current) setSync('ko');
    if (encore.current) { encore.current = false; if (vivant.current) { clearTimeout(minuteur.current); minuteur.current = setTimeout(() => synchroniser(), 400); } else synchroniser(); }
  }, [lire, ecrire, owner]);
  React.useEffect(() => {
    vivant.current = true; synchroniser();
    return () => { vivant.current = false; if (minuteur.current) { clearTimeout(minuteur.current); minuteur.current = null; synchroniser(); } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const changer = (f) => {
    const next = f(dataRef.current); if (next === dataRef.current) return;
    dataRef.current = next; setData(next); ecrireLocal(owner, next);
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
    if (j.etat === 'illisible') { setDernier({ s: t, j }); return; }
    const deja = vivantes.find((x) => x.k === j.k);
    if (deja && !deuxieme) { setDernier({ s: t, j, deja }); return; }
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
    changer((d) => ({ ...d, courant: terminerSession(d.courant) })); setVue('bilan');
  };
  const reprendre = () => { changer((d) => ({ ...d, courant: reprendreSession(d.courant) })); setVue('auto'); setTimeout(() => { try { champ.current && champ.current.focus(); } catch (_) {} }, 60); };
  const voix = (t) => { const r = requeteDeLaVoix(t); if (r.numero) valider(r.requete); else setDernier({ s: String(t || ''), j: { etat: 'illisible' } }); };

  // ── ce qui manque aux lectures, NOMMÉ (pas su ≠ manque) ─────────────────────
  const lectures = stock && Array.isArray(stock.manque) ? stock.manque : [];
  const lecturesTxt = lectures.map((m) => (m.plateforme === 'vinted' ? `${m.nom} sur Vinted` : m.nom) + (m.raison ? ` (${m.raison})` : '')).join(', ');
  const etatSync = sync === 'ko' ? <p className="vrm-inv-sync" data-inv-sync="ko">Pas encore enregistré dans le nuage : {plur(vivantes.length, 'saisie gardée', 'saisies gardées')} sur cet appareil, renvoyée{vivantes.length > 1 ? 's' : ''} au prochain geste.</p>
    : <p className="vrm-inv-sync" data-inv-sync={sync}>{sync === 'lecture' ? 'Je relis ton inventaire…' : (sync === 'envoi' ? 'Enregistrement…' : 'Enregistré — tu peux fermer l’app, tu reprendras ici.')}</p>;

  // ── rendu ──────────────────────────────────────────────────────────────────
  const voirBilan = vue === 'bilan' || (courant && !ouvert);
  const titre = 'Inventaire';
  const sous = courant ? (ouvert ? `Commencé le ${jour(courant.debut)} à ${heure(courant.debut)}` : `Terminé le ${jour(courant.finAt)} à ${heure(courant.finAt)}`) : 'Tes cartons, un par un';

  const ligneVue = (x) => {
    const j = jugerSaisie(x.k, stock, { index, cle }); const m = motJugement(j); const et = etatAffiche(j, x.d);
    return (
      <li key={x.sid} className={'vrm-inv-ligne' + (et === 'doublon' ? ' vrm-inv-double' : '')} data-inv-ligne={x.k} data-inv-etat={et}>
        <Numero n={x.k} taille="petit" etat={et === 'doublon' ? 'doublon' : undefined}/>
        <span className="vrm-inv-ligne-t"><b>{x.d ? '2ᵉ carton · ' : ''}{m.t}</b>{x.c ? <small> · {nomCase(x.c)}</small> : null}</span>
        <span className="vrm-inv-point" aria-hidden="true"/>
      </li>
    );
  };

  const accueil = (
    <div className="vrm-inv-accueil" data-inv-vue="accueil">
      <p className="vrm-inv-intro">Passe devant tes cartons et tape chaque N° que tu vois. Je te dis tout de suite s’il est <b>attendu</b>, <b>en trop</b> ou <b>vendu</b> ; à la fin, ce qui <b>manque</b>. Aucun numéro n’est changé.</p>
      {stock === undefined ? <p className="vrm-inv-note" data-inv-lecture="encours">Je lis tes annonces…</p>
        : (!stock || !stock.su ? <p className="vrm-inv-note" data-inv-lecture="passu">Je n’ai pas pu lire tes annonces{lecturesTxt ? ` (${lecturesTxt})` : ''} : sans elles, je ne peux rien dire de ce qui manque. Ouvre Vinted avec l’extension, puis reviens.</p>
          : <p className="vrm-inv-note" data-inv-lecture="ok" data-inv-attendus={index ? index.unites.length : 0}>{plur(index ? index.unites.length : 0, 'paire attendue', 'paires attendues')} en stock{lecturesTxt ? <> · <b>pas lu : {lecturesTxt}</b> — ses paires ne comptent pas</> : null}.</p>)}
      <button type="button" className="vrm-b vrm-b-primaire vrm-inv-large" data-inv-commencer="" disabled={sync === 'lecture' || stock === undefined} onClick={commencer}>Commencer l’inventaire</button>
      {sync === 'lecture' ? etatSync : (sync === 'ko' ? <p className="vrm-inv-sync" data-inv-sync="ko">Je n’ai pas pu relire ton inventaire : un inventaire commencé sur un autre appareil n’apparaît pas encore ici.</p> : null)}
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
                <small>{noteesIci.length ? <>Notées ici : {noteesIci.map((k) => <span key={k} data-inv-notee={k} data-inv-notee-vue={vusCles.has(k) ? '1' : '0'} className="vrm-inv-notee">N°{k}{vusCles.has(k) ? ' ✓' : ''}</span>)}</> : 'Aucune paire notée dans cette case'}</small></span>
              <button type="button" className="vrm-inv-pas" aria-label="Case suivante" data-inv-case-suivante="" disabled={caseIdx >= cases.length - 1} onClick={() => setCaseIdx((i) => Math.min(cases.length - 1, i + 1))}>›</button>
            </div>
          )}
        </div>
      )}
      {(() => { const etR = dernier ? (dernier.annule ? 'annule' : (dernier.deja ? 'deja' : etatAffiche(dernier.j, dernier.deuxieme))) : 'vide'; return (
      <div className={'vrm-inv-retour' + (etR === 'doublon' ? ' vrm-inv-double' : '')} role="status" aria-live="polite" data-inv-retour={etR}>
        {!dernier ? <span className="vrm-inv-retour-vide">Tape le premier N°</span>
          : dernier.annule ? <><span className="vrm-inv-retour-n">N°{dernier.s}</span><span className="vrm-inv-retour-t">Annulé</span><span className="vrm-inv-retour-s">Il n’est plus compté</span></>
          : dernier.deja ? <><span className="vrm-inv-retour-n">N°{dernier.j.k}</span><span className="vrm-inv-retour-t">Déjà compté</span><span className="vrm-inv-retour-s">à {heure(dernier.deja.at)} — même carton, rien à faire.</span>
              <button type="button" className="vrm-b vrm-b-secondaire" data-inv-deuxieme={dernier.j.k} onClick={() => valider(dernier.j.k, { deuxieme: true })}>C’est un 2ᵉ carton N°{dernier.j.k}</button></>
          : (() => { const m = motJugement(dernier.j); return <><span className="vrm-inv-retour-n">{dernier.j.etat === 'illisible' ? `« ${dernier.s} »` : `N°${dernier.j.k}`}</span><span className="vrm-inv-retour-t">{dernier.deuxieme ? 'Deux cartons sous ce N°' : m.t}</span><span className="vrm-inv-retour-s">{dernier.deuxieme ? 'Deux paires sous un même numéro : la mauvaise peut partir. Ouvre sa fiche après l’inventaire.' : m.s}{dernier.ailleurs ? ` · noté dans ${nomCase(dernier.ailleurs)}` : ''}{!dernier.ailleurs && !dernier.deuxieme && dernier.j.etat === 'vendu' && slots && slots[dernier.j.k] ? ` · ${nomCase(String(slots[dernier.j.k].m) + ':' + Number(slots[dernier.j.k].i))}` : ''}</span></>; })()}
      </div>); })()}
      <form className="vrm-inv-champ" onSubmit={(e) => { e.preventDefault(); valider(texte); }}>
        <input ref={champ} value={texte} onChange={(e) => setTexte(e.target.value)} inputMode={lettres ? 'text' : 'numeric'} pattern={lettres ? undefined : '[0-9]*'}
          autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done" maxLength={12}
          placeholder={lettres ? 'B125' : 'N°'} aria-label="Numéro écrit sur le carton" data-inv-champ=""/>
        <button type="button" className="vrm-inv-abc" aria-pressed={lettres} onClick={() => { setLettres((x) => !x); setTimeout(() => { try { champ.current && champ.current.focus(); } catch (_) {} }, 30); }} title="Un N° avec une lettre (B125)">{lettres ? '123' : 'ABC'}</button>
        <button type="submit" className="vrm-b vrm-b-primaire vrm-inv-ok" data-inv-valider="" disabled={!texte.trim()}>OK</button>
      </form>
      <div className="vrm-inv-gestes">
        <button type="button" className="vrm-b vrm-b-secondaire" data-inv-annuler="" disabled={!vivantes.length} onClick={annuler}>{vivantes.length ? `Annuler N°${vivantes[vivantes.length - 1].k}` : 'Annuler le dernier'}</button>
        {Micro ? <Micro titre="Dire le N° (« numéro 125 », « B 125 »)" onText={voix}/> : null}
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
        <div data-inv-ton={bilan.manque.length ? 'geste' : ''}><b>{bilan.su ? bilan.manque.length : '—'}</b><small>manquent</small></div>
        <div data-inv-ton={bilan.trop.length ? 'geste' : ''}><b>{bilan.trop.length}</b><small>en trop</small></div>
        <div data-inv-ton={bilan.vendus.length ? 'geste' : ''}><b>{bilan.vendus.length}</b><small>vendus rangés</small></div>
      </div>
      {!bilan.su ? <p className="vrm-inv-note" data-inv-lecture="passu">Je n’ai pas pu lire tes annonces : je ne dis pas ce qui manque.</p> : null}
      {(lectures.length > 0 || bilan.aConfirmer.length > 0) && <p className="vrm-inv-note" data-inv-lectures-manquent="">
        {lectures.length ? <>Pas lu : <b>{lecturesTxt}</b> — ses paires ne sont pas comptées comme manquantes. </> : null}
        {bilan.aConfirmer.length ? <>{plur(bilan.aConfirmer.length, 'annonce', 'annonces')} « à confirmer » (lecture de plus de 24 h) pas vue{bilan.aConfirmer.length > 1 ? 's' : ''} : {bilan.aConfirmer.slice(0, 6).map((u) => 'N°' + u.numero).join(', ')}{bilan.aConfirmer.length > 6 ? '…' : ''} — repasse sur Vinted avec ce compte, puis refais le tour. </> : null}
      </p>}
      {section('doublons', 'Deux paires sous un même N°', bilan.doublons, (v) => ligneBilan(v.k, v.k, 'doublon', v.raison === 'cartons' ? 'Deux cartons portent ce N°' : 'Porté par deux paires dans VRM', 'La mauvaise paire peut partir : ouvre la fiche et corrige avant d’expédier.', gesteFiche(v.k)), null)}
      {section('vendus', 'Vendues, encore rangées', bilan.vendus, (v) => ligneBilan(v.k, v.k, 'vendu', v.jugement.parti === true ? 'Colis parti selon VRM' : 'À sortir pour l’envoi', [v.jugement.unite && v.jugement.unite.titre, v.jugement.parti === true ? 'vérifie : retour, ou mauvais carton ?' : placeDe(v.k)].filter(Boolean).join(' · '),
        <>{onSortir && peutSortir && peutSortir(v.k) ? <button type="button" className="vrm-b vrm-b-secondaire" data-inv-sortir={v.k} onClick={() => onSortir(v.k)}>Je l’ai sortie</button> : null}{gesteFiche(v.k)}</>), 'Prouvées vendues : sors-les du carton pour l’envoi.')}
      {section('manque', 'Manquent', bilan.manque, (u) => ligneBilan(u.cles[0], u.numero, 'manque', u.titre || 'Sans titre lu', [u.source === 'gardee' ? 'tu l’avais gardée « encore là »' : (u.plateformes || []).map((x) => NOM_PLAT[x] || x).join(' et '), comptes(u), placeDe(u.cles[0]) ? 'notée : ' + placeDe(u.cles[0]) : ''].filter(Boolean).join(' · '),
        <>{onVoirCase && slots && slots[u.cles[0]] ? <button type="button" className="vrm-b vrm-b-discret" data-inv-voir-case={u.cles[0]} onClick={() => onVoirCase(u.cles[0])}>Voir la case</button> : null}{gesteFiche(u.numero)}</>), 'Attendues en stock, pas vues : cherche le carton, ou ouvre la fiche (vendue ailleurs ? perdue ?).')}
      {section('trop', 'En trop', bilan.trop, (v) => ligneBilan(v.k, v.k, 'trop', majuscule(RAISON_TROP[v.jugement.raison] || 'VRM ne l’attend pas'), v.cases.length ? 'vu dans ' + v.cases.map(nomCase).join(', ') : '', gesteFiche(v.k)), 'Vues sur un carton, mais pas en annonce : remets-les en vente, ou sors-les.')}
      {section('passu', 'Pas su', bilan.passu, (v) => ligneBilan(v.k, v.k, 'passu', motJugement(v.jugement).s, '', gesteFiche(v.k)), null)}
      {section('place', 'Pas dans leur case', bilan.pasASaPlace, (v) => ligneBilan(v.k, v.k, 'place', 'Vue dans ' + v.cases.map(nomCase).join(', '), 'notée dans ' + nomCase(v.notee.m + ':' + v.notee.i), onVoirCase ? <button type="button" className="vrm-b vrm-b-discret" data-inv-voir-case={v.k} onClick={() => onVoirCase(v.k)}>Voir la case</button> : null), null)}
      {bilan.vendusNonVus.length > 0 && <p className="vrm-inv-note" data-inv-vendus-non-vus={bilan.vendusNonVus.length}>{plur(bilan.vendusNonVus.length, 'vente à envoyer', 'ventes à envoyer')} pas vue{bilan.vendusNonVus.length > 1 ? 's' : ''} : N°{bilan.vendusNonVus.slice(0, 8).join(', N°')}{bilan.vendusNonVus.length > 8 ? '…' : ''} — déjà emballée{bilan.vendusNonVus.length > 1 ? 's' : ''} ?</p>}
      {bilan.attendus.length > 0 && <p className="vrm-inv-note" data-inv-attendus-vus={bilan.attendus.length}>{plur(bilan.attendus.length, 'paire attendue vue', 'paires attendues vues')} : tout va bien pour elle{bilan.attendus.length > 1 ? 's' : ''}.</p>}
      {bilan.sansNumero > 0 && <p className="vrm-inv-note">{plur(bilan.sansNumero, 'annonce', 'annonces')} sans N° : l’inventaire ne peut pas les vérifier (donne-leur un N° dans Annonces).</p>}
      <div className="vrm-inv-gestes">
        {!ouvert ? <button type="button" className="vrm-b vrm-b-secondaire" data-inv-reprendre="" onClick={reprendre}>Reprendre cet inventaire</button> : <button type="button" className="vrm-b vrm-b-secondaire" onClick={() => setVue('auto')}>Continuer la saisie</button>}
        <span style={{ flex: 1 }}/>
        {!ouvert ? <button type="button" className="vrm-b vrm-b-primaire" data-inv-nouveau="" onClick={async () => { const ok = confirmer ? await confirmer({ title: 'Commencer un nouvel inventaire ?', desc: 'Celui-ci est gardé (les 3 derniers).', ok: 'Commencer', cancel: 'Annuler' }) : true; if (ok) commencer(); }}>Nouvel inventaire</button> : null}
      </div>
      {etatSync}
    </div>
  ) : (courant ? <p className="vrm-inv-note">Je lis tes annonces…</p> : null);

  return (
    <Feuille onClose={onFermer} titre={titre} sousTitre={sous} maxWidth={560} data-inventaire="" className="vrm-inv">
      <div className="vrm-inv-corps">
        {!courant ? accueil : (voirBilan ? vueBilan : saisie)}
      </div>
    </Feuille>
  );
}

export default InventaireStock;
