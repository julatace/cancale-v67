// ═══════════════════════════════════════════════════════════════════════════
// « TON HISTORIQUE VINTED » (11 nov., lot import-depart, extension 5.344)
// Règles et textes : src/importDepart.js. Deux places :
//   · Ma journée (`variante="journee"`) : une barre fine par compte en cours,
//     en pause, arrêté, ou fini depuis moins d'un jour. Rien sinon.
//   · Paramètres → Mes comptes (`variante="reglages"`) : chaque compte Vinted,
//     son état, et « Tout récupérer » pour le compte ouvert sur vinted.fr.
// Une lecture projetée (jamais `select=data`), relue quand l'extension le dit
// (`vrm:ext` quoi='import'), au retour sur l'écran, et chaque minute en cours.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireImportDepart, importsAMontrer, phraseImport, texteType, pctType } from './importDepart.js';
import { lireTout, load, vintedDeChrome, raisonExtGlobale, onVmrExt, vmrCmd, vmrExtPresent, extSait, Bouton } from './App.jsx';
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

function Barre({ t, nom }) {
  const pc = pctType(t);
  return (
    <div className="vrm-imp-type" data-import-type={nom} data-import-lus={t ? t.lus : ''} data-import-total={t && t.total !== null ? t.total : ''} data-import-fini={t && t.fini ? '1' : '0'}>
      <div className="vrm-imp-type-l">
        <span>{nom === 'ventes' ? 'Ventes' : 'Achats'}</span>
        <span className="vrm-imp-chiffre">{texteType(t, { suivant: nom === 'achats' })}</span>
      </div>
      {pc !== null && !(t && t.fini) ? (
        <div className="vrm-imp-barre" role="progressbar" aria-label={nom === 'ventes' ? 'Ventes récupérées' : 'Achats récupérés'} aria-valuemin={0} aria-valuemax={t.total} aria-valuenow={Math.min(t.lus, t.total)}>
          <i style={{ width: `${Math.max(2, pc)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Compte({ l, nom, montrerNom }) {
  return (
    <div className="vrm-imp-compte" data-import-compte={l.uid} data-import-etat={l.etat}>
      <div className="vrm-imp-tete">
        {montrerNom ? <span className="vrm-imp-nom">{nom}</span> : null}
        <span className="vrm-imp-phrase" data-ton={l.etat === 'arrete' ? 'geste' : undefined}>{phraseImport(l)}</span>
      </div>
      <Barre t={l.ventes} nom="ventes" />
      <Barre t={l.achats} nom="achats" />
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

  if (variante === 'journee') {
    const vus = importsAMontrer(etats);
    if (!vus.length) return null;
    return (
      <section className="vrm-imp vrm-imp-journee" data-import-journee={vus.length} aria-label="Ton historique Vinted">
        <div className="vrm-imp-titre">Ton historique Vinted</div>
        {vus.map((l) => <Compte key={l.uid} l={l} nom={nomDe(comptes, labels, l.uid)} montrerNom={uids.length > 1} />)}
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
      <p className="vrm-imp-note">Tes anciennes ventes et achats, lus une fois par l’extension.</p>
      {rx ? <p className="vrm-imp-note vrm-imp-geste" role="status" data-import-ext={rx.code || ''}>{rx.texte}</p> : null}
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
