// ══════════════════════════════════════════════════════════════════════════════
//  RETOURS ET LITIGES — L'ASSISTANT (11 nov., lot retours-litiges)
//  Julien : « pour les retours on doit avoir les bordereaux à imprimer aussi ».
//  · `RetoursAchatBloc` (Achats) : une carte par bordereau de retour reçu par e-mail —
//    N°, date limite de dépôt LUE, suivi, remboursement PROUVÉ ou « Pas encore remboursé »,
//    « Imprimer le bordereau » (tamponné « RETOUR · N°… »).
//  · `RetoursAImprimer` : la même liste, en section « Retours » de « Tout imprimer ».
//  · `PasAPasRetour` : la feuille d'une vente en retour / litige (délais avec leur source,
//    ce qu'il fait et quand, ses preuves, « Préparer mon dossier », « Paire revenue »,
//    « Pas la bonne paire / abîmée »).
//  Les règles : src/retoursAchat.js, src/retourPasAPas.js. Textes : tr().
//  Une section ajoutée — les écrans Colis (lot revue-colis) ne sont pas réécrits.
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie } from './i18n/index.js';
import { BoutonBase } from './composants/Bouton.jsx';
import './styles-retours.css';
import { motsVendeur } from './profilVendeur.js';
// (intégration g1) retours-litiges × vocabulaire-article : les textes qui nomment l'article ont une variante
// `.art` (« l’article ») hors Sneakers ; un vendeur Sneakers garde « la paire » mot pour mot.
const AVEC_ART = new Set(['pap.verifier', 'pap.etape.recevoir', 'pap.etape.fait', 'pap.revenue', 'pap.revenueN', 'pap.contester']);
const tv = (k, p) => tr(AVEC_ART.has(k) && motsVendeur().nom !== 'paire' ? k + '.art' : k, p);

const ICONE_RETOUR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
);

const phraseLimite = (c) => {
  if (!c.limiteTexte) return tr('retours.limiteNonLue');
  if (c.depassee) return tr('retours.depassee', { date: c.limiteTexte });
  return c.heure ? tr('retours.avantHeure', { date: c.limiteTexte, heure: c.heure }) : tr('retours.avant', { date: c.limiteTexte });
};
const phraseRemb = (r) => {
  if (!r || r.etat === 'non') return tr('retours.pasRembourse');
  if (r.etat === 'passu') return tr('retours.remboursePasSu');
  if (r.montant == null) return tr('retours.rembourseSansMontant');
  return tr(r.partiel ? 'retours.remboursePartiel' : 'retours.rembourse', { montant: monnaie(r.montant) });
};
const phraseSuivi = (s) => (s && s.n ? `${tr('retours.suivi', { n: s.n })}${s.etat === 'ok' && s.libelle ? ' · ' + s.libelle : s.etat === 'passu' ? ' · ' + tr('retours.suiviPasLu') : ''}` : '');

// Le bouton d'impression : trois états (prêt · préparation · pas imprimé), jamais muet.
function Imprimer({ c, onImprimer, Bouton = BoutonBase, petit = false }) {
  const [etat, setEtat] = React.useState('');
  const go = async () => {
    if (etat === 'encours') return;
    setEtat('encours');
    let r = 'passu';
    try { r = await onImprimer(c); } catch (_) { r = 'passu'; }
    setEtat(r === 'ok' ? '' : 'passu');
  };
  return (
    <span className="vrm-ret-imprimer">
      <Bouton variante="secondaire" taille={petit ? 'petit' : undefined} icone="printer" data-imprime="1" data-retour-imprimer={c.tx} occupe={etat === 'encours'} onClick={go}>
        {etat === 'encours' ? tr('retours.impression') : tr('retours.imprimer')}
      </Bouton>
      {etat === 'passu' ? <span className="vrm-ret-note" role="status" data-retour-pas-imprime={c.tx}>{tr('retours.pasImprime')}</span> : null}
    </span>
  );
}

function CarteRetour({ c, onImprimer, Photo, Bouton }) {
  const P = Photo || (() => null);
  const ph = c.photo || '';
  const tuile = <span className="vrm-ret-tuile" aria-hidden="true">{ICONE_RETOUR}</span>;
  return (
    <article className="vrm-ret-carte" data-retour-achat={c.tx} data-retour-num={c.num || ''} data-retour-limite={c.limiteIso || ''}
      data-retour-presse={c.presse ? '1' : '0'} data-retour-rembourse={c.rembourse.etat} data-retour-montant={c.rembourse.montant != null ? String(c.rembourse.montant) : ''}
      data-retour-relie={c.relie ? '1' : '0'}>
      <div className="vrm-ret-haut">
        {ph ? <P src={ph} alt="" loading="lazy" className="vrm-ret-photo" repli={tuile}/> : tuile}
        <div className="vrm-ret-textes">
          <span className="vrm-ret-num">{c.num ? tr('retours.numero', { n: c.num }) : tr('retours.sansNumero')}</span>
          <span className="vrm-ret-titre" title={c.titre}>{c.titre || tr('retours.article')}</span>
          <span className={'vrm-ret-limite' + (c.presse ? ' is-presse' : '')} data-retour-phrase-limite="">{phraseLimite(c)}</span>
        </div>
      </div>
      <div className="vrm-ret-lignes">
        {c.suivi ? <span className="vrm-ret-ligne" data-retour-suivi={c.suivi} data-retour-suivi-etat={c.statut.etat}>{phraseSuivi(c.statut)}</span> : null}
        <span className={'vrm-ret-ligne' + (c.rembourse.etat === 'oui' ? ' is-ok' : '')} data-retour-phrase-remb="">{phraseRemb(c.rembourse)}</span>
      </div>
      <div className="vrm-ret-gestes">
        {c.pdf ? <Imprimer c={c} onImprimer={onImprimer} Bouton={Bouton}/> : null}
        <a className="vrm-ret-lien" href={`https://www.vinted.fr/member/transactions/${encodeURIComponent(c.tx)}`} target="_blank" rel="noreferrer" data-retour-vinted={c.tx}>{tr('retours.suivre')}</a>
      </div>
    </article>
  );
}

// Achats → « Retours » (au-dessus des listes). `r` : retoursAchat() ; rien à dire ⇒ rien.
export function RetoursAchatBloc({ r, onImprimer, Photo = null, Bouton = BoutonBase }) {
  if (!r || r.etat === 'encours') return null;
  if (r.etat === 'passu') return <p className="vrm-ret-note" data-retours-achat="passu">{tr('retours.passu')}</p>;
  if (!r.cartes.length && !r.anciennes.length) return null;
  return (
    <section className="vrm-ret" data-retours-achat={r.cartes.length} aria-label={tr('retours.titre')}>
      <h2 className="vrm-ret-h2">{tr('retours.titre')} <span>{r.cartes.length}</span></h2>
      <div className="vrm-ret-grille">{r.cartes.map((c) => <CarteRetour key={c.cle} c={c} onImprimer={onImprimer} Photo={Photo} Bouton={Bouton}/>)}</div>
      {r.anciennes.length ? (
        <details className="vrm-repli vrm-ret-anciens" data-retours-anciens={r.anciennes.length}>
          <summary>{tr('retours.anciens', { n: r.anciennes.length })}</summary>
          <div className="vrm-ret-grille">{r.anciennes.map((c) => <CarteRetour key={c.cle} c={c} onImprimer={onImprimer} Photo={Photo} Bouton={Bouton}/>)}</div>
        </details>
      ) : null}
      {r.manques.length ? <p className="vrm-ret-note" data-retours-manques={r.manques.join('|')}>{tr('retours.manques', { liste: r.manques.join(', ') })}</p> : null}
    </section>
  );
}

// « Tout imprimer » → section « Retours » : les bordereaux de retour pas encore remboursés.
export function RetoursAImprimer({ r, onImprimer, Bouton = BoutonBase }) {
  if (!r || r.etat !== 'lu') return null;
  const l = r.cartes.filter((c) => c.pdf && c.rembourse.etat !== 'oui');
  if (!l.length) return null;
  return (
    <section className="vrm-tip-groupe vrm-ret-tip" data-lot-section="retours">
      <h3>{tr('retours.titre')} <span>{l.length}</span></h3>
      {l.map((c) => (
        <div key={c.cle} className="vrm-ret-tip-ligne" data-lot-retour={c.tx}>
          <span className="vrm-ret-tip-corps">
            <b>{c.num ? tr('retours.numero', { n: c.num }) : tr('retours.sansNumero')}</b>
            <span className="vrm-ret-titre">{c.titre || tr('retours.article')}</span>
            <span className={'vrm-ret-limite' + (c.presse ? ' is-presse' : '')}>{phraseLimite(c)}</span>
          </span>
          <Imprimer c={c} onImprimer={onImprimer} Bouton={Bouton} petit/>
        </div>
      ))}
    </section>
  );
}

const MOT_PREUVE = { transaction: 'pap.prouve.transaction', email: 'pap.prouve.email', 'commande+email': 'pap.prouve.deux', ebay: 'pap.prouve.ebay' };
const MOT_SOURCE = { email: 'pap.source.email', ebay: 'pap.source.ebay', 'non-ecrite': 'pap.source.nonEcrite', 'regle-vinted': 'pap.source.regle' };
const ETAPES = ['repondre', 'attendre', 'recevoir', 'recu', 'rembourse', 'fait'];

// La feuille « Pas à pas ». `p` : pasAPasVente(c, { retour }). `Feuille` : la SheetShell de l'app.
export function PasAPasRetour({ c, p, Feuille, onClose, onRevenue, onDossier, Bouton = BoutonBase }) {
  const [dossier, setDossier] = React.useState('');
  const [revenue, setRevenue] = React.useState('');
  if (!c || !p || !Feuille) return null;
  const faireDossier = async () => {
    if (dossier === 'encours' || !onDossier) return;
    setDossier('encours');
    let r = 'passu'; try { r = await onDossier(c, { avecBordereau: false }); } catch (_) { r = 'passu'; }
    setDossier(r === 'ok' ? 'ok' : 'passu');
  };
  const faireRevenue = async () => {
    if (!p.revenue.possible || !onRevenue) return;
    let r = false; try { r = await onRevenue(c); } catch (_) { r = false; }
    if (r) setRevenue('ok');
  };
  return (
    <Feuille onClose={onClose} maxWidth={560} z={9100} titre={tr('pap.titre')} className="vrm-pap" data-pap={c.cle} data-pap-etape={p.etape} aria-label={tr('pap.titre')}>
      <p className="vrm-pap-preuve" data-pap-preuve={p.preuve}>{c.num ? tr('retours.numero', { n: c.num }) + ' · ' : ''}{tr(MOT_PREUVE[p.preuve] || MOT_PREUVE.transaction)}</p>
      <section className="vrm-pap-bloc" aria-label={tr('pap.delais')}>
        <h3>{tr('pap.delais')}</h3>
        {p.delais.map((d) => (
          <div key={d.quoi} className="vrm-pap-ligne" data-pap-delai={d.quoi} data-pap-source={d.source} data-pap-quand={d.quand || ''}>
            <span>{d.quoi === 'repondre' ? (d.quand ? tr('pap.repondreAvant', { date: d.quand }) : tr('pap.repondreNonEcrite')) : tv('pap.verifier', { n: d.jours })}</span>
            <small>{tr(MOT_SOURCE[d.source])}</small>
          </div>
        ))}
      </section>
      <section className="vrm-pap-bloc" aria-label={tr('pap.ceQueTuFais')}>
        <h3>{tr('pap.ceQueTuFais')}</h3>
        <ol className="vrm-pap-etapes">
          {ETAPES.filter((e) => e !== 'repondre' || p.etape === 'repondre').map((e) => (
            <li key={e} className={e === p.etape ? 'is-la' : ETAPES.indexOf(e) < ETAPES.indexOf(p.etape) ? 'is-fait' : ''} data-pap-etape-li={e}>{tv('pap.etape.' + e)}</li>
          ))}
        </ol>
      </section>
      <section className="vrm-pap-bloc" aria-label={tr('pap.preuves')}>
        <h3>{tr('pap.preuves')}</h3>
        <div className="vrm-pap-ligne" data-pap-carton={p.preuves.carton}><span>{tr('pap.carton')}</span><b>{p.preuves.carton === 'ok' ? '✓' : '—'}</b></div>
        <div className="vrm-pap-ligne" data-pap-bordereau={p.preuves.bordereau}><span>{tr('pap.bordereau')}</span><b>{p.preuves.bordereau === 'ok' ? '✓' : '—'}</b></div>
        {onDossier ? (
          <div className="vrm-pap-gestes">
            <Bouton variante="secondaire" icone="download" occupe={dossier === 'encours'} data-pap-dossier={dossier || 'pret'} onClick={faireDossier}>{tr('pap.dossier')}</Bouton>
            {dossier === 'ok' ? <span className="vrm-ret-note" role="status">{tr('pap.dossierOk')}</span> : dossier === 'passu' ? <span className="vrm-ret-note" role="status">{tr('pap.dossierPasSu')}</span> : null}
          </div>
        ) : null}
      </section>
      <section className="vrm-pap-bloc" aria-label={tr('pap.reception')}>
        <h3>{tr('pap.reception')}</h3>
        <div className="vrm-pap-gestes">
          {revenue === 'ok' || p.revenue.raison === 'deja-remise'
            ? <span className="vrm-ret-note is-ok" data-pap-remise="">{tr('pap.dejaRemise')}</span>
            : <Bouton variante="primaire" icone="check" disabled={!p.revenue.possible} data-pap-revenue={p.revenue.possible ? p.revenue.num : ''} onClick={faireRevenue}>{p.revenue.possible ? tv('pap.revenueN', { n: p.revenue.num }) : tv('pap.revenue')}</Bouton>}
          {p.contester ? <Bouton variante="secondaire" href={p.contester.url} target="_blank" rel="noreferrer" data-pap-contester={p.contester.url}>{tv('pap.contester')} ↗</Bouton> : null}
        </div>
        {!p.revenue.possible && p.revenue.raison !== 'deja-remise' && revenue !== 'ok' ? <p className="vrm-ret-note" data-pap-revenue-raison={p.revenue.raison}>{tr(p.revenue.raison === 'sans-numero' ? 'pap.sansNumero' : 'pap.pasDeColis')}</p> : null}
        {p.contester ? <p className="vrm-ret-note">{tr('pap.contesterAide')}</p> : null}
      </section>
    </Feuille>
  );
}

// Le bouton « Pas à pas » posé sur une carte de litige.
export function BoutonPasAPas({ c, onOuvrir }) {
  return (
    <button type="button" className="vrm-pap-ouvrir" data-pap-ouvrir={c.cle} onClick={() => onOuvrir(c)}>
      {ICONE_RETOUR}<span>{tr('pap.ouvrir')}</span>
    </button>
  );
}
