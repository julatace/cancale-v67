// ══════════════════════════════════════════════════════════════════════════════
//  « CLÔTURER L'ANNÉE » (11 nov.) — Argent → Déclarer, de décembre à mai
//  La FORME seulement : chaque état vient de src/clotureAnnee.js, qui RANGE les
//  règles des propriétaires (aucun chiffre recalculé ici). Une ligne par étape :
//  ✓ gris (réglé), le nombre en AMBRE (un geste), « — » (pas su, avec la raison),
//  « … » (lecture en cours). La ligne touchée OUVRE l'écran qui la règle. Rien
//  n'est écrit, sauf « J'ai fini » (SON clic, confirmé).
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { montant as fmtMontant } from './format.js';
import { clotureAnnee, anneeACloturer, enregistrementCloture, CLE_CLOTURE, NOTICE_LUE, DEMANDE_CLOTURE } from './clotureAnnee.js';
import { caAnnee, declarationRevenus, jaugeSeuils, optionsMicro } from './microEntreprise.js';
import { dac7ParPlateforme } from './seuilsAnnee.js';
import { moisCouvertParPublication } from './beneficeNoms.js';
import { useInventaireAnnuel } from './InventaireAnnuel.jsx';
import { AUTH, askConfirm, beneficeDesJours, cleNum, lireBeneficeJours, lireDeclarations, load, montantPeriodeUrssaf, moisDeclare, save, tauxUrssaf, useLigneSynchro, useLigneUrssaf, useRegimeFiscal } from './App.jsx';
import './styles-mois-boucle.css';
import './styles-cloture-annee.css';
import { motsVendeur } from './profilVendeur.js';

export const REGLES_CLOTURE = { caAnnee, declarationRevenus, jaugeSeuils, dac7ParPlateforme, montantPeriodeUrssaf, moisDeclare, beneficeDesJours, moisCouvert: moisCouvertParPublication };

const lireCloture = () => { const v = load(CLE_CLOTURE, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
const lireFreq = () => (load('vinted_urssaf_freq', 'trimestriel') === 'mensuel' ? 'mensuel' : 'trimestriel');
const lireOptions = () => optionsMicro(load('vrm_micro_options', null));
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const nb = (n) => Number(n || 0).toLocaleString('fr-FR');
const pl = (n) => (Number(n) > 1 ? 's' : '');
const eur = (v) => fmtMontant(v);
const dateFr = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const NOMS = {
  adater: ['Ventes à dater', 'Ventes datées'],
  prix: ['Prix d’achat à saisir', 'Prix d’achat saisis'],
  inventaire: ['Inventaire au 31 décembre', 'Inventaire au 31 décembre'],
  ca: ['Chiffre d’affaires de l’année', 'Chiffre d’affaires de l’année'],
  urssaf: ['Déclarations URSSAF', 'Déclarations URSSAF faites'],
  revenus: ['Déclaration de revenus', 'Déclaration de revenus'],
  seuils: ['Seuils et DAC7', 'Seuils et DAC7'],
  export: ['Export pour ton comptable', 'Export pour ton comptable'],
};
const RAISONS = {
  publication: 'ouvre Ventes une fois',
  ancien: 'année trop ancienne pour VRM',
  statut: 'choisis ton statut',
  'statut-societe': 'société : vois avec ton comptable',
  'statut-marge': 'régime de la marge : vois avec ton comptable',
  'statut-particulier': 'pas pour un particulier',
  'pas-ce-jour': 'liste pas lue le 31 décembre',
  partiel: 'une lecture d’annonces manque',
  'seuils-annee': 'seuils de cette année pas vérifiés',
  'inventaire-publication': 'liste pas encore lue : ouvre Annonces',
  'seuils-partiel': 'sur un chiffre d’affaires minimum',
};
const VERDICT = { atteint: 'seuil atteint', atteintSi: 'atteint si les ventes à dater y sont', sous: 'sous le seuil' };
const ETAT_SEUIL = { ok: 'sous le seuil', proche: 'proche', base_depasse: 'dépassé', majore_depasse: 'seuil majoré dépassé', due_depuis_janvier: 'TVA due depuis janvier', depasse: 'dépassé', sortie: 'dépassé deux ans de suite' };

// Le texte sous chaque étape : ce qui a été CONSTATÉ.
function sousTexte(e, K) {
  if (e.etat === 'encours') return 'je lis…';
  if (e.etat === 'passu' && e.raison && e.cle !== 'inventaire' && e.cle !== 'seuils') return RAISONS[e.raison] || 'pas su';
  if (e.etat === 'na') return RAISONS[e.raison] || '';
  switch (e.cle) {
    case 'adater': return e.n > 0 ? `${nb(e.n)} vente${pl(e.n)} sans date de versement : dans aucun mois` : 'toutes les ventes ont leur date';
    case 'prix': return e.n > 0 ? `${nb(e.n)} vente${pl(e.n)} de ${K.annee} sur ${nb(e.sur)} sans prix d’achat` : `${nb(e.sur)} vente${pl(e.sur)} de ${K.annee}, toutes avec un prix`;
    case 'inventaire': {
      const val = e.v && e.v.centimes != null ? `${e.v.nSans > 0 || e.partiel ? 'au moins ' : ''}${eur(e.v.centimes / 100)} sur ${nb(e.v.n)} ${e.v.n > 1 ? motsVendeur().noms : motsVendeur().nom}` : '';
      if (e.etat === 'attente') return `à faire le 31 décembre${val ? ' · aujourd’hui ' + val : ''}`;
      if (e.etat === 'passu') return e.raison === 'pas-ce-jour' && e.lue ? `liste lue le ${e.lue.split('-').reverse().join('/')}, pas le 31/12 : VRM ne reconstitue pas un jour passé` : (RAISONS['inventaire-' + e.raison] || RAISONS[e.raison] || 'pas su');
      if (e.etat === 'manque') return `${nb(e.n)} ${e.n > 1 ? motsVendeur().noms : motsVendeur().nom} sans prix · ${val}`;
      return val || 'liste lue le 31 décembre';
    }
    case 'ca': return `${e.partiel ? 'au moins ' : ''}${eur(e.ca)} reçus en ${K.annee}${e.raisons && e.raisons.length ? ' · ' + e.raisons.join(' · ') : ''}`;
    case 'urssaf': {
      const t = `${e.faites}/${e.sur} ${e.freq === 'mensuel' ? 'mois' : 'trimestres'} noté${e.faites > 1 ? 's' : ''} déclaré${e.faites > 1 ? 's' : ''}`;
      if (!e.n) return t;
      return `${t} · reste ≈ ${e.reste == null ? '—' : (e.restePartiel ? 'au moins ' : '') + eur(e.reste)} à payer (estimé)`;
    }
    case 'revenus': {
      if (e.raison === 'liberatoire') return `${e.partiel ? 'au moins ' : ''}${eur(e.ca)} · réponds d’abord : versement libératoire ?`;
      return `${e.partiel ? 'au moins ' : ''}${eur(e.ca)} à reporter case ${e.cases.join(', ')}`;
    }
    case 'seuils': {
      const morceaux = [];
      if (e.tva) morceaux.push(`TVA : ${ETAT_SEUIL[e.tva] || e.tva}`);
      if (e.plafond) morceaux.push(`micro : ${ETAT_SEUIL[e.plafond] || e.plafond}`);
      for (const d of e.dac7 || []) morceaux.push(`DAC7 ${d.plateforme} : ${d.etat === 'passu' ? 'pas lu' : VERDICT[d.verdict] || 'pas su'}`);
      if (e.etat === 'passu') morceaux.unshift(RAISONS['seuils-' + e.raison] || RAISONS[e.raison] || 'pas su');
      return morceaux.join(' · ') || 'aucune plateforme lue';
    }
    case 'export': return `période ${K.annee} · VRM ne sait pas s’il est parti`;
    default: return '';
  }
}

function Rond({ e }) {
  const c = e.etat === 'ok' ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.2 5.8 10 11 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    : e.etat === 'encours' ? '…' : e.etat === 'attente' ? '31' : e.etat === 'manque' || e.etat === 'alerte' ? (e.n != null && e.n > 0 ? (e.n > 999 ? '999+' : e.n) : '!') : e.etat === 'geste' ? '↗' : '—';
  const cls = e.etat === 'manque' || e.etat === 'alerte' ? 'manque' : e.etat;
  return <span className={'vrm-mb-rond is-' + cls} aria-hidden="true">{c}</span>;
}

export default function ClotureAnnee({ portes = {}, maintenant: maintenantProp }) {
  const maintenant = maintenantProp || Date.now();
  const annee = anneeACloturer(maintenant);
  const regime = useRegimeFiscal();
  const ligneU = useLigneUrssaf();
  const [pub, pret] = useLigneSynchro('vrm_benefice_jours', lireBeneficeJours);
  const [reg, regPret] = useLigneSynchro('vrm_urssaf_declare', lireDeclarations);
  const [cloture, cloPret] = useLigneSynchro(CLE_CLOTURE, lireCloture);
  const [freq] = useLigneSynchro('vinted_urssaf_freq', lireFreq);
  const [opts] = useLigneSynchro('vrm_micro_options', lireOptions);
  const inv = useInventaireAnnuel(AUTH.user?.id || '', cleNum);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!DEMANDE_CLOTURE.at || Date.now() - DEMANDE_CLOTURE.at > 30000) return;
    DEMANDE_CLOTURE.at = 0;
    try { if (ref.current) ref.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {}
  });
  if (annee == null || regime === 'particulier') return null;
  const K = clotureAnnee({ annee, maintenant, ligne: pret ? ligneU : undefined, joursBenef: pret ? pub : undefined, inventaire: inv,
    declare: regPret ? reg : undefined, regime, freq, taux: tauxUrssaf(), liberatoire: opts.liberatoire, activite: opts.activite || 'vente',
    cloture: cloPret ? cloture : undefined, R: REGLES_CLOTURE });
  if (!K) return null;
  const ouvrir = (cle) => { const f = portes[cle]; if (typeof f === 'function') f(K.annee); };
  const finir = async () => {
    const reste = K.aFaire + K.passu;
    const ok = await askConfirm({ title: `Clôturer ${K.annee} ?`,
      desc: reste ? `${reste} étape${pl(reste)} ${reste > 1 ? 'ne sont' : 'n’est'} pas réglée${pl(reste)} ou pas vérifiée${pl(reste)}. VRM range l’année clôturée telle quelle ; rien d’autre ne change.` : 'VRM range l’année clôturée ; rien d’autre ne change.',
      ok: 'J’ai fini', cancel: 'Annuler' });
    if (!ok) return;
    save(CLE_CLOTURE, { ...lireCloture(), [String(K.annee)]: enregistrementCloture(K, Date.now()) });
  };
  const rouvrir = () => { const c = { ...lireCloture() }; delete c[String(K.annee)]; save(CLE_CLOTURE, c); };
  const ca = K.etapes.find((e) => e.cle === 'ca');
  const rev = K.etapes.find((e) => e.cle === 'revenus');
  return (
    <section ref={ref} className="vrm-mb vrm-ca-cloture" id="compta-cloture" data-cloture-annee={K.annee} data-cloture-etat={K.etat}
      data-cloture-faites={K.faites} data-cloture-sur={K.sur} aria-label={`Clôturer ${K.annee}`} style={{ scrollMarginTop: 72 }}>
      <div className="vrm-mb-tete">
        <h3 className="vrm-mb-titre">Clôturer {K.annee}</h3>
        {K.etat === 'cloturee' ? null : <span className="vrm-ca-compte" data-cloture-progression="">{K.faites}/{K.sur}</span>}
      </div>
      {K.etat === 'cloturee' ? (
        <div className="vrm-mb-etat is-pret" role="status">
          <b className="vrm-mb-titre-etat" data-cloture-faite="">{K.annee} clôturée le {dateFr(K.clotureeLe)}</b>
          <button type="button" className="vrm-ca-rouvrir" data-cloture-rouvrir="" onClick={rouvrir}>Rouvrir la liste</button>
        </div>
      ) : (<>
        <p className="vrm-ca-phrase">Huit étapes, une par ligne. Touche une ligne pour ouvrir l’écran où la régler ; rien n’est fait à ta place.</p>
        <ul className="vrm-mb-liste">
          {K.etapes.map((e) => {
            const nom = NOMS[e.cle][e.etat === 'ok' ? 1 : 0];
            const sous = sousTexte(e, K);
            const action = typeof portes[e.cle] === 'function' && e.etat !== 'encours';
            const corps = <>
              <Rond e={e} />
              <span className="vrm-mb-l">
                <span className="vrm-mb-nom">{nom}</span>
                {sous ? <span className="vrm-ca-sous">{sous}</span> : null}
              </span>
              {action ? <span className="vrm-mb-chev" aria-hidden="true">›</span> : null}
            </>;
            const attrs = { 'data-cloture-etape': e.cle, 'data-cloture-etape-etat': e.etat, 'data-n': e.n == null ? '' : String(e.n) };
            const aria = `${nom} : ${e.etat === 'ok' ? 'réglé' : e.etat === 'encours' ? 'lecture' : e.etat === 'passu' ? 'pas su' : e.etat === 'na' ? 'sans objet' : 'à faire'}${sous ? ', ' + sous : ''}`;
            return (
              <li key={e.cle} className={'vrm-mb-ligne is-' + (e.etat === 'ok' ? 'ok' : e.etat)}>
                {action ? <button type="button" className="vrm-mb-porte" {...attrs} data-cloture-porte={e.cle} aria-label={aria} onClick={() => ouvrir(e.cle)}>{corps}</button>
                  : <div className="vrm-mb-porte is-inerte" {...attrs} aria-label={aria}>{corps}</div>}
                {e.cle === 'ca' && Array.isArray(e.mois) ? (
                  <ol className="vrm-ca-mois" data-cloture-mois="" aria-label={`Chiffre d’affaires ${K.annee} par mois, daté au versement`}>
                    {e.mois.map((m, i) => (
                      <li key={m.ym} data-cloture-ym={m.ym} data-cts={m.ca == null ? '' : String(Math.round(m.ca * 100))}>
                        <span>{MOIS_COURT[i]}</span><b>{m.ca == null ? '—' : eur(m.ca)}</b>
                      </li>))}
                  </ol>
                ) : null}
                {e.cle === 'adater' && e.n > 0 && Array.isArray(e.raisons) && e.raisons.length ? (
                  <ul className="vrm-ca-raisons" data-cloture-raisons="">
                    {e.raisons.slice(0, 4).map((r) => (
                      <li key={r.cle} data-cloture-raison={r.cle} data-n={r.n}>
                        <span>{nb(r.n)} · {r.cle === 'vinted-detail' ? `Vinted, détail pas encore relu${r.comptes.length ? ' (' + r.comptes.slice(0, 2).map((c) => c.nom).filter(Boolean).join(', ') + ')' : ''}` : r.cle === 'vinted-attente' ? 'Vinted, pas encore finalisée' : r.cle === 'vinted-passu' ? 'Vinted, pas su' : r.cle === 'leboncoin' ? 'Leboncoin, date à recopier' : r.cle === 'vestiaire' ? 'Vestiaire, versement pas lu' : 'eBay, sans date'}</span>
                        {r.cle === 'vinted-detail' ? <a className="vrm-lien-action" href="https://www.vinted.fr/" target="_blank" rel="noopener noreferrer" data-cloture-geste="vinted">Ouvrir Vinted ↗</a> : null}
                      </li>))}
                    {e.toutes > e.n ? <li className="vrm-ca-note">{nb(e.toutes - e.n)} autre{pl(e.toutes - e.n)}, vendue{pl(e.toutes - e.n)} après {K.annee}, ne compte{e.toutes - e.n > 1 ? 'nt' : ''} pas ici.</li> : null}
                  </ul>
                ) : null}
                {e.cle === 'revenus' && e.etat !== 'na' && e.cases ? (
                  <p className="vrm-ca-note" data-cloture-source="">
                    Cases de la notice {NOTICE_LUE.notice} ({NOTICE_LUE.source}, lue le {NOTICE_LUE.lue}).{e.aReverifier ? ` Pour tes revenus ${K.annee}, revérifie la case sur la notice de l’année avant de la reporter.` : ''}
                  </p>
                ) : null}
                {e.cle === 'seuils' && e.seuils ? (
                  <p className="vrm-ca-note">Seuils lus le {e.seuils.verifie} : TVA {eur(e.seuils.tvaBase)} (majoré {eur(e.seuils.tvaMajore)}), micro {eur(e.seuils.plafondVente)} · DAC7 : 30 ventes ou 2 000 € par plateforme.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="vrm-ca-pied">
          <button type="button" className="vrm-ca-fini" data-cloture-fini="" disabled={K.etat === 'encours'} onClick={finir}>J’ai fini</button>
          <span className="vrm-ca-note">{K.aFaire ? `${K.aFaire} à faire` : ''}{K.aFaire && K.passu ? ' · ' : ''}{K.passu ? `${K.passu} pas vérifiée${pl(K.passu)}` : ''}{!K.aFaire && !K.passu && K.etat !== 'encours' ? 'Tout ce que VRM peut vérifier est réglé.' : ''}</span>
        </div>
      </>)}
      {/* Pour l'audit : les montants affichés, en centimes. */}
      <span hidden data-cloture-ca={ca && ca.ca != null ? String(Math.round(ca.ca * 100)) : ''} data-cloture-revenus={rev && rev.ca != null ? String(Math.round(rev.ca * 100)) : ''} data-cloture-cases={rev && rev.cases ? rev.cases.join(',') : ''} />
    </section>
  );
}
