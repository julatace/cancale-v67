// ═══════════════════════════════════════════════════════════════════════════
// « SÉCURITÉ DES COMPTES » — Paramètres → Mes comptes (11 nov., lot securite-vinted)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « améliore la sécurité des comptes Vinted pour faire comme Vintex, pour
// ne pas se faire bannir » (+ Vestiaire). Règle : src/securiteComptes.js — la MÊME
// que l'extension (recopiée dans background.js) : la phrase dite ici est celle que
// l'extension applique.
//   · « Tout arrêter » / « Relancer » : SA clé `vrm_securite_comptes` (evts) ET, si
//     l'extension est dans ce navigateur, tout de suite (`secuArret`).
//   · une rangée par compte : UNE phrase (vérification, arrêt, prudence, repos…),
//     touchée ⇒ ses réglages (repos de nuit, plafond/jour, par type, « si tu es là »,
//     journée calme, rodage) ; « Tous les comptes » = le réglage de la plateforme.
//   · « Ce que VRM fait sur tes comptes » : le journal (gestes acceptés), par jour.
// Lectures projetées (`securite_etat_*`, `journal_vrm_*`, `journal_vc_*`), relues au
// retour sur l'écran et chaque minute. Rien n'est écrit sans SON geste.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { GroupeIos, Interrupteur } from './composants/Ios.jsx';
import { tr } from './i18n/index.js';
import {
  CLE_SECURITE, PREFIXE_ETAT_SECU, SELECT_ETAT_SECU, PREFIXES_JOURNAL, SECU_NOMS, SECU_TYPES_REGLABLES,
  secuCle, secuReglages, secuPhrase, secuParis, poserReglage, poserArret, arretDeTous, etatDuCompte, septJours, tableauGestes,
  comptesSecurite, versHeure, depuisHeure, secuHeure,
} from './securiteComptes.js';
import { journeeCalme } from './offresSures.js';
import { lireTout, load, save, onCloudReady, vmrCmd, vmrExtPresent, Bouton } from './App.jsx';
import './styles-securite-comptes.css';

const phraseDe = (ph) => (ph ? tr('securite.phrase.' + ph.cle, ph.v) : '');
// Les rangées lues : undefined = on lit · null = pas su · tableau = lu.
function useLignes(requete, actif = true) {
  const [rows, setRows] = React.useState(undefined);
  const [tour, setTour] = React.useState(0);
  React.useEffect(() => {
    if (!actif) return undefined;
    let mort = false;
    lireTout(requete).then((r) => { if (!mort) setRows(Array.isArray(r) ? r : null); }, () => { if (!mort) setRows(null); });
    return () => { mort = true; };
  }, [requete, actif, tour]);
  React.useEffect(() => {
    const t = setInterval(() => setTour((x) => x + 1), 60000);
    const auRetour = () => { if (document.visibilityState === 'visible') setTour((x) => x + 1); };
    document.addEventListener('visibilitychange', auRetour);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', auRetour); };
  }, []);
  return [rows, () => setTour((x) => x + 1)];
}

function ChampNombre({ valeur, min = 0, max = 1200, onChange, label, attr }) {
  const [v, setV] = React.useState(String(valeur ?? 0));
  React.useEffect(() => setV(String(valeur ?? 0)), [valeur]);
  const valider = () => { const n = Math.max(min, Math.min(max, Math.round(Number(String(v).replace(',', '.')) || 0))); setV(String(n)); if (n !== Number(valeur)) onChange(n); };
  return <input className="vrm-secu-nombre" type="number" inputMode="numeric" min={min} max={max} value={v} aria-label={label} data-secu-champ={attr}
    onChange={(e) => setV(e.target.value)} onBlur={valider} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}
function ChampHeure({ min, onChange, label, attr }) {
  return <input className="vrm-secu-heure" type="time" value={versHeure(min)} aria-label={label} data-secu-champ={attr}
    onChange={(e) => { const m = depuisHeure(e.target.value); if (m != null && m !== min) onChange(m); }} />;
}

// Les réglages d'UNE cible (la plateforme si `compte` est vide, sinon le compte).
function Reglages({ tout, plateforme, compte, poser, conseilCalme }) {
  const reg = secuReglages(tout, plateforme, compte || '');
  const propre = compte ? ((tout && tout.comptes && tout.comptes[secuCle(plateforme, compte)]) || null) : null;
  const p = (champ, valeur) => poser({ plateforme, compte: compte || null, champ, valeur });
  const jours = [1, 2, 3, 4, 5, 6, 0];
  const nomJour = (d) => { try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 10, 1 + d))); } catch (_) { return String(d); } };
  const aujourdhui = secuParis(Date.now()).jour;
  return (
    <div className="vrm-secu-reglages" data-secu-reglages={compte ? secuCle(plateforme, compte) : plateforme}>
      <div className="vrm-secu-ligne">
        <span className="vrm-secu-lib">{tr('securite.repos')}</span>
        <Interrupteur on={reg.repos.actif} onChange={(v) => p('repos.actif', v)} label={tr('securite.repos')} attrs={{ 'data-secu-champ': 'repos.actif' }} />
      </div>
      {reg.repos.actif ? (
        <div className="vrm-secu-ligne vrm-secu-sous">
          <span>{tr('securite.repos.de')}</span>
          <ChampHeure min={reg.repos.debut} onChange={(m) => p('repos.debut', m)} label={tr('securite.repos.de')} attr="repos.debut" />
          <span>{tr('securite.repos.a')}</span>
          <ChampHeure min={reg.repos.fin} onChange={(m) => p('repos.fin', m)} label={tr('securite.repos.a')} attr="repos.fin" />
        </div>
      ) : null}
      {reg.repos.actif ? <p className="vrm-secu-aide">{tr('securite.repos.aide')}</p> : null}
      <div className="vrm-secu-ligne">
        <span className="vrm-secu-lib">{tr('securite.parJour')}<span className="vrm-secu-aide">{tr('securite.parJour.aide')}</span></span>
        <ChampNombre valeur={reg.parJour} max={1200} onChange={(n) => p('parJour', n)} label={tr('securite.parJour')} attr="parJour" />
      </div>
      <div className="vrm-secu-ligne vrm-secu-titre-sous"><span className="vrm-secu-lib">{tr('securite.parType')}</span></div>
      <div className="vrm-secu-types">
        {SECU_TYPES_REGLABLES.map((t) => (
          <label key={t} className="vrm-secu-type">
            <span>{tr('securite.type.' + t)}</span>
            <ChampNombre valeur={reg.parType[t] || 0} max={50} onChange={(n) => p('parType.' + t, n)} label={tr('securite.type.' + t)} attr={'parType.' + t} />
          </label>
        ))}
      </div>
      <div className="vrm-secu-ligne">
        <span className="vrm-secu-lib">{tr('securite.presence')}</span>
        <Interrupteur on={reg.presence.actif} onChange={(v) => p('presence.actif', v)} label={tr('securite.presence')} attrs={{ 'data-secu-champ': 'presence.actif' }} />
      </div>
      {reg.presence.actif ? (
        <div className="vrm-secu-ligne vrm-secu-sous">
          <span className="vrm-secu-aide">{tr('securite.presence.aide')}</span>
          <ChampNombre valeur={reg.presence.min} min={5} max={720} onChange={(n) => p('presence.min', n)} label={tr('securite.presence')} attr="presence.min" />
          <span>{tr('securite.min')}</span>
        </div>
      ) : null}
      <div className="vrm-secu-ligne vrm-secu-titre-sous"><span className="vrm-secu-lib">{tr('securite.calme')}</span></div>
      <div className="vrm-secu-jours" role="group" aria-label={tr('securite.calme')}>
        {jours.map((d) => {
          const on = reg.calme.includes(d);
          return <button key={d} type="button" className="vrm-secu-jour" aria-pressed={on} data-secu-jour={d}
            onClick={() => p('calme', on ? reg.calme.filter((x) => x !== d) : [...reg.calme, d])}>{nomJour(d)}</button>;
        })}
      </div>
      {conseilCalme && !reg.calmeDates.includes(aujourdhui) ? (
        <div className="vrm-secu-ligne vrm-secu-conseil" data-secu-conseil-calme="">
          <span className="vrm-secu-aide">{tr('securite.calme.conseil')}</span>
          <Bouton variante="secondaire" data-secu-calme-poser="" onClick={() => p('calmeDates', [...reg.calmeDates, aujourdhui])}>{tr('securite.calme.poser')}</Bouton>
        </div>
      ) : null}
      <div className="vrm-secu-ligne">
        <span className="vrm-secu-lib">{tr('securite.rodage')}</span>
        <Interrupteur on={reg.rodage} onChange={(v) => p('rodage', v)} label={tr('securite.rodage')} attrs={{ 'data-secu-champ': 'rodage' }} />
      </div>
      {propre ? <p className="vrm-secu-aide" data-secu-propre="">{tr('securite.propre')}</p> : null}
    </div>
  );
}

export default function SecuriteComptes({ comptes = [] }) {
  const lireCle = () => { const v = load(CLE_SECURITE, {}); return v && typeof v === 'object' ? v : {}; };
  const [tout, setTout] = React.useState(lireCle);
  React.useEffect(() => onCloudReady(() => setTout(lireCle())), []);
  const [rowsEtat, relireEtat] = useLignes(`id=like.${PREFIXE_ETAT_SECU}*&select=${SELECT_ETAT_SECU}`);
  const [rowsJV] = useLignes(`id=like.${PREFIXES_JOURNAL.vinted}*&select=id,e:data->e`);
  const [rowsJC] = useLignes(`id=like.${PREFIXES_JOURNAL.vestiaire}*&select=id,e:data->e`);
  const [ouvert, setOuvert] = React.useState('');
  const maintenant = Date.now();
  const jours = septJours(maintenant);
  const rowsJ = rowsJV === undefined || rowsJC === undefined ? undefined : (rowsJV === null || rowsJC === null ? null : [...rowsJV, ...rowsJC]);
  const tableau = tableauGestes(rowsJ, jours);
  const noms = load('vinted_account_labels', {}) || {};
  const liste = comptesSecurite({ comptesVinted: comptes, rowsEtat, tableau, reglages: tout, noms });
  const arret = arretDeTous(tout, rowsEtat);

  const ecrire = (v) => { setTout(v); save(CLE_SECURITE, v); };
  const poser = (geste) => ecrire(poserReglage(tout, geste));
  const basculerArret = async (a) => {
    ecrire(poserArret(tout, a));
    if (vmrExtPresent()) { try { await vmrCmd({ cmd: 'secuArret', arret: a }, 8000); } catch (_) {} }
    relireEtat();
  };

  const rangee = (c) => {
    const etat = rowsEtat === undefined ? undefined : etatDuCompte(rowsEtat, c.cle, maintenant);
    const reg = secuReglages(tout, c.plateforme, c.compte);
    const auj = tableau && tableau[c.cle] ? tableau[c.cle].jours[jours[jours.length - 1]] : (tableau ? 0 : null);
    const ph = etat === undefined ? null : secuPhrase({ plateforme: c.plateforme, compte: c.compte, etat: etat || {}, reg, arret, maintenant, aujourdhui: auj });
    const texte = etat === undefined ? '…' : (etat === null ? tr('securite.etatPasSu') : phraseDe(ph));
    const freins = etat && etat.prudence && etat.prudence.depuis ? [{ vu: etat.prudence.depuis }] : [];
    const conseil = !!journeeCalme(freins, maintenant);
    const ici = ouvert === c.cle;
    return (
      <div key={c.cle} className="vrm-ios-rangee vrm-secu-rangee" data-secu-compte={c.cle} data-secu-niveau={ph ? ph.niveau : (etat === null ? 'pas-su' : 'lecture')} data-secu-ouvert={ici ? '1' : '0'}>
        <button type="button" className="vrm-ios-rangee-zone" aria-expanded={ici} onClick={() => setOuvert(ici ? '' : c.cle)}>
          <span className="vrm-ios-icone vrm-secu-initiale" aria-hidden="true">{String(c.nom || '?').slice(0, 1).toUpperCase()}</span>
          <span className="vrm-ios-texte">
            <span className="vrm-ios-titre">{c.nom}</span>
            <span className="vrm-ios-detail" data-secu-phrase="" data-ton={ph && ph.niveau === 'robot' ? 'geste' : undefined}>{texte}</span>
          </span>
          <span className="vrm-ios-chevron" aria-hidden="true"><svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ici ? 'm1.5 4 5 5 5-5' : 'm1.5 1.5 5 5-5 5'} /></svg></span>
        </button>
        {ici ? <Reglages tout={tout} plateforme={c.plateforme} compte={c.compte} poser={poser} conseilCalme={conseil} /> : null}
      </div>
    );
  };
  const rangeeTous = (pf) => {
    const cle = 'tous:' + pf, ici = ouvert === cle;
    return (
      <div key={cle} className="vrm-ios-rangee vrm-secu-rangee" data-secu-tous={pf} data-secu-ouvert={ici ? '1' : '0'}>
        <button type="button" className="vrm-ios-rangee-zone" aria-expanded={ici} onClick={() => setOuvert(ici ? '' : cle)}>
          <span className="vrm-ios-texte">
            <span className="vrm-ios-titre">{tr('securite.tous')}</span>
            <span className="vrm-ios-detail">{tr('securite.tous.detail')}</span>
          </span>
          <span className="vrm-ios-chevron" aria-hidden="true"><svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ici ? 'm1.5 4 5 5 5-5' : 'm1.5 1.5 5 5-5 5'} /></svg></span>
        </button>
        {ici ? <Reglages tout={tout} plateforme={pf} compte="" poser={poser} conseilCalme={false} /> : null}
      </div>
    );
  };
  const groupes = ['vinted', 'vestiaire'].map((pf) => ({ pf, comptes: liste.filter((c) => c.plateforme === pf) })).filter((g) => g.pf === 'vinted' || g.comptes.length);
  const jourCourt = (j) => { try { return new Intl.DateTimeFormat(undefined, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(j + 'T12:00:00Z')); } catch (_) { return j.slice(8); } };

  return (
    <div className="vrm-secu" data-securite-comptes={liste.length} data-secu-arret={arret.arrete ? '1' : '0'}>
      <p className="vrm-secu-intro">{tr('securite.intro')}</p>
      <div className="vrm-secu-arret">
        {arret.arrete ? (
          <>
            <p className="vrm-secu-etat-arret" role="status" data-secu-arrete="">{tr('securite.phrase.arret', { heure: secuHeure(arret.at) })}</p>
            <Bouton variante="primaire" data-secu-relancer="" onClick={() => basculerArret(false)}>{tr('securite.relancer')}</Bouton>
          </>
        ) : (
          <>
            <Bouton variante="secondaire" data-secu-tout-arreter="" onClick={() => basculerArret(true)}>{tr('securite.toutArreter')}</Bouton>
            <p className="vrm-secu-aide">{tr('securite.arret.detail')}</p>
          </>
        )}
      </div>
      {groupes.map((g) => (
        <GroupeIos key={g.pf} titre={SECU_NOMS[g.pf]} data-secu-groupe={g.pf}>
          {rangeeTous(g.pf)}
          {g.comptes.length ? g.comptes.map(rangee) : <div className="vrm-ios-rangee"><span className="vrm-ios-rangee-zone"><span className="vrm-ios-texte"><span className="vrm-ios-titre">{tr('securite.aucun')}</span></span></span></div>}
        </GroupeIos>
      ))}
      <GroupeIos titre={tr('securite.tableau.titre')} pied={tableau === null ? tr('securite.tableau.pasSu') : tr('securite.tableau.pied')} data-secu-tableau={tableau === null ? 'pas-su' : tableau === undefined ? 'lecture' : 'lu'}>
        <div className="vrm-secu-table-cadre">
          <table className="vrm-secu-table">
            <thead><tr><th scope="col">{tr('securite.compte')}</th>{jours.map((j) => <th key={j} scope="col" title={j}>{jourCourt(j)}</th>)}</tr></thead>
            <tbody>
              {liste.map((c) => (
                <tr key={c.cle} data-secu-ligne={c.cle}>
                  <th scope="row">{c.nom}</th>
                  {jours.map((j) => {
                    const n = tableau ? ((tableau[c.cle] && tableau[c.cle].jours[j]) || 0) : null;
                    return <td key={j} data-secu-jour-n={n == null ? '' : n} data-vide={n === 0 ? '1' : undefined}>{n == null ? '—' : n}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GroupeIos>
      <p className="vrm-secu-aide vrm-secu-refuse">{tr('securite.refuse')}</p>
    </div>
  );
}
