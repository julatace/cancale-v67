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
import { tr, monnaie, localeCourante } from './i18n/index.js';
import { quandLimite, etapesRetour, joursAvantLimite } from './retoursAchat.js';
import { lienSuivi } from '../api/_lib/suivi-colis.js';   // (15 nov., lot retours-suivi) la page publique du transporteur (adresses attestées)
import { LogoTransporteur, LogoInconnu } from './PastilleTransporteur.jsx';
import { BoutonBase } from './composants/Bouton.jsx';
import './styles-retours.css';
import { motsVendeur } from './profilVendeur.js';
import { attrCible } from './cibleNotif.js';   // (15 nov.) la notification « À renvoyer » ouvre CETTE carte
// (intégration g1) retours-litiges × vocabulaire-article : les textes qui nomment l'article ont une variante
// `.art` (« l’article ») hors Sneakers ; un vendeur Sneakers garde « la paire » mot pour mot.
const AVEC_ART = new Set(['pap.verifier', 'pap.etape.recevoir', 'pap.etape.fait', 'pap.revenue', 'pap.revenueN', 'pap.contester']);
const tv = (k, p) => tr(AVEC_ART.has(k) && motsVendeur().nom !== 'paire' ? k + '.art' : k, p);

const ICONE_RETOUR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
);

const phraseSuivi = (s) => (s && s.n ? `${tr('retours.suivi', { n: s.n })}${s.etat === 'ok' && s.libelle ? ' · ' + s.libelle : s.etat === 'passu' ? ' · ' + tr('retours.suiviPasLu') : ''}` : '');

// (15 nov., lot retours) « Quand » en mots : « avant demain 10 h », « avant lun. 23 nov. 10 h »,
// « d'ici le 23 nov. » (l'avis n'écrit pas d'heure : on n'en invente pas). Heure de Paris.
const dateMots = (jour) => {
  const t = Date.parse(String(jour || '') + 'T12:00:00Z'); if (!isFinite(t)) return '';
  try { return new Date(t).toLocaleDateString(localeCourante(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }); } catch (_) { return ''; }
};
export function phraseQuand(c, now = Date.now()) {
  const q = quandLimite(c, now);
  if (!q) return tr('renv.quand.nonLue');
  const date = dateMots(q.jour), h = q.heure;
  if (q.cle === 'passee') return tr('renv.quand.passee', { date });
  if (q.cle === 'auj') return h ? tr('renv.quand.aujH', { h }) : tr('renv.quand.auj');
  if (q.cle === 'demain') return h ? tr('renv.quand.demainH', { h }) : tr('renv.quand.demain');
  return h ? tr('renv.quand.dateH', { date, h }) : tr('renv.quand.date', { date });
}
const dateCourte = (iso) => { const t = Date.parse(String(iso || '')); if (!isFinite(t)) return ''; try { return new Date(t).toLocaleDateString(localeCourante(), { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }); } catch (_) { return ''; } };

// Le nom d'un transporteur (sa clé). (15 nov., lot retour-parfait) La phrase « où en est le retour » est devenue
// les ÉTAPES (`EtapesRetour`, plus bas) : chaque coche prouvée, jamais deux fois la même date sur la carte.
const NOMS_TRANSP = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go', colissimo: 'Colissimo', laposte: 'La Poste', ups: 'UPS', dpd: 'DPD', gls: 'GLS', relaiscolis: 'Relais Colis', shop2shop: 'Shop2Shop', inpost: 'InPost' };
export const nomTransp = (cle) => NOMS_TRANSP[String(cle || '').toLowerCase()] || '';
// D'où vient le fait : « lu dans l'e-mail Mondial Relay » / « lu chez Mondial Relay ».
function sourceFait(c) {
  const f = c.faits; if (!f) return '';
  const n = nomTransp(c.transporteur || f.carrier);
  return f.source === 'email' ? (n ? tr('renv.source.email', { t: n }) : tr('renv.source.emailSans')) : (n ? tr('renv.source.transp', { t: n }) : tr('renv.source.transpSans'));
}

// Le n° de suivi du retour : le logo du transporteur, le n° (un toucher = copié), « Suivre ↗ » vers la page
// PUBLIQUE du transporteur (adresse attestée seulement ; une simple recherche n'est jamais proposée).
function LigneSuiviRetour({ c }) {
  const [copie, setCopie] = React.useState(false);
  if (!c.suivi) return null;
  const cle = String(c.transporteur || (c.faits && c.faits.carrier) || '').toLowerCase();
  const l = cle ? lienSuivi(cle, c.suivi) : null;
  const copier = async () => { try { await navigator.clipboard.writeText(c.suivi); setCopie(true); setTimeout(() => setCopie(false), 1600); } catch (_) { setCopie(false); } };
  return (
    <div className="vrm-renv-suivi" data-retour-suivi-ligne={c.suivi} data-retour-transporteur={cle || ''}>
      <span className="vrm-renv-logo" title={nomTransp(cle) || undefined}>{cle ? <LogoTransporteur cle={cle} taille={20} repli={<LogoInconnu taille={20}/>}/> : <LogoInconnu taille={20}/>}</span>
      <button type="button" className="sb-lien vrm-renv-copier" data-retour-copier={c.suivi} aria-label={tr('renv.copierAria', { n: c.suivi })} onClick={copier}>
        {copie ? tr('renv.copie') : tr('retours.suivi', { n: c.suivi })}
      </button>
      {l && l.site ? <a className="sb-lien vrm-ret-lien" href={l.url} target="_blank" rel="noreferrer" data-retour-suivre={l.url}>{tr('renv.suivre')}</a> : null}
    </div>
  );
}

// Le bouton d'impression : quatre états (prêt · préparation · à ouvrir · pas imprimé), jamais muet.
// (15 nov., lot retour-parfait) Sur iPhone, la feuille de partage (« Imprimer ») ne s'ouvre que DANS le
// toucher : le PDF tamponné est donc PRÉPARÉ dès que la carte s'affiche (`onPreparer`), et le toucher
// l'ouvre sans rien attendre. Pas encore prêt au moment du toucher ⇒ préparé, puis « Ouvrir le
// bordereau » (SON second toucher) — jamais un téléchargement muet.
function Imprimer({ c, onImprimer, onPreparer = null }) {
  const [etat, setEtat] = React.useState('');
  React.useEffect(() => {
    if (onPreparer && c.pdf) { try { const p = onPreparer(c); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.cle, c.num, c.titre, c.pdf]);
  const fin = (r) => setEtat(r === 'ok' ? '' : r === 'bouton' ? 'bouton' : 'passu');
  const go = () => {
    if (etat === 'encours') return;
    let p; try { p = onImprimer(c); } catch (_) { p = 'passu'; }
    if (!p || typeof p.then !== 'function') { fin(p); return; }
    setEtat('encours');
    p.then(fin, () => fin('passu'));
  };
  return (
    <span className="vrm-ret-imprimer">
      <button type="button" className="sb-touche vrm-renv-imprimer" data-imprime="1" data-retour-imprimer={c.tx} data-retour-imprimer-etat={etat || 'pret'} aria-pressed={etat === 'encours' ? 'true' : undefined} aria-busy={etat === 'encours' ? 'true' : undefined} onClick={go}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg>
        <span>{etat === 'encours' ? tr('retours.impression') : etat === 'bouton' ? tr('renv.pdf.ouvrir') : tr('retours.imprimer')}</span>
      </button>
      {etat === 'bouton' ? <span className="vrm-ret-note" role="status" data-retour-pdf-pret={c.tx}>{tr('renv.pdf.pret')}</span> : null}
      {etat === 'passu' ? <span className="vrm-ret-note" role="status" data-retour-pas-imprime={c.tx}>{tr('retours.pasImprime')}</span> : null}
    </span>
  );
}

// (15 nov., lot retour-parfait) Les étapes du retour jusqu'au remboursement (la maquette « Verre dépoli ») :
// chaque coche est PROUVÉE (src/retoursAchat.js `etapesRetour`) ; une étape passée sans preuve est grisée.
const COCHE = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>;
function texteEtapeRetour(e) {
  if (e.cle === 'bordereau') return { lib: tr(e.etat === 'ici' ? 'renv.et.bordereauAttendu' : 'renv.et.bordereau'), det: nomTransp(e.transporteur) };
  if (e.cle === 'deposer') return e.etat === 'fait' || e.etat === 'saute'
    ? { lib: tr('renv.et.depose'), det: [dateCourte(e.at), e.parLui ? tr('renv.et.parToi') : ''].filter(Boolean).join(' · ') }
    : { lib: tr('renv.et.deposer'), det: '' };
  if (e.cle === 'route') return { lib: tr(e.revient ? 'renv.et.revient' : 'renv.et.route'), det: '' };
  if (e.cle === 'livre') return { lib: tr(e.relais && e.etat === 'ici' ? 'renv.et.relais' : 'renv.et.livre'), det: dateCourte(e.at) };
  const det = e.etat === 'fait' ? (e.montant != null ? monnaie(e.montant) : '') : e.etat === 'ici' ? tr('renv.et.sous2j') : '';
  return { lib: tr('renv.et.rembourse'), det };
}
function EtapesRetour({ c }) {
  const l = etapesRetour(c);
  if (!l.length) return null;
  return (
    <ol className="vrm-renv-etapes" aria-label={tr('renv.et.titre')} data-retour-etapes="" data-retour-phrase-etape={c.etape}>
      {l.map((e) => {
        const { lib, det } = texteEtapeRetour(e);
        const partiel = e.cle === 'rembourse' && e.etat === 'fait' && c.rembourse && c.rembourse.partiel && e.montant != null;
        return (
          <li key={e.cle} className={'vrm-renv-et is-' + e.etat} data-retour-et={e.cle} data-retour-et-etat={e.etat} aria-current={e.etat === 'ici' ? 'step' : undefined}>
            <i aria-hidden="true">{e.etat === 'fait' ? COCHE : null}</i>
            <b>{lib}</b>
            {det ? <span data-retour-et-detail="">{partiel ? tr('renv.et.partiel', { montant: det }) : det}</span> : null}
          </li>);
      })}
    </ol>
  );
}

// La bande de la date limite (ambre : un geste à faire) — « À déposer avant lun. 23 nov. 10 h » ·
// « dans 8 jours · sinon tu gardes l'article et le vendeur est payé » (la règle écrite par Vinted).
function BandeLimite({ c, now }) {
  const q = quandLimite(c, now);
  const n = joursAvantLimite(c, now);
  const sous = q && q.cle !== 'passee' ? [n != null && n >= 2 ? tr('renv.bande.dans', { n }) : '', tr('renv.bande.sinon')].filter(Boolean).join(' · ') : '';
  return (
    <div className={'vrm-renv-bande' + (c.presse || c.depassee ? ' is-presse' : '')} data-retour-bande={q ? q.cle : 'nonLue'}>
      <span className="vrm-renv-bande-ic" aria-hidden="true">{ICONE_RETOUR}</span>
      <div className="vrm-renv-bande-txt">
        <b>{q && q.cle !== 'passee' ? <>{tr('renv.bande.a')} </> : null}<span className={'vrm-ret-limite' + (c.presse || c.depassee ? ' is-presse' : '')} data-retour-phrase-limite="">{phraseQuand(c, now)}</span></b>
        {sous ? <span data-retour-bande-sous="">{sous}</span> : null}
      </div>
    </div>
  );
}

// Sans PDF rangé : POURQUOI, et LE geste (jamais un bouton muet).
function SansPdf({ c }) {
  const s = c.sansPdf; if (!s) return null;
  if (s.raison === 'pdf-absent') return <p className="vrm-ret-note" data-retour-sans-pdf="pdf-absent">{tr('renv.sansPdf.pdfAbsent', { date: dateCourte(s.emailLe) || '—' })}</p>;
  if (s.raison === 'contredit') return <p className="vrm-ret-note" data-retour-sans-pdf="contredit">{tr('renv.sansPdf.contredit')}</p>;
  return <p className="vrm-ret-note" data-retour-sans-pdf="pas-recu">{tr('renv.sansPdf.pasRecu')}</p>;
}

// UNE carte « À renvoyer » (Achats et Ma journée) : photo + titre (par identité ; un avis sans
// identité dit « d'après l'e-mail »), compte, N°, quand (ambre < 48 h), où il en est, puis les gestes :
// « Imprimer le bordereau » (le PDF rangé) · « Déposé » (SON clic, enfoncé + diode) · Vinted.
// (15 nov., lot retour-parfait) La carte de la maquette « Verre dépoli » : en tête la photo, le titre, le
// compte ; la bande ambre de la date limite (tant qu'il n'est pas déposé) ; les ÉTAPES jusqu'au
// remboursement (Achats ; Ma journée garde la carte courte : la bande et les gestes) ; le n° de suivi
// (logo, copier, « Suivre ↗ ») ; « Imprimer le bordereau » (le PDF préparé à l'avance) et « Déposé ».
export function CarteRenvoyer({ c, onImprimer, onPreparer = null, onDepose = null, Photo = null, now, compact = false }) {
  const P = Photo || (() => null);
  const ph = c.photo || '';
  const tuile = <span className="vrm-ret-tuile" aria-hidden="true">{ICONE_RETOUR}</span>;
  const meta = [c.num ? tr('retours.numero', { n: c.num }) : '', c.nomCompte ? tr('renv.compte', { c: c.nomCompte }) : '', c.source === 'avis' ? tr('renv.dApresEmail') : ''].filter(Boolean).join(' · ');
  const aDeposer = c.etape === 'a-deposer' || c.etape === 'depose';
  // La date limite n'est dite que tant qu'il n'est pas déposé (ni noté par lui, ni lu chez le transporteur).
  // (15 nov., lot retour-parfait) … ni tant que les e-mails de son transporteur ne sont pas lus (il est peut-être parti).
  const montrerLimite = c.etape === 'a-deposer' && !c.faitsEnCours;
  const src = sourceFait(c);
  return (
    <article className={'vrm-ret-carte vrm-renv-carte' + (compact ? ' is-compact' : '')} data-cible={attrCible(['retour', c.tx], ['achat', c.tx])} data-retour-achat={c.tx || ''} data-retour-cle={c.cle} data-retour-source={c.source || 'bordereau'}
      data-retour-num={c.num || ''} data-retour-limite={c.limiteIso || ''} data-retour-presse={c.presse ? '1' : '0'} data-retour-etape={c.etape || ''}
      data-retour-pdf={c.pdf ? '1' : '0'} data-retour-rembourse={c.rembourse.etat} data-retour-montant={c.rembourse.montant != null ? String(c.rembourse.montant) : ''}
      data-retour-relie={c.relie ? '1' : '0'} data-retour-avis={c.avis ? c.avis.id : ''} data-retour-fait={c.faits ? c.faits.source : ''} data-retour-suivi={c.suivi || ''} data-retour-transporteur-carte={String(c.transporteur || (c.faits && c.faits.carrier) || '').toLowerCase()}>
      <div className="vrm-ret-haut">
        {ph ? <P src={ph} alt="" loading="lazy" className="vrm-ret-photo" repli={tuile}/> : tuile}
        <div className="vrm-ret-textes">
          <span className="vrm-ret-titre" title={c.titre}>{c.titre || tr('retours.article')}</span>
          {meta ? <span className="vrm-ret-meta">{meta}</span> : null}
        </div>
      </div>
      {montrerLimite ? <BandeLimite c={c} now={now}/> : null}
      {!compact ? <EtapesRetour c={c}/> : null}
      {src || c.suiviPartage || c.faitsPasSu || (c.suivi && !c.faits && c.statut.etat === 'ok' && c.statut.libelle) ? (
        <div className="vrm-ret-lignes">
          {src ? <span className="vrm-ret-ligne" data-retour-source-fait={c.faits.source}>{src}</span> : null}
          {c.suivi && !c.faits && c.statut.etat === 'ok' && c.statut.libelle ? <span className="vrm-ret-ligne" data-retour-suivi-etat={c.statut.etat}>{phraseSuivi(c.statut)}</span> : null}
          {c.suiviPartage ? <span className="vrm-ret-ligne" data-retour-suivi-partage="">{tr('renv.suiviPartage')}</span> : c.faitsPasSu ? <span className="vrm-ret-ligne" data-retour-suivi-pas-su="">{tr('renv.suiviPasLu')}</span> : null}
        </div>) : null}
      {/* (16 nov., intégration de claude/retour-parfait) Les étapes jusqu'au remboursement : UNE liste, `EtapesRetour` (plus
          haut, à la même place), chaque coche prouvée avec sa date et sa source — la frise simplifiée de la vague A
          (src/ventesVerre.js `etapesRetour`) la redisait juste dessous : retirée ici (une chose dite une fois, §7). */}
      <LigneSuiviRetour c={c}/>
      <SansPdf c={c}/>
      <div className="vrm-ret-gestes">
        {c.pdf && aDeposer ? <Imprimer c={c} onImprimer={onImprimer} onPreparer={onPreparer}/> : null}
        {/* « Déposé » : SON geste tant qu'aucun fait du transporteur n'est lu ; un fait lu le remplace. */}
        {onDepose && aDeposer && !c.faits && (c.pdf || c.depose) ? (
          <button type="button" className="sb-touche vrm-renv-depose" aria-pressed={c.depose ? 'true' : 'false'} data-retour-depose={c.cle} onClick={() => onDepose(c.cle)}>
            {COCHE}<span>{tr('renv.depose')}</span>
          </button>) : null}
        <a className="sb-lien vrm-ret-lien" href={c.vinted} target="_blank" rel="noreferrer" data-retour-vinted={c.tx || c.conv || ''}>{c.pdf ? tr('renv.vinted') : tr('renv.sansPdf.geste')}</a>
      </div>
    </article>
  );
}
// Achats → « À renvoyer » (au-dessus des listes). `r` : retoursAchat() ; rien à dire ⇒ rien.
// `sansAchatsSeuls` : sur « Tous », l'achat « à renvoyer » SANS bordereau a déjà sa carte et son lien dans la liste.
export function RetoursAchatBloc({ r: rBrut, onImprimer, onPreparer = null, onDepose = null, Photo = null, now, sansAchatsSeuls = false }) {
  const r = sansAchatsSeuls && rBrut && rBrut.etat === 'lu' ? { ...rBrut, cartes: rBrut.cartes.filter((c) => c.source !== 'achat') } : rBrut;
  if (!r || r.etat === 'encours') return null;
  if (r.etat === 'passu') return <p className="vrm-ret-note" data-retours-achat="passu">{tr('retours.passu')}</p>;
  if (!r.cartes.length && !r.anciennes.length) return r.manques.length ? <p className="vrm-ret-note" data-retours-manques={r.manques.join('|')}>{tr('retours.manques', { liste: r.manques.join(', ') })}</p> : null;
  return (
    <section className="vrm-ret" data-retours-achat={r.cartes.length} data-a-renvoyer-n={r.aRenvoyer.length} aria-label={tr('renv.titre')}>
      <h2 className="vrm-ret-h2">{tr('renv.titre')} <span>{r.cartes.length}</span></h2>
      <div className="vrm-ret-grille">{r.cartes.map((c) => <CarteRenvoyer key={c.cle} c={c} onImprimer={onImprimer} onPreparer={onPreparer} onDepose={onDepose} Photo={Photo} now={now}/>)}</div>
      {r.anciennes.length ? (
        <details className="vrm-repli vrm-ret-anciens" data-retours-anciens={r.anciennes.length}>
          <summary>{tr('retours.anciens', { n: r.anciennes.length })}</summary>
          <div className="vrm-ret-grille">{r.anciennes.map((c) => <CarteRenvoyer key={c.cle} c={c} onImprimer={onImprimer} Photo={Photo} now={now}/>)}</div>
        </details>
      ) : null}
      {r.manques.length ? <p className="vrm-ret-note" data-retours-manques={r.manques.join('|')}>{tr('retours.manques', { liste: r.manques.join(', ') })}</p> : null}
    </section>
  );
}

// Ma journée → « À renvoyer (N) » EN TÊTE tant qu'un retour attend son dépôt (le plus pressé
// d'abord) : la même carte qu'Achats, trois au plus, puis « Voir les N retours ».
export function ARenvoyerJournee({ r, onImprimer, onPreparer = null, onDepose = null, Photo = null, onVoir = null, now }) {
  if (!r || r.etat !== 'lu' || !r.aRenvoyer.length) return null;
  const l = r.aRenvoyer, vus = l.slice(0, 3);
  return (
    <section className="vrm-ret vrm-renv-journee" data-a-renvoyer-journee={l.length} aria-label={tr('renv.titreN', { n: l.length })}>
      <h2 className="vrm-ret-h2">{tr('renv.titre')} <span>{l.length}</span></h2>
      <div className="vrm-ret-grille">{vus.map((c) => <CarteRenvoyer key={c.cle} c={c} onImprimer={onImprimer} onPreparer={onPreparer} onDepose={onDepose} Photo={Photo} now={now} compact/>)}</div>
      {onVoir ? <button type="button" className="sb-lien vrm-renv-voir" data-a-renvoyer-voir={l.length} onClick={onVoir}>{tr('renv.voirTous', { n: l.length })} ›</button> : null}
    </section>
  );
}

// (16 nov. 2026, lot impression-retours) LES RETOURS DANS LE LOT D'IMPRESSION. Julien : « Les colis imprimés tu peux
// mettre le retour, mais il faut bien préciser que c'est un retour et pas une vente. » Une section à part, titrée
// « Retour · tu renvoies un achat », chaque ligne marquée RETOUR (pastille neutre ; ambre seulement si la date
// limite de dépôt approche — jamais rouge, §7), son N° (par l'achat, jamais deviné), le vendeur à qui il renvoie
// (lu sur l'achat relié par le n°, sinon rien) et « À déposer … » (la date LUE, sinon rien). Une case : cochée ⇒
// le bordereau part dans le MÊME PDF que les ventes, tamponné RETOUR. Jamais compté dans « à envoyer ».
// `lignes` : `lignesRetoursLot` · `coches` : Set des clés cochées · `onBascule(cle)` · `Case` : la case de l'écran hôte.
export function RetoursLot({ lignes, coches, onBascule, Case = null, attrs = {}, now = Date.now() }) {
  const L = Array.isArray(lignes) ? lignes : [];
  if (!L.length) return null;
  const n = L.filter((l) => coches && coches.has(l.cle)).length;
  return (
    <section className="vrm-tip-groupe vrm-ret-tip vrm-ret-lot" data-lot-section="retours" data-retours-lot={L.length} data-retours-coches={n} aria-label={tr('impr.retour.section')} {...attrs}>
      <h3><span className="vrm-ret-mot" data-retour-mot="">{tr('impr.retour.mot')}</span> {tr('impr.retour.sousTitre')} <span>{L.length}</span></h3>
      {L.map((l) => {
        const c = l.carte || l, coche = !!(coches && coches.has(l.cle)), q = quandLimite(c, now);
        const ambre = !!(q && (c.presse || c.depassee));
        const lab = tr('impr.retour.caseAria', { qui: l.num ? tr('retours.numero', { n: l.num }) : (l.titre || tr('retours.article')) });
        return (
          <div key={l.cle} className={'vrm-ret-tip-ligne vrm-ret-lot-ligne' + (coche ? ' is-on' : '')} data-lot-retour={l.tx} data-lot-ligne={l.cle} data-lot-site="retour" data-coche={coche ? '1' : '0'} data-retour-ambre={ambre ? '1' : '0'}>
            {Case ? <Case coche={coche} onBascule={() => onBascule && onBascule(l.cle)} label={lab} attrs={{ 'data-retour-coche': l.cle }}/>
              : <input type="checkbox" className="vrm-tip-case" data-retour-coche={l.cle} checked={coche} aria-label={lab} onChange={() => onBascule && onBascule(l.cle)}/>}
            <span className="vrm-ret-tip-corps">
              <span className="vrm-ret-lot-tete">
                <span className={'vrm-ret-pastille' + (ambre ? ' is-presse' : '')} data-retour-pastille="">{tr('impr.retour.mot')}</span>
                <b data-retour-num={l.num || ''}>{l.num ? tr('retours.numero', { n: l.num }) : tr('retours.sansNumero')}</b>
              </span>
              <span className="vrm-ret-titre">{l.titre || tr('retours.article')}</span>
              {l.vendeur ? <span className="vrm-ret-vendeur" data-retour-vendeur={l.vendeur}>{tr('impr.retour.vendeur', { qui: l.vendeur })}</span> : null}
              {q ? <span className={'vrm-ret-limite' + (ambre ? ' is-presse' : '')} data-retour-limite={c.limiteIso || ''}>{q.cle !== 'passee' ? tr('renv.bande.a') + ' ' : ''}{phraseQuand(c, now)}</span> : null}
              {l.imprime ? <span className="vrm-ret-sous" data-retour-imprime="">{tr('impr.retour.dejaImprime')}</span> : null}
            </span>
          </div>
        );
      })}
    </section>
  );
}

// « Choisir ce qui part » → la section des retours (les mêmes lignes, la même case que l'écran).
// `r` : le résultat des retours (gardé pour l'appel d'avant) ; `lignes`/`coches`/`onBascule` : le lot.
export function RetoursAImprimer({ r, lignes = null, coches = null, onBascule = null, Case = null }) {
  if (!r || r.etat !== 'lu' || !Array.isArray(lignes)) return null;
  return <RetoursLot lignes={lignes} coches={coches} onBascule={onBascule} Case={Case}/>;
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
    <button type="button" className="sb-touche vrm-pap-ouvrir" data-pap-ouvrir={c.cle} onClick={() => onOuvrir(c)}>
      {ICONE_RETOUR}<span>{tr('pap.ouvrir')}</span>
    </button>
  );
}

// ── (15 nov., refonte-journee — Julien : « tu peux mettre litige achat, vente ensemble ici ») ──────────────────
// Ma journée → UN bloc « Retours et litiges » : côté ACHAT (à renvoyer, en route vers le vendeur), côté VENTE (en route
// vers toi, revenu chez toi), les litiges et transactions suspendues. Une ligne par article : photo, N° (connu par
// identité), le sens (« tu renvoies » / « on te renvoie » / « litige »), l'étape et la date, UN geste. Les lignes sont
// préparées par Ma journée (les MÊMES règles qu'Achats, Colis et les litiges : src/retoursAchat.js, src/retoursStock.js,
// src/litiges.js) ; ce composant ne décide rien.
export function RetoursLitigesJournee({ lignes, Photo = null, max = 5, onVoirTout = null, attrs = null }) {
  const l = Array.isArray(lignes) ? lignes : [];
  if (!l.length) return null;
  const vus = l.slice(0, max);
  return (
    <section className="vrm-rl" data-retours-litiges={String(l.length)} aria-label={tr('rl.titre')} {...(attrs || {})}>
      <h2 className="vrm-rl-h2">{tr('rl.titre')} <span>· {l.length}</span></h2>
      <div className="vrm-rl-liste" role="list">
        {vus.map((x) => (
          <div key={x.cle} role="listitem" className="vrm-rl-ligne" data-rl-sens={x.sens} data-rl-cle={x.cle} data-rl-num={x.num || ''}>
            <span className="vrm-rl-ph" aria-hidden="true">{x.photo && Photo ? <Photo src={x.photo} alt="" loading="lazy" decoding="async" width={44} height={44}/> : null}</span>
            <span className="vrm-rl-mid">
              <span className="vrm-rl-l1">{x.num ? <span className="sb-plaque vrm-rl-pq"><small>N°</small>{x.num}</span> : null}<b>{x.titre || tr('retours.article')}</b></span>
              <span className={'vrm-rl-l2' + (x.ambre ? ' is-ambre' : '')}><span className="vrm-rl-sens">{tr('rl.sens.' + x.sens)}</span> · {x.etapeTexte}</span>
            </span>
            {x.geste ? <button type="button" className="sb-touche vrm-rl-geste" onClick={x.geste.faire} {...(x.geste.attrs || {})}>{x.geste.txt}</button> : null}
          </div>
        ))}
      </div>
      {l.length > vus.length && onVoirTout ? <button type="button" className="sb-lien vrm-rl-tout" data-rl-tout={String(l.length)} onClick={onVoirTout}>{tr('sortir.autres', { n: l.length - vus.length })} ›</button> : null}
    </section>
  );
}

// Achats → « À vérifier » : les retours sans nouvelles depuis plus de 7 jours après la date limite (`retourPerime`).
// Une phrase claire, « Voir sur Vinted », et « C'est réglé » (SON clic) qui l'archive.
export function RetoursAVerifier({ perimes, onRegle, Photo = null }) {
  const l = Array.isArray(perimes) ? perimes : [];
  if (!l.length) return null;
  return (
    <section className="vrm-ret vrm-ret-verif" data-retours-a-verifier={String(l.length)} aria-label={tr('rl.verif.titre')}>
      <h2 className="vrm-ret-h2">{tr('rl.verif.titre')} <span>{l.length}</span></h2>
      {l.map((c) => (
        <div key={c.cle} className="vrm-ret-verif-ligne" data-retour-perime={c.cle}>
          <span className="vrm-rl-ph" aria-hidden="true">{c.achat && c.achat.photo && Photo ? <Photo src={typeof c.achat.photo === 'string' ? c.achat.photo : (c.achat.photo.url || '')} alt="" loading="lazy" decoding="async" width={44} height={44}/> : null}</span>
          <span className="vrm-rl-mid">
            <span className="vrm-rl-l1">{c.num ? <span className="sb-plaque vrm-rl-pq"><small>N°</small>{c.num}</span> : null}<b>{c.titre || tr('retours.article')}</b></span>
            <span className="vrm-rl-l2">{tr('rl.verif.phrase', { d: c.limiteTexte || '' })}</span>
          </span>
          <span className="vrm-ret-verif-gestes">
            {c.vinted ? <a className="sb-lien" href={c.vinted} target="_blank" rel="noreferrer">{tr('rl.verif.vinted')}</a> : null}
            <button type="button" className="sb-touche" data-retour-regle={c.cle} onClick={() => onRegle && onRegle(c.cle)}>{tr('rl.verif.regle')}</button>
          </span>
        </div>
      ))}
    </section>
  );
}
