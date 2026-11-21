// ════════════════════════════════════════════════════════════════════════════
//  LA PAGE D'UN PARTENAIRE — lecture seule (15 nov., programme partenaire)
//  `https://vrm.center/pa/<jeton>` → `/?espace-partenaire=<jeton>` : cette page, SANS
//  l'app, sans session, sans aucune écriture. Elle lit `/api/compte?mode=partenaire&j=`
//  (api/_lib/partenaires.js `vuePartenaire`) : son code, son lien, des NOMBRES (inscrits,
//  clients payants, commissions dues / en attente / versées / annulées, mois par mois).
//  Jamais un nom de client, un e-mail, un pseudo. Lien inconnu ou remplacé ⇒ « Ce lien
//  n'est plus valable » (404) ; base injoignable ⇒ « Réessaie » (jamais des zéros).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie, ajouterSourceApp, date as dateLoc } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import frPartenaires from './i18n/langues/fr/partenaires.js';
import './design/studio-polices.css';
import './design/studio.css';
import './partenaires/partenaires.css';

ajouterSourceApp(frPartenaires);
const eur = (c) => (Number.isFinite(c) ? monnaie(c / 100, 'EUR') : '—');
const libelleMois = (m) => (/^\d{4}-\d{2}$/.test(String(m || '')) ? dateLoc(new Date(m + '-15T12:00:00Z'), { month: 'long', year: 'numeric' }) : '—');
export const jetonDeLAdresse = () => { try { const j = new URLSearchParams(window.location.search).get('espace-partenaire') || ''; return /^[A-Za-z0-9_-]{43}$/.test(j) ? j : ''; } catch (_) { return ''; } };

export default function VuePartenaire() {
  useLangue();
  const [R, setR] = React.useState(undefined);
  React.useEffect(() => {
    try {
      const m = document.createElement('meta'); m.name = 'referrer'; m.content = 'no-referrer'; document.head.appendChild(m);
      const r = document.createElement('meta'); r.name = 'robots'; r.content = 'noindex'; document.head.appendChild(r);
      document.title = tr('partenaires.page.titre');
      // Le partenaire n'a pas réglé VRM sur ce navigateur : la page suit le clair / sombre de SON téléphone.
      if (localStorage.getItem('vrm_apparence') == null && localStorage.getItem('vinted_dark') == null && window.matchMedia) {
        document.documentElement.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
    } catch (_) {}
    const j = jetonDeLAdresse();
    if (!j) { setR({ etat: 'lien' }); return; }
    let mort = false;
    fetch(`/api/compte?mode=partenaire&j=${encodeURIComponent(j)}`, { cache: 'no-store', credentials: 'omit' })
      .then(async (r) => { const b = await r.json().catch(() => null); if (mort) return; setR(r.status === 404 ? { etat: 'lien' } : r.ok && b && b.ok && b.chiffres ? { etat: 'lu', ...b } : { etat: 'panne' }); })
      .catch(() => { if (!mort) setR({ etat: 'panne' }); });
    return () => { mort = true; };
  }, []);
  const [copie, setCopie] = React.useState(false);
  if (R === undefined) return <main className="vrm-pp" data-vue-partenaire="encours"><p className="vrm-pp-note">{tr('partenaires.page.lecture')}</p></main>;
  if (R.etat !== 'lu') return <main className="vrm-pp" data-vue-partenaire={R.etat}><p className="sb-surtitre">VRM</p><h1 className="sb-ecran-titre">{tr('partenaires.page.titre')}</h1><p className="vrm-pp-note">{R.etat === 'lien' ? tr('partenaires.page.lienMort') : tr('partenaires.page.panne')}</p></main>;
  const c = R.chiffres, tot = c.totaux || {};
  const copier = async () => { try { await navigator.clipboard.writeText(R.lien); setCopie(true); setTimeout(() => setCopie(false), 1800); } catch (_) {} };
  return (
    <main className="vrm-pp" data-vue-partenaire="lu" data-code={R.code}>
      <p className="sb-surtitre">{tr('partenaires.page.titre')}</p>
      <h1 className="sb-ecran-titre">{tr('partenaires.page.bonjour', { nom: R.nom })}</h1>
      <p className="vrm-pp-note">{tr('partenaires.page.sous', { date: dateLoc(R.au) })}</p>
      {R.pause ? <p className="vrm-pp-pause" role="status" data-pause="1"><span className="sb-point-ambre" aria-hidden="true"/>{tr('partenaires.page.pause')}</p> : null}

      <section className="vrm-pp-carte vrm-pp-tete">
        <div className="vrm-pp-chiffre" data-chiffre="reste" data-centimes={tot.resteCentimes}>
          <span className="sb-chiffre-affiche sb-chiffre-affiche--moyen">{eur(tot.resteCentimes)}</span>
          <span className="vrm-pp-libelle">{tr('partenaires.page.aRecevoir')}</span>
        </div>
        <div className="sb-bande vrm-pt-bande">
          <span><b data-chiffre="inscrits">{c.inscrits}</b><span>{tr('partenaires.bande.inscrits')}</span></span>
          <span><b data-chiffre="payants">{c.payantsActifs ?? '—'}</b><span>{tr('partenaires.bande.payants')}</span></span>
          <span><b data-chiffre="attente" data-centimes={tot.attenteCentimes}>{eur(tot.attenteCentimes)}</b><span>{tr('partenaires.bande.attente')}</span></span>
        </div>
      </section>

      <section className="vrm-pp-carte">
        <p className="vrm-pp-libelle">{tr('partenaires.page.tonLien')} · {tr('partenaires.page.ton.code', { code: R.code })}</p>
        <div className="vrm-pt-lien"><code data-lien-partenaire="">{R.lien}</code>
          <button type="button" className="sb-touche" onClick={copier} aria-pressed={copie} data-copier="">{copie ? tr('partenaires.copie') : tr('partenaires.copier')}</button></div>
      </section>

      <h2 className="vrm-pp-h2">{tr('partenaires.historique')}</h2>
      {!c.mois.length ? <p className="vrm-pp-note" data-mois-vide="">{tr('partenaires.page.vide')}</p> : (
        <div className="vrm-pp-carte vrm-pp-defile">
          <table className="vrm-pp-table" data-mois-n={c.mois.length}>
            <thead><tr><th>{tr('partenaires.page.mois')}</th><th className="n">{tr('partenaires.page.clients')}</th><th className="n">{tr('partenaires.page.dues')}</th><th className="n">{tr('partenaires.page.attente')}</th><th className="n">{tr('partenaires.page.versees')}</th><th className="n">{tr('partenaires.page.annulees')}</th></tr></thead>
            <tbody>{c.mois.map((m) => (
              <tr key={m.mois} data-mois={m.mois} data-due={m.dueCentimes} data-verse={m.verseCentimes}>
                <td>{libelleMois(m.mois)}</td><td className="n" data-l={tr('partenaires.page.clients')}>{m.clientsPayants}</td><td className="n" data-l={tr('partenaires.page.dues')}>{eur(m.dueCentimes)}</td>
                <td className="n" data-l={tr('partenaires.page.attente')}>{eur(m.attenteCentimes)}</td><td className="n" data-l={tr('partenaires.page.versees')}>{eur(m.verseCentimes)}</td><td className="n" data-l={tr('partenaires.page.annulees')}>{m.nAnnulees}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <p className="vrm-pp-note">{tr('partenaires.page.regle', { m: eur(R.commissionCentimes), j: R.delaiJours })}</p>
      <p className="vrm-pp-note vrm-pp-loi" data-loi-influence="">{tr('partenaires.page.loi')}</p>
    </main>
  );
}
