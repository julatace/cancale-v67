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
import './natif/actions.css';
import './styles-retours-cartes.css';   // (23 nov., lot retours-suivi) la carte refaite : gris clair, carte blanche, aucun orange
import { motsVendeur } from './profilVendeur.js';
import { attrCible } from './cibleNotif.js';   // (15 nov.) la notification « À renvoyer » ouvre CETTE carte
// (intégration g1) retours-litiges × vocabulaire-article : les textes qui nomment l'article ont une variante
// `.art` (« l’article ») hors Sneakers ; un vendeur Sneakers garde « la paire » mot pour mot.
const AVEC_ART = new Set(['pap.verifier', 'pap.etape.recevoir', 'pap.etape.fait', 'pap.revenue', 'pap.revenueN', 'pap.contester']);
const tv = (k, p) => tr(AVEC_ART.has(k) && motsVendeur().nom !== 'paire' ? k + '.art' : k, p);

const ICONE_RETOUR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
);


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

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  (23 nov., lot retours-suivi — Julien, captures iPhone d'Achats → « À renvoyer » : « je veux que tu fasses le suivi
//  des colis retournés ») LA CARTE D'UN RETOUR, REFAITE. Gris clair, carte blanche, AUCUN orange : l'urgence se dit à
//  l'encre (gras, étiquette au contour), jamais en couleur. Une carte = la tête (photo, titre, N°, étiquette), UNE ligne
//  d'état (« Date limite de dépôt dépassée · lun. 23 nov. 10 h »), au plus une phrase courte (le détail sous
//  « Pourquoi ? »), la frise HORIZONTALE des 5 étapes (une étape postérieure prouvée coche les précédentes « date pas
//  vue », src/retoursAchat.js `etapesRetour`), le n° de suivi (logo, un toucher = copié), puis des VRAIS boutons
//  (icône + verbe : Imprimer, Déposé, Suivre, Vinted — la forme des boutons communs, `n-actions` / `n-bouton`).
//  Plus aucun bouton hors d'une carte : tout geste vit DANS sa carte. Les repères `data-retour-*` sont ceux d'avant.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
const IC = {
  imprimer: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg>,
  depose: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>,
  suivre: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>,
  externe: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>,
  copier: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>,
};

// Une « Pourquoi ? » repliée (la forme commune `n-pourquoi`) : le texte long n'est pas à l'écran tant qu'on ne le demande pas.
function PourquoiRetour({ children, attrs = null }) {
  if (!children) return null;
  return (
    <details className="n-pourquoi vrm-rt-pq" data-n-pourquoi="" {...(attrs || {})}>
      <summary>{tr('rt.pourquoi')}</summary>
      <div className="n-pourquoi-texte">{children}</div>
    </details>
  );
}

// Un lien qui ouvre un site, à la forme EXACTE d'un bouton commun (`n-bouton`, icône + verbe).
function LienBouton({ href, icone, plein = false, attrs = null, children }) {
  return (
    <span className="n-bouton-bloc">
      <a className="n-bouton n-action vrm-rt-a" data-n-variante={plein ? 'plein' : 'teinte'} href={href} target="_blank" rel="noreferrer" {...(attrs || {})}>
        <span className="n-bouton-icone" aria-hidden="true">{icone}</span><span className="n-bouton-libelle">{children}</span>
      </a>
    </span>
  );
}

// Le n° de suivi du retour : le logo du transporteur, le n° (un toucher = copié). « Suivre » est un bouton de la carte.
function LigneSuiviRetour({ c }) {
  const [copie, setCopie] = React.useState(false);
  if (!c.suivi) return null;
  const cle = String(c.transporteur || (c.faits && c.faits.carrier) || '').toLowerCase();
  const copier = async () => { try { await navigator.clipboard.writeText(c.suivi); setCopie(true); setTimeout(() => setCopie(false), 1600); } catch (_) { setCopie(false); } };
  return (
    <div className="vrm-rt-suivi" data-retour-suivi-ligne={c.suivi} data-retour-transporteur={cle || ''}>
      <span className="vrm-rt-logo" title={nomTransp(cle) || undefined}>{cle ? <LogoTransporteur cle={cle} taille={18} repli={<LogoInconnu taille={18}/>}/> : <LogoInconnu taille={18}/>}</span>
      <button type="button" className="sb-lien vrm-rt-copier" data-retour-copier={c.suivi} aria-label={tr('renv.copierAria', { n: c.suivi })} onClick={copier}>
        <span>{copie ? tr('renv.copie') : c.suivi}</span>{copie ? null : IC.copier}
      </button>
    </div>
  );
}
// L'adresse publique de suivi du transporteur (attestée seulement ; jamais une simple recherche).
const lienSuiviRetour = (c) => {
  if (!c.suivi) return null;
  const cle = String(c.transporteur || (c.faits && c.faits.carrier) || '').toLowerCase();
  const l = cle ? lienSuivi(cle, c.suivi) : null;
  return l && l.site ? l.url : null;
};

// Le bouton d'impression : quatre états (prêt · préparation · à ouvrir · pas imprimé), jamais muet.
// (15 nov., lot retour-parfait) Sur iPhone, la feuille de partage (« Imprimer ») ne s'ouvre que DANS le
// toucher : le PDF tamponné est donc PRÉPARÉ dès que la carte s'affiche (`onPreparer`), et le toucher
// l'ouvre sans rien attendre. Pas encore prêt au moment du toucher ⇒ préparé, puis « Ouvrir » (SON second
// toucher) — jamais un téléchargement muet. La phrase d'état se pose sous les boutons (`onEtat`).
function Imprimer({ c, onImprimer, onPreparer = null, plein = false, onEtat }) {
  const [etat, setEtat] = React.useState('');
  React.useEffect(() => {
    if (onPreparer && c.pdf) { try { const p = onPreparer(c); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.cle, c.num, c.titre, c.pdf]);
  React.useEffect(() => { if (onEtat) onEtat(etat); }, [etat]);   // eslint-disable-line react-hooks/exhaustive-deps
  const fin = (r) => setEtat(r === 'ok' ? '' : r === 'bouton' ? 'bouton' : 'passu');
  const go = () => {
    if (etat === 'encours') return;
    let p; try { p = onImprimer(c); } catch (_) { p = 'passu'; }
    if (!p || typeof p.then !== 'function') { fin(p); return; }
    setEtat('encours');
    p.then(fin, () => fin('passu'));
  };
  return (
    <span className="n-bouton-bloc vrm-ret-imprimer">
      <button type="button" className="n-bouton n-action vrm-renv-imprimer" data-n-variante={plein ? 'plein' : 'teinte'} data-imprime="1" data-retour-imprimer={c.tx} data-retour-imprimer-etat={etat || 'pret'}
        aria-busy={etat === 'encours' ? 'true' : undefined} onClick={go}>
        {etat === 'encours' ? <span className="n-roue" aria-hidden="true"/> : <span className="n-bouton-icone" aria-hidden="true">{IC.imprimer}</span>}
        <span className="n-bouton-libelle">{etat === 'encours' ? tr('rt.a.impression') : etat === 'bouton' ? tr('renv.pdf.ouvrir') : tr('rt.a.imprimer')}</span>
      </button>
    </span>
  );
}

// La frise HORIZONTALE des étapes (5 ronds reliés). Plein + coche = prouvé et daté ; contour + coche = fait, « date
// pas vue » (impliqué par une étape plus loin) ; rond pointé = où il en est ; creux = à venir ; pointillé = passé
// sans preuve. Chaque libellé est court ; le détail (date, montant) dessous, jamais une date inventée.
const COCHE = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>;
function texteEtapeRetour(e, c) {
  const pasVue = e.implicite ? tr('rt.f.datePasVue') : '';
  if (e.cle === 'bordereau') return { lib: tr('rt.f.bordereau'), det: e.etat === 'ici' ? tr('rt.f.attendu') : pasVue || nomTransp(e.transporteur) };
  if (e.cle === 'deposer') return e.etat === 'fait' || e.etat === 'saute'
    ? { lib: tr('rt.f.depose'), det: pasVue || [dateCourte(e.at), e.parLui ? tr('rt.f.parToi') : ''].filter(Boolean).join(' · ') }
    : { lib: tr('rt.f.depose'), det: e.etat === 'ici' && c && c.limiteJour ? tr('rt.f.avant', { date: dateCourte(c.limiteIso) }) : '' };
  if (e.cle === 'route') return { lib: tr(e.revient ? 'rt.f.revient' : 'rt.f.route'), det: pasVue };
  if (e.cle === 'livre') return { lib: tr(e.relais && e.etat === 'ici' ? 'rt.f.relais' : 'rt.f.livre'), det: pasVue || dateCourte(e.at) };
  const det = e.etat === 'fait' ? (e.montant != null ? monnaie(e.montant) : dateCourte(e.at)) : e.etat === 'ici' ? tr('renv.et.sous2j') : '';
  return { lib: tr('rt.f.rembourse'), det };
}
function EtapesRetour({ c }) {
  const l = etapesRetour(c);
  if (!l.length) return null;
  return (
    <ol className="vrm-rt-frise" aria-label={tr('renv.et.titre')} data-retour-etapes="" data-retour-phrase-etape={c.etape}>
      {l.map((e) => {
        const { lib, det } = texteEtapeRetour(e, c);
        const partiel = e.cle === 'rembourse' && e.etat === 'fait' && c.rembourse && c.rembourse.partiel && e.montant != null;
        return (
          <li key={e.cle} className={'vrm-rt-et is-' + e.etat + (e.implicite ? ' is-implicite' : '')} data-retour-et={e.cle} data-retour-et-etat={e.etat} data-retour-et-implicite={e.implicite ? '1' : '0'} aria-current={e.etat === 'ici' ? 'step' : undefined}>
            <i aria-hidden="true">{e.etat === 'fait' ? COCHE : null}</i>
            <b>{lib}</b>
            {det ? <span data-retour-et-detail="">{partiel ? tr('renv.et.partiel', { montant: det }) : det}</span> : null}
          </li>);
      })}
    </ol>
  );
}

// La LIGNE D'ÉTAT de la carte : un titre (où il en est), ce qui va à droite (la date), au plus une phrase courte (≤ 8 mots)
// et sa « Pourquoi ? ». Une seule source : la carte (`c`, src/retoursAchat.js) — rien n'est recalculé ici.
function etatCarte(c, now) {
  const q = quandLimite(c, now);
  const f = c.faits;
  const montrerLimite = c.etape === 'a-deposer' && !c.faitsEnCours;
  if (montrerLimite) {
    if (q && q.cle === 'passee') return { cle: 'depassee', tag: 'depassee', titre: tr('rt.etat.depassee'), droite: [dateMots(q.jour), q.heure].filter(Boolean).join(' · '), court: tr('rt.court.depassee'), pq: tr('rt.pq.depassee'), bande: 'passee' };
    const n = joursAvantLimite(c, now);
    return { cle: 'a-deposer', tag: 'a-deposer', titre: q ? <>{tr('renv.bande.a')} <span className={'vrm-ret-limite' + (c.presse ? ' is-presse' : '')} data-retour-phrase-limite="">{phraseQuand(c, now)}</span></> : tr('renv.bande.a'),
      droite: q && n != null && n >= 2 ? tr('renv.bande.dans', { n }) : '', court: q ? tr('rt.court.sinon') : tr('renv.quand.nonLue'), pq: q ? tr('rt.pq.sinon') : '', bande: q ? q.cle : 'nonLue' };
  }
  if (c.etape === 'rembourse') {
    const r = c.rembourse || {};
    const titre = r.montant != null ? tr(r.partiel ? 'rt.etat.remboursePartiel' : 'rt.etat.rembourse', { montant: monnaie(r.montant) }) : tr('rt.etat.rembourseSans');
    const impl = etapesRetour(c).some((e) => e.implicite);
    return { cle: 'rembourse', tag: 'rembourse', titre, droite: dateCourte(r.at), court: impl ? tr('rt.court.implicite') : '', pq: impl ? tr('rt.pq.implicite') : '' };
  }
  const src = sourceFait(c);
  if (c.etape === 'recu-vendeur') return { cle: 'livre', tag: 'livre', titre: tr('renv.et.livre'), droite: f ? dateCourte(f.at) : '', court: tr('rt.court.sous2j'), pq: src };
  if (c.etape === 'relais-vendeur') return { cle: 'relais', tag: 'route', titre: tr('renv.et.relais'), droite: f && f.at ? tr('rt.depuis', { date: dateCourte(f.at) }) : '', court: src };
  if (c.etape === 'revient') return { cle: 'revient', tag: 'route', titre: tr('renv.et.revient'), droite: f ? dateCourte(f.at) : '', court: src };
  if (c.etape === 'en-route') return { cle: 'route', tag: 'route', titre: tr('renv.et.route'), droite: f && f.deposeAt ? tr('rt.deposeLe', { date: dateCourte(f.deposeAt) }) : '', court: src };
  if (c.etape === 'depose') return { cle: 'depose', tag: 'depose', titre: tr('rt.etat.deposeToi'), droite: c.depose ? dateCourte(c.depose.le) : '', court: c.faitsPasSu ? tr('renv.suiviPasLu') : '' };
  return { cle: 'lecture', tag: 'a-deposer', titre: tr('rt.etat.lecture'), droite: '', court: '' };
}
const TAGS = { 'a-deposer': ['rt.tag.aDeposer', 'gris'], depassee: ['rt.tag.depassee', 'contour'], route: ['rt.tag.route', 'teal'], depose: ['rt.tag.depose', 'gris'], livre: ['rt.tag.livre', 'vert'], rembourse: ['rt.tag.rembourse', 'vert'] };

// Sans PDF rangé : POURQUOI (replié), en une phrase courte.
function sansPdfCourt(c) {
  const s = c.sansPdf; if (!s) return null;
  if (s.raison === 'pdf-absent') return { cle: 'pdf-absent', court: tr('rt.court.pdfAbsent'), pq: tr('renv.sansPdf.pdfAbsent', { date: dateCourte(s.emailLe) || '—' }) };
  if (s.raison === 'contredit') return { cle: 'contredit', court: tr('rt.court.contredit'), pq: tr('renv.sansPdf.contredit') };
  return { cle: 'pas-recu', court: tr('rt.court.pasRecu'), pq: tr('renv.sansPdf.pasRecu') };
}

// UNE carte « À renvoyer » (Achats et Ma journée). `principal` : c'est la carte qui porte LE geste plein de l'écran.
// `compact` (Ma journée) : la tête, l'état, les boutons — sans la frise ni le n°.
export function CarteRenvoyer({ c, onImprimer, onPreparer = null, onDepose = null, Photo = null, now, compact = false, principal = false }) {
  const [etatImpr, setEtatImpr] = React.useState('');
  const P = Photo || (() => null);
  const ph = c.photo || '';
  const tuile = <span className="vrm-rt-tuile" aria-hidden="true">{ICONE_RETOUR}</span>;
  const meta = [c.nomCompte ? tr('renv.compte', { c: c.nomCompte }) : '', c.source === 'avis' ? tr('renv.dApresEmail') : ''].filter(Boolean).join(' · ');
  const aDeposer = c.etape === 'a-deposer' || c.etape === 'depose';
  const e = etatCarte(c, now);
  const sp = sansPdfCourt(c);
  const partage = c.suiviPartage ? { court: tr('rt.court.partage'), pq: tr('renv.suiviPartage') } : null;
  const court = partage ? partage.court : sp && aDeposer ? sp.court : e.court;
  const pq = partage ? partage.pq : sp && aDeposer ? sp.pq : e.pq;
  const [tagCle, tagTon] = TAGS[e.tag] || TAGS['a-deposer'];
  const suivre = lienSuiviRetour(c);
  // Les boutons : LE geste d'abord (plein si la carte est la principale), puis les autres.
  const boutons = [];
  const depasse = e.cle === 'depassee';
  if (aDeposer && depasse) boutons.push(<LienBouton key="v" href={c.vinted} icone={IC.externe} plein={principal} attrs={{ 'data-retour-vinted': c.tx || c.conv || '' }}>{tr('rt.a.vinted')}</LienBouton>);
  if (c.pdf && aDeposer) boutons.push(<Imprimer key="i" c={c} onImprimer={onImprimer} onPreparer={onPreparer} plein={principal && !depasse} onEtat={setEtatImpr}/>);
  // « Déposé » : SON geste tant qu'aucun fait du transporteur n'est lu ; un fait lu le remplace.
  if (onDepose && aDeposer && !c.faits && (c.pdf || c.depose)) boutons.push(
    <span key="d" className="n-bouton-bloc">
      <button type="button" className="n-bouton n-action vrm-renv-depose" data-n-variante="teinte" aria-pressed={c.depose ? 'true' : 'false'} data-retour-depose={c.cle} onClick={() => onDepose(c.cle)}>
        <span className="n-bouton-icone" aria-hidden="true">{IC.depose}</span><span className="n-bouton-libelle">{tr('rt.a.depose')}</span>
      </button>
    </span>);
  if (suivre && c.etape !== 'a-deposer') boutons.push(<LienBouton key="s" href={suivre} icone={IC.suivre} plein={principal} attrs={{ 'data-retour-suivre': suivre }}>{tr('rt.a.suivre')}</LienBouton>);
  if (!(aDeposer && depasse)) boutons.push(<LienBouton key="v" href={c.vinted} icone={IC.externe} plein={principal && !c.pdf && aDeposer && !boutons.length} attrs={{ 'data-retour-vinted': c.tx || c.conv || '' }}>{tr('rt.a.vinted')}</LienBouton>);
  return (
    <article className={'vrm-rt-carte' + (compact ? ' is-compact' : '')} data-cible={attrCible(['retour', c.tx], ['achat', c.tx])} data-retour-achat={c.tx || ''} data-retour-cle={c.cle} data-retour-source={c.source || 'bordereau'}
      data-retour-num={c.num || ''} data-retour-limite={c.limiteIso || ''} data-retour-presse={c.presse ? '1' : '0'} data-retour-etape={c.etape || ''} data-retour-etat-carte={e.cle}
      data-retour-pdf={c.pdf ? '1' : '0'} data-retour-rembourse={c.rembourse.etat} data-retour-montant={c.rembourse.montant != null ? String(c.rembourse.montant) : ''}
      data-retour-relie={c.relie ? '1' : '0'} data-retour-avis={c.avis ? c.avis.id : ''} data-retour-fait={c.faits ? c.faits.source : ''} data-retour-suivi={c.suivi || ''} data-retour-transporteur-carte={String(c.transporteur || (c.faits && c.faits.carrier) || '').toLowerCase()}>
      <div className="vrm-rt-tete">
        {ph ? <P src={ph} alt="" loading="lazy" className="vrm-ret-photo vrm-rt-photo" repli={tuile}/> : tuile}
        <div className="vrm-rt-textes">
          <span className="vrm-ret-titre vrm-rt-titre" title={c.titre}>{c.titre || tr('retours.article')}</span>
          <span className="vrm-ret-meta vrm-rt-meta">{c.num ? <span className="vrm-rt-num" data-retour-plaque=""><small>N°</small>{c.num}</span> : null}{meta ? <span>{meta}</span> : null}</span>
        </div>
        <span className={'vrm-rt-tag is-' + tagTon} data-retour-tag={e.tag}>{tr(tagCle)}</span>
      </div>
      <div className="vrm-rt-etat" {...(e.bande ? { 'data-retour-bande': e.bande } : {})}>
        <b>{e.titre}</b>
        {e.droite ? <span className="vrm-rt-droite" {...(e.bande ? { 'data-retour-bande-sous': '' } : {})} {...(e.cle === 'depassee' ? { 'data-retour-phrase-limite': '' } : {})}>{e.droite}</span> : null}
      </div>
      {court ? (
        <div className="vrm-rt-court" {...(c.faits && !partage && !(sp && aDeposer) ? { 'data-retour-source-fait': c.faits.source } : {})}
          {...(partage ? { 'data-retour-suivi-partage': '' } : sp && aDeposer ? { 'data-retour-sans-pdf': sp.cle } : (c.faitsPasSu && c.etape === 'depose') ? { 'data-retour-suivi-pas-su': '' } : {})}>
          <span>{court}</span>
          <PourquoiRetour>{pq}</PourquoiRetour>
        </div>) : null}
      {!compact ? <EtapesRetour c={c}/> : null}
      {!compact ? <LigneSuiviRetour c={c}/> : null}
      {boutons.length ? <div className="n-actions vrm-rt-actions" data-n-actions={boutons.length}>{boutons}</div> : null}
      {etatImpr === 'bouton' ? <span className="vrm-rt-note" role="status" data-retour-pdf-pret={c.tx}>{tr('renv.pdf.pret')}</span> : null}
      {etatImpr === 'passu' ? <span className="vrm-rt-note" role="status" data-retour-pas-imprime={c.tx}>{tr('retours.pasImprime')}</span> : null}
    </article>
  );
}
// La carte qui porte LE geste plein : le premier retour qui attend SON geste (à déposer), sinon aucune.
const indexPrincipal = (cartes) => (cartes || []).findIndex((c) => c && c.etape === 'a-deposer' && !c.faitsEnCours);

// Achats → « À renvoyer » (au-dessus des listes). `r` : retoursAchat() ; rien à dire ⇒ rien.
// `sansAchatsSeuls` : sur « Tous », l'achat « à renvoyer » SANS bordereau a déjà sa carte et son lien dans la liste.
export function RetoursAchatBloc({ r: rBrut, onImprimer, onPreparer = null, onDepose = null, Photo = null, now, sansAchatsSeuls = false }) {
  const r = sansAchatsSeuls && rBrut && rBrut.etat === 'lu' ? { ...rBrut, cartes: rBrut.cartes.filter((c) => c.source !== 'achat') } : rBrut;
  if (!r || r.etat === 'encours') return null;
  if (r.etat === 'passu') return <p className="vrm-ret-note" data-retours-achat="passu">{tr('retours.passu')}</p>;
  if (!r.cartes.length && !r.anciennes.length) return r.manques.length ? <p className="vrm-ret-note" data-retours-manques={r.manques.join('|')}>{tr('retours.manques', { liste: r.manques.join(', ') })}</p> : null;
  const ip = indexPrincipal(r.cartes);
  return (
    <section className="vrm-rt" data-retours-achat={r.cartes.length} data-a-renvoyer-n={r.aRenvoyer.length} aria-label={tr('renv.titre')}>
      <h2 className="vrm-rt-h2">{tr('renv.titre')} <span>{r.cartes.length}</span></h2>
      <div className="vrm-rt-grille">{r.cartes.map((c, i) => <CarteRenvoyer key={c.cle} c={c} onImprimer={onImprimer} onPreparer={onPreparer} onDepose={onDepose} Photo={Photo} now={now} principal={i === ip}/>)}</div>
      {r.anciennes.length ? (
        <details className="vrm-rt-anciens" data-retours-anciens={r.anciennes.length}>
          <summary>{tr('retours.anciens', { n: r.anciennes.length })}</summary>
          <div className="vrm-rt-grille">{r.anciennes.map((c) => <CarteRenvoyer key={c.cle} c={c} onImprimer={onImprimer} Photo={Photo} now={now}/>)}</div>
        </details>
      ) : null}
      {r.manques.length ? <p className="vrm-ret-note" data-retours-manques={r.manques.join('|')}>{tr('retours.manques', { liste: r.manques.join(', ') })}</p> : null}
    </section>
  );
}

// Ma journée → « À renvoyer (N) » EN TÊTE tant qu'un retour attend son dépôt (le plus pressé
// d'abord) : la même carte qu'Achats (courte), trois au plus, puis « Voir les N retours ».
export function ARenvoyerJournee({ r, onImprimer, onPreparer = null, onDepose = null, Photo = null, onVoir = null, now }) {
  if (!r || r.etat !== 'lu' || !r.aRenvoyer.length) return null;
  const l = r.aRenvoyer, vus = l.slice(0, 3);
  return (
    <section className="vrm-rt vrm-renv-journee" data-a-renvoyer-journee={l.length} aria-label={tr('renv.titreN', { n: l.length })}>
      <h2 className="vrm-rt-h2">{tr('renv.titre')} <span>{l.length}</span></h2>
      <div className="vrm-rt-grille">{vus.map((c, i) => <CarteRenvoyer key={c.cle} c={c} onImprimer={onImprimer} onPreparer={onPreparer} onDepose={onDepose} Photo={Photo} now={now} compact principal={i === 0}/>)}</div>
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
// `section` : « retours » dans « Choisir » (la feuille), « retours-ecran » sous la liste d'À envoyer — jamais deux fois le même repère.
export function RetoursLot({ lignes, coches, onBascule, Case = null, attrs = {}, now = Date.now(), section = 'retours-ecran' }) {
  const L = Array.isArray(lignes) ? lignes : [];
  if (!L.length) return null;
  const n = L.filter((l) => coches && coches.has(l.cle)).length;
  return (
    <section className="vrm-ret-lot" data-lot-section={section} data-retours-lot={L.length} data-retours-coches={n} aria-label={tr('impr.retour.section')} {...attrs}>
      <h3><b className="vrm-ret-mot" data-retour-mot="">{tr('impr.retour.mot')}</b> {tr('impr.retour.sousTitre')} <em className="vrm-ret-lot-n">{L.length}</em></h3>
      {L.map((l) => {
        const c = l.carte || l, coche = !!(coches && coches.has(l.cle)), q = quandLimite(c, now);
        const ambre = !!(q && (c.presse || c.depassee));
        const lab = tr('impr.retour.caseAria', { qui: l.num ? tr('retours.numero', { n: l.num }) : (l.titre || tr('retours.article')) });
        return (
          <div key={l.cle} className={'vrm-ret-lot-ligne' + (coche ? ' is-on' : '')} data-lot-retour={l.tx} data-lot-ligne={l.cle} data-lot-site="retour" data-coche={coche ? '1' : '0'} data-retour-ambre={ambre ? '1' : '0'}>
            {Case ? <Case coche={coche} onBascule={() => onBascule && onBascule(l.cle)} label={lab} attrs={{ 'data-retour-coche': l.cle }}/>
              : <input type="checkbox" className="vrm-tip-case" data-retour-coche={l.cle} checked={coche} aria-label={lab} onChange={() => onBascule && onBascule(l.cle)}/>}
            <span className="vrm-ret-lot-corps">
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
  return <RetoursLot lignes={lignes} coches={coches} onBascule={onBascule} Case={Case} section="retours"/>;
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
// (23 nov., lot retours-suivi) Réparée : la ligne était cassée sur iPhone (vignette vide qui débordait, texte en colonne
// étroite, boutons mal alignés). Une CARTE blanche : vignette 44 (tuile neutre sans photo), titre et une phrase courte
// sur toute la largeur, puis deux vrais boutons alignés sous le texte (« Vinted », « Réglé » = SON clic qui l'archive).
export function RetoursAVerifier({ perimes, onRegle, Photo = null }) {
  const l = Array.isArray(perimes) ? perimes : [];
  if (!l.length) return null;
  return (
    <section className="vrm-rt vrm-rt-verif" data-retours-a-verifier={String(l.length)} aria-label={tr('rl.verif.titre')}>
      <h2 className="vrm-rt-h2">{tr('rl.verif.titre')} <span>{l.length}</span></h2>
      <div className="vrm-rt-groupe">
        {l.map((c) => {
          const src = c.achat && c.achat.photo ? (typeof c.achat.photo === 'string' ? c.achat.photo : (c.achat.photo.url || '')) : '';
          return (
            <div key={c.cle} className="vrm-rt-verif-ligne" data-retour-perime={c.cle}>
              <div className="vrm-rt-tete">
                {src && Photo ? <Photo src={src} alt="" loading="lazy" decoding="async" width={44} height={44} className="vrm-rt-photo is-44"/> : <span className="vrm-rt-tuile is-44" aria-hidden="true">{ICONE_RETOUR}</span>}
                <div className="vrm-rt-textes">
                  <span className="vrm-rt-titre">{c.num ? <span className="vrm-rt-num"><small>N°</small>{c.num}</span> : null}{c.titre || tr('retours.article')}</span>
                  <span className="vrm-rt-meta" data-retour-perime-phrase="">{c.limiteTexte ? tr('rt.v.court', { d: c.limiteTexte }) : tr('rt.v.courtSans')}</span>
                </div>
              </div>
              <div className="n-actions vrm-rt-actions" data-n-actions={c.vinted ? 2 : 1}>
                {c.vinted ? <LienBouton href={c.vinted} icone={IC.externe} attrs={{ 'data-retour-perime-vinted': c.cle }}>{tr('rt.a.vinted')}</LienBouton> : null}
                <span className="n-bouton-bloc"><button type="button" className="n-bouton n-action" data-n-variante="teinte" data-retour-regle={c.cle} onClick={() => onRegle && onRegle(c.cle)}>
                  <span className="n-bouton-icone" aria-hidden="true">{IC.depose}</span><span className="n-bouton-libelle">{tr('rt.v.regle')}</span>
                </button></span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
