// ── AVANT DE PUBLIER : « Relier à un achat » · « Prix minimum accepté » (28 nov.) — la règle : src/publier/avantPublier.js ──
// Deux rangées, posées AVANT « Publier » sur chaque chemin de publication de l'app (Préparer, le dossier « À publier »,
// « Publier aussi sur… ») et sur la fiche de la paire. Rien ne relie sans SON toucher ; le prix mini n'est jamais
// pré-rempli ; un chiffre suspect (sous l'achat, ×10 / ÷10) demande SA confirmation du chiffre (la garde du prix).
// Composants natifs ; une phrase visible par bloc, le reste sous « Pourquoi ? » ; tout texte par tr().
import React from 'react';
import { Feuille, Groupe, Rangee, Vignette, Bouton, Champ, Pourquoi, ChampRecherche } from '../natif/index.js';
import { tr } from '../i18n/index.js';
import { etatAchat, achatsARelier, ecritureLien, indiceMini, verifierMini, ligneOffres } from './avantPublier.js';
import { lireOutilsAchat, ecouterOutilsAchat } from './outilsAchat.js';
import '../depot/preparer.css';   // (28 nov.) les styles du dépôt, étendus (aucun nouveau fichier CSS)

const eurC = (c) => (Number.isSafeInteger(c) ? `${(c / 100).toFixed(c % 100 ? 2 : 0).replace('.', ',')} €` : '—');
const jour = (d) => { const t = Date.parse(d || ''); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
const prixAchatC = (a) => { const n = Number(a && a.price && typeof a.price === 'object' ? a.price.amount : a && a.price); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };

export function useOutilsAchat() {
  const [o, setO] = React.useState(() => lireOutilsAchat());
  React.useEffect(() => ecouterOutilsAchat(setO), []);
  return o;
}

// Le texte de l'état de l'achat (une phrase courte).
export function texteAchat(e) {
  if (!e) return tr('ap.achat.aucun');
  if (e.etat === 'recu') return tr('ap.achat.recu', { prix: eurC(e.centimes) });
  if (e.etat === 'saisi') return tr('ap.achat.saisi', { prix: eurC(e.centimes) });
  if (e.etat === 'lot') return tr('ap.achat.lot');
  if (e.etat === 'a-saisir') return tr('ap.achat.aSaisir');
  return tr('ap.achat.aucun');
}
export function texteOffres(l) {
  if (!l) return '';
  return tr(l.cle, { prix: eurC(l.vars.c), min: eurC(l.vars.min) });
}

// LE BLOC. `fiche` : l'article (fiche d'annonce ou brouillon) — lu, jamais modifié ici. `prixC` : son prix.
// `onRelier()` ouvre la feuille ; `onMini(c | null)` écrit (c en centimes) — rend false si rien n'est écrit.
// `confirmer({ titre, desc, ok })` → Promise<bool> (askConfirm de l'app) ; `reglages` : { autoAccepte, paliers, agentActif }.
export function BlocAvantPublier({ fiche, prixC = null, onRelier = null, onMini = null, confirmer = null, reglages = null, attrs = null, titre = '' }) {
  const e = etatAchat(fiche);
  const miniLu = (() => { const n = Number(String((fiche && fiche.min) == null ? '' : fiche.min).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; })();
  const [texte, setTexte] = React.useState(() => (miniLu != null ? String(miniLu / 100).replace('.', ',') : ''));
  const [dit, setDit] = React.useState('');
  React.useEffect(() => { setTexte(miniLu != null ? String(miniLu / 100).replace('.', ',') : ''); }, [miniLu]);
  const indice = indiceMini(e.centimes);
  const R = reglages || {};
  const offres = ligneOffres({ miniC: miniLu, prixC, autoAccepte: !!R.autoAccepte, paliers: R.paliers || null, agentActif: !!R.agentActif });
  const enregistrer = async () => {
    setDit('');
    const v = verifierMini(texte, { prixC, achatC: e.centimes });
    if (v.etat === 'vide') { if (miniLu != null && onMini) { const ok = await onMini(null); if (ok === false) setDit(tr('ap.mini.pasEcrit')); } return; }
    if (v.etat === 'illisible') { setDit(tr('ap.mini.illisible')); return; }
    if (v.etat === 'refuse') { setDit(tr(v.raisons.includes('au-dessus') ? 'ap.mini.auDessus' : 'ap.mini.zero')); return; }
    if (v.etat === 'confirmer') {
      const raison = v.raisons.includes('frappe') ? tr('ap.mini.frappe', { prix: eurC(prixC) }) : tr('ap.mini.sousAchat', { achat: eurC(e.centimes) });
      const ok = confirmer ? await confirmer({ titre: tr('ap.mini.confirmerTitre', { prix: eurC(v.c) }), desc: raison, ok: tr('ap.mini.confirmerOk', { prix: eurC(v.c) }) }) : false;
      if (ok !== true) return;
      const v2 = verifierMini(texte, { prixC, achatC: e.centimes, confirmeC: v.c });
      if (v2.etat !== 'ok') return;
    }
    if (!onMini) return;
    const r = await onMini(v.c);
    if (r === false) setDit(tr('ap.mini.pasEcrit'));
  };
  return (
    <Groupe titre={titre || tr('ap.titre')} attrs={{ 'data-avant-publier': '', 'data-ap-achat': e.etat, 'data-ap-achat-c': e.centimes == null ? '' : String(e.centimes), 'data-ap-mini': miniLu == null ? '' : String(miniLu), 'data-ap-offres': offres.cle, ...(attrs || {}) }}>
      <Rangee titre={tr('ap.achat.titre')} sousTitre={texteAchat(e)} fin={onRelier ? 'chevron' : null} onClick={onRelier || null}
        attrs={{ 'data-ap-relier': e.relie ? String(e.tx || '') : '' }}/>
      <div className="ap-mini">
        <Champ libelle={tr('ap.mini.titre')} valeur={texte} onChange={(t) => setTexte(t)} inputMode="decimal" suffixe="€" placeholder={tr('ap.mini.vide')}
          attrs={{ 'data-ap-mini-champ': '', 'aria-describedby': undefined, onKeyDown: (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); enregistrer(); } } }}/>
        <Bouton variante="teinte" onClick={enregistrer} indisponible={!onMini} attrs={{ 'data-ap-mini-ok': '' }}>{tr('ap.mini.ok')}</Bouton>
      </div>
      <p className="ap-offres" data-ap-offres-ligne={offres.cle}>{texteOffres(offres)}</p>
      {dit ? <p className="ap-dit" role="status" data-ap-dit="">{dit}</p> : null}
      <div className="ap-pourquoi"><Pourquoi attrs={{ 'data-ap-pourquoi': '' }}>
        {indice != null ? <span data-ap-indice={String(indice)}>{tr('ap.mini.indice', { prix: eurC(indice) })} </span> : <span data-ap-indice="">{tr('ap.mini.sansIndice')} </span>}
        {tr('ap.mini.pourquoi')}
      </Pourquoi></div>
    </Groupe>
  );
}

// LA FEUILLE « Relier à un achat » : en tête les suggestions (ressemblance, jamais reliées seules), puis TOUS ses achats pas
// encore reliés, du plus récent au plus ancien ; SON toucher choisit, « Relier » relie (`onRelier(lien, achat)`).
// `cible` : { titre, marque, taille, couleur, dateRef } pour les suggestions (facultatif) ; `outils` : src/publier/outilsAchat.js.
export function RelierAchatFeuille({ outils, cible = null, onRelier, onFermer, Photo = null }) {
  const [achats, setAchats] = React.useState(undefined);
  const [choisi, setChoisi] = React.useState('');
  const [q, setQ] = React.useState('');
  React.useEffect(() => { let mort = false; if (!outils || typeof outils.charger !== 'function') { setAchats(null); return undefined; }
    Promise.resolve(outils.charger()).then((l) => { if (!mort) setAchats(Array.isArray(l) ? l : null); }).catch(() => { if (!mort) setAchats(null); });
    return () => { mort = true; }; }, [outils]);
  const r = React.useMemo(() => (Array.isArray(achats) ? achatsARelier({ cible, achats, liens: outils && outils.liens, marqueDe: outils && outils.marqueDe, couleursDe: outils && outils.couleursDe, modeleDe: outils && outils.modeleDe }) : null), [achats, cible, outils]);
  const filtre = (l) => { const m = String(q || '').toLowerCase().trim(); return m ? l.filter((a) => String(a.title || '').toLowerCase().includes(m)) : l; };
  const tous = r ? [...r.suggestions, ...r.libres] : [];
  const a = tous.find((x) => String(x.transaction_id) === choisi) || null;
  const relier = async () => {
    if (!a || !onRelier) return;
    let prop = null; try { prop = outils && typeof outils.proposition === 'function' ? outils.proposition(a) : null; } catch (_) { prop = null; }
    const lien = ecritureLien(a, { proposition: prop, accNom: outils && outils.accNom ? outils.accNom(a) : '', photo: outils && outils.photoDe ? outils.photoDe(a) || '' : '', estLot: outils && outils.estLot ? !!outils.estLot(a) : null });
    if (!lien) return;
    const ok = await onRelier(lien, a);
    if (ok !== false) onFermer && onFermer();
  };
  const ligne = (x, sugg) => {
    const tx = String(x.transaction_id);
    const ph = outils && outils.photoDe ? outils.photoDe(x) : '';
    return <Rangee key={tx} titre={x.title || '—'} lignes={2} sousTitre={[jour(x.date), eurC(prixAchatC(x))].filter(Boolean).join(' · ')} valeur={null}
      vignette={<Vignette src={ph || ''} taille={44}/>} fin={choisi === tx ? 'coche' : null} selectionnee={choisi === tx}
      onClick={() => setChoisi(choisi === tx ? '' : tx)} attrs={{ 'data-ap-achat-choix': tx, 'data-ap-suggestion': sugg ? '' : undefined, 'aria-pressed': choisi === tx ? 'true' : 'false' }}/>;
  };
  return (
    <Feuille ouverte onFermer={onFermer} titre={tr('ap.feuille.titre')} detente="pleine" attrs={{ 'data-ap-feuille': achats === undefined ? 'lecture' : achats === null ? 'pas-su' : String(tous.length) }}
      pied={<Bouton variante="plein" large onClick={relier} indisponible={!a} raison={a ? '' : tr('ap.feuille.choisis')} attrs={{ 'data-ap-relier-ok': choisi }}>{tr('ap.feuille.relier')}</Bouton>}>
      <ChampRecherche valeur={q} onChange={setQ} placeholder={tr('ap.feuille.chercher')}/>
      {achats === undefined ? <Groupe><Rangee titre={tr('ap.feuille.lecture')}/></Groupe>
        : achats === null ? <Groupe><Rangee titre={tr('ap.feuille.pasSu')}/></Groupe>
        : <>
          {r.suggestions.length && !q ? <Groupe titre={tr('ap.feuille.suggestions')} pied={tr('ap.feuille.suggestionsPied')} attrs={{ 'data-ap-suggestions': String(r.suggestions.length) }}>{r.suggestions.map((x) => ligne(x, true))}</Groupe> : null}
          <Groupe titre={tr('ap.feuille.tous', { n: String(filtre(r.libres).length) })} attrs={{ 'data-ap-libres': String(r.libres.length) }}>
            {filtre(q ? tous : r.libres).length ? filtre(q ? tous : r.libres).slice(0, 120).map((x) => ligne(x, false)) : <Rangee titre={tr('ap.feuille.aucun')}/>}
          </Groupe>
        </>}
    </Feuille>
  );
}

// Les réglages des moteurs, lus par l'appelant (la clé superposée de la ligne `vrm_reglages_auto`) : ce que la ligne
// « Offres » dit. `lire(k, d)` : `load` de l'app.
export function reglagesOffres(lire, bleamDe = null) {
  try {
    const autoAccepte = lire('vinted_offres_auto', false) === true;
    const paliers = lire('vinted_offres_paliers', null);
    let agentActif = false;
    const b = lire('vinted_bleam', null);
    if (b && b.comptes && typeof b.comptes === 'object' && typeof bleamDe === 'function') for (const uid of Object.keys(b.comptes)) { try { if (bleamDe(b, uid).agent.actif) agentActif = true; } catch (_) {} }
    return { autoAccepte, paliers, agentActif };
  } catch (_) { return { autoAccepte: false, paliers: null, agentActif: false }; }
}
