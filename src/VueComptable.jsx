// ════════════════════════════════════════════════════════════════════════════
//  LA PAGE DE SON COMPTABLE — lecture seule (14 nov., lot argent-prix — 115)
//  `https://vrm.center/c/<jeton>` → `/?comptable=<jeton>` : cette page, SANS l'app,
//  sans session, sans aucune écriture. Elle lit `/api/compte?mode=comptable&j=` et
//  montre ce que le serveur a gardé (api/_lib/comptable-lien.js `vueComptable`, la
//  compta SEULE : CA déclaré par mois, déclarations notées, livre des recettes,
//  ventes à dater, registre des achats). Lien expiré, coupé, inconnu ⇒ « Ce lien
//  n'est plus valable » (404) ; base injoignable ⇒ « Réessaie » (jamais une compta
//  vide). Aucun lien sortant, aucun nom de personne.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie, ajouterSourceApp, date as dateLoc } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import frArgentPrix from './i18n/langues/fr/argentprix.js';
import './argent-prix.css';

ajouterSourceApp(frArgentPrix);
const eur = (v) => (v == null ? '—' : monnaie(Number(v), 'EUR'));
export const jetonDeLAdresse = () => { try { const j = new URLSearchParams(window.location.search).get('comptable') || ''; return /^[A-Za-z0-9_.-]{40,80}$/.test(j) ? j : ''; } catch (_) { return ''; } };

export default function VueComptable() {
  useLangue();
  const [R, setR] = React.useState(undefined);
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    try { const m = document.createElement('meta'); m.name = 'referrer'; m.content = 'no-referrer'; document.head.appendChild(m); const r = document.createElement('meta'); r.name = 'robots'; r.content = 'noindex'; document.head.appendChild(r); } catch (_) {}
    const j = jetonDeLAdresse();
    if (!j) { setR({ etat: 'lien' }); return; }
    let mort = false;
    fetch(`/api/compte?mode=comptable&j=${encodeURIComponent(j)}`, { cache: 'no-store', credentials: 'omit' })
      .then(async (r) => { const b = await r.json().catch(() => null); if (mort) return; setR(r.status === 404 ? { etat: 'lien' } : r.ok && b && Array.isArray(b.vues) ? { etat: 'lu', ...b } : { etat: 'panne' }); })
      .catch(() => { if (!mort) setR({ etat: 'panne' }); });
    return () => { mort = true; };
  }, []);
  if (R === undefined) return <main className="vrm-vc" data-vue-comptable="encours"><p className="vrm-vc-note">{tr('ap.lecture')}</p></main>;
  if (R.etat !== 'lu') return <main className="vrm-vc" data-vue-comptable={R.etat}><h1>{tr('ap.vc.titre')}</h1><p className="vrm-vc-note">{R.etat === 'lien' ? tr('ap.vc.lienMort') : tr('ap.vc.panne')}</p></main>;
  const vues = R.vues;
  const v = vues[Math.min(i, vues.length - 1)];
  if (!v) return <main className="vrm-vc" data-vue-comptable="vide"><h1>{tr('ap.vc.titre')}</h1><p className="vrm-vc-note">{tr('ap.vc.rien')}</p></main>;
  const am = (x) => (x ? tr('ap.auMoins') + ' ' : '');
  return (
    <main className="vrm-vc" data-vue-comptable="lu" data-vc-periode={v.periode}>
      <h1>{v.entreprise && v.entreprise.nom ? v.entreprise.nom : tr('ap.vc.titre')}</h1>
      <p className="vrm-vc-note">{tr('ap.vc.sous', { date: v.etabliLe || '' })}{v.entreprise && v.entreprise.siret ? ` · SIRET ${v.entreprise.siret}` : ''} · {v.regimeTexte || '—'}</p>
      {vues.length > 1 ? <div className="vrm-vc-onglets" role="group" aria-label={tr('ap.vc.periodes')}>{vues.map((x, k) => <button key={x.periode} type="button" aria-pressed={x === v} data-vc-onglet={x.periode} onClick={() => setI(k)}>{x.libelle}</button>)}</div> : null}
      <h2>{v.libelle}</h2>
      <div className="vrm-vc-chiffre" data-vc-ca={v.caDeclare == null ? '' : Math.round(v.caDeclare * 100)}>{am(v.partielCa)}{eur(v.caDeclare)}</div>
      <p className="vrm-vc-note">{tr('ap.vc.caDeclare')}{v.regime === 'micro' ? ` · ${tr('ap.vc.urssaf', { m: am(v.partielCa) + eur(v.urssaf), t: String(v.taux).replace('.', ',') })}` : ''}</p>
      {v.caParMois ? <>
        <h2>{tr('ap.vc.parMois')}</h2>
        <div className="vrm-vc-defile"><table className="vrm-vc-table"><thead><tr><th>{tr('ap.vc.mois')}</th><th className="n">{tr('ap.vc.ventes')}</th><th className="n">{tr('ap.vc.ca')}</th><th>{tr('ap.vc.declare')}</th></tr></thead>
          <tbody>{v.caParMois.map((m) => <tr key={m.ym} data-vc-mois={m.ym}><td>{m.mois}</td><td className="n">{m.n}</td><td className="n">{eur(m.ca)}</td><td>{m.declare ? tr('ap.vc.oui') : ''}</td></tr>)}</tbody></table></div>
      </> : null}
      <h2>{tr('ap.vc.recettes', { n: v.nVentes == null ? '—' : v.nVentes })}</h2>
      <p className="vrm-vc-note">{tr('ap.vc.total', { m: am(!v.ventesCompletes) + eur(v.totalVentes) })}</p>
      {v.ventes ? <div className="vrm-vc-defile"><table className="vrm-vc-table" data-vc-ventes={v.ventes.length}><thead><tr><th>{tr('ap.vc.dateVente')}</th><th>{tr('ap.vc.dateVersement')}</th><th>{tr('ap.vc.plateforme')}</th><th>N°</th><th>{tr('ap.vc.reference')}</th><th>{tr('ap.vc.article')}</th><th className="n">{tr('ap.vc.montant')}</th><th className="n">{tr('ap.vc.frais')}</th></tr></thead>
        <tbody>{v.ventes.map((x, k) => <tr key={k}><td>{x.dateVente}</td><td>{x.dateVersement}</td><td>{x.plateforme}</td><td>{x.num}</td><td>{x.reference}</td><td>{x.titre}</td><td className="n">{eur(x.montant)}</td><td className="n">{eur(x.frais)}</td></tr>)}</tbody></table></div> : <p className="vrm-vc-note">—</p>}
      {v.aDater && v.aDater.length ? <>
        <h2>{tr('ap.vc.aDater', { n: v.aDater.length })}</h2>
        <div className="vrm-vc-defile"><table className="vrm-vc-table"><thead><tr><th>{tr('ap.vc.dateVente')}</th><th>{tr('ap.vc.plateforme')}</th><th>N°</th><th>{tr('ap.vc.article')}</th><th className="n">{tr('ap.vc.montant')}</th></tr></thead>
          <tbody>{v.aDater.map((x, k) => <tr key={k}><td>{x.dateVente}</td><td>{x.plateforme}</td><td>{x.num}</td><td>{x.titre}</td><td className="n">{eur(x.montant)}</td></tr>)}</tbody></table></div>
      </> : null}
      <h2>{tr('ap.vc.achats', { n: v.nAchats == null ? '—' : v.nAchats })}</h2>
      <p className="vrm-vc-note">{tr('ap.vc.coutSaisi', { m: am(!!v.sansCout) + eur(v.coutSaisi) })}</p>
      {v.achats ? <div className="vrm-vc-defile"><table className="vrm-vc-table" data-vc-achats={v.achats.length}><thead><tr><th>{tr('ap.vc.date')}</th><th>{tr('ap.vc.plateforme')}</th><th>{tr('ap.vc.reference')}</th><th>N°</th><th>{tr('ap.vc.article')}</th><th className="n">{tr('ap.vc.saisi')}</th><th className="n">{tr('ap.vc.lu')}</th></tr></thead>
        <tbody>{v.achats.map((x, k) => <tr key={k}><td>{x.date}</td><td>{x.plateforme}</td><td>{x.reference}</td><td>{x.num}</td><td>{x.titre}</td><td className="n">{eur(x.saisi)}</td><td className="n">{eur(x.lu)}</td></tr>)}</tbody></table></div> : <p className="vrm-vc-note">—</p>}
      <p className="vrm-vc-note" style={{ marginTop: 24 }}>{tr('ap.vc.pied', { date: R.exp ? dateLoc(new Date(R.exp)) : '—' })}</p>
    </main>
  );
}
