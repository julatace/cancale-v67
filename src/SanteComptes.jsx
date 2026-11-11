// ════════════════════════════════════════════════════════════════════════════
//  LA SANTÉ DE CHAQUE COMPTE VINTED (11 nov., lot sante-comptes) — L'ÉCRAN
//  Une forme, trois places : Paramètres → Mes comptes (`variante="reglages"`),
//  une carte de Statistiques (`variante="stats"`), et — seulement quand un
//  compte GLISSE — une ligne ambre de Ma journée (`useSanteComptes` +
//  `titreJournee`, posée par l'écran lui-même).
//  La règle : src/santeComptes.js (seuils écrits, aucun score). Cet écran ne lit
//  que ce qui est DÉJÀ capté ou publié : les profils et avis Vinted (projection,
//  jamais `select=data`), `panel_comptes_etat`, `moderation_vinted_{uid}` (si la
//  ligne existe), la publication `vrm_sante_envois` (l'écran des ventes en est le
//  propriétaire) et les ventes de la coque. Aucune écriture, aucune notification.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { santeComptes, lireEnvois, EVT_ENVOIS, SEUILS, FENETRE_J } from './santeComptes.js';
import { SUPABASE_URL, sbAuth, AUTH, load, onCloudReady, useVentesCoque, classifyOrderStatus } from './App.jsx';
import { tr, nombre, dateRelative } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import './styles-sante-comptes.css';

// ── LES LECTURES (une fois pour les trois places, relues quand l'extension écrit) ──
// La même projection que « Notes reçues » de Statistiques (petites lignes, jamais `select=data`).
const SEL_PROFIL = 'id,uid:data->>uid,at:data->>capturedAt,login:data->payload->user->>login,rep:data->payload->user->>feedback_reputation,n:data->payload->user->>feedback_count,pos:data->payload->user->>positive_feedback_count,neu:data->payload->user->>neutral_feedback_count,neg:data->payload->user->>negative_feedback_count';
const get = async (q) => {
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: sbAuth(), cache: 'no-store' }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? j : null; } catch (_) { return null; }
};
export async function lireSourcesSante() {
  const [p, f, e, m] = await Promise.all([
    get(`app_data?id=like.harvest_*_profile&select=${SEL_PROFIL}`),
    get('app_data?id=like.harvest_*_feedbacks&data->>type=eq.feedbacks&select=id,avis:data->payload->user_feedbacks,pag:data->payload->pagination,hist:data->payload->historique'),
    get('app_data?id=eq.panel_comptes_etat&select=c:data->comptes'),
    get('app_data?id=like.moderation_vinted_*&select=id,e:data->e'),
  ]);
  let profils = null;
  if (p) {
    const avis = {};
    for (const x of f || []) { const u = String((x && x.id) || '').match(/^harvest_(\d+)_feedbacks$/); if (u && Array.isArray(x.avis)) avis[u[1]] = x; }
    profils = p.map((x) => {
      const uid = String((x && x.uid) || (String((x && x.id) || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
      const a = avis[uid];
      return { uid, at: x.at, login: x.login, rep: x.rep, n: x.n, pos: x.pos, neu: x.neu, neg: x.neg, avis: a ? a.avis : undefined, pag: a && a.pag && typeof a.pag === 'object' ? a.pag : null, hist: a && Array.isArray(a.hist) ? a.hist : null };
    });
  }
  const etats = e ? ((e[0] && e[0].c && typeof e[0].c === 'object') ? e[0].c : {}) : null;
  let moderation = null;
  if (m) { moderation = {}; for (const x of m) { const u = String((x && x.id) || '').match(/^moderation_vinted_(\d+)$/); if (u && Array.isArray(x.e)) moderation[u[1]] = { e: x.e }; } }
  return { profils, etats, moderation };
}

let memo = null, promesse = null;
const abonnes = new Set();
const prevenir = () => abonnes.forEach((f) => { try { f(); } catch (_) {} });
function relire() {
  if (promesse) return promesse;
  promesse = lireSourcesSante().then((x) => { memo = { ...x, at: Date.now() }; promesse = null; prevenir(); }, () => { promesse = null; });
  return promesse;
}
if (typeof window !== 'undefined') {
  let t = null;
  window.addEventListener('vrm:ext', (e) => { const d = e && e.detail; if (!d || d.type !== 'maj') return; clearTimeout(t); t = setTimeout(() => { if (abonnes.size) relire(); }, 1500); });
  window.addEventListener(EVT_ENVOIS, prevenir);
}

// Les comptes : ceux reliés sur l'appareil, moins les comptes masqués (un exclu n'apparaît nulle part).
function comptesAffiches(liste) {
  let lies = Array.isArray(liste) && liste.length ? liste : null;
  if (!lies) { try { const a = JSON.parse(localStorage.getItem('vinted_accounts') || 'null'); if (Array.isArray(a)) lies = a; } catch (_) {} }
  const caches = new Set((load('vinted_accounts_hidden', []) || []).map(String));
  const out = new Map();
  for (const a of lies || []) { const u = String((a && a.vinted_user_id) || ''); if (u && !caches.has(u) && !out.has(u)) out.set(u, { uid: u, nom: (a && a.login) || u }); }
  return [...out.values()];
}

export function useSanteComptes({ comptes: liste = null, actif = true } = {}) {
  const [tick, setTick] = React.useState(0);
  const { ventes, ko } = useVentesCoque();
  React.useEffect(() => {
    if (!actif) return undefined;
    const f = () => setTick((t) => t + 1);
    abonnes.add(f);
    if (!memo || Date.now() - memo.at > 5 * 60000) relire();
    const stop = onCloudReady(f);
    return () => { abonnes.delete(f); if (typeof stop === 'function') stop(); };
  }, [actif]);
  const owner = (AUTH.user && AUTH.user.id) || '';
  const comptes = comptesAffiches(liste);
  const cle = comptes.map((c) => c.uid).join(',');
  return React.useMemo(() => {
    if (!actif) return { etat: 'encours', comptes: [], aSurveiller: [] };
    return santeComptes({
      comptes, profils: memo ? memo.profils : undefined, etats: memo ? memo.etats : undefined, moderation: memo ? memo.moderation : null,
      envois: lireEnvois(owner), ventes, ko, estAnnulee: (o) => classifyOrderStatus(o.status) === 'cancelled',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, cle, tick, ventes, ko, owner]);   // `tick` : une relecture des sources, une publication des envois
}

// ── LES TEXTES (tous par tr(), la règle ne rend que des nombres et des codes) ──
const virg = (x) => nombre(x, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export function duree(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const h = ms / 3600000;
  if (h < 1) return tr('sante.duree.moinsH');
  if (h < 24) return tr('sante.duree.h', { n: Math.round(h) });
  return tr('sante.duree.j', { n: Math.round(h / 24 * 10) / 10 });
}
// LA raison d'un compte à surveiller, en une phrase (Ma journée, l'en-tête de la carte).
export function texteRaison(r) {
  if (!r) return '';
  switch (r.k) {
    case 'moderation': return r.sorte === 'banni' ? tr('sante.r.banni') : r.sorte === 'restreint' ? tr('sante.r.restreint') : tr('sante.r.masquee', { n: r.masquees || 0 });
    case 'retards': return r.enRetard && r.valeur < SEUILS.retards ? tr('sante.r.enRetard', { n: r.enRetard }) : tr('sante.r.retards', { n: r.valeur });
    case 'annulees': return tr('sante.r.annulees', { n: r.valeur });
    case 'avisBas': return tr('sante.r.avisBas', { n: r.valeur });
    case 'note': return tr('sante.r.note', { note: virg(r.valeur) });
    case 'delai': return tr('sante.r.delai', { duree: duree(r.valeur) });
    default: return '';
  }
}
export function titreJournee(liste) {
  if (!liste || !liste.length) return '';
  return liste.length === 1 ? tr('sante.journee.un', { nom: liste[0].nom }) : tr('sante.journee.n', { n: liste.length });
}
function valeur(i) {
  if (!i.lu) return '—';
  switch (i.k) {
    case 'note': return tr('sante.v.note', { note: virg(i.valeur), n: i.n });
    case 'avisBas': return tr('sante.v.avisBas', { n: i.valeur, sur: i.sur });
    case 'delai': return tr('sante.v.delai', { duree: duree(i.valeur), n: i.n });
    case 'retards': return tr('sante.v.retards', { n: i.valeur, sur: i.sur }) + (i.enRetard ? ' · ' + tr('sante.v.enRetard', { n: i.enRetard }) : '');
    case 'annulees': return tr('sante.v.annulees', { n: i.valeur, total: i.n, taux: nombre(i.taux, { maximumFractionDigits: 1 }) });
    case 'moderation': return i.sorte === 'banni' ? tr('sante.r.banni') : i.sorte === 'restreint' ? tr('sante.r.restreint') : i.sorte === 'masquee' ? tr('sante.r.masquee', { n: i.masquees }) : tr('sante.v.moderationOk');
    case 'fraicheur': {
      const h = i.valeur / 3600000;
      const q = h < 1 ? tr('sante.duree.moinsHPasse') : h < 48 ? dateRelative(-Math.round(h), 'hour') : dateRelative(-Math.round(h / 24), 'day');
      return i.ancienne ? tr('sante.v.fraicheurVieille', { quand: q }) : q;
    }
    default: return '—';
  }
}
function texteTendance(i) {
  const t = i.tendance;
  if (!t) return null;
  const v = i.k === 'delai' ? duree(t.avant) : i.k === 'note' ? virg(t.avant) : nombre(t.avant);
  return { sens: t.sens, texte: tr('sante.t.avant', { v, j: FENETRE_J }) };
}
function raisonPasSu(i) {
  const r = i.raison;
  if (r === 'sansDate') return tr('sante.ps.sansDate', { n: i.sansDate || 0 });
  if (r === 'sansLimite') return tr('sante.ps.sansLimite', { n: i.sansLimite || 0 });
  return tr('sante.ps.' + r);
}
function seuil(k) {
  switch (k) {
    case 'note': return tr('sante.s.note', { s: virg(SEUILS.note) });
    case 'avisBas': return tr('sante.s.avisBas', { s: SEUILS.avisBas, e: SEUILS.etoilesBas });
    case 'delai': return tr('sante.s.delai', { s: SEUILS.delaiH / 24, n: SEUILS.delaiMinColis });
    case 'retards': return tr('sante.s.retards', { s: SEUILS.retards, j: FENETRE_J });
    case 'annulees': return tr('sante.s.annulees', { s: SEUILS.annulees, t: SEUILS.annuleesTaux, j: FENETRE_J });
    case 'moderation': return tr('sante.s.moderation');
    case 'fraicheur': return tr('sante.s.fraicheur', { h: SEUILS.fraicheH });
    default: return '';
  }
}

const Fleche = ({ sens }) => {
  const d = sens === 'egal' ? 'M2 6h8' : sens === 'hausse' ? 'M6 10V2M2.5 5.5 6 2l3.5 3.5' : 'M6 2v8M2.5 6.5 6 10l3.5-3.5';
  return <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
};

const aller = (q) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })); } catch (_) {} };

function Indicateur({ i }) {
  const t = texteTendance(i);
  return (
    <li className="vrm-sc-ind" data-sc-ind={i.k} data-sc-lu={i.lu ? '1' : '0'} data-sc-alerte={i.alerte ? '1' : '0'} data-sc-valeur={i.lu && i.valeur != null ? String(i.valeur) : ''}
      data-sc-tendance={t ? t.sens : ''} data-sc-raison={i.lu ? '' : i.raison}>
      <div className="vrm-sc-ind-tete">
        <span className="vrm-sc-ind-nom">{tr('sante.i.' + i.k)}</span>
        <span className="vrm-sc-ind-val">{valeur(i)}</span>
      </div>
      {t ? <span className="vrm-sc-ind-tend"><Fleche sens={t.sens}/>{t.texte}</span> : null}
      {!i.lu ? <span className="vrm-sc-ind-ps">{raisonPasSu(i)}</span> : null}
      <span className="vrm-sc-ind-src">{seuil(i.k)} {tr('sante.src.' + i.k)}</span>
    </li>
  );
}

function Compte({ c }) {
  const [ouvert, setOuvert] = React.useState(false);
  const lignes = ['note', 'avisBas', 'delai', 'retards', 'annulees', 'moderation', 'fraicheur'].map((k) => c.indicateurs[k]);
  const autres = c.alertes.length - 1;
  return (
    <section className="vrm-sc-compte" data-sc-compte={c.uid} data-sc-etat={c.etat} data-sc-raison-k={c.raison ? c.raison.k : ''} data-sc-lus={c.lus} data-sc-alertes={c.alertes.join(' ')}>
      <div className="vrm-sc-tete">
        <span className="vrm-sc-nom">{c.nom}</span>
        <span className="vrm-sc-etat" data-ton={c.etat}>{tr('sante.etat.' + c.etat)}</span>
      </div>
      {c.raison ? (
        <div className="vrm-sc-raison">
          <span data-sc-raison-texte="">{texteRaison(c.raison)}{autres > 0 ? ' · ' + tr('sante.autres', { n: autres }) : ''}</span>
          <button type="button" className="vrm-lien-action vrm-sc-geste" data-sc-geste={c.raison.geste} onClick={() => aller(c.raison.geste)}>{tr('sante.voir')}</button>
        </div>
      ) : (
        <p className="vrm-sc-sous" data-sc-sous="">{tr('sante.lus', { n: c.lus, sur: c.sur })}</p>
      )}
      <button type="button" className="vrm-sc-pourquoi" aria-expanded={ouvert} data-sc-pourquoi="" onClick={() => setOuvert((o) => !o)}>{tr('sante.pourquoi')}</button>
      {ouvert ? <ul className="vrm-sc-inds" data-sc-inds="">{lignes.map((i) => <Indicateur key={i.k} i={i}/>)}</ul> : null}
    </section>
  );
}

// La carte (Statistiques) ou le panneau (Paramètres → Mes comptes).
export default function SanteComptes({ variante = 'stats', comptes = null }) {
  useLangue();
  const S = useSanteComptes({ comptes });
  const corps = S.etat === 'encours' && !S.comptes.length ? <p className="vrm-sc-vide" data-sc-vide="encours">{tr('sante.encours')}</p>
    : !S.comptes.length ? <p className="vrm-sc-vide" data-sc-vide="aucun">{tr('sante.aucun')}</p>
      : S.comptes.map((c) => <Compte key={c.uid} c={c}/>);
  const n = S.aSurveiller.length;
  if (variante === 'reglages') {
    return <div className="vrm-sc vrm-sc-reglages" data-sante-comptes="reglages" data-sc-n-surveiller={n}>{corps}</div>;
  }
  return (
    <section className="vrm-sv-carte vrm-sc vrm-sc-carte" data-stats-carte="sante-comptes" data-sante-comptes="stats" data-sc-n-surveiller={n}>
      <div className="vrm-sv-carte-tete">
        <h2 className="vrm-display vrm-sv-carte-titre">{tr('sante.titre')}</h2>
        {S.comptes.length ? <span className="vrm-sv-note" data-sc-entete="">{n ? tr('sante.nSurveiller', { n }) : tr('sante.toutVa')}</span> : null}
      </div>
      {corps}
    </section>
  );
}
