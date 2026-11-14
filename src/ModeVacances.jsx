// ═══════════════════════════════════════════════════════════════════════════
// « MODE VACANCES » (10 nov., lot O, extension 5.338) — règles : src/modeVacances.js
// ═══════════════════════════════════════════════════════════════════════════
// Paramètres → Mes comptes → Mode vacances. Une rangée par compte Vinted avec
// l'état LU (En vacances · Ouvert · —), puis « Tout mettre en vacances » et
// « Tout rouvrir ». Un clic = au plus UN compte : celui ouvert dans l'onglet
// vinted.fr (l'extension refuse tout autre). Les autres comptes disent « Ouvre
// vinted.fr sur ce compte » : il bascule, puis reclique. Rien n'est programmé.
// Le geste n'est rejoué que si VRM l'a APPRIS (son propre geste sur vinted.fr) ;
// sinon « Fais-le une fois à la main sur vinted.fr : VRM apprend ».
// Leboncoin, eBay, Vestiaire : « À faire sur le site », un lien, rien d'autre.
// Lectures projetées (jamais `select=data`), relues au retour sur l'écran.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { GroupeIos } from './composants/Ios.jsx';
import JaugeActions from './JaugeActions.jsx';
import { suivi } from './suiviTravail.js';   // (11 nov., lot suivi-travail) VRM figé, détail et barre pendant le geste
import {
  LIGNE_ETAT_VACANCES, LIGNE_RECETTE_VACANCES, SELECT_PROFIL_VACANCES, SELECT_ETAT_VACANCES, SELECT_RECETTE_VACANCES,
  AUTRES_SITES_VACANCES, lignesVacances, recetteSait, planVacances, actionVacances, issueVacances, ageLu,
} from './modeVacances.js';
import { SUPABASE_URL, sbAuth, lireTout, load, vintedDeChrome, raisonExtGlobale, onVmrExt, vmrCmd, vmrExtPresent, askConfirm, Bouton } from './App.jsx';
import './styles-mode-vacances.css';
import { motsNavigateur } from './navigateurExtension.js';   // (11 nov.) « dans Orion » sur Orion, jamais « Chrome » en dur
import { AccAvant, AccEchec } from './ui/Accompagne.jsx';   // (14 nov.) ce qui va se passer ; l'échec en mots simples

const lireLigne = async (id, select) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}&select=${select}`, { headers: sbAuth(), cache: 'no-store' });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? (rows[0] || {}) : null;
  } catch (_) { return null; }
};

const MOT = { true: 'En vacances', false: 'Ouvert' };
const PHRASE_ACTION = {
  ouvrir: 'Ouvre vinted.fr sur ce compte',
  apprendre: 'Fais-le une fois à la main sur vinted.fr',
  passu: `Compte ouvert ${motsNavigateur().dansNu} : pas su`,
};
const ISSUE = { fait: 'Fait, relu', deja: 'Déjà fait, relu', ecart: 'Pas changé', incertain: 'Pas relu', echec: 'Refusé', refus: 'Pas envoyé', apprendre: 'Pas encore appris', envoi: 'Envoi…' };

export default function ModeVacances({ comptes = [] }) {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => onVmrExt(force), []);
  const [tour, setTour] = React.useState(0);
  const [profils, setProfils] = React.useState(undefined);
  const [etats, setEtats] = React.useState(undefined);
  const [recette, setRecette] = React.useState(undefined);
  const [relus, setRelus] = React.useState({});
  const [voulu, setVoulu] = React.useState(null);        // le dernier sens demandé (true · false)
  const [issues, setIssues] = React.useState({});
  const [occupe, setOccupe] = React.useState(false);
  const uids = (comptes || []).map((a) => String((a && a.vinted_user_id) || '')).filter((u) => /^\d{1,20}$/.test(u));
  const cleUids = uids.join(',');
  React.useEffect(() => {
    let mort = false;
    (async () => {
      const [p, e, rc] = await Promise.all([
        cleUids ? lireTout(`id=in.(${cleUids.split(',').map((u) => `harvest_${u}_profile`).join(',')})&select=${SELECT_PROFIL_VACANCES}`).catch(() => null) : Promise.resolve([]),
        lireLigne(LIGNE_ETAT_VACANCES, SELECT_ETAT_VACANCES),
        lireLigne(LIGNE_RECETTE_VACANCES, SELECT_RECETTE_VACANCES),
      ]);
      if (mort) return;
      setProfils(p);
      setEtats(e === null ? null : ((e.c && typeof e.c === 'object') ? e.c : {}));
      setRecette(rc);
    })();
    return () => { mort = true; };
  }, [cleUids, tour]);
  React.useEffect(() => {
    const auRetour = () => { if (document.visibilityState === 'visible') setTour((t) => t + 1); };
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, []);

  const vc = vintedDeChrome();
  const onglet = vc === undefined ? undefined : (vc ? String(vc.uid || '') : null);
  const labels = load('vinted_account_labels', {}) || {};
  const etatsVus = etats === undefined ? undefined : { ...(etats || {}), ...relus };
  const lignes = lignesVacances({ comptes, profils, etats: etats === null && !Object.keys(relus).length ? null : etatsVus, onglet, noms: labels });
  const rx = raisonExtGlobale(false, { cap: 'vacances', role: 'met tes comptes en vacances sur Vinted' });
  const nOui = lignes.filter((l) => l.vacances === true).length;
  const nPasSu = lignes.filter((l) => l.vacances === null).length;

  const lancer = async (sens) => {
    if (occupe) return;
    setVoulu(sens);
    const sait = recetteSait(recette === undefined ? undefined : recette, sens);
    const plan = planVacances(lignes, { voulu: sens, onglet, sait });
    if (!plan.envoyer || rx) return;                        // les rangées disent pourquoi
    const l = lignes.find((x) => x.uid === plan.envoyer);
    const ok = await askConfirm({
      title: sens ? `Mettre ${l.nom} en vacances ?` : `Rouvrir ${l.nom} ?`,
      desc: sens ? 'Sur Vinted, ses annonces ne se voient plus. Les autres comptes : un par un.' : 'Sur Vinted, ses annonces se voient de nouveau.',
      ok: sens ? 'Mettre en vacances' : 'Rouvrir', cancel: 'Annuler',
    });
    if (!ok) return;
    setOccupe(true);
    setIssues((x) => ({ ...x, [l.uid]: { etat: 'envoi' } }));
    // (11 nov., lot suivi-travail) La feuille « VRM travaille » : jamais le pseudo (rien de personnel au journal).
    const t = suivi.demarrer({ sorte: 'vacances', titre: sens ? 'Mode vacances : poser' : 'Mode vacances : retirer', uid: l.uid,
      etapes: [['envoi', 'Envoi à Vinted'], ['relu', 'État relu sur Vinted']],
      articles: [{ id: l.uid, titre: 'Le compte ouvert sur vinted.fr' }] });
    if (t) t.etape(l.uid, 'envoi');
    let r = null;
    if (!vmrExtPresent()) r = { accepte: false, raison: 'L’extension ne répond pas ici : rien n’est parti' };
    else { try { r = await vmrCmd({ cmd: 'vacancesVinted', uid: l.uid, vacances: sens, confirme: true }, 90000); } catch (_) { r = null; } if (!r) r = { sansReponse: true }; }
    const iss = issueVacances(r, sens);
    if (t) {
      if (typeof iss.vacances === 'boolean') t.etape(l.uid, 'relu', iss.vacances ? 'en vacances' : 'ouvert');
      t.fin(l.uid, iss.etat === 'fait' || iss.etat === 'deja' ? { etat: 'ok' }
        : iss.etat === 'apprendre' ? { etat: 'main', raison: iss.raison, geste: sens ? 'Mets ce compte en vacances une fois à la main sur vinted.fr : VRM apprend' : 'Rouvre ce compte une fois à la main sur vinted.fr : VRM apprend' }
        : iss.etat === 'ecart' || iss.etat === 'incertain' ? { etat: 'main', raison: iss.raison, geste: 'Regarde ton profil Vinted' }
        : { etat: 'refus', raison: iss.raison });
      t.terminer('');
    }
    setIssues((x) => ({ ...x, [l.uid]: iss }));
    if (typeof iss.vacances === 'boolean') setRelus((x) => ({ ...x, [l.uid]: { vacances: iss.vacances, at: new Date().toISOString(), via: 'relu' } }));
    setOccupe(false);
    setTour((t) => t + 1);
  };

  const sait = voulu === null ? null : recetteSait(recette === undefined ? undefined : recette, voulu);
  const plan = voulu === null ? null : planVacances(lignes, { voulu, onglet, sait });
  const apprendre = plan && plan.actions.some((a) => a.action === 'apprendre');
  const tousFait = plan && plan.tous;

  return (
    <div className="vrm-vac" data-mode-vacances={lignes.length} data-vac-voulu={voulu === null ? '' : (voulu ? 'on' : 'off')}>
      <p className="vrm-vac-phrase">Un compte à la fois : celui ouvert sur vinted.fr.</p>
      <AccAvant geste="vacances"/>
      <div className="vrm-vac-boutons">
        <Bouton variante="primaire" icone="sun" data-vac-tout="on" disabled={occupe || !!rx || !lignes.length} onClick={() => lancer(true)}>Tout mettre en vacances</Bouton>
        <Bouton variante="secondaire" data-vac-tout="off" disabled={occupe || !!rx || !lignes.length} onClick={() => lancer(false)}>Tout rouvrir</Bouton>
      </div>
      {rx ? <div className="vrm-vac-note vrm-vac-geste" data-vac-ext=""><AccEchec geste="vacances" erreur={rx.texte}/></div> : null}
      {apprendre ? (
        <p className="vrm-vac-note vrm-vac-geste" role="status" data-vac-apprendre={voulu ? 'on' : 'off'}>
          {voulu ? 'Mets ce compte en vacances une fois à la main sur vinted.fr : VRM apprend.' : 'Rouvre ce compte une fois à la main sur vinted.fr : VRM apprend.'}{' '}
          <a href="https://www.vinted.fr/" target="_blank" rel="noreferrer" className="vrm-lien-action">Ouvrir Vinted ↗</a>
        </p>
      ) : null}
      {tousFait ? <p className="vrm-vac-note" role="status" data-vac-tous="" data-acc-apres="vacances">{voulu ? 'Tous tes comptes sont en vacances.' : 'Tous tes comptes sont ouverts.'}</p> : null}
      {onglet ? <div className="vrm-vac-jauge"><JaugeActions uid={onglet} /></div> : null}

      <GroupeIos titre="Vinted" pied={nPasSu ? `${nPasSu} compte${nPasSu > 1 ? 's' : ''} pas lu${nPasSu > 1 ? 's' : ''} : passe sur Vinted connecté dessus.` : (nOui ? `${nOui} sur ${lignes.length} en vacances.` : undefined)} data-vac-groupe="vinted">
        {lignes.length ? lignes.map((l) => {
          const action = voulu === null ? '' : actionVacances(l, { voulu, onglet, sait });
          const iss = issues[l.uid];
          const etatAttr = l.vacances === true ? 'oui' : l.vacances === false ? 'non' : 'passu';
          const sous = iss && iss.etat !== 'envoi' && iss.raison ? iss.raison
            : (action && PHRASE_ACTION[action]) ? PHRASE_ACTION[action]
            : [l.onglet ? `Ouvert ${motsNavigateur().dansNu}` : '', ageLu(l.at)].filter(Boolean).join(' · ');
          return (
            <div key={l.uid} className="vrm-ios-rangee vrm-vac-rangee" data-vac-ligne={l.uid} data-vac-etat={etatAttr} data-vac-source={l.source || ''}
              data-vac-action={action} data-vac-onglet={l.onglet ? '1' : '0'} data-vac-issue={iss ? iss.etat : ''}>
              <span className="vrm-ios-rangee-zone">
                <span className="vrm-ios-icone vrm-vac-initiale" aria-hidden="true">{String(l.nom || '?').slice(0, 1).toUpperCase()}</span>
                <span className="vrm-ios-texte">
                  <span className="vrm-ios-titre">{l.nom}</span>
                  {sous ? <span className="vrm-ios-detail" data-vac-sous="" data-ton={action === 'ouvrir' || action === 'apprendre' ? 'geste' : undefined}>{sous}</span> : null}
                </span>
                <span className="vrm-ios-valeur" data-vac-valeur="" data-ton={l.vacances === true ? 'vacances' : undefined}>
                  {iss && iss.etat === 'envoi' ? ISSUE.envoi : (l.vacances === null ? '—' : MOT[l.vacances])}
                  {iss && iss.etat !== 'envoi' && ISSUE[iss.etat] ? <span className="vrm-vac-issue" data-vac-issue-mot="">{ISSUE[iss.etat]}</span> : null}
                </span>
              </span>
            </div>
          );
        }) : <div className="vrm-ios-rangee"><span className="vrm-ios-rangee-zone"><span className="vrm-ios-texte"><span className="vrm-ios-titre">Aucun compte Vinted relié</span></span></span></div>}
      </GroupeIos>

      <GroupeIos titre="Autres sites" pied="VRM ne sait pas encore le faire pour eux." data-vac-groupe="autres">
        {AUTRES_SITES_VACANCES.map((s) => (
          <div key={s.id} className="vrm-ios-rangee" data-vac-site={s.id}>
            <a className="vrm-ios-rangee-zone" href={s.url} target="_blank" rel="noreferrer">
              <span className="vrm-ios-texte"><span className="vrm-ios-titre">{s.nom}</span></span>
              <span className="vrm-ios-valeur">À faire sur le site ↗</span>
            </a>
          </div>
        ))}
      </GroupeIos>
    </div>
  );
}
