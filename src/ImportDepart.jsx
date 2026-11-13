// ═══════════════════════════════════════════════════════════════════════════
// « TON HISTORIQUE VINTED » (11 nov., lot import-depart, extension 5.344)
// Règles et textes : src/importDepart.js. Deux places :
//   · Ma journée (`variante="journee"`) : une barre fine par compte en cours,
//     en pause, arrêté, ou fini depuis moins d'un jour. Rien sinon.
//   · Paramètres → Mes comptes (`variante="reglages"`) : chaque compte Vinted,
//     son état, et « Tout récupérer » pour le compte ouvert sur vinted.fr.
// Une lecture projetée (jamais `select=data`), relue quand l'extension le dit
// (`vrm:ext` quoi='import'), au retour sur l'écran, et chaque minute en cours.
// 5.373 (13 nov., lot 47) — « Import de ton passé » : la tête dit
// « Import de ton passé · 340 / ~1 200 ventes · compte X », chaque type sa barre
// (sur l'estimation) et « 4 pages sur ~12 », les annonces une ligne, le souci
// ou la pause « suite dans 40 min ». Fini ⇒ « Ton passé est importé (12 mois) »
// UNE fois sur Ma journée (marqué vu, synchronisé).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { typeEnTete, lireImportDepart, importsAMontrer, phraseImport, texteType, pctType, butType, pagesType, titreImport, texteAnnonces, marquerImportsVus, CLE_IMPORT_VU } from './importDepart.js';
import { lireTout, load, save, vintedDeChrome, raisonExtGlobale, onVmrExt, vmrCmd, vmrExtPresent, extSait, Bouton } from './App.jsx';
import './styles-import-depart.css';

function useImportDepart(uids) {
  const cle = (uids || []).join(',');
  const [etats, setEtats] = React.useState(undefined);
  const [tour, setTour] = React.useState(0);
  React.useEffect(() => {
    let mort = false;
    (async () => {
      const r = await lireImportDepart(cle ? cle.split(',') : [], lireTout);
      if (!mort) setEtats(r);
    })();
    return () => { mort = true; };
  }, [cle, tour]);
  React.useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && d.type === 'maj' && d.quoi === 'import') setTour((t) => t + 1); };
    const vis = () => { if (document.visibilityState === 'visible') setTour((t) => t + 1); };
    // (11 nov., temps réel) La veille a vu une ligne `import_vinted_*` changer (src/tempsReel.js).
    const neuf = (e) => { const d = e && e.detail; if (d && Array.isArray(d.quoi) && d.quoi.some((q) => q.quoi === 'import')) setTour((t) => t + 1); };
    window.addEventListener('vrm:ext', f);
    window.addEventListener('vrm:neuf', neuf);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('vrm:ext', f); window.removeEventListener('vrm:neuf', neuf); document.removeEventListener('visibilitychange', vis); };
  }, []);
  const enCours = etats && Object.values(etats).some((l) => l && (l.etat === 'encours' || l.etat === 'attente' || l.etat === 'pause'));
  React.useEffect(() => {
    if (!enCours) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') setTour((x) => x + 1); }, 60000);
    return () => clearInterval(t);
  }, [enCours]);
  return [etats, () => setTour((t) => t + 1)];
}

// 5.373 : `dejaDit` — le chiffre est déjà dans la tête (« 340 / ~1 200 ventes ») : la ligne ne
// le redit pas (§7, un nombre une fois), elle dit les pages à sa place.
function Barre({ t, nom, dejaDit = false }) {
  const pc = pctType(t);
  const but = butType(t);
  const pages = pagesType(t);
  return (
    <div className="vrm-imp-type" data-import-type={nom} data-import-lus={t ? t.lus : ''} data-import-total={t && t.total !== null ? t.total : ''} data-import-estime={t && t.estime ? t.estime : ''}
      data-import-pages={t ? t.pages : ''} data-import-pages-estimees={t && t.pagesEstimees ? t.pagesEstimees : ''} data-import-fini={t && t.fini ? '1' : '0'}>
      <div className="vrm-imp-type-l">
        <span>{nom === 'ventes' ? 'Ventes' : 'Achats'}</span>
        {dejaDit
          ? <span className="vrm-imp-chiffre" data-import-pages-texte="">{pages || ''}</span>
          : <span className="vrm-imp-chiffre">{texteType(t, { suivant: nom === 'achats' })}</span>}
      </div>
      {pc !== null && !(t && t.fini) ? (
        <div className="vrm-imp-barre" role="progressbar" aria-label={nom === 'ventes' ? 'Ventes récupérées' : 'Achats récupérés'} aria-valuemin={0} aria-valuemax={but} aria-valuenow={Math.min(t.lus, but)}>
          <i style={{ width: `${Math.max(2, pc)}%` }} />
        </div>
      ) : null}
      {pages && !dejaDit ? <span className="vrm-imp-pages" data-import-pages-texte="">{pages}</span> : null}
    </div>
  );
}

// 5.373 : les annonces (lecture complète du dressing, d'un trait).
function LigneAnnonces({ a }) {
  if (!a) return null;
  return (
    <div className="vrm-imp-type" data-import-type="annonces" data-import-lus={a.lus} data-import-total={a.total !== null ? a.total : ''} data-import-fini={a.fini ? '1' : '0'} data-import-partiel={a.partiel ? '1' : '0'}>
      <div className="vrm-imp-type-l">
        <span>Annonces</span>
        <span className="vrm-imp-chiffre">{texteAnnonces(a)}</span>
      </div>
      {a.partiel ? <span className="vrm-imp-pages">Trop d’annonces pour une lecture d’un trait : la visite lit les 1 000 premières.</span> : null}
    </div>
  );
}

function Compte({ l, nom, montrerNom }) {
  const passe = !!(l.horizonMois || l.annonces);
  const geste = l.etat === 'arrete' || l.souci === 'deconnecte';
  // La tête dit le chiffre du type en cours ; fini, la phrase dit tout (un texte une fois, §7).
  const titre = passe && l.etat !== 'fini';
  const enTete = titre ? typeEnTete(l) : null;
  return (
    <div className="vrm-imp-compte" data-import-compte={l.uid} data-import-etat={l.etat} data-import-souci={l.souci || ''} data-import-horizon={l.horizonMois || ''}>
      {titre ? <div className="vrm-imp-titre-compte" data-import-titre="">{titreImport(l, montrerNom ? nom : '')}</div> : null}
      <div className="vrm-imp-tete">
        {montrerNom && !titre ? <span className="vrm-imp-nom">{nom}</span> : null}
        <span className="vrm-imp-phrase" data-ton={geste ? 'geste' : undefined}>{phraseImport(l)}</span>
      </div>
      <Barre t={l.ventes} nom="ventes" dejaDit={enTete === 'ventes'} />
      <Barre t={l.achats} nom="achats" dejaDit={enTete === 'achats'} />
      <LigneAnnonces a={l.annonces} />
    </div>
  );
}

const nomDe = (comptes, labels, uid) => {
  const a = (comptes || []).find((x) => String(x && x.vinted_user_id) === String(uid));
  return labels[uid] || (a && a.login) || `Compte ${uid}`;
};

export default function ImportDepart({ comptes = [], variante = 'journee' }) {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => onVmrExt(force), []);
  const uids = (comptes || []).map((a) => String((a && a.vinted_user_id) || '')).filter((u) => /^\d{1,20}$/.test(u));
  const [etats, relire] = useImportDepart(uids);
  const [occupe, setOccupe] = React.useState(false);
  const [issue, setIssue] = React.useState(null);
  const labels = load('vinted_account_labels', {}) || {};

  // 5.373 : ce qui était déjà VU à l'ouverture de l'écran (le message de fin reste
  // sous les yeux pendant cette visite, puis ne revient plus).
  const [vusOuverture] = React.useState(() => load(CLE_IMPORT_VU, {}) || {});
  const montres = variante === 'journee' ? importsAMontrer(etats, Date.now(), vusOuverture) : [];
  const cleMontres = montres.map((l) => `${l.uid}:${l.etat}:${l.fin || ''}`).join(',');
  React.useEffect(() => {
    if (variante !== 'journee' || !montres.length) return;
    const neuf = marquerImportsVus(load(CLE_IMPORT_VU, {}) || {}, montres);
    if (neuf) save(CLE_IMPORT_VU, neuf);
  }, [cleMontres]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (variante === 'journee') {
    if (!montres.length) return null;
    const passe = montres.some((l) => l.horizonMois || l.annonces);
    return (
      <section className="vrm-imp vrm-imp-journee" data-import-journee={montres.length} aria-label={passe ? 'Import de ton passé' : 'Ton historique Vinted'}>
        {passe ? null : <div className="vrm-imp-titre">Ton historique Vinted</div>}
        {montres.map((l) => <Compte key={l.uid} l={l} nom={nomDe(comptes, labels, l.uid)} montrerNom={uids.length > 1} />)}
      </section>
    );
  }

  const vc = vintedDeChrome();
  const onglet = vc ? String(vc.uid || '') : null;
  const rx = raisonExtGlobale(false, { cap: 'importdepart', role: 'récupère ton historique Vinted' });
  const sait = extSait('importdepart');
  const lancer = async (uid) => {
    if (occupe || rx) return;
    setOccupe(true);
    setIssue({ uid, texte: 'C’est parti…' });
    let r = null;
    if (!vmrExtPresent()) r = { accepte: false, raison: 'L’extension ne répond pas ici : rien n’est parti.' };
    else { try { r = await vmrCmd({ cmd: 'importTout', uid }, 20000); } catch (_) { r = null; } }
    setIssue({ uid, texte: r && r.accepte ? 'Lecture lancée. La barre avance ici.' : ((r && r.raison) || 'L’extension n’a pas répondu. Réessaie.'), ok: !!(r && r.accepte) });
    setOccupe(false);
    relire();
  };
  return (
    <div className="vrm-imp vrm-imp-reglages" data-import-reglages={uids.length} data-import-sait={sait}>
      <p className="vrm-imp-note">Tes 12 derniers mois, lus une fois par l’extension. « Tout récupérer » lit plus ancien.</p>
      {rx ? <p className="vrm-imp-note vrm-imp-geste" role="status" data-import-ext={rx.code || ''}>{rx.texte}</p> : null}
      {!rx && extSait('importpasse') !== 'ok' ? <p className="vrm-imp-note vrm-imp-geste" role="status" data-import-ext="passe">Mets l’extension à jour (5.373.0) pour les 12 mois et les annonces.</p> : null}
      {etats === null ? <p className="vrm-imp-note" role="status" data-import-passu="">Pas su pour l’instant : la base n’a pas répondu.</p> : null}
      {!uids.length ? <p className="vrm-imp-note">Aucun compte Vinted relié.</p> : null}
      {uids.map((uid) => {
        const l = etats ? etats[uid] : undefined;
        const ici = onglet === uid;
        const enCours = l && l.etat === 'encours';
        const iss = issue && issue.uid === uid ? issue : null;
        return (
          <div key={uid} className="vrm-imp-ligne" data-import-ligne={uid} data-import-etat={l ? l.etat : (l === null ? 'aucun' : 'lecture')} data-import-onglet={ici ? '1' : '0'}>
            <div className="vrm-imp-tete">
              <span className="vrm-imp-nom">{nomDe(comptes, labels, uid)}</span>
              {!l ? <span className="vrm-imp-phrase">{l === null ? (ici ? 'Pas encore commencé.' : 'Ouvre vinted.fr sur ce compte.') : '—'}</span> : null}
            </div>
            {l ? <Compte l={l} nom="" montrerNom={false} /> : null}
            {ici && !rx && !enCours ? (
              <Bouton variante="secondaire" data-import-tout={uid} disabled={occupe} onClick={() => lancer(uid)}>Tout récupérer</Bouton>
            ) : null}
            {iss ? <p className="vrm-imp-note" role="status" data-import-issue={iss.ok ? 'ok' : 'refus'}>{iss.texte}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
